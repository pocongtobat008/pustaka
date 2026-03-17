import { handleError } from '../utils/errorHandler.js';
import path from 'path';
import fs from 'fs';
import { knex } from '../db.js';
import { DOC_STATUS } from '../constants/status.js';
import { systemLog } from '../utils/logger.js';
import { addOcrJob } from '../utils/queue.js';
import { UPLOADS_DIR } from '../config/upload.js';
import { vectorStore } from '../ai_search.js';
import { parseJsonArraySafe, parseJsonObjectSafe } from '../utils/jsonSafe.js';

// Helper: Convert ISO 8601 datetime to MySQL-compatible format
const toMySQLDate = (isoOrDate) => {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    return d.toISOString().slice(0, 19).replace('T', ' ');
};

export const getDocuments = async (req, res) => {
    try {
        const { folderId } = req.query;
        let query = knex('documents').select('*');

        if (folderId !== undefined) {
            if (folderId && folderId !== 'null' && folderId !== '') {
                query = query.where('folderId', folderId);
            } else {
                query = query.whereNull('folderId').orWhere('folderId', '');
            }
        }

        const rows = await query;
        res.json(rows);
    } catch (err) {
        handleError(res, err, "DOCUMENT Error");
    }
};

export const getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await knex('documents').where('id', id).first();
        if (!doc) return res.status(404).json({ error: "Document not found" });
        return res.json(doc);
    } catch (err) {
        handleError(res, err, "DOCUMENT Error");
    }
};

export const uploadDocument = async (req, res) => {
    try {
        if (!req.file && !req.body.url) return res.status(400).json({ error: 'No file uploaded or URL provided' });

        const { folderId, owner, url } = req.body;
        const title = req.body.title || (req.file ? req.file.originalname : 'Document');
        const type = req.file ? req.file.mimetype : (req.body.type || 'application/octet-stream');
        const size = req.file ? (req.file.size / 1024 / 1024).toFixed(2) + ' MB' : (req.body.size || '0 MB');
        const uploadDate = toMySQLDate(req.body.uploadDate);

        // Check for duplicate title in same folder (Auto Revision)
        const normalizedFolderId = (folderId === "null" || folderId === "" || !folderId) ? null : folderId;
        const existingDoc = await knex('documents')
            .where('title', title)
            .where(builder => {
                if (normalizedFolderId) builder.where('folderId', normalizedFolderId);
                else builder.whereNull('folderId');
            })
            .first();

        // --- REVISION LOGIC ---
        if (existingDoc) {
            console.log(`Duplicate found: ${title}. Creating revision.`);

            const versionsHistory = parseJsonArraySafe(existingDoc.versionsHistory);

            // Archive current version
            let archivedUrl = existingDoc.url;
            if (existingDoc.url && existingDoc.url.startsWith('/uploads/')) {
                const ext = existingDoc.title.split('.').pop() || 'bin';
                const filename = `ARCHIVE-${existingDoc.id}-${Date.now()}.${ext}`;
                const newFilePath = path.join(UPLOADS_DIR, filename);
                const oldFilePath = path.join(UPLOADS_DIR, path.basename(existingDoc.url));
                try {
                    if (fs.existsSync(oldFilePath)) {
                        fs.copyFileSync(oldFilePath, newFilePath);
                        archivedUrl = `/uploads/${filename}`;
                    }
                } catch (e) { console.error("Archiving failed:", e); }
            }

            versionsHistory.push({
                timestamp: existingDoc.uploadDate || toMySQLDate(),
                size: existingDoc.size,
                type: existingDoc.type,
                file_data: null,
                url: archivedUrl,
                title: existingDoc.title,
                user: existingDoc.owner || 'System',
                version: existingDoc.version || 1
            });

            const fileUrl = req.file ? `/uploads/${req.file.filename}` : (url || existingDoc.url);
            if (req.file) {
                console.log(`[Revision] New file received: ${req.file.originalname} -> ${req.file.filename}`);
                console.log(`[Revision] Path: ${req.file.path}`);
                console.log(`[Revision] Exists? ${fs.existsSync(req.file.path)}`);
            }
            const absoluteFilePath = req.file ? req.file.path : null;
            const finalType = req.file ? req.file.mimetype : (req.body.type || existingDoc.type);
            const finalSize = req.file ? (req.file.size / 1024 / 1024).toFixed(2) + ' MB' : (req.body.size || existingDoc.size);
            const initialOcr = req.body.ocrContent || '';
            const status = initialOcr ? DOC_STATUS.DONE : DOC_STATUS.PROCESSING;

            const updateData = {
                title: title,
                type: finalType,
                size: finalSize,
                uploadDate: uploadDate,
                url: fileUrl,
                ocrContent: initialOcr,
                file_data: null,
                versionsHistory: JSON.stringify(versionsHistory),
                version: knex.raw('COALESCE(version, 1) + 1'),
                status: status
            };

            try {
                console.log("Attempting to update document with data:", updateData);
                await knex('documents')
                    .where('id', existingDoc.id)
                    .update(updateData);
            } catch (dbError) {
                console.error("DATABASE UPDATE FAILED:", dbError.message);
                console.error("Data that failed:", updateData);
                throw dbError; // Re-throw to be caught by the main catch block
            }


            if (absoluteFilePath && !initialOcr) {
                try {
                    const context = {
                        type: 'inventory_invoice', // Label for worker
                        invoiceNo: req.body.invoiceNo,
                        vendor: req.body.vendor,
                        taxInvoiceNo: req.body.taxInvoiceNo,
                        specialNote: req.body.specialNote
                    };
                    const contextStr = JSON.stringify(context);
                    await addOcrJob(existingDoc.id, absoluteFilePath, contextStr, finalType, title, req.file?.size || 0);
                } catch (qErr) { console.error("Queue Error:", qErr); }
            }

            await systemLog(owner, "Revisi", `Otomatis membuat revisi: "${title}" v${(existingDoc.version || 1) + 1}`);
            req.app.get('io')?.emit('data:changed', { channel: 'documents' });
            return res.json({ success: true, id: existingDoc.id, version: (existingDoc.version || 1) + 1, isRevision: true, url: fileUrl });
        }

        // --- NEW DOCUMENT ---
        if (req.file) {
            console.log(`[Upload] New file received: ${req.file.originalname} -> ${req.file.filename}`);
            console.log(`[Upload] Path: ${req.file.path}`);
            console.log(`[Upload] Exists? ${fs.existsSync(req.file.path)}`);
        }
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : (url || '');
        const absoluteFilePath = req.file ? req.file.path : null;
        const finalType = req.file ? req.file.mimetype : (req.body.type || 'application/octet-stream');
        const finalSize = req.file ? (req.file.size / 1024 / 1024).toFixed(2) + ' MB' : (req.body.size || '0 MB');
        const initialOcr = req.body.ocrContent || '';
        const status = initialOcr ? DOC_STATUS.DONE : DOC_STATUS.PROCESSING;

        const newDocId = req.body.id || `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newDocData = {
            id: newDocId,
            title: title,
            type: finalType,
            size: finalSize,
            uploadDate: uploadDate,
            url: fileUrl,
            folderId: normalizedFolderId,
            department: req.body.department || null,
            owner: owner || 'System',
            ocrContent: initialOcr,
            auditId: req.body.auditId || null,
            stepIndex: req.body.stepIndex || null,
            file_data: null,
            status: status
        };

        try {
            console.log("Attempting to insert new document with data:", newDocData);
            await knex('documents').insert(newDocData);
        } catch (dbError) {
            console.error("DATABASE INSERT FAILED:", dbError.message);
            console.error("Data that failed:", newDocData);
            throw dbError; // Re-throw to be caught by the main catch block
        }
        if (absoluteFilePath && !initialOcr) {
            try {
                const context = {
                    type: 'inventory_invoice', // Label for worker
                    invoiceNo: req.body.invoiceNo,
                    vendor: req.body.vendor,
                    taxInvoiceNo: req.body.taxInvoiceNo,
                    specialNote: req.body.specialNote
                };
                const contextStr = JSON.stringify(context);
                await addOcrJob(newDocId, absoluteFilePath, contextStr, finalType, title);
            } catch (qErr) {
                console.error("Queue Error:", qErr);
            }
        }

        await systemLog(owner, "Upload", `Mengunggah dokumen (Queued): "${title}"`);

        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({
            success: true,
            id: newDocId,
            url: fileUrl, // For Pustaka compatibility
            document: {
                id: newDocId,
                title,
                type: finalType,
                size: finalSize,
                uploadDate,
                url: fileUrl,
                status
            }
        });
    } catch (err) {
        console.error("DB INSERT ERROR:", err.message);
        handleError(res, err, "DOCUMENT Error");
    }
};

export const deleteDocument = async (req, res) => {
    try {
        const subId = req.params.id;
        const doc = await knex('documents').where('id', subId).first();
        if (!doc) return res.status(404).json({ error: "Document not found" });

        // Delete main file if exists on disk
        if (doc.url && doc.url.startsWith('/uploads/')) {
            const filePath = path.join(UPLOADS_DIR, path.basename(doc.url));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log("Deleted file from disk:", filePath);
            }
        }

        // Manual Cascade Delete
        await knex('comments').where('documentId', subId).del();
        await knex('document_approvals').where('title', doc.title).del(); // Approx match or needs better link? 
        // Note: document_approvals doesn't seem to have documentId FK in schema, just title? 
        // Based on schema: document_approvals has 'id', 'title', 'attachment_url' etc.
        // It seems approvals are separate entities.

        // Clean up job_queue
        await knex('job_queue').where('data', 'like', `%"docId":"${subId}"%`).del();

        await knex('documents').where('id', subId).del();

        // --- ⚡ Fast RAM Cache Sync ---
        vectorStore.removeDocument(subId);

        await systemLog(null, "Delete Document", `Menghapus dokumen: "${doc.title}"`);
        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({ success: true });
    } catch (err) {
        console.error("[Delete Error] Failed to delete document:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};

export const moveDocument = async (req, res) => {
    try {
        const id = req.params.id || req.body.id;
        let { targetFolderId, owner } = req.body;

        // Normalize targetFolderId
        if (targetFolderId === "null" || targetFolderId === "" || targetFolderId === "undefined") {
            targetFolderId = null;
        }

        console.log(`[Move] Request: ID=${id}, Target=${targetFolderId}, Owner=${owner}`);

        const result = await knex('documents').where('id', id).update({ folderId: targetFolderId });

        if (result === 0) {
            console.warn(`[Move] Document not found or no change: ID=${id}`);
            // Don't return 404 here as it might just be no change, but good to know
        }

        await systemLog(owner || 'System', "Move", `Pindah file ID: ${id} ke folder: ${targetFolderId || 'Root'}`);
        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({ success: true });
    } catch (err) {
        console.error("[Move] Error:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};

export const copyDocument = async (req, res) => {
    try {
        const id = req.params.id || req.body.id;
        let { targetFolderId, owner } = req.body;

        // Normalize targetFolderId
        if (targetFolderId === "null" || targetFolderId === "" || targetFolderId === "undefined") {
            targetFolderId = null;
        }

        console.log(`[Copy] Request: ID=${id}, Target=${targetFolderId}, Owner=${owner}`);

        const doc = await knex('documents').where('id', id).first();
        if (!doc) {
            console.error(`[Copy] Document not found: ID=${id}`);
            return res.status(404).json({ error: "Document not found" });
        }

        const newDocId = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Remove ID from copy and set new ID
        const { id: _, ...docData } = doc;

        await knex('documents').insert({
            ...docData,
            id: newDocId,
            folderId: targetFolderId,
            title: "Copy of " + doc.title,
            uploadDate: toMySQLDate()
        });

        await systemLog(owner || doc.owner || 'System', "Copy", `Salin file: "${doc.title}" ke folder: ${targetFolderId || 'Root'}`);
        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({ success: true, newId: newDocId });
    } catch (err) {
        console.error("[Copy] Error:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};

export const restoreVersion = async (req, res) => {
    try {
        const { id } = req.params;
        const { timestamp, versionTimestamp, user } = req.body; // identify version by timestamp
        const actualTimestamp = timestamp || versionTimestamp;

        console.log(`[Restore] Request for ID: ${id}, Timestamp: ${actualTimestamp}`);

        if (!id || !actualTimestamp) {
            return res.status(400).json({ error: "Missing required params: id or timestamp" });
        }

        const doc = await knex('documents').where('id', id).first();
        if (!doc) return res.status(404).json({ error: "Document not found" });

        let history = parseJsonArraySafe(doc.versionsHistory);

        const versionToRestore = history.find(v => v.timestamp === actualTimestamp);
        if (!versionToRestore) {
            console.error(`[Restore] Version not found in history for timestamp: ${actualTimestamp}`);
            return res.status(404).json({ error: "Version not found in history" });
        }

        // Push current state to history before restoring
        history.push({
            timestamp: doc.uploadDate || toMySQLDate(),
            size: doc.size,
            type: doc.type,
            file_data: null,
            url: doc.url,
            title: doc.title,
            ocrContent: doc.ocrContent || '',
            user: user || doc.owner || 'System',
            version: doc.version || 1
        });

        // If restoring a file that is archived on disk
        let restoredUrl = versionToRestore.url;
        let restoredType = versionToRestore.type;

        // Optimisasi OCR: Gunakan ocrContent yang sudah ada di riwayat jika tersedia
        const ocrToUse = versionToRestore.ocrContent || '';
        const shouldRunOCR = !ocrToUse;

        await knex('documents').where('id', id).update({
            title: versionToRestore.title,
            size: versionToRestore.size,
            type: restoredType,
            url: restoredUrl,
            ocrContent: ocrToUse,
            uploadDate: toMySQLDate(),
            version: knex.raw('version + 1'),
            versionsHistory: JSON.stringify(history),
            status: shouldRunOCR ? DOC_STATUS.PROCESSING : DOC_STATUS.DONE
        });

        // Trigger OCR AFTER the DB update so the worker sees cleared ocrContent
        if (shouldRunOCR && restoredUrl && restoredUrl.startsWith('/uploads/')) {
            const absolutePath = path.join(UPLOADS_DIR, path.basename(restoredUrl));
            try {
                await addOcrJob(id, absolutePath, restoredType || 'application/octet-stream', versionToRestore.title);
            } catch (qErr) { console.error("Restore OCR Queue Error:", qErr); }
        }

        await systemLog(user, "Restore", `Restore dokumen "${doc.title}" ke versi tanggal ${timestamp}`);
        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({ success: true });

    } catch (err) {
        console.error("[Restore Error]:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};
export const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, folderId, department, auditId, stepIndex, ocrContent } = req.body;
        const owner = req.body.owner || 'System';

        const existingDoc = await knex('documents').where('id', id).first();
        if (!existingDoc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });

        const updateData = {
            title: title || existingDoc.title,
            folderId: (folderId === "null" || folderId === "") ? null : (folderId !== undefined ? folderId : existingDoc.folderId),
            department: department || existingDoc.department,
            auditId: auditId || existingDoc.auditId,
            stepIndex: stepIndex || existingDoc.stepIndex
        };

        // Handle File Update (Revision)
        if (req.file) {
            console.log(`[Update] Revision for: ${existingDoc.title}. New file: ${req.file.originalname}`);

            // 1. Archive Old File
            let versionsHistory = parseJsonArraySafe(existingDoc.versionsHistory);

            let archivedUrl = existingDoc.url;
            if (existingDoc.url && existingDoc.url.startsWith('/uploads/')) {
                const ext = existingDoc.title.split('.').pop() || 'bin';
                const filename = `ARCHIVE-${existingDoc.id}-${Date.now()}.${ext}`;
                const newFilePath = path.join(UPLOADS_DIR, filename);
                const oldFilePath = path.join(UPLOADS_DIR, path.basename(existingDoc.url));
                try {
                    if (fs.existsSync(oldFilePath)) {
                        fs.copyFileSync(oldFilePath, newFilePath);
                        archivedUrl = `/uploads/${filename}`;
                    }
                } catch (e) { console.error("Archiving failed:", e); }
            }

            versionsHistory.push({
                timestamp: existingDoc.uploadDate || toMySQLDate(),
                size: existingDoc.size,
                type: existingDoc.type,
                file_data: null,
                url: archivedUrl,
                title: existingDoc.title,
                user: existingDoc.owner || 'System',
                version: existingDoc.version || 1
            });

            // 2. Update File Fields
            updateData.url = `/uploads/${req.file.filename}`;
            updateData.type = req.file.mimetype;
            updateData.size = (req.file.size / 1024 / 1024).toFixed(2) + ' MB';
            updateData.uploadDate = toMySQLDate();
            updateData.versionsHistory = JSON.stringify(versionsHistory);
            updateData.version = (existingDoc.version || 1) + 1;

            // Gunakan hasil OCR dari client jika tersedia agar status langsung 'done'
            const initialOcr = ocrContent || '';
            updateData.ocrContent = initialOcr;
            updateData.status = initialOcr ? DOC_STATUS.DONE : DOC_STATUS.PROCESSING;

            // 3. Trigger OCR (after DB update to avoid race condition)
            // Store info needed to trigger OCR after the update
        }

        await knex('documents').where('id', id).update(updateData);
        await systemLog(owner, "Update Dokumen", `Update ${title || existingDoc.title} ${req.file ? '(Revisi File)' : ''}`);

        // Trigger OCR AFTER the DB update so the worker sees cleared ocrContent
        if (req.file && !ocrContent) {
            try {
                await addOcrJob(id, req.file.path, req.file.mimetype, updateData.title || existingDoc.title);
            } catch (qErr) { console.error("Queue Error:", qErr); }
        }

        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({ success: true, id, ...updateData });
    } catch (err) {
        console.error("Update Error:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};
// --- COMMENT LOGIC ---
export const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await knex('comments')
            .where('documentId', id)
            .orderBy('timestamp', 'asc');

        // Flatten JSON attachment for frontend compatibility
        const processedComments = comments.map(c => {
            if (c.attachment) {
                const att = parseJsonObjectSafe(c.attachment, null);
                if (att && att.url) {
                    return {
                        ...c,
                        attachmentUrl: att.url,
                        attachmentName: att.name,
                        attachmentType: att.type,
                        attachmentSize: att.size || '-'
                    };
                }
            }
            return c;
        });

        res.json(processedComments);
    } catch (err) {
        console.error("[GetComments Error]:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};

export const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { user, text, attachment } = req.body;

        const newComment = {
            id: `cmt-${Date.now()}`,
            documentId: id,
            user: user || 'System',
            text: text || '',
            timestamp: toMySQLDate(),
            attachment: attachment || null
        };

        if (req.file) {
            newComment.attachment = JSON.stringify({
                name: req.file.originalname,
                url: `/uploads/${req.file.filename}`,
                type: req.file.mimetype,
                size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB'
            });
        }

        await knex('comments').insert(newComment);

        // Return flattened version for immediate frontend update
        let responseComment = { ...newComment };
        if (newComment.attachment) {
            const att = parseJsonObjectSafe(newComment.attachment, null);
            if (att) {
                responseComment.attachmentUrl = att.url;
                responseComment.attachmentName = att.name;
                responseComment.attachmentType = att.type;
                responseComment.attachmentSize = att.size;
            }
        }

        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({ success: true, comment: responseComment });
    } catch (err) {
        console.error("[AddComment Error]:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};

export const promoteCommentAttachment = async (req, res) => {
    try {
        const { id: docId } = req.params;
        const { commentId } = req.body;

        const comment = await knex('comments').where('id', commentId).first();
        if (!comment || !comment.attachment) {
            return res.status(404).json({ error: "Comment or attachment not found" });
        }

        const attachment = parseJsonObjectSafe(comment.attachment, null);
        if (!attachment?.url) {
            return res.status(400).json({ error: "Comment attachment invalid" });
        }
        const doc = await knex('documents').where('id', docId).first();
        if (!doc) return res.status(404).json({ error: "Document not found" });

        // ARCHIVE CURRENT VERSION (Revision Logic)
        let versionsHistory = parseJsonArraySafe(doc.versionsHistory);

        let archivedUrl = doc.url;
        if (doc.url && doc.url.startsWith('/uploads/')) {
            const ext = doc.title.split('.').pop() || 'bin';
            const filename = `ARCHIVE-${doc.id}-${Date.now()}.${ext}`;
            const newFilePath = path.join(UPLOADS_DIR, filename);
            const oldFilePath = path.join(UPLOADS_DIR, path.basename(doc.url));
            try {
                if (fs.existsSync(oldFilePath)) {
                    fs.copyFileSync(oldFilePath, newFilePath);
                    archivedUrl = `/uploads/${filename}`;
                }
            } catch (e) { console.error("Archiving failed:", e); }
        }

        versionsHistory.push({
            timestamp: doc.uploadDate || toMySQLDate(),
            size: doc.size,
            type: doc.type,
            file_data: null,
            url: archivedUrl,
            title: doc.title,
            ocrContent: doc.ocrContent || '',
            user: doc.owner || 'System',
            version: doc.version || 1
        });

        // PROMOTE ATTACHMENT TO CURRENT VERSION
        const newUrl = attachment.url;
        const absoluteFilePath = path.join(UPLOADS_DIR, path.basename(newUrl));
        const finalType = attachment.type || 'application/octet-stream';
        const finalSize = attachment.size || '-';

        await knex('documents')
            .where('id', docId)
            .update({
                type: finalType,
                size: finalSize,
                uploadDate: toMySQLDate(),
                url: newUrl,
                ocrContent: '', // Trigger new OCR
                file_data: null,
                versionsHistory: JSON.stringify(versionsHistory),
                version: knex.raw('COALESCE(version, 1) + 1'),
                status: DOC_STATUS.PROCESSING
            });

        // Trigger OCR
        if (fs.existsSync(absoluteFilePath)) {
            try {
                const stats = fs.statSync(absoluteFilePath);
                await addOcrJob(docId, absoluteFilePath, '{}', finalType, doc.title, stats.size);
            } catch (qErr) { console.error("Queue Error:", qErr); }
        }

        await systemLog(comment.user, "Revisi (Chat Promotion)", `Mempromosikan lampiran chat sebagai revisi: "${doc.title}"`);
        req.app.get('io')?.emit('data:changed', { channel: 'documents' });
        res.json({ success: true });
    } catch (err) {
        console.error("[PromoteComment Error]:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};

export const streamDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await knex('documents').where('id', id).first();
        if (!doc || !doc.url) { // Added !doc.url check
            return res.status(404).json({ error: "Document not found or has no URL" });
        }

        // If it's an absolute URL, redirect
        if (doc.url.startsWith('http')) {
            return res.redirect(doc.url);
        }

        // Standard case: /uploads/filename.ext
        if (doc.url.startsWith('/uploads/')) {
            const fileBasename = path.basename(doc.url);
            const filePath = path.join(UPLOADS_DIR, fileBasename);

            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', doc.type || 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${doc.title}"`);
                return fs.createReadStream(filePath).pipe(res); // Added return and simplified
            } else {
                console.warn(`[Stream] File not found: ${filePath}`);
                return res.status(404).json({ error: "File not found on disk" });
            }
        }

        // Fallback for legacy data: URL is just the filename
        const filePath = path.join(UPLOADS_DIR, doc.url);
        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', doc.type || 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${doc.title}"`);
            return fs.createReadStream(filePath).pipe(res);
        }

        // If we reach here, we can't find the file.
        console.warn(`[Stream] Could not resolve URL to a file: ${doc.url}`);
        res.status(404).json({ error: "File cannot be located" });

    } catch (err) {
        console.error("[Stream Error]:", err);
        handleError(res, err, "DOCUMENT Error");
    }
};

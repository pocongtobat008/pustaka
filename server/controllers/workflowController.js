import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { systemLog } from '../utils/logger.js';
import { addOCRJob } from '../queue.js';
import { UPLOADS_DIR } from '../config/upload.js';
import path from 'path';
import fs from 'fs';
import {
    approvalFlowCreateSchema,
    approvalFlowUpdateSchema,
    approvalInitiateSchema,
    approvalActionSchema,
    approvalUpdateSchema,
    approvalResetStepSchema,
    validateRequestBody
} from '../utils/requestValidation.js';

// --- Helper Functions ---
const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';
const isOwnerOrAdmin = (req, owner) => isAdmin(req) || (owner && req.user?.username === owner);

export const getApprovalFlows = async (req, res) => {
    try {
        const flows = await knex('approval_flows').select('*');
        res.json(flows);
    } catch (err) {
        handleError(res, err, "WORKFLOW Error");
    }
};

export const createApprovalFlow = async (req, res) => {
    try {
        const data = validateRequestBody(approvalFlowCreateSchema, req, res);
        if (!data) return;

        const { name, description, steps, visual_config, privacy, allowed_departments, allowed_users } = data;
        // steps is array of { username, name, nodeId } from frontend

        const [dbRes] = await knex('approval_flows').insert({
            name,
            description,
            steps: JSON.stringify(steps || []),
            visual_config: JSON.stringify(visual_config || { nodes: [], edges: [] }),
            owner: req.user?.username || 'System',
            privacy: privacy || 'private',
            allowed_departments: JSON.stringify(allowed_departments || []),
            allowed_users: JSON.stringify(allowed_users || [])
        }).returning('id');

        const flowId = typeof dbRes === 'object' ? dbRes.id : dbRes;

        if (steps && steps.length > 0) {
            const inserts = steps.map((s, idx) => ({
                flow_id: flowId,
                step_name: s.name,
                approver_role: s.username, // Using username as the unique identifier for now
                node_id: s.nodeId,
                order_index: idx
            }));
            await knex('approval_steps').insert(inserts);
        }

        await systemLog(req.user?.username || 'System', "Create Workflow", `Created workflow: ${name}`);
        res.json({ id: flowId });
    } catch (e) {
        handleError(res, e, "WORKFLOW Error");
    }
};


export const getDocumentApprovals = async (req, res) => {
    try {
        const { documentId } = req.params;
        const approvals = await knex('document_approvals')
            .where('document_id', documentId)
            .orderBy('created_at', 'desc');
        res.json(approvals);
    } catch (err) {
        handleError(res, err, "WORKFLOW Error");
    }
};

export const initiateApproval = async (req, res) => {
    try {
        const data = validateRequestBody(approvalInitiateSchema, req, res);
        if (!data) return;

        // Handle payload from DocumentApproval.jsx
        const {
            title, description, division,
            requester_name, requester_username,
            attachment_url, attachment_name,
            steps, flow_id
        } = data;

        // Insert into document_approvals
        const [dbRes] = await knex('document_approvals').insert({
            title,
            description,
            division,
            requester_name,
            requester_username,
            attachment_url,
            attachment_name,
            flow_id: flow_id || null, // Optional link to template
            status: 'Pending',
            current_step_index: 0,
            created_at: knex.fn.now()
        }).returning('id');

        const approvalId = typeof dbRes === 'object' ? dbRes.id : dbRes;

        // Trigger OCR for main attachment
        if (attachment_url && attachment_url.startsWith('/uploads/')) {
            try {
                const absolutePath = path.join(UPLOADS_DIR, path.basename(attachment_url));
                await addOCRJob(approvalId, absolutePath, 'application/pdf', attachment_name, { type: 'approval', approvalId });
            } catch (qErr) { console.error("OCR Queue Error (Initiate):", qErr); }
        }

        // Insert instance steps into approval_steps
        // Note: approval_steps is used for both templates (flow_id) and instances (approval_id)
        // Here we insert for the instance (approval_id)
        const stepInserts = steps.map((s, idx) => ({
            approval_id: approvalId,
            step_index: idx,
            approver_username: s.username,
            approver_name: s.name,
            status: 'Pending',
            note: ''
        }));

        await knex('approval_steps').insert(stepInserts);

        await systemLog(requester_username, "Initiate Approval", `Started approval: ${title} (ID: ${approvalId})`);
        res.json({ success: true, id: approvalId });
    } catch (e) {
        console.error("Initiate Approval Error:", e);
        handleError(res, e, "WORKFLOW Error");
    }
};

export const approveStep = async (req, res) => {
    try {
        const data = validateRequestBody(approvalActionSchema, req, res);
        if (!data) return;

        const { approvalId } = req.params;
        const { username, action, note } = data; // action: 'Approve' | 'Reject'

        const approval = await knex('document_approvals').where('id', approvalId).first();
        if (!approval) return res.status(404).json({ error: "Approval not found" });

        const currentIdx = approval.current_step_index;

        // Get all steps for this approval instance
        const steps = await knex('approval_steps')
            .where('approval_id', approvalId)
            .orderBy('step_index', 'asc');

        const currentStep = steps[currentIdx];

        if (!currentStep) return res.status(400).json({ error: "Invalid step state" });

        // Verify approver (optional strict check, frontend does it too)
        if (currentStep.approver_username !== username) {
            // Allow admin override or check permissions if needed
            // for now, trust the payload or check generic admin role if implemented
        }

        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const fileName = req.file ? req.file.originalname : null;

        if (action === 'Reject') {
            // Update step status
            await knex('approval_steps').where('id', currentStep.id).update({
                status: 'Rejected',
                action_date: knex.fn.now(),
                note: note,
                attachment_url: fileUrl,
                attachment_name: fileName
            });

            // Update approval status
            await knex('document_approvals').where('id', approvalId).update({
                status: 'Rejected',
                current_step_index: currentIdx // Stays at this step or resets? Usually ends here.
            });

            await systemLog(username, "Reject Approval", `Rejected approval ID: ${approvalId} at step ${currentStep.step_index + 1}`);
            return res.json({ status: 'Rejected' });
        }

        // Handle Approve
        await knex('approval_steps').where('id', currentStep.id).update({
            status: 'Approved',
            action_date: knex.fn.now(),
            note: note,
            attachment_url: fileUrl,
            attachment_name: fileName
        });

        // Trigger OCR for step attachment
        if (fileUrl) {
            try {
                const absolutePath = path.join(UPLOADS_DIR, path.basename(fileUrl));
                await addOCRJob(approvalId, absolutePath, req.file.mimetype, fileName, { type: 'approval', approvalId });
            } catch (qErr) { console.error("OCR Queue Error (ApproveStep):", qErr); }
        }

        // Check if there is a next step
        const nextIdx = currentIdx + 1;
        if (nextIdx < steps.length) {
            // Move to next step
            await knex('document_approvals').where('id', approvalId).update({
                current_step_index: nextIdx,
                status: 'Pending' // Still pending overall
            });
            res.json({ status: 'Pending', next_step: nextIdx });
        } else {
            // All steps done -> Final Approval
            await knex('document_approvals').where('id', approvalId).update({
                status: 'Approved',
                current_step_index: nextIdx // Indicates completion
            });
            await systemLog(username, "Approve Workflow", `Final approval for ID: ${approvalId}`);
            res.json({ status: 'Approved' });
        }

    } catch (e) {
        console.error("Approve Step Error:", e);
        handleError(res, e, "WORKFLOW Error");
    }
};

export const updateApproval = async (req, res) => {
    try {
        const data = validateRequestBody(approvalUpdateSchema, req, res);
        if (!data) return;

        const { id } = req.params;
        const {
            title, description, division,
            requester_name, requester_username,
            attachment_url, attachment_name,
            steps, flow_id
        } = data;

        // Get existing approval to check if user is requester or admin
        const existing = await knex('document_approvals').where('id', id).first();
        if (!existing) {
            return res.status(404).json({ error: "Approval not found" });
        }

        // Only requester or admin can update
        if (existing.requester_username !== req.user?.username && !isAdmin(req)) {
            return res.status(403).json({ error: 'Hanya pembuat persetujuan atau admin yang dapat mengubah persetujuan ini' });
        }

        // Update document_approvals
        await knex('document_approvals').where('id', id).update({
            title,
            description,
            division,
            attachment_url,
            attachment_name,
            flow_id: flow_id || null,
            status: 'Pending',
            current_step_index: 0,
            // Specifically for resubmission, we might want to log it
        });

        // Reset steps: Delete old ones and insert new ones
        await knex('approval_steps').where('approval_id', id).del();

        const stepInserts = steps.map((s, idx) => ({
            approval_id: id,
            step_index: idx,
            approver_username: s.username,
            approver_name: s.name,
            status: 'Pending',
            note: ''
        }));

        await knex('approval_steps').insert(stepInserts);

        await systemLog(req.user?.username || 'System', "Resubmit Approval", `Resubmitted approval: ${title} (ID: ${id})`);
        res.json({ success: true });
    } catch (e) {
        console.error("Update Approval Error:", e);
        handleError(res, e, "WORKFLOW Error");
    }
};

export const getAllApprovals = async (req, res) => {
    try {
        const approvals = await knex('document_approvals')
            .select('*')
            .orderBy('created_at', 'desc');

        // Hydrate with steps
        // Efficient way: fetch all steps for these approvals
        const approvalIds = approvals.map(a => a.id);
        const steps = await knex('approval_steps')
            .whereIn('approval_id', approvalIds)
            .orderBy('step_index', 'asc');

        // Group steps by approval_id
        const stepsMap = {};
        steps.forEach(s => {
            if (!stepsMap[s.approval_id]) stepsMap[s.approval_id] = [];
            stepsMap[s.approval_id].push(s);
        });

        // Attach steps to approvals
        const result = approvals.map(a => ({
            ...a,
            steps: stepsMap[a.id] || []
        }));

        res.json(result);
    } catch (err) {
        handleError(res, err, "WORKFLOW Error");
    }
};

export const deleteApproval = async (req, res) => {
    try {
        const { approvalId } = req.params;

        // Get existing approval to check if it's the requester or admin
        const existing = await knex('document_approvals').where('id', approvalId).first();
        if (!existing) {
            return res.status(404).json({ error: "Approval not found" });
        }

        // Only requester or admin can delete
        if (existing.requester_username !== req.user?.username && !isAdmin(req)) {
            return res.status(403).json({ error: 'Hanya pembuat persetujuan atau admin yang dapat menghapus persetujuan ini' });
        }

        // Deleting approval steps first
        await knex('approval_steps').where('approval_id', approvalId).del();

        const deleted = await knex('document_approvals').where('id', approvalId).del();

        if (!deleted) {
            return res.status(404).json({ error: "Approval not found" });
        }

        await systemLog(req.user?.username || 'System', "Delete Approval", `Deleted approval ID: ${approvalId} (${existing.title})`);
        res.json({ success: true });
    } catch (e) {
        console.error("Delete Approval Error:", e);
        handleError(res, e, "WORKFLOW Error");
    }
};

export const deleteApprovalFlow = async (req, res) => {
    try {
        const { id } = req.params;

        // Get existing flow to check ownership
        const existing = await knex('approval_flows').where('id', id).first();
        if (!existing) {
            return res.status(404).json({ error: "Workflow template not found" });
        }

        // Check if user is owner or admin
        if (!isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner SOP atau admin yang dapat menghapus SOP ini' });
        }

        // First delete associated steps in approval_steps (where flow_id is matched)
        await knex('approval_steps').where('flow_id', id).del();

        const deleted = await knex('approval_flows').where('id', id).del();

        if (!deleted) {
            return res.status(404).json({ error: "Flow template not found" });
        }

        await systemLog(req.user?.username || 'System', "Delete Workflow", `Deleted workflow template ID: ${id} (${existing.name})`);
        res.json({ success: true });
    } catch (e) {
        console.error("Delete Approval Flow Error:", e);
        handleError(res, e, "WORKFLOW Error");
    }
};

export const updateApprovalFlow = async (req, res) => {
    try {
        const data = validateRequestBody(approvalFlowUpdateSchema, req, res);
        if (!data) return;

        const { id } = req.params;
        const { name, description, steps, visual_config, privacy, allowed_departments, allowed_users } = data;

        // Get existing flow to check ownership
        const existing = await knex('approval_flows').where('id', id).first();
        if (!existing) {
            return res.status(404).json({ error: "Workflow template not found" });
        }

        // Check if user is owner or admin
        if (!isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner SOP atau admin yang dapat mengubah SOP ini' });
        }

        await knex('approval_flows').where('id', id).update({
            name,
            description,
            steps: JSON.stringify(steps || []),
            visual_config: JSON.stringify(visual_config || { nodes: [], edges: [] }),
            privacy: privacy !== undefined ? privacy : existing.privacy,
            allowed_departments: allowed_departments ? JSON.stringify(allowed_departments) : existing.allowed_departments,
            allowed_users: allowed_users ? JSON.stringify(allowed_users) : existing.allowed_users
        });

        if (steps) {
            // Simple approach: delete old steps and insert new ones
            await knex('approval_steps').where('flow_id', id).del();
            if (steps.length > 0) {
                const inserts = steps.map((s, idx) => ({
                    flow_id: id,
                    step_name: s.name,
                    approver_role: s.username,
                    node_id: s.nodeId,
                    order_index: idx
                }));
                await knex('approval_steps').insert(inserts);
            }
        }

        await systemLog(req.user?.username || 'System', "Update Workflow", `Updated workflow template: ${name} (ID: ${id})`);
        res.json({ success: true });
    } catch (e) {
        console.error("Update Approval Flow Error:", e);
        handleError(res, e, "WORKFLOW Error");
    }
};

export const resetApprovalStep = async (req, res) => {
    try {
        const data = validateRequestBody(approvalResetStepSchema, req, res);
        if (!data) return;

        const { id } = req.params;
        const { stepIndex, username } = data;

        const approval = await knex('document_approvals').where('id', id).first();
        if (!approval) return res.status(404).json({ error: "Approval not found" });

        // Reset the target step and all subsequent steps back to 'Pending'
        await knex('approval_steps')
            .where('approval_id', id)
            .where('step_index', '>=', stepIndex)
            .update({
                status: 'Pending',
                note: '',
                action_date: null
            });

        // Reset the approval's current step index and overall status
        await knex('document_approvals')
            .where('id', id)
            .update({
                current_step_index: stepIndex,
                status: 'Pending'
            });

        await systemLog(username || 'System', "Reset Step", `Reset approval ${id} from step ${stepIndex}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Reset Approval Step Error:", e);
        handleError(res, e, "WORKFLOW Error");
    }
};

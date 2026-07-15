import { knex } from '../db.js';
import XLSX from 'xlsx';
import fs from 'fs';

const handleError = (res, e, prefix = 'COA') => {
    console.error(`[${prefix}] Error:`, e.message || e);
    res.status(500).json({ error: e.message || 'Internal Server Error' });
};

// ============ GET ALL (Hierarchical) ============
export const getCoaHierarchy = async (req, res) => {
    try {
        const { search, active_only } = req.query;

        let accountsQuery = knex('coa_accounts').orderBy('code', 'asc');
        let subsQuery = knex('coa_sub_accounts').orderBy('code', 'asc');
        let depsQuery = knex('coa_departments').orderBy('code', 'asc');

        if (active_only === 'true') {
            accountsQuery = accountsQuery.where('is_active', true);
            subsQuery = subsQuery.where('is_active', true);
            depsQuery = depsQuery.where('is_active', true);
        }

        if (search && search.trim()) {
            const terms = search.trim().split(/\s+/).filter(Boolean);
            const termMatch = (builder, term) => {
                const q = `%${term}%`;
                builder.where(function () {
                    this.where('code', 'ilike', q).orWhere('name', 'ilike', q).orWhere('description', 'ilike', q);
                });
            };
            accountsQuery = accountsQuery.where(function () {
                terms.forEach((term, i) => {
                    if (i === 0) termMatch(this, term);
                    else this.orWhere(function () { termMatch(this, term); });
                });
            });
            subsQuery = subsQuery.where(function () {
                terms.forEach((term, i) => {
                    if (i === 0) termMatch(this, term);
                    else this.orWhere(function () { termMatch(this, term); });
                });
            });
            depsQuery = depsQuery.where(function () {
                terms.forEach((term, i) => {
                    if (i === 0) termMatch(this, term);
                    else this.orWhere(function () { termMatch(this, term); });
                });
            });
        }

        const accounts = await accountsQuery;
        const subs = await subsQuery;
        const deps = await depsQuery;

        // When searching, include ALL parent records of matched children
        if (search && search.trim()) {
            const matchedAccountIdsFromSubs = new Set(subs.map(s => s.account_id));
            const matchedSubIdsFromDeps = new Set(deps.map(d => d.sub_account_id));

            // Fetch parent subs for matched departments (if not already in subs)
            let parentSubsForDeps = [];
            if (matchedSubIdsFromDeps.size > 0) {
                parentSubsForDeps = await knex('coa_sub_accounts').whereIn('id', [...matchedSubIdsFromDeps]);
                // Add missing subs to the array
                for (const ps of parentSubsForDeps) {
                    if (!subs.find(s => s.id === ps.id)) subs.push(ps);
                }
            }

            // Collect all account_ids needed: from matched subs + parent subs of matched deps
            const allNeededAccountIds = new Set([
                ...matchedAccountIdsFromSubs,
                ...parentSubsForDeps.map(s => s.account_id)
            ]);

            // Fetch parent accounts (if not already in accounts)
            if (allNeededAccountIds.size > 0) {
                const missingAccountIds = [...allNeededAccountIds].filter(id => !accounts.find(a => a.id === id));
                if (missingAccountIds.length > 0) {
                    const missingAccounts = await knex('coa_accounts').whereIn('id', missingAccountIds);
                    accounts.push(...missingAccounts);
                }
            }

            // For each newly added account, fetch ALL its subs (so tree context is complete)
            const newlyAddedAccountIds = accounts.filter(a => !matchedAccountIdsFromSubs.has(a.id)).map(a => a.id);
            if (newlyAddedAccountIds.length > 0) {
                const siblingSubs = await knex('coa_sub_accounts').whereIn('account_id', newlyAddedAccountIds);
                for (const sib of siblingSubs) {
                    if (!subs.find(s => s.id === sib.id)) subs.push(sib);
                }
            }

            // For each sub that now exists, fetch ALL its departments
            const allSubIds = new Set(subs.map(s => s.id));
            const allSubIdsArr = [...allSubIds].filter(id => !deps.find(d => d.sub_account_id === id || d.id === id));
            // We only need to fetch deps whose sub_account_id is in our subs but not yet in deps
            const matchedDepSubIds = new Set(deps.map(d => d.sub_account_id));
            const subsNeedingDeps = [...allSubIds].filter(id => !matchedDepSubIds.has(id) || !deps.some(d => d.sub_account_id === id));
            if (subsNeedingDeps.length > 0) {
                const missingDeps = await knex('coa_departments').whereIn('sub_account_id', subsNeedingDeps);
                for (const md of missingDeps) {
                    if (!deps.find(d => d.id === md.id)) deps.push(md);
                }
            }
        }

        // Build hierarchy
        const hierarchy = accounts.map(acc => ({
            ...acc,
            level: 'account',
            sub_accounts: subs
                .filter(s => s.account_id === acc.id)
                .map(sub => ({
                    ...sub,
                    level: 'sub_account',
                    departments: deps
                        .filter(d => d.sub_account_id === sub.id)
                        .map(dep => ({ ...dep, level: 'department' }))
                }))
        }));

        res.json(hierarchy);
    } catch (e) {
        handleError(res, e);
    }
};

// ============ SEARCH ============
export const searchCoa = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) return res.json([]);

        const terms = q.trim().split(/\s+/).filter(Boolean);
        const termMatch = (builder, term) => {
            const pattern = `%${term}%`;
            builder.where(function () {
                this.where('code', 'ilike', pattern).orWhere('name', 'ilike', pattern).orWhere('description', 'ilike', pattern);
            });
        };
        const buildWhere = (builder) => {
            terms.forEach((term, i) => {
                if (i === 0) termMatch(builder, term);
                else builder.orWhere(function () { termMatch(this, term); });
            });
        };

        const accounts = await knex('coa_accounts')
            .where('is_active', true)
            .where(buildWhere)
            .orderBy('code');

        const subs = await knex('coa_sub_accounts')
            .where('is_active', true)
            .where(buildWhere)
            .orderBy('code');

        const deps = await knex('coa_departments')
            .where('is_active', true)
            .where(buildWhere)
            .orderBy('code');

        // Fetch parents for matched subs/deps
        const accountIds = new Set(subs.map(s => s.account_id));
        const subIds = new Set(deps.map(d => d.sub_account_id));

        // Fetch parent subs for matched departments
        const parentSubs = subIds.size > 0
            ? await knex('coa_sub_accounts').whereIn('id', [...subIds])
            : [];

        // Collect all account_ids: from matched subs + parent subs of matched deps
        const allAccountIds = new Set([
            ...accountIds,
            ...parentSubs.map(s => s.account_id)
        ]);

        const parentAccounts = allAccountIds.size > 0
            ? await knex('coa_accounts').whereIn('id', [...allAccountIds])
            : [];

        const parentAccountMap = Object.fromEntries(parentAccounts.map(a => [a.id, a]));
        const parentSubMap = Object.fromEntries(parentSubs.map(s => [s.id, s]));

        const results = [
            ...accounts.map(a => ({ ...a, match_level: 'account' })),
            ...subs.map(s => ({ ...s, match_level: 'sub_account', parent_code: parentAccountMap[s.account_id]?.code, parent_name: parentAccountMap[s.account_id]?.name })),
            ...deps.map(d => ({ ...d, match_level: 'department', parent_code: parentSubMap[d.sub_account_id]?.code, parent_name: parentSubMap[d.sub_account_id]?.name, grandparent_code: parentAccountMap[parentSubMap[d.sub_account_id]?.account_id]?.code }))
        ];

        res.json(results);
    } catch (e) {
        handleError(res, e);
    }
};

// ============ CREATE ============
export const createCoa = async (req, res) => {
    try {
        const { level, code, name, description, parent_id } = req.body;

        if (!level || !code || !name) {
            return res.status(400).json({ error: 'level, code, dan name wajib diisi' });
        }

        let table;
        let payload;
        if (level === 'account') {
            table = 'coa_accounts';
            payload = { code, name, description: description || null };
        } else if (level === 'sub_account') {
            table = 'coa_sub_accounts';
            if (!parent_id) return res.status(400).json({ error: 'parent_id wajib diisi untuk sub_account' });
            payload = { account_id: parent_id, code, name, description: description || null };
        } else if (level === 'department') {
            table = 'coa_departments';
            if (!parent_id) return res.status(400).json({ error: 'parent_id wajib diisi untuk department' });
            payload = { sub_account_id: parent_id, code, name, description: description || null };
        } else {
            return res.status(400).json({ error: 'level harus: account, sub_account, atau department' });
        }

        const [created] = await knex(table).insert(payload).returning('*');
        req.app.get('io')?.emit('data:changed', { channel: 'coa' });
        res.json(created);
    } catch (e) {
        if (e.code === '23505') {
            return res.status(409).json({ error: 'Kode sudah ada' });
        }
        handleError(res, e);
    }
};

// ============ UPDATE ============
export const updateCoa = async (req, res) => {
    try {
        const { level, id } = req.params;
        const { code, name, description, is_active, parent_id } = req.body;

        let table;
        let whereCol;
        if (level === 'account') {
            table = 'coa_accounts';
            whereCol = 'id';
        } else if (level === 'sub_account') {
            table = 'coa_sub_accounts';
            whereCol = 'id';
        } else if (level === 'department') {
            table = 'coa_departments';
            whereCol = 'id';
        } else {
            return res.status(400).json({ error: 'level harus: account, sub_account, atau department' });
        }

        const payload = {};
        if (code !== undefined) payload.code = code;
        if (name !== undefined) payload.name = name;
        if (description !== undefined) payload.description = description;
        if (is_active !== undefined) payload.is_active = is_active;
        if (parent_id !== undefined) {
            if (level === 'sub_account') payload.account_id = parent_id;
            if (level === 'department') payload.sub_account_id = parent_id;
        }

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diupdate' });
        }

        await knex(table).where(whereCol, id).update(payload);
        req.app.get('io')?.emit('data:changed', { channel: 'coa' });
        res.json({ message: 'Berhasil diupdate' });
    } catch (e) {
        if (e.code === '23505') {
            return res.status(409).json({ error: 'Kode sudah ada' });
        }
        handleError(res, e);
    }
};

// ============ DELETE ============
export const deleteCoa = async (req, res) => {
    try {
        const { level, id } = req.params;

        if (level === 'account') {
            await knex('coa_departments').whereIn('sub_account_id',
                knex('coa_sub_accounts').select('id').where('account_id', id)
            ).del();
            await knex('coa_sub_accounts').where('account_id', id).del();
            await knex('coa_accounts').where('id', id).del();
        } else if (level === 'sub_account') {
            await knex('coa_departments').where('sub_account_id', id).del();
            await knex('coa_sub_accounts').where('id', id).del();
        } else if (level === 'department') {
            await knex('coa_departments').where('id', id).del();
        } else {
            return res.status(400).json({ error: 'level harus: account, sub_account, atau department' });
        }

        req.app.get('io')?.emit('data:changed', { channel: 'coa' });
        res.json({ message: 'Berhasil dihapus' });
    } catch (e) {
        handleError(res, e);
    }
};

// ============ DELETE ALL ============
export const deleteAllCoa = async (req, res) => {
    try {
        await knex('coa_departments').del();
        await knex('coa_sub_accounts').del();
        await knex('coa_accounts').del();
        req.app.get('io')?.emit('data:changed', { channel: 'coa' });
        res.json({ message: 'Semua data COA berhasil dihapus' });
    } catch (e) {
        handleError(res, e, 'COA Delete All');
    }
};

// ============ IMPORT EXCEL ============
export const importCoaExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rawData || rawData.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'File Excel kosong atau tidak terbaca' });
        }

        const getVal = (item, possibleKeys) => {
            const actualKeys = Object.keys(item);
            for (const pk of possibleKeys) {
                const match = actualKeys.find(ak => ak.toLowerCase().replace(/[_\s]/g, '') === pk.toLowerCase().replace(/[_\s]/g, ''));
                if (match) return item[match];
            }
            return undefined;
        };

        const formattedData = rawData.map(item => ({
            accountCode: String(getVal(item, ['no_coa', 'noCOA', 'code', 'kode_coa', 'kodeCOA']) || '').trim(),
            accountName: String(getVal(item, ['keterangan', 'name', 'nama_coa', 'namaCOA']) || '').trim(),
            subCode: String(getVal(item, ['sub_coa', 'subCOA', 'sub_code', 'subKode']) || '').trim(),
            subName: String(getVal(item, ['keterangan_sub', 'sub_name', 'sub_name', 'nama_sub']) || '').trim(),
            depCode: String(getVal(item, ['no_dep', 'noDep', 'dep_code', 'kode_dep']) || '').trim(),
            depName: String(getVal(item, ['keterangan_dep', 'dep_name', 'nama_dep']) || '').trim(),
        })).filter(row => row.accountCode && row.accountName);

        if (formattedData.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Tidak ada data valid. Pastikan kolom "No COA" dan "Keterangan" tersedia.' });
        }

        let importedAccounts = 0, importedSubs = 0, importedDeps = 0;

        for (const row of formattedData) {
            // Upsert Account
            let account = await knex('coa_accounts').where('code', row.accountCode).first();
            if (!account) {
                [account] = await knex('coa_accounts').insert({ code: row.accountCode, name: row.accountName }).returning('*');
                importedAccounts++;
            } else if (account.name !== row.accountName) {
                await knex('coa_accounts').where('id', account.id).update({ name: row.accountName });
            }

            // Upsert Sub Account
            if (row.subCode) {
                let sub = await knex('coa_sub_accounts').where({ account_id: account.id, code: row.subCode }).first();
                if (!sub) {
                    [sub] = await knex('coa_sub_accounts').insert({
                        account_id: account.id, code: row.subCode, name: row.subName || row.subCode
                    }).returning('*');
                    importedSubs++;
                } else if (sub.name !== row.subName && row.subName) {
                    await knex('coa_sub_accounts').where('id', sub.id).update({ name: row.subName });
                }

                // Upsert Department
                if (row.depCode) {
                    let dep = await knex('coa_departments').where({ sub_account_id: sub.id, code: row.depCode }).first();
                    if (!dep) {
                        await knex('coa_departments').insert({
                            sub_account_id: sub.id, code: row.depCode, name: row.depName || row.depCode
                        });
                        importedDeps++;
                    } else if (dep.name !== row.depName && row.depName) {
                        await knex('coa_departments').where('id', dep.id).update({ name: row.depName });
                    }
                }
            }
        }

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        req.app.get('io')?.emit('data:changed', { channel: 'coa' });
        res.json({
            message: `Import berhasil: ${importedAccounts} akun, ${importedSubs} sub akun, ${importedDeps} departemen baru`
        });
    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        handleError(res, e, 'COA Import');
    }
};

// ============ IMPORT BATCH (JSON rows) ============
export const importCoaBatch = async (req, res) => {
    try {
        const { rows } = req.body;
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'rows array is required' });
        }

        let importedAccounts = 0, importedSubs = 0, importedDeps = 0;
        let failed = 0;

        for (const row of rows) {
            try {
                if (!row.accountCode || !row.accountName) { failed++; continue; }

                let account = await knex('coa_accounts').where('code', row.accountCode).first();
                if (!account) {
                    [account] = await knex('coa_accounts').insert({ code: row.accountCode, name: row.accountName }).returning('*');
                    importedAccounts++;
                } else if (account.name !== row.accountName) {
                    await knex('coa_accounts').where('id', account.id).update({ name: row.accountName });
                }

                if (row.subCode) {
                    let sub = await knex('coa_sub_accounts').where({ account_id: account.id, code: row.subCode }).first();
                    if (!sub) {
                        [sub] = await knex('coa_sub_accounts').insert({
                            account_id: account.id, code: row.subCode, name: row.subName || row.subCode
                        }).returning('*');
                        importedSubs++;
                    } else if (sub.name !== row.subName && row.subName) {
                        await knex('coa_sub_accounts').where('id', sub.id).update({ name: row.subName });
                    }

                    if (row.depCode) {
                        let dep = await knex('coa_departments').where({ sub_account_id: sub.id, code: row.depCode }).first();
                        if (!dep) {
                            await knex('coa_departments').insert({
                                sub_account_id: sub.id, code: row.depCode, name: row.depName || row.depCode
                            });
                            importedDeps++;
                        } else if (dep.name !== row.depName && row.depName) {
                            await knex('coa_departments').where('id', dep.id).update({ name: row.depName });
                        }
                    }
                }
            } catch (rowErr) {
                console.error('[COA Batch] Row error:', rowErr.message);
                failed++;
            }
        }

        res.json({
            imported: importedAccounts + importedSubs + importedDeps,
            accounts: importedAccounts,
            subs: importedSubs,
            deps: importedDeps,
            failed,
            processed: rows.length
        });
    } catch (e) {
        handleError(res, e, 'COA Batch Import');
    }
};

// ============ STATS ============
export const getCoaStats = async (req, res) => {
    try {
        const accounts = await knex('coa_accounts').count('id as count').first();
        const subs = await knex('coa_sub_accounts').count('id as count').first();
        const deps = await knex('coa_departments').count('id as count').first();
        res.json({
            accounts: Number(accounts?.count || 0),
            sub_accounts: Number(subs?.count || 0),
            departments: Number(deps?.count || 0),
        });
    } catch (e) {
        handleError(res, e);
    }
};

// ============ DOWNLOAD TEMPLATE ============
export const downloadCoaTemplate = async (req, res) => {
    try {
        const ws = XLSX.utils.aoa_to_sheet([
            ['No COA', 'Keterangan', 'Sub COA', 'Keterangan Sub', 'No Dep', 'Keterangan Dep'],
            ['1', 'Aktiva', '1-1', 'Kas', '1-1-01', 'Kas Kecil'],
            ['1', 'Aktiva', '1-2', 'Bank', '1-2-01', 'Bank BCA'],
            ['2', 'Pasiva', '2-1', 'Utang Usaha', '2-1-01', 'Utang Supplier'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template COA');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="template_coa.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (e) {
        handleError(res, e, 'COA Template');
    }
};

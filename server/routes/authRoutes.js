import express from 'express';
import XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import fs from 'fs';
import {
    login,
    logout,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getProfile,
    updateProfile
} from '../controllers/authController.js';
import { checkAuth } from '../middleware/auth.js';
import { knex } from '../db.js';
import { systemLog } from '../utils/logger.js';
import { handleError } from '../utils/errorHandler.js';
import { upload } from '../config/upload.js';

const router = express.Router();

// Auth
router.post('/login', login);
router.post('/logout', logout);

// User Management (Admin)
router.get('/users', checkAuth, getUsers);
router.post('/users', checkAuth, createUser);
router.put('/users/:id', checkAuth, updateUser);
router.delete('/users/:id', checkAuth, deleteUser);

// User Profile (Self)
router.get('/users/profile/:id', checkAuth, getProfile);
router.put('/users/profile/:id', checkAuth, updateProfile);

// ── Excel: Download User Template ──
router.get('/users/template', checkAuth, async (req, res) => {
    try {
        const roles = (await knex('roles').select('id')).map(r => r.id);
        const depts = (await knex('departments').select('name')).map(d => d.name);

        const wb = XLSX.utils.book_new();

        // Main data sheet (empty with headers + example row)
        const headers = [
            ['username', 'password', 'name', 'role', 'department'],
            ['contoh_user', 'password123', 'Contoh Nama', roles[0] || 'staff', depts[0] || 'IT'],
        ];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        ws['!cols'] = [
            { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Users');

        // Reference sheet: valid roles
        const roleRows = [['role valid (salin dari sini)'], ...roles.map(r => [r])];
        const wsRoles = XLSX.utils.aoa_to_sheet(roleRows);
        wsRoles['!cols'] = [{ wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsRoles, 'Roles');

        // Reference sheet: valid departments
        const deptRows = [['department valid (salin dari sini)'], ...depts.map(d => [d])];
        const wsDepts = XLSX.utils.aoa_to_sheet(deptRows);
        wsDepts['!cols'] = [{ wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsDepts, 'Departments');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="template_import_users.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (e) {
        handleError(res, e, 'User Template');
    }
});

// ── Excel: Bulk Import Users ──
router.post('/users/import', checkAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File Excel tidak ditemukan.' });
        }

        const fileBuffer = fs.readFileSync(req.file.path);
        const wb = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
            return res.status(400).json({ error: 'File Excel kosong atau format tidak valid.' });
        }

        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        if (!rows.length) {
            return res.status(400).json({ error: 'Sheet tidak memiliki data (minimal header + 1 baris).' });
        }

        // Load valid roles & departments for validation
        const validRoles = (await knex('roles').select('id')).map(r => r.id);
        const validDepts = (await knex('departments').select('name')).map(d => d.name);
        const existingUsers = new Set((await knex('users').select('username')).map(u => u.username));

        const results = { created: 0, skipped: 0, errors: [] };

        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2; // +2 because row 1 = header
            const row = rows[i];
            const username = String(row.username || '').trim();
            const password = String(row.password || '').trim();
            const name = String(row.name || '').trim();
            const role = String(row.role || '').trim();
            const department = String(row.department || '').trim();

            // Skip completely empty rows
            if (!username && !password && !name) continue;

            // Validate required fields
            if (!username) {
                results.errors.push({ row: rowNum, error: 'Username wajib diisi' });
                results.skipped++;
                continue;
            }
            if (!password) {
                results.errors.push({ row: rowNum, error: 'Password wajib diisi' });
                results.skipped++;
                continue;
            }
            if (!name) {
                results.errors.push({ row: rowNum, error: 'Nama wajib diisi' });
                results.skipped++;
                continue;
            }

            // Validate role
            const finalRole = role || 'staff';
            if (!validRoles.includes(finalRole)) {
                results.errors.push({ row: rowNum, error: `Role "${role}" tidak valid. Gunakan: ${validRoles.join(', ')}` });
                results.skipped++;
                continue;
            }

            // Validate department (allow empty = no department)
            const finalDept = department || null;
            if (department && !validDepts.includes(department)) {
                results.errors.push({ row: rowNum, error: `Department "${department}" tidak valid. Gunakan: ${validDepts.join(', ')}` });
                results.skipped++;
                continue;
            }

            // Check duplicate username
            if (existingUsers.has(username)) {
                results.errors.push({ row: rowNum, error: `Username "${username}" sudah ada` });
                results.skipped++;
                continue;
            }

            // Create user
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                await knex('users').insert({
                    username,
                    password: hashedPassword,
                    name,
                    role: finalRole,
                    department: finalDept,
                });
                existingUsers.add(username);
                results.created++;
            } catch (e) {
                results.errors.push({ row: rowNum, error: `Gagal menyimpan: ${e.message}` });
                results.skipped++;
            }
        }

        // Cleanup uploaded file
        try { fs.unlinkSync(req.file.path); } catch {}

        await systemLog(req.user?.username || 'Admin', 'Import Users', `Imported ${results.created} users, ${results.skipped} skipped`);
        req.app.get('io')?.emit('data:changed', { channel: 'users' });

        res.json({
            success: results.errors.length === 0,
            created: results.created,
            skipped: results.skipped,
            totalRows: rows.length,
            errors: results.errors.slice(0, 20), // limit errors returned
        });
    } catch (e) {
        handleError(res, e, 'User Import');
    }
});

export default router;

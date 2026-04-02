import { knex } from '../db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { systemLog } from '../utils/logger.js';
import { handleError } from '../utils/errorHandler.js';
import {
    loginSchema,
    userCreateSchema,
    userUpdateSchema,
    profileUpdateSchema,
    validateRequestBody
} from '../utils/requestValidation.js';

export const login = async (req, res) => {
    try {
        const { username, password } = validateRequestBody(loginSchema, req, res) || {};
        if (!username || !password) return;
        const user = await knex('users').where('username', username).first();

        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        let match = false;
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            match = await bcrypt.compare(password, user.password);
        } else {
            match = (user.password === password);
            if (match) {
                try {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await knex('users').where('id', user.id).update({ password: hashedPassword });
                    console.log(`[Auth] Auto-migrated password for user: ${user.username}`);
                } catch (hashErr) {
                    console.error("[Auth] Auto-hash migration error:", hashErr);
                }
            }
        }

        if (match) {
            // Generate cryptographically secure session token with explicit expiry
            const sessionTtlMs = Number(process.env.SESSION_TTL_MS || (7 * 24 * 60 * 60 * 1000));
            const token = crypto.randomBytes(32).toString('hex');
            const tokenExpiresAt = new Date(Date.now() + sessionTtlMs);

            await knex('users').where('id', user.id).update({
                token,
                token_expires_at: tokenExpiresAt
            });

            // Set HttpOnly Cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax', // Use 'lax' for dev stability on network IPs
                maxAge: sessionTtlMs
            });

            const { password: _, ...userWithoutPass } = user;
            // userWithoutPass.token = token; // Token is now exclusively managed via HttpOnly cookie

            await systemLog(user.username, "Login", "User logged in with HttpOnly cookie");
            res.json(userWithoutPass);
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        handleError(res, err, "Login Error");
    }
};

export const logout = async (req, res) => {
    try {
        const username = req.user?.username || 'Unknown';

        if (req.user?.id) {
            await knex('users').where('id', req.user.id).update({
                token: null,
                token_expires_at: null
            });
        }

        res.clearCookie('token');
        await systemLog(username, "Logout", "User logged out (cookie cleared)");
        res.json({ message: "Logout successful" });
    } catch (err) {
        handleError(res, err, "Logout Error");
    }
};

export const getUsers = async (req, res) => {
    try {
        const rows = await knex('users').select('id', 'username', 'name', 'role', 'department');
        res.json(rows);
    } catch (err) {
        handleError(res, err, "Get Users Error");
    }
};

export const createUser = async (req, res) => {
    try {
        const data = validateRequestBody(userCreateSchema, req, res);
        if (!data) return;

        const { username, password, name, role, department } = data;
        const hashedPassword = await bcrypt.hash(password, 10);
        const [dbRes] = await knex('users').insert({
            username,
            password: hashedPassword,
            name,
            role,
            department
        }).returning('id');

        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        await systemLog('Admin', "Create User", `Created user: ${username}`);
        req.app.get('io')?.emit('data:changed', { channel: 'users' });
        res.json({ id });
    } catch (e) {
        handleError(res, e, "Create User Error");
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(userUpdateSchema, req, res);
        if (!data) return;

        const { username, password, name, role, department } = data;
        const updateData = {};

        if (username !== undefined) updateData.username = username;
        if (name !== undefined) updateData.name = name;
        if (role !== undefined) updateData.role = role;
        if (department !== undefined) updateData.department = department;

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await knex('users').where('id', id).update(updateData);
        await systemLog('Admin', "Update User", `Updated user ID: ${id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'users' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "Update User Error");
    }
};

export const deleteUser = async (req, res) => {
    try {
        await knex('users').where('id', req.params.id).del();
        await systemLog('Admin', "Delete User", `Deleted user ID: ${req.params.id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'users' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "Delete User Error");
    }
};

export const getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await knex('users').where('id', id).first();
        if (!user) return res.status(404).json({ error: "User not found" });

        const { password, ...userWithoutPass } = user;
        res.json(userWithoutPass);
    } catch (err) {
        handleError(res, err, "Get Profile Error");
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(profileUpdateSchema, req, res);
        if (!data) return;

        const { name, password, currentPassword } = data;

        const user = await knex('users').where('id', id).first();
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify current password if changing password
        if (password) {
            if (!currentPassword) return res.status(400).json({ error: "Current password required" });
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) return res.status(401).json({ error: "Incorrect current password" });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await knex('users').where('id', id).update(updateData);
        await systemLog(user.username, "Profile Update", "User updated their profile");
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "Update Profile Error");
    }
};

import { knex } from '../db.js';

export const checkAuth = async (req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowQueryToken = process.env.ALLOW_QUERY_TOKEN === 'true' && !isProduction;
    const allowDevToken = process.env.ALLOW_DEV_TOKEN === 'true' && !isProduction;

    // 1. Ekstrak token dari Cookie (HttpOnly), header Authorization, atau Query Parameter (dev-only)
    const token = req.cookies?.token ||
        (req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : (allowQueryToken ? req.query.token : undefined));

    if (!token) {
        const hasCookies = req.cookies ? Object.keys(req.cookies).length : 0;
        console.warn(`[Auth] Blocked: No token. IP: ${req.ip} URL: ${req.originalUrl}. Cookies count: ${hasCookies}`);
        if (hasCookies > 0) console.log(`[Auth] Cookies present: ${Object.keys(req.cookies).join(', ')}`);
        return res.status(401).json({ error: "Authentication required" });
    }

    try {
        let user;
        if (token === 'dev-token' && allowDevToken) {
            // Bypass khusus untuk mode development / admin fallback
            user = await knex('users').where('username', 'admin').first();
        } else {
            user = await knex('users').where('token', token).first();

            // Enforce session expiry if expiry field is present
            if (user?.token_expires_at) {
                const expiresAt = new Date(user.token_expires_at).getTime();
                if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
                    await knex('users').where('id', user.id).update({
                        token: null,
                        token_expires_at: null
                    });
                    return res.status(401).json({ error: "Session expired" });
                }
            }
        }

        if (!user) return res.status(401).json({ error: "Invalid user session" });
        req.user = user; // Attach user to request
        next();
    } catch (err) {
        res.status(500).json({ error: "Internal Auth Error" });
    }
};

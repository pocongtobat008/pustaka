import { connection, USE_BULLMQ } from './queue.js';
import { logger } from './logger.js';

/**
 * Cache utility for Pustaka
 * Uses the global Redis connection defined in queue.js
 */
export const cache = {
    /**
     * Get data from cache
     * @param {string} key 
     * @returns {Promise<any|null>}
     */
    get: async (key) => {
        if (!USE_BULLMQ) return null;
        try {
            const data = await connection.get(`pustaka:cache:${key}`);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            logger.error(`[Cache] Get error for ${key}: ${err.message}`);
            return null;
        }
    },

    /**
     * Set data to cache with TTL
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlInSeconds - Default 6 hours (21600s)
     */
    set: async (key, value, ttlInSeconds = 21600) => {
        if (!USE_BULLMQ) return;
        try {
            const data = JSON.stringify(value);
            if (connection && typeof connection.set === 'function') {
                await connection.set(`pustaka:cache:${key}`, data, 'EX', ttlInSeconds);
            } else {
                logger.warn(`[Cache] Redis connection not ready - set skipped for ${key}`);
            }
        } catch (err) {
            logger.error(`[Cache] Set error for ${key}: ${err.message}`);
        }
    },

    /**
     * Delete specific key from cache
     * @param {string} key 
     */
    del: async (key) => {
        if (!USE_BULLMQ) return;
        try {
            await connection.del(`pustaka:cache:${key}`);
            logger.info(`[Cache] Key deleted: ${key}`);
        } catch (err) {
            logger.error(`[Cache] Del error for ${key}: ${err.message}`);
        }
    },

    /**
     * Delete all keys matching a pattern
     * @param {string} pattern - e.g., 'inventory:*'
     */
    delByPattern: async (pattern) => {
        if (!USE_BULLMQ) return;
        try {
            if (!connection || typeof connection.keys !== 'function') {
                logger.warn(`[Cache] Redis connection does not support keys(); delByPattern skipped for ${pattern}`);
                return;
            }
            const keys = await connection.keys(`pustaka:cache:${pattern}`) || [];
            if (keys.length > 0) {
                if (typeof connection.del === 'function') {
                    await connection.del(...keys);
                    logger.info(`[Cache] Pattern cleared: ${pattern} (${keys.length} keys)`);
                } else {
                    logger.warn(`[Cache] Redis connection has no del(); keys found but cannot delete for ${pattern}`);
                }
            }
        } catch (err) {
            logger.error(`[Cache] DelPattern error for ${pattern}: ${err.message}`);
        }
    }
};

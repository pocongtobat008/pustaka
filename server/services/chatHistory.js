import { knex } from '../db.js';

const MAX_TITLE_LENGTH = 100;

/**
 * Create a new chat session.
 */
export async function createSession(userId, title = null) {
    const [row] = await knex('ai_chat_sessions')
        .insert({ user_id: userId, title: title || 'Percakapan baru' })
        .returning('*');
    return row;
}

/**
 * Get all sessions for a user, ordered by most recent.
 */
export async function getSessions(userId, { limit = 50, offset = 0 } = {}) {
    return knex('ai_chat_sessions')
        .where('user_id', userId)
        .orderBy('updated_at', 'desc')
        .limit(limit)
        .offset(offset);
}

/**
 * Get a single session by ID (with message count).
 */
export async function getSession(sessionId, userId) {
    const session = await knex('ai_chat_sessions')
        .where({ id: sessionId, user_id: userId })
        .first();
    if (!session) return null;

    const countResult = await knex('ai_chat_messages')
        .where('session_id', sessionId)
        .count('id as count')
        .first();

    return { ...session, messageCount: Number(countResult?.count || 0) };
}

/**
 * Get all messages for a session.
 */
export async function getMessages(sessionId, userId) {
    // Verify session belongs to user
    const session = await knex('ai_chat_sessions')
        .where({ id: sessionId, user_id: userId })
        .first();
    if (!session) return null;

    return knex('ai_chat_messages')
        .where('session_id', sessionId)
        .orderBy('created_at', 'asc');
}

/**
 * Save a message to a session.
 */
export async function saveMessage(sessionId, { role, content, toolCalls = null, fromCache = false, cacheAge = null }) {
    const [row] = await knex('ai_chat_messages')
        .insert({
            session_id: sessionId,
            role,
            content,
            tool_calls: toolCalls ? JSON.stringify(toolCalls) : null,
            from_cache: fromCache,
            cache_age: cacheAge || null,
        })
        .returning('*');

    // Touch session's updated_at
    await knex('ai_chat_sessions')
        .where('id', sessionId)
        .update({ updated_at: new Date() });

    return row;
}

/**
 * Auto-generate a title from the first user message.
 */
export async function generateTitle(sessionId, message) {
    const title = message.slice(0, MAX_TITLE_LENGTH);
    await knex('ai_chat_sessions')
        .where('id', sessionId)
        .update({ title });
    return title;
}

/**
 * Delete a session and its messages.
 */
export async function deleteSession(sessionId, userId) {
    const deleted = await knex('ai_chat_sessions')
        .where({ id: sessionId, user_id: userId })
        .del();
    return deleted > 0;
}

/**
 * Get the last N messages for a session (for sending to LLM as context).
 */
export async function getRecentMessages(sessionId, limit = 10) {
    return knex('ai_chat_messages')
        .where('session_id', sessionId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .then(rows => rows.reverse());
}

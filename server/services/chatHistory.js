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
 * Get all sessions for a user, ordered by most recent, with message counts.
 */
export async function getSessions(userId, { limit = 50, offset = 0 } = {}) {
    const sessions = await knex('ai_chat_sessions')
        .where('user_id', userId)
        .orderBy('updated_at', 'desc')
        .limit(limit)
        .offset(offset);

    // Attach message count per session (single aggregate query)
    if (sessions.length > 0) {
        const ids = sessions.map(s => s.id);
        const counts = await knex('ai_chat_messages')
            .select('session_id')
            .count('id as c')
            .whereIn('session_id', ids)
            .groupBy('session_id');
        const map = {};
        for (const row of counts) map[row.session_id] = Number(row.c);
        for (const s of sessions) s.messageCount = map[s.id] || 0;
    }

    return sessions;
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
 * Save a user message into a session + auto-generate title if it's the first exchange.
 * Verifies session ownership. Returns the row, or null when session not found/owned.
 */
export async function saveUserMessage(sessionId, userId, content) {
    if (!sessionId || !userId) return null;
    const session = await knex('ai_chat_sessions').where({ id: sessionId, user_id: userId }).first();
    if (!session) return null;
    const row = await saveMessage(sessionId, { role: 'user', content });
    const count = await knex('ai_chat_messages').where('session_id', sessionId).count('id as c').first();
    if (Number(count?.c || 0) <= 2) {
        await generateTitle(sessionId, content).catch(() => {});
    }
    return row;
}

/**
 * Save an assistant message (full or partial) + auto-summarize for RAG after 4+ messages.
 * Verifies session ownership. Returns the row, or null when session not found/owned.
 */
export async function saveAssistantMessage(sessionId, userId, { content, toolCalls = null, fromCache = false, cacheAge = null, partial = false, reasoning = null, thinkingSteps = null }) {
    if (!sessionId || !userId) return null;
    const session = await knex('ai_chat_sessions').where({ id: sessionId, user_id: userId }).first();
    if (!session) return null;
    const row = await saveMessage(sessionId, {
        role: 'assistant',
        content,
        toolCalls,
        fromCache,
        cacheAge,
        partial,
        reasoning,
        thinkingSteps,
    });
    if (!partial) {
        try {
            const { autoSummarizeSession } = await import('./conversationMemory.js');
            const count = await knex('ai_chat_messages').where('session_id', sessionId).count('id as c').first();
            if (Number(count?.c || 0) >= 4) {
                await autoSummarizeSession(sessionId, userId, null);
            }
        } catch (sumErr) {
            console.warn(`[ChatHistory] Auto-summarize failed: ${sumErr.message}`);
        }
    }
    return row;
}

/**
 * Save a message to a session.
 */
export async function saveMessage(sessionId, { role, content, toolCalls = null, fromCache = false, cacheAge = null, partial = false, reasoning = null, thinkingSteps = null }) {
    const [row] = await knex('ai_chat_messages')
        .insert({
            session_id: sessionId,
            role,
            content,
            tool_calls: toolCalls ? JSON.stringify(toolCalls) : null,
            from_cache: fromCache,
            cache_age: cacheAge || null,
            partial: !!partial,
            reasoning: reasoning || null,
            thinking_steps: thinkingSteps ? JSON.stringify(thinkingSteps) : null,
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

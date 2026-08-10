import { OneMBrainClient } from '@1mbrain/sdk';

const ONEMBRAIN_API_URL = process.env.ONEMBRAIN_API_URL || 'http://127.0.0.1:3100';
const ONEMBRAIN_API_KEY = process.env.ONEMBRAIN_API_KEY || 'sk-1mbrain-d0b91ac75c82837c09301e2f676af281';
const DEFAULT_AGENT_ID = process.env.ONEMBRAIN_AGENT_ID || 'ai-assistant';

let client = null;

function getClient() {
  if (!client) {
    client = new OneMBrainClient({
      apiUrl: ONEMBRAIN_API_URL,
      apiKey: ONEMBRAIN_API_KEY,
      agentId: DEFAULT_AGENT_ID,
    });
  }
  return client;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function rememberWithRetry(content, input) {
  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await getClient().remember(input);
    } catch (err) {
      const status = err?.details?.status || err?.status || err?.response?.status;
      attempts++;
      // Rate-limit (429): backoff lalu coba lagi — sinkronisasi training mengirim banyak chunk sekaligus
      if (status === 429 && attempts <= 6) {
        const wait = 800 * attempts; // 0.8s, 1.6s, 2.4s, ...
        console.warn(`[BrainService] 429 rate-limited (attempt ${attempts}/6), retry in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      console.warn(`[BrainService] remember failed: ${err.message}`, err.details ? JSON.stringify(err.details).slice(0, 300) : '');
      return null;
    }
  }
}

export async function remember(content, { type = 'episodic', importance = 0.6, tags = [], metadata = null, agentId } = {}) {
  const input = { content, type, importance, tags };
  if (metadata) input.metadata = metadata;
  if (agentId) input.agentId = agentId;
  return rememberWithRetry(content, input);
}

export async function recall(query, { limit = 8, type = null, maxHops = 2, agentId } = {}) {
  try {
    const opts = { query, limit, maxHops };
    if (type) opts.type = type;
    if (agentId) opts.agentId = agentId;
    const results = await getClient().recall(opts);
    return results || [];
  } catch (err) {
    console.warn(`[BrainService] recall failed: ${err.message}`);
    return [];
  }
}

export async function forget(memoryId, { agentId } = {}) {
  try {
    return await getClient().forget(memoryId, { agentId });
  } catch (err) {
    console.warn(`[BrainService] forget failed: ${err.message}`);
    return false;
  }
}

export async function associate(sourceId, targetId, { strength = 0.5, relationType = 'relates_to', agentId } = {}) {
  try {
    return await getClient().associate(sourceId, { targetId, strength, origin: 'explicit', relationType, agentId });
  } catch (err) {
    console.warn(`[BrainService] associate failed: ${err.message}`);
    return false;
  }
}

export async function rememberTurn(userMessage, assistantReply, { sessionId = null, topics = [], importance = 0.6, agentId } = {}) {
  try {
    const content = assistantReply
      ? `User: ${userMessage}\nAssistant: ${assistantReply}`
      : `User: ${userMessage}`;
    const tags = ['episodic', 'conversation-turn', ...topics];
    if (sessionId) tags.push(`session:${sessionId}`);
    return await remember(content, { type: 'episodic', importance, tags, agentId });
  } catch (err) {
    console.warn(`[BrainService] rememberTurn failed: ${err.message}`);
    return null;
  }
}

export async function buildContext(query, { limit = 6, agentId } = {}) {
  try {
    const results = await recall(query, { limit, agentId });
    if (!results || results.length === 0) return '';

    if (results.confidence === 'low') {
      return '';
    }

    return results.map(r => {
      const typeLabel = r.memory.type.charAt(0).toUpperCase() + r.memory.type.slice(1);
      return `[${typeLabel}] (relevance: ${r.score.toFixed(2)}) ${r.memory.content}`;
    }).join('\n');
  } catch (err) {
    console.warn(`[BrainService] buildContext failed: ${err.message}`);
    return '';
  }
}

export async function ingestMarkdown(title, markdown, { url = null, tags = [], confidenceThreshold = 0.4, agentId } = {}) {
  try {
    const result = await getClient().ingestMarkdown({
      title,
      url: url || `doc://training/${title.replace(/\s+/g, '-').toLowerCase()}`,
      markdown,
      agentId,
      confidenceThreshold,
      deduplicate: true,
    });
    return result;
  } catch (err) {
    console.warn(`[BrainService] ingestMarkdown failed: ${err.message}`);
    return { storedCount: 0, error: err.message };
  }
}

export async function ingestUrl(url, { agentId } = {}) {
  try {
    return await getClient().ingestUrl(url, { agentId });
  } catch (err) {
    console.warn(`[BrainService] ingestUrl failed: ${err.message}`);
    return { storedCount: 0, error: err.message };
  }
}

export async function consolidate({ dryRun = false, clusterStrategy = 'hybrid', agentId } = {}) {
  try {
    return await getClient().consolidate({ dryRun, clusterStrategy, agentId });
  } catch (err) {
    console.warn(`[BrainService] consolidate failed: ${err.message}`);
    return null;
  }
}

export async function getHealth() {
  try {
    const res = await fetch(`${ONEMBRAIN_API_URL}/health`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function getStats(agentId) {
  try {
    const res = await fetch(`${ONEMBRAIN_API_URL}/health`);
    if (!res.ok) return { status: 'error', error: 'Health check failed' };
    const health = await res.json();
    return {
      status: 'connected',
      memoryCount: health.memoryCount || 0,
      associationCount: health.associationCount || 0,
      uptime: health.uptime,
      embedding: health.embedding,
      database: health.database,
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export async function listMemories({ limit = 50, offset = 0, agentId } = {}) {
  try {
    const agent = agentId || DEFAULT_AGENT_ID;
    const res = await fetch(
      `${ONEMBRAIN_API_URL}/v1/memories?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'x-api-key': ONEMBRAIN_API_KEY,
          'x-agent-id': agent,
        },
      },
    );
    if (!res.ok) return { memories: [], associations: [], total: 0 };
    const json = await res.json();
    return json.data || { memories: [], associations: [], total: 0 };
  } catch (err) {
    console.warn(`[BrainService] listMemories failed: ${err.message}`);
    return { memories: [], associations: [], total: 0, error: err.message };
  }
}

export async function getNetworkData({ agentId } = {}) {
  try {
    const agent = agentId || DEFAULT_AGENT_ID;
    const res = await fetch(`${ONEMBRAIN_API_URL}/v1/memories/graph`, {
      headers: {
        'x-api-key': ONEMBRAIN_API_KEY,
        'x-agent-id': agent,
      },
    });
    if (!res.ok) return { nodes: [], edges: [], stats: { nodes: 0, edges: 0 } };
    const json = await res.json();
    return json.data || { nodes: [], edges: [], stats: { nodes: 0, edges: 0 } };
  } catch (err) {
    console.warn(`[BrainService] getNetworkData failed: ${err.message}`);
    return { nodes: [], edges: [], stats: { nodes: 0, edges: 0 }, error: err.message };
  }
}

export default {
  remember,
  recall,
  forget,
  associate,
  rememberTurn,
  buildContext,
  ingestMarkdown,
  ingestUrl,
  consolidate,
  getHealth,
  getStats,
  listMemories,
  getNetworkData,
};

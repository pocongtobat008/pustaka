# AI Assistant — Arsitektur & Alur Proses

## Sistem Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PUSTAKA AI ASSISTANT                           │
│                  Arsitektur Tool-Calling Agent + Cache                  │
└─────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │────▶│  React   │────▶│  Express API │────▶│   Worker     │
│ (Chat UI)│◀────│  Frontend│◀────│  (Port 5005) │◀────│  (Polling)   │
└──────────┘     └──────────┘     └──────────────┘     └──────┬───────┘
                                                              │
                           ┌──────────────────────────────────┤
                           │                                  │
                    ┌──────▼──────┐                    ┌──────▼──────┐
                    │  PostgreSQL │                    │  External   │
                    │  (Database) │                    │  LLM API    │
                    │  + pgvector │                    │  (OpenAI)   │
                    └─────────────┘                    └─────────────┘
```

---

## Alur Lengkap: Prompt → Response

```
  USER: "akun 11110 itu apa?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: FRONTEND (AiChatAssistant.jsx)                          │
│                                                                     │
│  ┌──────────────────────┐                                           │
│  │  User mengetik pesan  │                                          │
│  │  di chat input        │                                          │
│  └──────────┬───────────┘                                           │
│             │                                                       │
│  ┌──────────▼───────────┐                                           │
│  │  POST /api/ai/agent  │  { message, history, sessionId }         │
│  │  + Auth token (JWT)  │                                          │
│  └──────────┬───────────┘                                           │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2: CONTROLLER (aiController.js)                             │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  addAiAgentJob(message, history,   │                             │
│  │                sessionId)          │                             │
│  │                                    │                             │
│  │  INSERT INTO job_queue             │                             │
│  │  (name: 'ai-agent', data: {...})   │                             │
│  │  RETURNING id                      │                             │
│  └──────────┬─────────────────────────┘                             │
│             │                                                       │
│  ┌──────────▼───────────┐                                           │
│  │  Response ke Client:  │                                          │
│  │  { jobId, status:     │                                          │
│  │    'processing' }    │                                          │
│  └──────────────────────┘                                           │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3: QUEUE (queue.js — MySQL-based DbQueue)                   │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  job_queue table                   │                             │
│  │  ┌─────┬──────────┬─────────┐     │                             │
│  │  │ id  │ name     │ status  │     │                             │
│  │  ├─────┼──────────┼─────────┤     │                             │
│  │  │ 42  │ai-agent  │ WAITING │     │                             │
│  │  └─────┴──────────┴─────────┘     │                             │
│  │                                    │                             │
│  │  Polling interval: 2 detik        │                             │
│  │  Parallel pollers: 3              │                             │
│  └──────────┬─────────────────────────┘                             │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 4: WORKER (worker.js) — Job Processor                       │
│                                                                     │
│  ┌────────────────────────────────────────┐                         │
│  │  Poller mengambil job WAITING → ACTIVE │                         │
│  │  if (jobName === 'ai-agent') {         │                         │
│  │      result = await runAgent(          │                         │
│  │          message, history,             │                         │
│  │          generateEmbedding             │                         │
│  │      );                                │                         │
│  │  }                                     │                         │
│  └──────────┬─────────────────────────────┘                         │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 5: AGENT CORE (aiAgent.js — runAgent())                     │
│                                                                     │
│  ╔═══════════════════════════════════════════════════════════════╗   │
│  ║                    ALUR runAgent()                           ║   │
│  ╠═══════════════════════════════════════════════════════════════╣   │
│  ║                                                               ║   │
│  ║  ┌─────────────────────┐                                      ║   │
│  ║  │ 1. Load AI Settings │ ← ai_settings table                 ║   │
│  ║  │    base_url, api_key│                                      ║   │
│  ║  │    model, enabled   │                                      ║   │
│  ║  └─────────┬───────────┘                                      ║   │
│  ║            │                                                  ║   │
│  ║  ┌─────────▼───────────┐                                      ║   │
│  ║  │ 2. Check Cache      │ ← agentCache.js                    ║   │
│  ║  │                     │                                      ║   │
│  ║  │  a. Exact hash match│ → SHA256(query) vs query_hash      ║   │
│  ║  │  b. Semantic match  │ → pgvector cosine distance         ║   │
│  ║  │     (pgvector)      │   threshold ≥ 0.82 similarity      ║   │
│  ║  └─────────┬───────────┘                                      ║   │
│  ║            │                                                  ║   │
│  ║    ┌───────┴───────┐                                          ║   │
│  ║    │ Cache HIT?    │                                          ║   │
│  ║    ├───────┬───────┤                                          ║   │
│  ║    │ YES   │ NO    │                                          ║   │
│  ║    │       │       │                                          ║   │
│  ║    │  Return cached│   ┌──────────────────────────────┐       ║   │
│  ║    │  + suggestions│   │ 3. Intent Pre-Classification │       ║   │
│  ║    └───────┘       │   │                              │       ║   │
│  ║                    │   │ INTENT_PATTERNS regex match   │       ║   │
│  ║                    │   │                              │       ║   │
│  ║                    │   │ tax_summary, tax_wp,         │       ║   │
│  ║                    │   │ invoice, document, coa,      │       ║   │
│  ║                    │   │ inventory, approval,         │       ║   │
│  ║                    │   │ search, report, ...          │       ║   │
│  ║                    │   └──────────┬───────────────────┘       ║   │
│  ║                    │              │                           ║   │
│  ║                    │   ┌──────────▼───────────────────┐       ║   │
│  ║                    │   │ 4. Build Messages Array      │       ║   │
│  ║                    │   │                              │       ║   │
│  ║                    │   │ [system_prompt,              │       ║   │
│  ║                    │   │  history[-5],                │       ║   │
│  ║                    │   │  user_message]               │       ║   │
│  ║                    │   └──────────┬───────────────────┘       ║   │
│  ║                    │              │                           ║   │
│  ║                    │              ▼                           ║   │
│  ║                    │   ╔════════════════════════════════╗     ║   │
│  ║                    │   ║  AGENT LOOP (max 4 iterasi)   ║     ║   │
│  ║                    │   ╠════════════════════════════════╣     ║   │
│  ║                    │   ║                                ║     ║   │
│  ║                    │   ║  ┌──────────────────────┐      ║     ║   │
│  ║                    │   ║  │ 5. Call LLM API      │      ║     ║   │
│  ║                    │   ║  │    POST /chat/        │      ║     ║   │
│  ║                    │   ║  │    completions        │      ║     ║   │
│  ║                    │   ║  │                       │      ║     ║   │
│  ║                    │   ║  │  tools: [25+ tools]  │      ║     ║   │
│  ║                    │   ║  │  temperature: 0.2    │      ║     ║   │
│  ║                    │   ║  │  max_tokens: 2000    │      ║     ║   │
│  ║                    │   ║  └──────────┬───────────┘      ║     ║   │
│  ║                    │   ║             │                  ║     ║   │
│  ║                    │   ║  ┌──────────▼───────────┐      ║     ║   │
│  ║                    │   ║  │ LLM Response:        │      ║     ║   │
│  ║                    │   ║  │                      │      ║     ║   │
│  ║                    │   ║  │  A. tool_calls?      │      ║     ║   │
│  ║                    │   ║  │  B. content?         │      ║     ║   │
│  ║                    │   ║  └─────┬──────────┬─────┘      ║     ║   │
│  ║                    │   ║        │          │            ║     ║   │
│  ║                    │   ║   ┌────▼──┐  ┌────▼────┐      ║     ║   │
│  ║                    │   ║   │TOOL   │  │CONTENT  │      ║     ║   │
│  ║                    │   ║   │CALLS  │  │(final)  │      ║     ║   │
│  ║                    │   ║   └───┬───┘  └────┬────┘      ║     ║   │
│  ║                    │   ║       │           │            ║     ║   │
│  ║                    │   ║       ▼           ▼            ║     ║   │
│  ║                    │   ║  ┌─────────┐  ┌────────┐      ║     ║   │
│  ║                    │   ║  │Execute  │  │Save to │      ║     ║   │
│  ║                    │   ║  │Tools    │  │Cache   │      ║     ║   │
│  ║                    │   ║  │(parallel│  │+ Gen   │      ║     ║   │
│  ║                    │   ║  │ or seq) │  │Suggest │      ║     ║   │
│  ║                    │   ║  └────┬────┘  └────┬───┘      ║     ║   │
│  ║                    │   ║       │            │           ║     ║   │
│  ║                    │   ║       ▼            ▼           ║     ║   │
│  ║                    │   ║  ┌─────────┐  ┌─────────┐     ║     ║   │
│  ║                    │   ║  │Add tool │  │ RETURN  │     ║     ║   │
│  ║                    │   ║  │results  │  │ reply + │     ║     ║   │
│  ║                    │   ║  │to msgs  │  │ toolCalls│    ║     ║   │
│  ║                    │   ║  │& loop   │  │ + suggestions│ ║     ║   │
│  ║                    │   ║  │back ↑   │  └─────────┘     ║     ║   │
│  ║                    │   ║  └─────────┘                   ║     ║   │
│  ║                    │   ║                                ║     ║   │
│  ║                    │   ╚════════════════════════════════╝     ║   │
│  ╚═══════════════════════════════════════════════════════════════╝   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detail: Alur Cache System

```
┌─────────────────────────────────────────────────────────────────┐
│                    CACHE LAYER (agentCache.js)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Query: "akun 11110 itu apa?"                                  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────┐                                       │
│  │ 1. Normalize Query   │  lowercase, strip punct, collapse ws │
│  └──────────┬───────────┘                                       │
│             │                                                   │
│  ┌──────────▼───────────┐                                       │
│  │ 2. Hash (SHA256)     │  → d3f8a1b2c3d4...                   │
│  └──────────┬───────────┘                                       │
│             │                                                   │
│  ┌──────────▼───────────────────────┐                           │
│  │ 3. Exact Match (B-tree index)   │                           │
│  │    SELECT * FROM ai_agent_cache  │                           │
│  │    WHERE query_hash = ?          │                           │
│  │    AND expires_at > NOW()        │                           │
│  └──────────┬───────────────────────┘                           │
│             │                                                   │
│    ┌────────┴────────┐                                          │
│    │ FOUND           │ NOT FOUND                                │
│    │                 │                                          │
│    │ ┌─────────────┐ │  ┌───────────────────────────────┐      │
│    │ │ HIT (exact) │ │  │ 4. Semantic Search (pgvector) │      │
│    │ │ hit_count++ │ │  │    IVFFlat index, cosine dist │      │
│    │ │ Return reply│ │  │    threshold ≥ 0.82 similarity│      │
│    │ └─────────────┘ │  └──────────┬────────────────────┘      │
│    │                 │             │                            │
│    │                 │    ┌────────┴────────┐                   │
│    │                 │    │ FOUND           │ NOT FOUND          │
│    │                 │    │                 │                    │
│    │                 │    │ ┌─────────────┐ │  ┌────────────┐  │
│    │                 │    │ │HIT (similar)│ │  │ MISS       │  │
│    │                 │    │ │similarity % │ │  │ → LLM call │  │
│    │                 │    │ │Return reply │ │  └────────────┘  │
│    │                 │    │ └─────────────┘ │                   │
│    │                 │    └─────────────────┘                   │
│    └─────────────────┘                                          │
│                                                                 │
│  Cache Config:                                                  │
│  • TTL: 6 jam (default)                                        │
│  • Max entries: 5000 (auto-prune oldest)                       │
│  • Cosine threshold: 0.82 similarity                           │
│  • IVFFlat probes: 10                                           │
│  • Error/failure responses: TIDAK di-cache                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detail: Intent Pre-Classification

```
  User Message
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  classifyIntent(message)                                 │
│                                                          │
│  Regex pattern matching pada INTENT_PATTERNS:            │
│                                                          │
│  Pattern                 → Intent                       │
│  ─────────────────────────────────────────────────────   │
│  /laporan\s+pajak|ppn|pph/i      → tax_summary         │
│  /data\s+wp|npwp/i               → tax_wp              │
│  /audit|pemeriksaan/i            → tax_audit            │
│  /invoice|faktur|pembayaran/i    → invoice              │
│  /dokumen|arsip|upload/i         → document             │
│  /persetujuan|approval/i         → approval             │
│  /user|pengguna|staff/i          → user                 │
│  /coa|chart.of.accounts|         → coa                  │
│   akun.perkiraan|buku.besar/i                           │
│  /inventory|box|rak/i             → inventory            │
│  /objek.pajak|tarif|rate/i       → tax_object           │
│  /laporan|ringkasan|total/i      → report               │
│  /cari|find|search|tampilkan/i   → search               │
│                                                          │
│  Tidak match apapun               → general             │
│                                                          │
│  Digunakan untuk:                                        │
│  • Generate suggestions yang relevan                     │
│  • Logging                                               │
│  • Fallback behavior                                     │
└──────────────────────────────────────────────────────────┘
```

---

## Detail: Tool Execution Loop (Agent Iteration)

```
  Iterasi ke-0
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Call LLM dengan messages + tools                           │
│                                                              │
│  LLM Response:                                               │
│  {                                                          │
│    "tool_calls": [                                          │
│      {                                                      │
│        "id": "call_abc123",                                 │
│        "function": {                                         │
│          "name": "search_coa_accounts",                     │
│          "arguments": "{\"query\":\"11110\"}"               │
│        }                                                    │
│      }                                                      │
│    ]                                                        │
│  }                                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Parse arguments JSON                                       │
│  Execute: search_coa_accounts({ query: "11110" })          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Tool: search_coa_accounts                           │    │
│  │                                                      │    │
│  │  1. Split query → terms: ["11110"]                  │    │
│  │  2. Search coa_accounts WHERE code ILIKE '%11110%'  │    │
│  │  3. Search coa_sub_accounts WHERE ...               │    │
│  │  4. Search coa_departments WHERE ...                │    │
│  │  5. Build parent relationships (tree)               │    │
│  │  6. If few accounts, fetch missing parents          │    │
│  │                                                      │    │
│  │  Return: { accounts: 3, matched_subs: 2, rows: ...} │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Add tool result to messages:                               │
│  { role: "tool", tool_call_id: "call_abc123",              │
│    content: "{ accounts: 3, rows: ... }" }                  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Loop → Call LLM again (iterasi ke-1)                      │
│                                                              │
│  Sekarang messages berisi:                                  │
│  [system, user("akun 11110 itu apa?"),                       │
│   assistant(tool_calls), tool(result)]                       │
│                                                              │
│  LLM Response:                                               │
│  {                                                          │
│    "content": "Akun 11110 adalah **Petty Cash**...",        │
│    "tool_calls": null                                        │
│  }                                                          │
│                                                              │
│  → DONE! content tersedia, loop berhenti                    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Save to Cache (async, fire-and-forget)                     │
│  Generate Suggestions (berdasarkan toolCallsLog)            │
│  Return { reply, toolCalls, suggestions }                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Detail: Parallel vs Sequential Tool Execution

```
  LLM Response: { tool_calls: [tool_A, tool_B, tool_C] }
       │
       ▼
  PARALLEL_EXECUTION = true (default)
       │
       ├─ Jika tool_calls.length > 1:
       │      │
       │      ▼
       │  ┌──────────────────────────────────────────────┐
       │  │  Promise.all([                               │
       │  │    executeTool("tool_A", args),              │
       │  │    executeTool("tool_B", args),              │
       │  │    executeTool("tool_C", args)               │
       │  │  ])                                          │
       │  │                                              │
       │  │  → 3 tool dieksekusi BERSAMAAN              │
       │  │  → Results di-add ke messages sekaligus      │
       │  └──────────────────────────────────────────────┘
       │
       └─ Jika tool_calls.length == 1 atau PARALLEL = false:
               │
               ▼
           ┌──────────────────────────────────────────────┐
           │  for (tc of tool_calls) {                    │
           │    result = await executeTool(tc);           │
           │    messages.push(result);                    │
           │  }                                           │
           │                                              │
           │  → Tool dieksekusi SATU PER SATU            │
           └──────────────────────────────────────────────┘
```

---

## 25+ Tools yang Tersedia

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOOL CATEGORY          │  TOOLS                                   │
├─────────────────────────┼──────────────────────────────────────────┤
│  Documents              │  search_documents                        │
│                         │  list_documents                          │
│                         │  get_document_detail                     │
│                         │  get_document_stats                      │
├─────────────────────────┼──────────────────────────────────────────┤
│  Invoices               │  search_invoices                         │
│                         │  list_invoices                           │
│                         │  get_invoice_detail                      │
├─────────────────────────┼──────────────────────────────────────────┤
│  Tax (Pajak)            │  search_tax_wp, list_tax_wp              │
│                         │  search_tax_objects                      │
│                         │  get_tax_summaries                       │
│                         │  get_tax_summary_aggregate                │
│                         │  get_tax_audits                          │
├─────────────────────────┼──────────────────────────────────────────┤
│  Inventory & Archive    │  search_inventory                        │
│                         │  search_inventory_items                  │
│                         │  search_external_items                   │
│                         │  search_boxes                            │
├─────────────────────────┼──────────────────────────────────────────┤
│  Users & Departments    │  get_users                               │
│                         │  list_departments                        │
├─────────────────────────┼──────────────────────────────────────────┤
│  Approvals              │  get_approvals                           │
│                         │  search_approvals                        │
├─────────────────────────┼──────────────────────────────────────────┤
│  Comments               │  search_comments                         │
├─────────────────────────┼──────────────────────────────────────────┤
│  COA (Chart of Accounts)│  search_coa_accounts                     │
│                         │  list_coa_accounts                       │
│                         │  get_coa_hierarchy                       │
│                         │  get_coa_stats                           │
└─────────────────────────┴──────────────────────────────────────────┘
```

---

## Contoh: Alur Pencarian COA Multi-Term (OR Logic)

```
  Query: "11110 1400"
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  search_coa_accounts({ query: "11110 1400" })              │
│                                                             │
│  1. Split: terms = ["11110", "1400"]                       │
│                                                             │
│  2. Search coa_accounts:                                    │
│     WHERE (code ILIKE '%11110%'                             │
│         OR name ILIKE '%11110%'                             │
│         OR description ILIKE '%11110%')                     │
│     OR (code ILIKE '%1400%'                                 │
│         OR name ILIKE '%1400%'                              │
│         OR description ILIKE '%1400%')                      │
│                                                             │
│     → Match: "11110 - Petty Cash"                          │
│                                                             │
│  3. Search coa_sub_accounts:                                │
│     (same OR logic)                                         │
│     → Match: "51400 - Traveling expense"                   │
│     → Match: "61400 - Bank charge"                         │
│                                                             │
│  4. Search coa_departments:                                 │
│     (same OR logic)                                         │
│     → (no direct match)                                     │
│                                                             │
│  5. Fetch parent accounts for matched subs:                │
│     coa_accounts WHERE id IN (account_id of 51400, 61400)  │
│                                                             │
│  6. Build tree:                                             │
│     ┌──────────────────────────────────────────────┐        │
│     │ 11110 - Petty Cash                           │        │
│     │   └── (no sub accounts matched)              │        │
│     │                                              │        │
│     │ 51400 - Traveling expense                    │        │
│     │   └── (parent: Akun Induk 5xxx)             │        │
│     │                                              │        │
│     │ 61400 - Bank charge                          │        │
│     │   └── (parent: Akun Induk 6xxx)             │        │
│     └──────────────────────────────────────────────┘        │
│                                                             │
│  Return: { accounts: 3, matched_subs: 2, matched_deps: 0 }│
└─────────────────────────────────────────────────────────────┘
```

---

## Chat History & Session Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CHAT HISTORY FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Frontend                           Backend                        │
│  ─────────                          ────────                       │
│  User buka AI Chat                  GET /api/ai/sessions          │
│       │                                  │                          │
│       │  ┌───────────────────────────────┘                          │
│       │  │  SELECT * FROM ai_chat_sessions                         │
│       │  │  WHERE user_id = ?                                      │
│       │  │  ORDER BY updated_at DESC                               │
│       │  │  → Return list sesi                                     │
│       │  │                                                         │
│  User pilih / buat sesi               POST /api/ai/sessions       │
│       │                                   → INSERT, return session │
│       │                                                         │
│  User kirim pesan (dengan sessionId)                            │
│       │                                                         │
│       ▼                                                         │
│  POST /api/ai/agent                                          │
│  { message, history, sessionId }                               │
│       │                                                         │
│       ▼                                                         │
│  Worker: runAgent() → result                                   │
│       │                                                         │
│       ▼                                                         │
│  Worker saves to DB:                                           │
│  ┌───────────────────────────────────────────────┐              │
│  │ ai_chat_messages:                            │              │
│  │   role: 'user', content: message             │              │
│  │   role: 'assistant', content: reply,         │              │
│  │          tool_calls: [...],                  │              │
│  │          from_cache: true/false,             │              │
│  │          cache_age: '5 menit lalu'           │              │
│  │                                               │              │
│  │ Auto-generate title from first message       │              │
│  └───────────────────────────────────────────────┘              │
│                                                                 │
│  User buka sesi lama:                                          │
│  GET /api/ai/sessions/:id/messages                            │
│  → Return semua messages untuk sesi itu                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Laporan & Suggestions

```
┌─────────────────────────────────────────────────────────────────────┐
│                   SUGGESTION GENERATION                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Setelah agent loop selesai:                                       │
│                                                                     │
│  generateSuggestions(toolCallsLog, intent, message)                │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Analisis tool calls yang dieksekusi:                    │      │
│  │                                                          │      │
│  │  Tool Used              → Suggested Follow-up           │      │
│  │  ─────────────────────────────────────────────────      │      │
│  │  get_tax_summaries      → "Bandingkan dengan tahun lalu"│      │
│  │                         → "Detail PPN masukan vs keluaran"│     │
│  │  search_tax_wp          → "Detail objek pajak WP ini"   │      │
│  │  get_tax_audits         → "Status audit terkini"        │      │
│  │  search_invoices        → "Detail invoice ini"          │      │
│  │  search_documents       → "Cari dokumen serupa"         │      │
│  │  search_coa_accounts    → "Hierarki COA lengkap"        │      │
│  │  get_coa_stats          → "Tampilkan semua akun induk"  │      │
│  │  search_inventory       → "Lihat isi box ini"           │      │
│  │                                                          │      │
│  │  Intent-Based (fallback):                                │      │
│  │  intent = 'report'    → "Ekspor laporan ini"            │      │
│  │  intent = 'search'    → "Cari dengan kata kunci lain"   │      │
│  │  msg = "halo"         → "Tampilkan ringkasan data"      │      │
│  │                                                          │      │
│  │  → Deduplicate, limit 3 suggestions                     │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  Response ke frontend:                                             │
│  {                                                                 │
│    reply: "Akun 11110 adalah **Petty Cash**...",                  │
│    toolCalls: [ { name: "search_coa_accounts", ... } ],           │
│    suggestions: [                                                  │
│      "Tampilkan hierarki COA lengkap",                             │
│      "Cari akun lain",                                             │
│      "Statistik jumlah akun"                                       │
│    ]                                                               │
│  }                                                                 │
│                                                                     │
│  Frontend menampilkan suggestions sebagai chips/klik:             │
│  ┌──────────────────────────────────────────────────────┐          │
│  │  💡 Saran:                                          │          │
│  │  [Tampilkan hierarki COA] [Cari akun lain] [Stats]  │          │
│  └──────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Tables

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SCHEMA OVERVIEW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐      ┌─────────────────────┐             │
│  │ ai_settings         │      │ ai_agent_cache       │             │
│  ├─────────────────────┤      ├─────────────────────┤             │
│  │ id                  │      │ id                   │             │
│  │ base_url            │      │ query_hash (B-tree)  │             │
│  │ api_key             │      │ query_text           │             │
│  │ model               │      │ reply                │             │
│  │ enabled             │      │ tool_calls (JSON)    │             │
│  └─────────────────────┘      │ model                │             │
│                               │ hit_count            │             │
│  ┌─────────────────────┐      │ embedding (vector)   │             │
│  │ ai_chat_sessions    │      │ expires_at           │             │
│  ├─────────────────────┤      │ created_at           │             │
│  │ id                  │      └─────────────────────┘             │
│  │ user_id             │                                           │
│  │ title               │      ┌─────────────────────┐             │
│  │ created_at          │      │ job_queue            │             │
│  │ updated_at          │      ├─────────────────────┤             │
│  └─────────────────────┘      │ id                   │             │
│                               │ name (ai-agent)      │             │
│  ┌─────────────────────┐      │ data (JSON)          │             │
│  │ ai_chat_messages    │      │ status               │             │
│  ├─────────────────────┤      │ result (JSON)        │             │
│  │ id                  │      │ progress             │             │
│  │ session_id (FK)     │      │ retries              │             │
│  │ role                │      │ created_at           │             │
│  │ content             │      │ finished_at          │             │
│  │ tool_calls (JSON)   │      └─────────────────────┘             │
│  │ from_cache          │                                           │
│  │ cache_age           │      ┌─────────────────────┐             │
│  │ created_at          │      │ coa_accounts         │             │
│  └─────────────────────┘      ├─────────────────────┤             │
│                               │ id, code, name,      │             │
│  ┌─────────────────────┐      │ description,         │             │
│  │ documents           │      │ is_active            │             │
│  │ invoices            │      └──────────┬──────────┘             │
│  │ tax_summaries       │                 │                         │
│  │ tax_wp              │      ┌──────────▼──────────┐             │
│  │ tax_audits          │      │ coa_sub_accounts     │             │
│  │ inventory           │      ├─────────────────────┤             │
│  │ ...                 │      │ id, account_id (FK), │             │
│  └─────────────────────┘      │ code, name, ...      │             │
│                               └──────────┬──────────┘             │
│  Semua tabel ini di-query oleh           │                         │
│  tools di aiAgent.js            ┌────────▼───────────┐             │
│                                 │ coa_departments     │             │
│                                 ├────────────────────┤             │
│                                 │ id, sub_account_id  │             │
│                                 │ (FK), code, name... │             │
│                                 └────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Full Request-Response Cycle (JSON)

```
┌─────────────────────────────────────────────────────────────────────┐
│  REQUEST                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  POST /api/ai/agent                                                │
│  Headers: { Authorization: "Bearer eyJhbG..." }                    │
│  Body: {                                                           │
│    "message": "akun 11110 itu apa?",                               │
│    "history": [                                                    │
│      { "role": "user", "content": "halo" },                       │
│      { "role": "assistant", "content": "Halo! ..." }              │
│    ],                                                              │
│    "sessionId": 42                                                 │
│  }                                                                 │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  INTERMEDIATE STEPS (internal)                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Job queued: INSERT INTO job_queue (name='ai-agent')            │
│  2. Worker claims: UPDATE status='active'                          │
│  3. Cache check: SHA256("akun 11110 itu apa?") → MISS             │
│  4. Intent: classifyIntent() → 'coa'                               │
│  5. Messages: [system, history..., user]                           │
│  6. Iterasi 0:                                                     │
│     → LLM returns tool_calls: [search_coa_accounts]               │
│     → Execute: SELECT * FROM coa_accounts WHERE code ILIKE...     │
│     → Result added to messages                                     │
│  7. Iterasi 1:                                                     │
│     → LLM returns content: "Akun 11110 adalah **Petty Cash**..."  │
│     → saveToCache() (async)                                        │
│     → generateSuggestions()                                        │
│  8. Save chat history: user msg + assistant msg                    │
│                                                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RESPONSE                                                          │
├─────────────────────────────────────────────────────────────────────┤
│  {                                                                 │
│    "reply": "Akun 11110 adalah **Petty Cash** (Kas Kecil).\n\n    │
│      Ini adalah akun induk di bawah kelompok **Kas dan Bank**...", │
│    "toolCalls": [                                                  │
│      {                                                             │
│        "name": "search_coa_accounts",                             │
│        "args": { "query": "11110" },                              │
│        "result": {                                                 │
│          "accounts": 3,                                            │
│          "matched_subs": 2,                                        │
│          "rows": "1. code: 11110 | name: Petty Cash..."           │
│        }                                                           │
│      }                                                             │
│    ],                                                              │
│    "suggestions": [                                                │
│      "Tampilkan hierarki COA lengkap",                             │
│      "Cari akun lain",                                             │
│      "Statistik jumlah akun"                                       │
│    ],                                                              │
│    "fromCache": false                                              │
│  }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Konfigurasi & Optimasi

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONSTANT              │  VALUE    │  PURPOSE                      │
├────────────────────────┼───────────┼───────────────────────────────┤
│  MAX_ITERATIONS        │  4        │  Maks loop LLM calls         │
│  MAX_HISTORY           │  5        │  Last 5 messages sebagai      │
│                        │           │  konteks                      │
│  TOOL_RESULT_ROWS      │  15       │  Baris hasil per tool call    │
│  OCR_SNIPPET           │  500      │  Karakter OCR yang ditampilkan│
│  PARALLEL_EXECUTION    │  true     │  Eksekusi tool paralel        │
│  temperature           │  0.2      │  LLM konservatif (faktual)    │
│  max_tokens            │  2000     │  Maks panjang response        │
│  Cache TTL             │  6 jam    │  Waktu cache valid            │
│  Cache Max Entries     │  5000     │  Auto-prune tertua            │
│  Cosine Threshold      │  0.82     │  Minimum similarity cache     │
│  IVFFlat Probes        │  10       │  Akurasi vs speed vector      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Scheduled Cache Warming (Self-Improvement)

AI Assistant memiliki sistem **cache warming berkala** yang berjalan secara otomatis untuk menjaga cache tetap segar dan akurat, meskipun tidak ada user yang bertanya.

```
┌──────────────────────────────────────────────────────────────────────┐
│               SCHEDULED CACHE WARMER                                │
│              (Self-Improvement System)                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────┐                │
│  │  TRIGGER                                       │                │
│  │                                                  │                │
│  │  ┌──────────────┐  ┌──────────────────────────┐ │                │
│  │  │ BullMQ       │  │ Polling Fallback          │ │                │
│  │  │ Repeatable   │  │ (Redis unavailable)      │ │                │
│  │  │ Job:         │  │ setInterval per N jam     │ │                │
│  │  │ "0 */6 * * *"│  │                          │ │                │
│  │  └──────┬───────┘  └────────────┬─────────────┘ │                │
│  │         │                       │                │                │
│  │         └───────────┬───────────┘                │                │
│  └─────────────────────┼───────────────────────────┘                │
│                         │                                            │
│                         ▼                                            │
│  ┌─────────────────────────────────────────────────┐                │
│  │  WORKER: processJob('cache-warm')              │                │
│  │                                                  │                │
│  │  runCacheWarmer(generateEmbedding)               │                │
│  └─────────────────────┬───────────────────────────┘                │
│                         │                                            │
│                         ▼                                            │
│  ╔═══════════════════════════════════════════════════════════════╗   │
│  ║              6 LANGKAH CACHE WARMING                        ║   │
│  ╠═══════════════════════════════════════════════════════════════╣   │
│  ║                                                               ║   │
│  ║  ┌───────────────────────────────────────────────────────┐   ║   │
│  ║  │ 1. RE-EMBED CHANGED DOCUMENTS                        │   ║   │
│  ║  │    SELECT * FROM documents WHERE updated_at > lastRun │   ║   │
│  ║  │    → generate new vectors                             │   ║   │
│  ║  │    → update documents.vector column                   │   ║   │
│  ║  └───────────────────────────────────────────────────────┘   ║   │
│  ║                          │                                    ║   │
│  ║  ┌───────────────────────▼───────────────────────────────┐   ║   │
│  ║  │ 2. RE-EMBED CHANGED INVOICES                         │   ║   │
│  ║  │    SELECT * FROM invoices WHERE updated_at > lastRun  │   ║   │
│  ║  │    → generate new vectors                             │   ║   │
│  ║  │    → update invoices.vector column                    │   ║   │
│  ║  └───────────────────────────────────────────────────────┘   ║   │
│  ║                          │                                    ║   │
│  ║  ┌───────────────────────▼───────────────────────────────┐   ║   │
│  ║  │ 3. RE-EMBED COA RECORDS                              │   ║   │
│  ║  │    SELECT * FROM coa_accounts WHERE created_at > ...  │   ║   │
│  ║  │    → warm embedding pipeline                          │   ║   │
│  ║  └───────────────────────────────────────────────────────┘   ║   │
│  ║                          │                                    ║   │
│  ║  ┌───────────────────────▼───────────────────────────────┐   ║   │
│  ║  │ 4. RE-EMBED INVENTORY RECORDS                        │   ║   │
│  ║  │    SELECT * FROM inventory WHERE updated_at > lastRun │   ║   │
│  ║  │    → parse box_data, embed combined text              │   ║   │
│  ║  └───────────────────────────────────────────────────────┘   ║   │
│  ║                          │                                    ║   │
│  ║  ┌───────────────────────▼───────────────────────────────┐   ║   │
│  ║  │ 5. PRE-WARM COMMON QUERIES                           │   ║   │
│  ║  │                                                      │   ║   │
│  ║  │  Untuk setiap query di WARM_QUERIES:                 │   ║   │
│  ║  │    ├─ "ringkasan data"                               │   ║   │
│  ║  │    ├─ "statistik dokumen"                            │   ║   │
│  ║  │    ├─ "data pajak terbaru"                           │   ║   │
│  ║  │    ├─ "invoice terbaru"                              │   ║   │
│  ║  │    ├─ "akun COA terbaru"                             │   ║   │
│  ║  │    ├─ "approval pending"                             │   ║   │
│  ║  │    └─ "box inventory terbaru"                        │   ║   │
│  ║  │                                                      │   ║   │
│  ║  │    1. Check cache → sudah ada? skip                  │   ║   │
│  ║  │    2. Belum ada? → runAgent(query) → auto-save cache │   ║   │
│  ║  └───────────────────────────────────────────────────────┘   ║   │
│  ║                          │                                    ║   │
│  ║  ┌───────────────────────▼───────────────────────────────┐   ║   │
│  ║  │ 6. REFRESH STALE HIGH-TRAFFIC CACHE                  │   ║   │
│  ║  │                                                      │   ║   │
│  ║  │  SELECT * FROM ai_agent_cache                        │   ║   │
│  ║  │  WHERE hit_count >= 2 AND expires_at < NOW()         │   ║   │
│  ║  │  ORDER BY hit_count DESC LIMIT 20                    │   ║   │
│  ║  │                                                      │   ║   │
│  ║  │  → Re-run setiap query yang sering ditanyakan        │   ║   │
│  ║  │  → Simpan hasil baru ke cache                        │   ║   │
│  ║  └───────────────────────────────────────────────────────┘   ║   │
│  ║                          │                                    ║   │
│  ║                          ▼                                    ║   │
│  ║  ┌───────────────────────────────────────────────────────┐   ║   │
│  ║  │ 7. REBUILD INDEX (conditional)                       │   ║   │
│  ║  │    Jika ada > 10 record baru:                        │   ║   │
│  ║  │    → DROP INDEX idx_agent_cache_embedding            │   ║   │
│  ║  │    → CREATE INDEX ... USING ivfflat (vector)         │   ║   │
│  ║  └───────────────────────────────────────────────────────┘   ║   │
│  ║                                                               ║   │
│  ╚═══════════════════════════════════════════════════════════════╝   │
│                         │                                            │
│                         ▼                                            │
│  ┌─────────────────────────────────────────────────┐                │
│  │  LOG RESULTS → ai_cache_warm_logs              │                │
│  │                                                  │                │
│  │  ┌────────────────────────────────────────┐     │                │
│  │  │ Cache Warm Run #142                    │     │                │
│  │  │ Status: success                        │     │                │
│  │  │ Duration: 45s                          │     │                │
│  │  │ Docs re-embedded: 12                   │     │                │
│  │  │ Invoices re-embedded: 5                │     │                │
│  │  │ COA re-embedded: 3                     │     │                │
│  │  │ Pre-warmed queries: 7 (5 ok, 2 fail)  │     │                │
│  │  │ Stale cache refreshed: 23              │     │                │
│  │  │ Index rebuilt: YES                     │     │                │
│  │  │ Cache: 145 → 168 entries              │     │                │
│  │  └────────────────────────────────────────┘     │                │
│  └─────────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
```

### Admin API Endpoints

```
┌──────────────────────────────────────────────────────────────────────┐
│  ENDPOINT                        │  METHOD  │  DESCRIPTION          │
├──────────────────────────────────┼──────────┼───────────────────────┤
│  /api/ai/cache/warm/config       │  GET     │  View warm config     │
│  /api/ai/cache/warm/config       │  PUT     │  Update config        │
│  /api/ai/cache/warm              │  POST    │  Manual trigger       │
│  /api/ai/cache/warm/latest       │  GET     │  Latest warm log      │
│  /api/ai/cache/warm/logs         │  GET     │  Warm run history     │
│  /api/ai/cache/stats             │  GET     │  Cache statistics     │
└──────────────────────────────────┴──────────┴───────────────────────┘

Config example (PUT /api/ai/cache/warm/config):
{
  "enabled": true,
  "interval_hours": 6
}
```

### Database Schema: ai_cache_warm_logs

```
┌──────────────────────────────────────────────────────────────────────┐
│  TABLE: ai_cache_warm_logs                                          │
├─────────────────────────────┬───────────┬────────────────────────────┤
│  COLUMN                     │  TYPE     │  DESCRIPTION              │
├─────────────────────────────┼───────────┼────────────────────────────┤
│  id                         │  INTEGER  │  Primary key              │
│  status                     │  VARCHAR  │  running/success/failed   │
│  docs_embedded              │  INTEGER  │  Documents re-embedded    │
│  invoices_embedded          │  INTEGER  │  Invoices re-embedded     │
│  coa_embedded               │  INTEGER  │  COA records re-embedded  │
│  inventory_embedded         │  INTEGER  │  Inventory re-embedded    │
│  prewarmed_queries          │  INTEGER  │  Queries pre-warmed       │
│  prewarm_failed             │  INTEGER  │  Pre-warm failures        │
│  stale_refreshed            │  INTEGER  │  Stale cache refreshed    │
│  index_rebuilt              │  BOOLEAN  │  Index rebuilt?           │
│  cache_entries_before       │  INTEGER  │  Cache count before       │
│  cache_entries_after        │  INTEGER  │  Cache count after        │
│  duration_ms                │  INTEGER  │  Total duration (ms)      │
│  error                      │  TEXT     │  Error message if failed  │
│  started_at                 │  TIMESTAMP│  When run started         │
│  finished_at                │  TIMESTAMP│  When run finished        │
└─────────────────────────────┴───────────┴────────────────────────────┘
```

---

## 11. PROACTIVE INSIGHTS ENGINE

```
┌──────────────────────────────────────────────────────────────────┐
│                    INSIGHTS ENGINE FLOW                           │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐     │
│  │  DB Tables   │───▶│  7 Detectors │───▶│  Insights Array  │     │
│  │              │    │  (parallel)  │    │  (1h cache TTL)  │     │
│  └─────────────┘    └──────────────┘    └─────────────────┘     │
│         │                  │                      │              │
│         ▼                  ▼                      ▼              │
│  tax_summaries       ┌──────────┐          ┌──────────┐        │
│  invoices            │ Detector │          │ API:     │        │
│  documents           │ Results  │          │ GET      │        │
│  coa_accounts        │          │          │ /api/ai/ │        │
│  tax_audits          │ cached   │          │ insights │        │
│                      │ 1 hour   │          └──────────┘        │
│                      └──────────┘                               │
└──────────────────────────────────────────────────────────────────┘
```

### 7 Anomaly Detectors

| # | Detector | Table | Condition | Severity |
|---|----------|-------|-----------|----------|
| 1 | **Tax Spike** | `tax_summaries` | PPH23+PPH42 month-over-month change >20% | medium/high |
| 2 | **Overdue Invoices** | `invoices` | `payment_date` >30 days ago | medium/high |
| 3 | **Stuck Documents** | `documents` | `status = 'processing'` | high |
| 4 | **Audit Deadlines** | `tax_audits` | `startDate` within 7 days, status pending/in_progress | medium |
| 5 | **Empty COA** | `coa_accounts` | Account with no sub-accounts | low |
| 6 | **High Volume Folders** | `documents` | Folder with >50 documents | low |
| 7 | **Recent Activity** | `documents` + `invoices` | Activity today >0 | info |

### Insight Object Shape
```json
{
  "type": "tax_spike",
  "severity": "high|medium|low|info",
  "icon": "📊",
  "title": "Pajak bulan ini naik 35%",
  "detail": "Bulan ini: Rp 75 Juta | Bulan lalu: Rp 55.6 Juta",
  "action": "Lihat detail pajak"
}
```

### API Endpoint
```
GET /api/ai/insights
→ { insights: [...], generatedAt, fromCache }
```

### Source: `server/services/insightsEngine.js`
- Results cached 1 hour (in-memory)
- Each detector runs independently; failures are logged but don't block others
- `invalidateInsightsCache()` called when data changes significantly

---

## 12. RAG-ENHANCED CONVERSATION MEMORY

```
┌──────────────────────────────────────────────────────────────────┐
│                     RAG MEMORY FLOW                               │
│                                                                  │
│  USER ASKS QUESTION                                              │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐    ┌──────────────────┐                    │
│  │ Generate Embedding│───▶│ pgvector Search  │                    │
│  │ (query text)     │    │ (cosine > 0.3)   │                    │
│  └─────────────────┘    └──────────────────┘                    │
│                               │                                  │
│                               ▼                                  │
│                    ┌──────────────────────┐                      │
│                    │ Top 3 Relevant Past  │                      │
│                    │ Conversation Summaries│                      │
│                    └──────────────────────┘                      │
│                               │                                  │
│                               ▼                                  │
│                    ┌──────────────────────┐                      │
│                    │ Inject into AI Agent │                      │
│                    │ System Prompt        │                      │
│                    │ [RAG CONTEXT]        │                      │
│                    └──────────────────────┘                      │
│                               │                                  │
│                               ▼                                  │
│                    ┌──────────────────────┐                      │
│                    │ LLM Generates Reply  │                      │
│                    │ with enriched context │                      │
│                    └──────────────────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

### Database: `ai_conversation_summaries`
```
┌──────────────────────────────────────────────────────────────────────┐
│  TABLE: ai_conversation_summaries                                    │
├──────────────────────┬───────────────┬────────────────────────────────┤
│  COLUMN              │  TYPE         │  DESCRIPTION                  │
├──────────────────────┼───────────────┼────────────────────────────────┤
│  id                  │  INTEGER PK   │  Auto-increment               │
│  session_id          │  INTEGER FK   │  → ai_chat_sessions.id        │
│  user_id             │  INTEGER FK   │  → users.id                   │
│  summary             │  TEXT         │  Conversation summary (max 2k)│
│  key_topics          │  TEXT         │  Comma-separated topics       │
│  message_count       │  INTEGER      │  Messages in session          │
│  embedding           │  VECTOR(1536) │  pgvector for semantic search │
│  created_at          │  TIMESTAMP    │  When summary was created     │
└──────────────────────┴───────────────┴────────────────────────────────┘
```

### How Auto-Summary Works
1. Worker saves chat messages to `ai_chat_messages`
2. After 4+ messages, `autoSummarizeSession()` is called
3. `generateSummaryFromMessages()` extracts: first user question + last assistant answer
4. Key topics extracted via regex patterns (PPN, PPh, Invoice, COA, etc.)
5. Summary + embedding saved to `ai_conversation_summaries`
6. Semantic search uses pgvector cosine distance (threshold ≥ 0.3)

### Topic Detection Patterns
| Pattern | Topic |
|---------|-------|
| `ppn\|vat\|pajak pertambahan` | PPN |
| `pph\|pajak penghasilan` | PPh |
| `invoice\|faktur` | Invoice |
| `dokumen\|arsip` | Dokumen |
| `coa\|akun` | COA |
| `inventory\|box\|rak` | Inventory |
| `approval\|persetujuan` | Approval |
| `wp\|wajib pajak` | Wajib Pajak |
| `audit\|pemeriksaan` | Audit |

### API Endpoint
```
GET /api/ai/memory/stats
→ { totalSummaries: N, withEmbedding: N }
```

### Source: `server/services/conversationMemory.js`

---

## 13. MULTI-TOOL CHAINING (MAX 6 ITERATIONS)

```
┌──────────────────────────────────────────────────────────────────┐
│                   MULTI-TOOL CHAINING                             │
│                                                                  │
│  ITERATION 1: search_docs("PPN")                                │
│       │  → found 3 documents                                    │
│       ▼                                                          │
│  ITERATION 2: search_invoices("PPN")                            │
│       │  → found 5 invoices                                     │
│       ▼                                                          │
│  ITERATION 3: get_document_detail(id=42)                        │
│       │  → retrieved full document content                       │
│       ▼                                                          │
│  ITERATION 4: search_coa("PPN Output")                          │
│       │  → found COA code 4112.01                                │
│       ▼                                                          │
│  ITERATION 5: (analysis)                                         │
│       │  → synthesizing all tool results                         │
│       ▼                                                          │
│  ITERATION 6: generate final answer                              │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│  KEY CHAINING PATTERNS:                                          │
│                                                                  │
│  1. Search → Detail:                                             │
│     search_docs → get_document_detail → answer                   │
│                                                                  │
│  2. Multi-source aggregation:                                    │
│     search_docs + search_invoices + search_coa → answer          │
│                                                                  │
│  3. Search → Verify → Answer:                                    │
│     search_docs → verify_amount → answer                         │
│                                                                  │
│  4. Complex multi-step:                                          │
│     search_docs → get_document_detail → search_coa               │
│     → search_invoices → answer                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Configuration
```javascript
// In server/services/aiAgent.js
const MAX_ITERATIONS = 6;  // Increased from 4 to support deeper chains
const RAG_CONTEXT_LIMIT = 3;  // Max past conversations injected
```

### Chaining Rules (in System Prompt)
1. **Use all iterations**: Don't stop early if more tools can help
2. **Search before answer**: Always use search tools before answering data questions
3. **Chain tools**: After search results, use detail tools to get full data
4. **Verify amounts**: Use search_invoices to cross-check financial figures
5. **Complete before replying**: Gather all needed data before final answer
6. **Don't duplicate**: If a tool was already called, don't call again with same params

### Tool Chaining Examples
```
User: "Tunjukkan semua dokumen PPN dan total nilainya"

Chain: search_docs("PPN")
     → [3 docs found]
     → get_document_detail(id=1) [amount: 10M]
     → get_document_detail(id=2) [amount: 15M]
     → get_document_detail(id=3) [amount: 25M]
     → Answer: "3 dokumen PPN ditemukan. Total: Rp 50 Juta"
```

---

## 14. COMPLETE API ENDPOINTS REFERENCE

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI ASSISTANT ENDPOINTS                         │
├──────────────────────────┬──────────┬────────────────────────────┤
│  ENDPOINT                │  METHOD  │  DESCRIPTION               │
├──────────────────────────┼──────────┼────────────────────────────┤
│  /api/ai/agent           │  POST    │  Main chat endpoint        │
│  /api/ai/config          │  GET     │  Get AI configuration      │
│  /api/ai/config          │  PUT     │  Update AI config          │
│  /api/ai/status          │  GET     │  System status             │
│  /api/ai/models          │  GET     │  Available AI models       │
│  /api/ai/sessions        │  GET     │  List chat sessions        │
│  /api/ai/sessions        │  POST    │  Create new session        │
│  /api/ai/sessions/:id    │  GET     │  Get session messages      │
│  /api/ai/sessions/:id    │  DELETE  │  Delete session            │
├──────────────────────────┼──────────┼────────────────────────────┤
│  /api/ai/cache/stats     │  GET     │  Cache statistics          │
│  /api/ai/cache/invalidate│  POST    │  Invalidate cache          │
│  /api/ai/cache/rebuild   │  POST    │  Rebuild pgvector index    │
├──────────────────────────┼──────────┼────────────────────────────┤
│  /api/ai/cache/warm/config│  GET    │  Get warm config           │
│  /api/ai/cache/warm/config│  PUT    │  Update warm config        │
│  /api/ai/cache/warm      │  POST    │  Manual trigger warm       │
│  /api/ai/cache/warm/latest│  GET    │  Latest warm log           │
│  /api/ai/cache/warm/logs │  GET     │  Warm run history          │
├──────────────────────────┼──────────┼────────────────────────────┤
│  /api/ai/insights        │  GET     │  Proactive insights        │
│  /api/ai/memory/stats    │  GET     │  RAG memory statistics     │
└──────────────────────────┴──────────┴────────────────────────────┘
```

---

## 15. FILE STRUCTURE REFERENCE

```
server/
├── services/
│   ├── aiAgent.js          # Core agent + RAG context injection
│   ├── agentCache.js       # pgvector + SHA256 cache layer
│   ├── chatHistory.js      # Session/message CRUD
│   ├── conversationMemory.js # RAG memory (save/search/summarize)
│   ├── insightsEngine.js   # 7 proactive insight detectors
│   ├── cacheWarmer.js      # Scheduled cache warming
│   └── embeddings.js       # (placeholder, real: ai_search.js)
├── ai_search.js            # Embedding generation + vector search
├── db.js                   # Knex DB connection
├── queue.js                # BullMQ queue setup
├── utils/
│   └── queue.js            # Cache warm schedule + BullMQ jobs
├── worker.js               # Job processor (ai-agent, cache-warm)
├── routes/
│   └── aiRoutes.js         # All AI API endpoints
├── controllers/
│   └── aiController.js     # Request handlers
├── migrations/
│   ├── 20260715000000_create_coa_tables.js
│   ├── 20260715100000_create_ai_cache_warm_logs.js
│   ├── 20260715110000_add_meta_to_ai_settings.js
│   └── 20260715120000_create_conversation_summaries.js
│
src/
├── components/
│   └── AiChatAssistant.jsx # Chat UI component
├── services/
│   └── database.js         # Frontend API calls
└── pages/
    └── Book.jsx            # COA management page
```


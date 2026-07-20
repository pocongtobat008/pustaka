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
├─────────────────────────┼──────────────────────────────────────────┤
│  ★ Training Docs (RAG)  │  search_training_docs  ← MANDATORY 1ST  │
│  (Dokumen Training)     │  (query: string → top 5 chunks)         │
│  ↑ PRIORITAS UTAMA      │  Called FIRST for any knowledge Q       │
│                         │  Optional: category filter               │
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
│  + ai_training_documents        │ coa_departments     │             │
│  + ai_training_chunks           │                     │             │
│  + ai_learning_logs             │                     │             │
│  + ai_learning_corrections      │                     │             │
│  + ai_data_snapshots            │                     │             │
│  + ai_evolution_logs            ├────────────────────┤             │
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

## 13. MULTI-TOOL CHAINING (MAX 4 ITERATIONS)

```
┌──────────────────────────────────────────────────────────────────┐
│                   MULTI-TOOL CHAINING                             │
│                                                                  │
│  ITERATION 1: search_training_docs("PPN")  ← MANDATORY FIRST     │
│       │  → found 2 chunks from training docs                     │
│       ▼                                                          │
│  ITERATION 2: search_docs("PPN")                                │
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
const MAX_ITERATIONS = 4;
const RAG_CONTEXT_LIMIT = 3;  // Max past conversations injected
```

### Chaining Rules (in System Prompt)
1. **Training docs FIRST**: Always call `search_training_docs` before answering knowledge questions
2. **Use all iterations**: Don't stop early if more tools can help
3. **Search before answer**: Always use search tools before answering data questions
4. **Chain tools**: After search results, use detail tools to get full data
5. **Verify amounts**: Use search_invoices to cross-check financial figures
6. **Complete before replying**: Gather all needed data before final answer
7. **Don't duplicate**: If a tool was already called, don't call again with same params

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
├──────────────────────────┼──────────┼────────────────────────────┤
│  TRAINING DOCUMENTS                                                   │
├──────────────────────────┼──────────┼────────────────────────────┤
│  /api/ai/training        │  GET     │  List training documents   │
│  /api/ai/training        │  POST    │  Upload/link document      │
│  /api/ai/training/:id    │  GET     │  Get document detail       │
│  /api/ai/training/:id    │  DELETE  │  Delete document           │
│  /api/ai/training/:id/reprocess │ POST │ Re-embed document      │
│  /api/ai/training/upload │  POST    │  Upload file (multipart)   │
│  /api/ai/training/link   │  POST    │  Add URL link              │
└──────────────────────────┴──────────┴────────────────────────────┘
```

---

## 15. FILE STRUCTURE REFERENCE

```
server/
├── services/
│   ├── aiAgent.js          # Core agent + RAG context injection + training docs tool
│   ├── agentCache.js       # pgvector + SHA256 cache layer
│   ├── chatHistory.js      # Session/message CRUD
│   ├── conversationMemory.js # RAG memory (save/search/summarize)
│   ├── insightsEngine.js   # 7 proactive insight detectors
│   ├── cacheWarmer.js      # Scheduled cache warming
│   ├── trainingDocs.js     # Training doc parse/chunk/embed/search/CRUD
│   ├── selfImprovement.js  # Learning from chat + corrections + evolution
│   └── embeddings.js       # (placeholder, real: ai_search.js)
├── ai_search.js            # Embedding generation + vector search (1024-dim)
├── db.js                   # Knex DB connection
├── queue.js                # BullMQ queue setup
├── utils/
│   └── queue.js            # Cache warm schedule + BullMQ jobs
├── worker.js               # Job processor (ai-agent, cache-warm)
├── routes/
│   └── aiRoutes.js         # All AI API endpoints + training routes
├── controllers/
│   └── aiController.js     # Request handlers
├── migrations/
│   ├── 20260715000000_create_coa_tables.js
│   ├── 20260715100000_create_ai_cache_warm_logs.js
│   ├── 20260715110000_add_meta_to_ai_settings.js
│   ├── 20260715120000_create_conversation_summaries.js
│   ├── 20260716000000_create_ai_training_documents.js
│   ├── 20260716010000_fix_training_embedding_dimension.js
│   ├── 20260716020000_create_training_chunks.js
│   ├── 20260717000000_create_ai_learning_logs.js
│   └── 20260717010000_create_ai_corrections_evolution.js

src/
├── components/
│   └── AiChatAssistant.jsx # Chat UI component
├── services/
│   ├── apiClient.js        # HTTP client (FormData auto-detect)
│   └── database.js         # Frontend API calls
└── pages/
    ├── Book.jsx            # COA management page
    └── MasterData.jsx      # Training AI tab (upload/link/list/preview)
```

---

## 16. AI TRAINING DOCUMENTS SYSTEM

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   TRAINING DOCUMENTS FLOW                                │
│                                                                          │
│  ┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐     │
│  │  User Upload │────▶│  Text Extraction  │────▶│  Chunking         │     │
│  │  (PDF/DOCX/  │     │  (pdf-parse /     │     │  (1000 chars,     │     │
│  │   TXT/URL)   │     │   mammoth /       │     │   200 overlap)    │     │
│  └─────────────┘     │   cheerio)        │     └────────┬──────────┘     │
│                       └──────────────────┘              │                 │
│                                                          ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    Embedding + Storage                            │    │
│  │                                                                  │    │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐│    │
│  │  │  generateEmbedding│───▶│  Vector Normalize │───▶│  INSERT INTO ││    │
│  │  │  (1024-dim)     │    │  (unit vector)   │    │  pgvector    ││    │
│  │  │  we/text-emb-v3 │    │                  │    │  + metadata  ││    │
│  │  └─────────────────┘    └─────────────────┘    └──────────────┘│    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    AI Agent Query Flow                            │    │
│  │                                                                  │    │
│  │  User Question ──▶ Embed Query ──▶ pgvector Cosine Search       │    │
│  │                    (1024-dim)      (threshold > 0.3, top 3)      │    │
│  │                           │                                      │    │
│  │                           ▼                                      │    │
│  │                    ┌──────────────────┐                           │    │
│  │                    │ Matched Chunks   │                           │    │
│  │                    │ (score > 0.3)    │                           │    │
│  │                    └────────┬─────────┘                           │    │
│  │                             │                                     │    │
│  │                             ▼                                     │    │
│  │                    ┌──────────────────┐                           │    │
│  │                    │ Inject into      │                           │    │
│  │                    │ System Prompt    │                           │    │
│  │                    │ as [DOKUMEN      │                           │    │
│  │                    │  TRAINING]       │                           │    │
│  │                    └──────────────────┘                           │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Database: `ai_training_documents`
```
┌────────────────────────────────────────────────────────────────────────┐
│  TABLE: ai_training_documents                                          │
├──────────────────────┬────────────────┬────────────────────────────────┤
│  COLUMN              │  TYPE          │  DESCRIPTION                  │
├──────────────────────┼────────────────┼────────────────────────────────┤
│  id                  │  INTEGER PK    │  Auto-increment               │
│  title               │  VARCHAR(255)  │  Document title               │
│  filename            │  VARCHAR(255)  │  Original filename            │
│  file_type           │  VARCHAR(20)   │  pdf, docx, txt, md, link     │
│  file_url            │  VARCHAR(500)  │  URL for linked docs          │
│  file_path           │  VARCHAR(500)  │  Local file path              │
│  content             │  TEXT          │  Full extracted text          │
│  category            │  VARCHAR(50)   │  tax_regulation, accounting_  │
│                      │                │  standard, procedure, guide,  │
│                      │                │  general                      │
│  tags                │  VARCHAR(255)  │  Comma-separated tags         │
│  status              │  VARCHAR(20)   │  processing, active, error    │
│  chunk_count         │  INTEGER       │  Number of text chunks        │
│  embedding           │  VECTOR(1024)  │  pgvector embedding           │
│  uploaded_by         │  INTEGER FK    │  → users.id                   │
│  created_at          │  TIMESTAMP     │  Upload time                  │
│  updated_at          │  TIMESTAMP     │  Last update time             │
├──────────────────────┴────────────────┴────────────────────────────────┤
│  INDEXES:                                                             │
│  - training_embedding_idx  (ivfflat, vector_cosine_ops, lists=1)      │
│  - training_status_idx     (status)                                    │
│  - training_filetype_idx   (file_type)                                 │
└────────────────────────────────────────────────────────────────────────┘

NOTE: Embedding is stored at document level (first 2000 chars of first chunk).
      For full RAG, each chunk should be embedded separately (future version).
```

### Text Extraction Pipeline
```
┌──────────────────────────────────────────────────────────────────┐
│                  FILE TYPE → EXTRACTOR                            │
├─────────────────┬────────────────────────────────────────────────┤
│  FILE TYPE      │  EXTRACTOR                                    │
├─────────────────┼────────────────────────────────────────────────┤
│  .pdf           │  pdf-parse (npm)                              │
│  .docx          │  mammoth (npm)                                │
│  .txt           │  fs.readFileSync (UTF-8)                      │
│  .md            │  fs.readFileSync (UTF-8)                      │
│  URL            │  cheerio (HTML → text, strips tags)           │
└─────────────────┴────────────────────────────────────────────────┘
```

### Chunking Strategy
```
┌──────────────────────────────────────────────────────────────────┐
│                  CHUNKING PARAMETERS                              │
├─────────────────────────┬────────────────────────────────────────┤
│  PARAMETER              │  VALUE                                │
├─────────────────────────┼────────────────────────────────────────┤
│  chunk_size             │  1000 characters                      │
│  overlap                │  200 characters                       │
│  min_chunk_size         │  50 characters (skip empty/too short) │
│  encoding               │  UTF-8                                │
└─────────────────────────┴────────────────────────────────────────┘

Splitting algorithm:
1. Read extracted text
2. Split by chunk_size (1000 chars)
3. Overlap last 200 chars into next chunk
4. Filter out chunks < 50 chars
5. Return array of { content, chunk_index, token_count }

NOTE: Currently only the first chunk (2000 chars) is embedded as document representative.
      Full chunk-level embedding is planned for future version.
```

### Semantic Search Flow
```
┌──────────────────────────────────────────────────────────────────┐
│                  SEARCH TRAINING DOCS                             │
│                                                                  │
│  query_text (string)                                             │
│       │                                                          │
│       ▼                                                          │
│  generateEmbedding(query_text)                                   │
│  → 1024-dim vector                                               │
│       │                                                          │
│       ▼                                                          │
│  SQL: SELECT id, title, filename, file_type, category, tags,     │
│          content, chunk_count, created_at,                       │
│          1 - (embedding <=> query_embedding) AS similarity       │
│       FROM ai_training_documents                                 │
│       WHERE embedding IS NOT NULL AND status = 'active'          │
│       [AND category = ?]  -- optional filter                     │
│       ORDER BY embedding <=> query_embedding                     │
│       LIMIT 5                                                    │
│       │                                                          │
│       ▼                                                          │
│  Filter: similarity >= 0.25                                      │
│       │                                                          │
│       ▼                                                          │
│  Return: [{ id, title, fileType, category, tags,                │
│              contentPreview (500 chars), similarity }]           │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│  KEY PARAMETERS:                                                 │
│  - Threshold: 0.25 (cosine similarity)                          │
│  - Top K: 5 (max results)                                       │
│  - Operator: <=> (pgvector cosine distance)                     │
│  - Result: 1 - distance = similarity                            │
│  - Optional: category filter (tax_regulation, etc.)              │
└──────────────────────────────────────────────────────────────────┘
```

### AI Agent Integration (RAG Injection)
```
┌──────────────────────────────────────────────────────────────────┐
│              TRAINING DOCS → SYSTEM PROMPT INJECTION              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  STEP 1: System prompt includes mandatory instruction        ││
│  │                                                              ││
│  │  "⚠️ ATURAN PALING PENTING:                                  ││
│  │   SEBELUM menggunakan tool apapun, Anda WAJIB memanggil      ││
│  │   search_training_docs dengan query pertanyaan pengguna      ││
│  │   untuk mencari pengetahuan dari dokumen training.          ││
│  │   Jika hasil ditemukan, gunakan sebagai dasar utama jawaban"││
│  └──────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  STEP 2: LLM calls search_training_docs FIRST               ││
│  │                                                              ││
│  │  search_training_docs({                                      ││
│  │    query: "PPN adalah pajak pertambahan nilai",              ││
│  │    category: "tax_regulation"                                ││
│  │  })                                                          ││
│  │  → Returns: { count: 2, docs: [...] }                       ││
│  └──────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  STEP 3: Tool result added to messages                      ││
│  │                                                              ││
│  │  { role: "tool", tool_call_id: "call_xyz",                  ││
│  │    content: {                                                ││
│  │      count: 2,                                               ││
│  │      docs: [                                                 ││
│  │        { title: "Peraturan PPN", category: "tax_regulation",││
│  │          similarity: 0.95, content: "PPN dikenakan 11%..."  ││
│  │        },                                                    ││
│  │        { title: "Kebijakan Pajak", similarity: 0.88, ... } ││
│  │      ]                                                       ││
│  │    }                                                         ││
│  │  }                                                           ││
│  └──────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  STEP 4: LLM generates answer using training context        ││
│  │                                                              ││
│  │  Answer: "Berdasarkan dokumen training, PPN adalah pajak    ││
│  │  pertambahan nilai yang dikenakan sebesar 11%..."           ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### System Prompt Training Section
```javascript
// Actual system prompt in server/services/aiAgent.js (compressed ~200 tokens)

const SYSTEM_PROMPT = `Agent AI Pustaka — arsip, pajak & akuntansi.

⚠️ ATURAN PALING PENTING:
SEBELUM menggunakan tool apapun, Anda WAJIB memanggil \`search_training_docs\` 
dengan query pertanyaan pengguna untuk mencari pengetahuan dari dokumen training. 
Jika hasil ditemukan, gunakan sebagai dasar utama jawaban. 
Ini adalah sumber pengetahuan utama.

... (database schema listed) ...

Cara kerja:
1. **PRIORITAS UTAMA**: Untuk pertanyaan pengetahuan, definisi, peraturan, prosedur, 
   atau panduan — WAJIB gunakan \`search_training_docs\` terlebih dahulu. 
   Tool ini mencari dokumen training yang sudah diunggah ke sistem. 
   Jika ada hasil yang relevan, gunakan sebagai dasar jawaban.
2. Untuk data transaksi/operasional (faktur, invoice, surat, dokumen arsip): 
   gunakan \`search_documents\`, \`search_invoices\`, dll.
3. Untuk laporan pajak: panggil \`get_tax_summary\` untuk data angka, 
   \`search_tax_wp\` atau \`list_tax_wp\` untuk data WP.
4. Field \`data\` pada tax_summaries berisi JSON detail angka PPN (ppnIn, ppnOut) 
   dan PPh. Baca dan jelaskan angka-angkanya.
5. Untuk melihat semua data tanpa filter: gunakan \`list_documents\`, 
   \`list_invoices\`, \`list_tax_wp\`.
6. Bila pengguna meminta "laporan", "ringkasan", atau "rekap" — 
   gunakan tools list/search lalu buat tabel markdown.
7. Untuk pertanyaan COA/akuntansi: gunakan \`search_coa_accounts\` untuk cari 
   kode/nama akun, \`get_coa_hierarchy\` untuk struktur lengkap, 
   \`get_coa_stats\` untuk statistik.
8. Contoh pertanyaan COA: "akun 11110 itu apa?", "tampilkan sub COA untuk akun kas", 
   "berapa jumlah akun di COA?", "cari departemen untuk akun pendapatan".

Multi-turn Tool Chaining:
9. Jika hasil pencarian mengembalikan ID, gunakan tool detail untuk mendapatkan 
   informasi lengkap. Contoh: search_documents → get_document_detail(id).
10. Jika perlu konteks terkait, panggil beberapa tool secara berurutan. 
    Contoh: search_invoices → get_invoice_detail → search_documents(vendor).
11. Gunakan SEMUA iterasi yang tersedia untuk mengumpulkan data lengkap 
    sebelum memberikan jawaban akhir.
12. Jangan terburu-buru memberikan jawaban jika masih ada data yang bisa diambil.

Format laporan:
- Gunakan heading (###, ####), tabel Markdown, dan bullet points.
- Selalu cantumkan ID sumber (mis. Invoice #12, WP #5).
- Untuk data pajak, tampilkan angka dalam format Rupiah dan jelaskan status (KB/LB).
- Untuk data COA, tampilkan hierarki lengkap: Akun Induk → Sub COA → Departemen.
- Bila data kosong, sampaikan jujur dan sarankan langkah selanjutnya.`;
```

### MasterData.jsx — Training AI Tab
```
┌──────────────────────────────────────────────────────────────────┐
│                   TRAINING AI TAB UI                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  TABS: [Upload]  [Link]                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── Upload Tab ─────────────────────────────────────────────┐ │
│  │  Title: [__________]                                       │ │
│  │  Category: [tax_regulation ▼]  (dropdown)                  │ │
│  │  Tags: [__________] (optional)                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  [Click to Upload] atau drag & drop                   │  │ │
│  │  │  Format: PDF, DOCX, TXT, MD                           │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  [Upload] button                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── Link Tab ───────────────────────────────────────────────┐ │
│  │  Title: [__________]                                       │ │
│  │  URL: [https://...]                                        │ │
│  │  Category: [tax_regulation ▼]  (dropdown)                  │ │
│  │  Tags: [__________] (optional)                             │ │
│  │  [Add Link] button                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── Document List ──────────────────────────────────────────┐ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ 📄 Peraturan PPN.pdf     pdf    12 chunks  ✅ active│   │ │
│  │  │    Category: tax_regulation | Tags: pajak, ppn      │   │ │
│  │  │    [Preview]  [Re-process]  [Delete]                 │   │ │
│  │  ├─────────────────────────────────────────────────────┤   │ │
│  │  │ 🔗 https://example.com/kebijakan  link  3 chunks ✅ │   │ │
│  │  │    Category: general | Tags: kebijakan              │   │ │
│  │  │    [Preview]  [Re-process]  [Delete]                 │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── Preview Modal ──────────────────────────────────────────┐ │
│  │  Title: Peraturan PPN.pdf                                  │ │
│  │  Category: tax_regulation                                  │ │
│  │  Status: ✅ active | Type: pdf | Chunks: 12               │ │
│  │                                                             │ │
│  │  ┌─── Content ─────────────────────────────────────────┐   │ │
│  │  │  [Full extracted text content]                        │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │  [Close]                                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Re-processing Flow
```
┌──────────────────────────────────────────────────────────────────┐
│                  RE-PROCESS DOCUMENT                               │
│                                                                  │
│  POST /api/ai/training/:id/reprocess                             │
│       │                                                          │
│       ▼                                                          │
│  1. Fetch document metadata from ai_training_documents            │
│  2. Delete all existing chunks from ai_training_chunks            │
│     (WHERE document_id = :id)                                     │
│  3. Re-extract text from source file/URL                          │
│  4. Re-chunk with current parameters                              │
│  5. Re-embed each chunk                                           │
│  6. Insert new chunks with new embeddings                         │
│  7. Update document status + chunk_count                          │
│                                                                  │
│  USE CASES:                                                      │
│  - Updated embedding model                                        │
│  - Changed chunk size                                             │
│  - Corrupted initial processing                                   │
│  - Want different chunking strategy                               │
└──────────────────────────────────────────────────────────────────┘
```

### API Endpoints Detail
```
┌────────────────────────────────────────────────────────────────────────┐
│  TRAINING DOCUMENTS API                                                │
├──────────────────────────┬──────────┬──────────────────────────────────┤
│  ENDPOINT                │  METHOD  │  REQUEST / RESPONSE              │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/training        │  GET     │  Query: ?category=&status=&      │
│                          │          │          search=                 │
│                          │          │  Response: [ {...}, {...} ]      │
│                          │          │  (array of documents)            │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/training/upload │  POST    │  Body: FormData {                │
│                          │          │    file: <File>,                 │
│                          │          │    title: "Judul",               │
│                          │          │    category: "tax_regulation",   │
│                          │          │    tags: "pajak,ppn"             │
│                          │          │  }                               │
│                          │          │  Response: {                     │
│                          │          │    id: 1,                        │
│                          │          │    status: "processing",         │
│                          │          │    message: "..."                │
│                          │          │  }                               │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/training/link   │  POST    │  Body: JSON {                    │
│                          │          │    url: "https://...",           │
│                          │          │    title: "Judul",               │
│                          │          │    category: "tax_regulation",   │
│                          │          │    tags: "pajak,ppn"             │
│                          │          │  }                               │
│                          │          │  Response: {                     │
│                          │          │    id: 2,                        │
│                          │          │    status: "processing"          │
│                          │          │  }                               │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/training/:id    │  GET     │  Response: {                     │
│                          │          │    id, title, filename,          │
│                          │          │    file_type, content,           │
│                          │          │    category, tags, status,       │
│                          │          │    chunk_count, created_at       │
│                          │          │  }                               │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/training/:id    │  DELETE  │  Response: {                     │
│                          │          │    success: true,                │
│                          │          │    message: "..."                │
│                          │          │  }                               │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/training/:id/re │  POST    │  Response: {                     │
│  process                 │          │    success: true,                │
│                          │          │    message: "..."                │
│                          │          │  }                               │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  SELF-IMPROVEMENT / LEARNING                                             │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/learning/stats  │  GET     │  Learning statistics             │
│  /api/ai/learning/topics │  GET     │  Topic frequency summary         │
│  /api/ai/learning/logs   │  GET     │  All learning logs               │
│  /api/ai/learning/analyze│  POST    │  Analyze recent chats            │
│  /api/ai/learning/       │  POST    │  Generate training docs from     │
│  generate                │          │  accumulated knowledge           │
│  /api/ai/learning/       │  POST    │  Full cycle (analyze + generate) │
│  run-cycle               │          │                                  │
│  /api/ai/learning/       │  POST    │  Train single topic by ID        │
│  train/:id               │          │                                  │
│  /api/ai/learning/       │  POST    │  Train all pending topics        │
│  train-all               │          │                                  │
│  /api/ai/learning/       │  POST    │  Train by topic name             │
│  train-by-topic          │          │                                  │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  CORRECTIONS & EVOLUTION                                                  │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/corrections     │  GET     │  List corrections                │
│  /api/ai/corrections     │  POST    │  Submit correction manually      │
│  /api/ai/corrections/    │  GET     │  Correction statistics           │
│  stats                   │          │                                  │
│  /api/ai/corrections/    │  POST    │  Apply correction to knowledge   │
│  :id/apply               │          │  base                            │
│  /api/ai/evolution/scan  │  POST    │  Run full evolution scan         │
│  /api/ai/evolution/      │  GET     │  Evolution scan history          │
│  history                 │          │                                  │
│  /api/ai/evolution/      │  GET     │  Combined correction + evolution │
│  stats                   │          │  stats                           │
│  /api/ai/evolution/      │  GET     │  Data change snapshots           │
│  snapshots               │          │                                  │
└──────────────────────────┴──────────┴──────────────────────────────────┘
```

### Source Files
```
server/services/trainingDocs.js   — saveDocument, generateDocEmbedding,
                                    searchTrainingDocs, getDocuments,
                                    getDocument, deleteDocument,
                                    reprocessDocument, parseDocument,
                                    chunkText

server/routes/aiRoutes.js         — Training endpoints (multer for file upload,
                                    link, list, detail, delete, reprocess)

server/services/aiAgent.js        — search_training_docs tool definition (line 283)
                                    + executeTool() case (line 673)
                                    + System prompt with mandatory first tool rule

server/migrations/                — 20260716000000_create_ai_training_documents.js
                                    20260716010000_fix_training_embedding_dimension.js

src/pages/MasterData.jsx          — Training AI tab (upload/link forms,
                                    document list, preview modal)
```

### Embedding Dimensions
```
┌──────────────────────────────────────────────────────────────────┐
│                  EMBEDDING MODEL SPECS                            │
├─────────────────────────┬────────────────────────────────────────┤
│  MODEL                  │  we/text-embedding-v3                  │
│  DIMENSIONS             │  1024                                  │
│  MAX TOKENS             │  8192                                  │
│  SIMILARITY             │  Cosine                                │
│  INDEX TYPE             │  IVFFlat (lists=1)                     │
│  THRESHOLD              │  > 0.25                                │
│  TOP K                  │  5                                     │
│  CHUNK SIZE             │  1000 chars                            │
│  CHUNK OVERLAP          │  200 chars                             │
└─────────────────────────┴────────────────────────────────────────┘

NOTE: ai_conversation_summaries uses 1536-dim embeddings (different model).
ai_training_documents uses 1024-dim embeddings (we/text-embedding-v3).
```

---

## 17. ERROR DETECTION & CORRECTION SYSTEM

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   CORRECTION FLOW                                         │
│                                                                          │
│  USER CHAT                                                               │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────┐                    │
│  │  aiAgent.js: detectAndLogCorrection()          │                    │
│  │  (fire & forget, async)                         │                    │
│  │                                                  │                    │
│  │  detectCorrection(message)                      │                    │
│  │  → 25+ regex patterns for Bahasa Indonesia      │                    │
│  │  → "datamu salah", "revisi", "koreksi",         │                    │
│  │    "seharusnya", "bukan begitu", ...             │                    │
│  │  → Returns: { detected, severity, matchedPattern }│                   │
│  └─────────────────────┬───────────────────────────┘                    │
│                        │ detected=true                                    │
│                        ▼                                                  │
│  ┌─────────────────────────────────────────────────┐                    │
│  │  logCorrection()                                │                    │
│  │                                                  │                    │
│  │  1. Get last AI response from chat history      │                    │
│  │     → stored as wrong_answer                    │                    │
│  │  2. Extract correct answer from user message    │                    │
│  │     (after correction marker phrase)            │                    │
│  │  3. INSERT INTO ai_learning_corrections         │                    │
│  │     (topic, wrong_answer, correct_answer,       │                    │
│  │      severity, correction_type)                 │                    │
│  └─────────────────────┬───────────────────────────┘                    │
│                        │                                                  │
│                        ▼                                                  │
│  ┌─────────────────────────────────────────────────┐                    │
│  │  applyCorrection(correctionId)  ← manual or auto │                    │
│  │                                                  │                    │
│  │  Creates training doc:                          │                    │
│  │  "# KOREKSI: {topic}"                           │                    │
│  │  "## ❌ Jawaban yang SALAH (jangan ulangi)"     │                    │
│  │  "## ✅ Jawaban yang BENAR"                     │                    │
│  │  → generateDocEmbedding() → pgvector            │                    │
│  │  → Mark correction as applied                   │                    │
│  │  → Snapshot the change to ai_data_snapshots     │                    │
│  └─────────────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Correction Detection Patterns
| Pattern | Severity | Type |
|---------|----------|------|
| `/datamu\s+salah/i` | 0.8 | correction |
| `/jawabanmu\s+salah/i` | 0.8 | correction |
| `/tidak\s+benar/i` | 0.9 | correction |
| `/bukan\s+begitu/i` | 0.9 | correction |
| `/revisi/i` | 0.5 | revision |
| `/koreksi/i` | 0.5 | revision |
| `/seharusnya/i` | 0.7 | correction |
| `/harusnya/i` | 0.7 | correction |
| `/yang\s+benar\s+adalah/i` | 0.7 | correction |
| `/salah\s+satu/i` | 0.5 | correction |
| `/tidak\s+sesuai/i` | 0.5 | feedback |
| (25+ total patterns) | | |

### Database: `ai_learning_corrections`
```
┌────────────────────────────────────────────────────────────────────────┐
│  TABLE: ai_learning_corrections                                        │
├──────────────────────┬────────────────┬────────────────────────────────┤
│  COLUMN              │  TYPE          │  DESCRIPTION                  │
├──────────────────────┼────────────────┼────────────────────────────────┤
│  id                  │  INTEGER PK    │  Auto-increment               │
│  session_id          │  INTEGER FK    │  → ai_chat_sessions.id        │
│  message_id          │  INTEGER FK    │  → ai_chat_messages.id        │
│  correction_type     │  VARCHAR(50)   │  correction, revision,        │
│                      │                │  feedback, wrong_data          │
│  topic               │  VARCHAR(200)  │  Extracted topic              │
│  category            │  VARCHAR(50)   │  general, tax, accounting, ...│
│  original_question   │  TEXT          │  User's original question     │
│  wrong_answer        │  TEXT          │  AI's incorrect response      │
│  correct_answer      │  TEXT          │  User's correction            │
│  correction_note     │  TEXT          │  Extra context from user      │
│  applied             │  BOOLEAN       │  Applied to knowledge base?   │
│  verified            │  BOOLEAN       │  Verified as correct?         │
│  learning_log_id     │  INTEGER FK    │  → ai_learning_logs.id        │
│  training_doc_id     │  INTEGER FK    │  → ai_training_documents.id   │
│  severity            │  FLOAT         │  0-1 (error seriousness)      │
│  created_at          │  TIMESTAMP     │  When correction was made     │
│  updated_at          │  TIMESTAMP     │  Last update time             │
└──────────────────────┴────────────────┴────────────────────────────────┘
```

### API Endpoints
```
┌────────────────────────────────────────────────────────────────────────┐
│  CORRECTIONS API                                                        │
├──────────────────────────┬──────────┬──────────────────────────────────┤
│  ENDPOINT                │  METHOD  │  DESCRIPTION                    │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/corrections     │  GET     │  List corrections               │
│                          │          │  Query: ?type=&unapplied=&limit=│
│  /api/ai/corrections     │  POST    │  Submit correction manually     │
│                          │          │  Body: { question,              │
│                          │          │    wrongAnswer, correctAnswer,  │
│                          │          │    topic, category }            │
│  /api/ai/corrections/    │  GET     │  Correction statistics          │
│  stats                   │          │  → { total, applied, unapplied, │
│                          │          │      byType }                   │
│  /api/ai/corrections/    │  POST    │  Apply correction to            │
│  :id/apply               │          │  knowledge base                 │
│                          │          │  → creates training doc         │
└──────────────────────────┴──────────┴──────────────────────────────────┘
```

### Source Files
```
server/services/selfImprovement.js  — detectCorrection(), logCorrection(),
                                      applyCorrection(), getCorrections(),
                                      getCorrectionStats()

server/services/aiAgent.js          — detectAndLogCorrection() (fire & forget)
                                      called in runAgent() after history compression

server/routes/aiRoutes.js           — GET/POST /api/ai/corrections,
                                      GET /api/ai/corrections/stats,
                                      POST /api/ai/corrections/:id/apply

server/migrations/
  20260717010000_create_ai_corrections_evolution.js
```

---

## 18. DATA EVOLUTION SCANNER (WEEKLY)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   EVOLUTION SCAN FLOW                                     │
│                                                                          │
│  POST /api/ai/evolution/scan  ← manual trigger or scheduled             │
│       │                                                                  │
│       ▼                                                                  │
│  ╔══════════════════════════════════════════════════════════════════╗    │
│  ║  runEvolutionScan(embedFn)                                       ║    │
│  ╠══════════════════════════════════════════════════════════════════╣    │
│  ║                                                                  ║    │
│  ║  STEP 1: scanTrainingDocsQuality()                              ║    │
│  ║  ┌──────────────────────────────────────────────────────┐       ║    │
│  ║  │  Check all active training docs for:                  │       ║    │
│  ║  │  • content_too_short  (content < 50 chars)           │       ║    │
│  ║  │  • no_chunks          (chunk_count == 0)             │       ║    │
│  ║  │  • stale_content      (updated > 30 days ago)        │       ║    │
│  ║  │  • thin_auto_doc      (auto-generated, 1 chunk)      │       ║    │
│  ║  └──────────────────────────────────────────────────────┘       ║    │
│  ║                          │                                      ║    │
│  ║  STEP 2: scanKnowledgeBase()                                   ║    │
│  ║  ┌──────────────────────────────────────────────────────┐       ║    │
│  ║  │  Check ai_learning_logs for:                         │       ║    │
│  ║  │  • lowConfidenceTopics   (confidence < 0.4)         │       ║    │
│  ║  │  • repeatedUntrained     (repeat >= 3, not trained) │       ║    │
│  ║  │  • unappliedCorrections  (from corrections table)    │       ║    │
│  ║  └──────────────────────────────────────────────────────┘       ║    │
│  ║                          │                                      ║    │
│  ║  STEP 3: processCorrections(embedFn)                           ║    │
│  ║  ┌──────────────────────────────────────────────────────┐       ║    │
│  ║  │  For each unapplied correction:                      │       ║    │
│  ║  │  → applyCorrection() → create training doc           │       ║    │
│  ║  │  → embed with current model                          │       ║    │
│  ║  └──────────────────────────────────────────────────────┘       ║    │
│  ║                          │                                      ║    │
│  ║  STEP 4: pruneKnowledge()                                     ║    │
│  ║  ┌──────────────────────────────────────────────────────┐       ║    │
│  ║  │  DELETE FROM ai_learning_logs WHERE:                  │       ║    │
│  ║  │  • confidence < 0.2                                  │       ║    │
│  ║  │  • repeat_count == 1                                 │       ║    │
│  ║  │  • used_in_training == false                         │       ║    │
│  ║  │  • created_at < 60 days ago                          │       ║    │
│  ║  └──────────────────────────────────────────────────────┘       ║    │
│  ║                          │                                      ║    │
│  ║  STEP 5: generateTrainingDocsFromKnowledge()                   ║    │
│  ║  ┌──────────────────────────────────────────────────────┐       ║    │
│  ║  │  Auto-generate training docs for:                    │       ║    │
│  ║  │  • untrained topics with repeat >= 3                 │       ║    │
│  ║  │  • low-confidence topics                             │       ║    │
│  ║  └──────────────────────────────────────────────────────┘       ║    │
│  ║                          │                                      ║    │
│  ║  STEP 6: Mark snapshots as processed                           ║    │
│  ║                          │                                      ║    │
│  ║                          ▼                                      ║    │
│  ║  SAVE → ai_evolution_logs                                      ║    │
│  ╚══════════════════════════════════════════════════════════════════╝    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Database: `ai_data_snapshots`
```
┌────────────────────────────────────────────────────────────────────────┐
│  TABLE: ai_data_snapshots                                              │
├──────────────────────┬────────────────┬────────────────────────────────┤
│  COLUMN              │  TYPE          │  DESCRIPTION                  │
├──────────────────────┼────────────────┼────────────────────────────────┤
│  id                  │  INTEGER PK    │  Auto-increment               │
│  snapshot_type       │  VARCHAR(50)   │  training_doc, correction,    │
│                      │                │  knowledge, schema             │
│  entity_id           │  INTEGER       │  ID of related entity         │
│  entity_title        │  TEXT          │  Human-readable title         │
│  before_data         │  TEXT (JSON)   │  Snapshot before change       │
│  after_data          │  TEXT (JSON)   │  Snapshot after change        │
│  change_reason       │  VARCHAR(100)  │  auto_evolution,              │
│                      │                │  manual_correction, data_update│
│  evolution_processed │  BOOLEAN       │  Processed in evolution scan?  │
│  created_at          │  TIMESTAMP     │  When snapshot was created    │
│  updated_at          │  TIMESTAMP     │  Last update time             │
└──────────────────────┴────────────────┴────────────────────────────────┘
```

### Database: `ai_evolution_logs`
```
┌────────────────────────────────────────────────────────────────────────┐
│  TABLE: ai_evolution_logs                                              │
├──────────────────────┬────────────────┬────────────────────────────────┤
│  COLUMN              │  TYPE          │  DESCRIPTION                  │
├──────────────────────┼────────────────┼────────────────────────────────┤
│  id                  │  INTEGER PK    │  Auto-increment               │
│  status              │  VARCHAR(20)   │  running, completed, failed   │
│  summary             │  TEXT (JSON)   │  Full scan results            │
│  docs_scanned        │  INTEGER       │  Training docs scanned        │
│  docs_updated        │  INTEGER       │  Docs created/updated         │
│  corrections_applied │  INTEGER       │  Corrections processed        │
│  knowledge_pruned    │  INTEGER       │  Knowledge points pruned      │
│  new_topics_found    │  INTEGER       │  New topics discovered        │
│  error_message       │  TEXT          │  Error if failed              │
│  created_at          │  TIMESTAMP     │  When scan started            │
│  updated_at          │  TIMESTAMP     │  Last update time             │
└──────────────────────┴────────────────┴────────────────────────────────┘
```

### API Endpoints
```
┌────────────────────────────────────────────────────────────────────────┐
│  EVOLUTION API                                                          │
├──────────────────────────┬──────────┬──────────────────────────────────┤
│  ENDPOINT                │  METHOD  │  DESCRIPTION                    │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/evolution/scan  │  POST    │  Run full evolution scan        │
│                          │          │  → scans docs, knowledge,       │
│                          │          │    corrections, prunes          │
│  /api/ai/evolution/      │  GET     │  Evolution scan history         │
│  history                 │          │  Query: ?limit=10               │
│  /api/ai/evolution/      │  GET     │  Combined stats:                │
│  stats                   │          │  corrections + latest evolution │
│  /api/ai/evolution/      │  GET     │  Data change snapshots          │
│  snapshots               │          │  Query: ?type=&limit=20         │
└──────────────────────────┴──────────┴──────────────────────────────────┘
```

### Source Files
```
server/services/selfImprovement.js  — scanTrainingDocsQuality(),
                                      scanKnowledgeBase(),
                                      processCorrections(), pruneKnowledge(),
                                      runEvolutionScan(), getEvolutionHistory(),
                                      getEvolutionStats(), getDataSnapshots()

server/routes/aiRoutes.js           — POST /api/ai/evolution/scan,
                                      GET /api/ai/evolution/history,
                                      GET /api/ai/evolution/stats,
                                      GET /api/ai/evolution/snapshots

server/migrations/
  20260717010000_create_ai_corrections_evolution.js
```

---

## 19. SELF-IMPROVEMENT SYSTEM (LEARNING FROM CHAT)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   SELF-IMPROVEMENT FLOW                                   │
│                                                                          │
│  USER CHATS → AI RESPONDS → logLearning() (fire & forget)               │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────┐                    │
│  │  logInteraction()                               │                    │
│  │                                                  │                    │
│  │  1. Classify intent from question + answer      │                    │
│  │  2. Extract topic (regex patterns + fallback)   │                    │
│  │  3. Extract knowledge (LLM or fallback)         │                    │
│  │  4. INSERT INTO ai_learning_logs                │                    │
│  │     (topic, category, knowledge_extracted,      │                    │
│  │      confidence, question, answer)              │                    │
│  │  5. Update repeat_count if topic exists         │                    │
│  └─────────────────────────────────────────────────┘                    │
│                                                                          │
│  ACCUMULATION → TRAINING                                                │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────┐                    │
│  │  generateTrainingDocsFromKnowledge()            │                    │
│  │                                                  │                    │
│  │  For topics with repeat_count >= 3:             │                    │
│  │  → Create training doc from accumulated Q&A     │                    │
│  │  → Embed and store in pgvector                  │                    │
│  │  → Mark as used_in_training = true              │                    │
│  └─────────────────────────────────────────────────┘                    │
│                                                                          │
│  MANUAL TRAINING (MasterData UI)                                        │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────┐                    │
│  │  Train All Pending → all untrained topics       │                    │
│  │  Train By Topic → specific topic                │                    │
│  │  Full Cycle → analyze + generate + train        │                    │
│  └─────────────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Database: `ai_learning_logs`
```
┌────────────────────────────────────────────────────────────────────────┐
│  TABLE: ai_learning_logs                                               │
├──────────────────────┬────────────────┬────────────────────────────────┤
│  COLUMN              │  TYPE          │  DESCRIPTION                  │
├──────────────────────┼────────────────┼────────────────────────────────┤
│  id                  │  INTEGER PK    │  Auto-increment               │
│  session_id          │  INTEGER FK    │  → ai_chat_sessions.id        │
│  message_id          │  INTEGER FK    │  → ai_chat_messages.id        │
│  topic               │  VARCHAR(200)  │  Extracted topic              │
│  category            │  VARCHAR(50)   │  general, tax, accounting, ...│
│  knowledge_extracted │  TEXT          │  LLM-extracted knowledge      │
│  confidence          │  FLOAT         │  0-1 extraction confidence    │
│  repeat_count        │  INTEGER       │  How many times asked         │
│  used_in_training    │  BOOLEAN       │  Already used for training?   │
│  question            │  TEXT          │  Original user question       │
│  answer              │  TEXT          │  AI's response                │
│  created_at          │  TIMESTAMP     │  When first seen              │
│  updated_at          │  TIMESTAMP     │  Last update time             │
└──────────────────────┴────────────────┴────────────────────────────────┘
```

### View: `ai_learning_topic_summary`
```sql
SELECT topic, category,
       COUNT(*) as ask_count,
       AVG(confidence) as avg_confidence,
       MAX(used_in_training) as is_trained
FROM ai_learning_logs
GROUP BY topic, category
ORDER BY ask_count DESC
```

### API Endpoints
```
┌────────────────────────────────────────────────────────────────────────┐
│  LEARNING API                                                           │
├──────────────────────────┬──────────┬──────────────────────────────────┤
│  ENDPOINT                │  METHOD  │  DESCRIPTION                    │
├──────────────────────────┼──────────┼──────────────────────────────────┤
│  /api/ai/learning/stats  │  GET     │  Learning statistics            │
│  /api/ai/learning/topics │  GET     │  Topic frequency summary        │
│  /api/ai/learning/logs   │  GET     │  All learning logs              │
│  /api/ai/learning/analyze│  POST    │  Analyze recent chats           │
│  /api/ai/learning/       │  POST    │  Generate training docs from    │
│  generate                │          │  accumulated knowledge          │
│  /api/ai/learning/       │  POST    │  Full cycle (analyze + generate)│
│  run-cycle               │          │                                 │
│  /api/ai/learning/       │  POST    │  Train single topic             │
│  train/:id               │          │                                 │
│  /api/ai/learning/       │  POST    │  Train all pending topics       │
│  train-all               │          │                                 │
│  /api/ai/learning/       │  POST    │  Train by topic name            │
│  train-by-topic          │          │                                 │
└──────────────────────────┴──────────┴──────────────────────────────────┘
```

### Source Files
```
server/services/selfImprovement.js  — logInteraction(), extractKnowledge(),
                                      analyzeRecentChats(),
                                      generateTrainingDocsFromKnowledge(),
                                      trainSingleTopic(), trainAllPending(),
                                      trainByTopic(), runSelfImprovementCycle()

server/services/aiAgent.js          — logLearning() (fire & forget after each response)

server/routes/aiRoutes.js           — All /api/ai/learning/* endpoints

server/migrations/
  20260717000000_create_ai_learning_logs.js
```

### MasterData.jsx — Training AI Tab (5 Sub-tabs)
```
┌──────────────────────────────────────────────────────────────────┐
│                   TRAINING AI TAB UI                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  SUB-TABS: [Upload] [List] [Self-Improvement]             │  │
│  │            [Corrections] [Evolution]                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── Upload Tab ─────────────────────────────────────────────┐ │
│  │  Upload file (PDF, DOCX, TXT, MD) with title, category,   │ │
│  │  tags. Auto-extract text, chunk, embed, store.             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── List Tab ───────────────────────────────────────────────┐ │
│  │  Table of training docs with: title, file type, category,  │ │
│  │  date, status. Actions: Preview, Re-process, Delete.       │ │
│  │  Paginated (8 rows/page).                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── Self-Improvement Tab ───────────────────────────────────┐ │
│  │  Stats cards: Knowledge Points, Training Efficiency,       │ │
│  │  Untrained Points, Docs Generated.                         │ │
│  │  Actions: Refresh, Analisis Chat, Train All, Full Cycle.   │ │
│  │  Topic table (paginated) with per-topic Train button.      │ │
│  │  Recent Knowledge Extracted list (paginated).              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── Corrections Tab ────────────────────────────────────────┐ │
│  │  Stats cards: Total, Applied, Pending, Types.              │ │
│  │  Corrections table (paginated): topic, type, correct       │ │
│  │  answer, severity, status, Apply button.                   │ │
│  │  Auto-detected when user says "datamu salah" in chat.      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── Evolution Tab ──────────────────────────────────────────┐ │
│  │  Stats cards: Snapshots, Applied, Pending, Docs Scanned.   │ │
│  │  "Run Evolution Scan" button.                              │ │
│  │  History table (paginated): status, docs scanned/updated,  │ │
 │  │  corrections applied, pruned, new topics, date.            │ │
 │  └────────────────────────────────────────────────────────────┘ │
 └──────────────────────────────────────────────────────────────────┘
 ```

## 20. DEPLOYMENT & OPERATIONS

### 20.1 PM2 Process Management (Ecosystem)
All processes are managed by a single PM2 instance via `ecosystem.config.cjs`:
```
archive-backend        → server/index.js          (port 5005, API)
archive-worker-bullmq → server/worker.js --mode=bullmq
archive-worker-polling→ server/worker.js --mode=polling
archive-frontend      → node_modules/.bin/vite --host 0.0.0.0 --port 5174
```
- **Start:** `pm2 start ecosystem.config.cjs`
- **Save (survive reboot):** `pm2 save`
- **Restart all:** `pm2 restart ecosystem.config.cjs`
- **Status:** `pm2 list`

> CATATAN: Hanya gunakan SATU instance PM2. Jangan jalankan `npm run dev`
> (concurrently) berbarengan — itu akan spawn worker terpisah yang tidak
> terkelola dan menimbun proses orphaned (terjadi saat dev, worker pakai
> kode lama 3 hari tanpa restart).

### 20.2 Health-Check Endpoint
Endpoint publik (TANPA auth) untuk uptime monitoring:
```
GET /api/health
```
Mengembalikan status 4 dependensi kritis + latency (ms):
- `db`        — PostgreSQL (`SELECT 1`)
- `redis`     — BullMQ queue (`PING`)
- `embedding` — API embedding (`/embeddings`, model `we/text-embedding-v3`)
- `llm`       — API LLM (`/models`)

HTTP code: `200` (ok/degraded), `503` (critical). Contoh response:
```json
{
  "status": "ok",
  "timestamp": "2026-07-20T01:24:51.542Z",
  "uptimeSeconds": 5,
  "dependencies": {
    "db":       { "status": "ok", "latencyMs": 4 },
    "redis":    { "status": "ok", "latencyMs": 4 },
    "embedding":{ "status": "ok", "latencyMs": 348 },
    "llm":      { "status": "ok", "latencyMs": 606 }
  }
}
```
Status per-dependensi: `ok` | `degraded` (HTTP error/timeout) |
`down` (gagal) | `not_configured` (belum diatur di `ai_settings`).
Overall: `ok` (db+redis sehat), `degraded` (ada yg down/degraded),
`critical` (db atau redis mati).

Source: `server/services/healthCheck.js` (`getHealthStatus`), mounted di
`server/index.js` SEBELUM router `/api` lainnya agar tidak ter-shadow.

> PENTING: Route `/api/health` HARUS didaftarkan paling awal (sebelum
> `app.use('/api', ...)`). Jika didaftarkan setelah router, request akan
> ter-intersep middleware auth dan balas 401.

### 20.3 Known Operational Gaps (belum ditangani)
- `MAX_ITERATIONS = 4` cukup ketat untuk tool chaining panjang.
- Tidak ada alert otomatis jika embedding/LLM API mati > X menit
  (health endpoint ada, tapi belum ada monitor yang memanggilnya).
- API key LLM/embedding disimpan di `ai_settings` (DB), bukan secret manager.



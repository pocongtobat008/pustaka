# Plan: AI Training Documents Tab in Master Data

## Goal
Add a "Training AI" tab in Master Data where users upload documents (PDF, DOCX, TXT, links) as training material. The system parses content, generates embeddings, and uses them as RAG context when the AI assistant answers questions.

---

## Database Schema

### New Table: `ai_training_documents`

```sql
CREATE TABLE ai_training_documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  filename VARCHAR(255),
  file_type VARCHAR(50),        -- pdf, docx, txt, link
  file_url TEXT,                 -- for links
  file_path TEXT,                -- for uploaded files (relative path)
  content TEXT,                  -- extracted text content
  embedding VECTOR(1536),        -- pgvector for semantic search
  category VARCHAR(100),         -- tax_regulation, accounting_standard, procedure, guide
  tags TEXT,                     -- comma-separated tags
  status VARCHAR(20) DEFAULT 'processing', -- processing, active, error
  chunk_count INTEGER DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Backend Components

### 1. Migration
**File**: `server/migrations/20260716000000_create_ai_training_documents.js`

Create table + index on embedding for pgvector search.

### 2. Service
**File**: `server/services/trainingDocs.js`

| Function | Description |
|----------|-------------|
| `parsePdf(buffer)` | Extract text from PDF using `pdf-parse` |
| `parseDocx(buffer)` | Extract text from DOCX using `mammoth` |
| `parseTxt(buffer)` | Read plain text |
| `parseLink(url)` | Fetch URL content with `fetch()`, strip HTML tags |
| `chunkText(text, size=1000)` | Split text into overlapping chunks |
| `saveDocument({title, fileType, content, category, tags, userId})` | Save to DB |
| `generateDocEmbedding(docId, embedFn)` | Embed content, store vector |
| `searchTrainingDocs(query, embedFn, limit=5)` | Semantic search via pgvector |
| `getDocuments({category, status})` | List all docs |
| `getDocument(id)` | Get single doc with content |
| `deleteDocument(id)` | Delete doc + file |
| `reprocessDocument(id, embedFn)` | Re-parse and re-embed |

### 3. Routes
**File**: `server/routes/aiRoutes.js` (append)

```
POST   /api/ai/training/upload    -- upload file (multipart)
POST   /api/ai/training/link      -- add URL link
GET    /api/ai/training           -- list documents
GET    /api/ai/training/:id       -- get document detail
DELETE /api/ai/training/:id       -- delete document
POST   /api/ai/training/:id/reprocess -- re-embed
```

### 4. AI Agent Integration
**File**: `server/services/aiAgent.js`

- Add tool `search_training_docs(query)` in `buildTools()`
- When user asks about regulations/procedures, search training docs first
- Inject top 3 relevant chunks into system prompt as `[TRAINING CONTEXT]`
- Tool description: "Search training documents for tax regulations, accounting standards, and procedures"

---

## Frontend Components

### 1. MasterData.jsx Changes

Add `training` to tabs array:
```js
tabs: { users, roles, departments, flows, logs, ai, training }
```

New state variables:
```js
const [trainingDocs, setTrainingDocs] = useState([]);
const [trainingLoading, setTrainingLoading] = useState(false);
const [trainingUpload, setTrainingUpload] = useState(null);
const [trainingForm, setTrainingForm] = useState({ title: '', category: 'tax_regulation', tags: '' });
const [showTrainingForm, setShowTrainingForm] = useState(false);
const [trainingLink, setTrainingLink] = useState('');
```

### 2. Training Tab UI

```
┌──────────────────────────────────────────────────────────────────┐
│                    TRAINING AI TAB                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Upload File  │  │ Add Link    │  │ Category    │             │
│  │ (PDF/DOCX)  │  │ (URL)       │  │ Filter      │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Document List                                            │   │
│  ├──────┬──────────┬──────────┬──────────┬──────────┬───────┤   │
│  │ #    │ Title    │ Type     │ Category │ Status   │ Action│   │
│  ├──────┼──────────┼──────────┼──────────┼──────────┼───────┤   │
│  │ 1    │ PPn ...  │ PDF      │ Tax      │ Active   │ 🗑️ 👁️│   │
│  │ 2    │ SPT ...  │ DOCX     │ Tax      │ Active   │ 🗑️ 👁️│   │
│  │ 3    │ UU ...   │ Link     │ Reg      │ Active   │ 🗑️ 👁️│   │
│  └──────┴──────────┴──────────┴──────────┴──────────┴───────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Upload Form Modal

```
┌────────────────────────────────────────────────┐
│  Upload Dokumen Training                        │
├────────────────────────────────────────────────┤
│  Title: [________________________]             │
│  Category: [Tax Regulation ▼]                  │
│  Tags: [________________________]              │
│  File: [Choose File...]  or  [Paste URL]      │
│                                                │
│  [Cancel]                    [Upload & Process]│
└────────────────────────────────────────────────┘
```

### 4. Preview Modal

Shows document content with search highlights.

---

## File Upload Flow

```
1. User selects file or pastes link
2. Frontend sends to POST /api/ai/training/upload (multipart) or /link
3. Backend saves file to server/uploads/training/
4. Backend parses content (PDF→text, DOCX→text, TXT→direct, Link→fetch)
5. Backend splits into chunks (1000 chars each, 200 char overlap)
6. Backend generates embeddings for each chunk
7. Backend saves to ai_training_documents table
8. Status changes: processing → active
9. Frontend refreshes list
```

---

## AI Agent Integration

When user asks a question:
1. `search_training_docs(query)` tool searches training documents
2. If relevant chunks found, inject into system prompt:
   ```
   [TRAINING CONTEXT - from uploaded documents]
   1. [PPN Regulation 2024] Pajak Pertambahan Nilai...
   2. [SPT Guide] Cara pengisian SPT...
   ```
3. LLM uses this context to answer accurately

---

## Implementation Order

1. Create migration `20260716000000_create_ai_training_documents.js`
2. Create `server/services/trainingDocs.js`
3. Add routes to `server/routes/aiRoutes.js`
4. Modify `server/services/aiAgent.js` (add training doc search tool)
5. Add UI tab in `src/pages/MasterData.jsx`
6. Add upload form + document list + preview modal
7. Verify build
8. Push to GitHub

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `server/migrations/20260716000000_create_ai_training_documents.js` | CREATE |
| `server/services/trainingDocs.js` | CREATE |
| `server/routes/aiRoutes.js` | MODIFY (add training routes) |
| `server/services/aiAgent.js` | MODIFY (add training tool) |
| `src/pages/MasterData.jsx` | MODIFY (add training tab) |

---

## Dependencies

Already installed:
- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX text extraction
- `pgvector` - semantic search

No new dependencies needed.

---

## Estimated Token Cost

- Training doc search adds ~500 tokens per query (if docs found)
- Minimal impact on existing token budget
- Cache hit still works for repeated questions

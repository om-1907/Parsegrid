# Parsegrid — Project Status & Handoff

> **Purpose of this file:** a single place to understand where the project is so a
> fresh chat (or a new contributor) can pick up without re-reading everything.
> Last updated: **2026-07-04**. Keep this current when you finish a chunk of work.

---

## 1. What this project is

**Parsegrid** is a full-stack **AI contract-intelligence** app. You upload a contract
(PDF / DOCX / TXT / MD / CSV / HTML), an LLM extracts key structured fields, and any
low-confidence extraction is routed to a human reviewer. Inspired by Ironclad / Evisort.

- **Extracted fields:** party name, contract value, payment terms (days), penalty
  clause (bool), governing law.
- **Human-in-the-loop:** fields below a confidence threshold flag the doc `needs_review`;
  operator corrections are written to an immutable **audit log**.
- **Async pipeline:** upload returns `202 Accepted` immediately; extraction runs in a
  background task so the API stays responsive.
- **SHA-256 dedup:** identical files are detected and never re-processed.
- **Auth:** JWT in an HttpOnly cookie protects every document endpoint.

Full product README (features, architecture diagram, setup): [`README.md`](./README.md).

---

## 2. Tech stack

| Layer     | Tech |
|-----------|------|
| Backend   | FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2 |
| AI        | LiteLLM → Gemini 2.5 Flash (structured output) |
| Database  | PostgreSQL (Supabase) |
| Auth      | PyJWT + bcrypt, HttpOnly cookies |
| Parsing   | PyMuPDF (PDF), python-docx (DOCX), BeautifulSoup (HTML) |
| Frontend  | **Next.js 16 (App Router)**, React 19, TypeScript, Tailwind **v4**, shadcn/ui |
| 3D/UI     | three + @react-three/fiber + drei (WebGL hero), sonner (toasts), lucide-react |

---

## 3. Repo layout

```
Project1/
├── main.py                  # FastAPI app: lifespan, CORS, router wiring, create_all() on startup
├── config.py                # Pydantic settings (env: GEMINI_API_KEY, DATABASE_URL, JWT_SECRET_KEY, ...)
├── requirements.txt
├── .env / .env.example      # backend secrets
├── api/
│   ├── routes.py            # /api/v1 document endpoints (upload, status, query, review, file)
│   └── auth.py              # /api/v1/auth register/login/logout/me, JWT + get_current_user dep
├── models/
│   ├── database.py          # async engine, Base, Document + ExtractedData ORM models
│   ├── schemas.py           # Pydantic schemas
│   └── user.py              # User ORM model
├── services/
│   ├── document_reader.py   # dispatch to the right reader by extension
│   ├── pdf_reader.py        # PDF text + generate_file_hash (SHA-256)
│   ├── llm_extractor.py     # LiteLLM → Gemini structured extraction
│   ├── worker.py            # process_document_pipeline (the async extraction flow)
│   └── audit.py             # write_audit_entry (immutable override log)
├── storage/                 # uploaded files on disk, named <uuid>.<ext>
└── frontend/                # Next.js app (see §5)
```

---

## 4. Backend API (all `/api/v1`, auth required except register/login)

| Method | Endpoint                          | Purpose |
|--------|-----------------------------------|---------|
| POST   | `/auth/register`                  | create account |
| POST   | `/auth/login`                     | login, sets HttpOnly cookie |
| POST   | `/auth/logout`                    | logout |
| GET    | `/auth/me`                        | current user |
| POST   | `/upload`                         | upload doc → `202`, dedup by hash, queues background extraction |
| POST   | `/global-search`                  | RAG semantic search using pgvector and strict tenant isolation |
| GET    | `/status/{doc_id}`                | poll processing status |
| GET    | `/documents/{doc_id}/file`        | preview/download original (PDF inline; others → HTML preview) |
| GET    | `/query`                          | filter extracted data (`min_value`, `max_payment_days`, `requires_review`, `governing_law`) |
| PATCH  | `/review/{doc_id}`                | operator correction (RBAC protected: Manager/Admin only); flips `needs_review=false`; writes audit entry |

- Allowed upload types: `.pdf .docx .txt .md .csv .html .htm`. Max size **25 MB**.
- CORS is hard-coded to `http://localhost:3000` in `main.py`. Uvicorn must be started with `--host 0.0.0.0` to avoid Node.js IPv6 `::1` fetch issues.

---

## 5. Frontend (`frontend/`)

- **App Router pages:** `src/app/page.tsx` (landing), `src/app/login/page.tsx`,
  `src/app/dashboard/` (layout + page, the authed workspace).
- **Key components:**
  - `src/components/landing/` — `LandingNav`, `HeroCanvas` (WebGL) + `HeroCanvasLazy`,
    `Reveal`, `CountUp`.
  - `src/components/dashboard/` — `AppHeader`, `StatsOverview`.
  - Workspace pieces — `DocumentUploader`, `ProcessingQueue`, `ExtractedDataTable`,
    `ReviewDrawer`, `ProtectedRoute`.
  - `src/components/ui/` — shadcn primitives.
  - `src/components/VerifAILogo.tsx` — **the new brand logo** (see §6).
- **Libs:** `src/lib/api.ts` (`apiFetch`, `apiUrl` — backend base from `NEXT_PUBLIC_API_URL`),
  `src/lib/contracts.ts` (shared `ExtractedData` type, `computeStats`, `formatCurrency`,
  confidence helpers).
- **Config:** backend URL via `frontend/.env.example` → copy to `.env.local`.

### ⚠️ Next.js version caveat (read before writing frontend code)
`frontend/AGENTS.md` warns this is a **customized Next.js 16** with breaking changes vs.
training data. **Read the relevant guide in `frontend/node_modules/next/dist/docs/`
before writing Next.js code**, and heed deprecation notices.

---

## 6. ⭐ Current in-progress work — RAG, RBAC, and CORS fixes

> **2026-07-04 fix pass (post-Antigravity):** the "Network error / Is the backend
> running?" on sign-in was **two real backend bugs**, now fixed:
> 1. **`users.role` column never existed.** Antigravity added `role` to the `User`
>    model + wrote `migrate_rbac.py`, but the migration was never run — *and* its
>    existence check wasn't scoped to `table_schema='public'`, so on Supabase it
>    matched `auth.users.role` and silently no-opped forever. Fixed the check +
>    `ALTER TABLE public.users`, ran it. Login/register/`/me`/RBAC all verified.
> 2. **`rag_engine.py` referenced `settings.llm_model`**, which didn't exist in
>    `config.py` → global-search would `AttributeError` on every query. Added
>    `llm_model` + `embedding_model` settings and pass `api_key` explicitly.
> 3. **DB engine had no `pool_pre_ping`** → first request after the Supabase pooler
>    dropped an idle connection 500'd with "connection is closed". Added
>    `pool_pre_ping=True` + `pool_recycle=300` in `models/database.py`.
>
> **Migrations that must be run once on a fresh DB** (order-independent, all idempotent):
> `python migrate_session_version.py && python migrate_rbac.py && python migrate_rag.py`
>
> Also redesigned the **`/login` and `/forgot-password`** pages to a full-page
> video background (reusing `FixedVideoBg`) with a frosted-glass card, and removed
> the purple glow under the landing final-CTA.

We have recently completed a major security and functionality overhaul:

1. **RAG Engine & Global Search**:
   - Upgraded `ExtractedContract` to include `_source_quote` fields to capture verbatim text chunks.
   - Added `pgvector` to PostgreSQL and created a `document_chunks` table for tenant-isolated embeddings.
   - Built the `POST /api/v1/global-search` endpoint for secure vector search.
   - Built the frontend `GlobalSearchBar` which sanitizes all LLM outputs using `DOMPurify` to prevent XSS.

2. **RBAC (Role-Based Access Control)**:
   - Added a `role` column to the `User` model.
   - Protected the `PATCH /api/v1/review/{doc_id}` endpoint so only `Manager` and `Admin` roles can access it.
   - Updated the frontend `ReviewDrawer` to gracefully catch `403 Forbidden` errors.

3. **IPv6 / Next.js Fetch Fix**:
   - Resolved a persistent "Is the backend running?" network error caused by Next.js resolving `localhost` to IPv6 (`::1`), while Uvicorn defaulted to IPv4 (`127.0.0.1`).
   - Fixed by keeping `NEXT_PUBLIC_API_URL` as `http://localhost:8000` and explicitly starting Uvicorn with `--host 0.0.0.0` so it listens on both protocols and satisfies CORS.

---

## 7. How to run

**Backend** (from repo root):
```bash
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env          # fill GEMINI_API_KEY, DATABASE_URL, JWT_SECRET_KEY
uvicorn main:app --reload --port 8000     # docs at http://localhost:8000/docs
```
Tables auto-create on startup (`create_all`). Env is validated by `config.py` at boot.

**Frontend:**
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```

---

## 8. Known next steps / roadmap

- **Persist per-field confidence scores** to the DB. The UI already renders confidence
  bars when a `confidence` map is present (`ConfidenceMap` in `lib/contracts.ts`); the
  backend just needs to store + return it.
- Replace startup `create_all()` with **Alembic** migrations.
- Add pagination to `/query` (frontend currently does client-side search).
- Add `pytest` tests for hashing, the review validator, and the upload path.
- Before deploy: widen/parametrize **CORS** (currently `localhost:3000` only) and confirm
  cookies are `Secure` in production (`ENVIRONMENT=production`).

---

## 9. Environment variables

**Backend** (`.env`, see `.env.example`): `GEMINI_API_KEY`, `DATABASE_URL`
(`postgresql+asyncpg://...`), `JWT_SECRET_KEY` (required); `ENVIRONMENT`, `DEBUG`,
`DB_SSL_INSECURE` (optional — the last skips CA/hostname verification for the Supabase
pooler / TLS-intercepting AV; leave `false` in prod).

**Frontend** (`.env.local`, see `frontend/.env.example`): `NEXT_PUBLIC_API_URL`
(default `http://localhost:8000`).

---

## 10. Immediate next action for a fresh chat

1. Start the Uvicorn backend with `--host 0.0.0.0` (avoids the IPv6/`::1` issue).
2. On any **fresh database**, run the three idempotent migrations before first login
   (see §6): `migrate_session_version.py`, `migrate_rbac.py`, `migrate_rag.py`.
   Skipping `migrate_rbac.py` reproduces the `users.role does not exist` login 500.
3. Test RAG vector search end-to-end via `GlobalSearchBar` (needs at least one
   uploaded+processed document so `document_chunks` is populated).
4. Commit the 2026-07-04 fix pass (RBAC migration fix, RAG config, DB pool_pre_ping,
   login/forgot-password redesign, landing purple removal).

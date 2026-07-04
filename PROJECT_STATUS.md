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
| GET    | `/status/{doc_id}`                | poll processing status |
| GET    | `/documents/{doc_id}/file`        | preview/download original (PDF inline; others → HTML preview) |
| GET    | `/query`                          | filter extracted data (`min_value`, `max_payment_days`, `requires_review`) |
| PATCH  | `/review/{doc_id}`                | operator correction; flips `needs_review=false`; writes audit entry |

- Allowed upload types: `.pdf .docx .txt .md .csv .html .htm`. Max size **25 MB**.
- CORS is hard-coded to `http://localhost:3000` in `main.py` — **update before deploy.**

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

## 6. ⭐ Current in-progress work — logo swap (UNCOMMITTED)

The user provided a new logo and asked to **"put it instead of just P"** — i.e. replace the
old placeholder logo (a gradient square with the letter **"P"** + the word "Parsegrid")
with the new SVG logo everywhere it appeared.

**Done (working tree, not yet committed):** `VerifAILogo.tsx` was created and swapped in at:
- `src/app/page.tsx` (footer)
- `src/app/login/page.tsx` (2 spots: side panel + mobile)
- `src/components/dashboard/AppHeader.tsx`
- `src/components/landing/LandingNav.tsx`
- `src/components/landing/HeroCanvas.tsx` — minor unrelated tweak (removed a bottom
  gradient fade div).

Uncommitted files: 5 modified + 1 new (`VerifAILogo.tsx`). Run `git diff` to review.

### 🔴 OPEN ISSUE — brand-name mismatch (needs a decision)
The new component is named **`VerifAILogo`** and its wordmark renders **"VerifAI Ledger"**,
but the product is **Parsegrid** everywhere else (README, landing copy, `.env` comments).
The swap therefore **replaced the "Parsegrid" text with "VerifAI Ledger" text.**

Decide one of:
1. **Keep the name Parsegrid** → change the wordmark in `VerifAILogo.tsx` (line ~26) from
   `Verif<span>AI</span> Ledger` to `Parsegrid`, and consider renaming the file/component
   to `ParsegridLogo` for clarity.
2. **Rebrand to VerifAI Ledger** → update README, landing/marketing copy, `.env` comments,
   page `<title>`/metadata, and `frontend/.env.example` accordingly.

Until this is resolved the UI shows one name and the docs/copy show another.

The logo SVG itself is a shield (indigo `#6366F1` stroke) with an amber (`#F59E0B`)
chevron + dot. `className` sizes the icon; `textClassName` colors the wordmark (used to
make it white over dark hero/nav backgrounds).

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

1. Resolve the **Parsegrid vs. VerifAI Ledger** naming decision (§6).
2. Review + commit the uncommitted logo swap once the wordmark is correct.
3. Verify the logo renders well in both light/dark mode and over the dark hero/nav.

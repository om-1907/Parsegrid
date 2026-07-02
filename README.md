# Parsegrid — AI Contract Intelligence

Parsegrid is a full-stack application that ingests contracts (PDF, DOCX, TXT, MD, CSV, HTML),
extracts key structured fields using an LLM, and routes low-confidence results to a human
reviewer. It is inspired by contract-intelligence platforms like Ironclad and Evisort.

Every extracted field carries a **confidence score**; if any field falls below a threshold,
the document is automatically flagged `needs_review` so an operator can correct it. All manual
overrides are recorded in an immutable **audit log**.

---

## Features

- **Multi-format ingestion** — PDF (PyMuPDF), DOCX (python-docx), TXT/MD/CSV, and HTML (BeautifulSoup).
- **Structured LLM extraction** — Gemini 2.5 Flash via LiteLLM, with Pydantic-enforced output
  (party name, contract value, payment terms, penalty clause, governing law).
- **Confidence-driven human review** — per-field confidence scores auto-flag uncertain extractions.
- **Async processing pipeline** — uploads return immediately (`202 Accepted`); extraction runs in
  the background so the API stays responsive.
- **SHA-256 deduplication** — identical files are detected and never re-processed (saving API cost).
- **JWT authentication** — HttpOnly-cookie sessions protect every document endpoint.
- **Audit logging** — manual overrides are logged in an isolated transaction for compliance.
- **Modern UI** — Next.js (App Router) + Tailwind + shadcn/ui: upload, live processing status,
  results table, and a review drawer.

---

## Architecture

```
┌──────────────┐        ┌──────────────────────────────────────────┐
│  Next.js UI  │  HTTP  │              FastAPI backend               │
│  (frontend)  │ ─────► │                                            │
└──────────────┘        │  api/        routes + JWT auth             │
                        │  services/   readers, LLM extractor,       │
                        │              worker pipeline, audit        │
                        │  models/     SQLAlchemy ORM + Pydantic     │
                        └───────────────┬───────────────┬────────────┘
                                        │               │
                                  ┌─────▼─────┐   ┌──────▼──────┐
                                  │ Postgres  │   │ Gemini LLM  │
                                  │(Supabase) │   │ (LiteLLM)   │
                                  └───────────┘   └─────────────┘
```

**Upload flow:** `upload → hash & dedup check → save to storage → 202 + background task →
extract text → LLM structured extraction → persist + set status → available in results table`.

---

## Tech stack

| Layer     | Technology                                                        |
|-----------|-------------------------------------------------------------------|
| Backend   | FastAPI, SQLAlchemy 2.0 (async), asyncpg, Pydantic v2             |
| AI        | LiteLLM → Gemini 2.5 Flash (structured output)                    |
| Database  | PostgreSQL (Supabase)                                             |
| Auth      | JWT (PyJWT) + bcrypt, HttpOnly cookies                            |
| Parsing   | PyMuPDF, python-docx, BeautifulSoup                               |
| Frontend  | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui         |

---

## Getting started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A PostgreSQL database (e.g. Supabase) and a Google Gemini API key

### 1. Backend

```bash
# from the project root
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# configure environment
cp .env.example .env               # then edit .env with real values
# generate a JWT secret:
python -c "import secrets; print(secrets.token_urlsafe(48))"

# run (tables are auto-created on startup)
uvicorn main:app --reload --port 8000
```

API docs are then available at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:3000
```

Register an account on the login page, then upload a contract from the dashboard.

---

## Environment variables

See [`.env.example`](./.env.example). Required: `GEMINI_API_KEY`, `DATABASE_URL`,
`JWT_SECRET_KEY`. Optional: `ENVIRONMENT`, `DEBUG`.

---

## API overview

All `/api/v1` document endpoints require authentication (JWT cookie or `Bearer` token).

| Method | Endpoint                          | Description                                  |
|--------|-----------------------------------|----------------------------------------------|
| POST   | `/api/v1/auth/register`           | Create an account                            |
| POST   | `/api/v1/auth/login`              | Log in (sets HttpOnly cookie)                |
| POST   | `/api/v1/auth/logout`             | Log out                                      |
| GET    | `/api/v1/auth/me`                 | Current user                                 |
| POST   | `/api/v1/upload`                  | Upload a document (async processing)         |
| GET    | `/api/v1/status/{doc_id}`         | Poll processing status                       |
| GET    | `/api/v1/documents/{doc_id}/file` | Preview / download the original file         |
| GET    | `/api/v1/query`                   | Filter extracted data (value, terms, review) |
| PATCH  | `/api/v1/review/{doc_id}`         | Manually correct fields (audited)            |

---

## Roadmap / known next steps

- **Persist per-field confidence scores** to the database. The review UI and results
  table already render confidence bars when a `confidence` map is present on extracted
  data — the backend just needs to store and return it.
- Replace `create_all()` on startup with **Alembic** migrations.
- Add pagination to `/query` (the frontend already does client-side search over results).
- Add automated tests (`pytest`) for hashing, the review validator, and the upload path.

### Recently shipped (frontend overhaul)

- Rebuilt landing, login, and dashboard with a cohesive design system, dark mode, and a
  WebGL hero (`three` / `@react-three/fiber`).
- Fixed Tailwind v4 theming (design tokens via `@theme`), so shadcn components render fully.
- Backend URL is configurable via `NEXT_PUBLIC_API_URL` (see `frontend/.env.example`).
- Dashboard analytics (stat cards + review-status donut), global search, toast
  notifications, a user menu with logout, and a confidence-score UI.

---

## License

See [LICENSE](./LICENSE).

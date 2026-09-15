# AI-Assisted Placement & Skill-Gap Tracker + Job Posting Portal

A MERN application for college placement cells and students:

1. **Skill-Gap Tracker** — students upload a resume (+ GitHub profile); AI extracts demonstrated skills with evidence; skills are matched against a role's skill ontology via embedding similarity; a deterministic Role-Readiness Score and a prioritized study plan are produced; re-uploads over time track progress.
2. **Job Posting Portal** — a shared job board where students (job seekers) search and filter postings by skills, experience, and city, and admins create, edit, and delete job postings.

## Features

**Placement tracker**

- JWT authentication with bcrypt-hashed passwords (`student` / `admin` roles)
- PDF resume upload with magic-byte validation, 5 MB cap, server-generated filenames
- Bounded GitHub profile collection (10 newest repos, 800-char README excerpts, 24 h cache)
- Gemini skill extraction with per-skill evidence and schema-validated output
- Deterministic readiness scoring: `score = 100 × Σ(wᵢ·mᵢ) / Σwᵢ` (Gemini never decides the score)
- Gap analysis with a prioritized study plan built from a curated, human-verified resource catalog
- Async analysis jobs with idempotency, cooldown, and lifecycle status (`queued → processing → completed/failed`)
- Report history, score-trend chart, and per-item study-plan tracking
- Admin-only endpoints for viewing any user's reports

**Job portal**

- Shared login for students and admins (same auth system, no separate accounts)
- `GET /api/jobs` — authenticated search by skills (ANY-match), experience, and city, with pagination
- Admin-only `POST /api/jobs`, `PUT /api/jobs/:id`, `DELETE /api/jobs/:id`
- React pages for job search (filters, results, pagination) and admin job management (create/edit/delete with confirmation)

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js 24, Express 5 (plain ESM JavaScript), Mongoose 9 |
| Database | MongoDB 7 (Docker locally, Atlas for production) |
| Frontend | React 19, Vite 8, React Router 7, Recharts, Axios |
| Auth | JWT (`jsonwebtoken`) + `bcrypt` |
| Validation | Zod |
| AI | Google Gemini — `gemini-3.5-flash` (extraction), `gemini-embedding-2` (embeddings) |
| Uploads | `multer` + `file-type` (magic-byte checks), `pdf-parse` |
| Tests | Vitest + Supertest (backend) |
| Rate limiting | `express-rate-limit` |

## Repository structure

```
backend/    Express API — routes, controllers, services, Mongoose models, seed scripts, tests
frontend/   React app — pages, components, AuthContext, Axios client, CSS design system
docs/       API reference, schema, setup guide, development log, audits
```

## Quick start

### Prerequisites

- Node.js 20+ (built on v24)
- Docker (for local MongoDB)
- A Google AI (Gemini) API key (for resume skill extraction)
- Optional: a GitHub token for higher GitHub API rate limits

### 1. MongoDB

```bash
docker compose up -d mongo        # mongo:7 on localhost:27017
```

### 2. Backend

```bash
cd backend
cp .env.example .env              # fill in real values
npm install
npm run seed                      # embed skill ontology + load the resource catalog
node scripts/server.js start      # API on http://localhost:5000 (or: npm run dev)
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                       # Vite on http://localhost:5173, proxies /api → :5000
```

Open http://localhost:5173, register, and use the app.

### 4. Tests

```bash
cd backend
npx vitest run                    # requires the Dockerized MongoDB
```

## Environment variables

Backend (`backend/.env`, never committed — see `backend/.env.example`):

```
NODE_ENV, PORT, MONGO_URI, JWT_SECRET, JWT_EXPIRES_IN,
GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODELS,
EMBEDDING_MODEL, EMBEDDING_VERSION, GITHUB_TOKEN
```

Frontend: no variables required for local development (Vite proxies `/api`).

## Roles

| Role | Description | Capabilities |
|---|---|---|
| `student` | Job seeker / placement student | Upload resumes, run analyses, view reports, search jobs |
| `admin` | Placement cell administrator | Everything a student can do, plus view any user's reports and manage job postings |

Public registration always creates a `student`. Privileged roles are never self-assignable; admins are created or promoted with an explicit CLI script:

```bash
# promote an existing account
node scripts/create-admin.js admin@example.com

# create a new admin (password via env so it never lands in shell history or logs)
ADMIN_PASSWORD='...' node scripts/create-admin.js admin@example.com --name "Placement Admin"
```

Optional demo data (development only, idempotent, requires an existing admin):

```bash
node scripts/seed-jobs.js --admin=admin@example.com
```

## API overview

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness check (canonical shape) |
| POST | `/api/auth/register` | Public | Create a student account |
| POST | `/api/auth/login` | Public | Obtain a JWT |
| POST | `/api/profile` | Student | Upload resume + GitHub + target role |
| GET | `/api/profile/:id` | Owner/Admin | Submission + extracted skills (no raw resume text) |
| DELETE | `/api/profile/:id` | Owner/Admin | Delete submission, file, and related reports |
| POST | `/api/analyze` | Owner | Queue the analysis pipeline (idempotent, cooldown) |
| GET | `/api/analyze/:id/status` | Owner/Admin | Poll job status |
| GET | `/api/report/:id` | Owner/Admin | Readiness report (score, gaps, study plan) |
| PATCH | `/api/report/:id/study-plan/:itemId` | Owner | Toggle a study-plan item |
| GET | `/api/report/history` | Student | Own report history |
| GET | `/api/users/:userId/reports` | Admin | Any user's report history |
| GET | `/api/roles` | Authenticated | Available target roles (live from the skill ontology) |
| GET | `/api/jobs` | Authenticated | Search jobs (skills, experience, city, pagination) |
| POST | `/api/jobs` | Admin | Create a job posting |
| PUT | `/api/jobs/:id` | Admin | Update a job posting |
| DELETE | `/api/jobs/:id` | Admin | Delete a job posting |

Full request/response details: `docs/API.md`. Data models: `docs/SCHEMA.md`.

## Documentation

- `docs/SETUP.md` — setup, scripts, admin creation, deployment notes
- `docs/API.md` — endpoint reference
- `docs/SCHEMA.md` — MongoDB schemas and indexes
- `docs/DEVELOPMENT.md` — development log, decisions, incident history
- `docs/JOB_PORTAL_INTEGRATION_AUDIT.md` — job portal integration audit
- `EXECUTION_PLAN.md` — original build specification

## Security notes

- Secrets live only in `.env` (gitignored); `.env.example` ships with blank values.
- Uploads are magic-byte validated, size-capped, and stored outside any web-served directory.
- Resume text is treated as sensitive: never returned in full by the API, never logged.
- Every owner-scoped route enforces ownership or admin role server-side.
- Auth and analysis endpoints are rate-limited.

# Quick setup on Windows, macOS and Linux

Use Node.js 22.x (at least 22.12), npm and MongoDB, matching the backend engine. On Windows use PowerShell or Command Prompt; WSL is not required. Docker Desktop should use Linux containers for the supplied MongoDB container.

From the project folder:

```powershell
npm run setup
npm run install:all
docker compose up -d mongo
```

Edit `backend/.env` in your editor, then run:

```powershell
npm --prefix backend run seed
npm run dev
```

`npm run setup` preserves an existing `.env`. `npm run dev` starts both servers using Node and works with paths containing spaces. Stop with Ctrl+C. Open **http://localhost:5173**; Vite prefers port 5173 and uses the next available port when occupied; open the URL printed by Vite. Never open `frontend/index.html` or downloaded app pages with `file://`.

Required AI configuration:

```dotenv
AI_TEXT_PROVIDER=groq
AI_EMBEDDING_PROVIDER=gemini
AI_TEXT_FALLBACK_PROVIDER=none
GROQ_API_KEY=your-private-key
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODELS=openai/gpt-oss-20b,qwen/qwen3.8-27b
GEMINI_API_KEY=your-private-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_VERSION=2026-09
```

Also set MONGO_URI and a strong JWT_SECRET. Provider credentials stay in the backend. Text fallback to Gemini is opt-in (`AI_TEXT_FALLBACK_PROVIDER=gemini`, plus GEMINI_MODEL). Inference validates model availability at runtime and returns a distinct configuration/model error. The embedding model is unchanged; changing it requires re-embedding the ontology and updating the drift baseline. Existing completed reports are preserved.

Checks on either platform:

```powershell
npm test
npm run lint
npm run build
```

Backend integration tests require local MongoDB. Every test run creates a unique `vortex_test_<random UUID>` database, refuses remote or authenticated test endpoints, and deletes only its own database during teardown. Resume test files use a temporary directory. Normal tests mock GitHub, LeetCode, text AI and embeddings; they do not consume provider quota. `npm --prefix backend run test:unit` does not require MongoDB. If PowerShell blocks `npm.ps1`, invoke the same commands with `npm.cmd`; no execution-policy change is required. Dependencies must be installed on the target operating system: do not copy Linux `node_modules` to Windows. Native Windows execution has not been tested in this Linux workspace.

---

# Setup Guide

## Prerequisites

- Node.js 22.x, at least 22.12
- Docker (for local MongoDB) — `mongo:7`
- A Groq API key — covers text generation for extraction and the assistant (`openai/gpt-oss-120b` by default).
- A Google AI (Gemini) API key for embeddings (`gemini-embedding-2`). Groq does not provide an embeddings endpoint. Note: `text-embedding-004` is retired; `gemini-embedding-2` is the pinned model, tagged `2026-09`.
- Optional: a GitHub fine-grained PAT for the higher rate-limit tier (public-data read is enough).

## 1. MongoDB

```bash
docker compose up -d mongo
```

Local URI: `mongodb://127.0.0.1:27017/placement_skill_gap`.

## 2. Backend

```bash
cd backend
cp .env.example .env      # then fill in real values
npm install
npm run seed              # embeds the skill ontology + loads the resource catalog
npm run dev               # API on :5000 (or: npm start)
```

On PowerShell use `Copy-Item .env.example .env` in place of `cp`. The root workflow at the top of this guide is recommended when you want one command to start both servers.

Server control script (recommended for demos): `node scripts/server.js start|stop` (pidfile + `server.log`).

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | |
| `JWT_SECRET` | yes | |
| `GROQ_API_KEY` | for AI text features | Used for extraction and assistant responses; keep it in `.env` only |
| `GROQ_MODEL` | no | default `openai/gpt-oss-120b` |
| `GROQ_FALLBACK_MODELS` | no | comma-separated, default `openai/gpt-oss-20b,qwen/qwen3.8-27b` |
| `GEMINI_API_KEY` | for AI embedding features | Used only for skill embeddings |
| `EMBEDDING_MODEL` | no | default `gemini-embedding-2` — pinned; changing requires re-seeding + new drift baseline |
| `EMBEDDING_VERSION` | no | default `2026-09` |
| `GITHUB_TOKEN` | no | authenticated GitHub calls (5,000 req/hr) |
| `PORT` | no | default 5000 |
| `JWT_EXPIRES_IN` | no | default `7d` |

## 3. Frontend

```bash
cd frontend
npm install
npm run dev               # Vite on :5173, proxies /api → :5000
```

If port 5173 is already in use, Vite selects the next available port. Use its printed URL, or stop the previous process with Ctrl+C to reuse 5173. Inspect the process before stopping anything on a shared port.

Open http://localhost:5173, register, upload a PDF resume (+ optional GitHub username, LinkedIn URL/user-provided summary, and LeetCode username), review extracted skills, then analyze to see the readiness score and study plan. LinkedIn is never scraped; LeetCode is an optional public-source enrichment.

## 4. Tests

The default test endpoint is `mongodb://127.0.0.1:27017`. To use a different local port, set `TEST_MONGO_URI` (its database name is replaced with a unique disposable name):

```bash
TEST_MONGO_URI=mongodb://127.0.0.1:32768 npm --prefix backend test
```

```powershell
$env:TEST_MONGO_URI = "mongodb://127.0.0.1:32768"
npm --prefix backend test
Remove-Item Env:TEST_MONGO_URI
```

Database-free tests: `npm --prefix backend run test:unit`. Do not set test variables to a production database.

```bash
npm --prefix backend test    # requires MongoDB
npm --prefix frontend test
npm run build
npm run lint
```

Opt-in regression tests (need a real `GEMINI_API_KEY` for embedding drift):

```bash
npm run drift-baseline    # records tests/fixtures/drift-baseline.json (only after model/library upgrades)
RUN_DRIFT_TEST=1 npx vitest run tests/drift.test.js
```

## 5. Admin operations

```bash
npm run refresh-ontology   # re-embed + upsert ontology from backend/ontology/*.json (edit weights there first)
npm run gen-resumes        # regenerate sample resumes under backend/sample-resumes/
```

Promote or create an admin (explicit CLI; never via public registration):

```bash
# promote an existing account
node scripts/create-admin.js you@example.com

# create a new admin — password via env so it never lands in shell history or logs
ADMIN_PASSWORD='...' node scripts/create-admin.js you@example.com --name "Placement Admin"
```

Release a stuck single-session lock (each account allows one active login; useful when a browser was closed without logging out):

```bash
node scripts/release-session.js you@example.com
```

Seed demo job postings (development/demo only, idempotent, requires an existing admin):

```bash
node scripts/seed-jobs.js --admin=you@example.com
```

## 6. Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the confirmed Cloudflare Pages frontend and Vercel API. The health endpoint checks liveness only. On Vercel, analysis executes inside the request with a shared 50-second work budget under this repository’s 60-second function configuration. It is not a durable queue. Resumes currently use ephemeral `/tmp` there; configure and implement a durable provider before claiming persistent resume downloads.

For a separate long-running host:

- Set `NODE_ENV=production`, strong `JWT_SECRET`, Atlas `MONGO_URI` (TLS).
- Terminate HTTPS + HSTS at the reverse proxy (nginx/Caddy/Cloudflare).
- Serve the built frontend (`npm run build` → `dist/`) from the proxy; the API must never serve `backend/storage/`.
- Run `npm audit` routinely.
- The async analysis job runs in-process (per the spec's MVP scope — no Bull/Redis). For horizontal scaling, move `queueAnalysis` behind a queue first.
### Adding or updating target roles

1. Edit role files under `backend/ontology/*.json` (one file per role), or draft new roles with `node scripts/draft-roles.js` (writes `ontology/drafts/new-roles-draft.json`).
2. If you used the draft flow, materialize the reviewed roles: `node scripts/import-role-drafts.js`.
3. `npm run seed` — embeds new skills and upserts the ontology. Roles appear automatically in the UI (`GET /api/roles`); no code change is needed.

## 7. Windows setup notes

The project uses Node ESM and cross-platform launch scripts. PowerShell commands are provided below; native Windows runtime verification has not been performed in this Linux workspace.

### Prerequisites

- **Node.js 22.x, at least 22.12** — from nodejs.org or via nvm-windows. Verify with `node --version`.
- **Docker Desktop for Windows** — must be running (WSL2 backend recommended) before `docker compose up -d mongo`.
- **Git for Windows** — for cloning and commits.
- Optionally **Visual Studio Build Tools** ("Desktop development with C++") + Python — only needed if a native module fails to build.

### Getting started (same commands, PowerShell)

```powershell
git clone https://github.com/maayav/Job-Posting-Portal.git
cd Job-Posting-Portal
docker compose up -d mongo          # requires Docker Desktop running

cd backend
Copy-Item .env.example .env         # fill in real values
npm install
npm run seed                        # embeds the skill ontology (uses GEMINI_API_KEY)
node scripts/server.js start        # API on :5000

cd ..\frontend
npm install
npm run dev                         # Vite on :5173, proxies /api -> :5000
```

### Windows-specific notes

- **Firewall:** when Windows Firewall prompts for Node.js, allow access on private networks — ports `5000` (API) and `5173` (Vite) must be reachable locally.
- **Line endings:** the repo ships `.gitattributes` (`* text=auto eol=lf`), so checkouts are normalized to LF. If you had an older checkout, run `git add --renormalize .` once.
- **bcrypt (native module):** `bcrypt` ships prebuilt binaries for Windows x64 — `npm install` normally works with no compiler. If you hit a `node-gyp` build error, install Visual Studio Build Tools + Python, then `npm rebuild bcrypt`. (Fallback without native modules: swap to `bcryptjs` in `backend/package.json` — the code only uses `bcrypt.hash`/`bcrypt.compare`.)
- **Long paths:** if `npm install` fails with path-length errors, run `git config --system core.longpaths true` (admin) and retry.
- **localhost resolution:** if the app can't reach Mongo or the API, prefer `127.0.0.1` over `localhost` in `MONGO_URI` and the Vite proxy (`vite.config.js`).
- **Env vars in PowerShell:** use `$env:ADMIN_PASSWORD='...'` instead of inline `ADMIN_PASSWORD=...` for `node scripts/create-admin.js`.
- **Stopping the API:** `node scripts/server.js stop` (the pidfile + log live in `backend/`; `.server.pid` is gitignored).
- **Tests and build:** from the repository root, `npm test` runs both suites, `npm run build` builds the frontend, and `npm run lint` runs the frontend linter. Backend tests require MongoDB.

### Seed demo applications

After demo jobs exist and an admin account is available:

```bash
node scripts/seed-applications.js --admin=admin@example.com
```

This is development/demo data only. It creates up to eight demo students and applications across the newest four jobs, covering every application status. It is safe to run repeatedly.

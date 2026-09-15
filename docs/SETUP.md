# Setup Guide

## Prerequisites

- Node.js ≥ 20 (built against v24)
- Docker (for local MongoDB) — `mongo:7`
- A Google AI (Gemini) API key — covers both extraction (`gemini-3.5-flash`) and embeddings (`gemini-embedding-2`). Note: `text-embedding-004` is retired; `gemini-embedding-2` is the pinned model, tagged `2026-09`.
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

Server control script (recommended for demos): `node scripts/server.js start|stop` (pidfile + `server.log`).

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | |
| `JWT_SECRET` | yes | |
| `GEMINI_API_KEY` | yes (non-test) | |
| `GEMINI_MODEL` | no | default `gemini-3.5-flash` — free-tier quota is per model (20 req/min), so overload/quota falls back to `GEMINI_FALLBACK_MODELS` |
| `GEMINI_FALLBACK_MODELS` | no | comma-separated, default `gemini-flash-lite-latest,gemini-3-flash-preview` |
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

Open http://localhost:5173, register, upload a PDF resume (+ optional GitHub username), review extracted skills, then analyze to see the readiness score and study plan.

## 4. Tests

```bash
cd backend
npx vitest run            # 34 tests against placement_skill_gap_test DB (dockerized Mongo must be up)
```

Opt-in regression tests (need a real `GEMINI_API_KEY`):

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

Seed demo job postings (development/demo only, idempotent, requires an existing admin):

```bash
node scripts/seed-jobs.js --admin=you@example.com
```

## 6. Production checklist (deployment)

- Set `NODE_ENV=production`, strong `JWT_SECRET`, Atlas `MONGO_URI` (TLS).
- Terminate HTTPS + HSTS at the reverse proxy (nginx/Caddy/Cloudflare).
- Serve the built frontend (`npm run build` → `dist/`) from the proxy; the API must never serve `backend/storage/`.
- Run `npm audit` routinely.
- The async analysis job runs in-process (per the spec's MVP scope — no Bull/Redis). For horizontal scaling, move `queueAnalysis` behind a queue first.
### Adding or updating target roles

1. Edit role files under `backend/ontology/*.json` (one file per role), or draft new roles with `node scripts/draft-roles.js` (writes `ontology/drafts/new-roles-draft.json`).
2. If you used the draft flow, materialize the reviewed roles: `node scripts/import-role-drafts.js`.
3. `npm run seed` — embeds new skills and upserts the ontology. Roles appear automatically in the UI (`GET /api/roles`); no code change is needed.

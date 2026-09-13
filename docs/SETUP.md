# Setup Guide

## Prerequisites

- Node.js ≥ 20 (built against v24)
- Docker (for local MongoDB) — `mongo:7`
- A Google AI (Gemini) API key — covers both extraction (`gemini-3.6-flash`) and embeddings (`gemini-embedding-2`). Note: `text-embedding-004` is retired; `gemini-embedding-2` is the pinned model, tagged `2026-09`.
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
| `GEMINI_MODEL` | no | default `gemini-3.6-flash` |
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

Promote a user to admin (no UI yet):

```bash
node --input-type=module -e "
const { connectDB } = await import('./src/config/db.js');
const { User } = await import('./src/models/user.js');
await connectDB({ retry: false });
await User.updateOne({ email: 'you@example.com' }, { \$set: { role: 'admin' } });
process.exit(0);"
```

## 6. Production checklist (deployment)

- Set `NODE_ENV=production`, strong `JWT_SECRET`, Atlas `MONGO_URI` (TLS).
- Terminate HTTPS + HSTS at the reverse proxy (nginx/Caddy/Cloudflare).
- Serve the built frontend (`npm run build` → `dist/`) from the proxy; the API must never serve `backend/storage/`.
- Run `npm audit` routinely.
- The async analysis job runs in-process (per the spec's MVP scope — no Bull/Redis). For horizontal scaling, move `queueAnalysis` behind a queue first.
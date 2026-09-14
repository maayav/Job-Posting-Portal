# Development Log

Living document tracking build progress against `EXECUTION_PLAN.md` (v7). Updated continuously as work proceeds.

**Last updated:** 2026-09-13

## Where we are

- Phase 1 (Foundation & Security) — **done**
- Phase 2 (Profile Ingestion) — **done**
- Phase 3 (AI Extraction) — **done**
- Phase 4 (Deterministic Scoring) — **done**
- Phase 5 (Report & Frontend) — **done**
- Phase 6 (Progress Tracking) — **done**
- Phase 8 (Hardening & Docs) — **done**
- Phase 7 (deferred features) — intentionally skipped

## Environment & setup

| Item | Value |
|---|---|
| Repo root | `/home/gman/dev/projects/pride_proj` (git, default branch `main`) |
| Backend | Node 24, Express 5, Mongoose 9, plain ESM JS, port **5000** |
| MongoDB | Docker `mongo:7` (`docker compose up -d mongo`), `mongodb://127.0.0.1:27017/placement_skill_gap` |
| Frontend | Vite + React (not yet scaffolded) |
| Gemini model | **`gemini-3.5-flash`** (extraction) — `gemini-2.5-flash` returns 404 for new users |
| Embedding model | `gemini-embedding-2`, version tag `2026-09` (spec pinned `text-embedding-004`, which is retired — see decisions) |
| GitHub | Authenticated fine-grained PAT (user `maayav`) |
| Server control | `node scripts/server.js start|stop` (pidfile + log at `backend/server.log`) |

## Decisions & deviations from the spec

1. **Embedding model swap:** spec pinned `text-embedding-004`, which no longer exists for this key. Using `gemini-embedding-2` with `embedding_version: "2026-09"` recorded on every stored vector. Drift regression test still required (Section 14).
2. **Generation model:** `gemini-2.5-flash` → `gemini-3.5-flash` (API returned 404 "no longer available to new users").
3. **Skill extraction runs at upload time** (`POST /api/profile`), not inside `/api/analyze`. This enables the "review extracted skills before scoring" screen (Phase 5 UX). `/api/analyze` reuses the cached `ExtractedSkillProfile` and only does embedding + deterministic scoring + study plan. Gemini quota is spent once per submission.
4. **Async jobs:** in-process fire-and-forget runner with in-Mongo lifecycle state (per spec — no Bull/Redis).
5. **pdf-parse v2** (`PDFParse` class) — ESM-native, used instead of v1.
6. **Tests:** Vitest + supertest against the dockerized Mongo (separate `test` DB) rather than Jest.

## Progress details

### Phase 1 — Foundation & Security (done, commit `bd70398`)
- `GET /api/health` returns exactly `{ status: "ok", timestamp }` (ISO-8601 UTC), no extra fields.
- Auth: register/login, bcrypt hashing (10 rounds), JWT (7d expiry), role `student`/`admin`.
- Rate limiting: auth (50/15min), analyze (10/min), global API (120/min).
- Upload pipeline: multer memory → magic-byte check (`file-type`) → server-generated random filename → saved outside public dir; 5 MB (5,242,880 B) cap; wrong-type / spoofed-extension / oversized all rejected (400/413).
- Env validation via zod at startup; `.env` gitignored, `.env.example` committed.
- Verified: register/login, duplicate email 409, bad login 401, validation errors, bad uploads rejected, ownership 403s, delete 204.

### Phase 2 — Profile Ingestion (done, commit `bd70398`)
- `ProfileSubmission` model: `resume_file_ref`, `resume_text` (sensitive), canonical `github_username`, `github_status`, `target_role` (SDE / ML Engineer), extraction status fields.
- `POST /api/profile`: saves PDF → pdf-parse text extraction → GitHub collection (best-effort) → creates submission.
- GitHub service (Section 8 bounds): ≤10 newest repos, 800-char README excerpt, languages/topics/manifests (`package.json`, `requirements.txt`), forks skipped, 24h per-username cache in Mongo, normalize URL→username, partial-results on failure (`github_status`).
- `GET /api/profile/:id` excludes full `resume_text`; `DELETE` removes file + cascades (submission, skill profile, reports).
- Ownership middleware on all profile routes — verified cross-user 403.
- 3 sample resumes generated (`backend/sample-resumes/`) for tests + demo.

### Phase 3 — AI Extraction (done, commit `0918e71`)
- `geminiService.js`: strict JSON extraction with zod schema validation, transient retry (3 attempts, 1s/2s/4s), malformed-JSON retry-once then `errorCode: extraction_invalid`; maps 404/500/429 → clean errorCodes (`service_unavailable` / `extraction_invalid`). Never logs resume text.
- `skillService.js`: builds bounded prompt input (resume + GitHub), dedups/merges skills, confidence by fixed rule (high = 2+ sources w/ evidence, medium = 1 source, low = bare keyword) — Gemini never decides confidence.
- `ExtractedSkillProfile` model (skills + sources + evidence, per submission, upsert).
- **Bug found & fixed:** `gemini-2.5-flash` returned 404 → switched to `gemini-3.5-flash`.
- Verified on 3 sample resumes: skills + evidence trace back to resume/GitHub; messy resume degraded to GitHub-only skills.

### Phase 4 — Deterministic Scoring (done, commit `c24e9da`)
- `SkillOntology` (31 skills: SDE + ML Engineer, weights, cached `gemini-embedding-2` vectors, version `2026-09`) + `ResourceCatalog` (37 curated verified resources) seeded via `scripts/seed-ontology.js`.
- `embeddingService.js`: bare-skill-name embedding (lowercase+trim), vector normalization, cosine similarity.
- `scoringService.js`: exact Section 6 formula `score = 100·Σ(wᵢ·mᵢ)/Σwᵢ`; thresholds 80/60 → strong/developing/gap; gap priority `wᵢ(1−mᵢ)` rescaled to [0,1]; study plan from `ResourceCatalog` exact normalized match; no fuzzy matching.
- `analysisService.js`: async in-process job (queued→processing→completed/failed), lifecycle logging (no resume/evidence in logs), graceful `errorCode`s.
- `POST /api/analyze`: partial-unique-index idempotency (duplicate → same report id + 202), 60s cooldown from `completedAt` → 429 fixed body, rate limited.
- `GET /api/analyze/:id/status`, `GET /api/report/:id` (owner/admin), `PATCH /api/report/:id/study-plan/:itemId` (owner).
- Verified: score determinism (same submission → 91 twice), gap breakdown + study plan with curated resources, cooldown 429, cross-user 403.
- **Bugs found & fixed:** `weight` lives inside `roles[]` (not skill root) → NaN score; gap entries missing required `priority` → failed report; NaN score hardened with finiteness guard; failure path now raw-updates status (avoids re-validating stale NaN fields).

## How to run

```bash
cd backend
docker compose up -d mongo          # from repo root
node scripts/server.js start        # API on :5000
node scripts/server.js stop
```

### Phase 5 — Report & Frontend (done, commit `c31f2cf`)
- Vite + React 19 + react-router + Recharts; Vite proxy `/api` → `:5000`.
- `AuthContext` (JWT in localStorage, 401 auto-logout), protected routes.
- Upload flow: PDF + GitHub + target role → skill review (evidence shown) → Analyze → polling → dashboard.
- Dashboard: score ring, strong/developing/gap chips, prioritized study plan with checkboxes wired to PATCH.
- Verified full journey through the proxy: register → upload → 18 skills extracted → analyze → score 90 (ML Engineer).

### Phase 6 — Progress Tracking (done, commit `e3ebb7e`)
- `GET /api/report/history` (own only, no userId in URL) and `GET /api/users/:userId/reports` (admin only) — mounted at `/api/users` per spec.
- Recharts score-trend line on the dashboard (renders with ≥2 completed reports).
- Verified: student2 sees empty history (isolation), non-admin gets 403 on the admin route, admin sees history.

### Phase 8 — Hardening & Docs (done)
- **Test suite:** 35 tests + 2 opt-in drift tests (`vitest`, supertest, dockerized Mongo test DB). Covers auth (hash/JWT/expiry), upload security (magic bytes/5MB/missing/spoofed), ownership + admin access, delete cascades file, GitHub degradation, scoring formula/thresholds/priority rescaling/exact-match resources, analyze idempotency (partial unique index), cooldown 429 fixed body, retry after failure, clean errorCodes.
- **Bugs found & fixed during testing:**
  - `global-setup.js` ran without the test env overrides and **dropped the dev database** — now sets `MONGO_URI` itself.
  - Rate limiter (10/min) tripped across tests — test mode uses a high limit.
  - Test-mode job runner made synchronous (`runAnalysis` awaited) for deterministic tests.
  - Ontology loader didn't merge shared skills across role files (Python lost its SDE role) — now merges roles by skill name.
- **Observability:** job lifecycle logged (`analysis_job` with report/submission ids, status, errorCode; no resume text/evidence). Gemini/GitHub failures logged with attempt count.
- **Drift regression:** `tests/drift.test.js` (opt-in via `RUN_DRIFT_TEST=1`) + `tests/fixtures/drift-baseline.json` (SDE 89, ML Engineer 91, tolerance ±2, model/version pinned). Regenerate with `npm run drift-baseline`.
- **Ops scripts:** `scripts/refresh-ontology.js` (edit weights in `ontology/*.json`, re-embed + upsert), `scripts/server.js` (start/stop), `npm audit` clean (0 vulnerabilities).
- **Docs:** `docs/API.md`, `docs/SETUP.md`, `docs/SCHEMA.md`.
- **Security checklist (Section 10):** rate limits ✓, secrets env-only ✓, zod validation everywhere ✓, upload hardening ✓, resume text never returned/logged ✓, owner-or-admin checks on every scoped route ✓, bcrypt ✓, stateless JWT ✓, `maxPoolSize` ✓, retries/idempotency ✓, `npm audit` clean ✓. HTTPS/HSTS is a reverse-proxy concern documented in SETUP.md.

## Incident log

### 2026-09-14 — `service_unavailable` on extraction and analyze (root cause: Gemini free-tier quota)

**Symptoms:** upload-time extraction and `/api/analyze` both returned `service_unavailable`.

**Raw upstream error captured** (now logged verbatim by `geminiService`; previously only the mapped code was visible):
```
Gemini transient failure (attempt 1): HTTP 429 RESOURCE_EXHAUSTED You exceeded your current quota...
* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash
Please retry in 54.09s.
```
Also seen: `HTTP 503 UNAVAILABLE This model is currently experiencing high demand.`

**Diagnosis checklist:**
1. `GEMINI_API_KEY` present in the running app — yes (dotenv injects into `process.env`, not `/proc/environ`; identical 53-char key in `.env`/dotenv/curl; requests reach Google with a valid key — quota/model errors, not `400 invalid key`).
2. Model names valid/enabled — yes, both returned HTTP 200 standalone.
3. Standalone calls with the same key/model — succeed when quota is available, fail with raw 429 once exhausted.

**Root cause:** free-tier quota is **20 requests/min per model**. One analysis issued ~17 calls (1 extraction + ~16 individual embeddings) → quota exhausted in seconds → 429/503 → mapped to `service_unavailable`. Fixed 1s/2s/4s backoff was useless against a 12–55s quota window.

**Fixes applied:**
- `embeddingService.embedSkillsBatch()` — all candidate skills embedded in **one** `batchEmbedContents` call (per-analysis calls drop from ~17 to 2). Seed and drift scripts batched too (27 skills = 1 call).
- Retry loop now honors the API's `Please retry in Ns` / `Retry-After` (capped 60s) instead of fixed backoff.
- Raw HTTP status + API error body now logged on every transient failure.
- Extraction model switched to **`gemini-3.5-flash`** — each model has its own free-tier bucket; `gemini-3.6-flash` was saturated.
- Drift test env fix: `global-setup.js` no longer poisons the worker env with `GEMINI_API_KEY=test-key` when `RUN_DRIFT_TEST=1`, so dotenv loads the real key.

### 2026-09-14 — second wave: `503 high demand` on the primary model → model fallback chain

**Symptom:** extraction/analyze failed with `service_unavailable` again; raw log showed `HTTP 503 UNAVAILABLE This model is currently experiencing high demand.` (plus one 30s timeout) — model overload, not quota.

**Fix:** `geminiService` now tries a fallback chain: `GEMINI_MODEL` first, then `GEMINI_FALLBACK_MODELS` (`gemini-flash-lite-latest,gemini-3-flash-preview` — each has separate quota buckets and capacity). Transient failures on a model move to the next; malformed JSON still retries once then fails as `extraction_invalid`. Generation timeout raised to 60s. The model that actually succeeded is recorded on `ExtractedSkillProfile.gemini_model`.

**Verified:** with `gemini-3.5-flash` returning 503, extraction failed over to `gemini-flash-lite-latest`; profile records `gemini_flash_lite` and the report completed with score 90.

> Note: `Unable to load script: moz-extension://.../atbc.js` in the browser console is a Firefox extension error, unrelated to this app.

**Verified after fix:** upload → `extraction_status: "completed"`; analyze → `status: "completed"`, score 91; server log shows one transient 503 logged raw, then a successful retry.

## Demo credentials (dev DB)

| Email | Password | Role |
|---|---|---|
| student1@test.com | secret123 | admin |
| student2@test.com | secret123 | student |

Regenerate sample resumes: `npm run gen-resumes` (3 PDFs under `backend/sample-resumes/`).

## API surface (implemented)

| Method | Endpoint | Status |
|---|---|---|
| GET | `/api/health` | done |
| POST | `/api/auth/register` | done |
| POST | `/api/auth/login` | done |
| POST | `/api/profile` | done (uploads + extraction) |
| GET | `/api/profile/:id` | done |
| DELETE | `/api/profile/:id` | done |
| POST | `/api/analyze` | done (async job, idempotent, cooldown) |
| GET | `/api/analyze/:id/status` | done |
| GET | `/api/report/:id` | done |
| PATCH | `/api/report/:id/study-plan/:itemId` | done |
| GET | `/api/report/history` | done (own history only) |
| GET | `/api/users/:userId/reports` | done (admin only) |
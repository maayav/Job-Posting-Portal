# Development Log

Living document tracking build progress against `EXECUTION_PLAN.md` (v7). Updated continuously as work proceeds.

**Last updated:** 2026-09-13

## Where we are

- Phase 1 (Foundation & Security) — **done**
- Phase 2 (Profile Ingestion) — **done**
- Phase 3 (AI Extraction) — **in progress**
- Phase 4 (Deterministic Scoring) — pending
- Phase 5 (Report & Frontend) — pending
- Phase 6 (Progress Tracking) — pending
- Phase 8 (Hardening & Docs) — pending
- Phase 7 (deferred features) — intentionally skipped

## Environment & setup

| Item | Value |
|---|---|
| Repo root | `/home/gman/dev/projects/pride_proj` (git, default branch `main`) |
| Backend | Node 24, Express 5, Mongoose 9, plain ESM JS, port **5000** |
| MongoDB | Docker `mongo:7` (`docker compose up -d mongo`), `mongodb://127.0.0.1:27017/placement_skill_gap` |
| Frontend | Vite + React (not yet scaffolded) |
| Gemini model | **`gemini-3.6-flash`** (extraction) — `gemini-2.5-flash` returns 404 for new users |
| Embedding model | `gemini-embedding-2`, version tag `2026-09` (spec pinned `text-embedding-004`, which is retired — see decisions) |
| GitHub | Authenticated fine-grained PAT (user `maayav`) |
| Server control | `node scripts/server.js start|stop` (pidfile + log at `backend/server.log`) |

## Decisions & deviations from the spec

1. **Embedding model swap:** spec pinned `text-embedding-004`, which no longer exists for this key. Using `gemini-embedding-2` with `embedding_version: "2026-09"` recorded on every stored vector. Drift regression test still required (Section 14).
2. **Generation model:** `gemini-2.5-flash` → `gemini-3.6-flash` (API returned 404 "no longer available to new users").
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

### Phase 3 — AI Extraction (in progress)
- `geminiService.js`: strict JSON extraction with zod schema validation, transient retry (3 attempts, 1s/2s/4s), malformed-JSON retry-once then `errorCode: extraction_invalid`; maps 404/500/429 → clean errorCodes (`service_unavailable` / `extraction_invalid`). Never logs resume text.
- `skillService.js`: builds bounded prompt input (resume + GitHub), dedups/merges skills, confidence by fixed rule (high = 2+ sources w/ evidence, medium = 1 source, low = bare keyword) — Gemini never decides confidence.
- `ExtractedSkillProfile` model (skills + sources + evidence, per submission, upsert).
- **Bug found & fixed:** `gemini-2.5-flash` returned 404 → switched to `gemini-3.6-flash`.
- **Next:** re-run extraction on 3 sample resumes and verify evidence traces back.

## How to run

```bash
cd backend
docker compose up -d mongo          # from repo root
node scripts/server.js start        # API on :5000
node scripts/server.js stop
```

## API surface (implemented so far)

| Method | Endpoint | Status |
|---|---|---|
| GET | `/api/health` | done |
| POST | `/api/auth/register` | done |
| POST | `/api/auth/login` | done |
| POST | `/api/profile` | done (uploads + extraction) |
| GET | `/api/profile/:id` | done |
| DELETE | `/api/profile/:id` | done |
| POST | `/api/analyze` | pending (Phase 4) |
| GET | `/api/analyze/:id/status` | pending (Phase 4) |
| GET | `/api/report/:id` | pending (Phase 4) |
| GET | `/api/report/history` | pending (Phase 6) |
| GET | `/api/users/:userId/reports` | pending (Phase 6) |
| PATCH | `/api/report/:id/study-plan/:itemId` | pending (Phase 5) |
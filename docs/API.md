# API Reference

Base URL: `http://localhost:5000/api` (dev). All endpoints except `/api/health`, `/api/auth/*` require `Authorization: Bearer <JWT>`.

## Error shape

All errors return `{ "error": "<code>", "message": "..." }`, with optional `issues` for validation failures. Cooldown (429) additionally includes `retryAfterSeconds`.

## Health

### `GET /api/health`
Public. Canonical shape, no extra fields:
```json
{ "status": "ok", "timestamp": "2026-09-13T12:34:56.789Z" }
```

## Auth

### `POST /api/auth/register`
Body: `{ "name", "email", "password" }` (password ≥ 6 chars). Returns `201 { token, user }`. Duplicate email → `409 email_taken`.

### `POST /api/auth/login`
Body: `{ "email", "password" }`. Returns `200 { token, user }`. Bad credentials → `401 invalid_credentials`.

## Profile (submissions)

### `POST /api/profile` — multipart/form-data
Fields: `resume` (PDF, ≤ 5 MB, magic-byte validated), `github_username` (optional; URL or username, normalized), `target_role` (`SDE` | `ML Engineer`).

Runs skill extraction via Gemini as part of the request. Returns `201`:
```json
{
  "id": "...", "target_role": "SDE", "github_username": "maayav",
  "github_status": "ok", "extraction_status": "completed",
  "extraction_error": null, "submitted_at": "...", "created_at": "..."
}
```
Rejections: `400 no_file` / `400 invalid_file_type` / `413 file_too_large` / `422 resume_unreadable`.

### `GET /api/profile/:id` — owner or admin
Returns submission metadata + `extracted_skills` (skills with confidence, sources, evidence). **Never returns `resume_text`.**

### `DELETE /api/profile/:id` — owner or admin
Deletes the stored resume file, extracted skill profile, and all related reports. Returns `204`.

## Analyze (async jobs)

### `POST /api/analyze` — owner, rate-limited
Body: `{ "submission_id" }`.
- Active job exists (queued/processing) → `202` with the existing `report_id` (idempotent, enforced by a partial unique index).
- Completed within last 60s → `429 { "error": "analysis_cooldown", "message": "...", "retryAfterSeconds": N }`.
- Otherwise → creates a `queued` report, returns `202 { "report_id", "status": "queued" }`.

### `GET /api/analyze/:id/status` — owner or admin
```json
{ "report_id": "...", "submission_id": "...", "status": "queued|processing|completed|failed", "errorCode": null, "startedAt": null, "completedAt": null }
```
`errorCode` values: `extraction_invalid`, `service_unavailable`, `embedding_failed`, `ontology_missing`, `analysis_failed`.

## Reports

### `GET /api/report/:id` — owner or admin
`200` only when `status: "completed"`, else `409 report_not_ready`. Body:
```json
{
  "report_id": "...", "submission_id": "...", "target_role": "SDE",
  "status": "completed", "errorCode": null,
  "startedAt": "...", "completedAt": "...",
  "score": 91,
  "strong_areas": [{ "skill": "React", "percent": 100 }],
  "developing_areas": [{ "skill": "System Design", "percent": 69 }],
  "gaps": [{ "skill": "Express", "percent": 57, "priority": 1 }],
  "study_plan": [{ "skill": "Express", "priority": 1, "resources": [{ "title", "url", "type", "verified" }], "done": false }],
  "embedding_model": "gemini-embedding-2", "embedding_version": "2026-09",
  "generated_at": "..."
}
```

### `PATCH /api/report/:id/study-plan/:itemId` — owner
Toggles `done` on a study-plan item. Returns `{ "report_id", "item_id", "done" }`.

### `GET /api/report/history` — authenticated student (own only, no userId in URL)
```json
{ "history": [{ "report_id", "score", "target_role", "completed_at" }] }
```
Ascending by completion time (oldest → newest, chart-friendly).

### `GET /api/users/:userId/reports` — **admin only**
Same shape as history, for any user. Non-admins get `403`.

## Scoring (deterministic, not model-decided)

`score = 100 × (Σ(wᵢ·mᵢ) / Σwᵢ)` where `wᵢ` is the role weight and `mᵢ` is the best normalized-cosine similarity of the ontology skill against the candidate skill embeddings, clamped to `[0,1]`. Strong ≥ 80%, Developing 60–79%, Gap < 60%. Gap priority = `wᵢ(1−mᵢ)` rescaled to `[0,1]`. Resources come only from the curated `ResourceCatalog` (exact normalized skill-name match).
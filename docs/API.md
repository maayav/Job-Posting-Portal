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

Runs skill extraction via the selected text provider (Groq by default) as part of the request. Returns `201`:
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

## Roles

### `GET /api/roles` — any authenticated user

Returns the available target roles, derived live from `SkillOntology` (the single source of truth — adding a role to the ontology seed makes it appear here with no code change):

```json
{
  "roles": [
    { "id": "SDE", "label": "Software Development Engineer" },
    { "id": "ML Engineer", "label": "ML Engineer" }
  ]
}
```

Unknown roles fall back to their raw id as the label. `target_role` on `POST /api/profile` is validated against this same live role set (no hard-coded enum).

## Jobs

All job routes require `Authorization: Bearer <JWT>` (students and admins share the same auth system).

### `GET /api/jobs` — any authenticated user

Query parameters (all optional):

| Param | Default | Rules |
|---|---|---|
| `skills` | — | comma-separated; ANY-match, case-insensitive; synonyms normalized to canonical names (`reactjs` → `React`, `ui/ux` → `UI/UX`, `nodejs` → `Node.js`, …) |
| `experience` | — | the seeker's years; returns jobs with `experienceLevel <= experience` |
| `city` | — | case-insensitive exact match after trim (`CHENNAI` matches `Chennai`; no partial matching) |
| `page` | `1` | integer ≥ 1 |
| `limit` | `20` | integer ≥ 1; values above 50 are clamped to 50 |

Filters combine with AND across categories; within `skills` it is OR (any listed skill may match). Job skills are canonicalized with an explicit synonym map on create/update and on search (`UI/UX` stays distinct from frontend frameworks like `React`). Sorted newest first (`createdAt` desc). Empty results still return `200`:

```json
{
  "jobs": [
    {
      "id": "job-id",
      "title": "Frontend Developer",
      "skills": ["React", "JavaScript"],
      "experienceLevel": 1,
      "city": "Chennai",
      "description": "Job description",
      "createdBy": "admin-user-id",
      "createdAt": "2026-09-15T13:53:29.896Z",
      "updatedAt": "2026-09-15T13:53:29.896Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

### `POST /api/jobs` — **admin only** (`403` for students)

Body (unknown keys, including `createdBy`, are rejected with `400`):
```json
{ "title": "Frontend Developer", "skills": ["React", "JavaScript"], "experienceLevel": 1, "city": "Chennai", "description": "Build UIs" }
```
Returns `201 { "job": { ... } }`. `createdBy` is always set server-side from the verified JWT.

### `PUT /api/jobs/:id` — **admin only**

Partial body (at least one field). Returns `200 { "job": { ... } }`; `404` if the job does not exist; `400` for an invalid id or empty body.

### `DELETE /api/jobs/:id` — **admin only**

Returns `204`; `404` if the job does not exist.

Validation errors use the shared shape: `{ "error": "validation_error", "message": "Validation failed", "issues": [...] }`. Missing/invalid JWT → `401`; insufficient role → `403 { "error": "forbidden", ... }`.

## Scoring (deterministic, not model-decided)

`score = 100 × (Σ(wᵢ·mᵢ) / Σwᵢ)` where `wᵢ` is the role weight and `mᵢ` is the best normalized-cosine similarity of the ontology skill against the candidate skill embeddings, clamped to `[0,1]`. Strong ≥ 80%, Developing 60–79%, Gap < 60%. Gap priority = `wᵢ(1−mᵢ)` rescaled to `[0,1]`. Resources come only from the curated `ResourceCatalog` (exact normalized skill-name match).
## Applications

Applications use the existing JWT and role system: `student` users apply and see only their own applications; `admin` users manage every application.

### `POST /api/applications` — student only

Body:
```json
{ "jobId": "...", "coverLetter": "Optional text", "resumeUrl": "Optional URL" }
```

The applicant is always derived from the JWT. New records start as `applied`. Duplicate student/job applications return `409 already_applied`. Returns `201 { "application": { ...populated job... } }`.

### `GET /api/applications/me` — authenticated

Returns only the current user's applications. Optional query: `status=applied|under_review|shortlisted|interview_scheduled|rejected|selected`. Job details are populated.

### `GET /api/admin/applications` — admin only

Paginated newest-first list. Query parameters: `jobId`, `status`, `search` (applicant name/email), `page` (default 1), `limit` (default 20, max 50). Returns `{ applications, page, limit, total, totalPages }` with populated applicant/job details.

### `PATCH /api/admin/applications/:applicationId/status` — admin only

Body: `{ "status": "shortlisted" }`. Valid statuses: `applied`, `under_review`, `shortlisted`, `interview_scheduled`, `rejected`, `selected`. Appends the new status and admin id to `statusHistory`. Invalid status → `400`; missing application → `404`.

### `GET /api/admin/dashboard/application-summary` — admin only

Returns aggregation-backed totals, every job's application/status counts (including jobs with zero applications), and the ordered pipeline array used by the admin dashboard.

### `GET /api/admin/dashboard` — admin only

Returns the application-driven candidate review dashboard. Optional query parameters are `jobId`, `search`, `page`, and `limit`. The response includes `totalApplications`, roles with application counts, and compact candidate rows containing the applicant, job, applied date, ATS score, role-readiness score, and simplified review stage.

### `GET /api/admin/applications/:applicationId` — admin only

Returns the selected application plus the applicant's latest completed AI review data: ATS/readiness scores, matched/developing/missing skills, evidence, GitHub profile, and study plan. Passwords, tokens, and password hashes are excluded. Invalid IDs return `400`; missing applications return `404`.

### `GET /api/assistant/context` — authenticated

Returns the current student's latest completed analysis context, including target role, scores, demonstrated skills, verified gaps, and study plan. Returns `409 analysis_required` when no completed analysis exists.

### `POST /api/assistant/chat` — authenticated

Body: `{ "message": "What should I learn first?", "analysisId": "...", "history": [] }`. The server loads the owned analysis and sends only trusted structured context to Groq. Returns `{ reply, analysisId, usage: { groundedInAnalysis: true } }`. Messages are limited to 1200 characters and history to 12 entries.

### POST /api/profile/:id/retry-extraction

Authenticated owner/admin endpoint. Reuses the stored resume and refreshes optional public profiles. Returns the same safe profile response as GET /api/profile/:id, with extraction_status and extraction_error. No resume re-upload is required. Provider errors are controlled 422/503 responses.

### Applying with email and resume

`POST /api/applications` accepts either JSON or multipart form data:

| Field | Notes |
|---|---|
| `jobId` | required |
| `email` | optional contact email; defaults to the account email when omitted |
| `coverLetter` | optional |
| `resume` | optional PDF attachment (multipart only, max 5 MB, magic-byte validated) |
| `useProfileResume` | set `true` to copy the resume from the student's latest analysis |
| `resumeUrl` | optional external link (JSON only) |

Responses include `applicantEmail`, `hasResume`, and `resumeUrl`. When a resume is stored, `resumeUrl` points at `GET /api/applications/:applicationId/resume` (owner or admin only), which serves the attached resume or falls back to the resume on the applicant's latest profile submission.

### `GET /api/notifications` — authenticated

Returns the current user's notifications, newest first, plus `unreadCount`:

```json
{
  "notifications": [
    { "id": "...", "type": "application_status", "title": "Application Shortlisted",
      "message": "Your application for \"AI Engineer\" is now \"Shortlisted\".",
      "status": "shortlisted", "application": "...", "job": "...", "read": false,
      "createdAt": "2026-09-21T14:00:00.000Z" }
  ],
  "unreadCount": 1
}
```

Students receive a confirmation when they apply and a notification on every administrator status change (Applied, Under Review, Shortlisted, Interview Scheduled, Selected, Rejected).

### `PATCH /api/notifications/:id/read` and `POST /api/notifications/read-all`

Mark one notification, or all of the current user's notifications, as read. Users can only affect their own notifications.

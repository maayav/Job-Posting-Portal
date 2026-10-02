# API Reference

Base URL: `http://localhost:5000/api` (dev). All endpoints except `/api/health`, `/api/auth/register`, and `/api/auth/login` require `Authorization: Bearer <JWT>`.

## Error shape

All errors return `{ "error": "<code>", "message": "..." }`, with optional `issues` for validation failures. Cooldown (429) additionally includes `retryAfterSeconds`.

## Health

### `GET /api/health`
Public liveness check. The Vercel shortcut does not connect to MongoDB and does not establish database readiness. Canonical shape, no extra fields:
```json
{ "status": "ok", "timestamp": "2026-09-13T12:34:56.789Z" }
```

## Auth

### `POST /api/auth/register`
Body: `{ "name", "email", "password" }` (password ≥ 6 chars). Returns `201 { token, user }` and starts the account's single active session. Duplicate email → `409 email_taken`.

### `POST /api/auth/login`
Body: `{ "email", "password" }`. Returns `200 { token, user }`. Bad credentials → `401 invalid_credentials`. A second login while the account already has an active session → `409 already_logged_in` until that session logs out or its token expires.

### `POST /api/auth/logout` — authenticated
Ends the current session and returns `204`. The token is rejected afterwards (`401 session_ended`). Each account allows one active session at a time; tokens whose session was ended or replaced fail with `401 session_ended`, and expired sessions fail with `401 session_expired`. To release a stuck session without the user's token, run `npm --prefix backend run release-session -- <email>`.

## Profile (submissions)

### `POST /api/profile` — multipart/form-data
Fields: `resume` (PDF, ≤ 5 MB locally or 4 MB on Vercel, magic-byte validated; at most 30 pages and 60,000 extracted characters), `github_username` (optional; URL or username, normalized), `linkedinUrl` (optional HTTPS public `/in/` URL), `linkedinSummaryText` (optional user-provided text, maximum 10,000 characters), `leetcode_username` (optional public username or profile URL), and `target_role` (validated against the live ontology).

Runs skill extraction via the selected text provider (Groq by default) as part of the request. Returns `201`:
```json
{
  "id": "...", "target_role": "SDE", "github_username": "maayav",
   "github_status": "ok", "linkedinUrl": "https://www.linkedin.com/in/example-user/",
   "linkedinDataSource": "user_provided_text", "extraction_status": "completed",
  "extraction_error": null, "submitted_at": "...", "created_at": "..."
}
```
Rejections: `400 no_file` / `400 invalid_file_type` / `413 file_too_large` / `422 resume_unreadable` / `422 resume_too_long`. Expensive extraction and retry requests are limited to 5 per user per 15 minutes outside tests.

### `GET /api/profile/:id` — owner or admin
Returns submission metadata + `extracted_skills` (skills with confidence, sources, evidence). **Never returns `resume_text`.**

LinkedIn is URL-only unless the student supplies `linkedinSummaryText`. The backend never scrapes LinkedIn. User-provided LinkedIn evidence is labeled `linkedin_user_provided`; a URL alone is never sent to the extraction model as evidence. LeetCode uses an unofficial public GraphQL lookup and is supplementary; lookup failure does not block extraction.

### `DELETE /api/profile/:id` — owner or admin
Deletes the stored resume file, extracted skill profile, and all related reports. Returns `204`.

## Analyze (async jobs)

### `POST /api/analyze` — owner, rate-limited
Body: `{ "submission_id" }`.
- Active job exists (queued/processing) → `202` with the existing `report_id` (idempotent; the named partial unique index on `submission_id` enforces one active report after the documented production index migration).
- Completed within last 60s → `429 { "error": "analysis_cooldown", "message": "...", "retryAfterSeconds": N }`.
- Otherwise → creates a `queued` report. A long-running server returns `202 { "report_id", "status": "queued", "errorCode": null }` and starts in-process work. Vercel/test requests await the runner and return its terminal status (`completed` or `failed`) under the same 202 response.
- Vercel provider calls/retries/analysis phases share a 50-second work budget; timeout persists `analysis_timeout` when the database remains available. There is no durable worker queue. Stale active reports are reaped after 10 minutes on startup and new analysis requests.

### `GET /api/analyze/:id/status` — owner or admin
```json
{ "report_id": "...", "submission_id": "...", "status": "queued|processing|completed|failed", "errorCode": null, "startedAt": null, "completedAt": null }
```
`errorCode` values: `extraction_invalid`, `service_unavailable`, `embedding_failed`, `ontology_missing`, `analysis_failed`, `analysis_timeout`. Shared request expiry may return `503 request_timeout`.

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
| `search` | — | up to 120 characters; comma-separated terms match title, company, skills, description or normalized skill names |
| `sort` | `newest` | `newest`, `oldest`, or `title` |
| `includeStatus` | `false` | admin-only status output; true only for `true` or `1` |
| `page` | `1` | integer ≥ 1 |
| `limit` | `20` | integer ≥ 1; values above 50 are clamped to 50 |

Filters combine with AND across categories; within `skills` it is OR (any listed skill may match). Job skills are canonicalized with an explicit synonym map on create/update and on search (`UI/UX` stays distinct from frontend frameworks like `React`). Sorted newest first unless `sort` requests otherwise. Students see open jobs; admins can inspect closed/archived jobs. Empty results still return `200`:

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
Optional `company` (maximum 150 characters) and `status` (`open`, `closed`, `archived`; default `open`) are also accepted. Returns `201 { "job": { ... } }`. `createdBy` is always set server-side from the verified JWT.

### `PUT /api/jobs/:id` — **admin only**

Partial body (at least one field). Returns `200 { "job": { ... } }`; `404` if the job does not exist; `400` for an invalid id or empty body.

### `DELETE /api/jobs/:id` — **admin only**

Returns `204`; `404` if the job does not exist. A role with existing applications is archived so candidate history remains readable; a role with no applications is deleted.

Validation errors use the shared shape: `{ "error": "validation_error", "message": "Validation failed", "issues": [...] }`. Missing/invalid JWT → `401`; insufficient role → `403 { "error": "forbidden", ... }`.

## Scoring (deterministic, not model-decided)

`score = round(100 × (Σ(wᵢ·mᵢ) / Σwᵢ))` where `wᵢ` is the role weight and `mᵢ` is the best allowed canonical-name match. Distinct canonical names or incompatible specific categories never match. Matching skills start at 1; absent evidence caps the value at 0.4 and low-depth evidence at 0.65. Values are clamped to `[0,1]`. Embeddings are generated/cached, but normal scoring is gated by this exact-name logic, rather than semantic similarity alone. Strong ≥ 80%, Developing 60–79%, Gap < 60%. Gap priority = `wᵢ(1−mᵢ)` rescaled to `[0,1]`. Resources come only from the curated `ResourceCatalog` (exact normalized skill-name match).
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

Returns the selected application plus its captured AI review data: ATS/readiness scores, matched/developing/missing skills, evidence, GitHub profile, and study plan. Passwords, tokens, and password hashes are excluded. Invalid IDs return `400`; missing applications return `404`.

New applications record `reviewSnapshotAt` and the profile/report references available at application time. A missing or deleted captured profile/report remains unavailable; later submissions are never substituted. Older uncaptured applications use the applicant’s latest compatible profile/report for backward compatibility. ATS/readiness labels currently expose the same readiness score rather than a separately validated ATS metric.

### `GET /api/assistant/context` — authenticated

For students, returns the latest completed analysis context, including target role, scores, demonstrated skills, verified gaps, and study plan; returns `409 analysis_required` when none exists. For admins, returns job/application/status totals, role breakdown and recent candidate details. Global counts cover all records; detailed context is capped at 200 recent jobs and 250 recent applications and reports coverage explicitly.

### `POST /api/assistant/chat` — authenticated

Body: `{ "message": "What should I learn first?", "analysisId": "...", "history": [] }`. The server loads the owned analysis and sends only trusted structured context to Groq. Returns `{ reply, analysisId, usage: { groundedInAnalysis: true } }`. Messages are limited to 1200 characters and history to 12 entries, with each history entry clamped to 4,000 characters. Admin chat uses admin job/application context, including application snapshots; it does not require a student analysis. Chat is limited to 20 requests per user per minute outside tests. Private context responses use `Cache-Control: private, no-store`.

### POST /api/profile/:id/retry-extraction

Authenticated owner/admin endpoint. Reuses the stored resume and refreshes optional public profiles. Returns the same safe profile response as GET /api/profile/:id, with extraction_status and extraction_error. No resume re-upload is required. Provider errors are controlled 422/503 responses.

### Applying with email and resume

`POST /api/applications` accepts either JSON or multipart form data:

| Field | Notes |
|---|---|
| `jobId` | required |
| `email` | optional contact email; defaults to the account email when omitted |
| `coverLetter` | optional |
| `resume` | optional PDF attachment (multipart only, max 5 MB locally / 4 MB on Vercel, magic-byte validated) |
| `useProfileResume` | set `true` to copy the resume from the student's latest analysis |
| `resumeUrl` | optional HTTPS external link without embedded credentials |

Responses include `applicantEmail`, `hasResume`, and `resumeUrl`; private filesystem references are not returned. A selected profile resume is copied when applying; if no available profile resume exists, the API returns `409 profile_resume_unavailable` without creating an application. For stored attachments, `resumeUrl` points at `GET /api/applications/:applicationId/resume` (owner or admin only). Downloads never substitute a later profile resume; legacy records may use their captured profile reference. Current Vercel filesystem storage is ephemeral: an absent attachment returns `404 resume_not_found`, and an unavailable stored file returns `404 resume_missing`.

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

### Wishlist (saved jobs) — students only

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/wishlist` | The student's saved jobs, newest first, with populated job details |
| POST | `/api/wishlist` | Save a job for later (`{ "jobId": "..." }`); idempotent |
| DELETE | `/api/wishlist/:jobId` | Remove a saved job (`204`) |

Wishlists are private to each student; administrators receive `403`. The student dashboard shows saved jobs with Apply and Remove actions, and the Jobs page shows the saved state on each card.

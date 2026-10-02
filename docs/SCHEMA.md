# Data Schema

All timestamps ISO-8601 UTC. IDs are Mongo ObjectIds.

## User (`users`)

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `email` | string | unique, lowercase |
| `password` | string | bcrypt hash (10 rounds), never selected by default |
| `role` | enum `student` / `admin` | placement_cell deferred |
| `createdAt` / `updatedAt` | date | |

## ProfileSubmission (`profilesubmissions`)

| Field | Type | Notes |
|---|---|---|
| `user_id` | ref User | indexed |
| `resume_file_ref` | string | server-generated storage filename — original name never used |
| `resume_text` | string | **sensitive** — never returned by the API, never logged |
| `github_username` | string | canonical (lowercase, URL-normalized) |
| `github_status` | enum `ok` / `unavailable` / `not_found` / `none` | partial-results flag |
| `leetcode_username` | string | normalized optional username/profile value; no password or private activity is stored |
| `leetcode_status` | enum `none` / `ok` / `not_found` / `unavailable` | supplementary public lookup status |
| `linkedinUrl` | string | normalized HTTPS public `/in/` URL; no LinkedIn page is scraped |
| `linkedinSummaryText` | string | optional user-provided text, maximum 10,000 characters |
| `linkedinDataSource` | `user_provided_text` or null | identifies the source of supplied LinkedIn text |
| `target_role` | string | validated against role names in the live ontology, including AI Engineer |
| `submitted_at` | date | |
| `extraction_status` | enum `pending` / `completed` / `failed` | |
| `extraction_error` | string \| null | errorCode |

## ExtractedSkillProfile (`extractedskillprofiles`) — one per submission (unique `submission_id`)

| Field | Type |
|---|---|
| `submission_id` | ref ProfileSubmission, unique |
| `skills[]` | see below |
| `gemini_model` | historical field name; stores the actual text provider model, including Groq |
| `embeddings[]` | cached `{ name, vector }` values for extracted skills |
| `embedding_model` / `embedding_version` | identify the cached vector model and version |

`skills[]`:
| Field | Type | Notes |
|---|---|---|
| `name` | string | display form |
| `confidence` | enum `low` / `medium` / `high` | **fixed rule, not Gemini's**: high = evidence from 2+ sources; medium = 1 source with evidence excerpt; low = bare keyword |
| `sources[]` | enum `resume` / `github` / `linkedin_user_provided` / `leetcode` / `coding_user_provided` | |
| `evidence[]` | `{ source, text }` | short excerpt supporting the skill |

## ReadinessReport (`readinessreports`)

| Field | Type | Notes |
|---|---|---|
| `submission_id` | ref ProfileSubmission | |
| `target_role` | string | |
| `status` | enum `queued` / `processing` / `completed` / `failed` | named partial unique index `one_active_analysis_per_submission` on `{submission_id}` where status ∈ [queued, processing]; production requires the reviewed index migration |
| `errorCode` | string \| null | `extraction_invalid`, `service_unavailable`, `embedding_failed`, `ontology_missing`, `analysis_failed`, `analysis_timeout` |
| `startedAt` / `completedAt` | date \| null | cooldown window starts at `completedAt` (60s) |
| `score` | number 0–100 | deterministic, rounded: `100·Σ(wᵢmᵢ)/Σwᵢ`; canonical-name/category/evidence gates |
| `strong_areas[]` | `{ skill, percent }` | ≥ 80 |
| `developing_areas[]` | `{ skill, percent }` | 60–79 |
| `gaps[]` | `{ skill, percent, priority }` | < 60; `priority ∈ [0,1]` = `wᵢ(1−mᵢ)` rescaled by max |
| `study_plan[]` | see below | gap skills plus developing skills added by the analysis service |
| `embedding_model` / `embedding_version` | string | pinned at report generation time |
| `generated_at` | date | |

`study_plan[]`:
| Field | Type | Notes |
|---|---|---|
| `skill` | string | gap or developing skill |
| `priority` | number [0,1] | gap priority, or 0.4 for a developing skill |
| `resources[]` | `{ title, url, type, verified }` | from `ResourceCatalog`, exact match only |
| `done` | boolean | toggled via PATCH |

## SkillOntology (`skillontologies`)

| Field | Type | Notes |
|---|---|---|
| `skill_name` | string | unique |
| `category` | string | language/framework/database/cloud/devops/core-cs/ml/data/tools |
| `embedding_model` | string | pinned `gemini-embedding-2` |
| `embedding_version` | string | pinned `2026-09` — changing requires re-seed + drift baseline |
| `embedding_vector` | number[] | L2-normalized, cached at seed time |
| `roles[]` | `{ role_name, weight }` | weight ∈ [0,1]; shared skills (e.g. Python) carry one entry per role |

## ResourceCatalog (`resourcecatalogs`)

| Field | Type | Notes |
|---|---|---|
| `skill_name` | string | indexed; matched exactly (normalized) |
| `title` / `url` | string | human-vetted, never model-generated |
| `type` | enum `documentation` / `course` / `practice-set` / `video` | |
| `verified` | boolean | always true in seed data |
| unique index | `{skill_name, url}` | |

## GitHubCache (`githubcaches`)

| Field | Type | Notes |
|---|---|---|
| `username` | string | unique, lowercase |
| `data` | mixed | ≤10 newest repos, 800-char README excerpts, languages, topics, manifests |
| `fetchedAt` | date | 24h TTL at read time |
## Job (`jobs`)

Job postings for the placement job portal. Created/updated/deleted only by admins; readable by any authenticated user.

| Field | Type | Notes |
|---|---|---|
| `title` | string | required, trimmed, max 150 |
| `company` | string | optional, max 150 |
| `status` | enum | `open`, `closed`, `archived`; indexed; defaults to open |
| `skills` | string[] | required, non-empty; each skill trimmed, max 50 chars; duplicate normalized skills rejected at the API layer |
| `skillsLower` | string[] | derived (trimmed + lowercased) on every write for case/whitespace-insensitive search |
| `experienceLevel` | number | required, minimum 0, max 50 (required years of experience) |
| `city` | string | required, trimmed, max 100 |
| `cityLower` | string | derived lowercase city for case-insensitive exact search |
| `description` | string | required, trimmed, max 5000 |
| `createdBy` | ObjectId ref `User` | required; always set server-side from the verified admin JWT |
| `createdAt` / `updatedAt` | date | timestamps |

Indexes: `{ skillsLower: 1 }`, `{ cityLower: 1 }`, `{ experienceLevel: 1 }`, `{ createdAt: -1 }`, `{ cityLower: 1, experienceLevel: 1 }`.

No cascade deletion: if an admin account is removed, existing jobs keep the `createdBy` ObjectId (rendered as an opaque id by the API).

### Search semantics (v1)

- `skills` — comma-separated, ANY-match (`$in` on `skillsLower`), case-insensitive. Synonyms are canonicalized by `backend/src/utils/skillNormalizer.js` on both write and search (`reactjs`/`react.js` → `React`; `ui/ux`/`product design` → `UI/UX`; `nodejs`/`node` → `Node.js`; …). Unknown skills keep their original (trimmed) name.
- `experience` — seeker's years; matches `experienceLevel <= experience`.
- `city` — case-insensitive exact match on `cityLower` (no partial matching).
- Combined filters AND together; within `skills` it is OR; results sorted `createdAt` desc; `page` default 1, `limit` default 20 (max 50, clamped).

## Application (`applications`)

| Field | Type | Notes |
|---|---|---|
| `applicant` | ObjectId ref `User` | required; always server-derived from JWT |
| `job` | ObjectId ref `Job` | required |
| `reviewSnapshotAt` | date or null | marks capture at apply time, even if no profile/report existed; only legacy uncaptured records may use the latest profile |
| `profileSubmissionId` | ObjectId ref `ProfileSubmission` | optional analysis-input snapshot; absent on older records |
| `readinessReportId` | ObjectId ref `ReadinessReport` | optional completed-report snapshot; absent when no report existed at apply time |
| `status` | enum | `applied`, `under_review`, `shortlisted`, `interview_scheduled`, `rejected`, `selected`; new records start at `applied` |
| `appliedAt` | date | default now |
| `updatedAt` | date | Mongoose timestamp |
| `coverLetter` | string | optional, max 3000 |
| `resumeUrl` | string | optional HTTPS external URL without embedded credentials, max 500 |
| `resumeFileRef` | string | generated private stored file reference, omitted from application responses |
| `applicantEmail` | string | chosen contact email |
| `resumeSource` | enum `application_upload` / `profile` / `external_url` / `none` | records the student's resume choice |
| `statusHistory` | array | `{ status, changedAt, changedBy }`; initial application and every admin transition are recorded |

Indexes: unique compound `{ applicant: 1, job: 1 }` (prevents duplicate applications), `{ appliedAt: -1 }`, `{ status: 1 }`, `{ job: 1 }`.

Students can read only their own applications and cannot change statuses. Admins can list, filter, and transition every application.

Captured application reviews never substitute later profiles/reports when a captured reference is absent or deleted. Resume storage is currently filesystem based; Vercel references may outlive ephemeral files and do not establish durable storage.

Production connection setup disables automatic index creation. Deploying the model alone does not replace the old `{submission_id, status}` index; see the migration procedure in [DEPLOYMENT.md](../DEPLOYMENT.md).

## Profile assessment additions

ProfileSubmission stores `codingProfileUrl`, `codingSummaryText`, and `source_evidence`: the bounded GitHub repository snapshot and LeetCode unique solved/difficulty/language totals observed during extraction. `demo_key` identifies local seed reviews and `demo_content_hash` detects changes to the generated resume content. Repository snapshots preserve `readmeStatus` so absent documentation can be distinguished from an unavailable lookup. ExtractedSkillProfile accepts `coding_user_provided` alongside the other four source names. User text is labelled as unverified evidence.

ReadinessReport adds `stage`, nullable `profile_assessment`, and nullable `career_actions`. The profile rubric is versioned as `profile-evidence-v1`. Missing sources have null scores and do not enter the overall average. Projects, curated practice suggestions, and LinkedIn draft outlines are saved with the report rather than regenerated during each read. Existing report compatibility is retained; a new analysis is needed to produce the additions.

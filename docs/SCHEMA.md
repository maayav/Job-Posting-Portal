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
| `target_role` | enum `SDE` / `ML Engineer` | |
| `submitted_at` | date | |
| `extraction_status` | enum `pending` / `completed` / `failed` | |
| `extraction_error` | string \| null | errorCode |

## ExtractedSkillProfile (`extractedskillprofiles`) — one per submission (unique `submission_id`)

| Field | Type |
|---|---|
| `submission_id` | ref ProfileSubmission, unique |
| `skills[]` | see below |
| `gemini_model` | string (e.g. `gemini-3.5-flash`) |

`skills[]`:
| Field | Type | Notes |
|---|---|---|
| `name` | string | display form |
| `confidence` | enum `low` / `medium` / `high` | **fixed rule, not Gemini's**: high = evidence from 2+ sources; medium = 1 source with evidence excerpt; low = bare keyword |
| `sources[]` | enum `resume` / `github` | |
| `evidence[]` | `{ source, text }` | short excerpt supporting the skill |

## ReadinessReport (`readinessreports`)

| Field | Type | Notes |
|---|---|---|
| `submission_id` | ref ProfileSubmission | |
| `target_role` | string | |
| `status` | enum `queued` / `processing` / `completed` / `failed` | partial unique index `{submission_id, status}` where status ∈ [queued, processing] — one active job per submission |
| `errorCode` | string \| null | `extraction_invalid`, `service_unavailable`, `embedding_failed`, `ontology_missing`, `analysis_failed` |
| `startedAt` / `completedAt` | date \| null | cooldown window starts at `completedAt` (60s) |
| `score` | number 0–100 | deterministic: `100·Σ(wᵢmᵢ)/Σwᵢ` |
| `strong_areas[]` | `{ skill, percent }` | ≥ 80 |
| `developing_areas[]` | `{ skill, percent }` | 60–79 |
| `gaps[]` | `{ skill, percent, priority }` | < 60; `priority ∈ [0,1]` = `wᵢ(1−mᵢ)` rescaled by max |
| `study_plan[]` | see below | one entry per gap skill |
| `embedding_model` / `embedding_version` | string | pinned at report generation time |
| `generated_at` | date | |

`study_plan[]`:
| Field | Type | Notes |
|---|---|---|
| `skill` | string | gap skill |
| `priority` | number [0,1] | matches the gap's priority |
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
| `type` | enum `documentation` / `course` / `practice-set` | |
| `verified` | boolean | always true in seed data |
| unique index | `{skill_name, url}` | |

## GitHubCache (`githubcaches`)

| Field | Type | Notes |
|---|---|---|
| `username` | string | unique, lowercase |
| `data` | mixed | ≤10 newest repos, 800-char README excerpts, languages, topics, manifests |
| `fetchedAt` | date | 24h TTL at read time |
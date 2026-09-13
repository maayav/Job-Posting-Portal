# AI-Assisted Placement & Skill-Gap Tracker — Execution Plan (v7)

**Purpose of this document:** This is a build spec for an AI coding agent (Claude Code, Cursor, etc.) to implement this project end-to-end, phase by phase. Each phase has a goal, concrete tasks, and an acceptance check before moving to the next. Feed this whole file to the agent as its starting context, then work through phases in order.

**v2 changes:** revised after a technical review of v1. The main shifts: scoring is now a deterministic formula (not delegated to Gemini), skill extraction now carries evidence, analysis runs as an async job with lifecycle states, authorization holes are closed, file-upload and resume-text handling are hardened, and the build order + scope are trimmed to a realistic MVP with everything else explicitly deferred.

**v3 changes:** closed the "define this before implementation" gaps from a follow-up review — confidence mapping is now a fixed rule (Section 3), GitHub collection has exact bounds (10 repos, 800-char README excerpts, 24h cache TTL), resume uploads have an explicit 5 MB cap, Gemini/GitHub calls have a concrete retry-with-backoff policy, `/api/analyze` has a defined idempotency key (one active job per submission), and Section 14 spells out concrete mitigations for the remaining risks (LeetCode as pure enrichment, GitHub degradation path, resume-parsing regression suite, ontology refresh script, embedding-drift test).

**v4 changes:** final polish pass — added a terminology glossary (Section 0), pinned the v1 embedding model to `text-embedding-004` (so it's one vendor, one key, for a capstone build), defined the idempotency window precisely (failed reports don't block a retry; completed reports get a 60s cooldown), fixed the `ResourceCatalog` matching rule to exact-match-only for v1, and added a concrete observability baseline (what to log, and the explicit rule not to log resume text or evidence excerpts).

**v5 changes:** added a "non-goals" list (Section 0) to guard against scope creep during implementation, gave the cooldown response a fixed JSON error shape, wrote out the actual Mongoose partial-unique-index definition instead of describing it in prose, pinned the embedding input to the bare skill name only (no concatenation with evidence/description text), and added a `GET /api/health` liveness endpoint to Phase 1.

**v6 changes:** last small gaps closed — an explicit embedding-version tag (`"2024-07"`) with a rule against changing it without running the drift test, a canonical `/api/health` response shape with no extra fields allowed, a precise type/formula for the study-plan `priority` field, and explicit lowercase+trim normalization applied consistently before embedding any skill name.

**v7 changes:** three wording-level clarifications — the priority rescaling formula written out in Section 5 (not just referenced from Section 3), the `/api/health` timestamp format stated as ISO-8601 UTC, and the cooldown window's start point pinned to `completedAt` rather than left ambiguous.

**Project:** AI-Assisted Placement and Skill-Gap Tracker
**Stack:** MERN (MongoDB, Express.js, React.js, Node.js) + Google Gemini API (extraction) + a separate embedding model/API (similarity)
**Core loop:** Student uploads resume + GitHub (+ LeetCode, deferred to post-MVP) → Gemini extracts skills with evidence → skills compared against a role's skill ontology via embedding similarity → deterministic Role-Readiness Score + prioritized study plan (curated resources) → student re-uploads over time to track progress.

---

## 0. Ground Rules for the Agent

1. **Backend before frontend.** Build and test each endpoint with real requests before wiring it into the UI.
2. **Env vars for every secret, no exceptions.** `GEMINI_API_KEY` (covers both extraction and the `text-embedding-004` embedding calls, per Section 1), `MONGO_URI`, `JWT_SECRET`, `GITHUB_TOKEN` all go in `.env`, never committed. Provide a `.env.example` with empty values.
3. **Gemini extracts, it does not score.** The final readiness score must come from a deterministic formula the codebase controls (Section 6), not from anything Gemini returns directly. This is what makes the score reproducible and defensible in a viva/demo.
4. **Validate everything from a client or an external API** — resume text, GitHub usernames, file uploads, and especially Gemini's JSON output. Never trust an LLM response shape without a schema check.
5. **Build the MVP in Section 7 first.** Don't let the agent start on deferred features (LeetCode, cohort dashboard, async queues) before the core pipeline in Sections 8's early phases is solid.
6. **Commit after every working phase**, not after every file.
7. **Section 10's security checklist applies throughout, not just at the end.**

**Glossary** (keep this terminology consistent across code, docs, and the API — don't let synonyms drift in):
- **Skill** — a named capability extracted from the student's profile (e.g. "React").
- **Ontology skill** — a required skill for a target role, carrying a weight and a cached embedding.
- **Evidence** — a short text excerpt from a specific source that supports a skill being extracted.
- **Gap** — a skill whose match percent (`m_i`, Section 6) is below 60%.
- **Resource** — a curated, human-vetted link from `ResourceCatalog`, not a model-generated URL.

**Non-goals for v1** (don't build these, even if they'd be easy to bolt on):
- No real-time collaboration or chat features
- No automated resume rewriting or generation
- No public leaderboard or shared/social profiles
- No multi-tenant placement-cell workflows (the `placement_cell` role itself is already deferred to post-MVP, Section 7)

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React.js (Vite) | Upload flow, score dashboard, progress charts |
| Charts | Recharts | Score trends, gap breakdown |
| Backend | Node.js + Express.js | REST API |
| Auth | JWT (`jsonwebtoken`) + `bcrypt` | Roles: student / admin (placement_cell role deferred, see Section 7) |
| Database | MongoDB (local for dev, Atlas for prod) | via `mongoose` |
| File upload | `multer` + `file-type` (magic-byte MIME check) | PDF only for MVP; DOCX deferred |
| Skill extraction | Google Gemini API | Structured JSON output, schema-validated |
| Embeddings/similarity | **`text-embedding-004`** (Google's embedding model, via the same Gemini/Google AI API key — keeps v1 to a single vendor for a capstone project) | Called as a distinct embedding request, separate from Gemini's generative extraction calls. Record `embedding_model: "text-embedding-004"` and an `embedding_version` string on every stored vector so a future swap doesn't silently mix incompatible vectors |
| External data | GitHub REST API | via `axios`, bounded collection (Section 8) |
| Validation | `zod` or `express-validator` | Request bodies + Gemini output shape |
| Rate limiting | `express-rate-limit` | `/api/analyze` and auth endpoints especially |
| Job/status tracking | In-Mongo status field (Section 5); Redis/Bull only if load testing later shows it's needed |

---

## 2. Repository Structure

```
placement-skill-gap-tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # db connection, env validation
│   │   ├── models/          # User, ProfileSubmission, ExtractedSkillProfile, ReadinessReport, SkillOntology, ResourceCatalog
│   │   ├── routes/          # profile.routes.js, analyze.routes.js, report.routes.js, auth.routes.js
│   │   ├── controllers/
│   │   ├── services/        # geminiService.js, embeddingService.js, githubService.js, scoringService.js
│   │   ├── middleware/       # auth.middleware.js, ownership.middleware.js, rateLimit.middleware.js, upload.middleware.js, errorHandler.js
│   │   ├── utils/
│   │   └── app.js
│   ├── ontology/             # seed data: skill ontology per role
│   ├── resources/            # curated study-resource catalog (seed data)
│   ├── storage/               # resume uploads — NOT web-served directly
│   ├── tests/
│   ├── .env.example
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/       # UploadForm, ExtractedSkillReview, ScoreCard, GapList, StudyPlan, ProgressChart
│   │   ├── pages/            # UploadPage, DashboardPage, ReportPage, LoginPage
│   │   ├── api/
│   │   ├── context/           # AuthContext
│   │   └── App.jsx
│   └── .env.example
├── docs/
│   ├── API.md
│   ├── SETUP.md
│   └── SCHEMA.md
└── README.md
```

---

## 3. Data Models

**User**
```
user_id, name, email (unique), password (bcrypt hash), role: enum[student, admin], createdAt
```

**ProfileSubmission**
```
submission_id, user_id (ref User),
resume_file_ref (server-generated filename, not the original),
resume_text (extracted; treat as sensitive — see Section 10, never returned in full by GET /api/profile/:id),
github_username (normalized/canonical, not a raw URL),
target_role, submitted_at
```

**ExtractedSkillProfile**
```
submission_id (ref),
skills: [{
  name,
  confidence: enum[low, medium, high],
  sources: [resume|github],
  evidence: [{ source, text }]   // short supporting excerpt per source, for explainability + student review
}]
```
**Confidence mapping (a fixed rule, not left to Gemini's judgment):**
- **high** — skill has evidence from 2+ sources (resume + GitHub)
- **medium** — skill has evidence from exactly 1 source, with a specific supporting evidence excerpt (not just a bare keyword)
- **low** — skill appears only as a bare listed keyword with no supporting evidence sentence in any source

**ReadinessReport** (now with lifecycle state)
```
report_id, submission_id (ref), target_role,
status: enum[queued, processing, completed, failed],
errorCode: string|null,
startedAt, completedAt,
score (0-100, deterministic — see Section 6),
strong_areas: [{ skill, percent }],       // >= 80%
developing_areas: [{ skill, percent }],    // 60-79%
gaps: [{ skill, percent, priority }],      // < 60%
study_plan: [{ skill, priority, resources: [{ title, url, type, verified: true }], done: bool }],
generated_at
```
`priority: number in [0, 1]`, higher = more important, computed from `ontology_weight × (1 − match%)` per Section 5 step 8 — this defines the field precisely enough that both the backend's sort order and the frontend's rendering agree without guessing.

**SkillOntology**
```
skill_id, skill_name, category,
embedding_model, embedding_version, embedding_vector (normalized, cached),
roles: [{ role_name, weight }]
```
**Embedding version strategy:** for v1, use `embedding_version: "2024-07"` (or whatever tag you settle on) and record it on every stored vector. Do not change this tag without re-embedding the ontology and running the embedding-drift regression test (Section 14) — a silent version bump is exactly the kind of untracked drift that test exists to catch.

**ResourceCatalog** (new — curated, not model-generated)
```
resource_id, skill_name, title, url, type: enum[documentation, course, practice-set], verified: bool
```

---

## 4. API Endpoints

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Liveness check. Canonical response, exactly this shape — **no extra fields** (no `uptime`, no `version`, no DB status): `200 { "status": "ok", "timestamp": "2026-09-12T12:34:56.789Z" }`. `timestamp` is an ISO-8601 string in UTC. | Public |
| POST | `/api/auth/register` | Create account | Public |
| POST | `/api/auth/login` | Login, returns JWT | Public |
| POST | `/api/profile` | Upload resume + GitHub username + target role | Student |
| GET | `/api/profile/:id` | Get a submission + extracted skills (excludes full resume_text) | Owner or admin |
| DELETE | `/api/profile/:id` | Delete a submission and its resume file | Owner or admin |
| POST | `/api/analyze` | **Queue** the pipeline for a submission — returns `202 Accepted` + analysis id, does not block on Gemini/GitHub latency | Student, owner of submission |
| GET | `/api/analyze/:id/status` | Poll job status: queued/processing/completed/failed | Owner or admin |
| GET | `/api/report/:id` | Fetch a completed readiness report | Owner or admin |
| GET | `/api/report/history` | **Own** report history for the authenticated user (no userId in the URL) | Student |
| GET | `/api/users/:userId/reports` | Any user's report history | **Admin only** |
| PATCH | `/api/report/:id/study-plan/:itemId` | Mark a study-plan item done | Owner |

Every owner-scoped route must check `submission.user_id === req.user.id` (or admin role) in middleware — not just that a valid JWT was presented. This was a real gap in v1 (`/api/report/history/:userId` let any authenticated user swap the id).

Cohort/placement-cell endpoints (`/api/cohort`, `/api/cohort/export`) are **deferred to post-MVP** — see Section 7.

---

## 5. AI Pipeline (`POST /api/analyze` → async job)

1. **Idempotency check first:** if a `ReadinessReport` for this `submission_id` already has `status` in `[queued, processing]`, return that existing report's id and `202` instead of creating a new one — enforce this with a partial unique index, not just an application-level check:
   ```js
   ReadinessReportSchema.index(
     { submission_id: 1, status: 1 },
     { unique: true, partialFilterExpression: { status: { $in: ["queued", "processing"] } } }
   );
   ```
   A prior report in `failed` state does **not** block a new attempt — the student (or a retry) can immediately queue a fresh one. A prior report in `completed` state has a **60-second cooldown** before a new `/api/analyze` call for the same submission is accepted; the window starts from `completedAt` on the most recent `completed` report for that submission (not from when the client happened to fetch it). A call within the cooldown returns `429` with a fixed body shape so the frontend doesn't have to guess the format:
   ```json
   { "error": "analysis_cooldown", "message": "Please wait before re-analyzing this submission.", "retryAfterSeconds": 45 }
   ```
   Otherwise, create a new `ReadinessReport` with `status: "queued"`, return its id immediately (`202 Accepted`). The frontend polls `/api/analyze/:id/status`.
2. **Extract resume text** from the stored PDF (`pdf-parse`). Cache it on the submission.
3. **Fetch GitHub data** using the bounded strategy in Section 8 — not full unbounded README dumps.
4. **Call Gemini** for skill extraction only. Prompt it to return strict JSON with evidence per skill:
   ```
   Extract demonstrated skills from this profile data with supporting evidence. Return ONLY valid JSON, no markdown fences:
   {
     "skills": [
       { "name": "React", "confidence": "high", "sources": ["resume","github"],
         "evidence": [{ "source": "resume", "text": "Built a React-based placement dashboard" }] }
     ]
   }
   ```
   Parse defensively: strip code fences if present, validate against a schema. Two distinct failure modes need two distinct handling paths:
   - **Malformed/invalid JSON shape** → retry the Gemini call once with the same input; if it fails again, mark the job `failed` with `errorCode: "extraction_invalid"`.
   - **Transient errors** (timeout, 5xx, rate-limit) on either Gemini or GitHub calls → retry with exponential backoff, **3 attempts total, delays of 1s / 2s / 4s**, then mark the job `failed` with `errorCode: "service_unavailable"` (Gemini) or proceed with partial results (GitHub, per Section 8).
5. **Merge + deduplicate** skills; a skill appearing in 2+ sources is bumped in confidence.
6. **Embed each candidate skill and each required ontology skill separately** — do not embed the whole skill list as one vector. **Embedding input for v1 is the bare skill name only** (`skill.name` for candidates, `skill_name` for ontology entries) — no concatenation with evidence text, descriptions, or category labels. **Normalize before embedding**: lowercase and trim whitespace, applied consistently to both candidate and ontology skill names — this avoids "React" vs "react" silently landing as different vectors. This keeps embeddings stable, reproducible, and easy to reason about; richer embedding input (e.g. including evidence context) is a reasonable post-MVP experiment, not a v1 default. Normalize the resulting vectors too, compute per-skill cosine similarity (`m_i` in Section 6), take the best match per required skill.
7. **Score deterministically** using the formula in Section 6 — this step never calls Gemini.
8. **Build the study plan** from `ResourceCatalog` entries matching each gap skill. Matching rule for v1: **exact match on `skill_name` only** — no fuzzy or synonym matching yet. If no catalog entry exists for a gap skill, surface it as a gap with no resource yet rather than fabricating one. (A small synonym map — e.g. "Node.js" ↔ "Node" — is a reasonable post-MVP addition once you see which near-misses actually occur in practice; don't have the agent invent fuzzy-matching logic for v1.) **Priority formula:** `priority = w_i × (1 − m_i)` per gap skill, then rescaled to `[0, 1]` by dividing by the max raw priority across that report's gaps — this is what Section 3's `priority: number in [0, 1]` refers to.
9. Update the report to `status: "completed"`, set `completedAt`. On any unrecoverable failure, `status: "failed"` with a specific `errorCode` the frontend can show ("resume unreadable", "GitHub profile not found", "AI service unavailable" etc.), never a raw stack trace.

---

## 6. Deterministic Scoring

Define this before writing any scoring code — the agent should implement this exact formula, not approximate it:

```
score = 100 × ( Σ(w_i × m_i) / Σ(w_i) )
```
- `w_i` = the target role's importance weight for skill *i* (from `SkillOntology.roles`)
- `m_i` = best similarity/evidence match for skill *i*, clamped to [0, 1]

Thresholds for categorizing each skill:
- **Strong**: 80–100%
- **Developing**: 60–79%
- **Gap**: below 60%

Gemini's role stops at extraction + evidence. Everything from here down — matching, weighting, thresholding, final score — is plain deterministic code, so the same input always produces the same score and the number can be explained skill-by-skill in a demo or viva.

---

## 7. MVP Scope (build this first, defer the rest)

**In scope for v1:**
- Auth (student + admin roles only)
- PDF resume upload (DOCX deferred)
- Resume text extraction
- GitHub profile analysis (bounded, per Section 8)
- Gemini skill extraction with evidence + schema validation
- Manually seeded ontology for **two roles**: Software Development Engineer, ML Engineer
- Deterministic weighted scoring (Section 6)
- Gaps + curated study resources (`ResourceCatalog`, not model-generated links)
- Basic report dashboard
- Score history for the logged-in student

**Explicitly deferred — don't build until the above works end-to-end and is demoed:**
- LeetCode integration (no official API; fragile — see Section 9)
- Placement-cell cohort analytics and the `placement_cell` role
- PDF/CSV export
- DOCX/legacy `.doc` resume support
- Redis/Bull async queues (the in-Mongo status-field approach in Section 5 is enough at this scale)
- "Advanced" embedding strategies beyond per-skill cosine similarity
- Any role beyond student/admin

This is a scope cut, not a scope loss — Sections elsewhere in this doc (cohort dashboard, LeetCode) describe how to add these back once the core pipeline is proven, in Phase 7 below.

---

## 8. Repository & Data Collection Bounds

**GitHub collection strategy** (avoid sending Gemini unbounded data — exact bounds, not left as "some reasonable limit"):
- **Max 10 repositories**, selected by most recent push date
- README excerpt **capped at 800 characters per repo** (truncate, don't summarize server-side — let Gemini work from the raw excerpt)
- Weight recency — stale, years-old repos count less
- Collect: languages, topics, package manifest contents (`package.json`, `requirements.txt`, etc.), plus the capped README excerpt
- Ignore forks unless the user has meaningful commits on them
- Use a **dedicated GitHub token** (not unauthenticated requests) for the higher rate-limit tier
- Cache GitHub API responses **per username with a 24-hour TTL**
- On GitHub failure or rate-limit, **proceed with partial results** (resume-only skills, GitHub confidence flagged unavailable) rather than failing the whole analysis job
- Normalize whatever the student submits (raw URL or username) into a single canonical GitHub username before storage — don't store both forms and risk drift

**Resume uploads:**
- Accept PDF only for MVP; validate both the MIME type *and* the file signature (magic bytes), not just the extension or filename
- Enforce a strict file-size cap: **5 MB (5,242,880 bytes)** per resume
- Generate a server-side random filename; never use the original filename as a storage path
- Store uploads outside any publicly served directory
- Delete the temp upload once text extraction succeeds
- Reject anything that fails signature validation rather than trying to process it

**Resume text handling:**
- Treat `resume_text` as sensitive — it can contain personal data (name, phone, address, etc.)
- `GET /api/profile/:id` must not return the full `resume_text` in a normal response
- Add a retention policy and a working `DELETE /api/profile/:id` that removes the file, the extracted text, and cascades to related reports
- Cover ownership/access-control with tests (Section 11)

---

## 9. Known Fragility Points

- **LeetCode has no official public API** — this is *why* it's deferred to post-MVP rather than built against an undocumented endpoint from day one.
- **Gemini output is not guaranteed valid JSON** — always schema-validate, retry once, then fail the job cleanly with an `errorCode` rather than crashing the request.
- **Resume parsing quality varies by template** — the "review extracted skills" screen (with evidence shown) is the real mitigation, not parser perfection.
- **The skill ontology will go stale** — it's a manually seeded v1 for two roles; plan a periodic review, don't treat it as finished.
- **GitHub API rate limits** — cache aggressively; a burst of student uploads during placement season can exhaust an unauthenticated or low-tier token quickly.

---

## 10. Production Best-Practices Checklist

Apply throughout the build, not as a final pass:

- [ ] **Rate limiting** on `/api/analyze` and all auth endpoints
- [ ] **Secrets/API key management** — env vars only, `.env` gitignored, `.env.example` with blank values
- [ ] **HTTPS + HSTS** in production (hosting/reverse-proxy layer)
- [ ] **Input sanitization + parameterized queries** — validate all user input (filenames, GitHub usernames, role names) before it touches a query or the UI
- [ ] **File upload security** — MIME + signature validation, size caps, server-generated filenames, storage outside the public dir, temp-file cleanup (Section 8)
- [ ] **Sensitive data handling** — resume text not exposed in normal responses; a working delete/retention path (Section 8)
- [ ] **Authorization checks on every owner-scoped route**, not just JWT validity — verify the resource actually belongs to the requesting user or that the user is an admin
- [ ] **Dependency auditing** — `npm audit` as a routine step, dependencies kept current
- [ ] **Encryption at rest and in transit** — MongoDB Atlas encryption at rest by default; confirm TLS on the connection string; bcrypt for passwords, never plaintext
- [ ] **Stateless architecture** — JWT auth, no server-side sessions, so the API can scale horizontally
- [ ] **Connection pooling** — explicit `maxPoolSize` on the Mongoose connection sized to expected load
- [ ] **Reliability patterns** — retry-with-backoff around Gemini/GitHub calls; idempotent `/api/analyze` (a retried request shouldn't double-spend API quota or create duplicate jobs); async job status pattern (Section 5) instead of a long-held open request
- [ ] **Minimal observability baseline** — log each job's lifecycle transitions (`queued`/`processing`/`completed`/`failed`) with `submission_id` and `errorCode`; log Gemini/GitHub call failures with status code and retry count. **Never log `resume_text` or full evidence excerpts** — this is the same sensitive data Section 8 already restricts from API responses, so it shouldn't leak into logs either.

---

## 11. Test Requirements

Automated tests to write alongside each phase, not bolted on at the end:

- Register/login success and failure cases
- Password hash verification
- JWT expiration and invalid-token handling
- Ownership checks (a student cannot fetch another student's profile/report/history)
- Role-based access checks (admin-only routes actually reject non-admins)
- Invalid file type and oversized-file rejection
- Malformed Gemini output → job fails cleanly with an `errorCode`, doesn't crash the server
- Gemini timeout / rate-limit response handling
- Missing or private GitHub profile → partial analysis with flagged lower confidence, not a hard failure
- Deterministic scoring — same inputs always produce the same score (regression test the formula itself)
- Duplicate `/api/analyze` calls on the same submission don't create duplicate reports or double-spend Gemini quota

---

## 12. Revised Phased Build Order

### Phase 1 — Foundation & Security
- [ ] Node project init, core deps, env validation on startup
- [ ] `GET /api/health` liveness endpoint
- [ ] MongoDB connection with retry-on-startup, explicit `maxPoolSize`
- [ ] `User` schema, auth routes (register/login), JWT + bcrypt, `auth.middleware.js`
- [ ] Rate limiting on auth routes
- [ ] `multer` + `file-type` upload pipeline with all of Section 8's file-security rules from the start
- **Acceptance check:** can register/log in via Postman; a bad file upload (wrong type, oversized, spoofed extension) is rejected correctly; `/api/health` returns `200`.

### Phase 2 — Profile Ingestion
- [ ] `ProfileSubmission` schema, `POST /api/profile`, `GET /api/profile/:id` (excludes full resume_text), `DELETE /api/profile/:id`
- [ ] Resume text extraction (`pdf-parse`)
- [ ] GitHub username normalization + bounded data collection (Section 8), with caching
- [ ] `ownership.middleware.js` enforced on all profile routes
- **Acceptance check:** can upload a real PDF resume + GitHub username; data persists; another student's JWT cannot read/delete it.

### Phase 3 — AI Extraction
- [ ] `geminiService.js` — extraction-only, strict JSON schema validation, retry-once-then-fail
- [ ] `ExtractedSkillProfile` with evidence per skill
- [ ] `GET /api/profile/:id` extended to show extracted skills + evidence for review
- **Acceptance check:** analyzing 3 different real resumes produces plausible skills with evidence text that actually traces back to the resume/GitHub input; a deliberately malformed Gemini response is caught and doesn't crash the server.

### Phase 4 — Deterministic Scoring
- [ ] Seed `SkillOntology` for SDE and ML Engineer roles, with embedding model/version recorded
- [ ] Seed `ResourceCatalog` with a handful of verified resources per common gap skill
- [ ] `embeddingService.js` — per-skill embedding + normalized cosine similarity
- [ ] `scoringService.js` implementing Section 6's exact formula
- [ ] `POST /api/analyze` as an async job (queued → processing → completed/failed), `GET /api/analyze/:id/status`, `GET /api/report/:id`
- **Acceptance check:** the same submission analyzed twice produces the identical score (formula is deterministic); status polling correctly reflects job progress.

### Phase 5 — Report & Frontend
- [ ] Vite + React scaffold, `AuthContext`, login/register pages
- [ ] Upload flow (resume + GitHub username + target role)
- [ ] Extracted-skill review screen (skills + evidence, before scoring)
- [ ] Score dashboard: score, strong/developing/gap breakdown, study plan with resource links, checkbox wired to the PATCH endpoint
- **Acceptance check:** a student can go signup → upload → review extracted skills → see their score and study plan, no manual API calls.

### Phase 6 — Progress Tracking
- [ ] `GET /api/report/history` (own history only) + Recharts trend line
- **Acceptance check:** re-uploading after editing a resume shows a visible score change and updates the trend chart; a second student's JWT cannot fetch the first student's history.

### Phase 7 — Optional Integrations (post-MVP, only after Phase 6 is demoed and stable)
- [ ] LeetCode integration, with an explicit fallback if the endpoint is unavailable
- [ ] `placement_cell` role + cohort dashboard (`/api/cohort`, `/api/cohort/export`), restricted to that role and admin
- [ ] DOCX resume support

### Phase 8 — Hardening & Deployment
- [ ] Full pass through Section 10's checklist and Section 11's test list
- [ ] Observability baseline (Section 10's logging spec — job lifecycle + call failures, no sensitive data)
- [ ] `docs/API.md`, `docs/SETUP.md`, `docs/SCHEMA.md`
- [ ] Test evidence: screenshots of a real analysis run + a sample report, for the deliverables list

---

## 13. Suggested Presentation Outline (10–15 slides)

1. Title + problem statement
2. The gap: academic learning vs. industry expectations
3. Solution overview (continuous-feedback-loop framing, not just "an assessment tool")
4. Pipeline diagram: Input → AI extraction (with evidence) → deterministic scoring → gaps & study plan → tracking
5. Architecture diagram: React → Express → MongoDB, AI/embedding services and GitHub branching off the server
6. AI skill-extraction walkthrough (resume/GitHub → Gemini → structured skills + evidence)
7. Scoring methodology — show the actual formula, explain why it's deterministic rather than model-decided
8. Sample readiness report (score, strong/developing/gap breakdown)
9. Study plan generation from the curated resource catalog
10. Progress tracking over time (score trend example)
11. Security/reliability design choices (auth, upload validation, async job handling)
12. Tech stack deep dive
13. Challenges & solutions (Section 9)
14. MVP scope vs. roadmap (what's deferred and why)
15. Demo / Q&A

---

## 14. Remaining Risk Mitigations

These apply on top of Section 9's fragility list — concrete handling, not just awareness:

**LeetCode (when Phase 7 revisits it):** treat it as a pure enrichment layer, never a required input. If the endpoint is unreachable or the format changes, the analysis must still complete using resume + GitHub alone — LeetCode data should only ever raise confidence, never block a job.

**GitHub rate limits:** the dedicated-token, per-username caching, and bounded-collection rules in Section 8 are the primary defense. If a burst of uploads still exhausts the quota, the job should degrade to resume-only extraction with GitHub flagged unavailable rather than queuing indefinitely or failing outright.

**Resume parsing variance:** keep a small fixed set of representative sample resumes (different templates/layouts, at least one deliberately messy one) in the test suite, and run extraction against all of them on every change to `geminiService.js` or the PDF-parsing step — a regression here should fail CI, not surface later as "the demo resume didn't extract right."

**Ontology staleness:** add a simple admin-only endpoint or CLI script (`scripts/refresh-ontology.js` is fine) that lets you update a role's skill weights and re-embed affected skills without touching application code. This doesn't need a UI for v1 — a script an admin runs manually is enough.

**Embedding model drift:** pin one embedding model and version for v1 and record both fields on every `SkillOntology` entry (already in the schema, Section 3) — don't silently pick up a newer model version. Add a regression test that re-runs the scoring pipeline against a fixed set of sample skill profiles after any embedding-library or model-version upgrade, and asserts the resulting scores stay within a small tolerance of the previous run. A drifting score with no code change is a signal to investigate, not ship.

---

## 15. Handoff Prompt (copy-paste to start the agent)

> Build the AI-Assisted Placement & Skill-Gap Tracker described in this document. Implement the MVP scope in Section 7 first — do not start on anything in the deferred list until Phase 6 is complete and demoed. Work through Section 12's phases in order. Scoring must be deterministic per Section 6's formula — never let Gemini determine the final score. Apply Section 10's security checklist as you go, not as a final pass, especially the file-upload and authorization rules. Use the exact bounds and policies specified throughout (GitHub collection limits, file-size cap, retry/backoff timings, idempotency key) rather than inventing your own defaults. Apply Section 14's mitigations for the remaining known risks as you build the relevant piece, not afterward. Flag anything in Section 9 as soon as you hit it rather than silently working around it. Ask me before making an architectural decision this doc doesn't already specify.

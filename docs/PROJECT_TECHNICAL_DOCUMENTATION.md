# Vortex technical project documentation

Implementation inspection and safe deployment checks: 2 October 2026. This document describes the combined local implementation. Production test claims are limited to the evidence in `INTEGRATION_STATUS.md`.

## 1. Project overview

Vortex is a job posting and skill readiness workspace for students and placement administrators. A student can search jobs, apply, save roles, upload a PDF resume, review extracted technical skills, compare them with a target role, and follow a curated study plan. An administrator can manage postings, review application records and candidate evidence, and update application statuses.

AI is used to extract and explain supplied evidence. The backend validates structured extraction/evidence and computes the readiness score. The assistant is instructed to summarize server-built student or admin context without making hiring decisions, and exposes no hiring-decision write action. Free-form answers are not deterministically fact-checked and can still contain model errors.

## 2. Problem statement

Job applications, resume evidence, and preparation plans are often managed separately. Students may know a technology's name without being able to explain what they have built with it. Placement teams need a consistent view of roles, applications, attached resumes, and preparation evidence. Vortex connects these records while keeping unsupported model claims out of the scoring pipeline.

## 3. Objectives

- Help students find jobs by technologies, keywords, experience, and location.
- Keep each application and its associated preparation evidence reviewable.
- Compare demonstrated technical skills with weighted role requirements.
- Turn verified gaps into plans using a controlled learning-resource catalog.
- Enrich resume evidence with optional public GitHub/LeetCode data and user-provided LinkedIn text.
- Keep authentication, ownership, scoring, and privacy controls authoritative on the backend.

## 4. Actual technology stack

| Layer | Used implementation |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, JavaScript/JSX, custom CSS |
| UI/interaction | Manrope font, Motion, Anime.js, Lenis, Recharts |
| Frontend state | React Context, hooks, component state, URL search parameters, localStorage |
| API | Node.js 22 ESM, Express 5, Axios |
| Database | MongoDB-compatible database through Mongoose 9 |
| Validation | Zod 4 |
| Authentication | JWT, bcrypt, one active session per account |
| Text generation | Groq by default; Gemini text mode/fallback can be configured |
| Embeddings | Gemini REST API |
| PDF extraction | unpdf; no OCR service |
| Security | Helmet, express-rate-limit, role/ownership middleware, validated upload flow |
| Tests | Vitest, Testing Library, Supertest, mocked provider fixtures |
| Current public hosts | Cloudflare Pages frontend, Vercel serverless backend |

This is a MERN application. It is not a Next.js or TypeScript migration, and it does not use Redux or a durable background worker system.

## 5. Actual deployment architecture

```text
Browser
  -> Cloudflare Pages static React/Vite frontend
  -> Vercel Node function: backend/api/index.js
       -> Express routes under /api
       -> MongoDB via Mongoose
       -> Groq text provider
       -> Gemini embeddings
       -> GitHub public REST (optional)
       -> LeetCode public GraphQL (optional)
       -> Resume storage provider contract -> filesystem fallback
```

Repository references and safe HTTP checks confirm these public URLs:

- Frontend: https://vortex-6g7.pages.dev
- Backend API: https://vortex-api-eta.vercel.app/api
- Liveness: https://vortex-api-eta.vercel.app/api/health
- Repository: https://github.com/maayav/Job-Posting-Portal

The database vendor, deployed commit, provider environment values, and production persistence are not established by those checks. Local release instrumentation adds frontend `/build-info.json` and backend `X-Vortex-Revision` when `VERCEL_GIT_COMMIT_SHA` is available; their live presence/revision still needs verification. Health returns `{status,timestamp}` without a database readiness check. See `../DEPLOYMENT.md` for exact hosting configuration and release verification.

## 6. Frontend architecture

`frontend/src/main.jsx` mounts the router, authentication/theme contexts, smooth-scroll integration, and `App`. `frontend/src/App.jsx` uses route-level lazy imports and a loading fallback. The central Axios client reads the public `VITE_API_URL`, defaults to the local `/api` proxy, attaches a bearer token, and clears local auth on an unauthorized response.

| Route | Frontend access | Purpose |
|---|---|---|
| `/` | Public | Product landing page and role guide |
| `/login` | Public | Login/registration |
| `/jobs` | Authenticated | Job search, save and application actions |
| `/dashboard` | Authenticated | Student or admin dashboard |
| `/analyze` | Student | Resume/profile analysis |
| `/analysis/new` | Authenticated | Same analysis workflow through a second route |
| `/assistant` | Authenticated | Student/admin assistant |
| `/admin/jobs` | Admin | Job management |
| `/applications` | Authenticated | Own application history |
| `/admin/applications` | Admin | Application and candidate review |

The frontend guard controls navigation, but backend middleware makes the authorization decision. Theme is persisted locally. Passwords and provider keys are not frontend configuration values.

## 7. Backend architecture

`backend/server.js` is the long-lived local/server entry point. `backend/src/app.js` assembles the Express application. `backend/api/index.js` exports the Vercel handler, reuses the database connection between warm invocations, and answers health before database work.

Routes call controllers, which validate input and coordinate models/services. Services implement PDF extraction, provider access, evidence validation, embeddings, scoring, storage, study plans, sessions, and notifications. Middleware provides CORS, request-body limits, rate limits, authentication, roles, ownership, upload validation, and centralized errors.

## 8. Authentication flow

Registration creates a student account with a bcrypt password hash. Login verifies the hash and creates an active session identifier. JWT claims include the user, role, and session identity. Protected requests reload the user and compare the active session before accepting the token. Logout invalidates the active session.

The browser stores the JWT in localStorage. There is no refresh-token or cookie-based authentication flow. A second active session is controlled by the current session rules; there is no user-facing session listing or logout-all endpoint.

## 9. Authorization and role assignment

Roles are `student` and `admin`. Public registration cannot request admin access. Admin creation/promotion is a controlled CLI operation through `backend/scripts/create-admin.js`; no admin user-management API is implemented.

Students own their profiles, reports, wishlist, notifications, and applications. Admin-only routes manage jobs and review applications. Owner/admin checks protect resume access. A student cannot load another candidate's report by guessing its identifier. Password hashes and session secrets are excluded from normal serialized responses.

## 10. Database models and relationships

| Model | Responsibility and relationships |
|---|---|
| `User` | Identity, role, password hash, active session |
| `Job` | Posting title/company/location/skills/experience/status; references creator |
| `Application` | References applicant and job; contact/resume/cover letter/status/history; captured profile/report references |
| `ProfileSubmission` | References user; PDF reference/text, target role, optional external profile inputs, extraction state |
| `ExtractedSkillProfile` | References submission; skills, provenance, proficiency signals, embedding cache |
| `ReadinessReport` | References submission; target role, score, strengths/developing/gaps/plan, lifecycle state |
| `SkillOntology` | Canonical required skills, categories, weighted target roles, pinned vectors |
| `ResourceCatalog` | Curated learning resources by canonical skill |
| `GitHubCache` | Public repository enrichment keyed by normalized username |
| `WishlistItem` | User/job saved-role relationship |
| `Notification` | User-scoped application/system events |

Model-defined unique indexes protect email identity, duplicate applications, wishlist duplicates, and concurrent active reports when the indexes exist. The active-report constraint is named `one_active_analysis_per_submission`, unique on `{submission_id: 1}` with a partial filter for queued/processing statuses. It replaces the weaker compound submission/status design. Production `autoIndex` is disabled, so these indexes require an explicitly reviewed operator migration; production index state was not inspected or changed in this audit. Profile submissions have a user/submitted-at lookup index. GitHub cache uses expiry cleanup. These constraints do not substitute for an operational migration, backup, or retention policy.

## 11. Job search and filtering

Authenticated job listing supports skills, general keywords, experience, city, ordering, and pagination. The shared synonym map canonicalizes names so aliases can match stored technologies. The mock job/catalog scripts cover technologies beyond MERN, including backend, data, ML, cloud, and AI Engineer preparation.

Students normally see open postings. Admin listing can request status information; the `includeStatus` query is parsed explicitly rather than treating the text `false` as truthy. Admins create/update postings and delete/archive according to the existing job behavior. There is no separate verified `GET /api/jobs/:id` route.

## 12. Application workflow

A student applies to a job with contact email, optional cover letter, and a selected resume source: profile resume, application PDF, no resume, or a validated external URL accepted by the API. External URLs must use HTTPS and contain no embedded credentials. The normal frontend flow uses profile/upload/none.

The database unique applicant/job constraint blocks duplicates when installed. The frontend treats a 409 as an existing application only when its code is `already_applied`; `profile_resume_unavailable` stays visible as an error. Selecting upload without choosing a PDF is stopped before submission. Application status changes append actor/date history and create notifications. Status values are validated; a restrictive business transition graph is not implemented. Withdrawal, account deletion, and a student application-detail endpoint remain outside the current product scope.

## 13. Admin candidate-review workflow

The dashboard and applications pages show role totals, application status filters, candidate records, and protected detail/resume actions. Candidate evidence is associated with the application rather than assumed to be the student's current profile.

New applications set `reviewSnapshotAt` even if no profile/report is available, and capture `profileSubmissionId` and `readinessReportId` when applicable. A missing saved profile produces no review; a missing saved report produces no score. Saved references never silently switch to a later submission/report. Legacy records with no capture timestamp or references may use the latest records for compatibility.

These are captured references, not immutable copies: re-extracting the same profile can change its extracted evidence. Deleting a profile removes its reports and can leave a saved application reference unavailable. The UI must represent unavailable evidence rather than implying it is the original record.

`resumeSource` distinguishes `profile`, `application_upload`, `external_url`, and `none`. An explicit no-resume choice never falls back to a profile PDF. Choosing a missing profile resume fails with `profile_resume_unavailable` instead of silently applying without it. Resume downloads require applicant-owner/admin authorization and private/no-store caching. Admin details expose `hasResume` so a directly uploaded PDF remains visible even when there is no analysis/profile reference.

## 14. New Analysis workflow

```text
PDF + target role + optional external inputs
  -> multipart/file signature/size validation
  -> readable text extraction and resume heuristic
  -> optional public GitHub enrichment
  -> optional public LeetCode language counts
  -> optional LinkedIn text supplied by the user
  -> text-provider structured extraction
  -> Zod schema and source/evidence validation
  -> skill merge/canonicalization and embedding cache
  -> ontology model/version validation
  -> exact canonical/category matching
  -> weighted readiness score and prioritized gaps
  -> curated resource plan and optional AI explanations
  -> saved completed report
```

PDF inputs are capped at 4 MiB on Vercel or 5 MiB elsewhere, 30 pages, and 60,000 extracted characters. PDFs above the page/text limit return `resume_too_long` before storing/sending the extracted text. No OCR is performed.

A failed extraction shows a retry action using the saved submission/PDF rather than requiring another upload.

Failed optional profiles degrade separately from the required resume. Provider/validation failures are surfaced with codes and retry controls. Profile extraction and report analysis have separate statuses. Reports store `queued`, `processing`, `completed`, or `failed`. Reconciliation fails active reports older than ten minutes when the long-lived server starts, on the first Vercel database connection, or when a new analysis is requested. Status polling does not run reconciliation, and no scheduled reaper is configured. Retry recovery therefore depends on one of those triggers.

Concurrent analysis requests rely on the active partial unique index. If creation loses an `E11000` race, the request follows the winning active report with HTTP 202 instead of returning a generic server error. The response uses the updated completed/failed status after synchronous work.

Vercel awaits analysis before responding. The 60-second function cap remains a reliability limit; reconciliation is not a durable job queue or proof that every production request completes.

## 15. GitHub integration

GitHub enrichment uses the official public REST API at `https://api.github.com`. Input accepts a username, optional leading `@`, or normalized GitHub URL. Requests go to the fixed provider destination rather than arbitrary submitted hosts.

The service checks user existence and reads up to ten recently pushed repositories, excluding forks. It collects names, primary languages, language byte counts, topics, pushed dates, README excerpts up to 800 characters, and `package.json`/`requirements.txt` content up to 2,000 characters each.

Requests have at most 15 seconds per call and a 25-second overall enrichment deadline. Successful results cache for 24 hours; MongoDB TTL cleanup makes old cache entries eligible for removal after seven days. Cache failure does not discard useful provider results. There is no negative cache claim.

Missing users become `not_found`; rate limits/timeouts/provider failure become `unavailable`. Individual absent README/language/manifest requests are tolerated. A GitHub token is optional for higher provider quota. Language metadata is weak evidence and cannot alone establish production proficiency.

Mocked tests cover behavior. A real public profile request and the deployed upload-to-analysis chain have not been verified in this audit.

## 16. LeetCode integration

LeetCode is retained as an optional source. It uses the public website GraphQL endpoint, not an official authenticated API or private account connection. It asks for language names and positive solved-problem counts, keeps at most 20 entries, bounds response size to 100,000 bytes, and uses a 10-second timeout.

No cookies, passwords, private activity, cache, or login automation are used. Failure becomes `unavailable` and cannot block resume/GitHub extraction. Evidence is labeled `leetcode`; problem counts do not establish frameworks, employment, or professional proficiency. Live provider behavior may change and is not claimed to work in production without a controlled test.

## 17. LinkedIn integration

The submission supports `linkedinUrl`, `linkedinSummaryText`, and `linkedinDataSource`. Valid URLs use HTTPS on `linkedin.com`/`www.linkedin.com` and a public `/in/<profile>` path; the service normalizes the URL and rejects other hosts or embedded credentials.

Vortex never fetches LinkedIn pages, logs into LinkedIn, or claims official API support. Users may paste selected About/profile text, limited to 10,000 characters. Evidence is labeled `linkedin_user_provided`. A URL alone is never supplied to extraction as technical evidence. Titles, company names, and bare keywords do not justify invented experience or a high proficiency claim.

Source text is untrusted input. It is rendered as text and source markers are sanitized before assembling provider input. The new fields are locally implemented and tested with fixtures; their deployed behavior remains unverified.

## 18. AI pipeline and provider selection

`AI_TEXT_PROVIDER` selects the configured text client. Groq is the default for extraction, study-plan explanations, and assistant replies; Gemini text mode/fallback is available through configuration. Gemini remains the embedding implementation. API keys stay on the backend; Gemini keys are sent in a header rather than query strings.

Structured generation is parsed and validated before saving. Provider timeouts, busy responses, configuration errors, invalid JSON, and transient failures are converted into application errors. Provider retries and model fallbacks can still extend request duration. No provider call made in this audit proves production quota, model availability, or completion latency.

## 19. Skill extraction schema and provenance

Each skill contains a specific name, one category, source identifiers, bounded evidence excerpts, and proficiency signals:

```js
{
  name: 'Python',
  category: 'language',
  sources: ['resume'],
  evidence: [{ source: 'resume', text: 'Built a Python reporting script' }],
  proficiency_signals: {
    projects_count: 1,
    has_production_usage: false,
    mentions_depth: 'medium'
  }
}
```

Categories cover languages, frontend/backend frameworks, databases, ML frameworks, DevOps/cloud/testing tools, and other technical skills. Sources are `resume`, `github`, `linkedin_user_provided`, and `leetcode`. Soft skills and absent technologies must not be invented.

The backend checks that skill names appear in supplied data and evidence excerpts occur in their declared source. Unsupported evidence is removed. Bare keywords receive low depth and no production/project claims. Confidence derives from evidence-bearing source diversity; it is not a hidden readiness bonus.

## 20. Skill normalization

The explicit synonym map merges casing and known aliases into canonical names. Duplicate skill entries combine evidence and retain bounded proficiency signals. Category compatibility is applied during matching. Normalization does not turn one distinct framework/language into another: React cannot satisfy PyTorch, JavaScript cannot satisfy Python, and UI/UX cannot satisfy React engineering.

## 21. Scoring behavior

Normal scoring matches exact canonical skill names with category gates. Candidate/ontology embeddings are generated, cached, and validated for model/version/dimension compatibility, but normal readiness matching does not currently use semantic cosine similarity to match different technologies.

An exact supported match can reach 1. A skill with no evidence is capped at 0.4; low-depth evidence is capped at 0.65. The highest valid candidate match for each required skill is used. Repeating a skill across sources does not independently raise its score.

## 22. ATS and readiness calculation

The report score is the rounded weighted readiness value:

```text
score = round(100 × sum(role weight × best skill match) / sum(role weights))
```

Strong skills score at least 80%; developing skills score 60–79%; gaps score below 60%. Gap priority uses the role weight and remaining match deficit, normalized relative to the largest deficit.

The frontend/API may expose `atsScore` and `roleReadinessScore` from the same saved score. This is the project's preparation metric, not certification by an employer's applicant-tracking system or a prediction of hiring success. There is no separate independently validated ATS engine.

## 23. Curated resources and study plans

Plans start from the canonical gap list and verified `ResourceCatalog` URLs. Resource hydration normalizes skill names, looks up the curated catalog, and returns server-controlled links. AI can explain objectives, suggested exercises/projects, and plan structure, while resource links remain controlled by the catalog. Developing skills can also receive a lower-priority plan.

Users can mark plan items done. Catalog scripts can validate links, but a catalog record alone is not proof every external site remains available forever. Production link availability and user progress persistence need their own checks.

## 24. AI Assistant context and limits

Students need a completed report they own. If no completed analysis exists, the backend returns HTTP 409 `analysis_required`; the frontend presents a useful explanation and a New Analysis link. Explicit report IDs still require completed status and ownership.

Student prompts contain saved target role, scores, demonstrated skills/evidence, strengths, developing skills, gaps, and curated plans. Admin prompts contain server-derived open roles, application/status totals, and selected candidate evidence. Candidate reviews use each application's captured profile/report references, including an explicitly captured absence; deleted/null captured records never fall back to newer evidence. Only legacy applications without captures use latest-record compatibility. Aggregate counts come from database data; candidate context coverage is bounded/reported where implemented. An answer must state when a detail is absent.

User questions are capped at 1,200 characters. At most 12 history entries are accepted; each is clamped to 4,000 characters, and the provider prompt retains only the last four with 1,800 characters each. Long prior replies are clamped instead of invalidating the next turn. The admin context retains exact aggregate totals while limiting details to 200 recent jobs and 250 recent applications, and discloses coverage. It cannot claim every candidate detail was included. Replies use readable Markdown rendered by the frontend, with safe links. The prompts instruct the assistant to use only supplied facts, avoid invented scores/skills, and avoid hiring decisions or secret disclosure. It has no action that changes saved scores or application statuses, and server context excludes password hashes/provider keys. Free-form output is not deterministically fact-checked; prompt compliance is not guaranteed. Both roles use per-user chat limits, and context/chat responses use private/no-store cache headers. Live student/admin assistant calls were not performed in this audit.

## 25. Resume storage, deletion, and retention

The storage service is a provider contract with save/read/delete/status operations. The active implementation is a filesystem fallback with random references, exclusive writes, and basename/path traversal checks. `RESUME_STORAGE_DIR` permits isolated test storage. Existing plain filename references remain compatible.

Local hosts use `backend/storage`; Vercel uses `/tmp/vortex-storage`. The latter is ephemeral and unshared across instances. Protected application downloads read through the API rather than disclosing local paths/private storage URLs.

Deleting a profile deletes its stored PDF, extracted skill profile, and reports. Applications may keep an unavailable captured reference; that cannot silently select new evidence. No automatic time-based retention policy, remote provider adapter, production migration, or verified durable resume storage is present. Cloudinary/Supabase variable names do not establish any of these.

## 26. Security controls and boundaries

Controls include bcrypt, active-session JWT checks, production secret length validation, student/admin roles, ownership, Zod input validation, PDF signature/size checks, random filenames, protected downloads, source-marker sanitization, evidence grounding, safe external links, Helmet, frontend response headers, restricted production CORS, and private/no-store caching.

AI work has per-user limits: profile upload/retry, report analysis, and assistant chat. Global/auth IP limits also exist. Error logging uses safe metadata and avoids tokens, credentials, full profile text, and request-derived URLs.

The static frontend headers now define HSTS, frame denial, content-type protection, referrer policy, and CSP. CSP restricts scripts to the frontend origin, permits inline styles for Motion/dynamic layout, and restricts connections to the frontend and confirmed Vercel API origin. Theme initialization is a synchronous external `/theme-init.js` script so inline JavaScript is unnecessary. A future API-origin change requires updating the CSP connection allowlist and rebuilding. These header changes are local and not yet verified on Cloudflare; backend Helmet alone does not protect static frontend HTML.

Remaining limits include localStorage tokens, in-memory per-instance rate limiting, no per-account distributed login lockout, no full audit-log model, ephemeral Vercel resumes, no retention policy, and the function-duration cap. An allowed CORS origin is not authorization, and a healthy endpoint is not proof of database/provider readiness.

## 27. API endpoint table

All paths below are relative to `/api`. Methods/access reflect route middleware and controller ownership checks.

| Method/path | Access | Purpose |
|---|---|---|
| `GET /health` | Public | Liveness JSON |
| `POST /auth/register`, `POST /auth/login` | Public, auth limiter | Student registration/login |
| `POST /auth/logout` | Authenticated | Invalidate active session |
| `POST /profile` | Authenticated, profile limiter | PDF/input validation and extraction |
| `GET /profile/:id`, `DELETE /profile/:id` | Owner/admin | Read/delete submission |
| `POST /profile/:id/retry-extraction` | Owner/admin, profile limiter | Retry extraction |
| `POST /analyze` | Authenticated, analysis limiter; submission ownership | Start/reuse report |
| `GET /analyze/:id/status` | Report owner/admin | Poll report state |
| `GET /report/history`, `GET /report/roadmap` | Authenticated user scope | History/roadmap |
| `GET /report/:id` | Report owner/admin | Read report |
| `PATCH /report/:id/study-plan/:itemId` | Authenticated; controller ownership | Update completion |
| `GET /users/:userId/reports` | Admin | Candidate reports |
| `GET /roles`, `GET /skills` | Authenticated | Search/catalog metadata |
| `GET /jobs` | Authenticated | Filter/paginate jobs |
| `POST /jobs`, `PUT /jobs/:id`, `DELETE /jobs/:id` | Admin | Manage posting |
| `POST /applications` | Student | Apply with selected resume source |
| `GET /applications/me` | Authenticated user scope | Own applications |
| `GET /applications/:applicationId/resume` | Applicant owner/admin | Protected resume download |
| `GET /admin/applications` | Admin | Filter/paginate candidates |
| `GET /admin/applications/:applicationId` | Admin | Captured candidate review |
| `GET /admin/applications/:applicationId/resume` | Admin | Protected download |
| `PATCH /admin/applications/:applicationId/status` | Admin | Change validated status |
| `GET /admin/dashboard`, `GET /admin/dashboard/application-summary` | Admin | Role/status totals |
| `GET /wishlist`, `POST /wishlist`, `DELETE /wishlist/:jobId` | Student | Saved jobs |
| `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` | Authenticated user scope | Notification reading |
| `GET /assistant/context`, `POST /assistant/chat` | Authenticated; chat limiter | Grounded student/admin assistant |

There is no LinkedIn scraping route, standalone deployed public GitHub/LeetCode proxy, database-readiness route, account-management API, or automatic resume-retention endpoint.

## 28. Environment-variable names

Values are deliberately excluded. The deployed presence of a variable cannot be inferred from the example file.

```text
NODE_ENV
PORT
MONGO_URI
MONGODB_URI
JWT_SECRET
JWT_EXPIRES_IN
CLIENT_URL
AI_TEXT_PROVIDER
AI_EMBEDDING_PROVIDER
AI_TEXT_FALLBACK_PROVIDER
GROQ_API_KEY
GROQ_MODEL
GROQ_FALLBACK_MODELS
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_EMBEDDING_MODEL
EMBEDDING_MODEL
EMBEDDING_VERSION
GITHUB_TOKEN
VITE_API_URL
CF_PAGES_COMMIT_SHA
VERCEL_GIT_COMMIT_SHA
GITHUB_SHA
RESUME_STORAGE_DIR
ADMIN_PASSWORD
INTEGRATION_TEST_GITHUB_USERNAME
INTEGRATION_TEST_LEETCODE_USERNAME
TEST_MONGO_URI
TEST_RESUME_STORAGE_DIR
RUN_DRIFT_TEST
```

Runtime-provided `VERCEL` controls serverless behavior. `TEST_MONGO_URI` selects a loopback-only MongoDB endpoint; the harness generates a UUID-named `vortex_test_...` database per run. `TEST_RESUME_STORAGE_DIR` is a generated temporary directory. The guards refuse remote/authenticated MongoDB URLs and any database name outside the disposable pattern. `RUN_DRIFT_TEST` is an explicit external-provider evaluation opt-in and is not used by normal mocked tests. Storage-provider variable names in examples are reserved placeholders until a provider is integrated.

## 29. Testing strategy

Normal tests use generated PDFs and mocked GitHub, LeetCode, Groq, and Gemini responses. They cover normalization, optional provider failure, evidence/source validation, exact scoring, owner/admin privacy, application snapshots, plan resources, assistant validation, storage behavior, and rate limits. Frontend tests cover forms, navigation, and rendered states.

The baseline backend harness dropped a fixed test database. It was not run against a possibly shared database; isolated mock suites bypassed those hooks. The current harness uses a loopback-only, UUID-named disposable database and temporary resume directory per run. Cleanup is guarded before dropping that database; remote/authenticated MongoDB URLs and fixed database names are refused. Provider tests normally use mocks; optional drift runs require deliberate opt-in and real provider quota. No test fixture should contain real profile data or production secrets.

Baseline: 45 frontend tests/build passed; lint passed with existing warnings; isolated backend integration tests 8 passed and AI/source tests 9 passed. Final local results: backend 306 tests passed with two drift skips (26 passing files, one skipped); frontend 51 tests and production build passed; lint reported 17 existing warnings/no errors. The focused regression run passed 52 tests and the isolated unit run passed 141 tests; those runs overlap the full suite and must not be summed. Backend/runtime and frontend dependency audits reported zero vulnerabilities. CSP/theme checks, changed backend JavaScript syntax, and diff checks passed. A scan of 80 release files found only a generic credential placeholder in the environment example; real `.env` files are ignored. The source release was pushed; deployment verification remains unresolved in `BASELINE_AUDIT.md`.

## 30. Known limitations

- Production auth, AI, external enrichment, new LinkedIn inputs, durable database writes, and resume downloads have not been tested with safe demo identities during this audit.
- The production database vendor/configuration, deployed commit, and index state remain unknown until checked operationally. No production index migration was executed; the active-job guarantee requires the named index.
- Optional public provider endpoints and quotas can fail or change.
- No OCR for scanned PDFs, durable worker queue, distributed rate limits, remote resume storage, or automatic retention policy.
- Application capture uses references rather than immutable report/evidence copies.
- The product's ATS label refers to the same preparation score, not an employer-certified metric.
- No password reset/email verification/account-deletion/withdrawal workflow or CI gate is claimed.

## 31. Future improvements

Inspect production active-job duplicates and explicitly apply the reviewed `one_active_analysis_per_submission` index migration before relying on concurrency behavior. Select and verify a private durable storage provider with migration, deletion, and retention tests. Move analysis to a durable queue with a bounded job budget, retries, and monitoring. Add distributed limits and production readiness metrics. Decide account/withdrawal/status-transition policies, then implement those workflows. Add a CI gate and immutable/versioned evidence capture if historical reports must never change.

Semantic scoring is a future option only after evaluation; exact canonical matching remains the current behavior.

## 32. Verified deployment URLs and verification limits

The frontend URL and backend URL listed in section 5 are confirmed by safe requests. Frontend `/`, `/jobs`, `/dashboard`, `/analysis/new`, and `/assistant` returned 200 with SPA fallback. Backend health returned liveness JSON. API preflight accepted the frontend origin and did not reflect an unknown origin.

Those checks do not authenticate, consume AI quota, submit applications, upload resumes, or establish MongoDB persistence. The baseline health shortcut had a CORS inconsistency corrected locally; deployed confirmation is pending. Do not call an integration production-working based on route configuration or local mocks.

## 33. What is currently implemented

- React/Vite product UI with light/dark themes, role-aware navigation, job filters, dashboards, analysis, assistant, and application review.
- Express/Mongoose models/routes, student/admin authorization, active-session authentication, job/application/wishlist/notification workflows.
- Optional official public GitHub REST enrichment and optional LeetCode public GraphQL enrichment.
- LinkedIn URL validation and optional user-pasted text; no scraping.
- Structured extraction with explicit evidence sources, validation, canonical scoring, and curated study plans.
- Student/admin assistant contexts and explicit no-analysis handling.
- Application profile/report capture references, explicit resume-source privacy, protected downloads, local hardening, and storage provider contract.
- Cloudflare Pages/Vercel topology for the confirmed public URLs.

Local implementation and safe live checks are separate evidence. The source release commit/push succeeded. The integration status record describes the remaining deployment/authentication/storage blockers.

## 34. What is not implemented or not verified

- Official LinkedIn/LeetCode authenticated API support or LinkedIn scraping.
- A configured durable remote resume provider, migration, automatic retention, or live durability verification.
- A durable background worker queue or global distributed rate-limit store.
- Production verification of GitHub/LeetCode enrichment, new LinkedIn fields, New Analysis, assistant generation, provider keys/models, or saved progress/database persistence.
- Verified source revisions of the frontend/backend deployment after the local audit changes; new revision markers are configured locally but have not been checked live.
- Direct CLI deployment access: the cached Cloudflare login could not refresh and Vercel CLI explicitly reported Logged out (exit 1). Git-linked deployment remains to be checked after the release attempt.
- Semantic embedding-based readiness matching, immutable application evidence copies, or independent employer ATS certification.
- Account-management, application withdrawal, restrictive business status transitions, full audit logs, and CI features not present in the inspected source.

# Job Portal Integration Audit

## 1. Repository Summary
- Repository name: `pride_proj` — "AI-Assisted Placement & Skill-Gap Tracker"
- Project root: `/home/gman/dev/projects/pride_proj`
- Git initialized: Yes (existing repository; no new repo created)
- Current branch: `main`
- Working-tree state: 9 commits; only two untracked files (`JOB_PORTAL_INTEGRATION_AUDIT_REQUEST.md`, `docs/JOB_PORTAL_INTEGRATION_AUDIT.md`) — no tracked files modified
- Primary stack: MERN — MongoDB 7 + Mongoose 9, Express 5, React 19 + Vite 8, Node 24 (plain ESM JavaScript, no TypeScript)
- Package manager: npm — two independent packages (`backend/`, `frontend/`), each with its own `package-lock.json`; **no root `package.json`, no workspace/monorepo tooling**
- Current application purpose: Students upload a resume (+ GitHub profile); Gemini extracts skills with evidence; skills are matched against a role skill ontology via embeddings; a deterministic readiness score + prioritized study plan are produced; re-uploads track progress over time
- Current implementation status: Placement module complete and tested — auth, profile ingestion, AI extraction, deterministic scoring, async analysis jobs, reports, progress tracking; **35 tests passing + 2 opt-in drift tests; no job-posting code exists anywhere**

## 2. Repository Tree
```text
pride_proj/                              # Git root
├── .gitignore                           # ignores node_modules, .env, dist, coverage, *.log, storage/*
├── EXECUTION_PLAN.md                    # original build spec (placement tracker)
├── README.md
├── JOB_PORTAL_INTEGRATION_AUDIT_REQUEST.md   # this request (untracked)
├── docker-compose.yml                   # single service: mongo:7
├── docs/
│   ├── API.md                           # placement API reference
│   ├── DEVELOPMENT.md                   # living dev log + incident log
│   ├── SCHEMA.md                        # data model reference
│   ├── SETUP.md                         # setup/run/deploy guide
│   └── JOB_PORTAL_INTEGRATION_AUDIT.md  # this report (untracked)
├── backend/
│   ├── .env                             # real values (gitignored) — names listed in §7
│   ├── .env.example                     # blank values
│   ├── package.json / package-lock.json
│   ├── server.js                        # entry point
│   ├── vitest.config.js
│   ├── ontology/
│   │   ├── sde.json
│   │   ├── ml-engineer.json
│   │   └── drafts/new-roles-draft.json  # 8 drafted roles (not live)
│   ├── resources/
│   │   ├── resources.json
│   │   └── resources-extra.json
│   ├── scripts/
│   │   ├── server.js                    # start/stop pidfile helper
│   │   ├── seed-ontology.js
│   │   ├── refresh-ontology.js
│   │   ├── record-drift-baseline.js
│   │   ├── drift-core.js
│   │   ├── ontology-loader.js
│   │   ├── check-resource-links.js
│   │   ├── draft-roles.js
│   │   └── generate-sample-resumes.js
│   ├── sample-resumes/                  # 3 generated PDFs
│   ├── storage/                         # uploaded resumes (not web-served)
│   ├── src/
│   │   ├── app.js                       # Express app + route mounting
│   │   ├── config/
│   │   │   ├── db.js                    # Mongoose connection
│   │   │   └── env.js                   # zod-validated environment
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── profile.controller.js
│   │   │   ├── analyze.controller.js
│   │   │   └── report.controller.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js       # requireAuth, requireRole
│   │   │   ├── ownership.middleware.js  # requireOwnership, requireReportAccess
│   │   │   ├── rateLimit.middleware.js  # authLimiter, analyzeLimiter, apiLimiter
│   │   │   ├── upload.middleware.js
│   │   │   └── errorHandler.js
│   │   ├── models/
│   │   │   ├── user.js
│   │   │   ├── profileSubmission.js
│   │   │   ├── extractedSkillProfile.js
│   │   │   ├── readinessReport.js
│   │   │   ├── skillOntology.js
│   │   │   └── resourceCatalog.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── profile.routes.js
│   │   │   ├── analyze.routes.js
│   │   │   ├── report.routes.js
│   │   │   └── user.routes.js
│   │   ├── services/
│   │   │   ├── geminiService.js
│   │   │   ├── embeddingService.js
│   │   │   ├── githubService.js
│   │   │   ├── resumeService.js
│   │   │   ├── skillService.js
│   │   │   ├── scoringService.js
│   │   │   ├── analysisService.js
│   │   │   └── storageService.js
│   │   └── utils/
│   │       ├── errors.js
│   │       └── retry.js
│   └── tests/
│       ├── setup.js
│       ├── global-setup.js
│       ├── helpers.js
│       ├── auth.test.js
│       ├── profile.test.js
│       ├── analyze.test.js
│       ├── scoring.test.js
│       ├── drift.test.js
│       └── fixtures/drift-baseline.json
└── frontend/
    ├── .env.example
    ├── package.json / package-lock.json
    ├── index.html
    ├── vite.config.js
    ├── .oxlintrc.json
    ├── public/favicon.svg, icons.svg
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── api/client.js
        ├── context/AuthContext.jsx
        ├── components/
        │   ├── ProtectedRoute.jsx
        │   ├── UploadForm.jsx
        │   ├── ExtractedSkillReview.jsx
        │   ├── ScoreCard.jsx
        │   ├── GapList.jsx
        │   ├── StudyPlan.jsx
        │   └── ProgressChart.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── UploadPage.jsx
            └── DashboardPage.jsx
```

## 3. Package and Runtime Setup
- Root package configuration: **none** (no root `package.json`); root holds `docker-compose.yml`, `.gitignore`, `README.md`, `EXECUTION_PLAN.md`, `docs/`
- Backend package configuration: `backend/package.json` — `"type": "module"` (ESM), `"main": "server.js"`, `"private": true`, no `engines` field
- Frontend package configuration: `frontend/package.json` — `"type": "module"`, `"private": true`, Vite + React; no `engines` field
- Scripts:
  - Backend: `dev` (nodemon server.js), `start` (node server.js), `test` (vitest run), `seed`, `refresh-ontology`, `drift-baseline`, `gen-resumes`
    - Note: `"test": "vitest run"` is declared **twice** in `backend/package.json` (harmless duplicate key; housekeeping item)
  - Frontend: `dev` (vite), `build` (vite build), `lint` (oxlint), `preview` (vite preview)
- Dependencies relevant to integration:
  - Backend: `express` ^5.2.1, `mongoose` ^9.10.0, `zod` ^4.6.4, `jsonwebtoken` ^9.0.3, `bcrypt` ^6.0.0, `express-rate-limit` ^8.7.0, `axios`, `dotenv`, `multer`, `file-type`, `pdf-parse`
  - Frontend: `react` ^19.2.8, `react-dom`, `react-router-dom` ^7.18.3, `axios` ^1.20.0, `recharts` ^3.10.1
  - **The Job Portal needs no new dependencies.**
- Test tooling: Vitest ^5.0.0, Supertest ^7.2.2 (backend devDependencies); frontend lint via `oxlint`; no frontend test runner installed
- Node version: not specified in any `package.json` (`engines` absent); runtime in use is **Node v24.13.0**; npm 11.6.2
- Docker-related tooling: root `docker-compose.yml` (mongo:7 only); no Dockerfiles

## 4. Existing Backend
- Entry point: `backend/server.js` — validates env → `connectDB()` (retry) → `ensureStorageDir()` → `app.listen(env.PORT)`
- Express app: `backend/src/app.js` — `express.json({ limit: '2mb' })`, global `apiLimiter`, mounts routers, `notFoundHandler`, `errorHandler`
- API base path: `/api`
- Routes (files + mounting in `app.js`):
  - `src/routes/auth.routes.js` → `/api/auth` (register, login; `authLimiter`)
  - `src/routes/profile.routes.js` → `/api/profile` (all require auth; POST uses upload middleware; GET/DELETE use `requireOwnership`)
  - `src/routes/analyze.routes.js` → `/api/analyze` (require auth; POST `analyzeLimiter`; status via `requireReportAccess`)
  - `src/routes/report.routes.js` → `/api/report` (require auth; `/history` own-only; `/:id` + PATCH study-plan via `requireReportAccess`)
  - `src/routes/user.routes.js` → `/api/users` (requireAuth + `requireRole('admin')`; `GET /:userId/reports`)
- Controllers/services: thin controllers (`auth`, `profile`, `analyze`, `report`) delegating to services (`geminiService`, `embeddingService`, `githubService`, `resumeService`, `skillService`, `scoringService`, `analysisService`, `storageService`); shared `AppError` from `utils/errors.js`
- Models: `user`, `profileSubmission`, `extractedSkillProfile`, `readinessReport`, `skillOntology`, `resourceCatalog` (+ an internal `GitHubCache` model defined inside `githubService.js`)
- Middleware: `requireAuth`, `requireRole(role)`, `requireOwnership(Model)`, `requireReportAccess`, `authLimiter`, `analyzeLimiter`, `apiLimiter`, `uploadResume` + `validateResumeFile`, `notFoundHandler`, `errorHandler`
- Validation: **zod** — env schema in `src/config/env.js`; request schemas inline in controllers (`auth.controller.js`, `profile.controller.js`, `analyze.controller.js`); zod `ZodError` mapped to `400 validation_error` in `errorHandler.js`
- Database connection: `src/config/db.js` — Mongoose `connectDB({ retry })` with `maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`, 5 startup attempts with exponential backoff; `disconnectDB()` for tests/scripts
- Error handling: centralized `errorHandler.js` — maps `AppError`, `ZodError`, multer errors (`413 file_too_large`), malformed JSON, Mongo duplicate key (`409`), CastError, ValidationError; default `500 internal_error`; never leaks stack traces
- Health endpoint: `GET /api/health` → exactly `{ status: "ok", timestamp: <ISO-8601 UTC> }`, no extra fields
- Port: backend `5000` (`PORT` env, default 5000)
- Reusable code: auth middleware + `requireRole('admin')`, rate limiters, zod pattern, `AppError`/`errorHandler`, `connectDB`, `pagination`-free but consistent JSON conventions, `scripts/server.js` start/stop helper, seed-script pattern (`seed-ontology.js`)

## 5. Existing Frontend
- Entry point: `frontend/src/main.jsx` — `StrictMode` → `BrowserRouter` → `AuthProvider` → `App`
- Router: `react-router-dom` v7; `src/App.jsx` declares `/login` (public), `/` (UploadPage, wrapped in `ProtectedRoute`), `/dashboard` (protected). No nested layouts, no role-based routing
- Pages: `LoginPage.jsx` (login + register tabs in one page), `UploadPage.jsx` (upload → extracted-skill review → analyze polling), `DashboardPage.jsx` (score, breakdown, study plan, progress chart)
- Components: `ProtectedRoute`, `UploadForm`, `ExtractedSkillReview`, `ScoreCard`, `GapList`, `StudyPlan`, `ProgressChart`
- API client: `src/api/client.js` — axios instance `baseURL: '/api'`; request interceptor adds `Authorization: Bearer <token>` from `localStorage`; response interceptor clears session + redirects to `/login` on 401; exports `errorMessage(err)`
- Auth state: `src/context/AuthContext.jsx` — React Context with `user`, `login(email,password)`, `register(name,email,password)`, `logout()`; user object stored in `localStorage['user']`
- Token storage: `localStorage['token']` + `localStorage['user']` (no cookies, no refresh token)
- Protected routes: `ProtectedRoute.jsx` checks only that a user exists (no role check)
- Styling: single plain-CSS file `src/index.css` (dark theme, CSS variables, cards/chips/badges); no CSS framework or component library
- Port: frontend `5173` (Vite); dev proxy `/api` → `http://localhost:5000` (`vite.config.js`)
- Reusable code: `api` client + interceptors, `AuthContext` (login/register/logout already implemented), `ProtectedRoute`, `errorMessage` helper, existing CSS classes (`.card`, `.primary`, `.error`, `.badge-*`, `.topbar`), page layout pattern (`.page` wrapper + `.topbar` header)

## 6. Authentication and Roles
- Current User schema (`src/models/user.js`): `name` (String, required, trim, max 100), `email` (String, required, unique, lowercase, trim, max 200), `password` (String, required, min 6, `select: false`), `role` (String, enum `['student','admin']`, default `student`), `timestamps: true` (`createdAt`/`updatedAt`); instance method `comparePassword(candidate)`
- Password hashing: bcrypt v6, 10 rounds, `pre('save')` hook (skips if password unmodified); `bcrypt.compare` for login; passwords never selected by default and never returned in responses
- JWT payload and expiry: `{ id: <userId string>, role: <role> }`, signed with `JWT_SECRET`, `expiresIn: JWT_EXPIRES_IN` (default `7d`); verified by `requireAuth`, which sets `req.user = { id, role }`
- Registration behavior: `POST /api/auth/register` — zod-validated `{ name, email, password }` (password ≥ 6 chars); rejects duplicate email with `409 email_taken`; creates user with default `student` role; returns `201 { token, user: { id, name, email, role } }`; **the client cannot supply `role`** (not part of the zod schema)
- Login behavior: `POST /api/auth/login` — zod-validated `{ email, password }`; user fetched with `+password`; generic `401 invalid_credentials` on failure; returns `200 { token, user: { id, name, email, role } }`
- Current roles: `student` (default) and `admin`
- Current authorization middleware: `requireAuth` (401 if missing/invalid/expired), `requireRole('admin')` (403 otherwise, used by `/api/users/:userId/reports`), `requireOwnership(Model)` and `requireReportAccess` (owner-or-admin 403 on profile/report resources)
- Frontend role behavior: role is stored on the user object and displayed in the top bar (`user.role`), but **no route or UI element is role-gated**; `ProtectedRoute` checks authentication only
- Privilege-escalation risks: none found in current auth — registration does not accept `role`; no endpoint allows role changes; JWT is signed server-side; the only admin promotion path is direct DB update (used by tests via `makeAdmin`)
- Recommended seeker/admin mapping: **extend** the enum with `seeker` (keep `student` untouched); treat both `student` and `seeker` as non-admin authenticated users; `admin` already satisfies the portal's admin role via existing `requireRole('admin')`; existing admin JWTs keep working (no re-login needed for existing admins)

## 7. Database, Docker, and Environment
- MongoDB strategy: local Docker container `mongo:7` (`docker-compose.yml`, named volume `mongo_data`, port `27017`); connection via `MONGO_URI` (dev DB `placement_skill_gap`); production Atlas documented in `docs/SETUP.md`; test DB `placement_skill_gap_test`
- Mongoose models: `User`, `ProfileSubmission`, `ExtractedSkillProfile`, `ReadinessReport`, `SkillOntology`, `ResourceCatalog`, `GitHubCache` (internal to `githubService.js`)
- Existing job-like model: **none** — no Job/Vacancy/Posting/Opportunity model, collection, route, or frontend page exists. (The only "job" naming in the codebase is the unrelated async analysis job in `analysisService.js`.)
- Docker configuration: root `docker-compose.yml` with one service (`mongo`), no app-service Dockerfiles, no compose overrides
- Environment variable names only:
  - Backend (`backend/.env`, values never displayed): `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `EMBEDDING_MODEL`, `EMBEDDING_VERSION`, `GITHUB_TOKEN`
  - Frontend: none required in dev; `VITE_API_BASE` documented for production only
  - `.env.example` files exist for both packages with blank values
- Ports: backend `5000`, frontend `5173`, MongoDB `27017`
- CORS: **not configured** (no `cors` package, no origin allowlist); dev works because Vite proxies `/api` to `:5000`; production requires reverse-proxy same-origin or adding CORS
- Seed/migration strategy: no migration framework; idempotent seed scripts — `scripts/seed-ontology.js` (upserts ontology + full-syncs resources), `scripts/refresh-ontology.js`, `scripts/record-drift-baseline.js`, `scripts/generate-sample-resumes.js`; test data seeded per-test via `tests/helpers.js`

## 8. Existing Tests, CI, and Documentation
- Test framework and command: Vitest 5 + Supertest 7; `cd backend && npm test` (or `npx vitest run`); config `backend/vitest.config.js` (`pool: 'forks'`, `fileParallelism: false`, 30s test/hook timeouts, `setupFiles` + `globalSetup`)
- Existing tests: `auth.test.js` (8), `profile.test.js` (11), `analyze.test.js` (9), `scoring.test.js` (7), `drift.test.js` (2, opt-in via `RUN_DRIFT_TEST=1`) — 37 total (35 run + 2 skipped)
- Test database strategy: `tests/global-setup.js` forces `NODE_ENV=test` and `MONGO_URI=mongodb://127.0.0.1:27017/placement_skill_gap_test` and drops that DB once; each suite calls `initDb()` and `clearDb()` between tests; drift mode keeps the real key while other suites use a dummy key
- Mocking strategy: `vi.mock()` for `geminiService` and `embeddingService` (deterministic fake vectors) so tests never call external APIs; live-service tests are opt-in (`RUN_DRIFT_TEST=1`)
- CI configuration: **none** (no `.github/`, no CI YAML)
- Documentation: `docs/API.md`, `docs/SETUP.md`, `docs/SCHEMA.md`, `docs/DEVELOPMENT.md` (living log + incident log), root `README.md`, `EXECUTION_PLAN.md`
- Conventions to preserve: ESM imports with explicit `.js` extensions; zod validation inside controllers; `AppError(message, statusCode, code)` + centralized error handler with `{ error, message }` shape; ownership/RBAC middleware on scoped routes; rate limiters on auth/analyze; no sensitive data in logs or responses; test helpers reused across suites; commit-per-phase workflow; docs updated with behavior changes

## 9. Compatibility Review
- Route conflicts:
  - `/api/auth/*` — **already implemented** (`register`, `login`) and matches the portal's expected paths exactly → must be reused/extended, not duplicated
  - `/api/jobs/*` — completely free; no existing route, model, or frontend page
  - `/api/health` — exists with a canonical response contract; must remain unchanged
  - `/api/admin/*` — does not exist; existing admin-only route is `GET /api/users/:userId/reports` (different namespace)
- Schema conflicts: none with a Job model; the only conflict surface is `User.role` enum (`student`/`admin`) vs the portal's `seeker`/`admin`
- Authentication/role conflicts: none functional — JWT + bcrypt + `requireRole` already satisfy the portal requirements; adding a `seeker` enum value is additive; existing tokens and data remain valid
- Dependency conflicts: none; all required libraries already present in both packages; no new dependency is needed
- Frontend route conflicts: none — existing routes are `/login`, `/`, `/dashboard`; new pages can use `/jobs`, `/jobs/search`, `/admin/jobs`; the post-login landing page for seekers is a product decision
- Data migration concerns: none for existing collections; `User.role` enum extension requires no data migration; new `jobs` collection starts empty and can be seeded
- Security concerns (reported, not fixed): no Helmet security headers; no CORS configuration; no refresh-token/revocation mechanism; no admin audit logging; job `createdBy` must be server-set (never client-supplied); no CI gate; rate limiting is process-local (single instance)
- Existing components/services to reuse: `requireAuth`, `requireRole('admin')`, rate limiters, zod schemas pattern, `AppError` + `errorHandler`, `AuthContext`, axios `api` client, `ProtectedRoute`, `errorMessage`, CSS classes, test helpers (`initDb`, `clearDb`, `registerUser`, `loginUser`, `authHeader`, `makeAdmin`), seed-script pattern

## 10. Proposed Integration Plan

### Backend changes
| Action | File | Purpose |
|---|---|---|
| Create | `backend/src/models/job.js` | Job schema (`title`, `skills: [String]`, `experienceLevel: Number`, `city`, `description`, `createdBy: ObjectId ref User`, timestamps) + indexes |
| Create | `backend/src/controllers/job.controller.js` | `listJobs` (search/filter/pagination), `createJob`, `updateJob`, `deleteJob` |
| Create | `backend/src/routes/job.routes.js` | `GET /` (authenticated), `POST /` (admin), `PUT /:id` (admin), `DELETE /:id` (admin) |
| Create | `backend/tests/jobs.test.js` | Auth requirement, seeker 403 on write routes, admin CRUD, search/filter, validation |
| Modify | `backend/src/app.js` | Mount `app.use('/api/jobs', jobRoutes)` |
| Modify | `backend/src/models/user.js` | Add `'seeker'` to the role enum (additive) |
| Modify | `backend/src/controllers/auth.controller.js` | Optional: accept `role` on register but whitelist to `seeker`/`student` only; never `admin` |
| Modify | `backend/package.json` | Remove duplicate `"test"` key (housekeeping only) |
| Do not touch | auth/profile/analyze/report routes, `/api/health`, upload middleware, existing controllers' response shapes | Preserve all working features |

### Frontend changes
| Action | File | Purpose |
|---|---|---|
| Create | `frontend/src/pages/JobSearchPage.jsx` | Seeker job search: filters + results |
| Create | `frontend/src/pages/AdminJobsPage.jsx` | Admin job management (list + create/edit/delete) |
| Create | `frontend/src/components/JobFilters.jsx` | Skills/experience/city controls |
| Create | `frontend/src/components/JobCard.jsx` | Job result card/list item |
| Create | `frontend/src/components/JobForm.jsx` | Create/edit form (admin) |
| Create | `frontend/src/components/AdminRoute.jsx` | Role-aware guard (`user.role === 'admin'`, else 403/redirect) |
| Modify | `frontend/src/App.jsx` | Add `/jobs`, `/jobs/search`, `/admin/jobs` routes |
| Modify | `frontend/src/pages/LoginPage.jsx` | Only if a seeker-specific registration flow/label is desired (register already exists) |
| Modify | `frontend/src/components/ProtectedRoute.jsx` | Optionally extend with a `requiredRole` prop instead of a separate `AdminRoute` |
| Modify | `frontend/src/index.css` | Styles for job pages (reuse existing card/chip/badge classes where possible) |
| Do not touch | upload/dashboard/report flow, `AuthContext` contract, axios interceptors | Preserve existing behavior |

### Database changes
- New collection `jobs` via `backend/src/models/job.js`
- Fields: `title` (String, required, trim), `skills` (array of trimmed strings, required, non-empty), `skillsLower` (derived lowercase array for index-friendly case-insensitive matching), `experienceLevel` (Number, required, min 0), `city` (String, required, trim), `cityLower` (derived lowercase), `description` (String, required), `createdBy` (ObjectId ref `User`, required, server-set), `timestamps`
- Indexes: `{ skillsLower: 1 }` (multikey), `{ cityLower: 1 }`, `{ experienceLevel: 1 }`, `{ createdAt: -1 }`; optional compound `{ cityLower: 1, experienceLevel: 1 }`
- Relationships: `createdBy` → `User._id`; no cascade deletes required (jobs survive user deletion; `createdBy` may become a dangling reference — decide whether to block user deletion or render "unknown admin")
- No migration needed for existing collections; optional idempotent `backend/scripts/seed-jobs.js` following the existing upsert pattern
- Initial admin: safe CLI script (`backend/scripts/create-admin.js`) that creates or promotes a user with a bcrypt-hashed password; never via public registration. (The dev DB already has an admin account; no credentials are reproduced here.)

### API design
| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public + `authLimiter` | Existing `{ name, email, password }`; optionally `role: "seeker"` (whitelisted) | Existing `201 { token, user }` — unchanged shape |
| POST | `/api/auth/login` | Public + `authLimiter` | Existing `{ email, password }` | Existing `200 { token, user }` — unchanged |
| GET | `/api/jobs` | Authenticated (recommended, matches app pattern) | Query: `skills`, `experience`, `city`, `page`, `limit` | `200 { jobs: [...], page, limit, total, totalPages }` |
| POST | `/api/jobs` | `requireAuth` + `requireRole('admin')` | `{ title, skills, experienceLevel, city, description }` | `201 { job }`; `403` for seeker |
| PUT | `/api/jobs/:id` | `requireAuth` + `requireRole('admin')` | Same as create (partial allowed) | `200 { job }`; `404` if missing; `403` for seeker |
| DELETE | `/api/jobs/:id` | `requireAuth` + `requireRole('admin')` | — | `204`; `404` if missing; `403` for seeker |

Compatibility notes: no existing endpoint is renamed or removed; `/api/auth/*` and `/api/health` keep their exact current contracts; `/api/jobs` is a new namespace with no collisions; global `apiLimiter` already covers the new routes; errors follow the existing `{ error, message }` convention (`forbidden`, `validation_error`, `not_found`).

### Search behavior
- `skills` — comma-separated list, **ANY-match** (OR) semantics, case-insensitive, trimmed; e.g. `?skills=react,node.js` matches jobs containing either skill. Rationale: all-match (AND) hides relevant jobs; an `skillsMode=all` option can be added later without breaking clients
- `experience` — interpreted as the **seeker's years of experience**; returns jobs whose `experienceLevel <= experience` (jobs the seeker qualifies for); e.g. `?experience=3` returns jobs requiring 0–3 years
- `city` — case-insensitive **exact** match on trimmed value (via `cityLower`), e.g. `?city=Bangalore` matches `bangalore`/`BANGALORE`
- Pagination: `page` (default 1, min 1) and `limit` (default 20, min 1, max 50, values above max are clamped)
- Sorting: `createdAt` descending (newest first) by default; no sort parameter in v1
- Response shape: `{ "jobs": [ { "id", "title", "skills", "experienceLevel", "city", "description", "createdBy", "createdAt", "updatedAt" } ], "page", "limit", "total", "totalPages" }`
- Validation: zod schema for query params with coercion; invalid values → existing `400 validation_error` shape

### Role mapping
1. **Extend, don't rename** — add `seeker` to the `User.role` enum; renaming `student` would break existing data, JWTs, tests, and the placement module.
2. **Existing `student` behavior** — keep `student` as the placement-module role; treat both `student` and `seeker` as non-admin authenticated users so students can also search jobs if they want; do not silently remap existing accounts.
3. **Existing admins** — yes, they can manage job postings immediately via the existing `requireRole('admin')`; role is read from the JWT issued at login (existing admin tokens already carry `admin`), so no re-login is required unless the role changed after token issuance.
4. **Initial admin creation** — CLI script only (`backend/scripts/create-admin.js`), using the existing bcrypt pre-save hook; public registration must never accept `admin`. Existing dev/test admins remain valid.
5. **What could break if roles change** — adding an enum value is backward compatible; renaming/removing `student` would break existing users, `tests/helpers.js` defaults, and placement-module expectations; making `admin` self-assignable via registration would be a privilege-escalation hole and must be prevented.

### Safe implementation order
1. Extend `User.role` enum with `seeker`; run the existing suite to confirm nothing breaks (no behavior change).
2. Add `backend/src/models/job.js` with indexes and derived lowercase fields (no routes yet).
3. Add `backend/src/controllers/job.controller.js` + `backend/src/routes/job.routes.js` (admin CRUD first, then search), mount in `app.js`.
4. Add zod schemas for job body + query params; enforce server-set `createdBy` and admin-only writes.
5. Add `backend/tests/jobs.test.js` (auth, seeker 403s, admin CRUD, search/filter, validation) and run the full backend suite.
6. Add frontend `AdminRoute` guard + job search page (filters, results) reusing `api`, `AuthContext`, and existing CSS.
7. Add frontend admin job-management page + create/edit form; wire navigation links; verify the placement flow is untouched.
8. Add optional `scripts/seed-jobs.js` and `scripts/create-admin.js`; update `docs/API.md`, `docs/SCHEMA.md`, `docs/DEVELOPMENT.md`; commit per phase (only when the owner asks).

## 11. Risks and Decisions Needed
| Risk or decision | Impact | Recommended resolution |
|---|---|---|
| Duplicate auth implementation if the portal is built standalone | Two sources of truth; broken/ambiguous login | Reuse and extend existing `/api/auth/*`; never create a second auth module |
| `User.role` enum lacks `seeker` | Portal role checks fail or force reuse of `student` | Add `seeker` (additive, no migration); treat `student`+`seeker` as non-admin |
| Whether `GET /api/jobs` requires authentication | Public browsing vs app-consistent security posture | Require auth to match the rest of the API; revisit if public browsing is wanted |
| Search semantics undefined (`skills` ANY/ALL, experience meaning, city matching) | Wrong results; ambiguous tests | Adopt the v1 semantics in §10 (ANY skills, `experienceLevel <= experience`, case-insensitive exact city) |
| Post-login landing page for seekers (`/` is the placement upload page) | Seekers may land in the wrong flow | Owner decision: keep `/` and add `/jobs` to navigation, or role-based redirect after login |
| `createdBy` set from client input | Spoofed ownership/audit trail | Always set from `req.user.id` server-side; ignore any client-provided value |
| No Helmet security headers | Weaker production hardening | Add `helmet` before production deployment (new dependency — requires owner approval) |
| No CORS configuration | Production cross-origin calls fail or require permissive setup | Prefer same-origin reverse proxy; if CORS is added, use an explicit allowlist |
| No CI / no lint-test gate | Regressions can land unnoticed | Add a minimal CI workflow running `npm test` and `npm run lint` (optional, owner-approved) |
| `global-setup.js` drops the test DB | Wrong `MONGO_URI` could wipe dev data | Keep using `tests/helpers.js` and the `placement_skill_gap_test` URI; never hardcode another DB in tests |
| Duplicate `"test"` key in `backend/package.json` | Confusing package config | Remove the duplicate key during the first backend change |
| Job deletion vs `createdBy` dangling reference | Deleted admin leaves orphaned references | Decide: keep reference and render "unknown", or block deletion of admins with jobs |

## 12. Questions for the Project Owner
1. Should job seekers and existing placement students share one account/login, or should the portal be a separate user base?
2. After login, where should a job seeker land — the placement upload page (current `/`) or a new job search page?
3. Confirm the v1 search semantics: `skills` ANY-match, `experience` as "jobs requiring ≤ seeker's years", and case-insensitive exact city matching?
4. Should `GET /api/jobs` require authentication (recommended) or be public?
5. Should any admin be allowed to edit/delete jobs created by another admin, or only the creator?
6. Is a seeker-specific registration page/label required, or is the existing register form (defaulting to `seeker`/`student`) sufficient?
7. Should students (`student` role) be able to search jobs, or only users with the `seeker` role?
8. Is it acceptable to add `helmet` (and optionally a CI workflow) before production, given the current dependency set is otherwise sufficient?

# Vortex deployment guide

The earlier audit release updated both production projects to commit `65db9f28bd4c1c8cecc8004d68441b6bf117d33e`, verified on 2 October 2026 at 10:20:41 UTC. Its source implementation is `3f8facde7cf1bec00276f9b0d965428ae0352d22`. Historical deployment evidence below refers to that release. See [Profile release verification](docs/PROFILE_RELEASE_VERIFICATION.md) for the newer profile-assessment changes and their verification scope.

## Confirmed public services

| Service | Confirmed URL | Evidence |
|---|---|---|
| Frontend | https://vortex-6g7.pages.dev | HTTP 200 for `/`, `/jobs`, `/dashboard`, `/analysis/new`, and `/assistant`; nested routes return the SPA document |
| Backend API | https://vortex-api-eta.vercel.app/api | Safe health and CORS checks reached the Vercel API |
| Health | https://vortex-api-eta.vercel.app/api/health | HTTP 200 JSON with `status` and `timestamp` |
| Source repository | https://github.com/maayav/Job-Posting-Portal | Repository remote/reference |

The frontend is on the existing Cloudflare Pages project `vortex`, and the backend is a Node.js 22.x function in the existing Vercel project `vortex-api`. Production configuration inspection confirmed a MongoDB connection variable, Groq and Gemini key presence, Groq as the text provider, Gemini as the embedding provider, the expected frontend origin, and a JWT secret meeting the 32-character minimum. `NODE_ENV=production` was set explicitly. Secret values are excluded from this record. The database vendor, provider availability/quota, and production persistence remain unverified.

An HTTP 200 from an authenticated frontend route proves SPA routing. It does not prove login, data loading, student/admin access, or a completed AI workflow.

## Architecture

```text
Browser
  -> Cloudflare Pages: React/Vite static assets and SPA fallback
  -> Vercel: backend/api/index.js -> Express /api routes
       -> MongoDB-compatible database
       -> Groq text API (configured default)
       -> Gemini embedding API (configured provider)
       -> GitHub public REST API (optional enrichment)
       -> LeetCode public GraphQL endpoint (optional enrichment)
       -> Resume provider contract -> filesystem fallback
```

LinkedIn is never scraped or fetched. Its supported input is a validated profile URL and optional text pasted by the user or imported from their profile PDF. PDF preview is authenticated, bounded, kept in memory, and does not call AI or save the PDF.

## Local preparation

Use Node.js 22 and install each package from its lockfile:

```bash
npm run install:all
npm run dev
```

For Windows, use the root Node scripts rather than Linux-only process commands. See `docs/SETUP.md` for local environment and MongoDB setup.

The profile release passed 61 frontend tests and production build; lint reported 18 existing warnings and no errors. Backend/runtime and frontend dependency audits both reported zero vulnerabilities. The isolated backend suite passed 326 tests with two intentional real-provider drift skips. Focused demo and dashboard checks overlap with the full suites and must not be added to those counts.

Run frontend tests, lint, and build before release. Backend tests must use the disposable test database described in `docs/BASELINE_AUDIT.md`; never point database-drop hooks at a shared or production database. Normal automated tests mock provider calls and do not need real AI keys.

```bash
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
```

The last command is safe only after verifying the test harness uses its guarded disposable database. The old baseline harness used a fixed `placement_skill_gap_test` database and was intentionally not run in that form.

## Backend on Vercel

Configure the Vercel project with `backend` as its root directory. The repository contains:

- `backend/api/index.js`: serverless handler; opens/reuses the database connection before normal API requests.
- `backend/vercel.json`: rewrites requests to `/api/index` and sets a 60-second function duration.
- `backend/.vercelignore`: excludes local environment files, storage, tests, and sample resumes.
- `backend/package.json`: Node.js `22.x` engine.

The Vercel handler is used directly. `npm start` runs the long-lived local server and is not the Vercel function entry point.

For revision verification, the handler emits `X-Vortex-Revision` when the platform supplies a valid `VERCEL_GIT_COMMIT_SHA`. The frontend build emits `/build-info.json` containing its source commit, using the hosting/CI commit variable or local Git HEAD. Both production markers matched the release commit, and Vercel's `gitCommitSha` metadata matched it independently. A marker identifies source revision; it does not prove authenticated features work.

Set these variables in the backend deployment environment. Secret values belong in the provider environment, never in Git or browser code:

| Required for | Variable names |
|---|---|
| Core API | `NODE_ENV`, `MONGO_URI` or `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL` |
| Text AI | `AI_TEXT_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_FALLBACK_MODELS`, `AI_TEXT_FALLBACK_PROVIDER` |
| Embeddings | `AI_EMBEDDING_PROVIDER`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `GEMINI_EMBEDDING_MODEL`, `EMBEDDING_VERSION` |
| Optional Gemini text mode | `GEMINI_MODEL` |
| Optional GitHub authenticated quota | `GITHUB_TOKEN` |

Use `NODE_ENV=production` and set `CLIENT_URL` to the exact confirmed frontend origin, `https://vortex-6g7.pages.dev`. Multiple trusted origins may be comma-separated. Production JWT secrets must be at least 32 characters. Missing AI credentials produce configuration errors for the related features; they do not establish provider availability.

The checked source validates `AI_EMBEDDING_PROVIDER` as Gemini only. Changing the variable to another provider is not supported.

## Production index migration

Production database connection uses `autoIndex: false`. Deploying code does not create or migrate indexes. No production indexes were inspected or changed in this audit. A new production database also needs the existing unique/query indexes applied through a reviewed migration.

The new `ReadinessReport` index is named `one_active_analysis_per_submission`: unique on `{submission_id: 1}` only while status is `queued` or `processing`. The former compound key `{submission_id: 1, status: 1}` could allow one queued and one processing record for the same submission. The stronger index and duplicate-key handler together enforce/follow one active job. Until the index is applied, that concurrency guarantee is not established in production.

An operator must perform this sequence against the intended database using the provider's authenticated console, without copying credentials into shell history or documentation:

1. Confirm the target database and collection, backup/restore readiness, provider support for partial unique indexes, and a maintenance window or paused analysis writes.
2. Inspect the current readiness-report indexes and identify active duplicate submission groups. The snippets below assume Mongoose's default `readinessreports` collection; verify the actual name first.
3. Review duplicate records' state/timestamps and choose a survivor. Mark abandoned jobs failed through a deliberate, reviewed correction; do not bulk-delete reports or automatically pick the latest. Re-run the duplicate query and require no duplicate groups.
4. Create the named stronger index explicitly. If index creation fails, resolve the cause rather than ignoring it or dropping existing indexes.
5. Verify the index specification and test concurrent starts/retries with approved demo data. A duplicate-key race should return HTTP 202 following the winning active report.
6. Only after the new index is verified, consider removing an obsolete compound index by its inspected exact name. Do not run `syncIndexes`, `dropIndexes`, or a generic drop as a release shortcut.

Manual inspection and index-creation snippets, for review in the database console:

```js
const reports = db.getCollection('readinessreports');
reports.getIndexes();
reports.aggregate([
  { $match: { status: { $in: ['queued', 'processing'] } } },
  { $group: { _id: '$submission_id', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]);
// Run only after duplicate groups are resolved and the change is approved:
reports.createIndex(
  { submission_id: 1 },
  {
    name: 'one_active_analysis_per_submission',
    unique: true,
    partialFilterExpression: { status: { $in: ['queued', 'processing'] } }
  }
);
reports.getIndexes();
```

These examples are documentation, not an executed migration. Do not include profile/resume contents or credentials in migration logs. Production index readiness remains unverified until the operator records actual results.

## Frontend on Cloudflare Pages

Configure Cloudflare Pages with:

```text
Root directory: frontend
Build command: npm run build
Build output directory: dist
Build-time public API value:
VITE_API_URL=https://vortex-api-eta.vercel.app/api
```

`VITE_API_URL` is embedded in the frontend build. Changing it requires a new frontend build/deployment. Do not put database, JWT, AI, GitHub, or storage secrets in any `VITE_` variable.

The root `scripts/build-role-catalog.mjs` is run by the frontend prebuild script, so the checkout must contain the full repository rather than an isolated copy of `frontend`.

`frontend/public/_redirects` contains the Cloudflare SPA fallback:

```text
/* /index.html 200
```

`frontend/public/_headers` supplies response security headers, a Content Security Policy, and no-store caching for `/build-info.json`. The policy permits JavaScript only from the frontend origin; `/theme-init.js` is a synchronous external script, avoiding inline-JavaScript exceptions. Inline styles remain allowed for Motion/dynamic layout. API connections are limited to the frontend origin and confirmed Vercel origin. If the API origin changes, update `connect-src` with the build-time API value, review the diff, and rebuild. The production CSP was present on all five checked frontend routes. These files must appear in the deployed `dist` output. `frontend/vercel.json` is an alternative frontend-hosting configuration; it is not evidence that the current frontend runs on Vercel.

The API client falls back to `/api` when `VITE_API_URL` is empty. That fallback is useful with the local Vite proxy. On the current static Cloudflare deployment, an empty value would send API requests to the frontend host and can return SPA HTML instead of JSON.

## CORS and health

Only explicitly configured browser origins are allowed in production. Development/test defaults also allow the local Vite origins. CORS is separate from authentication: an allowed origin still needs a valid bearer token on protected routes.

The post-release production checks at 10:20:41 UTC found:

| Request | Result |
|---|---|
| `GET /api/health` | 200, `{status,timestamp}` JSON |
| `OPTIONS /api/jobs` and `/api/health` from the frontend origin | 204; exact frontend allow-origin header |
| `OPTIONS /api/jobs` and `/api/health` from an unknown origin | 204; no allow-origin header or reflection |

The health shortcut previously returned 200 without CORS headers. The corrected handler's deployed preflight behavior is now verified. An unknown origin receiving 204 without an allow-origin header is not browser CORS permission.

`/api/health` is liveness only. The Vercel health shortcut does not connect to MongoDB. A healthy response must not be reported as proof of database readiness or persistence. There is no separately verified database-readiness endpoint.

## Analysis and serverless limits

Profile upload performs PDF extraction, optional external enrichment, text extraction, and embedding work. PDFs are limited to 30 pages and 60,000 extracted characters; files are capped at 4 MiB on Vercel and 5 MiB elsewhere. Analysis uses the saved profile, ontology, and curated resource catalog.

On Vercel, analysis is awaited within the request because work scheduled after a response may be frozen. The database stores `queued`, `processing`, `completed`, and `failed` states. The active-job index is unique on submission alone, and an `E11000` race follows the winning active job with HTTP 202; production requires the manual index procedure above. Reconciliation marks active reports older than ten minutes as `analysis_timeout` when the long-lived server starts, on the first Vercel database connection, or when a new analysis is requested. Polling status does not trigger reconciliation, and no cron/reaper is configured. An interrupted request becomes retryable when one of those reconciliation triggers runs.

This is recovery from abandoned work, not a durable worker queue. Provider latency, retries, and cold starts can still exceed the configured 60-second function limit. GitHub enrichment is bounded by a 25-second overall deadline, LeetCode by a 10-second request timeout, and provider calls have their own timeouts. These separate limits do not guarantee an entire upload/analysis finishes within 60 seconds.

Successful production reliability must be measured with approved demo identities, demo PDF data, and actual deployed completion/polling/retry checks. It has not been established by the safe baseline checks.

## Resume storage

The local storage abstraction exposes save, read, delete, and provider-status operations. The active fallback is filesystem storage:

- Long-lived local host: `backend/storage`.
- Vercel: `/tmp/vortex-storage`, per function instance.

Random file references are stored in MongoDB. Resume downloads go through authenticated owner/admin endpoints, with private/no-store cache headers. Explicit application-without-resume choices are respected.

Vercel `/tmp` is ephemeral and unshared. Files can disappear between instances or deployments while database records survive. The new provider contract is preparation for durable object storage; it does not migrate files or make the fallback durable. No remote storage credentials/provider were configured during this audit, and no durable production storage was verified.

A future adapter must preserve protected downloads, deletion behavior, old reference compatibility, and an explicit retention policy. Merely adding Cloudinary/Supabase variable names is insufficient. Do not run cleanup or migration against production until the target provider and policy are configured.

## Release procedure

1. Review the combined diff, tests, dependency audit, and secret-ignore behavior.
2. Stage relevant project changes. Exclude local environment files, generated working folders such as `.pt1-work`, uploads, and unrelated artifacts.
3. Commit and push to the confirmed repository branch.
4. Confirm each hosting provider deployed that commit. A successful push alone is not evidence of a deployment.
5. Read frontend `/build-info.json` and backend `X-Vortex-Revision` if served, compare full commit IDs with the release commit, and repeat safe HTTP/CORS checks against the confirmed URLs. Missing markers leave the deployed revision unknown.
6. Use approved demo credentials/data for authenticated workflows. Never print JWTs, passwords, profile contents, or provider keys.
7. Record the deployed revision and actual results in `docs/INTEGRATION_STATUS.md`.

The first deployment attempt was blocked by an expired Cloudflare login and a logged-out Vercel CLI. After restoring provider access, both existing projects were deployed successfully:

| Provider | Production release evidence |
|---|---|
| Cloudflare Pages | Existing project `vortex`, production branch `main`, deployment `e9ccd5dc-bd3c-4e08-89b2-c6a9cfd7e06d`; deploy stage succeeded at 10:20:26 UTC with matching commit metadata and dirty=false. Canonical hostname unchanged; `/build-info.json` returned JSON with the full release SHA. |
| Vercel | Existing project `vortex-api`, deployment `dpl_4zjHCbyCVxu7qjVZpAxLuWx47Ri8`, READY, Node.js 22.x; canonical API alias unchanged. Provider Git metadata and the live revision header matched the full release SHA. |

Cloudflare's project has no Git provider configured, so this release used a direct upload of the production frontend build; a Git push alone will not update that project. The Vercel team was confirmed on an active free Hobby plan. No paid upgrade, new hosting project, storage service, or billing product was added. Cloudflare's subscriptions API returned 403, so its account billing plan was not established; AI/database billing was not audited.

The five frontend routes returned the same SPA shell with CSP, and a fresh browser check rendered the landing page without captured console warnings or errors. Login navigation displayed the real form without submitting credentials. Approved demo authentication credentials, public test usernames, and durable storage configuration were still unavailable. No production login/signup submission, profile analysis, AI generation, database persistence test, index migration, or resume upload/durability test was performed.

## Safe public checks

```bash
curl --fail --silent --show-error https://vortex-6g7.pages.dev/
curl --fail --silent --show-error https://vortex-6g7.pages.dev/jobs
curl --fail --silent --show-error https://vortex-api-eta.vercel.app/api/health
curl --silent --show-error --request OPTIONS \
  --header 'Origin: https://vortex-6g7.pages.dev' \
  --header 'Access-Control-Request-Method: GET' \
  --header 'Access-Control-Request-Headers: Authorization' \
  --dump-header - --output /dev/null \
  https://vortex-api-eta.vercel.app/api/jobs
```

The shell example uses `/dev/null` on Linux/macOS. On Windows, use `curl.exe` and `--output NUL`, or the platform's HTTP client. Test an unknown synthetic origin separately and confirm it receives no allow-origin header.

Do not run production signup, upload, application/status writes, real profile enrichment, or paid/quota-consuming AI workflows as part of these public checks.

## Troubleshooting

| Symptom | Check |
|---|---|
| Protected page returns 200 but shows login | SPA routing works; authentication must be tested separately |
| API returns HTML | Verify frontend build-time `VITE_API_URL` includes `/api` and points at Vercel |
| CORS failure | Check exact production `CLIENT_URL`, request origin, and deployed backend revision |
| Nested route 404 | Confirm Cloudflare deployed `_redirects` with SPA fallback |
| Health is healthy but features fail | Inspect backend database/provider configuration; health is liveness only |
| `resume_missing` on Vercel | The filesystem fallback is ephemeral; durable storage is still required |
| Analysis stays active after a killed request | Check stale reconciliation and retry after its timeout window |
| AI configuration error | Verify backend provider variable names and credentials without logging values |
| Analysis model mismatch | Rebuild ontology vectors for the configured model/version in a controlled environment |
| Local port 5173 is occupied | Check the existing Vite server; use the root development launcher rather than starting duplicate servers |

## Verification record

See `docs/BASELINE_AUDIT.md` for baseline evidence and decisions, `docs/INTEGRATION_STATUS.md` for live-versus-local integration status, and `docs/PROJECT_TECHNICAL_DOCUMENTATION.md` for the actual architecture and project boundaries.

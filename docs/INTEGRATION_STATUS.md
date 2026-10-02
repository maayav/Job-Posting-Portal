# Vortex integration and deployment status

Verification date: 2 October 2026; post-release HTTP checks at 10:20:41 UTC. Both existing production projects serve commit `65db9f28bd4c1c8cecc8004d68441b6bf117d33e`. This record distinguishes verified release/configuration evidence, safe live checks, mocked tests, and untested production workflows.

## Deployment status

| Area | Classification | Evidence or limit |
|---|---|---|
| Frontend host | Confirmed deployed and reachable | https://vortex-6g7.pages.dev returned 200 |
| Frontend SPA routes | Confirmed deployed and working for document fallback | `/`, `/jobs`, `/dashboard`, `/analysis/new`, `/assistant` returned the SPA document |
| Authenticated frontend features | Deployed but not fully tested | HTTP 200 does not establish data loading/login/role behavior |
| Backend host | Confirmed deployed and reachable | https://vortex-api-eta.vercel.app/api answered safe checks |
| Health | Confirmed deployed liveness | `GET /api/health`: 200 JSON `{status,timestamp}` |
| Database readiness/persistence | Unknown | Health bypasses DB; no controlled production write/read was performed |
| Database provider | Unknown | Mongoose/MongoDB-compatible configuration in code; production vendor not established |
| API CORS | Confirmed deployed | Health/jobs preflights: 204 with exact frontend origin; unknown origin: 204 with no allow-origin header |
| Health shortcut CORS | Baseline issue fixed and verified deployed | Corrected health OPTIONS returns 204 with origin-specific headers |
| Groq text AI | Production configuration confirmed; generation untested | Provider selected and key present; no production generation call |
| Gemini embeddings | Production configuration confirmed; embedding calls untested | Provider selected and key present; availability/model/quota not established |
| Audit/security source release | Confirmed deployed; feature behavior only partly tested | Both production revision markers and provider metadata match the release SHA |
| Frontend CSP | Confirmed deployed | Present on all five routes; self-only scripts, inline styles for Motion, API connection allowlist |
| Production indexes | Unknown; not migrated | `autoIndex` disabled; named stronger active-job index requires reviewed operator migration |
| Revision instrumentation | Confirmed deployed | Frontend build-info JSON and backend revision header return the full release SHA |
| Direct deployment access | Restored; releases succeeded | Existing Cloudflare `vortex` and Vercel `vortex-api` projects updated; public aliases unchanged |
| Production configuration | Inspected without exposing secrets | Explicit production mode, correct frontend origin, JWT minimum satisfied, MongoDB/Groq/Gemini variables present |
| Browser smoke check | Landing and login rendered | No captured landing console warnings/errors; no credentials entered or login submitted |
| Durable resume storage | Not configured or verified | Active fallback is local filesystem/Vercel `/tmp` |

Confirmed repository: https://github.com/maayav/Job-Posting-Portal. The deployed release contains source implementation `3f8facde7cf1bec00276f9b0d965428ae0352d22` and initial evidence commit `65db9f28bd4c1c8cecc8004d68441b6bf117d33e`. Deployment was verified separately from the successful Git push.

## GitHub

Classification: **Included in the verified deployed source; optional enrichment; production analysis not tested**.

- Uses the official public REST API at `https://api.github.com`.
- Accepts normalized username, `@username`, or GitHub URL.
- Reads user existence and up to ten recently pushed repositories; forks are skipped.
- Reads topics/languages, 800-character README excerpts, and bounded `package.json`/`requirements.txt` content.
- Uses a 15-second maximum request timeout and a 25-second overall deadline.
- Successful public data caches for 24 hours; seven-day TTL cleanup is configured.
- Cache errors do not block live enrichment; no negative cache is claimed.
- Missing users/rate limits/timeouts/provider failures become optional-source statuses.
- Missing repository details are tolerated.
- Language metadata alone is weak evidence. Source-marker sanitization and grounding checks protect provenance.

Detailed tests use mocked HTTP/cache fixtures. `INTEGRATION_TEST_GITHUB_USERNAME` was not configured, so no real public profile request or deployed profile-analysis chain was run. Private profiles were not accessed.

## LeetCode

Classification: **Included in the verified deployed source; optional public provider behavior not tested live**.

- Uses the public website GraphQL endpoint at `https://leetcode.com/graphql/`.
- This is not an official authenticated API integration.
- Reads only positive language problem counts, at most 20 language entries.
- Uses a 10-second timeout and a bounded response size.
- No cookies, passwords, private history, cache, or login automation.
- Missing profiles/endpoint failure degrade to `not_found`/`unavailable`.
- Optional failure cannot block resume/GitHub analysis.
- Problem counts are supplementary language evidence, not proof of professional proficiency.

Detailed tests use mocked responses. `INTEGRATION_TEST_LEETCODE_USERNAME` was not configured, so no live request was performed. Optional-source failure is not classified as a production outage.

## LinkedIn

Classification: **Included in the verified deployed source; URL/text behavior covered locally, not tested through production requests**.

- `linkedinUrl`: validated HTTPS profile URL on `linkedin.com` or `www.linkedin.com` with an `/in/<profile>` path; normalized before storage.
- `linkedinSummaryText`: optional text explicitly pasted by the student, at most 10,000 characters.
- `linkedinDataSource`: `user_provided_text` when supplied.
- Evidence source: `linkedin_user_provided`.
- URL alone provides no technical skill evidence.
- No scraping, login automation, official LinkedIn API claim, or private LinkedIn production upload.

Local validation/source fixtures cover the design. Real user-provided personal text was not sent to the production API.

## New Analysis and AI Assistant

Classification: **Source deployed and provider configuration inspected; tested locally with mocks, production completion not tested**.

- Routes require authentication and ownership/roles where applicable.
- Profile upload/retry, analysis, and assistant have dedicated per-user limits.
- Skills and evidence are schema-validated; untrusted source markers are sanitized.
- Groq handles text by default; Gemini handles embeddings.
- Normal readiness scoring uses exact canonical skill/category matches, not semantic substitution.
- Curated resource URLs are server-controlled.
- Reports store queued/processing/completed/failed states; reconciliation marks active reports older than ten minutes failed on startup, first Vercel DB connection, or a new analysis request. It does not run on status polls or a schedule.
- Vercel awaits analysis inside the request. This still has a 60-second deployment limit and is not a durable worker queue.
- Students require a completed owner-accessible analysis; the no-analysis response is HTTP 409 `analysis_required` with a useful frontend state.
- Admin assistant context covers job/application/status/candidate data; exact totals are aggregated across all records, while detail queries are limited to 200 recent jobs and 250 recent applications with coverage disclosed. Reviews use per-application captures; missing/deleted/null captures stay absent, and only legacy uncaptured records use latest-profile compatibility.
- Assistant context/chat and candidate/application responses use private/no-store headers. Prompts instruct grounded answers, but free-form model replies are not deterministically fact-checked.
- The active-job index is unique on submission alone with a queued/processing partial filter; `E11000` creation races return 202 following the winner. Its production installation is not verified.
- Resume extraction caps PDF input at 30 pages/60,000 extracted characters; file size is limited separately.
- Each history entry is clamped to 4,000 characters so a long prior answer does not break the next turn.

No safe demo login credentials were configured in the inspected environment. No production signup/login, analysis, assistant generation, or provider quota consumption was performed. Production timeout/retry behavior remains unverified.

## Application evidence and resumes

Classification: **Privacy/snapshot changes included in deployed source; production writes/downloads not tested**.

- New applications record `reviewSnapshotAt`, plus available `profileSubmissionId` and `readinessReportId`.
- Missing saved references do not silently select a newer report/profile. Legacy uncaptured applications retain documented latest-record compatibility.
- References are not immutable copies; re-extraction of the same profile can change evidence.
- Explicit no-resume selection is preserved by `resumeSource`.
- Profile resume selection uses the captured submission. Missing selected files return `profile_resume_unavailable` instead of silently omitting the resume.
- External resume links require HTTPS without embedded credentials.
- PDF downloads require applicant owner/admin access and private/no-store headers.

No real resume was uploaded, no production application was created, and no live protected download was tested during this audit.

## Storage and retention

Classification: **Provider contract implemented; durable remote storage not configured**.

The storage abstraction implements save/read/delete/status and currently delegates to a guarded filesystem provider. Local storage uses `backend/storage`; serverless storage uses `/tmp/vortex-storage`. Test storage can be isolated using `RESUME_STORAGE_DIR`.

The Vercel fallback is ephemeral and unshared. Provider abstraction, Cloudinary/Supabase placeholder variables, and database file references do not establish durable storage. No configured remote provider credentials were available; no migration/durability test was performed. Profile deletion removes its stored PDF and associated extracted profile/reports. Automatic time-based retention is not implemented.

## Baseline and final verification

| Check | Baseline | Final combined result |
|---|---|---|
| Frontend tests | 45 passed | 51 passed after latest edits |
| Frontend lint | Passed with existing warnings | 17 existing warnings, no errors |
| Isolated frontend production build | Passed | Passed after latest edits |
| Isolated backend integration fixtures | 8 passed | Included in passing final full suite |
| Isolated backend AI/source-schema fixtures | 9 passed | Included in passing final full suite |
| Full backend suite | Not run with destructive fixed-DB setup | Guarded container run: 306 passed, 2 drift skipped; 26 passing files/one skipped |
| Focused regression suites | Not in baseline | Latest snapshot/concurrency/application/assistant run: 52 passed |
| Isolated backend units | Not in baseline | 141 passed |
| Backend/runtime dependency audit | 2 moderate runtime vulnerabilities plus dev advisory | Nonbreaking fixes applied; 0 reported vulnerabilities |
| Frontend dependency audit | Not recorded in baseline | 0 reported vulnerabilities |
| Syntax/diff/secret-ignore review | Baseline inspected | Passed; 80 release files scanned, only generic env-example placeholder found; real `.env` ignored |
| CSP/external theme-init checks | Not in baseline | Passed locally; CSP present on all five production routes; landing browser smoke passed |
| Commit/push | Starting commit `9c4b2e0` | Source release `3f8facde7cf1bec00276f9b0d965428ae0352d22` committed and pushed to `origin/main`; evidence-only documentation follows |
| Frontend/backend deployed revision | Unknown | Both verified as `65db9f28bd4c1c8cecc8004d68441b6bf117d33e` through live markers and provider metadata |
| Post-release public checks | Baseline checks above | 2 October 2026, 10:20:41 UTC: all five frontend routes 200 with identical SPA HTML and CSP; build-info JSON matches release; health 200 `{status,timestamp}`; health/jobs preflights 204, exact frontend origin allowed, unknown origin receives no allow-origin header |

Final local results and post-release checks are recorded from command output. The final full suite, focused run, and unit run overlap and are recorded separately; their counts must not be added. Revision markers were verified live: the frontend build uses its hosting/CI commit variable or Git HEAD, and the backend emits a revision when `VERCEL_GIT_COMMIT_SHA` is present. Vercel deployment metadata independently matched the same commit and specified Node.js 22.x. Authenticated workflow tests remain outstanding.

## Manual verification coverage

| Scenario | Local/test coverage | Live coverage |
|---|---|---|
| Valid resume and optional GitHub | Generated/mocked fixtures | Not tested |
| LinkedIn URL/text grounding | Validation/extraction fixtures | Not tested |
| Optional LeetCode failure | Mocked failure fixtures | Not tested |
| Analysis scoring/plan saved | Passing guarded disposable DB tests | Not tested |
| Completed-report assistant | Passing context/validation fixtures | Not tested |
| Resume ownership/admin access | Passing authorization/privacy fixtures | Not tested |
| Application-associated review | Passing captured-reference regressions | Not tested |
| Themes/navigation | Frontend tests/build | Fresh landing/login navigation smoke passed; authenticated browser review pending |
| SPA routes/CORS/health | Safe HTTP checks | Confirmed within limits above |

No private data, tokens, passwords, or API keys are included in fixtures or this record. Public GET/OPTIONS checks do not prove production authentication, AI success, database persistence, or storage durability. See `BASELINE_AUDIT.md` for approved/rejected/deferred findings and `PROJECT_TECHNICAL_DOCUMENTATION.md` for the implementation boundaries.

## Post-push deployment evidence

Source implementation `3f8facde7cf1bec00276f9b0d965428ae0352d22` and its initial evidence commit were pushed to `main`. At 09:33 UTC, the public hosts still lacked revision markers/CSP and used the old health shortcut. Initial CLI attempts were blocked by an expired Cloudflare session and logged-out Vercel session. Provider access was subsequently restored, and production release `65db9f28bd4c1c8cecc8004d68441b6bf117d33e` was deployed to the existing projects.

| Provider | Verified release |
|---|---|
| Cloudflare Pages | Existing project `vortex`, branch `main`, production deployment `e9ccd5dc-bd3c-4e08-89b2-c6a9cfd7e06d`; deploy stage succeeded at 10:20:26 UTC. Provider commit metadata matched the release SHA with dirty=false. The canonical hostname remains `vortex-6g7.pages.dev`. |
| Vercel | Existing project `vortex-api`, READY production deployment `dpl_4zjHCbyCVxu7qjVZpAxLuWx47Ri8`; provider `gitCommitSha` matched the release SHA, Node.js 22.x. The canonical API hostname remains `vortex-api-eta.vercel.app`. |

At 10:20:41 UTC, the five frontend GET routes returned 200 with identical SPA HTML and the new CSP. `/build-info.json` returned JSON with the release SHA. API health returned 200 `{status,timestamp}` with that SHA in `X-Vortex-Revision`. Both health and jobs preflights returned 204, allowed only the exact configured frontend origin, and omitted allow-origin for an unknown origin. A fresh browser check rendered the landing page without captured console warnings or errors; navigating to login displayed the form without submitting credentials.

Cloudflare's existing project has no Git provider configured; the release used direct upload of the production build. GitHub returned no commit statuses/check runs/deployment records, so a Git push alone is not deployment evidence. `NODE_ENV=production` was explicitly set on the existing backend project. Production inspection confirmed expected provider selection/key presence, MongoDB configuration, the frontend origin, and the JWT minimum without recording secret values.

The Vercel team has an active free Hobby plan. No paid upgrade, new hosting project, storage service, or billing product was added. Cloudflare's subscriptions API returned 403, leaving account-plan billing unverified; AI/database billing was not audited.

An initial Python HTTP-client check received 403 on Cloudflare; repeat curl checks returned 200. This client-specific result is not treated as a site outage. Approved demo credentials/public test usernames and durable storage configuration were not available. Authenticated production AI/integration tests, database persistence, resume durability, and production index verification remain outstanding. No production signup/login submission, resume upload, AI call, or index migration was performed.

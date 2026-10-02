# Vortex integration and deployment status

Verification date: 2 October 2026. This record distinguishes safe live checks, inspected local code, mocked tests, and unverified production workflows. It must be updated with the actual deployed revision before describing local fixes as live.

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
| API CORS | Confirmed on normal API preflight | `/api/jobs`: 204 with exact frontend origin; unknown origin not reflected |
| Health shortcut CORS | Baseline issue; local fix awaiting deployment | Baseline health OPTIONS returned 200 without CORS headers |
| Groq text AI | Configured in code; not verified live | Default text provider; no production generation call |
| Gemini embeddings | Configured in code; not verified live | Actual environment/model/quota not established |
| Local audit/security changes | Not confirmed deployed | Source commit pushed; public revision markers absent, deployment not confirmed |
| Frontend CSP | Implemented locally; not verified live | Self-only scripts; inline styles for Motion; API connection allowlist needs an update if origin changes |
| Production indexes | Unknown; not migrated | `autoIndex` disabled; named stronger active-job index requires reviewed operator migration |
| Revision instrumentation | Configured locally; not verified live | Frontend `/build-info.json`; backend `X-Vortex-Revision` if platform commit is supplied |
| Direct deployment access | Unavailable in inspected CLI sessions | Cloudflare login expired/unrefreshable; Vercel CLI reported Logged out; provider Git-link settings unknown; public checks do not confirm this release |
| Durable resume storage | Not configured or verified | Active fallback is local filesystem/Vercel `/tmp` |

Confirmed repository: https://github.com/maayav/Job-Posting-Portal. The deployment-source relationship must be checked rather than assumed from a Git push.

## GitHub

Classification: **Implemented locally; optional enrichment; production analysis not tested**.

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

Classification: **Retained as optional; public provider behavior not tested live**.

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

Classification: **Implemented locally; new fields not confirmed deployed/live-tested**.

- `linkedinUrl`: validated HTTPS profile URL on `linkedin.com` or `www.linkedin.com` with an `/in/<profile>` path; normalized before storage.
- `linkedinSummaryText`: optional text explicitly pasted by the student, at most 10,000 characters.
- `linkedinDataSource`: `user_provided_text` when supplied.
- Evidence source: `linkedin_user_provided`.
- URL alone provides no technical skill evidence.
- No scraping, login automation, official LinkedIn API claim, or private LinkedIn production upload.

Local validation/source fixtures cover the design. Real user-provided personal text was not sent to the production API.

## New Analysis and AI Assistant

Classification: **Configured and tested locally with mocks; production completion not tested**.

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

Classification: **Local privacy/snapshot changes implemented; production writes/downloads not tested**.

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
| CSP/external theme-init checks | Not in baseline | Passed locally; no live header claim |
| Commit/push | Starting commit `9c4b2e0` | Source release `3f8facde7cf1bec00276f9b0d965428ae0352d22` committed and pushed to `origin/main`; evidence-only documentation follows |
| Frontend/backend deployed revision | Unknown | Unknown: frontend build-info returns SPA HTML, backend revision header absent |
| Post-release public checks | Baseline checks above | 2 October 2026, 09:33 UTC: all five frontend routes 200 with identical HTML; health 200 `{status,timestamp}`; jobs preflight allowed origin 204/exact origin, unknown origin 401/no allow-origin; health preflight still 200/no CORS |

Final local results and post-push checks are recorded from command output; provider deployment remains unverified. The final full suite, focused run, and unit run overlap and are recorded separately; their counts must not be added. Revision markers are configured locally: the frontend build uses its hosting/CI commit variable or Git HEAD, and the backend emits a revision only when `VERCEL_GIT_COMMIT_SHA` is present. Their live presence is not yet verified.

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
| Themes/navigation | Frontend tests/build | Authenticated browser review pending |
| SPA routes/CORS/health | Safe HTTP checks | Confirmed within limits above |

No private data, tokens, passwords, or API keys are included in fixtures or this record. Public GET/OPTIONS checks do not prove production authentication, AI success, database persistence, or storage durability. See `BASELINE_AUDIT.md` for approved/rejected/deferred findings and `PROJECT_TECHNICAL_DOCUMENTATION.md` for the implementation boundaries.

## Post-push deployment evidence

Source release `3f8facde7cf1bec00276f9b0d965428ae0352d22` was pushed to `main`. Safe curl checks at 09:33 UTC on 2 October 2026 confirmed the five frontend routes return 200 with the same HTML. `/build-info.json` also returns that HTML instead of JSON; CSP is absent. API health returns 200 with only `status` and `timestamp`, with no `X-Vortex-Revision`. Health OPTIONS still returns 200 without CORS; the local corrected handler returns 204. Thus the release revision cannot be verified and its deployment must not be claimed.

GitHub returned no commit statuses, check runs or deployment records. This does not establish whether a hosting webhook is configured. Wrangler authentication expired and could not refresh; Vercel CLI 62.1 reported Logged out. No authenticated provider dashboard session was available. Deploying to a new temporary host would not update the confirmed product URLs and was not attempted.

An initial Python HTTP-client check received 403 on Cloudflare; repeat curl checks returned 200. This client-specific result is not treated as a site outage. Authenticated production AI/integration tests, durable storage migration, and production index verification remain blocked by unavailable provider/test/storage configuration. No production signup, login, resume upload or AI call was performed.

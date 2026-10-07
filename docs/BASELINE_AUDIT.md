# Vortex baseline audit and finding decisions

Audit date: 2 October 2026. Repository: `/home/gman/dev/projects/pride_proj`.

This record separates the inspected local implementation, safe public deployment checks, and work that still needs authenticated or operational verification. The baseline included existing uncommitted fixes from the previous OpenCode session. Passing a local test does not establish that the public deployment contains that code.

## Baseline repository state

- Branch: `main`.
- Starting commit: `9c4b2e0` (project README refresh).
- Starting tracked diff: 42 modified files; no staged changes.
- Existing untracked work included LinkedIn service/tests, technical documentation, frontend headers, and `.pt1-work`.
- `.pt1-work` is an unrelated documentation working folder and is excluded from the project release.
- Existing local changes were preserved rather than reset.
- `.env` values, credentials, tokens, connection strings, and personal profile contents are excluded from this report.

## Actual architecture

Vortex is a student/admin job portal with resume-based skill readiness, curated study plans, and an assistant. React 19/Vite 8/Router 7 provide the frontend. Node.js 22, Express 5, Mongoose 9, Zod 4, bcrypt, and JWT provide the API. Groq is the default text provider; Gemini supplies embeddings. The database models connect users, jobs, applications, profile submissions, extracted skills, readiness reports, ontology skills, resources, wishlist items, and notifications.

The current deployment topology confirmed by repository references and safe HTTP checks is Cloudflare Pages frontend plus Vercel serverless API. Both existing projects now serve release `65db9f28bd4c1c8cecc8004d68441b6bf117d33e`. Authenticated provider inspection confirmed production configuration/key presence without exposing values; the production MongoDB-compatible database vendor, persistence, and AI availability remain unverified.

## Baseline checks

| Check | Baseline result | Interpretation |
|---|---|---|
| Frontend tests | 45 passed | Local fixtures/component tests |
| Frontend production build | Passed to an isolated output directory | Local bundle builds; no production release implied |
| Frontend lint | Passed with existing warnings | No lint errors; warnings remain |
| Backend mocked integration tests | 8 passed | Isolated config with database-drop hooks disabled |
| Backend AI/source schema tests | 9 passed | Mocked providers; no real AI quota consumed |
| Standard backend suite | Not run with baseline setup | Old setup dropped fixed `placement_skill_gap_test`; unsafe for a potentially shared DB |
| Backend dependency audit | 2 moderate runtime findings plus a dev advisory | `ip-address` 10.7.0, `multer` 2.3.0; dev `brace-expansion` advisory |
| Dependency remediation | Audit fix applied locally; 0 reported vulnerabilities | Resolved installed lockfile versions: `ip-address` 10.7.3, `multer` 2.4.0, `brace-expansion` 5.0.12 |

The vulnerability count is the result for this lockfile/audit date, not a guarantee against future advisories.

## Safe deployed checks

| Area | Result | What was established |
|---|---|---|
| `https://vortex-6g7.pages.dev/` | 200 | Frontend document reachable |
| `/jobs` | 200 | SPA fallback |
| `/dashboard` | 200 | SPA fallback |
| `/analysis/new` | 200 | SPA fallback |
| `/assistant` | 200 | SPA fallback |
| `https://vortex-api-eta.vercel.app/api/health` | 200 JSON `{status,timestamp}` | API liveness |
| API `/jobs` preflight from confirmed frontend | 204, exact allow-origin | Frontend origin accepted |
| API `/jobs` preflight from unknown origin | No allow-origin header | Unknown origin not reflected |
| API `/health` preflight at baseline | 200 without CORS headers | Serverless health shortcut bypassed normal middleware |

Post-release checks at 10:20:41 UTC on 2 October 2026 verified matching frontend/backend revision markers, frontend CSP, and corrected health/jobs preflights: both return 204 with the exact frontend allow-origin header, while an unknown origin receives 204 with no allow-origin header. The baseline health inconsistency is fixed in the verified release. A fresh browser check rendered the landing page without captured warnings/errors and displayed the login form; no credentials were submitted.

These requests did not test authenticated screens, login, uploads, applications, profile integrations, AI, database persistence, or resume durability. The health handler explicitly bypasses the database connection and checks liveness only.

## Finding decisions

“Approved” means the finding is supported and its fix is in the implementation scope. It does not mean the fix is already live. “Deferred” records an accepted limitation requiring a product or provider decision. “Rejected” applies to a claim or proposed inference contradicted by the implementation/evidence.

| Finding | Decision | Scope and reason |
|---|---|---|
| Abandoned queued/processing reports block re-analysis | Approved | Reconcile reports older than ten minutes on startup/first Vercel DB connection/new analysis; status polling/cron do not trigger cleanup |
| Active-report compound index permits queued/processing race | Approved | Use named unique submission-only active partial index; `E11000` follows winner with 202; manual production migration still required |
| GitHub sequential fan-out exceeds request budgets | Approved | Bound overall enrichment time, cache successful public data, expire cache records, tolerate partial failures |
| Applying without a resume exposes a profile resume through fallback | Approved | Respect explicit `resumeSource`; protect downloads and associated profile references |
| Application review/assistant silently changes to a newer analysis | Approved | Both candidate review and admin assistant use each application's capture; absent/deleted references stay absent; legacy compatibility only |
| Uploaded application PDF hidden without an analysis | Approved | Expose `hasResume` and show protected download independently of profile evidence |
| Missing-profile resume 409 is mistaken for duplicate success | Approved | Frontend checks `already_applied` specifically; missing resume stays visible; missing upload prevented locally |
| Failed extraction lacks a useful retry path | Approved | Retry from saved submission/PDF with an explicit frontend state |
| Source markers in untrusted text spoof evidence provenance | Approved | Sanitize markers before section assembly; validate evidence against its actual source |
| Profile upload/retry is an unmetered AI cost path | Approved | Add authenticated per-user profile limits alongside analysis/assistant limits |
| Explicit assistant report can be incomplete | Approved | Require a completed owner-accessible report; show a clear analysis-required state |
| Long assistant history causes later turns to fail | Approved | Bound incoming history and outgoing prompt context |
| Admin assistant queries all candidates on every request | Approved | Preserve exact aggregate totals; limit detailed context to 200 recent jobs/250 recent applications and report coverage |
| Production CORS accepts localhost by default | Approved | Local origins are defaults only in development/test; production uses configured origins |
| Health shortcut bypasses CORS | Approved | Apply consistent preflight/origin handling before the shortcut; retain liveness semantics |
| Weak production JWT secret is accepted | Approved | Require at least 32 characters; secret values stay outside Git/logs |
| Gemini key in query strings | Approved | Send key in provider header |
| Unhandled logs expose request/provider details | Approved | Use bounded error metadata; do not echo raw request URLs or secret content |
| Private reports/resumes/assistant/candidate responses may be cached | Approved | Private/no-store headers on protected response paths |
| Static frontend lacks CSP | Approved | Cloudflare header policy limits scripts/connect destinations; external synchronous theme init; inline styles retained for Motion; live CSP verified on all five routes |
| `includeStatus=false` parses as true | Approved | Parse query booleans explicitly |
| External application resume links accept arbitrary schemes | Approved | Require HTTPS and reject embedded credentials/unsafe URLs |
| Extracted PDF text is unbounded | Approved | Reject PDFs above 30 pages or 60,000 extracted characters before storing/sending text to providers |
| Backend dependency vulnerabilities | Approved | Apply compatible lockfile updates and re-audit |
| Deployment docs describe Render/Vercel frontend | Approved | Replace with confirmed Cloudflare Pages/Vercel API deployment instructions |
| Fixed database-drop test harness risks shared data | Approved | Use guarded, uniquely named disposable database setup before full suite |
| “Cloudinary variables prove resumes are durable” | Rejected | No configured remote provider or migration; variables alone are not implementation evidence |
| “Health proves MongoDB readiness/persistence” | Rejected | Health bypasses database work; persistence requires an actual controlled write/read test |
| “Embeddings currently drive semantic readiness matching” | Rejected | Normal scoring gates on exact canonical skill name and category |
| “LinkedIn has official API or scraping support” | Rejected | Only URL validation and user-provided text are supported |
| “LeetCode is a supported official authenticated API” | Rejected | Optional use of a public website GraphQL endpoint; provider behavior may change |
| “Local fixes or a push prove deployed behavior” | Rejected | Confirm deployed revision and test each behavior independently |
| Previously shared provider credential | Deferred provider action | A Groq key appeared in earlier task messages; rotate it in the provider and update local/hosted environment. No value is included here, and rotation was not performed |
| Remote durable storage and migration | Deferred operational step | Provider contract/fallback is implemented; credentials/provider/policy and live durability proof are absent |
| Automatic retention duration | Deferred | No user-approved period or operational cleanup policy; deletion is supported |
| Distributed rate limiter and durable worker queue | Deferred | Current in-memory/synchronous design remains a documented serverless limitation |
| Password reset, email verification, account deletion/withdrawal | Deferred | Separate product workflows; not required to correct the current integration/security defects |
| Application status transition policy | Deferred | Allowed statuses are validated; business transition constraints need a policy |
| Audit-log model and CI gate | Deferred | Additional operations features; absence is documented, no implementation claimed |
| Negative caching/retry for optional providers | Deferred optimization | Successful caching/deadline/optional degradation exists; avoid claiming a negative cache or retry policy |

The exact implementation and final tests are recorded below after review. A deferred finding remains open; it is not dismissed as harmless.

## Local change summary

The combined work introduces source-aware LinkedIn fields, optional provider degradation, extraction evidence validation, protected resume access and application references, extraction retry/missing-resume UI fixes, stale-job reconciliation, active-job concurrency enforcement, per-user AI limits, production CORS/CSP/no-store hardening, compatible dependency fixes, a resume storage provider contract, safe test isolation, and corrected deployment/technical documentation.

Production `autoIndex` is disabled. The stronger named `one_active_analysis_per_submission` index is defined/tested locally but was not inspected/applied in production. `DEPLOYMENT.md` documents duplicate inspection, reviewed survivor corrections, explicit index creation/verification, and only then optional removal of an obsolete compound index; no production index operation was performed.

The resume contract still uses a filesystem provider. New applications capture `reviewSnapshotAt` and available profile/report IDs, including an explicit capture with no evidence. The application references point to database records rather than embedding complete immutable document copies. Legacy applications need documented compatibility handling; deleting a referenced profile/report must not silently make a different record look like the original application evidence.

## Final verification record

These entries record final commands and public evidence. Unverified operational work remains open.

| Check | Final status |
|---|---|
| Backend full suite on guarded disposable DB | 306 passed, 2 drift skipped; 26 passing files, one skipped |
| Focused regression suites | Latest focused snapshot/concurrency/application/assistant run: 52 passed; overlaps full suite |
| Isolated backend unit suite | 141 passed; overlaps other coverage |
| Frontend tests/lint/build after latest edits | 51 tests passed; lint 17 existing warnings/no errors; production build passed |
| CSP and external theme initialization checks | Passed locally; CSP verified on all five production routes; landing browser smoke passed |
| Syntax/diff checks | All changed backend JavaScript syntax checks and diff checks passed |
| Backend/runtime and frontend dependency audits | Both report 0 vulnerabilities after nonbreaking fixes |
| Combined diff review and secret scan | Reviewed; scan of 80 release files found only a generic username/password placeholder in `.env.example`; real `.env` ignored |
| Release commit and push | Source release `3f8facde7cf1bec00276f9b0d965428ae0352d22` committed and pushed to `origin/main`; evidence-only documentation follows |
| Frontend deployed revision | `65db9f28bd4c1c8cecc8004d68441b6bf117d33e`: build-info JSON and Cloudflare production metadata match |
| Backend deployed revision | Same full release SHA: live revision header and Vercel provider Git metadata match; READY, Node.js 22.x |
| Repeated live CORS/SPA/health checks | 2 October 2026, 10:20:41 UTC: all five frontend routes 200 with identical SPA HTML and CSP; health 200 `{status,timestamp}`; health/jobs preflights 204, exact frontend origin allowed, unknown origin receives no allow-origin header |

## Controlled integration verification

No approved demo authentication credentials or public test usernames were configured. No remote storage credentials or adapter were activated. Initial CLI authentication failed, then provider access was restored and both existing projects were deployed to release `65db9f28bd4c1c8cecc8004d68441b6bf117d33e`, which includes implementation commit `3f8facde7cf1bec00276f9b0d965428ae0352d22`. Live revision markers and provider metadata match. Cloudflare project `vortex` has no Git provider and used direct upload; Vercel project `vortex-api` is READY on the unchanged API alias. Production mode was explicitly set, and configuration/key presence was inspected safely. Detailed integration coverage still uses generated/mocked fixtures; no production authentication submission, personal profile upload, AI call, persistence test, or index migration was performed.

| Workflow | Baseline coverage | Production status |
|---|---|---|
| GitHub normalization/public enrichment/cache/failures | Local mocked tests | End-to-end analysis not tested live |
| LeetCode language counts/timeout/optional failure | Local mocked tests | Public provider request not tested live |
| LinkedIn URL/text/source evidence | Local validation and mocked extraction tests | Source deployed; request behavior not tested live |
| Resume-only and combined-source extraction/scoring | Local mocked fixtures | Production AI completion not tested |
| Student/admin assistant | Static route/context inspection and local tests | Production chat not tested |
| Resume access and explicit no-resume | Local authorization/privacy tests | No production upload/download test |
| MongoDB persistence | Full mocked suite passed against a dedicated disposable local MongoDB container | Durable production write/read not tested |
| Remote resume durability | Filesystem provider tests only | Not configured or verified |
| Interrupted serverless analysis recovery | Local state/reconciliation tests | Real Vercel interruption/retry not tested |

## Remaining production risks

- Ephemeral Vercel `/tmp` resume storage can leave database references without downloadable files.
- The 60-second serverless cap can interrupt provider work. Stale reconciliation runs only on startup/first serverless database connection/new analysis, not polling or cron; it restores retryability when triggered and is not a durable queue.
- Per-instance in-memory rate limits do not enforce a global quota under scaling.
- Browser localStorage tokens remain exposed to any successful same-origin script compromise. CSP was verified on the deployed frontend but does not eliminate that risk.
- Production active-job/index readiness remains unknown; automatic index creation is disabled and a reviewed operator migration is still required.
- Production database provider, persistence/backups, and AI model availability/quota remain unknown. Production configuration/key presence and deployed source revision were verified separately; they do not establish working workflows.
- Optional public endpoints can fail or change; users must still be able to complete resume-only analysis.

For the full implementation, see `PROJECT_TECHNICAL_DOCUMENTATION.md`. For provider/deployment claims, see `INTEGRATION_STATUS.md`. For release configuration, see `../DEPLOYMENT.md`.

Tests ran on Linux with Node.js 24.13.0. Vercel metadata confirmed Node.js 22.x for the production release, and safe health/CORS checks passed there; the full suite was not run on the hosted runtime. Native Windows was not exercised. The disposable MongoDB container was stopped after verifying only its system databases remained.

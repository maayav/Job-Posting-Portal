# Profile assessment release verification

Date: 2 October 2026. This record covers profile evidence scoring, career actions, optional LinkedIn PDF import, analysis stages, updated setup/study documentation, and role-specific fictional demo resumes.

## Automated checks

| Check | Result |
|---|---|
| Full backend suite | 326 passed; 2 intentional Gemini drift checks skipped |
| Frontend suite | 61 passed across 12 files |
| Demo reseed regression | Both tests passed; stale optional-source evidence and embeddings are cleared |
| Dashboard/profile follow-up | 7 passed after mobile sizing fix |
| Production frontend build | Passed |
| Frontend lint | No errors; 18 existing warnings |
| Backend and frontend dependency audits | Zero reported vulnerabilities |
| Diff and source review | Passed; no credential patterns found in the changed source/docs |

Focused checks overlap with the full suites. Tests use a guarded disposable loopback MongoDB database, temporary resume storage, and mocked providers. They do not consume production AI quota. Real-provider drift checks are intentionally opt-in.

## Browser workflow checks

A separate local API and browser build used fictional demo users, generated PDF resumes, six initial jobs, 48 initial applications, actual authentication/routes/models/storage, and mocked text/embedding responses. External upstream requests were blocked.

- Landing role selection, learning links, home navigation, Get started routing, and light/dark appearances were inspected.
- Student login/logout, FastAPI keyword search, saved jobs, application statuses, and role navigation worked.
- Resume selection, LinkedIn PDF text preview, optional coding evidence, skill review, analysis activity, and completed report persistence worked.
- Readiness and source scores stayed separate; missing sources were unscored and supplied text was labelled user-provided.
- Project/practice/post tabs worked. Curated problem URLs were rendered. Editing and copying a post draft worked without publishing anything.
- A roadmap task update reduced its open count from 16 to 15.
- Student and admin assistant messages showed loading feedback and readable headings/lists/links with mocked responses.
- Admin workspace totals, candidate selection, saved evaluation/evidence, and status updates worked. A protected PDF opened as a blob URL; browser policy prevented inspecting that tab. PDF contents/signatures and protected downloads are covered by local backend tests.
- An admin created a fictional FastAPI posting; a student then applied with their saved sample resume and received an application notification. Notification read controls worked.
- A student was blocked from the admin route with a 403 screen.
- The applications-by-job table and candidate board had bounded internal scrolling on desktop.
- Mobile pages were checked at a 390-pixel viewport. The roadmap role picker initially caused horizontal overflow; the sizing fix brought document scroll width back to its available width. Jobs, dashboard, assistant, admin jobs, and applications fit the viewport.

Upload forms and landing FAQ now consistently state the deployed 4 MiB limit. Application uploads reject non-PDF/oversize files before sending. Landing copy describes reviewing extracted skills accurately; it does not advertise an editing feature that the current review screen lacks.

## Production publication

Publication and post-release verification are pending for this source revision. Use the existing Cloudflare Pages project `vortex` and Vercel project `vortex-api`; no new host or paid upgrade is required. Public URLs remain:

- https://vortex-6g7.pages.dev
- https://vortex-api-eta.vercel.app/api

After publication, compare the frontend `/build-info.json` and backend `X-Vortex-Revision` with the release commit and provider metadata. Record safe GET/OPTIONS results separately from authenticated feature tests.

## Limits retained

Authenticated production account/AI workflows are not established by local mocked tests or SPA HTTP checks. No automatic production signup, personal resume upload, private LinkedIn scraping, or production quota-consuming AI call is part of this record. The earlier read-only GitHub/LeetCode account checks are described in the study guide; they do not prove the deployed analysis chain works.

Vercel resume storage remains ephemeral filesystem storage. Rate-limit counters remain per running instance. Production database readiness, persistence, and the active-analysis index require their own controlled verification. These limits are unchanged by this release.

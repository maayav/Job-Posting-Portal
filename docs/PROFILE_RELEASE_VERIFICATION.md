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

Source implementation commit `9271983c24444dc511d6df8e7d7a09c596c2b816` was pushed to `main` and published to the existing Cloudflare Pages project `vortex` and Vercel project `vortex-api`. No new host, subscription, or paid upgrade was added. Public URLs remain:

- https://vortex-6g7.pages.dev
- https://vortex-api-eta.vercel.app/api

Provider records for this implementation release:

- Cloudflare production deployment: `dcfc1321-2d72-433a-8d06-ac086d900f1d`; branch `main`; source `9271983`.
- Vercel production deployment: `dpl_6NcwELq4PpzJt6esjBfuwUSntrWP`; state `READY`; Node.js `22.x`; Git metadata matches the full source commit; canonical API alias assigned.

Safe live HTTP checks completed at `2026-10-02T16:47:58.999Z`. Both frontend `/build-info.json` and backend `X-Vortex-Revision` matched the full source commit.

| Live check | Result |
|---|---|
| Frontend `/`, `/jobs`, `/dashboard`, `/analysis/new`, `/assistant`, `/admin/jobs`, `/admin/applications`, `/applications`, `/login` | 200; identical SPA HTML; Content Security Policy present |
| Backend `/api/health` | 200; JSON contains `status` and `timestamp`; liveness only |
| Unauthenticated `/api/jobs`, `/api/assistant/context`, and analysis status route | 401 with `unauthorized`; no account or submission was created |
| OPTIONS for `/api/jobs` and `/api/health` from the frontend origin | 204; exact frontend origin allowed |
| OPTIONS from an unknown origin | 204; unknown origin not reflected or allowed |
| Fresh production browser | Landing content rendered; Get started opened the login form; no captured console errors or warnings |

These checks prove publication, routing, liveness, CORS, and the sampled authentication boundaries. They do not establish authenticated production analysis, upstream profile integration, or database persistence. A documentation-only follow-up commit can have a newer revision marker while retaining this tested application implementation. For any such publication, compare its current Git HEAD with both live markers again.

## Limits retained

Authenticated production account/AI workflows are not established by local mocked tests or SPA HTTP checks. No automatic production signup, personal resume upload, private LinkedIn scraping, or production quota-consuming AI call is part of this record. The earlier read-only GitHub/LeetCode account checks are described in the study guide; they do not prove the deployed analysis chain works.

Vercel resume storage remains ephemeral filesystem storage. Rate-limit counters remain per running instance. Production database readiness, persistence, and the active-analysis index require their own controlled verification. These limits are unchanged by this release.

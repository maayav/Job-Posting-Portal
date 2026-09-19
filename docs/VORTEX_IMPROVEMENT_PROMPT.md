# Vortex: website audit and implementation prompt

Audit date: 19 September 2026. Project: `/home/gman/dev/projects/pride_proj`.

## What was reviewed

The live public landing page, theme toggle, login/signup interface, navigation, and mobile product walkthrough were inspected in the browser. At a 390 × 844 viewport, the tour displayed readable foreground cards and advanced from role matching to readiness while scrolling after opting into animation. The browser respected reduced motion initially. No warning/error entries were captured in that temporary public-page session; the reported `file:///` error was not reproduced.

All application page components and relevant supporting authentication, job, application, analysis, and assistant code were reviewed. Authenticated student/admin flows were **source-reviewed, not signed into and exercised in the browser during this audit**. No application code was changed or test suites rerun for this document. Findings below distinguish code evidence from proposed improvements; they are not a claim that every feature passed live testing.

## Main findings

| Priority | Finding | Evidence / implication |
| --- | --- | --- |
| P0 | Editing a second job can retain the first job's form values. | `JobForm.jsx` initializes state from `initial` only on mount; `AdminJobsPage.jsx` changes that prop without remounting/resetting the form. |
| P0 | Assistant candidate coverage is incomplete. | `assistant.controller.js` retrieves 120 recent applications and sends only 80 candidates to the model. Older named candidates can be omitted even when global totals are correct. |
| P0 | “Open roles” currently means all saved jobs. | The assistant uses `jobs.length`; the job model has no open/closed lifecycle. |
| P0 | ATS and readiness are presented as distinct scores but share one value. | `application.controller.js` assigns `report.score` to both; the student dashboard also repeats this metric. |
| P1 | Returning students can lose access to their latest report in the UI. | `DashboardPage.jsx` relies on a local `report_id`, without server discovery when that key is missing. |
| P1 | Long assistant replies can break the next request. | History entries are validated at 1,200 characters, while the client sends full replies; the current question is also repeated in history. |
| P1 | Assistant error handling and formatting need work. | Context-load failures can look like “Complete an analysis first,” even for admins. The renderer handles several Markdown constructs but not tables. |
| P1 | Candidate loading and counts need a scalable contract. | The dashboard fetches all remaining pages concurrently. The Applications board groups only the current 20 records, whereas summary totals describe a larger dataset. |
| P1 | Job management stops at the first 50 jobs. | `AdminJobsPage.jsx` requests page 1 with no pagination controls. Hard deletion also leaves application references without useful job metadata. |
| P1 | Analysis progress is not resumable in the interface. | `UploadPage.jsx` keeps workflow state locally and polls up to 40 times, without lifecycle cancellation or refresh recovery. |
| P2 | The design needs refinement rather than another rebuild. | The current cream/charcoal theme and traveling-card tour already exist. Oversized hero text, repeated copy, tiny metadata, and dense operational views are better targets for improvement. |

---

## Ready-to-use implementation prompt

Continue the existing Vortex project at `/home/gman/dev/projects/pride_proj`. Improve the complete product, preserving current work, data, authentication, and working features. Inspect the actual code and running app before editing. This is an incremental product improvement, not a replacement project.

Vortex serves two audiences: students discovering jobs and understanding their skills, and placement administrators managing jobs, applications, and candidate progress. Make the product clearer, more dependable, and more polished for both.

### 1. Constraints and visual direction

- Preserve React/Vite, Express, MongoDB, existing routes, and server-enforced roles. Adapt components to React Router; do not introduce Next.js solely for a copied component. Keep existing animation dependencies unless a replacement has a demonstrated benefit.
- Keep Groq for text generation and Gemini for embeddings. Keep credentials on the server and out of source, logs, screenshots, documentation, and client bundles.
- Light mode: creamy off-white page and card surfaces, charcoal text, neutral grey outlines. Dark mode: black/charcoal surfaces, grey borders, readable off-white text. No green, dark-blue, or brown accents. Centralize theme tokens so hero, tour, CTA, forms, overlays, charts, and empty states all follow the selected theme.
- Retain the Vortex brand at the left, centered tubelight-style navigation on desktop, and sun/moon icon toggle with accessible labels. Keep mobile navigation useful without tiny targets or hidden destinations.
- Use a consistent spacing scale, restrained shadows, and clear type hierarchy. Start with approximately 15–16px body text and 12–14px meaningful metadata; do not shrink essential information to make a layout fit. Prefer 44px interaction targets, visible focus, and WCAG AA contrast.
- Preserve existing improvements. Do not rebuild the tour into the old uniform stack or reset light mode to dark panels.

### 2. Fix correctness before visual expansion

Address these source-identified issues first, confirming each against the current checkout:

- Reset or key the job form when the edited job changes. Test switching directly from Edit A to Edit B and verify B receives only B's intended values.
- Replace the dashboard's localStorage-only report discovery with an authenticated latest-report lookup and accessible report history. A student signing in on a fresh browser must find their saved analysis. Keep report ownership checks server-side.
- Use one accurate “Role readiness” metric with its target role, date, and scoring explanation. Do not display the same number as two independent ATS/readiness measurements. In admin views, clearly distinguish the applied job from the role used for an analysis.
- Separate missing data, empty results, permission failures, and network/provider failures. Show actionable retry controls and retain valid user input. Never translate a server error into a zero count or “no analysis” state.
- Preserve application records and job context when a posting is closed or archived. Add defensive rendering for already-deleted job references; avoid blank titles or `undefined` metadata.

### 3. Landing page `/`

- Keep `/` a public Vortex landing page. Every Get started action must reach login/signup; after authentication, preserve a safe internal destination when the visitor chose a specific feature.
- Make the first screen explain the product concretely: resume evidence, role readiness, job discovery, and application tracking. Reduce repeated “next move / clarity / momentum” copy. Keep the AI proposition without restoring “AI-assisted career clarity.”
- Bring useful product evidence into the first viewport alongside the headline and primary CTA. Reduce excessive headline scale and empty space. Use an intentional sequence: proposition and preview, product walkthrough, student/team value, concise workflow, FAQ, final CTA.
- Keep demonstration information labeled illustrative. Do not invent testimonials, customer logos, placement claims, or imply that a sample match percentage is a live ranking capability when it is not implemented.
- Refine the existing scroll tour: four cards on an uneven spatial path, a camera transition between them, and one legible foreground card at each stop. Use brief transitions and sufficient reading pauses. Avoid a uniform stack, flickering borders, text fading into the background, or header/control overlap.
- Keep scroll and chapter selection synchronized. Ensure entering via an anchor, scrolling backward, resizing, changing theme, and toggling animation retain a sensible chapter. Choose scroll distance based on content and viewport fit rather than leaving a long empty scroll runway.
- Preserve native touch scrolling. On short screens or when motion is reduced, provide the complete chapter-selectable version. Honor system reduced motion and retain an explicit opt-in. Animate section entrances once using the existing observer/GSAP utilities; do not make essential content depend on an animation loading successfully.

### 4. Authentication and shared navigation

- Keep login/signup visually consistent and balanced. On mobile, prioritize the form over a long marketing introduction. Add show/hide password, appropriate autocomplete attributes, inline errors, and reliable submitting states.
- Preserve intended internal destinations after login, without allowing external redirect URLs. Confirm logout clears user-specific UI caches and account switching cannot display another user's stale report.
- Keep navigation relevant to the signed-in role. Prioritize jobs, dashboard, analysis, assistant, and personal applications for students; prioritize dashboard, jobs management, applications, and workspace assistant for admins. Preserve existing authorized features through secondary navigation where appropriate.
- Add a useful not-found route and accessible active-route states. Verify both `/analyze` and `/analysis/new` continue to work.

### 5. Jobs `/jobs` and application submission

- Improve skill entry with removable selected chips and autocomplete for the current token. Support arbitrary valid skills and broad categories: FastAPI, Django, Flask, Spring Boot, .NET, Go, SQL, cloud platforms, Docker, Kubernetes, testing, data/ML, design, and the existing JavaScript stack.
- Combine actual job skills with curated suggestions. Share canonicalization behavior across frontend/backend and test aliases; do not merge unrelated technologies. Clearly describe whether selecting several skills matches any or all of them.
- Add title/company search, useful sorting, total-result counts, and URL-backed filters/pagination so back navigation restores the search. Keep city and experience semantics explicit.
- Give cards consistent title/company/location/experience hierarchy and obvious application state. Long descriptions must not make adjacent cards unbalanced; provide accessible job detail viewing.
- Make applying provide a clear confirmation, duplicate protection, retryable failures, and an immediate link to My Applications. Preserve the draft if submission fails. Do not show an active Apply control when the job is closed.
- Keep example data isolated from real records. A suggestion for FastAPI must not imply matching jobs exist when none do.

### 6. Student dashboard `/dashboard` and My Applications `/applications`

- Build the student dashboard around the latest saved report: target role/date, one readiness summary, strengths and gaps, prioritized next actions, and a clear route to the assistant or another analysis. Avoid repeated score panels and oversized decorative headers.
- Make study-plan completion persist and show failures visibly. Resource links must not toggle a checkbox accidentally. Resources must match the actual skill; absent resources should have an honest unavailable state rather than defaulting to React links.
- My Applications should offer a readable list with role/company, applied date, actual status, and a detail view containing the submitted cover letter and available status history. Add filtering and pagination as needed.
- Preserve job context for closed/archived postings. Empty, loading, failed, and no-search-results states must be distinct and useful.

### 7. New Analysis `/analyze` and `/analysis/new`

- Balance the page with a primary form/review area and a smaller supporting explanation area; align both with the step indicator. Collapse to one logical column on mobile.
- Improve PDF upload with a visible selected filename, size, replace action, and clear 5MB/type guidance consistent with server limits. Preserve optional GitHub/LeetCode inputs and target-role selection.
- Keep upload, evidence review, and analysis states explicit. Show extraction failures in plain language, retaining retry-from-saved-resume behavior. Indicate unavailable optional sources without pretending they were analyzed.
- Resume an in-progress submission/report after refresh. Cancel obsolete polling on navigation/unmount, prevent duplicate analysis requests, and provide meaningful timeout recovery. Show real workflow stages rather than invented progress percentages.
- Keep skill evidence inspectable and retain any current review controls. Completed analysis must reliably open the correct saved report.

### 8. Admin dashboard `/dashboard`

- Preserve exactly three candidate-flow tabs: **Total, Applied, Review**. Review groups under-review, shortlisted, and interview-scheduled records; Total includes all statuses. Clearly label counts as applications or distinct candidates, since one person can apply to several roles.
- Use a compact candidate list/table and adjacent detail panel on desktop. On mobile, View should open a dismissible drawer or full-screen detail view with focus restoration and preserved list position. No bottom-of-page horizontal-scroll dependency.
- Keep search, role filter, clear action, and pagination near the list. Use server-side pagination/filtering with exact aggregates instead of fetching every page concurrently.
- Preserve actual statuses independently of grouped tabs. A shortlisted record must remain visibly shortlisted, and choosing Under Review must actually update it to that status.
- Show name, applied role, application date, actual status, and clearly defined readiness when available. Candidate detail should include profile evidence, target role of the analysis, gaps, study plan, cover letter, and status history.
- Reset stale details immediately when selecting another record; a failed request must not leave the previous candidate visible under the new selection. Offer retry within the detail view.
- Provide an authorized HTTP resume endpoint when a saved resume exists. Never expose filesystem paths or use `file:///` links. Missing documents and missing analysis must have explicit states.

### 9. Admin jobs `/admin/jobs` and applications `/admin/applications`

- Add searchable, paginated job management beyond the first 50 records. Implement an explicit open/closed/archived lifecycle, safe defaults/backfill for existing jobs, and reopening where appropriate. Derive open-role counts from this state.
- Preserve application history when archiving. Keep destructive operations distinct, confirmed, and documented. Do not silently delete applications with a posting.
- Reuse a consistent candidate-detail component on the Applications page. Prefer a paginated table/list as the default, with all real statuses available as filters. If retaining a board option, distinguish page counts from dataset totals and keep controls reachable.
- Role-breakdown View actions must open the correct filtered candidates. Reconcile visible records, totals, and filters after status changes; prevent stale search responses from overwriting newer results.

### 10. AI Assistant `/assistant`

- Students: ground answers in their authorized analysis, target role, evidence, gaps, and study plan. Admins: ground answers in authorized jobs, application aggregates, candidates, and status history. Determine permissions on the server, not from browser claims.
- Replace arbitrary recent-record truncation with query-specific retrieval. Compute counts through database queries, retrieve relevant candidates by role/status/name, disambiguate duplicate names, and disclose scope when results are limited. A candidate older than the newest 120 applications must still be findable.
- Answer questions such as “How many distinct people applied?”, “How many applications per role?”, “Which roles are open?”, and “What evidence is available for this candidate?” with consistent definitions and links back to records. Include freshness information. Do not invent candidate facts or equate a readiness score for one target role with fit for another job.
- Format responses with a short direct answer followed by relevant headings, lists, or tables. Support Markdown tables and nested lists safely, constrain table overflow locally, and retain safe link handling. Do not render untrusted raw HTML.
- Fix history limits so a long valid answer cannot break the next turn. Send the current question once, bound context deliberately, retain failed questions, and add retry/copy controls. Use role-specific loading/empty/error text; an admin context failure must not ask the admin to complete a student analysis.
- Refresh workspace summaries appropriately after job/application changes. Keep the assistant informational; no autonomous hiring decisions or silent status mutations.

### 11. Reliability, performance, and acceptance checks

- Diagnose the reported `file:///` security error by capturing its actual source/initiator in the affected browser. Check app links/assets, resume handling, generated AI links, and development/browser sources. Do not disable browser security or merely suppress the message. If unreproduced, report that explicitly.
- Preserve Windows-compatible npm/setup commands and document frontend/API ports, proxy configuration, environment variables, seeding, and port-conflict recovery. Do not terminate an unidentified process occupying port 5173.
- Reduce unnecessary route bundles and animation work using measured evidence. Lazy-load heavy views where useful, clean up observers/timers, and avoid attaching scroll-driven React state updates on every frame.
- Verify public, student, and admin routes at 360, 390, 768, 1024, and 1440px widths, both themes, short landscape screens, 200% zoom, keyboard navigation, and reduced motion. Ensure no unintended page-wide horizontal overflow or navigation obscuring content.
- Exercise login/logout, jobs search, application submission/duplicate handling, job create/edit/close/reopen, candidate viewing/status changes, PDF upload/retry, analysis completion/refresh recovery, report discovery, study-plan persistence, and multi-turn assistant conversations.
- Use isolated fixtures for empty data, missing/deleted references, long names/descriptions, more than 50 jobs, more than 120 applications, multiple applications per person, failed API calls, and AI-provider failures. Keep demo accounts/data separate and clearly labeled; never seed over real records automatically.
- Run relevant backend/frontend tests, production build, and lint. Add focused regressions for the confirmed bugs. Browser-check authorized student and admin sessions; do not claim those flows passed from source inspection alone.

Work in this order: correctness and data contracts, shared theme/navigation, operational pages and assistant, then landing polish. Deliver a concise change report with screenshots of desktop/mobile in both themes, checks actually performed, migration/setup notes, and remaining limitations. Avoid another broad visual rewrite that leaves the underlying workflows unreliable.

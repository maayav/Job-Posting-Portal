# How Vortex works from the ground up

## A personal study guide for Maayav

This guide starts with what happens when a person opens the site and follows the work through the browser, API, database, and external services. It uses the actual code in this repository. It also points out places where the current implementation is simpler or more limited than its name might suggest, so you can explain it accurately.

You do not need to understand all of JavaScript, React, HTTP, or AI before starting. Read one chapter at a time. When a chapter mentions a file, open that file and look for the named function or route. The project uses JavaScript and JSX: it is a React and Vite application, not a TypeScript or Next.js application.

## The project in one picture

Vortex has three main pieces. The browser runs the React interface. An Express API checks requests and performs application work. MongoDB stores users, jobs, applications, skill evidence, and reports. Groq and Gemini are separate optional services used by the analysis pipeline.

```text
Your browser
  React pages and components
       | HTTPS request, sometimes with a bearer token
       v
Vercel serverless API
  Vercel handler -> Express middleware -> route -> controller -> service
       |                 |                                  |
       |                 +-- checks limits and permissions  +-- Groq text requests
       |                                                    +-- Gemini embeddings
       v
MongoDB                                             Optional public sources
  users, jobs, applications                         GitHub REST / LeetCode GraphQL
  profiles, extracted skills, reports                LinkedIn text or a user-imported PDF

Cloudflare Pages serves the frontend files. Vercel serves the API.
```

The current app is not a browser-only demo. The browser fetches live data from the API. The public landing page can show the bundled role guide without signing in; jobs, analysis, assistant, and dashboard workspaces require an account.

## A small vocabulary

| Word | What it means here |
|---|---|
| Browser or client | The React application running on a student's or admin's device. |
| API | Named URLs that accept requests and return data. Vortex's API is the Express app mounted under `/api`. |
| Request | One message from the browser, such as “show my applications.” It has a method, URL, headers, and sometimes a body. |
| Response | The API's reply: a status code, headers, and usually JSON data. |
| Route | A method and path that choose what work should happen, such as `POST /api/auth/login`. |
| Middleware | Shared request handling that runs before a route, for example checking a token or request limit. |
| Controller | Code that handles one route's input and response. |
| Service | Reusable work called by a controller, such as extracting skills or calling Groq. |
| Model | A Mongoose description of a MongoDB document and its fields. |
| ID | A database identifier. Vortex commonly uses MongoDB ObjectIds, written as 24 hexadecimal characters. |
| Environment variable | A setting supplied when the process starts. Provider keys and the JWT secret belong on the backend only. |
| Serverless function | A hosted function that handles a request and may stop after its response. It cannot depend on an in-memory job quietly running later. |
| Embedding | A list of numbers representing text. Vortex generates these with Gemini, but its current readiness matcher still requires a matching canonical skill name. |

## 1. Find your way around the repository

Start in the repository root. The root `package.json` contains the commands that coordinate the frontend and backend. `frontend/` contains the browser application. `backend/` contains the API, data models, AI integrations, sample PDF files, and tests. `backend/ontology/` contains role requirements. `backend/resources/` contains learning links. `docs/` explains the API, deployment, schema, and this guide.

```text
pride_proj/
  package.json                  commands for the whole project
  scripts/                      root setup, development and catalog build
  frontend/src/pages/           screens such as jobs, dashboard and analysis
  frontend/src/api/client.js    shared browser-to-API client
  backend/api/index.js          hosted Vercel entry point
  backend/server.js             local long-running API entry point
  backend/src/routes/           URL-to-controller wiring
  backend/src/controllers/      request handling
  backend/src/services/         reusable business and provider logic
  backend/src/models/           MongoDB document definitions
  backend/ontology/             skill requirements by role
  backend/resources/             curated learning resource data
  backend/tests/                automated tests and fixtures
  docs/                         setup, API, deployment and study references
```

The browser source uses `.jsx` and `.js`. `frontend/src/App.jsx` lists the pages. `frontend/src/pages/` contains screen-level components. Shared buttons, dialogs, guards, and navigation live in `frontend/src/components/`. Global look and theme are in `frontend/src/index.css` and `frontend/src/context/ThemeContext.jsx`.

The API request path becomes easier to follow when you read the layers in this order: `backend/src/app.js`, the matching file in `backend/src/routes/`, its controller, then the services and models it calls. A local API run starts from `backend/server.js`; Vercel starts from `backend/api/index.js`.

## 2. What happens when a page opens

When you open the website, the browser first downloads HTML, JavaScript, CSS, and other static assets from Cloudflare Pages. React then starts inside the browser and React Router chooses a page using the URL. For example, `/jobs` loads the jobs page. Opening a route directly still returns the frontend's HTML shell; React then interprets the path.

Most pages are protected by `ProtectedRoute` in `frontend/src/components/ProtectedRoute.jsx`. It checks whether the browser has local user information and a token before displaying a protected workspace. This improves navigation, but it is not the final security check. A person can bypass a browser check, so the backend also checks every protected API request.

The landing page includes an interactive role guide built from generated frontend data. It currently covers 21 roles, 149 ontology skills, and 293 distinct curated resource URLs. The authenticated API catalog comes from MongoDB, so the landing catalog and workspace data can differ if a database has not been seeded or has changed.

**Follow it in code:** `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `scripts/build-role-catalog.mjs`.

## 3. How the browser calls the API

The shared Axios client lives in `frontend/src/api/client.js`. During local development, the browser requests a relative URL such as `/api/jobs`; Vite forwards `/api` to the API on port 5000. In production, the frontend build receives `VITE_API_URL`, which points at the deployed API. Vite's production build replaces that public setting in the downloaded JavaScript.

For a protected request, the client reads the token from `localStorage` and attaches an HTTP header:

```http
GET /api/applications/me
Authorization: Bearer eyJ...example-token...
```

That token string above is only an illustration. Do not share a real token. The browser also sends JSON bodies for actions such as login or application. A file upload uses `multipart/form-data` because the body contains a PDF.

An API response includes a status code and often a JSON body. `200` means a read or update worked; `201` commonly means a new record was created; `202` means work was accepted or is in progress; `204` means the action succeeded with no body. Errors include codes such as `400` for invalid input, `401` for a missing/invalid login, `403` for a permission failure, `404` for a missing resource, `409` for a conflict such as a second active login, `413` for a file too large, `422` for validly shaped input that cannot be processed, `429` for a rate limit, and `503` for unavailable AI or a timed-out request. Read the response's `error` or `message` before guessing what failed.

If any protected request comes back `401`, the Axios response interceptor clears the saved token and user and sends the browser to `/login`, preserving the route to return to. It does not silently retry with another account.

**Follow it in code:** `frontend/src/api/client.js`, `frontend/vite.config.js`, `backend/src/config/cors.js`.

## 4. How one API request moves through the backend

`backend/src/app.js` creates the Express application and attaches shared middleware. A normal request moves through the serverless time budget, Helmet security headers, CORS rules, JSON body parsing, and the global API limiter before Express matches a route. Route-level checks then validate login, role, ownership, or a more specific rate limit.

For example, `POST /api/analyze` is attached by `backend/src/routes/analyze.routes.js`. That router first requires authentication, then the specific analysis limit, then calls `analyzeController.createAnalysis`. The controller validates the submission ID, confirms the profile belongs to the user (or caller is an admin), creates or reuses an analysis report, and calls the analysis service. The service loads the profile and role requirements, then orchestrates extraction, embeddings, scoring, study resources, and persistence.

This division keeps a route from becoming one giant function: a route decides who may call it; a controller translates the request into an action and response; a service handles reusable product work; a model reads and writes stored data.

```text
HTTP request
    -> global middleware
    -> route + route-specific middleware
    -> controller (parse input; select status code)
    -> service (product workflow)
    -> model/provider (database or external service)
    -> JSON/HTTP response
```

Unknown API paths reach the not-found handler. Thrown `AppError` and validation errors reach a central error handler, which returns a bounded response rather than making each controller invent its own error format.

**Follow it in code:** `backend/src/app.js`, `backend/src/routes/`, `backend/src/controllers/`, `backend/src/services/`, `backend/src/middleware/errorHandler.js`.

## 5. Login and one active session

When someone registers, the API validates the fields and hashes the password with bcrypt before it saves a user. The database never needs the original password. At login, bcrypt checks the submitted password against the stored hash. If it matches, Vortex makes a random session ID and signs a JWT containing the user ID, role, and session ID. The default token lifetime is seven days.

The JWT alone is not enough to keep a Vortex session active. The API loads the user for protected calls and compares the token's session ID with that user's current active session in MongoDB. This gives the user one active session per account. Trying to start another valid session can return `409 already_logged_in` until the first session logs out or expires. Closing a browser tab does not tell the API to log out.

On logout, `POST /api/auth/logout` clears the active session on the server; the browser also removes its token and stored user. A `401` means there is no usable session. A `403` means the session is valid but the current role or ownership does not permit that action. The admin role cannot be requested from public registration; the project uses a backend script to create or promote admins.

The token lives in browser `localStorage`, which is easy to use but can be read by JavaScript running on the same page. This is why cross-site scripting prevention and keeping provider secrets out of frontend variables matter. Vortex's deployed content security policy helps limit where scripts load from; it does not make localStorage equivalent to an HttpOnly cookie.

**Follow it in code:** `frontend/src/context/AuthContext.jsx`, `backend/src/controllers/auth.controller.js`, `backend/src/services/sessionService.js`, `backend/src/middleware/auth.middleware.js`, `backend/scripts/create-admin.js`.

## 6. Roles, permissions, and data ownership

Vortex has student and admin roles. Students can work with their own profiles, reports, applications, saved jobs, and notifications. Admins manage job postings and review the candidate pipeline. The backend applies the role and ownership checks. A student cannot gain admin access by editing a browser value or changing an API URL.

Many database records point at another record's ID. An application, for example, points at a student and a job. A profile submission points at its owner. A report points at the submission it analyzes. This is a relational way to think about MongoDB: MongoDB documents do not require SQL tables, but application records still need well-defined relationships.

New applications record which available profile and report were in view at application time. Admin review uses those references instead of silently showing the student's newer analysis. A referenced analysis can still become unavailable if it is deleted; these references are not immutable copied evidence.

**Follow it in code:** `backend/src/models/`, `backend/src/routes/application.routes.js`, `backend/src/routes/admin.routes.js`, `backend/src/middleware/ownership.middleware.js`, `backend/src/controllers/assistant.controller.js`.

## 7. What lives in MongoDB

Mongoose gives the application a consistent description of each document and convenient query operations. MongoDB stores JSON-like documents, with IDs connecting one type of record to another.

| Record | In plain language | Related records |
|---|---|---|
| User | Login, role, hashed password, current session | owns profiles, applications, wishlists and notifications |
| Job | Position, company, location, skills, experience and open/closed state | referenced by applications and wishlists |
| Application | One student's application to one job, status, history and resume choice | references a user, job and possibly the profile/review snapshot |
| Profile submission | A particular resume and role choice, plus optional external usernames/text | belongs to one user; can have extracted skills and reports |
| Extracted skill profile | Skills, evidence snippets, source labels and confidence signals | belongs to a profile submission |
| Readiness report | Weighted score, strong/developing/gap lists, and study plan | belongs to a submission and target role |
| Skill ontology | Canonical skills, weights, vectors and roles that require each skill | shared requirements used for role analysis |
| Resource catalog | Curated learning links attached to skills | looked up when building or refreshing a study plan |

Unique database indexes can stop duplicate users/applications and overlapping active analyses. They only protect the database after they exist. In production, automatic index creation is deliberately disabled, and the reviewed operational migration still must be applied before claiming that the new active-analysis guarantee is active on a specific database.

**Follow it in code:** `backend/src/models/` and `docs/SCHEMA.md`.

## 8. Jobs and the application pipeline

Job search starts in the job pages and makes authenticated calls to `/api/jobs`. Filters can include skill names, keywords, experience, city, sorting, and page size. The API normalizes known aliases such as `Node` and `Node.js`, then matches against job fields. This is catalog/search matching, not AI ranking. The local demo seed covers a range of engineering, design, data, cloud, security, and business roles.

A student can save a job or apply. Applying validates the job and resume choice, prevents duplicate applications when its unique index exists, and saves the current status plus a history entry. An uploaded application PDF can be used without creating a profile analysis; a profile PDF may be selected separately; an explicit no-resume choice remains no resume. Admins review applications and change statuses. The API stores a status-history event, and notifications let the student see the change.

The dashboard summarizes the application pipeline and may show candidates and per-role totals to admins. Its mock/demo seeds help with a local walkthrough; those fake names and counts do not prove anything about production users.

**Follow it in code:** `backend/src/routes/job.routes.js`, `backend/src/controllers/job.controller.js`, `backend/src/models/job.js`, `backend/src/models/application.js`, `backend/src/controllers/application.controller.js`, `backend/src/routes/admin.routes.js`, `backend/src/controllers/assistant.controller.js`.

## 9. Resume upload and skill extraction

When a student begins analysis, the frontend posts a PDF and the selected role to `/api/profile` using `multipart/form-data`. The upload middleware limits the body, checks the PDF type from its contents, and rejects invalid files before saving. Vortex extracts text from readable PDF pages. It does not run optical character recognition (OCR), so an image-only scanned résumé may not yield usable text.

An upload can also name optional GitHub and LeetCode accounts. The LinkedIn URL is only validated; Vortex does not scrape LinkedIn. If a student provides LinkedIn profile text, the service treats that text as user-provided evidence. Optional-source errors can be recorded while the resume processing path continues.

The backend sends the bounded profile text to the configured text provider (Groq by default) with instructions to return a structured skill list. Zod checks the shape of that JSON. The backend then verifies that the named technology and any quoted evidence appear in the submitted sources, normalizes aliases, merges duplicates, and labels each piece of evidence with its source. The model does not get to create requirements for the target role; requirements come from the project's ontology.

The review screen displays the extracted skills. The current implementation does not provide a control for the student to edit that list before scoring, despite older interface copy implying that it does.

**Follow it in code:** `backend/src/routes/profile.routes.js`, `backend/src/middleware/upload.middleware.js`, `backend/src/controllers/profile.controller.js`, `backend/src/services/skillService.js`, `backend/src/services/skillExtractionService.js`, `backend/src/services/githubService.js`, `backend/src/services/leetcodeService.js`, `backend/src/services/linkedinService.js`.

## 10. Gemini embeddings and the readiness score

The project has two AI concepts that are easy to mix up. Text generation means asking a language model to create structured text. Groq is the configured text provider for skill extraction, plan explanations, and assistant replies. Embeddings mean sending text to Gemini to receive a numeric vector. The project generates and caches those vectors for candidate skills and role requirements. Changing the embedding model or version requires re-embedding the ontology and doing the documented drift checks.

The current readiness matcher still requires canonical technology names to match. `React` can match canonical `React`; it will not become `PyTorch` just because two vectors look alike. After names pass that equality check, the matching entry receives a similarity of one. This means the present scoring result is effectively exact normalized-name matching with evidence limits, not semantic matching by cosine similarity. The vector generation is still part of the analysis pipeline, so stale model/version data can make an analysis fail even though vectors are not currently used to equate different names. That implementation detail is important when explaining or improving the score.

For each required role skill, Vortex assigns a match value between 0 and 1. A skill without supporting evidence is capped at 0.4. Low-depth evidence is capped at 0.65. Otherwise an exact supported match can receive 1. Each role skill also has a weight. The score is the rounded weighted average:

```text
score = round(100 × sum(role-skill weight × match value)
                  / sum(role-skill weights))
```

For example, imagine a role has two requirements: Python weight 0.8 and Docker weight 0.2. If the candidate has strong evidence for Python (match 1.0) but only a bare Docker keyword (match capped at 0.4), the score is `round(100 × (0.8×1 + 0.2×0.4) / 1.0) = 88`. The example shows the formula; it is not a hiring result. Current labels classify matches at 80 or above as strong and 60 through 79 as developing; anything lower is a gap. Gap priorities combine importance (weight) and the unmatched portion.

This number is a product readiness indicator built from those rules. It is not an employer's decision, a calibrated probability of getting hired, or a separate external ATS score. The visible label is now **Role readiness**. A legacy `atsScore` alias may still exist in internal compatibility data; it is not another score.

**Follow it in code:** `backend/src/services/embeddingService.js`, `backend/src/services/analysisService.js`, `backend/src/services/scoringService.js`, `backend/src/config/roles.js`, `backend/ontology/`.

### A separate assessment of your wider profile

New reports also save `profile_assessment`. Think of role readiness as “how much of this role's skill list is supported?” and the profile assessment as “what evidence is available across my sources?” They answer different questions. Five source cards show resume, GitHub, LeetCode, LinkedIn text, and other coding-profile text. A missing or failed source displays “Not scored”, not zero.

The current profile score averages the available source scores equally. Resume and user-provided text use source-specific role coverage. GitHub uses 70% role coverage plus 30% README coverage across the sampled repositories. If a README request is unavailable, the GitHub score is withheld rather than treating that request as a missing README. LeetCode uses a disclosed practice milestone: 60 points for progress toward 50 unique solved problems and 40 for practice across all three difficulty levels. This is a transparent product rubric, not a validated hiring measure. Always read source coverage alongside the number; two people with different sources cannot be fairly ranked by it.

GitHub evidence is a bounded snapshot of public repository metadata, README excerpts, and selected manifests. Vortex does not run the projects. LeetCode totals come from its public GraphQL response, not the sum of language counts: one solved problem may appear under multiple languages. The app does not retrieve solved problem identities. HackerRank, Codeforces, and CodeChef links are validated but not fetched; their evidence must be supplied by the user.

LinkedIn URLs are normalized, not scraped. A signed-in user can upload a LinkedIn profile PDF to `POST /api/profile/linkedin-preview`. The backend parses it in memory and returns editable text, truncated to 10,000 characters. That endpoint does not save the PDF or call an AI provider. When the user later submits the analysis form, the reviewed text is saved as user-provided evidence.

### From a score to practical next steps

The existing Groq study-plan call also asks for specific project ideas and selects practice problem IDs from a fixed catalog. The server controls skill names, membership, resource URLs, and practice destinations. A provider failure leaves the deterministic report intact and returns curated suggestions. LinkedIn post drafts describe future plans and contain placeholders for real results; users can edit and copy them. Vortex never publishes posts.

The report stores these actions in `career_actions`. The assistant receives the assessment and action context, so follow-up answers can discuss the same evidence. Older reports display an explanation instead of a made-up score; run a new analysis to populate the new fields.

The New Analysis screen shows actual server stages: evidence, matching, and planning. While the blocking serverless request runs, the browser checks the authenticated submission-status endpoint every four seconds. The animation shows activity, not a fabricated percentage. Reduced-motion settings disable pulsing and transitions.

## 11. The study plan and AI assistant

After scoring, Vortex makes an ordered list from missing and developing skills. It fills those rows with links from the project's curated resources, so a student's first learning links do not need to be invented by an AI model. Groq can add an explanation or personalized study guidance. A resource link being in the catalog does not guarantee that an external site will always stay online.

For an assistant response, the browser sends the student's question, recent chat history, and an optional report ID. The API loads that user's completed report and supporting skill information, checks that the selected analysis belongs to the user, and builds a bounded context. The text provider creates a reply using that context. This reduces the chance of a general answer drifting away from the user's role and report, but it does not make the model infallible.

For an admin, assistant context is built from bounded job and application records. Candidate reviews use the saved application references described earlier when they exist. The context is capped; it is not a query over an unlimited number of records and it should not be described as finding every historical record.

**Follow it in code:** `backend/src/services/resourceService.js`, `backend/src/services/ai/studyPlanService.js`, `backend/src/routes/assistant.routes.js`, `backend/src/controllers/assistant.controller.js`, `backend/src/services/ai/aiTextProvider.js`.

## 12. What rate limiting does

A rate limit counts requests over a time window. It helps slow accidental loops, repeated expensive AI calls, and basic request floods. Vortex has a general limit plus smaller limits for operations that can consume resources. Values below are the defaults in production code; tests raise limits so test runs do not trip over one another.

| Requests | Default limit | Who shares the counter |
|---|---:|---|
| All API requests | 120 per minute | Requests from the same client IP on a running API instance |
| Login and registration | 50 per 15 minutes | Requests from the same client IP on a running API instance |
| Profile upload or extraction retry | 5 per 15 minutes | Requests from the same signed-in user on a running API instance |
| New analysis | 10 per minute | Requests from the same signed-in user on a running API instance |
| AI assistant chat | 20 per minute | Requests from the same signed-in user on a running API instance |

Why have two limits? The general limit protects the API as a whole. A per-user AI limit protects a more expensive operation without punishing every user for someone else's requests. The login limit works by IP because the caller may not be signed in. The AI-specific limits can use the user ID because authentication runs before those route limiters.

These counters use the default in-memory store from `express-rate-limit`. On Vercel, separate server instances can have separate counters and can disappear. Treat these as per-instance guardrails, not a durable global quota or a billing cap. The deployed health shortcut and CORS preflight are handled before Express, so they do not go through this Express API limiter.

When a request reaches a limit, the API replies with `429 rate_limited` and a human-readable message. A `429` for re-running an analysis shortly after it completed uses a separate one-minute per-submission cooldown. A rate limit does not guarantee that an upstream provider is free or under budget; provider accounts have their own plans and quotas.

**Follow it in code:** `backend/src/middleware/rateLimit.middleware.js`, `backend/src/app.js`, `backend/src/routes/profile.routes.js`, `backend/src/routes/analyze.routes.js`, `backend/src/routes/assistant.routes.js`, `backend/src/controllers/analyze.controller.js`.

## 13. Time limits and request cancellation

The Vercel function has a configured maximum duration of 60 seconds. The application gives work inside one request a 50-second budget so there is time to save an error result and send a response. Nested provider calls use the remaining time rather than starting a fresh 50-second timer. Cancellation signals help upstream HTTP requests stop when possible.

Vercel cannot be relied on to let an unawaited Node process keep working after it sends a response. For that reason, hosted analysis is run during the request and the response waits for the result. On a regular local Node server, analysis can run in the long-lived process. On Vercel, the analysis report's state is still saved in MongoDB, but there is no separate durable job queue worker.

If a queued or processing report is older than ten minutes, reconciliation marks it failed when the server starts, on the first successful serverless database connection, or when a new analysis is requested. Merely polling its status does not run reconciliation. This lets some stuck work be retried when a trigger occurs; it is not a scheduled job, queue, or promise that an interrupted analysis will resume by itself.

Two requests can race to start the same analysis. A partial unique index is intended to enforce one active report per profile submission. Application code handles the losing `E11000` create race and returns the report the other request is running. That guarantee depends on the index having been applied to the production database. The migration remains an explicit operator task; this study guide does not claim production index readiness.

**Follow it in code:** `backend/vercel.json`, `backend/src/utils/requestBudget.js`, `backend/api/index.js`, `backend/src/services/analysisService.js`, `backend/src/controllers/analyze.controller.js`, `backend/src/models/readinessReport.js`, `DEPLOYMENT.md`.

## 14. Resume storage and its boundary

The active storage implementation generates an unpredictable filename and writes the PDF into a private filesystem directory. Profile and application endpoints check which user is allowed to read a file. The local default directory is within backend storage. On Vercel, the default is `/tmp/vortex-storage`, which is temporary instance storage and can disappear. MongoDB's record of a filename does not make that file durable.

The source has a save/read/delete storage-provider interface so a future cloud storage implementation can fit behind it. No durable cloud provider is currently configured. Therefore, do not promise that a resume uploaded to the hosted product will remain available after an instance change or restart.

**Follow it in code:** `backend/src/services/storageService.js`, `backend/src/middleware/upload.middleware.js`, `backend/src/controllers/profile.controller.js`, `backend/src/controllers/application.controller.js`.

## 15. Security in plain language

Provider keys and the JWT signing secret belong in backend environment settings. Do not prefix them with `VITE_`: frontend `VITE_` variables are compiled into public JavaScript. A JWT is a signed login credential; anyone holding one may act as that user until it expires or the stored session is revoked. Never put a real token in a screenshot, issue, or chat.

The API checks request shapes with Zod, checks a bearer session on private routes, checks roles/ownership before private records and resumes, validates PDF files, bounds text and provider calls, uses CORS to restrict which browser origins can read cross-origin responses, and uses Helmet headers. CORS does not replace authentication: a non-browser script can call an API regardless of browser CORS enforcement, so the server still needs its own checks.

Production health returns `200` with `status` and `timestamp` to show the function responds. It deliberately does not prove MongoDB is available, AI providers work, login succeeds, or resume files persist. The release was checked at the public landing/login shell and safe API health/CORS routes; no production account credentials, resume, private profile, or AI quota were used.

**Follow it in code:** `backend/src/app.js`, `backend/api/index.js`, `backend/src/config/cors.js`, `backend/src/middleware/auth.middleware.js`, `backend/src/middleware/ownership.middleware.js`, `backend/src/middleware/upload.middleware.js`, `frontend/public/_headers`, `backend/src/config/env.js`.

## 16. How the two hosted sites work

The frontend URL is `https://vortex-6g7.pages.dev`. Cloudflare Pages serves the static files built by Vite. The backend URL is `https://vortex-api-eta.vercel.app/api`. Vercel calls `backend/api/index.js`, which prepares the serverless request, reuses a MongoDB connection while its instance remains warm, handles the health and preflight shortcuts, then passes ordinary requests through Express.

During local work, `npm run dev` starts a watch-mode Node API at port 5000 and Vite at port 5173. In production, the browser talks directly to the Vercel API URL. The production frontend Content Security Policy includes that allowed connection host. The Vercel API also allows the exact deployed Pages origin.

The production source revision was verified as `65db9f28bd4c1c8cecc8004d68441b6bf117d33e` on 2 October 2026. The frontend has build metadata at `/build-info.json`; the backend returns an `X-Vortex-Revision` header when the hosting environment supplies a commit. Vercel provider metadata and both live markers agreed. Cloudflare project `vortex` has no Git provider connected, so a Git push alone does not update its frontend. This release was uploaded to that existing Pages project. A deploy changes what visitors receive, so use the checks in `DEPLOYMENT.md` after future releases.

The Vercel team was confirmed on a free Hobby plan when this revision was checked. That does not determine billing or quota for existing Gemini, Groq, or database accounts. Local seed/setup actions can call Gemini too. Check those provider account limits before running live AI calls or seed commands against real services.

**Follow it in code:** `frontend/vite.config.js`, `frontend/public/_headers`, `backend/vercel.json`, `backend/api/index.js`, `DEPLOYMENT.md`, `docs/INTEGRATION_STATUS.md`.

## 17. How to run it locally

Install Node.js 22.12 or newer in the 22.x line, npm, and Docker Desktop or Docker Engine. Clone the repository, create the backend environment file from the example, install the locked dependencies, and start MongoDB:

```sh
git clone https://github.com/maayav/Job-Posting-Portal.git
cd Job-Posting-Portal
npm run setup
npm run install:all
docker compose up -d mongo
npm run dev
```

The setup command creates `backend/.env` only when it does not exist. It never overwrites a current file. Open that file locally and set `MONGO_URI` and `JWT_SECRET`. For profile analysis and other AI-enabled workflows, also configure `GROQ_API_KEY` and `GEMINI_API_KEY`. Keep this file private; Git ignores it. Then open the URL printed by Vite, usually `http://localhost:5173`.

The frontend can load its interface without logging in, but workspaces need accounts. Register a local student account from `/login`. To use administrator features in a local demo, create or promote an account with the backend's `create-admin.js` script. Use sample job/application seed scripts only in a disposable local database. The demo credentials in the repository are not production credentials.

`npm run seed` embeds role skills with Gemini and fully syncs the curated resource catalog, including removing database resource rows missing from its source. If you only want to refresh curated resource links, `npm --prefix backend run seed:resources` does not call AI and retains database-only custom links. Read `docs/SETUP.md` before any seeding operation; some scripts write or replace database records.

If the services report that ports 5000 or 5173 are busy, look at the terminal that started the existing process. Vite can select another available port and prints its URL. The API uses port 5000 by default. Never kill an unknown process just because the app cannot bind to that port.

## 18. How to learn this code safely

Make a few small changes on your local machine and trace each one through both sides of the app:

1. Open the jobs page component and find the API call it uses.
2. Follow that path into `frontend/src/api/client.js`. Identify the URL, HTTP method, query, body, and whether the client adds a bearer token.
3. Find the matching route in `backend/src/routes/`. Identify authentication, role checks, ownership checks, and rate limiters.
4. Follow the route to its controller. Find input validation and where the response status is chosen.
5. Follow any service/model call. Identify which data comes from MongoDB and which comes from a provider.
6. Find the frontend code that displays the response, empty state, or error. Ask what the user sees for a `401`, `409`, or `429` response.

Begin with reads or small layout-only changes. Never point test or seed commands at production MongoDB. Never use a real personal profile for analysis when checking wiring. Local tests generally mock AI services; the integration suite uses a uniquely named disposable database on a local MongoDB endpoint, but the code deliberately refuses remote/authenticated test targets. Provider drift tests are opt-in and may use real quota, so do not enable them by accident.

**Useful local commands:**

```sh
npm run lint
npm run build
npm --prefix backend run test:unit  # mocked backend tests; no MongoDB
npm --prefix frontend test
npm test                             # backend integration tests plus frontend; local MongoDB required
```

The exact setup and safety constraints are in `docs/SETUP.md`. API paths and examples are in `docs/API.md`. Data shapes are in `docs/SCHEMA.md`. Deployment commands and release verification are in `DEPLOYMENT.md`.

## 19. A glossary for common errors

| Code | Meaning for a person using or debugging Vortex |
|---:|---|
| 400 | The request is malformed or fails route validation. Inspect the response body for a field or input explanation. |
| 401 | No usable session was supplied. The browser clears its saved login and returns to login. |
| 403 | The request is authenticated, but the role or record owner is not allowed to perform it. |
| 404 | That route or requested record was not found. Check the URL and ID. |
| 409 | The request conflicts with current state: for example an active login, duplicate application, or missing prerequisite analysis. |
| 413 | The uploaded file or request body exceeds an allowed size. |
| 422 | The request was readable but a specific item such as extracted evidence could not be accepted or processed. |
| 429 | Too many requests in a time window, or a recent analysis cooldown. Wait for the interval given in the response. |
| 500 | An unexpected server error. Use bounded server logs and a safe reproduction; never log credentials or resume contents. |
| 503 | A required service/configuration is unavailable or the request exceeded its work budget. Health can still be green because it is only liveness. |

## 20. Questions to test your understanding

Try answering these in your own words before looking up the files.

Question 1: Why does `POST /api/analyze` need a token even if `ProtectedRoute` already hides the page?

Question 2: Which request counter is shared by everyone on one IP, and which counter belongs to one signed-in user?

Question 3: Why is the ten-per-minute analysis rate limit not the same as the sixty-second cooldown after a completed report?

Question 4: What information does a skill evidence excerpt add beyond a model saying “Python: high”?

Question 5: Why does Vortex call Gemini for vectors if the current matcher will not equate React and PyTorch?

Question 6: What does HTTP `200` from `/api/health` establish, and what does it leave unknown?

Question 7: Why can a job be applied to with a PDF even when no readiness report exists?

Question 8: Why can Vercel's `/tmp` storage not be described as permanent resume storage?

Question 9: What does a Git push update for the current application, and what does it not update automatically?

Question 10: If the frontend returns `401`, where in the code does the browser decide what to do next?

## Source map for continued reading

| If you want to understand | Start here |
|---|---|
| Browser bootstrap and routes | `frontend/src/main.jsx`, `frontend/src/App.jsx` |
| Login state and API headers | `frontend/src/context/AuthContext.jsx`, `frontend/src/api/client.js` |
| Shared API middleware and route mounts | `backend/src/app.js` |
| Request rate limits | `backend/src/middleware/rateLimit.middleware.js` |
| API endpoint details | `docs/API.md` |
| Model fields and references | `docs/SCHEMA.md`, `backend/src/models/` |
| Resume upload and analysis | `backend/src/routes/profile.routes.js`, `backend/src/services/analysisService.js` |
| Skill evidence and scoring | `backend/src/services/skillExtractionService.js`, `backend/src/services/scoringService.js` |
| Assistant context | `backend/src/controllers/assistant.controller.js` |
| Environment and local setup | `docs/SETUP.md`, `docs/DEVELOPMENT.md` |
| Production sites and safe release checks | `DEPLOYMENT.md`, `docs/INTEGRATION_STATUS.md` |

## Further reading

- [React's official learning guide](https://react.dev/learn)
- [HTTP explained by MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [Express middleware guide](https://expressjs.com/en/guide/using-middleware/)
- [Axios interceptors](https://axios-http.com/docs/interceptors)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Cloudflare Pages for React](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Mongoose guides](https://mongoosejs.com/docs/guide.html)

## Local verification of the profile additions (2 October 2026)

Read-only source checks returned five sampled repositories for `maayav` on GitHub and 12 solved problems for `Maayav` on LeetCode (11 Easy, 0 Medium, 1 Hard; Python). These values are a snapshot, not permanent facts. The supplied LinkedIn URL passed normalization; its profile contents were not fetched. These checks did not run a personal AI analysis or consume Groq/Gemini quota.

Demo application seeding now produces labelled fictional PDF resumes and source-backed review snapshots for up to 60 admin-owned roles. Seeds reject production mode and non-local database URLs. Each application has a resume copy so deleting a source profile does not remove its application attachment. Mock data tests do not prove that production storage or analysis works.

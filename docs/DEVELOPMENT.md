# Developer workflow

This is the current day-to-day guide for changing Vortex. For a first installation, follow [Setup](SETUP.md). For a guided explanation of the request lifecycle, rate limits, scoring, AI services, and deployment, read [the personal study guide](STUDY_GUIDE.md).

## Project map

- `frontend/src/` is the React and Vite browser application. Pages live in `pages/`; shared navigation, forms, dialogs, and guards live in `components/`; `api/client.js` is the shared Axios client.
- `backend/src/app.js` composes Express middleware and route mounts. Route files call controllers; controllers validate/translate HTTP requests; services contain reusable workflows; `models/` describe MongoDB records.
- `backend/api/index.js` is the Vercel function entry point. `backend/server.js` starts the local Node server.
- `backend/ontology/` defines role skills and weights. `backend/resources/` holds curated resource links. `scripts/build-role-catalog.mjs` creates the public landing-page catalog from repository data.
- `docs/API.md`, `docs/SCHEMA.md`, and `DEPLOYMENT.md` describe endpoints, data records, and release checks.

## Start a local development session

From the repository root, follow [Setup](SETUP.md) once to install dependencies, create `backend/.env`, and start MongoDB. Then run:

```sh
npm run dev
```

The root runner starts the API on port `5000` and Vite on `5173`. The Vite `/api` proxy forwards browser requests to the API. Use the URL Vite prints; if the default port is occupied, Vite may choose another one. Do not terminate an unfamiliar process just to free a port.

PowerShell supports the same workflow. If its execution policy blocks the npm shim, use `npm.cmd`, for example `npm.cmd run dev`. Stop the processes from the terminal that started them with Ctrl+C.

## Follow a feature through the code

For a browser workflow, begin with the page or component and find the API call it makes. Follow the request into `frontend/src/api/client.js`, then locate the matching route in `backend/src/routes/`. Read that route's middleware, controller, services, and model calls. Finally, follow the response back to the React component and identify its loading, success, and error states.

When changing an API, preserve the validation, authentication, role/ownership checks, and limits around the route. Keep provider keys and database credentials in backend environment variables; any `VITE_` variable is public after the frontend is built. Never use real personal resume/profile data to smoke-test an integration.

## Local checks

Run checks from the repository root:

```sh
npm run lint
npm run build
npm --prefix frontend test
npm --prefix backend run test:unit
```

The backend unit suite mocks external dependencies and does not require MongoDB. The full suite, `npm test`, also runs backend integration tests against a disposable database on a local loopback MongoDB server. The test harness refuses remote or authenticated database targets. Provider-drift checks are opt-in and can spend real API quota; do not enable them unless you intend that effect.

Before committing documentation or code, review the changed files and run:

```sh
git diff --check
git status --short
git diff --stat
```

Do not stage unrelated user files or generated local data. Keep credentials, `backend/.env`, local databases, logs, uploaded resumes, and build output out of commits.

## Seed data carefully

Seed scripts write to the database named by `backend/.env`; confirm it is a disposable local database first. `npm --prefix backend run seed` can call Gemini to create embeddings and fully synchronizes curated resources, including deleting resource rows absent from its seed input. `npm --prefix backend run seed:resources` refreshes curated links without an AI call and preserves database-only custom links. Demo job and application scripts create records and may create demo users. Read [Setup](SETUP.md#4-seed-the-local-role-catalog) before running a seed command.

## Release workflow

The current frontend is the Cloudflare Pages project `vortex`; the API is the Vercel project `vortex-api`. The Pages project is not connected to the Git repository, so a push alone does not publish frontend changes. Follow [Deployment](../DEPLOYMENT.md) for the established build/upload path and safe verification steps. Verify the source revision after an API deployment and the frontend build marker after a Pages upload. `/api/health` checks liveness only; it does not prove database readiness, authentication, AI integrations, or durable resume storage.

Do not upload real resumes, run signup/login, start analyses, modify production data, or spend provider quota as part of a release check unless the task explicitly calls for a controlled test and uses approved demo data.

## Older project notes

Some audit and implementation reports in `docs/` are historical snapshots. They preserve useful reasoning and decisions, but their paths, counts, and status claims may describe an older revision. Use this file and the linked current guides when working with the checked-out code.

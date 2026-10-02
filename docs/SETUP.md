# Set up Vortex on your computer

This guide starts Vortex locally on Windows, macOS, or Linux. It assumes you can open a terminal and edit a text file. Commands that can change the database are labelled so you can tell a local demo step from an ordinary start.

## Before you start

Install the following:

- Node.js **22.12 or newer in the 22.x line**, with npm. The backend package targets Node 22.x.
- Git, to clone the project.
- Docker Desktop (Windows/macOS) or Docker Engine (Linux), to run local MongoDB 7.
- A text editor, to fill in the backend settings.

The local API and MongoDB are required to use authenticated workspaces. The Groq and Gemini API keys are needed for AI analysis and related tasks. They are not needed just to serve the frontend or start most API routes. AI providers have their own usage limits and billing; a local setup does not make provider calls free.

## 1. Clone and install

Open a terminal and run these from the folder where you keep projects:

```sh
git clone https://github.com/maayav/Job-Posting-Portal.git
cd Job-Posting-Portal
npm run setup
npm run install:all
```

`npm run setup` copies `backend/.env.example` to `backend/.env` only when the target file is missing. It leaves an existing environment file unchanged. `npm run install:all` runs `npm ci` separately in `backend/` and `frontend/`, so both installs use their lockfiles.

### PowerShell

The same commands work from PowerShell. If the `npm` command is blocked by PowerShell's script policy, use `npm.cmd` in place of `npm`; you do not need to change the machine execution policy.

```powershell
git clone https://github.com/maayav/Job-Posting-Portal.git
Set-Location Job-Posting-Portal
npm.cmd run setup
npm.cmd run install:all
```

Install dependencies on the operating system where you will run them. Do not copy `node_modules` from Linux or macOS into a Windows checkout.

## 2. Add local backend settings

Open `backend/.env` in a text editor and set these values for a local database and AI-enabled features:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/placement_skill_gap
JWT_SECRET=replace-with-a-long-random-local-secret
NODE_ENV=development
PORT=5000
CLIENT_URL=
AI_TEXT_PROVIDER=groq
AI_EMBEDDING_PROVIDER=gemini
AI_TEXT_FALLBACK_PROVIDER=none
GROQ_API_KEY=your-private-groq-key
GEMINI_API_KEY=your-private-gemini-key
```

Generate a random development JWT secret with Node.js:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value into the local `.env` file. Use separate development keys and database settings instead of copying production credentials. Do not paste keys into the frontend `.env`, source code, screenshots, or Git. Anything prefixed `VITE_` can be included in downloaded browser JavaScript.

Optional settings include `GROQ_MODEL`, `GROQ_FALLBACK_MODELS`, `GEMINI_EMBEDDING_MODEL`, `EMBEDDING_VERSION`, `GITHUB_TOKEN`, and `RESUME_STORAGE_DIR`. The complete variable definitions and defaults are in [`backend/.env.example`](../backend/.env.example) and [`backend/src/config/env.js`](../backend/src/config/env.js). `CLIENT_URL` can stay empty for local development because the backend includes local Vite origins by default.

If `JWT_SECRET` or `MONGO_URI`/`MONGODB_URI` is missing, the backend will not start. Missing AI keys do not stop most of the API from starting, but AI-dependent requests and ontology embedding will return an error until a key is present.

## 3. Start MongoDB

Start Docker Desktop or Docker Engine. From the repository root:

```sh
docker compose up -d mongo
```

The database uses the URI above and the named Docker volume `mongo_data`. Stopping the service with `docker compose down` keeps that volume. `docker compose down -v` also removes the database volume and its local data; use that only when you intend to reset the local database.

Check that the container started with:

```sh
docker compose ps
```

## 4. Seed the local role catalog

**This step writes to whichever database `MONGO_URI` names. Confirm that `backend/.env` points to your local development database before running it.** For a new local database, seed role skills and curated resources:

```sh
npm --prefix backend run seed
```

This full seed uses Gemini to embed any missing ontology skills. It upserts current role records and fully syncs resource records, including deleting resource rows absent from the seed files. Provider quota may be consumed. Do not casually run this full-sync command against a shared or production database.

To refresh curated links without calling an AI provider, use:

```sh
npm --prefix backend run seed:resources
```

This updates the curated resources and leaves database-only custom additions intact, while setting specific replaced seed links to unverified. To check reachable link status, `npm --prefix backend run check:resources` makes HTTP requests to outside websites; a remote site may block those checks.

## 5. Start the app

From the repository root:

```sh
npm run dev
```

This starts the API in Node watch mode on port `5000` and Vite on port `5173`. Vite proxies `/api` requests to the API. Keep this terminal open and browse to <http://localhost:5173>. If Vite prints another port, use the URL it prints.

Stop the servers with **Ctrl+C** in the terminal that started them. If a port is occupied, first find the terminal or process that owns it. Do not kill an unknown process to free a port.

## 6. Create accounts for a local walkthrough

Use `/login` in the running app to register a student. Public registration only creates student accounts. To use admin pages, first choose an email address for a local admin account.

To promote an existing local account:

```sh
node backend/scripts/create-admin.js admin@example.com
```

To create an admin account, set its password in the current shell rather than as a command-line argument.

PowerShell:

```powershell
$env:ADMIN_PASSWORD = 'choose-a-local-demo-password'
node backend/scripts/create-admin.js admin@example.com --name "Placement Admin"
Remove-Item Env:ADMIN_PASSWORD
```

Bash or a similar shell:

```sh
read -rs ADMIN_PASSWORD
export ADMIN_PASSWORD
node backend/scripts/create-admin.js admin@example.com --name "Placement Admin"
unset ADMIN_PASSWORD
```

The seed commands below create demo records. Use them only with your local database. Do not enter demo names or passwords in a production environment.

```sh
node backend/scripts/seed-jobs.js --admin=admin@example.com
node backend/scripts/seed-applications.js --admin=admin@example.com
```

Both demo seeds enforce local database URLs and reject production mode. The application seed creates eight fictional students across up to 60 admin-owned roles, real labelled PDF resumes, review reports, and action plans. Rerunning updates snapshots without duplicating applications or resetting their status. It makes no AI calls, but changes the local database. The seeded demo password is defined by the script; it is for local-only testing. A single account has one active session. If you close the browser without logging out, a later login may return `409 already_logged_in`. Use the app's Log out button or, for a local disposable account, run `npm --prefix backend run release-session -- user@example.com`.

## 7. Run checks

From the repository root:

```sh
npm run lint
npm run build
npm --prefix frontend test
npm --prefix backend run test:unit
```

The backend unit suite uses mocks and does not need MongoDB. The full backend suite uses a uniquely named `vortex_test_<random>` database on an unauthenticated local loopback MongoDB service, then removes only that database. Remote and authenticated database URLs are refused by the test harness. From the root, `npm test` runs the backend full suite and frontend tests; local MongoDB must be running for the backend integration tests.

Provider calls are mocked in ordinary tests. Drift checks are an exception: they are opt-in and can contact a real provider, use quota, or change a local drift baseline. Do not enable them unless you intend that effect. Never point a test command at production data.

## Windows-specific notes

- Start Docker Desktop with Linux containers before running `docker compose up -d mongo`.
- Use `npm.cmd` if PowerShell blocks `npm.ps1`; no policy change is needed.
- Run `git`, `npm`, Docker, and the app from the same Windows checkout. Do not use Linux `node_modules` under Windows.
- Native Windows execution has not been verified in this Linux development environment. If a native dependency install fails, first use a supported Node.js 22.x version and a fresh `npm.cmd run install:all`; inspect the specific build error before installing additional compiler tools.

## Deployment notes

The current production frontend uses Cloudflare Pages and the API runs on Vercel. The backend's Vercel request handler is separate from the local `backend/server.js` process. Before deploying, read [`DEPLOYMENT.md`](../DEPLOYMENT.md) and use its existing project names and safe verification steps. The health endpoint checks liveness only. Resume files currently use temporary Vercel `/tmp` storage; no durable cloud storage provider has been configured.

For a guided explanation of how requests, authentication, MongoDB, scoring, rate limits, and deployment work together, see [How Vortex works from the ground up](STUDY_GUIDE.md).

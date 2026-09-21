# Vortex

Vortex is a placement and career-readiness workspace for students and campus placement teams. Students can explore jobs, understand their role readiness, and build a practical skill plan. Administrators can manage openings and review candidates in one place.

## What you can do

- **Explore opportunities:** search jobs by skills, experience, and city; apply with a chosen contact email and either your saved profile resume or a different PDF.
- **Track your progress:** the student dashboard shows your ATS score, how many jobs you have applied to, and a readiness trend graph.
- **Stay informed:** in-app notifications tell you when an administrator moves your application through the pipeline.
- **Understand your readiness:** upload a resume and optional GitHub/LeetCode profile; review extracted evidence, skill matches, gaps, and a prioritized study plan.
- **Get grounded AI help:** ask questions about your latest analysis and receive recommendations tied to its verified skills and gaps.
- **Review candidates:** see application totals, filter by role or candidate, inspect a candidate’s profile and evaluation, and move an application through review stages.
- **Manage the job board:** administrators can create, edit, and remove postings.
- **Choose your theme:** a persistent monochrome light/dark theme is available throughout the app.

## Technology

| Area | Stack |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Motion, Lenis, Recharts, Axios |
| Backend | Node.js ESM, Express 5, Mongoose 9, Zod |
| Data | MongoDB 7 |
| Authentication | JWT and bcrypt; public registration creates student accounts |
| AI | Groq for text generation; Gemini for skill embeddings |
| Tests | Vitest and Supertest |

## Quick start

### Prerequisites

- Node.js **22.12 or later** and npm
- Docker Desktop (Windows/macOS) or Docker Engine (Linux), for local MongoDB
- A Groq API key for resume extraction and the AI assistant
- A Google AI / Gemini API key for embedding the skill ontology during setup
- Optional: a GitHub token for higher GitHub API rate limits

### Install and configure

Run these commands from the repository root:

```sh
npm run setup
npm run install:all
docker compose up -d mongo
```

Open `backend/.env` and set at least `MONGO_URI`, a strong `JWT_SECRET`, `GROQ_API_KEY`, and `GEMINI_API_KEY`. `npm run setup` creates this file from `backend/.env.example` only when it does not already exist. Keep real keys in this ignored local file; never commit them.

Seed the skill ontology and start both services:

```sh
npm --prefix backend run seed
npm run dev
```

Open <http://localhost:5173>. The frontend proxies `/api` requests to the backend at `http://localhost:5000`.

The frontend uses port `5173` and the backend uses port `5000`. Both fail fast when the port is already taken, so stop any previous dev server or free the port first.

Create a student account from the app. Public registration cannot create administrators. To promote an existing account or create an administrator, use the backend CLI:

```sh
# Promote an existing account
node backend/scripts/create-admin.js admin@example.com

# Create an administrator after setting ADMIN_PASSWORD in your shell
node backend/scripts/create-admin.js admin@example.com --name "Placement Admin"
```

On PowerShell, set it for the current shell with `$env:ADMIN_PASSWORD = 'your-local-password'`; on Bash, use `export ADMIN_PASSWORD='your-local-password'`. Clear it after creating the account (`Remove-Item Env:ADMIN_PASSWORD` in PowerShell, `unset ADMIN_PASSWORD` in Bash).

### Demo data

For a local walkthrough, create an administrator first, then seed sample jobs and applications:

```sh
node backend/scripts/seed-jobs.js --admin=admin@example.com
node backend/scripts/seed-applications.js --admin=admin@example.com
```

The job seed is idempotent and includes a broad 26-role demo catalog across frontend, backend, Python, Java, .NET, Go, mobile, data, ML, cloud, QA, security, design, and delivery. Skills such as FastAPI, Flask, Django, React Native, GraphQL, Kubernetes, Playwright, Power BI, Apache Spark, OpenCV, and Terraform are available in the skills filter; add comma-separated skills to combine them.

Refresh curated learning resources independently of AI embeddings with `npm --prefix backend run seed:resources`. This covers every skill in the demo jobs and analysis ontology. Existing reports load the latest matching links while keeping their completion state. Run `npm --prefix backend run check:resources` to check external link availability; remote sites can occasionally block automated checks.

The landing page uses cream/charcoal glass surfaces, animated neutral light trails, and directional scroll reveals. Animations play by default; the header's play/pause icon pauses those page effects. The interactive product tour retains its own motion control.

On a fresh local database, the application seed creates demo students `demo.student1@vortex.dev` through `demo.student8@vortex.dev`, each with the development-only password `demo-pass-123`, plus sample reviews and applications. These accounts and this password are for a disposable local development database only. Never use them in production.

## Environment variables

The backend reads configuration from `backend/.env`. Important settings:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string; local default is `mongodb://127.0.0.1:27017/placement_skill_gap` |
| `JWT_SECRET` | Long, random secret used to sign sessions |
| `GROQ_API_KEY` | Groq text generation for extraction and assistant responses |
| `GROQ_MODEL` | Text model; defaults to `openai/gpt-oss-120b` |
| `GEMINI_API_KEY` | Gemini embedding requests for the skill ontology |
| `GEMINI_EMBEDDING_MODEL` | Embedding model; defaults to `gemini-embedding-2` |
| `GITHUB_TOKEN` | Optional token for GitHub profile collection |
| `PORT` | Backend port; defaults to `5000` |

The text and embedding providers are configured separately. Changing the embedding model requires re-seeding the ontology and updating its embedding-version baseline. See `backend/.env.example` for all supported settings.

## Useful commands

Run from the repository root:

| Command | Description |
|---|---|
| `npm run setup` | Create `backend/.env` from the example if missing |
| `npm run install:all` | Install backend and frontend dependencies |
| `npm run dev` | Start the API and Vite development servers |
| `npm test` | Run backend and frontend test suites (MongoDB must be available for backend tests) |
| `npm run lint` | Run the frontend linter |
| `npm run build` | Build the production frontend |

Stop a development server with **Ctrl+C** in the terminal that started it. The frontend uses a fixed port (`5173`, strict) so a second instance fails fast instead of hiding on another port — free the port or keep using the running server.

## Platform setup

The same four commands work everywhere; the differences are only in the shell and in how you free a busy port.

### Linux and macOS

```sh
npm run setup                 # creates backend/.env from the example if missing
npm run install:all           # installs backend + frontend dependencies
docker compose up -d mongo    # Docker Engine or Docker Desktop must be running
npm --prefix backend run seed # embeds the skill ontology, loads resources
npm run dev                   # API on :5000 and Vite on :5173
```

- MongoDB data lives in the named Docker volume `mongo_data`; `docker compose down` keeps it, `docker compose down -v` deletes it.
- Free a busy port when needed:
  ```sh
  lsof -ti tcp:5173 | xargs -r kill   # frontend
  lsof -ti tcp:5000 | xargs -r kill   # backend
  ```
- On Linux, `bcrypt` ships prebuilt binaries; if your distribution/Node combination has no prebuild, install build tools (`build-essential`, `python3`) and run `npm rebuild bcrypt`.

### Windows (PowerShell)

WSL is not required. Install Node.js 22.12+ (or nvm-windows), Git for Windows, and Docker Desktop with the WSL2 backend, then run the same commands from the repository root:

```powershell
npm run setup
npm run install:all
docker compose up -d mongo
npm --prefix backend run seed
npm run dev
```

- Start **Docker Desktop** before `docker compose up -d mongo`; keep it on Linux containers.
- If PowerShell blocks `npm.ps1` with an execution-policy error, call `npm.cmd` instead (no policy change needed).
- Set one-off environment variables for the current shell like this:
  ```powershell
  $env:ADMIN_PASSWORD = 'your-local-password'
  node backend/scripts/create-admin.js admin@example.com --name "Placement Admin"
  Remove-Item Env:ADMIN_PASSWORD
  ```
- Free a busy port:
  ```powershell
  Get-NetTCPConnection -LocalPort 5173 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
  Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
  ```
- Install dependencies on Windows itself — never copy `node_modules` from Linux or macOS. If `bcrypt` has no prebuilt binary for your Node version, install Visual Studio Build Tools with the **Desktop development with C++** workload and Python, then run `npm rebuild bcrypt`.
- Line endings are normalized by `.gitattributes`. If you cloned before it existed, run `git add --renormalize .` once.
- If `localhost` does not resolve to the API in your environment, use `127.0.0.1` in `MONGO_URI` and in the Vite proxy (`frontend/vite.config.js`).
- More Windows notes are in [`docs/SETUP.md`](docs/SETUP.md#7-windows-setup-notes).

## Repository layout

```text
backend/    Express API, MongoDB models, AI services, seed scripts, and tests
frontend/   React application, pages, components, and shared design system
docs/       Setup guide, API reference, schemas, and development notes
scripts/    Cross-platform root setup and development launchers
```

## Documentation

- [`docs/SETUP.md`](docs/SETUP.md) — detailed setup, environment, admin, and Windows notes
- [`docs/API.md`](docs/API.md) — endpoint reference
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — MongoDB models and indexes
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — implementation decisions and development history
- [`docs/JOB_PORTAL_INTEGRATION_AUDIT.md`](docs/JOB_PORTAL_INTEGRATION_AUDIT.md) — job portal integration notes

## Security notes

- Keep API keys and `JWT_SECRET` in `backend/.env`; it is excluded from Git.
- Resume files are validated, size-limited, and stored outside the web-served frontend.
- Resume text and password hashes are not returned by the API.
- Ownership and administrator access are enforced by backend routes.
- Demo credentials and generated records belong only in a local development database.

### Landing page and AI Engineer guide

The public landing page uses flat cream/charcoal surfaces and locally hosted Manrope. Anime.js handles one-time fades; Motion handles tab, chart, hover, and swipe interactions. The Kokonut UI tabs and Bklit horizontal bar primitive are adapted to this palette; their MIT notices are in `THIRD_PARTY_NOTICES.md`.

The interactive guide and its counts are generated from `backend/ontology/*.json` and `backend/resources/*.json`, not example scores or user records. `npm run dev` and the frontend build regenerate `frontend/src/data/role-catalog.json`. To regenerate it manually, run `node scripts/build-role-catalog.mjs` from the project root.

To add AI Engineer to an existing database without replacing other roles, run:

```sh
npm --prefix backend run seed:ai-engineer
```

This embeds any missing skills using the configured Gemini embedding provider, reuses compatible existing vectors, and upserts curated learning resources. Groq remains the text provider. For a clearly labeled sample AI Engineer posting, run `npm --prefix backend run seed:ai-engineer -- --with-demo-job` after creating an admin. Both commands also work in PowerShell. Fresh full ontology/job seeds include this role.

# Vortex

Vortex is a placement and career-readiness workspace for students and campus placement teams. Students can explore jobs, understand their role readiness, and build a practical skill plan. Administrators can manage openings and review candidates in one place.

## What you can do

- **Explore opportunities:** search jobs by skills, experience, and city; apply and track each application.
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

Open the URL printed by Vite, usually <http://localhost:5173>. If that port is occupied, Vite automatically selects the next available port. The frontend proxies `/api` requests to the backend at `http://localhost:5000`.

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

Stop a development server with **Ctrl+C** in the terminal that started it. If port 5173 is already serving Vortex, keep using that browser tab; starting another frontend will select the next free port.

## Windows setup

The app uses Node scripts and cross-platform npm commands; WSL is not required. Install Node.js 22.12+, Git for Windows, and Docker Desktop, then run the same Quick start commands from PowerShell. If PowerShell blocks `npm.ps1`, use `npm.cmd` in its place. Docker Desktop must be running before `docker compose up -d mongo`.

Install dependencies on the Windows machine itself; do not copy `node_modules` from Linux or macOS. If `bcrypt` needs to compile, install Visual Studio Build Tools with the C++ workload and Python, then run `npm rebuild bcrypt`. More Windows notes are in [`docs/SETUP.md`](docs/SETUP.md#7-windows-setup-notes).

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

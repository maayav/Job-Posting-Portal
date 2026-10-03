# Vortex

Vortex is a student career-readiness and campus placement workspace. Students search open roles, save and apply to jobs, and compare resume evidence with the skills listed for a target role. Placement administrators post jobs and review applications.

It is a JavaScript MERN application: React and Vite in the browser, Express and Node.js for the API, and MongoDB for stored data. Groq generates text; Gemini creates skill embeddings. AI analysis needs provider credentials. The basic authenticated app still needs a running API and MongoDB, but you can explore the public role guide without signing in.

## What is in the app

- **Role guide:** browse the bundled guides for 28 roles, with 149 role skills and 293 distinct curated resource URLs.
- **Job search:** search by skills, keywords, experience, or city. The ontology, synonyms, and local job examples go beyond MERN.
- **Resume analysis:** upload a PDF, choose a role, optionally add GitHub or LeetCode account names, and optionally provide LinkedIn text or import a profile PDF, and add user-provided HackerRank/Codeforces/CodeChef evidence. Vortex does not scrape LinkedIn.
- **Profile assessment:** separate source-by-source evidence scores, repository context, coding-practice totals, project ideas, curated practice links, and editable LinkedIn post drafts. Missing sources are not scored as zero.
- **Readiness report:** review extracted evidence, matched skills, gaps, and a learning plan built from curated resources. The score is a weighted indicator based on this project's matching rules, not a hiring probability or independent ATS score.
- **Student workspace:** save roles, track applications and notifications, and see analysis progress.
- **Placement workspace:** manage postings, inspect application snapshots, and update candidate status.
- **Admin assistant:** ask bounded questions about jobs and candidate applications in the workspace.
- **Light and dark themes:** a persistent cream and charcoal appearance across the product.

The role guide is bundled with the frontend. The authenticated catalog and workspace data come from the seeded database, so they can differ if a local database has not been seeded or its contents have changed.

## Architecture

```text
Browser: React pages and route navigation
  | local dev: Vite /api proxy
  | production: VITE_API_URL
  v
Express API: middleware -> route -> controller -> service
  | MongoDB through Mongoose
  | Groq for text generation
  | Gemini for skill embeddings
  | optional GitHub REST and LeetCode GraphQL sources
  | LinkedIn text only when the user supplies it
  v
Cloudflare Pages serves frontend files; Vercel runs the API function.
```

## Quick start

You need Node.js **22.12 or newer in the 22.x line**, npm, and a local MongoDB. The supplied Compose file runs MongoDB 7 in Docker. To use resume analysis, resource seeding, or the assistant, you also need valid Groq and Gemini API keys; providers may have independent quotas or billing.

From a terminal in the repository root:

```sh
npm run setup
npm run install:all
docker compose up -d mongo
```

Open `backend/.env` in a local editor. Set a strong `JWT_SECRET` and the MongoDB value shown in the example. Add `GROQ_API_KEY` and `GEMINI_API_KEY` for AI features. Keep provider keys in this backend file, never in frontend `VITE_` settings. `npm run setup` creates the file if it is missing and preserves an existing one.

Seed the clean local database, then start the API and Vite frontend:

```sh
npm --prefix backend run seed
npm run dev
```

Open the URL Vite prints, usually <http://localhost:5173>. The API listens on port 5000. The first full seed uses Gemini to embed ontology skills and fully syncs resource rows, so run it only against the intended local database. If you only want to refresh learning links, `npm --prefix backend run seed:resources` makes no AI calls and retains database-only resources.

Create a student through `/login`. To create an admin for a local demo, follow the safe instructions in [Setup](docs/SETUP.md). Demo accounts and sample application records are for a disposable local database only.

### Windows

PowerShell works without WSL. Install Node.js 22.12+, Git, and Docker Desktop with Linux containers. Use the same commands above; if PowerShell blocks `npm.ps1`, use `npm.cmd`. Install dependencies on Windows instead of copying `node_modules` from Linux or macOS. See the [full setup guide](docs/SETUP.md).

## Learn and work on the project

Read the [personal study guide](docs/STUDY_GUIDE.md) for a guided tour from browser requests through scoring, rate limits, and production deployment. Use [Setup](docs/SETUP.md) for local environment details and safe seed/test commands, [API reference](docs/API.md) for endpoint schemas, and [Schema guide](docs/SCHEMA.md) for database fields and relationships.

```sh
npm run lint
npm run build
npm --prefix backend run test:unit  # mocked backend tests; no MongoDB
npm --prefix frontend test
npm test                            # backend integration tests also need local MongoDB
```

The integration suite uses its own randomly named local test database and temporary resume directory. It refuses remote or authenticated MongoDB test targets. Provider calls are mocked by default; opt-in drift tests can use real provider quota.

## Production deployment

- Frontend: <https://vortex-6g7.pages.dev> (Cloudflare Pages project `vortex`)
- API: <https://vortex-api-eta.vercel.app/api> (Vercel project `vortex-api`)
- Health: <https://vortex-api-eta.vercel.app/api/health> (liveness only)
- Repository: <https://github.com/maayav/Job-Posting-Portal>

The existing Pages project has no Git provider connected, so a Git push alone does not publish the frontend; deploy its built assets to that project. The earlier audit release was verified as `65db9f28bd4c1c8cecc8004d68441b6bf117d33e` (2 October 2026). Its live frontend build marker and backend revision header matched provider deployment metadata. See [Profile release verification](docs/PROFILE_RELEASE_VERIFICATION.md) for the newer profile-assessment changes and their test/deployment coverage.

That release passed safe SPA-route, CSP, health, and CORS checks. Those checks did **not** submit production login, use private profiles, call AI providers, write to the production database, verify its indexes, or establish resume durability.

Real user uploads still use Vercel's ephemeral `/tmp` filesystem. Generated demo resumes now use MongoDB blobs with `db:` references. Authorized resume views can rebuild missing PDFs for explicitly seed-marked demo submissions, with separate profile and application copies so deleting a profile does not delete the application's PDF. Re-running the local-only demo seed also migrates readable filesystem copies to blobs. This storage behavior is covered by local integration tests; authenticated production resume views have not been verified.

See [Deployment](DEPLOYMENT.md), [Integration status](docs/INTEGRATION_STATUS.md), and [Baseline audit](docs/BASELINE_AUDIT.md) for exact evidence and limits. Do not describe an authenticated workflow as production-tested unless it has actually been tested with approved demo data.

## More documentation

- [Setup and local development](docs/SETUP.md)
- [Developer workflow](docs/DEVELOPMENT.md)
- [Personal ground-up study guide](docs/STUDY_GUIDE.md)
- [HTTP API reference](docs/API.md)
- [Data schema](docs/SCHEMA.md)
- [Deployment and safe verification](DEPLOYMENT.md)
- [Production integration status](docs/INTEGRATION_STATUS.md)
- [Project technical documentation](docs/PROJECT_TECHNICAL_DOCUMENTATION.md)

Older audit and implementation reports in `docs/` describe the repository at the time they were written. Use the setup, developer workflow, API, schema, deployment, and study guides above for current behavior.

# Deployment Guide

## AI-Assisted Job Posting Portal and Skill Gap Tracker

This guide explains how to deploy the full-stack MERN application using free-tier services:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB Atlas
- **Source control:** GitHub
- **Text AI:** Groq
- **Embeddings:** Gemini
- **Optional file storage:** Cloudinary or Supabase Storage

> Free-tier services have limitations such as sleeping servers, request limits, storage limits, and usage quotas. This setup is suitable for academic demonstrations, portfolio projects, and development environments.

## 1. Recommended architecture

```text
User browser
    |
    v
Vercel
React + Vite frontend
    |
    | HTTPS API requests
    v
Render
Node.js + Express backend
    |
    +--> MongoDB Atlas
    +--> Groq API
    +--> Gemini API
    +--> GitHub API
    +--> Optional file storage
```

## 2. Before deployment

Confirm that the project works locally:

```bash
git status
npm install
npm run build
```

Run the backend tests and frontend checks using the commands defined in the project `package.json` files.

Verify locally:

- Login works.
- Student and admin roles work.
- Job listing and filters work.
- Admin job CRUD works.
- Applications work.
- Admin application dashboard works.
- New Analysis works.
- ATS and role-readiness scores are generated.
- Study-plan generation works.
- AI Assistant works.
- Dark mode works.

## 3. MongoDB Atlas setup

1. Create a MongoDB Atlas account.
2. Create a free cluster.
3. Create a database user and password.
4. Configure network access.
5. Copy the MongoDB connection string.
6. Replace the password placeholder in the connection string.
7. Add it to Render as `MONGODB_URI` (the backend also accepts `MONGO_URI`; either name works).

Example:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
```

Do not commit the connection string to GitHub.

## 4. Backend preparation

The backend must listen on the hosting provider's port:

```js
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

Add a health-check route if one does not already exist:

```js
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});
```

The production backend must not depend on a local MongoDB server or local filesystem paths.

## 5. Backend environment variables

Create these environment variables in Render. Do not commit `.env` files or secret values.

```env
NODE_ENV=production
PORT=10000

# Either name works; MONGODB_URI matches the Atlas/Render docs.
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
# MONGODB_URI=...
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=7d

# Comma-separated list of allowed browser origins.
CLIENT_URL=https://your-frontend.vercel.app

# Groq — required for extraction, study plans and the assistant.
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODELS=openai/gpt-oss-20b,qwen/qwen3.8-27b
AI_TEXT_PROVIDER=groq

# Gemini — required for skill embeddings.
GEMINI_API_KEY=your_gemini_api_key
EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_VERSION=2026-09
AI_EMBEDDING_PROVIDER=gemini
AI_TEXT_FALLBACK_PROVIDER=none

GITHUB_TOKEN=optional_github_token

# Optional persistent resume storage (not wired up yet; see section 11).
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`MONGO_URI`/`MONGODB_URI` and `JWT_SECRET` are required at startup. Missing AI keys are
reported as startup warnings, and the related endpoints return
`503 ai_configuration_error` until the keys are configured. The project `.env.example`
files (`backend/.env.example`, `frontend/.env.example`) are the source of truth.

Use the actual variable names expected by the project code. If the project uses different names, update the deployment configuration to match the code.

### Security rules

- Never expose `GROQ_API_KEY` or `GEMINI_API_KEY` to the frontend.
- Never place secrets in `VITE_` variables.
- Never commit `.env`, `.env.local`, or production credentials.
- Use a strong random `JWT_SECRET`.
- Do not log resume contents, tokens, passwords, or API keys.

## 6. Deploy the backend to Render

1. Push the project to GitHub.
2. Open Render and create a new **Web Service**.
3. Connect the GitHub repository.
4. Select the backend directory if the backend is in a subfolder.
5. Configure the service.

Typical configuration:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Use the scripts from the backend `package.json` if they differ.

6. Add the backend environment variables.
7. Create the service.
8. Wait for the deployment to complete.
9. Copy the Render backend URL.

Example:

```text
https://your-project-api.onrender.com
```

Test the backend:

```text
https://your-project-api.onrender.com/api/health
```

Expected response (`200`, no authentication required):

```json
{
  "status": "ok",
  "timestamp": "2026-09-21T14:00:00.000Z"
}
```

### Render free-tier notes

- The backend may sleep after inactivity.
- The first request after sleeping may be slow.
- Do not treat a slow first request as an application failure.
- Use frontend loading states and reasonable API timeouts.
- Free services are suitable for demos, not guaranteed production workloads.

## 7. Configure backend CORS

The backend must allow the deployed Vercel frontend URL.

Example:

```js
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173"
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
```

Set this Render variable after deploying the frontend:

```env
CLIENT_URL=https://your-project.vercel.app
```

If the project uses cookies, configure secure production cookies correctly. If it uses JWT headers, confirm that the frontend sends:

```http
Authorization: Bearer <token>
```

## 8. Frontend API configuration

Do not hardcode a localhost backend URL in production.

Use a Vite environment variable:

```js
const API_URL = import.meta.env.VITE_API_URL;
```

The value should include the API path expected by the frontend:

```env
VITE_API_URL=https://your-project-api.onrender.com/api
```

Update the API client or Axios configuration to use this variable.

## 9. Deploy the frontend to Vercel

1. Open Vercel.
2. Import the GitHub repository.
3. Select the frontend directory if the frontend is in a subfolder.
4. Configure the build.

Typical configuration:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

5. Add this Vercel environment variable:

```env
VITE_API_URL=https://your-project-api.onrender.com/api
```

6. Deploy the frontend.
7. Copy the Vercel URL.
8. Add the Vercel URL to Render as `CLIENT_URL`.
9. Redeploy the backend if required.

## 10. Vercel SPA routing

This repository already includes `frontend/vercel.json`, so direct navigation to routes such as `/dashboard`, `/jobs`, or `/assistant` works. The file contains:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Redeploy the frontend after adding the file.

## 11. Resume upload and file storage

If the backend currently stores uploaded resumes on the local server filesystem, those files may disappear after a restart or redeployment.

For persistent storage, use one of the following:

- Cloudinary.
- Supabase Storage.
- Amazon S3-compatible storage.
- Another persistent object-storage service.

For a student project, Cloudinary or Supabase Storage is usually simpler than managing a storage server.

The backend should store the file URL and metadata in MongoDB rather than relying on a temporary local path.

## 12. AI provider configuration

Recommended configuration:

```env
AI_TEXT_PROVIDER=groq
AI_EMBEDDING_PROVIDER=gemini
```

Use Groq for:

- Structured skill extraction.
- Skill-gap explanations.
- Study-plan generation.
- Resource recommendations.
- AI Assistant responses.

Use Gemini for:

- Text embeddings.
- Semantic similarity.
- Existing vector-search functionality.

The backend must validate all structured AI responses before storing them. Do not trust model output merely because it appears to be JSON.

## 13. Optional seed data

If the project includes seed scripts, run them only against the intended development/demo database.

Example:

```bash
node scripts/create-admin.js
node scripts/seed-jobs.js
node scripts/seed-applications.js
```

Use the actual script paths in the repository.

Run idempotent seed scripts more than once and confirm that they do not create duplicate jobs or applications.

Never run development seed scripts against a production database unless they are explicitly designed for production use.

## 14. Deployment verification

### Backend

- `/api/health` returns success.
- MongoDB Atlas connection succeeds.
- Login works.
- JWT authentication works.
- Student/admin authorization works.
- Job listing works.
- Job filters work.
- Admin job CRUD works.
- Student application submission works.
- Duplicate applications are blocked.
- Admin application dashboard works.
- Candidate View button works.
- New Analysis works.
- ATS score is generated.
- Role-readiness score is generated.
- Study plan is generated.
- AI Assistant responds.
- Groq and Gemini API requests work.
- CORS allows only the intended frontend origin.

### Frontend

- The jobs page loads.
- Search and filters work.
- Student dashboard loads.
- Admin dashboard loads.
- Applications load correctly.
- Candidate details update when View is clicked.
- New Analysis page loads and submits successfully.
- AI Assistant page loads and responds.
- Dark mode works.
- Theme persists after refresh.
- Refreshing nested routes does not produce a 404.
- API errors are displayed clearly.
- Loading states work while the backend wakes up.

## 15. Common deployment problems

### CORS error

Check:

- `CLIENT_URL` matches the exact Vercel URL.
- The frontend uses the Render backend URL.
- The backend was redeployed after changing environment variables.
- Credentials settings match the authentication method.

### 404 on dashboard or assistant route

Add the Vercel SPA rewrite described above.

### `localhost` appears in production requests

Search the frontend for hardcoded URLs:

```bash
grep -R "localhost" frontend/src
```

Replace production API references with `import.meta.env.VITE_API_URL`.

### Backend crashes on Render

Check:

- Start command.
- Node version.
- Missing environment variables.
- MongoDB URI.
- `process.env.PORT` usage.
- Logs in Render.

### AI requests fail

Check:

- API keys exist in Render.
- Model names are valid.
- Provider environment variables are correct.
- Backend, not frontend, calls the AI APIs.
- Rate limits have not been exceeded.

### Resume upload fails

Check:

- Multipart form field name matches backend code.
- File size limits.
- File type validation.
- Persistent storage configuration.
- Render logs.

## 16. Final deployment checklist

- [ ] Code pushed to GitHub.
- [ ] Backend deployed on Render.
- [ ] Frontend deployed on Vercel.
- [ ] MongoDB Atlas configured.
- [ ] Backend environment variables configured.
- [ ] Frontend `VITE_API_URL` configured.
- [ ] CORS configured with the Vercel URL.
- [ ] Health endpoint tested.
- [ ] Login tested.
- [ ] Student flow tested.
- [ ] Admin flow tested.
- [ ] Applications tested.
- [ ] Candidate details tested.
- [ ] New Analysis tested.
- [ ] AI Assistant tested.
- [ ] Groq tested.
- [ ] Gemini embeddings tested.
- [ ] Resume storage tested.
- [ ] Dark mode tested.
- [ ] Nested routes tested after refresh.
- [ ] No secrets committed to GitHub.
- [ ] No production API calls use localhost.
- [ ] Final backend tests pass.
- [ ] Final frontend lint passes.
- [ ] Final frontend build passes.

## 17. Production URLs

Fill these after deployment:

```text
Frontend URL: https://____________________________
Backend URL: https://_____________________________
Health URL:   https://_____________________________/api/health
Repository:   https://github.com/__________________
```


## 18. Project-specific reference

### Exact repository layout used by the hosting providers

```text
Root directory:  backend/     -> Render Web Service
Root directory:  frontend/    -> Vercel project
```

Render (backend):

```text
Root Directory: backend
Build Command:  npm install
Start Command:  npm start        (node server.js)
```

Vercel (frontend):

```text
Root Directory: frontend
Framework:      Vite
Build Command:  npm run build
Output:         dist
Env:            VITE_API_URL=https://<render-service>.onrender.com/api
```

The backend binds to `0.0.0.0` and uses `process.env.PORT`, so Render's injected
port is honoured. `frontend/vercel.json` rewrites every path to `index.html` for
client-side routing.

### Health check

```text
GET https://<render-service>.onrender.com/api/health
-> 200 { "status": "ok", "timestamp": "<ISO-8601 UTC>" }
```

### Database notes

- Connection string variable: `MONGO_URI` or `MONGODB_URI`.
- Database name: whatever you put in the connection string
  (local development uses `placement_skill_gap`; the test suite uses
  `placement_skill_gap_test`).
- Indexes: Mongoose `autoIndex` builds the schema indexes (unique email,
  unique `{applicant, job}`, `{user, job}` wishlist, report/ontology indexes) the
  first time the API connects. No manual migration is required.
- Seed manually against the intended database only, from `backend/`:

```bash
node scripts/create-admin.js admin@example.com
npm run seed                     # ontology + resource catalog (embeddings)
node scripts/seed-jobs.js --admin=admin@example.com
node scripts/seed-applications.js --admin=admin@example.com
```

All seed scripts are idempotent and safe to re-run.

### Resume storage

Resumes are written to `backend/storage/` on the Render filesystem
(`storageService.js`). Render's free tier has an ephemeral filesystem: uploaded
resumes disappear after a restart or redeploy, and downloads of older resumes
then return `404 resume_missing`. Database records, scores and applications are
unaffected. Cloudinary/Supabase integration is documented as an optional
follow-up and is not wired up in this build.

### Verification performed before handoff

| Check | Command | Result |
|---|---|---|
| Backend tests | `npm --prefix backend test` | 145 passed, 2 skipped |
| Frontend tests | `npm --prefix frontend test` | 38 passed |
| Frontend lint | `npm --prefix frontend run lint` | 0 errors |
| Frontend build | `npm --prefix frontend run build` | success (`dist/`) |
| Health route | `GET /api/health` | 200, no auth |
| CORS | allowed origin reflects `Access-Control-Allow-Origin`; unknown origins are not reflected | covered by tests |

### Free-tier limitations

- Render free web services sleep after inactivity; the first request can take up
  to a minute. Frontend loading states and retries cover this.
- Atlas free clusters have limited storage and connections.
- Groq and Gemini free tiers have request/token quotas; embeddings are batched to
  reduce request counts.
- Vercel hobby projects have bandwidth/build limits.
- Ephemeral backend storage means resume files are not durable (see above).

## 19. Serverless backend on Vercel (no-card option)

Render free instances require payment verification for some accounts and Hugging Face
now requires a PRO subscription for Docker Spaces. Vercel Hobby (free, no card) can
host the same Express API as a Node.js serverless function.

Repository changes that make this work:

- `backend/api/index.js` — exports the existing Express app as the function handler.
- `backend/vercel.json` — rewrites every path to `/api/index` and sets `maxDuration: 60`.
- `backend/src/services/storageService.js` — uses `/tmp/vortex-storage` when the
  `VERCEL` environment variable is present (the project filesystem is read-only there).
- `backend/src/controllers/analyze.controller.js` — waits for the analysis inside the
  request on Vercel because serverless functions freeze after responding.
- `backend/src/middleware/upload.middleware.js` — 4 MB resume cap on Vercel (the
  platform rejects request bodies above ~4.5 MB) and the usual 5 MB elsewhere.

Vercel backend project configuration:

```text
Root Directory: backend
Framework: Other
Build Command: (default)
Output Directory: (default)
Env: NODE_ENV=production, MONGODB_URI, JWT_SECRET, CLIENT_URL,
     GROQ_API_KEY, GROQ_MODEL, GROQ_FALLBACK_MODELS,
     GEMINI_API_KEY, EMBEDDING_MODEL, EMBEDDING_VERSION,
     AI_TEXT_PROVIDER=groq, AI_EMBEDDING_PROVIDER=gemini, AI_TEXT_FALLBACK_PROVIDER=none
```

Serverless limitations to expect:

- Resume files live in `/tmp` per instance: they disappear on cold starts and are not
  shared between instances, so resume downloads can return `404 resume_missing`.
  Scores, jobs and applications in MongoDB are unaffected.
- The AI analysis must finish within the function's 60-second limit; free-tier Groq
  and Gemini latency plus retries can occasionally exceed it.
- Cold starts add a few seconds to the first request.

Hugging Face Spaces (Docker) is no longer a free option: creating a Docker Space on
`cpu-basic` returns HTTP 402 requiring PRO.

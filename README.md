# AI-Assisted Placement & Skill-Gap Tracker

Students upload a resume (+ GitHub profile) → AI extracts skills with evidence → skills are matched against a role's skill ontology via embedding similarity → a deterministic Role-Readiness Score and prioritized study plan are produced → re-uploads over time track progress.

Built from the spec in `EXECUTION_PLAN.md`.

## Stack

- Backend: Node.js + Express (ESM), MongoDB via Mongoose, JWT auth
- AI: Google Gemini (`gemini-3.5-flash` extraction, `gemini-embedding-2` embeddings)
- Frontend: React (Vite) + Recharts

## Quick start

See `docs/SETUP.md` (written in Phase 8).

## Project layout

```
backend/   Express API, models, services, ontology + resource seed data, resume storage
frontend/  React app
docs/      API, setup, schema docs
```
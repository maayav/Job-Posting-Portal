# Job Portal Integration Audit Request

## Purpose

This document instructs an AI coding agent to inspect the **existing repository** before integrating a new Job Posting Portal module.

The Job Posting Portal must become part of the existing project. It must **not** be built as a separate standalone project or repository. The agent must first create an accurate report of the current project state, architecture, reusable components, conflicts, and required decisions.

## Important Constraints

- Do **not** create a new repository.
- Do **not** run `git init`.
- Do **not** overwrite existing files.
- Do **not** install dependencies.
- Do **not** change source code, environment configuration, Docker configuration, or database schemas.
- Do **not** create commits or push to GitHub.
- Do **not** start implementing the Job Posting Portal yet.
- Inspect and report only.
- Never reveal secret values from `.env` files, tokens, passwords, connection strings, or credentials. Report environment variable names only.

## Proposed Module

The module that will later be integrated is a **Job Posting Portal** using the existing project’s MERN architecture wherever possible.

### Roles

- `seeker` — Job Seeker.
- `admin` — can manage job postings.

### Job seeker functionality

1. Register.
2. Log in.
3. Search jobs by skills, experience, or city.
4. View matching jobs.

### Admin functionality

1. Add a new job posting.
2. Edit an existing job posting.
3. Delete a job posting.

### Expected Job model

```text
title: String
skills: [String]
experienceLevel: Number (years)
city: String
description: String
createdBy: ObjectId (User reference)
createdAt, updatedAt: timestamps
```

### Expected API endpoints

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/jobs
POST   /api/jobs              admin only
PUT    /api/jobs/:id          admin only
DELETE /api/jobs/:id          admin only
```

### Required behavior

- JWT authentication.
- bcrypt password hashing.
- Zod validation for client-controlled input.
- Rate limiting on auth routes.
- Backend-enforced RBAC.
- A seeker token must receive `403 Forbidden` on job creation, update, and deletion routes.
- Job search filters: skills, experience, city.
- React pages: registration, login, job search, admin job management.
- Tests: auth flow, role enforcement, and search/filter behavior.
- The combined application must use the existing MongoDB, Express, React, and Node.js architecture. Do not introduce another backend framework, frontend framework, database, or authentication provider.

## Inspection Tasks

Perform the following audit before proposing any implementation changes.

### 1. Repository summary

Identify:

- Project root.
- Repository name.
- Whether Git is initialized.
- Current Git branch and whether the working tree has uncommitted changes.
- Primary architecture: separate `backend` and `frontend`, monorepo, or another layout.
- Overall current project purpose and completed implementation state.

### 2. Repository tree

Produce a relevant repository tree. Exclude:

```text
node_modules
.git
dist
build
coverage
.env
```

Include source directories, config files, package files, Docker files, documentation, tests, and CI files.

### 3. Package and runtime audit

Read every `package.json` and report:

- Package manager in use.
- Available scripts.
- Relevant dependencies and devDependencies.
- Node.js version requirement, if specified.
- Existing test and lint tooling.
- Existing Docker-related tooling.

Do not change package files.

### 4. Backend audit

Identify the exact locations and current behavior of:

- Backend entry point.
- Express application setup.
- API base path and route mounting.
- Route files.
- Controllers.
- Services.
- Models.
- Middleware.
- Validation schemas.
- Database connection.
- Error handling.
- Existing health endpoint.
- Configured backend port.

Also identify whether the existing backend already uses:

- Mongoose/MongoDB.
- JWT.
- bcrypt.
- Zod or another validation library.
- `express-rate-limit`.
- Helmet.
- CORS.
- Role-based authorization.

### 5. Frontend audit

Identify the exact locations and current behavior of:

- Frontend entry point.
- React Router setup.
- Existing pages.
- Existing components.
- API client / Axios configuration.
- Authentication context, store, or state management.
- JWT storage approach.
- Protected-route components.
- Current styling approach.
- Configured frontend port.

### 6. Authentication and roles audit

Inspect the existing user/auth implementation and report:

- Exact User schema fields.
- Password hashing approach.
- JWT payload shape.
- Token expiry behavior.
- Registration flow.
- Login flow.
- Existing roles, if any.
- Existing authorization middleware.
- Frontend role handling.
- Whether public registration can currently assign privileged roles.

Determine how the new Job Seeker/Admin requirements should map to the existing role system without breaking existing functionality.

### 7. Database and model audit

Report:

- Existing MongoDB database connection strategy.
- Existing Mongoose models and collections.
- Whether a Job, Vacancy, Posting, Opportunity, or similar model already exists.
- Exact schema of any related existing model.
- Existing indexes, reference relationships, and cascade/delete behavior relevant to users or jobs.
- Whether the project uses seed scripts or migrations.

### 8. Routes and API conflict audit

Identify possible conflicts with:

```text
/api/auth/*
/api/jobs/*
/api/health
/api/admin/*
```

For every relevant existing endpoint, report its current method, path, authorization rule, request format, and response format when discoverable.

### 9. Environment and Docker audit

Inspect environment and infrastructure configuration without exposing values.

Report:

- Environment variable names only.
- Existing `.env.example` files.
- MongoDB strategy: Docker local, Atlas, or another method.
- Dockerfile(s), Docker Compose file(s), and services.
- Existing port assignments.
- CORS origins.
- Conflicts or missing configuration needed for integration.

### 10. Tests, CI, and documentation audit

Report:

- Test framework and test command.
- Existing test files and conventions.
- Test database strategy.
- Mocking strategy for external services, if applicable.
- CI configuration.
- Existing API, setup, schema, and architecture documentation.
- Existing coding conventions that should be preserved.

### 11. Security audit

Identify integration-relevant security gaps, including:

- Missing authentication checks.
- Missing ownership checks.
- Role bypass risks.
- Client-controlled privileged fields.
- Missing validation.
- Missing rate limiting.
- Unsafe CORS configuration.
- Sensitive data exposed in API responses.
- Hard-coded secrets or accidentally committed environment files.

Do not fix these yet. Report them clearly.

## Required Recommendation

After inspecting the repository, propose—but do not implement—a safe integration plan.

### Backend recommendation

State the exact existing files to modify and exact new files to create for:

- Job model.
- Job validation schemas.
- Job controllers/services.
- Job routes.
- Auth/role changes, if needed.
- Authorization middleware changes, if needed.
- Tests.
- Seed scripts or controlled admin-account creation, if needed.

### Frontend recommendation

State the exact existing files to modify and exact new files to create for:

- Login/registration behavior.
- Job search page.
- Job filter controls.
- Job result cards/list.
- Admin job-management page.
- Create/edit form.
- Protected routes.
- Navigation changes.
- API client wrappers.

### Role mapping recommendation

Explicitly answer:

1. Should the existing role system be extended, renamed, or mapped?
2. Should the existing student/user role behave as `seeker` for the job portal?
3. Can existing admins manage job postings?
4. How should an initial admin account be created safely?
5. What existing behavior could break if roles are changed?

### API recommendation

State the final recommended endpoint paths after considering existing route conflicts. Preserve existing APIs wherever possible. If a conflict exists, recommend a compatible namespace or migration approach.

### Search recommendation

Propose the exact v1 search semantics:

- `skills`: comma-separated list, all-skills matching or any-skills matching.
- `experience`: exact interpretation.
- `city`: case-insensitive matching behavior.
- Pagination parameter names, defaults, maximum limit, and response shape.
- Sorting order.

### Safe implementation order

Provide an ordered, non-breaking implementation sequence. It must preserve all already working features and should follow this general dependency order:

1. Reconcile architecture and role model.
2. Extend/refactor authentication only if necessary.
3. Add Job model and backend admin CRUD.
4. Add validated job search.
5. Add backend tests.
6. Add frontend seeker pages.
7. Add frontend admin pages.
8. Perform integration testing, documentation, and Git commits.

## Required Output File

Create this report only:

```text
docs/JOB_PORTAL_INTEGRATION_AUDIT.md
```

Use the following exact structure.

```markdown
# Job Portal Integration Audit

## 1. Repository Summary
- Repository name:
- Project root:
- Git initialized:
- Current branch:
- Working-tree state:
- Primary stack:
- Package manager:
- Current application purpose:
- Current implementation status:

## 2. Repository Tree
```text
[Relevant repository tree]
```

## 3. Package and Runtime Setup
- Root package configuration:
- Backend package configuration:
- Frontend package configuration:
- Scripts:
- Dependencies relevant to integration:
- Test tooling:
- Node version:

## 4. Existing Backend
- Entry point:
- Express app:
- API base path:
- Routes:
- Controllers/services:
- Models:
- Middleware:
- Validation:
- Database connection:
- Error handling:
- Health endpoint:
- Port:
- Reusable code:

## 5. Existing Frontend
- Entry point:
- Router:
- Pages:
- Components:
- API client:
- Auth state:
- Token storage:
- Protected routes:
- Styling:
- Port:
- Reusable code:

## 6. Authentication and Roles
- Current User schema:
- Password hashing:
- JWT payload and expiry:
- Registration behavior:
- Login behavior:
- Current roles:
- Current authorization middleware:
- Frontend role behavior:
- Privilege-escalation risks:
- Recommended seeker/admin mapping:

## 7. Database, Docker, and Environment
- MongoDB strategy:
- Mongoose models:
- Existing job-like model:
- Docker configuration:
- Environment variable names only:
- Ports:
- CORS:
- Seed/migration strategy:

## 8. Existing Tests, CI, and Documentation
- Test framework and command:
- Existing tests:
- Test database strategy:
- CI configuration:
- Documentation:
- Conventions to preserve:

## 9. Compatibility Review
- Route conflicts:
- Schema conflicts:
- Authentication/role conflicts:
- Dependency conflicts:
- Frontend route conflicts:
- Data migration concerns:
- Security concerns:
- Existing components/services to reuse:

## 10. Proposed Integration Plan

### Backend changes
[Exact files to create or modify, with purpose]

### Frontend changes
[Exact files to create or modify, with purpose]

### Database changes
[Job model, indexes, relationships, seed/admin setup]

### API design
[Final non-conflicting endpoint design and compatibility notes]

### Search behavior
[Exact query parameters, semantics, pagination, sorting, and response shape]

### Role mapping
[Exact mapping and safe admin creation path]

### Safe implementation order
1. ...
2. ...

## 11. Risks and Decisions Needed
| Risk or decision | Impact | Recommended resolution |
|---|---|---|
| | | |

## 12. Questions for the Project Owner
[List only questions that cannot be answered by inspecting the repository.]
```

## Completion Rules

Before finishing:

1. Verify that `docs/JOB_PORTAL_INTEGRATION_AUDIT.md` exists.
2. Do not modify any other project file.
3. Print the complete contents of the report.
4. Print a concise list titled **“Top 10 facts needed before integration”**.
5. Explicitly state that no application code, package dependency, configuration, Git state, or database data was changed.

# Vortex frontend

This folder contains the Vortex React and Vite browser app. It is JavaScript/JSX. Vite builds the static frontend that Cloudflare Pages serves.

## Local development

Install all project dependencies from the repository root with `npm run install:all`, start local MongoDB and the backend, then open a second terminal at the repository root and run:

```sh
npm run dev
```

The workspace script starts Vite on port 5173 and proxies `/api` to `http://localhost:5000`. For frontend-only development you can also run `npm run dev` from this directory after installing dependencies; the backend still needs to be running for API screens. Vite may choose a different port if 5173 is busy and prints the URL to use.

## Build and checks

Run these from the repository root:

```sh
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

The build runs `scripts/build-role-catalog.mjs` first. It regenerates the public landing-page role guide from backend ontology/resource seed files, then emits static files and `build-info.json`. Production builds set `VITE_API_URL` to the API origin ending in `/api`; that value is public in browser code. Never put provider keys or server secrets in `VITE_` variables.

## Where to look

- `src/App.jsx`: client routes and lazy page imports.
- `src/pages/`: landing page, login, jobs, dashboard, analysis, assistant, and application screens.
- `src/components/`: reusable page components and access guard.
- `src/api/client.js`: Axios client, bearer-token attachment, and unauthorized-response handling.
- `src/context/`: login state, theme, and landing motion settings.
- `src/index.css`: application-wide styling and theme variables.
- `public/_headers`: static-site security headers and Content Security Policy.
- `vite.config.js`: development proxy and source-revision build marker.

The project-specific [setup guide](../docs/SETUP.md) explains environment, database, and safe local demo data. The [study guide](../docs/STUDY_GUIDE.md) traces a browser request through the React client and backend API.

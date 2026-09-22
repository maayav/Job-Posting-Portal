import { env } from './env.js';

// Browser origins allowed to call the API: the deployed frontend (CLIENT_URL,
// comma-separated) plus the local Vite dev server. Requests without an Origin
// header (health checks, server-to-server) are allowed.
export const allowedOrigins = [
  ...env.CLIENT_URL.split(','),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export function isAllowedOrigin(origin) {
  return Boolean(origin) && allowedOrigins.includes(origin.replace(/\/$/, ''));
}

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
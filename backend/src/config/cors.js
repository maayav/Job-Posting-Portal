import { env } from './env.js';

const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

// In production, only explicitly configured browser origins are trusted. Local
// Vite origins are convenient for development and tests but should not be
// silently accepted by a deployed API.
export function buildAllowedOrigins(clientUrl = env.CLIENT_URL, nodeEnv = env.NODE_ENV) {
  const configured = String(clientUrl ?? '').split(',');
  const local = nodeEnv === 'production' ? [] : LOCAL_ORIGINS;
  return [...configured, ...local]
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const allowedOrigins = buildAllowedOrigins();

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

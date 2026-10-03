import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const standard = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

// Keep the JSON body actionable: clients show the wait time instead of reading
// the Retry-After header themselves.
function rateLimited(req, res, next, options) {
  const reset = req.rateLimit?.resetTime;
  const retryAfterSeconds = reset instanceof Date
    ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000))
    : Math.max(1, Math.ceil((options?.windowMs ?? 60000) / 1000));
  res.status(options?.statusCode ?? 429).json({ ...(options?.message ?? {}), retryAfterSeconds });
}

const testLimit = env.NODE_ENV === 'test' ? 100000 : undefined;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: testLimit ?? 50,
  message: { error: 'rate_limited', message: 'Too many attempts, please try again later.' },
  ...standard,
  handler: rateLimited,
});

export const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testLimit ?? 10,
  keyGenerator: (req) => req.user.id,
  message: { error: 'rate_limited', message: 'Too many analysis requests, please slow down.' },
  ...standard,
  handler: rateLimited,
});

export const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testLimit ?? 20,
  keyGenerator: (req) => req.user.id,
  message: { error: 'rate_limited', message: 'Too many assistant requests, please slow down.' },
  ...standard,
  handler: rateLimited,
});

export const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: testLimit ?? 5,
  keyGenerator: (req) => req.user.id,
  message: { error: 'rate_limited', message: 'Too many profile extraction requests, please try again later.' },
  ...standard,
  handler: rateLimited,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testLimit ?? 120,
  message: { error: 'rate_limited', message: 'Too many requests, please try again later.' },
  ...standard,
  handler: rateLimited,
});

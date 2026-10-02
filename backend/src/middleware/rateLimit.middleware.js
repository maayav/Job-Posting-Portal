import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const standard = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

const testLimit = env.NODE_ENV === 'test' ? 100000 : undefined;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: testLimit ?? 50,
  message: { error: 'rate_limited', message: 'Too many attempts, please try again later.' },
  ...standard,
});

export const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testLimit ?? 10,
  keyGenerator: (req) => req.user.id,
  message: { error: 'rate_limited', message: 'Too many analysis requests, please slow down.' },
  ...standard,
});

export const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testLimit ?? 20,
  keyGenerator: (req) => req.user.id,
  message: { error: 'rate_limited', message: 'Too many assistant requests, please slow down.' },
  ...standard,
});

export const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: testLimit ?? 5,
  keyGenerator: (req) => req.user.id,
  message: { error: 'rate_limited', message: 'Too many profile extraction requests, please try again later.' },
  ...standard,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testLimit ?? 120,
  message: { error: 'rate_limited', message: 'Too many requests, please try again later.' },
  ...standard,
});

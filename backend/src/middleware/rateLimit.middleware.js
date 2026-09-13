import rateLimit from 'express-rate-limit';

const standard = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  message: { error: 'rate_limited', message: 'Too many attempts, please try again later.' },
  ...standard,
});

export const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: { error: 'rate_limited', message: 'Too many analysis requests, please slow down.' },
  ...standard,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  message: { error: 'rate_limited', message: 'Too many requests, please try again later.' },
  ...standard,
});
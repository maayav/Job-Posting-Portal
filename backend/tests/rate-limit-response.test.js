import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeLimiter,
  apiLimiter,
  assistantLimiter,
  authLimiter,
  profileLimiter,
} from '../src/middleware/rateLimit.middleware.js';

// Exercise response construction without hitting a live API or exhausting a
// real store. Production configuration keeps the intended limits observable.
vi.mock('express-rate-limit', () => ({ default: vi.fn((options) => options) }));
vi.mock('../src/config/env.js', () => ({ env: { NODE_ENV: 'production' } }));

const limiters = [
  ['auth', authLimiter, 50, 900000],
  ['analysis', analyzeLimiter, 10, 60000],
  ['assistant', assistantLimiter, 20, 60000],
  ['profile', profileLimiter, 5, 900000],
  ['API', apiLimiter, 120, 60000],
];

function responseFor(req, options = analyzeLimiter) {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  analyzeLimiter.handler(req, response, next, options);
  expect(next).not.toHaveBeenCalled();
  return response;
}

afterEach(() => vi.restoreAllMocks());

describe('Rate-limit retry responses', () => {
  it.each(limiters)('wires the %s limiter without changing its window or quota', (name, limiter, limit, windowMs) => {
    expect(limiter).toMatchObject({
      handler: expect.any(Function),
      limit,
      windowMs,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    limiter.handler({}, response, vi.fn(), limiter);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({ ...limiter.message, retryAfterSeconds: windowMs / 1000 });
  });

  it.each([
    [1501, 2],
    [1000, 1],
    [1, 1],
    [0, 1],
    [-1000, 1],
  ])('rounds a reset %i ms away up to %i seconds, with a one-second minimum', (remainingMs, expected) => {
    vi.spyOn(Date, 'now').mockReturnValue(100000);
    const response = responseFor({ rateLimit: { resetTime: new Date(100000 + remainingMs) } });
    expect(response.json).toHaveBeenCalledWith({ ...analyzeLimiter.message, retryAfterSeconds: expected });
  });

  it('uses the current request reset time rather than the full configured window', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100000);
    const response = responseFor({ rateLimit: { resetTime: new Date(112000) } }, profileLimiter);
    expect(response.json).toHaveBeenCalledWith({ ...profileLimiter.message, retryAfterSeconds: 12 });
  });

  it.each([undefined, { resetTime: 'not-a-Date' }])('falls back to the configured window if no Date is supplied', (rateLimit) => {
    const response = responseFor({ rateLimit }, { windowMs: 1501, message: { error: 'rate_limited', message: 'Try later.' } });
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({ error: 'rate_limited', message: 'Try later.', retryAfterSeconds: 2 });
  });

  it('preserves a custom status and additional message fields', () => {
    const response = responseFor({}, { windowMs: 0, statusCode: 503, message: { error: 'busy', message: 'Try later.', scope: 'demo' } });
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ error: 'busy', message: 'Try later.', scope: 'demo', retryAfterSeconds: 1 });
  });

  it('defaults to a minute when options are absent', () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    analyzeLimiter.handler({}, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({ retryAfterSeconds: 60 });
  });

  it('keeps user-scoped limits keyed to the authenticated user', () => {
    for (const limiter of [analyzeLimiter, assistantLimiter, profileLimiter]) {
      expect(limiter.keyGenerator({ user: { id: 'demo-user' }, ip: '127.0.0.1' })).toBe('demo-user');
    }
    expect(authLimiter.keyGenerator).toBeUndefined();
    expect(apiLimiter.keyGenerator).toBeUndefined();
  });
});

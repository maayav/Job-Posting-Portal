import { AppError } from '../utils/errors.js';
import { assertRequestBudget, waitWithinRequestBudget } from './requestBudget.js';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAYS = [1000, 2000, 4000];

export function isTransientError(err) {
  if (err instanceof AppError) return false;
  const status = err.response?.status;
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return true;
  if (!err.response && err.message) return true;
  return false;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withTransientRetry(fn, { label = 'call', attempts = DEFAULT_ATTEMPTS, delays = DEFAULT_DELAYS } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      assertRequestBudget();
      return await fn();
    } catch (err) {
      assertRequestBudget();
      lastError = err;
      if (attempt < attempts && isTransientError(err)) {
        console.error(JSON.stringify({ event: 'upstream_retry', label, attempt, code: err.code || 'upstream_error', status: err.response?.status }));
        await waitWithinRequestBudget(delays[attempt - 1], sleep);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export function makeUnavailableError(label) {
  return new AppError(`${label} service unavailable`, 503, 'service_unavailable');
}

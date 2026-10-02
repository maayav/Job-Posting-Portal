import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from './errors.js';

const requestBudgets = new AsyncLocalStorage();

export function getRequestBudget() {
  return requestBudgets.getStore();
}

function timeoutError() {
  return new AppError('This request took too long. Please retry.', 503, 'request_timeout');
}

export function assertRequestBudget(minimumMs = 1) {
  const budget = getRequestBudget();
  if (budget && (budget.signal.aborted || budget.deadline - Date.now() < minimumMs)) {
    throw timeoutError();
  }
}

export function requestTimeout(defaultMs) {
  assertRequestBudget();
  const budget = getRequestBudget();
  return budget ? Math.max(1, Math.min(defaultMs, budget.deadline - Date.now())) : defaultMs;
}

export function requestSignal() {
  assertRequestBudget();
  return getRequestBudget()?.signal;
}

// Callers can stop waiting even when a dependency does not accept AbortSignal.
// Completion writes must still be conditional, since that work may settle later.
export async function withinRequestBudget(fn) {
  assertRequestBudget();
  const budget = getRequestBudget();
  if (!budget) return fn();
  let abort;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => { assertRequestBudget(); return fn(); }),
      new Promise((resolve, reject) => {
        abort = () => reject(timeoutError());
        budget.signal.addEventListener('abort', abort, { once: true });
        if (budget.signal.aborted) abort();
      }),
    ]);
    assertRequestBudget();
    return result;
  } finally {
    budget.signal.removeEventListener('abort', abort);
  }
}

export async function waitWithinRequestBudget(ms, wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay))) {
  assertRequestBudget(ms + 1);
  await withinRequestBudget(() => wait(ms));
  assertRequestBudget();
}

// The function cap is 60s. Stop upstream work at 50s so failure persistence and
// the HTTP response have time to complete. Nested callers share the same clock.
export async function withRequestBudget(fn, { timeoutMs = 50000 } = {}) {
  if (getRequestBudget()) return fn();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await requestBudgets.run({ deadline: Date.now() + timeoutMs, signal: controller.signal }, fn);
  } finally {
    clearTimeout(timer);
  }
}

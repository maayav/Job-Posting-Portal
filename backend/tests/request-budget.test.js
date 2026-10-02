import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { createTextProvider } from '../src/services/ai/providerClient.js';
import { embedSkillsBatch } from '../src/services/embeddingService.js';
import { withTransientRetry } from '../src/utils/retry.js';
import { assertRequestBudget, getRequestBudget, requestTimeout, withinRequestBudget, withRequestBudget } from '../src/utils/requestBudget.js';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../src/config/env.js', () => ({ env: { GEMINI_API_KEY: 'mock-key', EMBEDDING_MODEL: 'mock-embedding' } }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Serverless request budget', () => {
  it('leaves long-lived provider timeouts unchanged and caps a nested request to the original clock', async () => {
    expect(requestTimeout(60000)).toBe(60000);
    await withRequestBudget(async () => {
      const parent = getRequestBudget();
      expect(requestTimeout(60000)).toBeLessThanOrEqual(50000);
      await withRequestBudget(async () => expect(getRequestBudget()).toBe(parent), { timeoutMs: 100000 });
    });
    expect(getRequestBudget()).toBeUndefined();
  });

  it('stops waiting on uncooperative work at the deadline', async () => {
    vi.useFakeTimers();
    const result = withRequestBudget(() => withinRequestBudget(() => new Promise(() => {})), { timeoutMs: 100 });
    const expectation = expect(result).rejects.toMatchObject({ statusCode: 503, code: 'request_timeout' });
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
  });

  it('passes one shared abort signal and remaining timeout to the text provider', async () => {
    const client = { post: vi.fn().mockResolvedValue({ data: { choices: [{ message: { content: 'Ready' } }] } }) };
    const provider = createTextProvider({ provider: 'groq', apiKey: 'test', model: 'test-model', client });
    await withRequestBudget(async () => {
      expect((await provider.generateText({ systemPrompt: 'Test', userPrompt: 'Demo' })).text).toBe('Ready');
      const config = client.post.mock.lastCall[2];
      expect(config.timeout).toBeLessThanOrEqual(1000);
      expect(config.signal).toBe(getRequestBudget().signal);
    }, { timeoutMs: 1000 });
  });

  it('cancels provider work without trying a fallback model after deadline expiry', async () => {
    vi.useFakeTimers();
    const client = { post: vi.fn((url, body, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject({ code: 'ERR_CANCELED' }), { once: true });
    })) };
    const provider = createTextProvider({ provider: 'groq', apiKey: 'test', model: 'first', fallbackModels: ['second'], client });
    const result = withRequestBudget(() => provider.generateText({ systemPrompt: 'Test', userPrompt: 'Demo' }), { timeoutMs: 100 });
    const expectation = expect(result).rejects.toMatchObject({ code: 'request_timeout' });
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('does not spend remaining time sleeping for a retry that cannot fit', async () => {
    const retry = vi.fn().mockRejectedValue({ response: { status: 429 } });
    await expect(withRequestBudget(() => withTransientRetry(retry, { delays: [2000] }), { timeoutMs: 1000 }))
      .rejects.toMatchObject({ code: 'request_timeout' });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('caps Gemini batch timeout, preserves vectors and shares cancellation', async () => {
    axios.post.mockResolvedValueOnce({ data: { embeddings: [{ values: [3, 4] }] } });
    await withRequestBudget(async () => {
      expect(await embedSkillsBatch(['Python'])).toEqual([[0.6, 0.8]]);
      const config = axios.post.mock.lastCall[2];
      expect(config.timeout).toBeLessThanOrEqual(500);
      expect(config.signal).toBe(getRequestBudget().signal);
    }, { timeoutMs: 500 });
  });

  it('rejects subsequent stages even when a late timer has not fired', async () => {
    vi.useFakeTimers();
    await withRequestBudget(async () => {
      vi.setSystemTime(Date.now() + 1000);
      expect(() => assertRequestBudget()).toThrow('too long');
    }, { timeoutMs: 100 });
  });
});

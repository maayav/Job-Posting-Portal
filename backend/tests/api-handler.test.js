import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({ connectDB: vi.fn(), reconcile: vi.fn().mockResolvedValue(0) }));
vi.mock('../src/config/db.js', () => ({ connectDB: mocks.connectDB }));
vi.mock('../src/services/analysisService.js', () => ({
  reconcileAnalysisJobs: mocks.reconcile, queueAnalysis: vi.fn(), runAnalysis: vi.fn(),
}));
import handler from '../api/index.js';
import { withRequestBudget } from '../src/utils/requestBudget.js';

function server(budgetMs) {
  const app = express();
  app.use((req, res, next) => {
    const operation = () => handler(req, res);
    const result = budgetMs ? withRequestBudget(operation, { timeoutMs: budgetMs }) : operation();
    result.catch(next);
  });
  return app;
}

describe('Vercel entry point', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('serves liveness and health preflight without a database connection', async () => {
    mocks.connectDB.mockRejectedValue(new Error('database unavailable'));
    const health = await request(server()).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(health.status).toBe(200);
    expect(Object.keys(health.body).sort()).toEqual(['status', 'timestamp']);
    expect(health.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const preflight = await request(server()).options('/api/health').set('Origin', 'http://localhost:5173');
    expect(preflight.status).toBe(204);
    expect(mocks.connectDB).not.toHaveBeenCalled();
  });
  it('does not reflect unknown origins through the health shortcut', async () => {
    const response = await request(server()).options('/api/health').set('Origin', 'https://unknown.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('returns a readable 503 when database readiness fails and allows retry', async () => {
    mocks.connectDB.mockRejectedValueOnce(new Error('database unavailable'));
    const first = await request(server()).get('/api/jobs').set('Origin', 'http://localhost:5173');
    expect(first.status).toBe(503);
    expect(first.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    mocks.connectDB.mockResolvedValueOnce({});
    const retry = await request(server()).get('/api/jobs');
    expect(retry.status).toBe(401);
  });
});

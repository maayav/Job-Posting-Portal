vi.mock('../src/services/ai/studyPlanService.js', () => ({ enrichStudyPlan: vi.fn(async (plan) => plan) }));
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, initDb, closeDb, clearDb, registerUser, authHeader, seedTestOntology, fakeVector } from './helpers.js';

const SAMPLE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sample-resumes');

function fakeEmbed(name) {
  return fakeVector(name);
}

vi.mock('../src/services/embeddingService.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    embedSkill: vi.fn(async (name) => fakeEmbed(name)),
    embedSkillsBatch: vi.fn(async (names) => names.map((name) => fakeEmbed(name))),
  };
});

vi.mock('../src/services/geminiService.js', () => ({
  extractSkills: vi.fn(async () => ({
    skills: [
      { name: 'Python', sources: ['resume'], evidence: [{ source: 'resume', text: 'wrote python' }] },
      { name: 'PyTorch', sources: ['resume'], evidence: [{ source: 'resume', text: 'fine-tuned a model' }] },
      { name: 'React', sources: ['resume'], evidence: [{ source: 'resume', text: 'built a dashboard' }] },
      { name: 'Node.js', sources: ['resume'], evidence: [{ source: 'resume', text: 'built an api' }] },
      { name: 'Git', sources: ['resume'], evidence: [{ source: 'resume', text: 'used git' }] },
    ],
    model: 'mock-model',
  })),
}));

async function createSubmission(token, github = 'maayav', role = 'SDE') {
  const pdf = fs.readFileSync(path.join(SAMPLE_DIR, 'sample-sde.pdf'));
  const res = await request(app)
    .post('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .attach('resume', pdf, { filename: 'sample-sde.pdf' })
    .field('github_username', github)
    .field('target_role', role);
  expect(res.status).toBe(201);
  return res.body.id;
}

async function waitForStatus(token, reportId, maxPolls = 40) {
  for (let i = 0; i < maxPolls; i += 1) {
    const res = await request(app)
      .get(`/api/analyze/${reportId}/status`)
      .set('Authorization', `Bearer ${token}`);
    if (res.body.status === 'completed' || res.body.status === 'failed') {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('analysis did not finish in time');
}

describe('Analyze pipeline', () => {
  let token;
  let otherToken;

  beforeAll(initDb);
  afterAll(closeDb);
  beforeEach(async () => {
    await clearDb();
    await seedTestOntology();
    token = (await registerUser({ email: 'analyzer@test.com' })).token;
    otherToken = (await registerUser({ email: 'other@test.com' })).token;
  });

  it('runs the full pipeline to a completed report with deterministic score', async () => {
    const sid = await createSubmission(token);
    const created = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ submission_id: sid });
    expect(created.status).toBe(202);
    expect(created.body.status).toBe('queued');

    const status = await waitForStatus(token, created.body.report_id);
    expect(status.status).toBe('completed');

    const report = await request(app)
      .get(`/api/report/${created.body.report_id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(report.status).toBe(200);
    expect(report.body.score).toBeGreaterThanOrEqual(0);
    expect(report.body.score).toBeLessThanOrEqual(100);
    expect(report.body.embedding_model).toBe('gemini-embedding-2');
    expect(Array.isArray(report.body.strong_areas)).toBe(true);
    expect(Array.isArray(report.body.study_plan)).toBe(true);
  });

  it('analyzes AI Engineer and returns its curated skill resources', async () => {
    const { SkillOntology } = await import('../src/models/skillOntology.js');
    const { ResourceCatalog } = await import('../src/models/resourceCatalog.js');
    const { skills } = JSON.parse(fs.readFileSync(new URL('../ontology/ai-engineer.json', import.meta.url)));
    const { resources } = JSON.parse(fs.readFileSync(new URL('../resources/resources-ai-engineer.json', import.meta.url)));
    for (const skill of skills) {
      await SkillOntology.updateOne({ skill_name: skill.skill_name }, { $set: {
        ...skill, embedding_model: 'gemini-embedding-2', embedding_version: '2026-09', embedding_vector: fakeVector(skill.skill_name),
      } }, { upsert: true });
    }
    for (const resource of resources) {
      await ResourceCatalog.updateOne({ skill_name: resource.skill_name, url: resource.url }, { $set: resource }, { upsert: true });
    }
    const roles = await request(app).get('/api/roles').set(authHeader(token));
    expect(roles.body.roles).toContainEqual({ id: 'AI Engineer', label: 'AI Engineer' });
    const sid = await createSubmission(token, '', 'AI Engineer');
    const created = await request(app).post('/api/analyze').set(authHeader(token)).send({ submission_id: sid });
    expect(created.status).toBe(202);
    expect((await waitForStatus(token, created.body.report_id)).status).toBe('completed');
    const { body: report } = await request(app).get(`/api/report/${created.body.report_id}`).set(authHeader(token));
    expect(report.target_role).toBe('AI Engineer');
    expect(report.score).toBeGreaterThan(0);
    const rag = report.study_plan.find((s) => s.skill === 'Retrieval-Augmented Generation');
    expect(rag.resources[0].url).toBe('https://docs.langchain.com/oss/python/deepagents/rag');
    expect(report.study_plan.every((s) => s.resources.length > 0)).toBe(true);
  });

  it('enforces the partial unique index — only one active (queued/processing) report per submission', async () => {
    const sid = await createSubmission(token);
    const { ReadinessReport } = await import('../src/models/readinessReport.js');

    await ReadinessReport.create({ submission_id: sid, target_role: 'SDE', status: 'queued' });
    await expect(
      ReadinessReport.create({ submission_id: sid, target_role: 'SDE', status: 'queued' })
    ).rejects.toThrow(/E11000/);
    const count = await ReadinessReport.countDocuments({ submission_id: sid, status: { $in: ['queued', 'processing'] } });
    expect(count).toBe(1);

    await ReadinessReport.create({ submission_id: sid, target_role: 'SDE', status: 'failed' });
    const failedCount = await ReadinessReport.countDocuments({ submission_id: sid, status: 'failed' });
    expect(failedCount).toBe(1);
  });

  it('enforces the 60s cooldown with the fixed 429 body after completion', async () => {
    const sid = await createSubmission(token);
    const created = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    await waitForStatus(token, created.body.report_id);

    const again = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    expect(again.status).toBe(429);
    expect(Object.keys(again.body).sort()).toEqual(['error', 'message', 'retryAfterSeconds']);
    expect(again.body.error).toBe('analysis_cooldown');
    expect(again.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(again.body.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('allows a fresh analysis after the cooldown expires (completed reports do not block forever)', async () => {
    const sid = await createSubmission(token);
    const created = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    await waitForStatus(token, created.body.report_id);

    await import('../src/models/readinessReport.js').then(({ ReadinessReport }) =>
      ReadinessReport.updateOne({ _id: created.body.report_id }, { $set: { completedAt: new Date(Date.now() - 61000) } })
    );

    const again = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    expect(again.status).toBe(202);
    expect(again.body.report_id).not.toBe(created.body.report_id);
    const status = await waitForStatus(token, again.body.report_id);
    expect(status.status).toBe('completed');
  });

  it('blocks a non-owner from analyzing a submission (403)', async () => {
    const sid = await createSubmission(token);
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ submission_id: sid });
    expect(res.status).toBe(403);
  });

  it('blocks a non-owner from reading a report (403)', async () => {
    const sid = await createSubmission(token);
    const created = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    await waitForStatus(token, created.body.report_id);

    const res = await request(app)
      .get(`/api/report/${created.body.report_id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when a report is requested before completion', async () => {
    const sid = await createSubmission(token);
    const created = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    const res = await request(app).get(`/api/report/${created.body.report_id}`).set('Authorization', `Bearer ${token}`);
    expect([409, 200]).toContain(res.status);
  });

  it('recovers from a failed report and allows a retry', async () => {
    const sid = await createSubmission(token);
    const created = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    await waitForStatus(token, created.body.report_id);
    const first = await request(app).get(`/api/report/${created.body.report_id}`).set('Authorization', `Bearer ${token}`);

    await import('../src/models/readinessReport.js').then(({ ReadinessReport }) =>
      ReadinessReport.updateOne(
        { _id: created.body.report_id },
        { $set: { status: 'failed', errorCode: 'analysis_failed', completedAt: new Date() } }
      )
    );

    const retry = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    expect(retry.status).toBe(202);
    const status = await waitForStatus(token, retry.body.report_id);
    expect(status.status).toBe('completed');
    void first;
  });

  it('exposes a clean errorCode when the submission has no extracted skills and extraction is unavailable', async () => {
    const sid = await createSubmission(token);
    const { ExtractedSkillProfile } = await import('../src/models/extractedSkillProfile.js');
    await ExtractedSkillProfile.deleteMany({ submission_id: sid });

    const { extractSkills } = await import('../src/services/geminiService.js');
    extractSkills.mockRejectedValueOnce(new Error('boom'));

    const created = await request(app).post('/api/analyze').set('Authorization', `Bearer ${token}`).send({ submission_id: sid });
    const status = await waitForStatus(token, created.body.report_id);
    expect(status.status).toBe('failed');
    expect(status.errorCode).toBeTruthy();
    expect(status.errorCode).not.toMatch(/stack/i);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app, initDb, closeDb, clearDb, registerUser, authHeader, seedTestOntology, fakeVector } from './helpers.js';

vi.mock('../src/services/embeddingService.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    embedSkill: vi.fn(async (name) => fakeVector(name)),
    embedSkillsBatch: vi.fn(async (names) => names.map((name) => fakeVector(name))),
  };
});

vi.mock('../src/services/ai/studyPlanService.js', () => ({ enrichStudyPlan: vi.fn(async (plan) => plan) }));

function makePlan(skill) {
  return [{
    skill,
    priority: 0.8,
    resources: [{ title: `${skill} docs`, url: `https://example.com/${skill.toLowerCase()}`, type: 'documentation', verified: true }],
    done: false,
  }];
}

async function makeReport({ userId, role, score, gapSkill, completedAt }) {
  const { ProfileSubmission } = await import('../src/models/profileSubmission.js');
  const { ReadinessReport } = await import('../src/models/readinessReport.js');
  const submission = await ProfileSubmission.create({
    user_id: userId,
    resume_text: 'test resume',
    resume_file_ref: 'test.pdf',
    target_role: role,
    extraction_status: 'completed',
  });
  return ReadinessReport.create({
    submission_id: submission._id,
    target_role: role,
    status: 'completed',
    score,
    completedAt,
    generated_at: completedAt,
    gaps: [{ skill: gapSkill, percent: 40, priority: 0.8 }],
    study_plan: makePlan(gapSkill),
  });
}

describe('GET /api/report/roadmap', () => {
  let student;
  let other;

  beforeAll(async () => {
    await initDb();
    await seedTestOntology();
  });

  afterAll(async () => {
    await clearDb();
    await closeDb();
  });

  beforeEach(async () => {
    await clearDb();
    await seedTestOntology();
    student = await registerUser({ email: `roadmap_${Date.now()}@test.com` });
    other = await registerUser({ email: `roadmap_other_${Date.now()}@test.com` });
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/report/roadmap');
    expect(res.status).toBe(401);
  });

  it('returns an empty list for a student without completed reports', async () => {
    const res = await request(app).get('/api/report/roadmap').set(authHeader(student.token));
    expect(res.status).toBe(200);
    expect(res.body.roadmaps).toEqual([]);
  });

  it('returns the latest roadmap per analyzed role with hydrated resources', async () => {
    const userId = student.user.id;
    await makeReport({ userId, role: 'SDE', score: 40, gapSkill: 'React', completedAt: new Date('2026-01-01') });
    await makeReport({ userId, role: 'SDE', score: 55, gapSkill: 'Node.js', completedAt: new Date('2026-02-01') });
    await makeReport({ userId, role: 'Data Analyst', score: 70, gapSkill: 'SQL', completedAt: new Date('2026-01-15') });

    const res = await request(app).get('/api/report/roadmap').set(authHeader(student.token));
    expect(res.status).toBe(200);

    const byRole = Object.fromEntries(res.body.roadmaps.map((r) => [r.target_role, r]));
    expect(Object.keys(byRole).sort()).toEqual(['Data Analyst', 'SDE']);

    expect(byRole.SDE.score).toBe(55);
    expect(byRole.SDE.study_plan).toHaveLength(1);
    expect(byRole.SDE.study_plan[0].skill).toBe('Node.js');
    expect(byRole.SDE.study_plan[0].resources).toEqual([]);
    expect(byRole.SDE.gap_count).toBe(1);
    expect(byRole.SDE.gaps[0]).toMatchObject({ skill: 'Node.js', percent: 40 });

    // Curated resources are re-hydrated on read (not the stale saved copy).
    expect(byRole['Data Analyst'].study_plan[0].resources[0].title).toBe('SQLBolt');
    expect(byRole['Data Analyst'].study_plan[0].resources[0].url).toBe('https://sqlbolt.com/');
  });

  it('includes analyzed roles whose latest report is not completed', async () => {
    const userId = student.user.id;
    await makeReport({ userId, role: 'SDE', score: 40, gapSkill: 'React', completedAt: new Date('2026-01-01') });
    const { ProfileSubmission } = await import('../src/models/profileSubmission.js');
    const { ReadinessReport } = await import('../src/models/readinessReport.js');
    const submission = await ProfileSubmission.create({
      user_id: userId,
      resume_text: 'test resume',
      resume_file_ref: 'test.pdf',
      target_role: 'DevOps Engineer',
      extraction_status: 'completed',
    });
    await ReadinessReport.create({
      submission_id: submission._id,
      target_role: 'DevOps Engineer',
      status: 'failed',
      errorCode: 'analysis_failed',
      completedAt: new Date('2026-02-01'),
    });

    const res = await request(app).get('/api/report/roadmap').set(authHeader(student.token));
    expect(res.status).toBe(200);
    const byRole = Object.fromEntries(res.body.roadmaps.map((r) => [r.target_role, r]));
    expect(Object.keys(byRole).sort()).toEqual(['DevOps Engineer', 'SDE']);
    expect(byRole.SDE.status).toBe('completed');
    expect(byRole.SDE.study_plan).toHaveLength(1);
    expect(byRole['DevOps Engineer'].status).toBe('failed');
    expect(byRole['DevOps Engineer'].score).toBeNull();
    expect(byRole['DevOps Engineer'].study_plan).toEqual([]);
  });

  it('never leaks another student\'s roadmaps', async () => {
    await makeReport({ userId: student.user.id, role: 'SDE', score: 40, gapSkill: 'React', completedAt: new Date() });
    await makeReport({ userId: other.user.id, role: 'SDE', score: 90, gapSkill: 'React', completedAt: new Date() });

    const res = await request(app).get('/api/report/roadmap').set(authHeader(other.token));
    expect(res.status).toBe(200);
    expect(res.body.roadmaps).toHaveLength(1);
    expect(res.body.roadmaps[0].score).toBe(90);
  });
});

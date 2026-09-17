import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app, initDb, closeDb, clearDb, registerUser, loginUser, authHeader, makeAdmin,
} from './helpers.js';

function jobBody(overrides = {}) {
  return {
    title: 'MERN Stack Developer',
    company: 'Acme Corp',
    skills: ['React', 'Node.js', 'MongoDB'],
    experienceLevel: 1,
    city: 'Chennai',
    description: 'Build full-stack features.',
    ...overrides,
  };
}

describe('Job applications', () => {
  let studentToken;
  let studentId;
  let otherStudentToken;
  let otherStudentId;
  let adminToken;
  let jobId;
  let secondJobId;

  beforeAll(initDb);
  afterAll(closeDb);

  beforeEach(async () => {
    await clearDb();

    await registerUser({ email: 'applicant@test.com', name: 'Applicant One' });
    const applicant = await loginUser('applicant@test.com');
    studentToken = applicant.token;
    studentId = applicant.user.id;

    await registerUser({ email: 'other@test.com', name: 'Applicant Two' });
    const other = await loginUser('other@test.com');
    otherStudentToken = other.token;
    otherStudentId = other.user.id;

    await registerUser({ email: 'admin@test.com', name: 'Portal Admin' });
    await makeAdmin('admin@test.com');
    adminToken = (await loginUser('admin@test.com')).token;

    const first = await request(app).post('/api/jobs').set(authHeader(adminToken)).send(jobBody());
    jobId = first.body.job.id;
    const second = await request(app)
      .post('/api/jobs')
      .set(authHeader(adminToken))
      .send(jobBody({ title: 'Backend Developer', company: 'Beta Ltd' }));
    secondJobId = second.body.job.id;
  });

  async function applyAs(token, job = jobId, body = {}) {
    return request(app).post('/api/applications').set(authHeader(token)).send({ jobId: job, ...body });
  }

  describe('student application flow', () => {
    it('lets a student apply successfully with populated job details', async () => {
      const res = await applyAs(studentToken, jobId, { coverLetter: 'I would love to join.' });
      expect(res.status).toBe(201);
      expect(res.body.application.status).toBe('applied');
      expect(res.body.application.job).toMatchObject({
        id: jobId,
        title: 'MERN Stack Developer',
        company: 'Acme Corp',
        city: 'Chennai',
        experienceLevel: 1,
      });
      expect(res.body.application.statusHistory).toHaveLength(1);
      expect(res.body.application.statusHistory[0].status).toBe('applied');
    });

    it('returns 409 when the same student applies twice', async () => {
      await applyAs(studentToken, jobId);
      const res = await applyAs(studentToken, jobId);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_applied');
    });

    it('derives the applicant from the JWT and ignores a client-supplied applicant', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set(authHeader(studentToken))
        .send({ jobId, applicant: otherStudentId });
      expect(res.status).toBe(400); // strict schema rejects unknown fields
      const ok = await applyAs(studentToken, jobId);
      expect(ok.status).toBe(201);
      expect(ok.body.application.applicant.id).toBe(studentId);
    });

    it('rejects unauthenticated applications', async () => {
      const res = await request(app).post('/api/applications').send({ jobId });
      expect(res.status).toBe(401);
    });

    it('returns 404 for a missing job and 400 for an invalid job id', async () => {
      const missing = await applyAs(studentToken, '000000000000000000000000');
      expect(missing.status).toBe(404);
      const invalid = await applyAs(studentToken, 'not-an-id');
      expect(invalid.status).toBe(400);
    });

    it('does not let an admin apply (student-only endpoint)', async () => {
      const res = await applyAs(adminToken);
      expect(res.status).toBe(403);
    });

    it('lists only the requesting student\u2019s applications', async () => {
      await applyAs(studentToken, jobId);
      await applyAs(otherStudentToken, secondJobId);

      const mine = await request(app).get('/api/applications/me').set(authHeader(studentToken));
      expect(mine.status).toBe(200);
      expect(mine.body.applications).toHaveLength(1);
      expect(mine.body.applications[0].applicant.id).toBe(studentId);
      expect(mine.body.applications[0].job.title).toBe('MERN Stack Developer');

      const other = await request(app).get('/api/applications/me').set(authHeader(otherStudentToken));
      expect(other.body.applications).toHaveLength(1);
      expect(other.body.applications[0].applicant.id).toBe(otherStudentId);
    });

    it('supports status filtering on own applications', async () => {
      await applyAs(studentToken, jobId);
      const none = await request(app)
        .get('/api/applications/me?status=selected')
        .set(authHeader(studentToken));
      expect(none.body.applications).toHaveLength(0);
      const applied = await request(app)
        .get('/api/applications/me?status=applied')
        .set(authHeader(studentToken));
      expect(applied.body.applications).toHaveLength(1);
    });
  });

  describe('admin application management', () => {
    it('blocks students from every admin application endpoint', async () => {
      const list = await request(app).get('/api/admin/applications').set(authHeader(studentToken));
      expect(list.status).toBe(403);
      const summary = await request(app)
        .get('/api/admin/dashboard/application-summary')
        .set(authHeader(studentToken));
      expect(summary.status).toBe(403);
      const patch = await request(app)
        .patch(`/api/admin/applications/${new (await import('mongoose')).default.Types.ObjectId()}/status`)
        .set(authHeader(studentToken))
        .send({ status: 'selected' });
      expect(patch.status).toBe(403);
    });

    it('does not let a student change an application status through any student route', async () => {
      const applied = await applyAs(studentToken, jobId);
      const id = applied.body.application.id;
      const patch = await request(app)
        .patch(`/api/admin/applications/${id}/status`)
        .set(authHeader(studentToken))
        .send({ status: 'selected' });
      expect(patch.status).toBe(403);

      const mine = await request(app).get('/api/applications/me').set(authHeader(studentToken));
      expect(mine.body.applications[0].status).toBe('applied');
    });

    it('lists all applications with populated applicant and job', async () => {
      await applyAs(studentToken, jobId);
      await applyAs(otherStudentToken, secondJobId);

      const res = await request(app).get('/api/admin/applications').set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      const first = res.body.applications[0];
      expect(first.applicant.email).toBeTruthy();
      expect(first.job.title).toBeTruthy();
      expect(first.applicant.password).toBeUndefined();
    });

    it('filters admin list by job, status, and search', async () => {
      await applyAs(studentToken, jobId);
      await applyAs(otherStudentToken, secondJobId);

      const byJob = await request(app)
        .get(`/api/admin/applications?jobId=${jobId}`)
        .set(authHeader(adminToken));
      expect(byJob.body.total).toBe(1);

      const byStatus = await request(app)
        .get('/api/admin/applications?status=selected')
        .set(authHeader(adminToken));
      expect(byStatus.body.total).toBe(0);

      const bySearch = await request(app)
        .get('/api/admin/applications?search=applicant one')
        .set(authHeader(adminToken));
      expect(bySearch.body.total).toBe(1);
      expect(bySearch.body.applications[0].applicant.email).toBe('applicant@test.com');
    });

    it('serves the candidate-focused dashboard from application records', async () => {
      await applyAs(studentToken, jobId);
      await applyAs(otherStudentToken, secondJobId);

      const dashboard = await request(app)
        .get('/api/admin/dashboard')
        .set(authHeader(adminToken));
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.totalApplications).toBe(2);
      expect(dashboard.body.roles).toEqual(expect.arrayContaining([
        expect.objectContaining({ jobId, title: 'MERN Stack Developer', applicationCount: 1 }),
      ]));
      expect(dashboard.body.applications[0]).toEqual(expect.objectContaining({
        applicationId: expect.any(String),
        reviewStage: 'applied',
        reviewStageLabel: 'Applied',
      }));

      const applicationId = dashboard.body.applications[0].applicationId;
      const details = await request(app)
        .get(`/api/admin/applications/${applicationId}`)
        .set(authHeader(adminToken));
      expect(details.status).toBe(200);
      expect(details.body.application.applicant.email).toBeTruthy();
      expect(details.body.application.applicant.password).toBeUndefined();
      expect(details.body.candidate.applicationId).toBe(applicationId);

      const filtered = await request(app)
        .get(`/api/admin/dashboard?jobId=${jobId}`)
        .set(authHeader(adminToken));
      expect(filtered.body.applications).toHaveLength(1);
      expect(filtered.body.applications[0].job.title).toBe('MERN Stack Developer');

      const invalid = await request(app)
        .get('/api/admin/applications/not-an-id')
        .set(authHeader(adminToken));
      expect(invalid.status).toBe(400);
    });

    it('updates a status, appends history, and returns the populated application', async () => {
      const applied = await applyAs(studentToken, jobId);
      const id = applied.body.application.id;

      const res = await request(app)
        .patch(`/api/admin/applications/${id}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'shortlisted' });
      expect(res.status).toBe(200);
      expect(res.body.application.status).toBe('shortlisted');
      expect(res.body.application.applicant.email).toBe('applicant@test.com');
      expect(res.body.application.job.title).toBe('MERN Stack Developer');

      const history = res.body.application.statusHistory.map((h) => h.status);
      expect(history).toEqual(['applied', 'shortlisted']);
      expect(res.body.application.statusHistory[1].changedBy).toBeTruthy();
    });

    it('rejects an invalid status and an unchanged status', async () => {
      const applied = await applyAs(studentToken, jobId);
      const id = applied.body.application.id;

      const invalid = await request(app)
        .patch(`/api/admin/applications/${id}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'hired' });
      expect(invalid.status).toBe(400);

      const unchanged = await request(app)
        .patch(`/api/admin/applications/${id}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'applied' });
      expect(unchanged.status).toBe(400);
      expect(unchanged.body.error).toBe('status_unchanged');
    });

    it('returns 404 for a missing application and 400 for an invalid id', async () => {
      const missing = await request(app)
        .patch('/api/admin/applications/000000000000000000000000/status')
        .set(authHeader(adminToken))
        .send({ status: 'selected' });
      expect(missing.status).toBe(404);

      const invalid = await request(app)
        .patch('/api/admin/applications/not-an-id/status')
        .set(authHeader(adminToken))
        .send({ status: 'selected' });
      expect(invalid.status).toBe(400);
    });
  });

  describe('application summary dashboard', () => {
    it('returns correct totals, per-job counts, and pipeline counts', async () => {
      await applyAs(studentToken, jobId);
      await applyAs(studentToken, secondJobId);
      await applyAs(otherStudentToken, jobId);

      // Move one application through the pipeline.
      const list = await request(app).get('/api/admin/applications').set(authHeader(adminToken));
      const toShortlist = list.body.applications.find(
        (a) => a.applicant.email === 'applicant@test.com' && a.job.id === jobId
      );
      await request(app)
        .patch(`/api/admin/applications/${toShortlist.id}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'shortlisted' });

      const res = await request(app)
        .get('/api/admin/dashboard/application-summary')
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);

      expect(res.body.totals.totalApplications).toBe(3);
      expect(res.body.totals.applied).toBe(2);
      expect(res.body.totals.shortlisted).toBe(1);

      const mern = res.body.applicationsByJob.find((j) => j.jobId === jobId);
      expect(mern.jobTitle).toBe('MERN Stack Developer');
      expect(mern.company).toBe('Acme Corp');
      expect(mern.applicationCount).toBe(2);
      expect(mern.statusCounts.applied).toBe(1);
      expect(mern.statusCounts.shortlisted).toBe(1);

      const backend = res.body.applicationsByJob.find((j) => j.jobId === secondJobId);
      expect(backend.applicationCount).toBe(1);

      const pipeline = Object.fromEntries(res.body.pipeline.map((p) => [p.status, p.count]));
      expect(pipeline.applied).toBe(2);
      expect(pipeline.shortlisted).toBe(1);
      expect(pipeline.rejected).toBe(0);
      expect(res.body.pipeline.map((p) => p.status)).toEqual([
        'applied',
        'under_review',
        'shortlisted',
        'interview_scheduled',
        'selected',
        'rejected',
      ]);
      expect(res.body.pipeline.find((p) => p.status === 'under_review').label).toBe('Under Review');
    });

    it('includes jobs with zero applications', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/application-summary')
        .set(authHeader(adminToken));
      expect(res.body.totals.totalApplications).toBe(0);
      expect(res.body.applicationsByJob).toHaveLength(2);
      expect(res.body.applicationsByJob.every((j) => j.applicationCount === 0)).toBe(true);
    });

    it('blocks students from the summary endpoint', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/application-summary')
        .set(authHeader(studentToken));
      expect(res.status).toBe(403);
    });
  });
});

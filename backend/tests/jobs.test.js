import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app, initDb, closeDb, clearDb, registerUser, loginUser, authHeader, makeAdmin,
} from './helpers.js';

function jobBody(overrides = {}) {
  return {
    title: 'Frontend Developer',
    skills: ['React', 'JavaScript'],
    experienceLevel: 1,
    city: 'Chennai',
    description: 'Build user interfaces',
    ...overrides,
  };
}

describe('Job posting portal', () => {
  let studentToken;
  let adminToken;
  let adminId;

  beforeAll(initDb);
  afterAll(closeDb);

  beforeEach(async () => {
    await clearDb();
    await registerUser({ email: 'student@test.com' });
    studentToken = (await loginUser('student@test.com')).token;

    await registerUser({ email: 'admin@test.com' });
    const admin = await makeAdmin('admin@test.com');
    adminId = admin._id.toString();
    adminToken = (await loginUser('admin@test.com')).token;
  });

  function createJob(body = jobBody()) {
    return request(app).post('/api/jobs').set(authHeader(adminToken)).send(body);
  }

  describe('authentication', () => {
    it('rejects GET /api/jobs without a token (401)', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('allows a student to list jobs (200)', async () => {
      const res = await request(app).get('/api/jobs').set(authHeader(studentToken));
      expect(res.status).toBe(200);
      expect(res.body.jobs).toEqual([]);
    });

    it('rejects an invalid token (401)', async () => {
      const res = await request(app).get('/api/jobs').set('Authorization', 'Bearer not.a.jwt');
      expect(res.status).toBe(401);
    });
  });

  describe('authorization', () => {
    it('returns 403 when a student creates a job', async () => {
      const res = await request(app).post('/api/jobs').set(authHeader(studentToken)).send(jobBody());
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 403 when a student updates a job', async () => {
      const created = await createJob();
      const res = await request(app)
        .put(`/api/jobs/${created.body.job.id}`)
        .set(authHeader(studentToken))
        .send({ title: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('returns 403 when a student deletes a job', async () => {
      const created = await createJob();
      const res = await request(app)
        .delete(`/api/jobs/${created.body.job.id}`)
        .set(authHeader(studentToken));
      expect(res.status).toBe(403);
    });

    it('lets an admin create, update, and delete a job', async () => {
      const created = await createJob();
      expect(created.status).toBe(201);
      expect(created.body.job.title).toBe('Frontend Developer');
      const id = created.body.job.id;

      const updated = await request(app)
        .put(`/api/jobs/${id}`)
        .set(authHeader(adminToken))
        .send({ title: 'Senior Frontend Developer', experienceLevel: 3 });
      expect(updated.status).toBe(200);
      expect(updated.body.job.title).toBe('Senior Frontend Developer');
      expect(updated.body.job.experienceLevel).toBe(3);
      expect(updated.body.job.skills).toEqual(['React', 'JavaScript']);

      const deleted = await request(app).delete(`/api/jobs/${id}`).set(authHeader(adminToken));
      expect(deleted.status).toBe(204);

      const list = await request(app).get('/api/jobs').set(authHeader(adminToken));
      expect(list.body.total).toBe(0);
    });

    it('derives createdBy from the verified admin JWT', async () => {
      const res = await createJob();
      expect(res.status).toBe(201);
      expect(res.body.job.createdBy).toBe(adminId);
    });

    it('rejects a client-supplied createdBy', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set(authHeader(adminToken))
        .send(jobBody({ createdBy: '000000000000000000000000' }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');

      const list = await request(app).get('/api/jobs').set(authHeader(adminToken));
      expect(list.body.total).toBe(0);
    });
  });

  describe('validation', () => {
    it('rejects a missing required field (400)', async () => {
      const body = jobBody();
      delete body.title;
      const res = await request(app).post('/api/jobs').set(authHeader(adminToken)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects a negative experienceLevel (400)', async () => {
      const res = await createJob(jobBody({ experienceLevel: -1 }));
      expect(res.status).toBe(400);
    });

    it('rejects empty skills (400)', async () => {
      const res = await createJob(jobBody({ skills: [] }));
      expect(res.status).toBe(400);
    });

    it('rejects empty skill names (400)', async () => {
      const res = await createJob(jobBody({ skills: ['React', '   '] }));
      expect(res.status).toBe(400);
    });

    it('rejects duplicate normalized skills (400)', async () => {
      const res = await createJob(jobBody({ skills: ['React', ' react '] }));
      expect(res.status).toBe(400);
    });

    it('rejects synonym duplicates after normalization (400)', async () => {
      const res = await createJob(jobBody({ skills: ['reactjs', 'react.js'] }));
      expect(res.status).toBe(400);
    });

    it('rejects an invalid job id (400)', async () => {
      const res = await request(app)
        .put('/api/jobs/not-an-id')
        .set(authHeader(adminToken))
        .send({ title: 'X' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for a missing job on update and delete', async () => {
      const missing = '000000000000000000000000';
      const update = await request(app)
        .put(`/api/jobs/${missing}`)
        .set(authHeader(adminToken))
        .send({ title: 'X' });
      expect(update.status).toBe(404);

      const remove = await request(app).delete(`/api/jobs/${missing}`).set(authHeader(adminToken));
      expect(remove.status).toBe(404);
    });

    it('rejects an empty update body (400)', async () => {
      const created = await createJob();
      const res = await request(app)
        .put(`/api/jobs/${created.body.job.id}`)
        .set(authHeader(adminToken))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('search and filtering', () => {
    beforeEach(async () => {
      await createJob(jobBody({ title: 'Frontend Developer', skills: ['React', 'JavaScript'], experienceLevel: 1, city: 'Chennai' }));
      await createJob(jobBody({ title: 'Backend Developer', skills: ['Node.js', 'MongoDB'], experienceLevel: 3, city: 'Bangalore' }));
      await createJob(jobBody({ title: 'Data Analyst', skills: ['Python', 'SQL'], experienceLevel: 2, city: 'chennai' }));
    });

    it('matches skills case-insensitively', async () => {
      const res = await request(app).get('/api/jobs?skills=REACT').set(authHeader(studentToken));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.jobs[0].title).toBe('Frontend Developer');
    });

    it('searches skills from the free-text search field and normalizes synonyms', async () => {
      const res = await request(app).get('/api/jobs?search=reactjs').set(authHeader(studentToken));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.jobs[0].title).toBe('Frontend Developer');
    });

    it('supports comma-separated skill terms in free-text search', async () => {
      const res = await request(app).get('/api/jobs?search=React,Python').set(authHeader(studentToken));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.jobs.map((job) => job.title).sort()).toEqual(['Data Analyst', 'Frontend Developer']);
    });

    it('uses ANY-match semantics for multiple skills', async () => {
      const res = await request(app).get('/api/jobs?skills=react,node.js').set(authHeader(studentToken));
      expect(res.body.total).toBe(2);
      const titles = res.body.jobs.map((j) => j.title).sort();
      expect(titles).toEqual(['Backend Developer', 'Frontend Developer']);
    });

    it('is whitespace-insensitive for skills', async () => {
      const res = await request(app).get('/api/jobs?skills=%20react%20,%20node.js%20').set(authHeader(studentToken));
      expect(res.body.total).toBe(2);
    });

    it('filters by experience as the seeker\u2019s years (experienceLevel <= value)', async () => {
      const res = await request(app).get('/api/jobs?experience=2').set(authHeader(studentToken));
      expect(res.body.total).toBe(2);
      for (const job of res.body.jobs) {
        expect(job.experienceLevel).toBeLessThanOrEqual(2);
      }
    });

    it('matches city case-insensitively and exactly', async () => {
      const res = await request(app).get('/api/jobs?city=CHENNAI').set(authHeader(studentToken));
      expect(res.body.total).toBe(2);
      for (const job of res.body.jobs) {
        expect(job.city.toLowerCase()).toBe('chennai');
      }

      const partial = await request(app).get('/api/jobs?city=chenn').set(authHeader(studentToken));
      expect(partial.body.total).toBe(0);
    });

    it('combines filters with AND across categories', async () => {
      const res = await request(app)
        .get('/api/jobs?skills=react,node.js&experience=1&city=chennai')
        .set(authHeader(studentToken));
      expect(res.body.total).toBe(1);
      expect(res.body.jobs[0].title).toBe('Frontend Developer');
    });

    it('paginates with defaults and caps limit at 50', async () => {
      const first = await request(app).get('/api/jobs').set(authHeader(studentToken));
      expect(first.body.page).toBe(1);
      expect(first.body.limit).toBe(20);
      expect(first.body.total).toBe(3);
      expect(first.body.totalPages).toBe(1);

      const paged = await request(app).get('/api/jobs?page=2&limit=2').set(authHeader(studentToken));
      expect(paged.body.page).toBe(2);
      expect(paged.body.limit).toBe(2);
      expect(paged.body.jobs).toHaveLength(1);
      expect(paged.body.totalPages).toBe(2);

      const capped = await request(app).get('/api/jobs?limit=100').set(authHeader(studentToken));
      expect(capped.body.limit).toBe(50);
    });

    it('rejects invalid pagination values (400)', async () => {
      const badPage = await request(app).get('/api/jobs?page=0').set(authHeader(studentToken));
      expect(badPage.status).toBe(400);
      const badLimit = await request(app).get('/api/jobs?limit=abc').set(authHeader(studentToken));
      expect(badLimit.status).toBe(400);
    });

    it('returns the stable empty response shape with 200', async () => {
      const res = await request(app).get('/api/jobs?skills=does-not-exist').set(authHeader(studentToken));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ jobs: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    });

    it('sorts newest first', async () => {
      const res = await request(app).get('/api/jobs').set(authHeader(studentToken));
      const dates = res.body.jobs.map((j) => new Date(j.createdAt).getTime());
      const sorted = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sorted);
    });

    it('returns the documented job response fields', async () => {
      const res = await request(app).get('/api/jobs?skills=react').set(authHeader(studentToken));
      const job = res.body.jobs[0];
      expect(Object.keys(job).sort()).toEqual(
        ['city', 'company', 'createdAt', 'createdBy', 'description', 'experienceLevel', 'id', 'skills', 'title', 'updatedAt']
      );
    });
  });

  describe('skill normalization and design vs frontend separation', () => {
    it('normalizes synonyms to canonical skill names on create', async () => {
      const res = await createJob(jobBody({ skills: ['reactjs', 'nodejs', 'ui/ux', 'postgres'] }));
      expect(res.status).toBe(201);
      expect(res.body.job.skills).toEqual(['React', 'Node.js', 'UI/UX', 'PostgreSQL']);
    });

    it('normalizes synonyms on update', async () => {
      const created = await createJob();
      const res = await request(app)
        .put(`/api/jobs/${created.body.job.id}`)
        .set(authHeader(adminToken))
        .send({ skills: ['react.js', 'mongo'] });
      expect(res.status).toBe(200);
      expect(res.body.job.skills).toEqual(['React', 'MongoDB']);
    });

    it('finds jobs by synonym search terms', async () => {
      await createJob(jobBody({ title: 'React Role', skills: ['React'] }));
      const res = await request(app).get('/api/jobs?skills=reactjs').set(authHeader(studentToken));
      expect(res.body.total).toBe(1);
      expect(res.body.jobs[0].title).toBe('React Role');
    });

    it('keeps UI/UX distinct from frontend engineering skills', async () => {
      await createJob(jobBody({ title: 'Product Designer', skills: ['UI/UX', 'Figma'] }));
      await createJob(jobBody({ title: 'React Developer', skills: ['React', 'JavaScript', 'Node.js'] }));

      const design = await request(app).get('/api/jobs?skills=ui/ux').set(authHeader(studentToken));
      expect(design.body.total).toBe(1);
      expect(design.body.jobs[0].title).toBe('Product Designer');

      const frontend = await request(app).get('/api/jobs?skills=React').set(authHeader(studentToken));
      expect(frontend.body.total).toBe(1);
      expect(frontend.body.jobs[0].title).toBe('React Developer');

      const designSynonym = await request(app).get('/api/jobs?skills=product%20design').set(authHeader(studentToken));
      expect(designSynonym.body.total).toBe(1);
      expect(designSynonym.body.jobs[0].title).toBe('Product Designer');
    });

    it('supports multi-skill filters with documented ANY-match semantics', async () => {
      await createJob(jobBody({ title: 'Product Designer', skills: ['UI/UX', 'Figma'] }));
      await createJob(jobBody({ title: 'React Developer', skills: ['React', 'Node.js'] }));
      await createJob(jobBody({ title: 'ML Engineer', skills: ['Python', 'PyTorch'] }));

      const res = await request(app)
        .get('/api/jobs?skills=react,ui/ux')
        .set(authHeader(studentToken));
      expect(res.body.total).toBe(2);
      const titles = res.body.jobs.map((j) => j.title).sort();
      expect(titles).toEqual(['Product Designer', 'React Developer']);
    });
  });
});

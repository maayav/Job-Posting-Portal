import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app, initDb, closeDb, clearDb, registerUser, loginUser, authHeader, makeAdmin,
} from './helpers.js';

describe('Job wishlist (saved jobs)', () => {
  let student;
  let other;
  let admin;
  let jobId;
  let secondJobId;

  beforeAll(initDb);
  afterAll(closeDb);

  beforeEach(async () => {
    await clearDb();

    await registerUser({ email: 'student@test.com', name: 'Student One' });
    student = await loginUser('student@test.com');

    await registerUser({ email: 'other@test.com', name: 'Student Two' });
    other = await loginUser('other@test.com');

    await registerUser({ email: 'admin@test.com', name: 'Portal Admin' });
    await makeAdmin('admin@test.com');
    admin = await loginUser('admin@test.com');

    const first = await request(app).post('/api/jobs').set(authHeader(admin.token)).send({
      title: 'Backend Developer', company: 'Acme Corp', skills: ['Node.js'], experienceLevel: 1, city: 'Chennai', description: 'Build APIs',
    });
    jobId = first.body.job.id;
    const second = await request(app).post('/api/jobs').set(authHeader(admin.token)).send({
      title: 'Frontend Developer', company: 'Beta Ltd', skills: ['React'], experienceLevel: 2, city: 'Bangalore', description: 'Build UIs',
    });
    secondJobId = second.body.job.id;
  });

  it('saves a job and lists it with populated details', async () => {
    const saved = await request(app).post('/api/wishlist').set(authHeader(student.token)).send({ jobId });
    expect(saved.status).toBe(201);
    expect(saved.body.job.title).toBe('Backend Developer');

    const list = await request(app).get('/api/wishlist').set(authHeader(student.token));
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].job).toMatchObject({
      id: jobId, title: 'Backend Developer', company: 'Acme Corp', city: 'Chennai', experienceLevel: 1,
    });
  });

  it('is idempotent when the same job is saved twice', async () => {
    await request(app).post('/api/wishlist').set(authHeader(student.token)).send({ jobId });
    const again = await request(app).post('/api/wishlist').set(authHeader(student.token)).send({ jobId });
    expect(again.status).toBe(201);

    const list = await request(app).get('/api/wishlist').set(authHeader(student.token));
    expect(list.body.items).toHaveLength(1);
  });

  it('removes a saved job', async () => {
    await request(app).post('/api/wishlist').set(authHeader(student.token)).send({ jobId });
    const removed = await request(app).delete(`/api/wishlist/${jobId}`).set(authHeader(student.token));
    expect(removed.status).toBe(204);

    const list = await request(app).get('/api/wishlist').set(authHeader(student.token));
    expect(list.body.items).toHaveLength(0);
  });

  it('keeps each student\u2019s wishlist private', async () => {
    await request(app).post('/api/wishlist').set(authHeader(student.token)).send({ jobId });
    await request(app).post('/api/wishlist').set(authHeader(other.token)).send({ jobId: secondJobId });

    const mine = await request(app).get('/api/wishlist').set(authHeader(student.token));
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].job.id).toBe(jobId);

    const theirs = await request(app).get('/api/wishlist').set(authHeader(other.token));
    expect(theirs.body.items).toHaveLength(1);
    expect(theirs.body.items[0].job.id).toBe(secondJobId);

    // Removing one does not affect the other.
    await request(app).delete(`/api/wishlist/${jobId}`).set(authHeader(student.token));
    const after = await request(app).get('/api/wishlist').set(authHeader(other.token));
    expect(after.body.items).toHaveLength(1);
  });

  it('rejects unauthenticated requests and admins', async () => {
    const anonymous = await request(app).get('/api/wishlist');
    expect(anonymous.status).toBe(401);

    const asAdmin = await request(app).post('/api/wishlist').set(authHeader(admin.token)).send({ jobId });
    expect(asAdmin.status).toBe(403);
  });

  it('validates the job and the job id', async () => {
    const missing = await request(app).post('/api/wishlist').set(authHeader(student.token)).send({ jobId: '000000000000000000000000' });
    expect(missing.status).toBe(404);

    const invalid = await request(app).post('/api/wishlist').set(authHeader(student.token)).send({ jobId: 'not-an-id' });
    expect(invalid.status).toBe(400);
  });
});
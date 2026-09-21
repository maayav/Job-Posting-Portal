import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app, initDb, closeDb, clearDb, registerUser, loginUser, authHeader, makeAdmin, minimalPdfBuffer,
} from './helpers.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { saveResume } from '../src/services/storageService.js';

describe('Application apply flow (email, resume, notifications)', () => {
  let student;
  let other;
  let admin;
  let jobId;

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

    const job = await request(app).post('/api/jobs').set(authHeader(admin.token)).send({
      title: 'Backend Developer',
      company: 'Acme Corp',
      skills: ['Node.js'],
      experienceLevel: 1,
      city: 'Chennai',
      description: 'Build APIs',
    });
    jobId = job.body.job.id;
  });

  it('defaults the contact email to the account email', async () => {
    const res = await request(app).post('/api/applications').set(authHeader(student.token)).send({ jobId });
    expect(res.status).toBe(201);
    expect(res.body.application.applicantEmail).toBe('student@test.com');
    expect(res.body.application.hasResume).toBe(false);
  });

  it('stores a contact email provided at apply time', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(student.token))
      .send({ jobId, email: 'jobs@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.application.applicantEmail).toBe('jobs@example.com');
  });

  it('rejects an invalid contact email', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(student.token))
      .send({ jobId, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('accepts a resume attached at apply time and serves it to the owner and admins only', async () => {
    const applied = await request(app)
      .post('/api/applications')
      .set(authHeader(student.token))
      .field('jobId', jobId)
      .attach('resume', minimalPdfBuffer(), { filename: 'custom.pdf' });
    expect(applied.status).toBe(201);
    expect(applied.body.application.hasResume).toBe(true);
    expect(applied.body.application.resumeUrl).toBe(`/api/applications/${applied.body.application.id}/resume`);

    const owner = await request(app)
      .get(applied.body.application.resumeUrl)
      .set(authHeader(student.token));
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toContain('application/pdf');

    const adminDownload = await request(app)
      .get(applied.body.application.resumeUrl)
      .set(authHeader(admin.token));
    expect(adminDownload.status).toBe(200);

    const blocked = await request(app)
      .get(applied.body.application.resumeUrl)
      .set(authHeader(other.token));
    expect(blocked.status).toBe(403);
  });

  it('rejects a non-PDF attachment', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(student.token))
      .field('jobId', jobId)
      .attach('resume', Buffer.from('definitely not a pdf'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_file_type');
  });

  it('reuses the resume saved on the profile when asked', async () => {
    const stored = await saveResume(minimalPdfBuffer(), 'profile.pdf');
    await ProfileSubmission.create({
      user_id: student.user.id,
      resume_file_ref: stored,
      resume_text: 'resume text',
      target_role: 'SDE',
      submitted_at: new Date(),
    });

    const res = await request(app)
      .post('/api/applications')
      .set(authHeader(student.token))
      .send({ jobId, useProfileResume: true });
    expect(res.status).toBe(201);
    expect(res.body.application.hasResume).toBe(true);

    const download = await request(app)
      .get(res.body.application.resumeUrl)
      .set(authHeader(student.token));
    expect(download.status).toBe(200);
  });

  it('notifies the student when an admin changes the status', async () => {
    const applied = await request(app).post('/api/applications').set(authHeader(student.token)).send({ jobId });
    const applicationId = applied.body.application.id;

    const before = await request(app).get('/api/notifications').set(authHeader(student.token));
    expect(before.status).toBe(200);
    expect(before.body.unreadCount).toBe(1); // submission confirmation

    const patched = await request(app)
      .patch(`/api/admin/applications/${applicationId}/status`)
      .set(authHeader(admin.token))
      .send({ status: 'under_review' });
    expect(patched.status).toBe(200);

    const after = await request(app).get('/api/notifications').set(authHeader(student.token));
    expect(after.body.unreadCount).toBe(2);
    expect(after.body.notifications[0].status).toBe('under_review');
    expect(after.body.notifications[0].message).toContain('Under Review');

    const notificationId = after.body.notifications[0].id;
    const blocked = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set(authHeader(other.token));
    expect(blocked.status).toBe(404);

    const read = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set(authHeader(student.token));
    expect(read.status).toBe(200);
    expect(read.body.notification.read).toBe(true);

    const cleared = await request(app).post('/api/notifications/read-all').set(authHeader(student.token));
    expect(cleared.status).toBe(200);
    const final = await request(app).get('/api/notifications').set(authHeader(student.token));
    expect(final.body.unreadCount).toBe(0);
  });

  it('does not show one student the notifications of another', async () => {
    await request(app).post('/api/applications').set(authHeader(student.token)).send({ jobId });
    const otherRes = await request(app).get('/api/notifications').set(authHeader(other.token));
    expect(otherRes.body.notifications).toHaveLength(0);
  });

  it('rejects an unauthenticated notifications request', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});
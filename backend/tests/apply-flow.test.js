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

  it.each(['javascript:alert(1)', 'file:///private/resume.pdf', 'http://example.com/resume.pdf', 'https://user:password@example.com/resume.pdf'])('rejects an unsafe external resume link: %s', async (resumeUrl) => {
    const response = await request(app).post('/api/applications').set(authHeader(student.token)).send({ jobId, resumeUrl });
    expect(response.status).toBe(400);
  });

  it('reports a missing selected profile resume instead of applying without it', async () => {
    const response = await request(app).post('/api/applications').set(authHeader(student.token)).send({ jobId, useProfileResume: true });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('profile_resume_unavailable');
    const mine = await request(app).get('/api/applications/me').set(authHeader(student.token));
    expect(mine.body.applications).toHaveLength(0);
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

  it('does not expose a profile resume when the student chooses no resume', async () => {
    const stored = await saveResume(minimalPdfBuffer(), 'profile.pdf');
    await ProfileSubmission.create({
      user_id: student.user.id,
      resume_file_ref: stored,
      resume_text: 'resume text',
      target_role: 'SDE',
    });

    const applied = await request(app)
      .post('/api/applications')
      .set(authHeader(student.token))
      .send({ jobId });
    expect(applied.status).toBe(201);
    const download = await request(app)
      .get(`/api/applications/${applied.body.application.id}/resume`)
      .set(authHeader(admin.token));
    expect(download.status).toBe(404);
    expect(download.body.error).toBe('resume_not_found');
  });

  it('regenerates a viewable demo resume when the stored file is gone', async () => {
    const { ProfileSubmission } = await import('../src/models/profileSubmission.js');
    const { Application } = await import('../src/models/application.js');
    const submission = await ProfileSubmission.create({
      user_id: student.user.id,
      demo_key: `demo:${student.user.id}:${jobId}`,
      resume_file_ref: 'demo-review/missing.pdf',
      resume_text: 'VORTEX / FICTIONAL DEMO RESUME\nAisha Verma\nFrontend Developer\nSkills: React, Node.js\nBuilt and tested a React dashboard.',
      target_role: 'Frontend Developer',
      extraction_status: 'completed',
    });
    const application = await Application.create({
      applicant: student.user.id,
      job: jobId,
      status: 'applied',
      profileSubmissionId: submission._id,
      resumeFileRef: 'missing-application.pdf',
      resumeSource: 'profile',
    });

    const response = await request(app)
      .get(`/api/admin/applications/${application._id}/resume`)
      .set(authHeader(admin.token));
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    const binary = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.text ?? '', 'binary');
    expect(binary.subarray(0, 5).toString()).toBe('%PDF-');

    const healed = await Application.findById(application._id).lean();
    expect(healed.resumeFileRef).toMatch(/^db:/);

    // The second view reads the durable blob instead of regenerating.
    const second = await request(app)
      .get(`/api/admin/applications/${application._id}/resume`)
      .set(authHeader(admin.token));
    expect(second.status).toBe(200);
    expect(Buffer.isBuffer(second.body) ? second.body.subarray(0, 5).toString() : String(second.text ?? '').slice(0, 5)).toBe('%PDF-');
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

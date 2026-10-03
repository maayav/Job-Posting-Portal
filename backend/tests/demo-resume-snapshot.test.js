import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  app, authHeader, clearDb, closeDb, initDb, loginUser, makeAdmin, registerUser,
} from './helpers.js';
import { Application } from '../src/models/application.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { ResumeBlob } from '../src/models/resumeBlob.js';
import { readResume, saveResumeBlob } from '../src/services/storageService.js';

const DEMO_TEXT = 'VORTEX / FICTIONAL DEMO RESUME\nDemo Candidate\nPython Developer\nSkills: Python, SQL\nBuilt a tested reporting API.';

function pdfBytes(response) {
  return Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.text ?? '', 'binary');
}

describe('Durable demo resume authorization and application snapshots', () => {
  let student;
  let other;
  let admin;
  let jobId;

  beforeAll(initDb);
  afterAll(closeDb);

  beforeEach(async () => {
    await clearDb();
    await registerUser({ email: 'snapshot-student@test.com' });
    student = await loginUser('snapshot-student@test.com');
    await registerUser({ email: 'snapshot-other@test.com' });
    other = await loginUser('snapshot-other@test.com');
    await registerUser({ email: 'snapshot-admin@test.com' });
    await makeAdmin('snapshot-admin@test.com');
    admin = await loginUser('snapshot-admin@test.com');
    const created = await request(app).post('/api/jobs').set(authHeader(admin.token)).send({
      title: 'Python Developer', company: 'Test Company', skills: ['Python'],
      experienceLevel: 0, city: 'Remote', description: 'Build reporting APIs.',
    });
    expect(created.status).toBe(201);
    jobId = created.body.job.id;
  });

  function createSubmission(overrides = {}) {
    return ProfileSubmission.create({
      user_id: student.user.id, demo_key: `demo:${student.user.id}:${jobId}`,
      resume_file_ref: 'demo-review/missing.pdf', resume_text: DEMO_TEXT,
      target_role: 'Python Developer', extraction_status: 'completed', ...overrides,
    });
  }

  function createApplication(submission, overrides = {}) {
    return Application.create({
      applicant: student.user.id, job: jobId,
      profileSubmissionId: submission?._id ?? null,
      reviewSnapshotAt: new Date(), resumeSource: 'profile',
      resumeFileRef: 'missing-application.pdf', ...overrides,
    });
  }

  function view(application, user = admin) {
    return request(app).get(`/api/applications/${application._id}/resume`).set(authHeader(user.token));
  }

  it('does not replace a deleted captured submission with a newer demo profile', async () => {
    const original = await createSubmission();
    const application = await createApplication(original);
    await original.deleteOne();
    await createSubmission({ demo_key: 'newer-demo', resume_text: 'Different, newer demo evidence.' });
    const response = await view(application);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('resume_missing');
    expect(await ResumeBlob.countDocuments()).toBe(0);
    expect((await Application.findById(application._id)).resumeFileRef).toBe('missing-application.pdf');
  });

  it.each([
    ['application_upload', 'missing-upload.pdf', ''],
    ['none', 'missing-none.pdf', ''],
    ['external_url', 'missing-external.pdf', 'https://example.com/resume.pdf'],
    ['none', '', ''],
    ['external_url', '', 'https://example.com/resume.pdf'],
  ])('does not fabricate an application resume for %s with ref %s', async (resumeSource, resumeFileRef, resumeUrl) => {
    const submission = await createSubmission();
    const application = await createApplication(submission, { resumeSource, resumeFileRef, resumeUrl });
    const response = await view(application);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe(resumeFileRef ? 'resume_missing' : 'resume_not_found');
    expect(await ResumeBlob.countDocuments()).toBe(0);
    const unchanged = await Application.findById(application._id);
    expect(unchanged.resumeSource).toBe(resumeSource);
    expect(unchanged.resumeFileRef).toBe(resumeFileRef);
  });

  it('does not treat a user-provided vortex.dev contact email as demo provenance', async () => {
    const ordinary = await createSubmission({ demo_key: null, resume_file_ref: 'missing-real-profile.pdf', resume_text: 'Real applicant evidence.' });
    const applied = await request(app).post('/api/applications').set(authHeader(student.token)).send({
      jobId, email: 'someone@vortex.dev',
    });
    expect(applied.status).toBe(201);
    // Represent an old application whose actual saved profile copy is now gone.
    const application = await Application.findByIdAndUpdate(applied.body.application.id, {
      $set: { resumeSource: 'profile', resumeFileRef: 'missing-real-application.pdf', profileSubmissionId: ordinary._id },
    }, { returnDocument: 'after' });
    const response = await view(application);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('resume_missing');
    expect(await ResumeBlob.countDocuments()).toBe(0);
  });

  it.each(['reviewSnapshotAt', 'readinessReportId'])('does not use the latest profile when %s records a snapshot without a submission id', async (metadataField) => {
    await createSubmission();
    const application = await createApplication(null, {
      reviewSnapshotAt: null,
      [metadataField]: metadataField === 'reviewSnapshotAt' ? new Date() : new mongoose.Types.ObjectId(),
    });
    const response = await view(application);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('resume_missing');
    expect(await ResumeBlob.countDocuments()).toBe(0);
  });

  it('checks owner and admin authorization before repairing or reading a durable resume', async () => {
    const submission = await createSubmission();
    const application = await createApplication(submission);
    const path = `/api/applications/${application._id}/resume`;
    expect((await request(app).get(path)).status).toBe(401);
    expect((await view(application, other)).status).toBe(403);
    expect((await request(app).get(`/api/admin/applications/${application._id}/resume`).set(authHeader(student.token))).status).toBe(403);
    expect(await ResumeBlob.countDocuments()).toBe(0);

    const owner = await view(application, student);
    expect(owner.status).toBe(200);
    expect(pdfBytes(owner).subarray(0, 5).toString()).toBe('%PDF-');
    const adminView = await view(application);
    expect(adminView.status).toBe(200);
    expect(pdfBytes(adminView).equals(pdfBytes(owner))).toBe(true);
    const count = await ResumeBlob.countDocuments();
    expect((await view(application, other)).status).toBe(403);
    expect(await ResumeBlob.countDocuments()).toBe(count);
  });

  it('persists independent copies and keeps the application resume after profile deletion', async () => {
    const submission = await createSubmission();
    const application = await createApplication(submission);
    const first = await view(application);
    expect(first.status).toBe(200);
    const savedProfile = await ProfileSubmission.findById(submission._id);
    const savedApplication = await Application.findById(application._id);
    expect(savedProfile.resume_file_ref).toMatch(/^db:/);
    expect(savedApplication.resumeFileRef).toMatch(/^db:/);
    expect(savedApplication.resumeFileRef).not.toBe(savedProfile.resume_file_ref);
    expect((await readResume(savedApplication.resumeFileRef)).equals(pdfBytes(first))).toBe(true);

    const removed = await request(app).delete(`/api/profile/${submission._id}`).set(authHeader(student.token));
    expect(removed.status).toBe(204);
    expect(await ProfileSubmission.findById(submission._id)).toBeNull();
    const second = await view(application);
    expect(second.status).toBe(200);
    expect(pdfBytes(second).equals(pdfBytes(first))).toBe(true);
    expect((await readResume(savedApplication.resumeFileRef)).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('does not overwrite an existing durable profile copy while repairing its missing application copy', async () => {
    const originalBytes = Buffer.from('%PDF-1.4\nExisting profile bytes\n%%EOF\n');
    const profileRef = await saveResumeBlob(originalBytes, 'existing-profile.pdf');
    const submission = await createSubmission({ resume_file_ref: profileRef });
    const application = await createApplication(submission);
    expect((await view(application)).status).toBe(200);
    const savedProfile = await ProfileSubmission.findById(submission._id);
    const savedApplication = await Application.findById(application._id);
    expect(savedProfile.resume_file_ref).toBe(profileRef);
    expect((await readResume(profileRef)).equals(originalBytes)).toBe(true);
    expect(savedApplication.resumeFileRef).toMatch(/^db:/);
    expect(savedApplication.resumeFileRef).not.toBe(profileRef);
  });
});

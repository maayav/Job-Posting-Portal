import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDb, closeDb, initDb, seedTestOntology } from './helpers.js';
import { Application } from '../src/models/application.js';
import { Job } from '../src/models/job.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { User } from '../src/models/user.js';
import { buildDemoResumePdf } from '../src/services/demoResumeService.js';
import { deleteResume, readResume, saveResume, saveResumeBlob } from '../src/services/storageService.js';
import { ensureDemoReview } from '../scripts/seed-applications.js';

describe('durable demo resume storage', () => {
  beforeAll(initDb);
  afterAll(closeDb);
  beforeEach(async () => { await clearDb(); await seedTestOntology(); });

  it('retains exact PDF bytes through BSON reads and deletes durable references', async () => {
    const pdf = buildDemoResumePdf('Fictional Candidate\nSoftware Engineer\nSkills: Python, SQL\nBuilt a test application.');
    const ref = await saveResumeBlob(pdf, 'demo.pdf');
    expect(ref).toMatch(/^db:[a-f0-9]{32}$/);
    expect(await readResume(ref)).toEqual(pdf);
    await deleteResume(ref);
    await expect(readResume(ref)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('migrates a readable legacy profile PDF even when its content hash has not changed', async () => {
    const admin = await User.create({ name: 'Demo Admin', email: 'profile-migration-admin@test.com', password: 'test-pass-123', role: 'admin' });
    const student = await User.create({ name: 'Fictional Candidate', email: 'profile-migration@test.com', password: 'test-pass-123' });
    const job = await Job.create({ title: 'Python Developer', skills: ['Python', 'SQL'], company: 'Demo company', experienceLevel: 0, city: 'Remote', description: 'Fictional role.', createdBy: admin._id });
    const initial = await ensureDemoReview(student, job, 0);
    const pdf = await readResume(initial.fileRef);
    const localRef = await saveResume(pdf, 'legacy-demo.pdf');
    await ProfileSubmission.updateOne({ _id: initial.submission._id }, { $set: { resume_file_ref: localRef } });
    await deleteResume(initial.fileRef);

    const migrated = await ensureDemoReview(student, job, 0);
    expect(migrated.fileRef).toMatch(/^db:/);
    expect(migrated.submission.demo_content_hash).toBe(initial.submission.demo_content_hash);
    expect(String(migrated.submission._id)).toBe(String(initial.submission._id));
    expect(await ProfileSubmission.countDocuments()).toBe(1);
    expect((await readResume(migrated.fileRef)).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(readResume(localRef)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('migrates an unchanged readable legacy application copy on reseeding', async () => {
    const admin = await User.create({ name: 'Demo Admin', email: 'application-migration-admin@test.com', password: 'test-pass-123', role: 'admin' });
    await Job.create(['Python Developer', 'Data Analyst', 'AI Engineer', 'Cloud Engineer'].map((title) => ({ title, skills: ['Python', 'SQL'], company: 'Demo company', experienceLevel: 0, city: 'Remote', description: 'Fictional role.', createdBy: admin._id })));
    const seed = () => promisify(execFile)(process.execPath, ['scripts/seed-applications.js', '--admin=application-migration-admin@test.com'], { cwd: new URL('..', import.meta.url), env: process.env, timeout: 25000 });
    await seed();
    const application = await Application.findOne();
    const pdf = await readResume(application.resumeFileRef);
    const originalRef = application.resumeFileRef;
    const localRef = await saveResume(pdf, 'legacy-application.pdf');
    application.resumeFileRef = localRef;
    application.status = 'selected';
    await application.save();
    await deleteResume(originalRef);

    await seed();
    const migrated = await Application.findById(application._id);
    expect(migrated.resumeFileRef).toMatch(/^db:/);
    expect(migrated.status).toBe('selected');
    expect(await readResume(migrated.resumeFileRef)).toEqual(pdf);
    await expect(readResume(localRef)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

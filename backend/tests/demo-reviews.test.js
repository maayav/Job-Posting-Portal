import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, clearDb, seedTestOntology } from './helpers.js';
import { User } from '../src/models/user.js';
import { Job } from '../src/models/job.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { ReadinessReport } from '../src/models/readinessReport.js';
import { ensureDemoReview } from '../scripts/seed-applications.js';
import { readResume, deleteResume } from '../src/services/storageService.js';
import { extractResumeText } from '../src/services/resumeService.js';

describe('demo review records', () => {
  beforeAll(initDb);
  afterAll(closeDb);
  beforeEach(async () => { await clearDb(); await seedTestOntology(); });
  it('seeds every demo candidate with an independent resume and preserves statuses on rerun', async () => {
    const admin = await User.create({ name: 'Demo admin', email: 'seed-admin@test.com', password: 'test-pass-123', role: 'admin' });
    await Job.create(['Python Developer', 'Data Analyst', 'AI Engineer', 'Cloud Engineer'].map((title) => ({ title, skills: ['Python', 'SQL'], company: 'Demo company', experienceLevel: 0, city: 'Remote', description: 'Fictional test role.', createdBy: admin._id })));
    const run = () => promisify(execFile)(process.execPath, ['scripts/seed-applications.js', '--admin=seed-admin@test.com'], { cwd: new URL('..', import.meta.url), env: process.env, timeout: 25000 });
    await run();
    const { Application } = await import('../src/models/application.js');
    const first = await Application.findOne();
    first.status = 'selected'; await first.save();
    const originalFile = first.resumeFileRef;
    await run();
    expect(await Application.countDocuments()).toBe(32);
    expect(await ProfileSubmission.countDocuments()).toBe(32);
    const rerun = await Application.findById(first._id);
    expect(rerun.status).toBe('selected');
    expect(rerun.resumeFileRef).toBe(originalFile);
    const profile = await ProfileSubmission.findById(rerun.profileSubmissionId);
    expect(rerun.resumeFileRef).not.toBe(profile.resume_file_ref);
    await deleteResume(profile.resume_file_ref);
    expect((await readResume(rerun.resumeFileRef)).subarray(0, 5).toString()).toBe('%PDF-');
    for (const entry of await Application.find().select('resumeFileRef')) expect((await readResume(entry.resumeFileRef)).subarray(0, 5).toString()).toBe('%PDF-');
  });
  it('creates role-specific PDFs and reports without duplicating records on rerun', async () => {
    const admin = await User.create({ name: 'Demo admin', email: 'demo-admin@test.com', password: 'test-pass-123', role: 'admin' });
    const student = await User.create({ name: 'Fictional Candidate', email: 'demo-candidate@test.com', password: 'test-pass-123' });
    const job = await Job.create({ title: 'Python Developer', skills: ['Python', 'Docker'], company: 'Demo company', experienceLevel: 0, city: 'Remote', description: 'Fictional role.', createdBy: admin._id });
    const first = await ensureDemoReview(student, job, 0);
    first.submission.set({
      github_username: 'stale-demo', github_status: 'ok',
      leetcode_username: 'stale-demo', leetcode_status: 'ok',
      linkedinUrl: 'https://www.linkedin.com/in/stale-demo/', linkedinSummaryText: 'Old profile text',
      codingProfileUrl: 'https://hackerrank.com/profile/stale-demo', codingSummaryText: 'Old coding text',
      source_evidence: { github: { available: true, repos: [{ name: 'stale-repo' }] }, leetcode: { available: true, totalSolved: 100 } },
    });
    await first.submission.save();
    const second = await ensureDemoReview(student, job, 0);
    expect(String(first.submission._id)).toBe(String(second.submission._id));
    expect(await ProfileSubmission.countDocuments()).toBe(1);
    expect(await ReadinessReport.countDocuments()).toBe(1);
    const text = await extractResumeText(await readResume(second.fileRef));
    expect(text).toContain(student.name);
    expect(text).toContain(job.title);
    expect(text).toContain('Python');
    expect(text).toContain('Docker');
    expect(text).toMatch(/fictional/i);
    expect(second.report.profile_assessment.assessedSources).toBe(1);
    expect(second.submission).toMatchObject({ github_username: '', leetcode_username: '', linkedinUrl: '', linkedinSummaryText: '', codingProfileUrl: '', codingSummaryText: '' });
    expect(second.submission.source_evidence.github.available).toBe(false);
    expect(second.submission.source_evidence.leetcode.available).toBe(false);
    expect(second.report.career_actions.projects.length).toBeGreaterThan(0);
    expect(second.report.status).toBe('completed');
    job.skills = ['Python']; await job.save();
    const changed = await ensureDemoReview(student, job, 0);
    const changedText = await extractResumeText(await readResume(changed.fileRef));
    expect(changedText).not.toContain('Docker');
    const { ExtractedSkillProfile } = await import('../src/models/extractedSkillProfile.js');
    expect((await ExtractedSkillProfile.findOne({ submission_id: changed.submission._id })).embeddings).toHaveLength(0);
  });
});

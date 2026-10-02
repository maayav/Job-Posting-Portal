import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app, initDb, closeDb, clearDb, registerUser, loginUser, authHeader, uploadResume, minimalPdfBuffer, nonResumePdfBuffer, seedTestOntology,
} from './helpers.js';

vi.mock('../src/services/geminiService.js', () => ({
  extractSkills: vi.fn(async () => ({
    skills: [
      { name: 'React', sources: ['resume'], evidence: [{ source: 'resume', text: 'built a React dashboard' }] },
      { name: 'Node.js', sources: ['resume'], evidence: [{ source: 'resume', text: 'built a REST API' }] },
    ],
    model: 'mock-model',
  })),
}));

const SAMPLE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sample-resumes');

vi.mock('../src/services/githubService.js', async (importOriginal) => {
  const original = await importOriginal();
  const { AppError } = await import('../src/utils/errors.js');
  return { ...original, fetchGithubProfile: vi.fn(async (username) => {
    if (username.startsWith('this-user-does-not-exist')) throw new AppError('GitHub user not found', 404, 'github_not_found');
    return { username, repos: [], fromCache: false };
  }) };
});

describe('Profile ingestion & security', () => {
  let token;
  let otherToken;
  let adminToken;

  beforeAll(async () => {
    await initDb();
  });
  afterAll(closeDb);
  beforeEach(async () => {
    await clearDb();
    await seedTestOntology();
    token = (await registerUser({ email: 'owner@test.com' })).token;
    otherToken = (await registerUser({ email: 'other@test.com' })).token;
    await registerUser({ email: 'admin@test.com' });
    await (await import('../src/models/user.js')).User.updateOne(
      { email: 'admin@test.com' },
      { $set: { role: 'admin' } }
    );
    adminToken = (await loginUser('admin@test.com', 'secret123')).token;
  });

  it('imports LinkedIn PDF text only for an authenticated user without saving a profile', async () => {
    const pdf = minimalPdfBuffer();
    expect((await request(app).post('/api/profile/linkedin-preview').attach('linkedin', pdf, 'profile.pdf')).status).toBe(401);
    const response = await request(app).post('/api/profile/linkedin-preview').set(authHeader(token)).attach('linkedin', pdf, 'profile.pdf');
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('user_provided_pdf');
    expect(response.body.text.length).toBeGreaterThan(0);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const { ProfileSubmission } = await import('../src/models/profileSubmission.js');
    expect(await ProfileSubmission.countDocuments()).toBe(0);
    const invalid = await request(app).post('/api/profile/linkedin-preview').set(authHeader(token)).attach('linkedin', Buffer.from('not a PDF'), 'profile.pdf');
    expect(invalid.status).toBe(400);
  });

  it('rejects non-PDF files', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', Buffer.from('not a pdf at all'), { filename: 'resume.txt' })
      .field('target_role', 'SDE');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_file_type');
  });

  it('rejects spoofed extensions (text renamed to .pdf)', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', Buffer.from('hello this is text'), { filename: 'fake.pdf', contentType: 'application/pdf' })
      .field('target_role', 'SDE');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_file_type');
  });

  it('rejects oversized files (6 MB)', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 0x25);
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', big, { filename: 'big.pdf' })
      .field('target_role', 'SDE');
    expect(r.status).toBe(413);
    expect(r.body.error).toBe('file_too_large');
  });

  it('rejects missing file', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .field('target_role', 'SDE');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('no_file');
  });

  it('rejects invalid target role', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', minimalPdfBuffer(), { filename: 'r.pdf' })
      .field('target_role', 'CEO');
    expect(r.status).toBe(400);
  });

  it('accepts a target role that exists in the ontology (no hard-coded enum)', async () => {
    const { SkillOntology } = await import('../src/models/skillOntology.js');
    await SkillOntology.create({
      skill_name: 'Data Analysis',
      category: 'data',
      embedding_model: 'test-model',
      embedding_version: 'test',
      embedding_vector: [1, 0, 0],
      roles: [{ role_name: 'Data Scientist', weight: 0.8 }],
    });

    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', minimalPdfBuffer(), { filename: 'r.pdf' })
      .field('target_role', 'Data Scientist');
    expect(r.status).toBe(201);
    expect(r.body.target_role).toBe('Data Scientist');
  });

  it('rejects a PDF that does not look like a resume (422 not_a_resume)', async () => {
    const res = await uploadResume(token, { buffer: nonResumePdfBuffer() });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('not_a_resume');
  });

  it('accepts a resume-like PDF converted to plain text', async () => {
    const res = await uploadResume(token, { buffer: minimalPdfBuffer() });
    expect(res.status).toBe(201);
    expect(res.body.extraction_status).toBe('completed');
  });

  it('normalizes GitHub URL into a canonical username', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', minimalPdfBuffer(), { filename: 'r.pdf' })
      .field('github_username', 'https://github.com/SomeUser/')
      .field('target_role', 'SDE');
    expect(r.status).toBe(201);
    expect(r.body.github_username).toBe('someuser');
  });

  it('stores a normalized LinkedIn URL and user-provided summary', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', minimalPdfBuffer(), { filename: 'r.pdf' })
      .field('linkedinUrl', 'https://www.linkedin.com/in/example-user/?trk=profile')
      .field('linkedinSummaryText', 'Built React dashboards for internal teams.')
      .field('target_role', 'SDE');
    expect(r.status).toBe(201);
    expect(r.body.linkedinUrl).toBe('https://www.linkedin.com/in/example-user/');
    expect(r.body.linkedinSummaryText).toContain('Built React dashboards');
    expect(r.body.linkedinDataSource).toBe('user_provided_text');
    const profile = await request(app).get(`/api/profile/${r.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(profile.body.linkedinUrl).toBe('https://www.linkedin.com/in/example-user/');
    expect(profile.body.linkedinSummaryText).toContain('Built React dashboards');
  });

  it('rejects non-LinkedIn profile URLs', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', minimalPdfBuffer(), { filename: 'r.pdf' })
      .field('linkedinUrl', 'https://example.com/in/example-user')
      .field('target_role', 'SDE');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_linkedin_url');
  });

  it('accepts a valid PDF and persists the submission without returning resume_text', async () => {
    const pdf = fs.readFileSync(path.join(SAMPLE_DIR, 'sample-sde.pdf'));
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdf, { filename: 'sample-sde.pdf' })
      .field('target_role', 'SDE');
    expect(r.status).toBe(201);
    const id = r.body.id;
    expect(r.body.resume_text).toBeUndefined();

    const g = await request(app).get(`/api/profile/${id}`).set('Authorization', `Bearer ${token}`);
    expect(g.status).toBe(200);
    expect(JSON.stringify(g.body)).not.toContain('Aarav Mehta');
    expect(g.body.target_role).toBe('SDE');
  });

  it('blocks another student from reading or deleting a submission (403)', async () => {
    const pdf = fs.readFileSync(path.join(SAMPLE_DIR, 'sample-sde.pdf'));
    const created = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdf, { filename: 'sample-sde.pdf' })
      .field('target_role', 'SDE');
    const id = created.body.id;

    const read = await request(app).get(`/api/profile/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(read.status).toBe(403);

    const del = await request(app).delete(`/api/profile/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(del.status).toBe(403);
  });

  it('allows an admin to read and delete any submission', async () => {
    const pdf = fs.readFileSync(path.join(SAMPLE_DIR, 'sample-sde.pdf'));
    const created = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdf, { filename: 'sample-sde.pdf' })
      .field('target_role', 'SDE');
    const id = created.body.id;

    const read = await request(app).get(`/api/profile/${id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(read.status).toBe(200);

    const del = await request(app).delete(`/api/profile/${id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    const gone = await request(app).get(`/api/profile/${id}`).set('Authorization', `Bearer ${token}`);
    expect(gone.status).toBe(404);
  });

  it('degrades gracefully when the GitHub profile is missing or private (upload still succeeds)', async () => {
    const r = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', minimalPdfBuffer(), { filename: 'r.pdf' })
      .field('github_username', 'this-user-does-not-exist-xyz123')
      .field('target_role', 'SDE');
    expect(r.status).toBe(201);
    expect(['not_found', 'unavailable']).toContain(r.body.github_status);
    expect(r.body.id).toBeTruthy();
  });

  it('deletes the stored resume file when the submission is deleted', async () => {
    const pdf = fs.readFileSync(path.join(SAMPLE_DIR, 'sample-sde.pdf'));
    const created = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdf, { filename: 'sample-sde.pdf' })
      .field('target_role', 'SDE');
    const id = created.body.id;

    const { ProfileSubmission } = await import('../src/models/profileSubmission.js');
    const sub = await ProfileSubmission.findById(id);
    const { readResume } = await import('../src/services/storageService.js');
    await expect(readResume(sub.resume_file_ref)).resolves.toBeTruthy();

    await request(app).delete(`/api/profile/${id}`).set('Authorization', `Bearer ${token}`);
    await expect(readResume(sub.resume_file_ref)).rejects.toThrow();
  });
});

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, initDb, closeDb, clearDb, registerUser, loginUser, makeAdmin, authHeader } from './helpers.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { ReadinessReport } from '../src/models/readinessReport.js';
import { generateAssistantReply } from '../src/services/geminiService.js';
import { AppError } from '../src/utils/errors.js';
vi.mock('../src/services/geminiService.js', () => ({ generateAssistantReply: vi.fn(async () => 'Start with System Design.'), extractSkills: vi.fn() }));

describe('Assistant ownership and grounding', () => {
  let token, otherToken, adminToken, report;
  beforeAll(initDb); afterAll(closeDb);
  beforeEach(async () => {
    await clearDb(); vi.clearAllMocks();
    const owner=await registerUser({email:'owner@test.com'}); token=owner.token;
    otherToken=(await registerUser({email:'other@test.com'})).token;
    await registerUser({ email: 'admin@test.com', name: 'Placement Admin' });
    await makeAdmin('admin@test.com');
    adminToken = (await loginUser('admin@test.com')).token;
    const { User }=await import('../src/models/user.js');
    const user=await User.findOne({email:'owner@test.com'});
    const submission=await ProfileSubmission.create({user_id:user._id,resume_file_ref:'test.pdf',resume_text:'React portfolio',target_role:'SDE'});
    report=await ReadinessReport.create({submission_id:submission._id,target_role:'SDE',status:'completed',score:42,completedAt:new Date(),gaps:[{skill:'System Design',percent:0,priority:1}]});
  });
  const chat=(token,body)=>request(app).post('/api/assistant/chat').set('Authorization',`Bearer ${token}`).send(body);
  it('requires authentication',async()=>expect((await request(app).get('/api/assistant/context')).status).toBe(401));
  it('uses only stored scores and gaps',async()=>{
    const r=await chat(token,{message:'What next?',analysisId:String(report._id),score:100,skills:['PyTorch']});
    expect(r.status).toBe(200); expect(r.body.reply).toBeTruthy();
    const prompt=generateAssistantReply.mock.calls[0][0];expect(prompt).toContain('System Design');expect(prompt).toContain('"roleReadinessScore":42');expect(prompt).not.toContain('"roleReadinessScore":100');
  });
  it('asks for scan-friendly Markdown without weakening grounding or safety',async()=>{
    const r=await chat(token,{message:'What next?',analysisId:String(report._id)});
    expect(r.status).toBe(200);
    const systemPrompt=generateAssistantReply.mock.calls[0][1];
    expect(systemPrompt).toContain('concise, practical Markdown that is easy to scan');
    expect(systemPrompt).toContain('Use bullets for a few parallel points');
    expect(systemPrompt).toContain('Do not force headings or sections for a simple question');
    expect(systemPrompt).toContain('Never invent skills, projects, scores, certifications, experience, or other data');
    expect(systemPrompt).toContain('Do not make hiring decisions');
    expect(systemPrompt).toContain('Only cite resource URLs supplied in the study plan');
  });
  it('rejects access to another student analysis',async()=>expect((await chat(otherToken,{message:'What next?',analysisId:String(report._id)})).status).toBe(403));
  it('handles missing analysis',async()=>expect((await chat(otherToken,{message:'What next?'})).status).toBe(409));
  it('rejects oversized messages',async()=>expect((await chat(token,{message:'a'.repeat(1201)})).status).toBe(400));
  it('clamps a long previous assistant reply rather than rejecting the next question', async () => {
    const response = await chat(token, { message: 'What next?', history: [{ role: 'assistant', content: 'x'.repeat(16000) }] });
    expect(response.status).toBe(200);
    expect(generateAssistantReply.mock.calls[0][0].length).toBeLessThan(10000);
  });
  it('returns a controlled provider failure',async()=>{
    generateAssistantReply.mockRejectedValueOnce(new AppError('Please retry shortly.',503,'ai_rate_limited'));
    const r=await chat(token,{message:'What next?'});expect(r.status).toBe(503);expect(r.body.error).toBe('ai_rate_limited');
  });
  it('gives admins a grounded workspace context without requiring a student analysis', async () => {
    const job = await request(app).post('/api/jobs').set(authHeader(adminToken)).send({
      title: 'FastAPI Engineer', company: 'Northstar', skills: ['FastAPI', 'Python', 'PostgreSQL'],
      experienceLevel: 2, city: 'Remote', description: 'Build APIs for the placement workspace.',
    });
    expect(job.status).toBe(201);
    const application = await request(app).post('/api/applications').set(authHeader(token)).send({ jobId: job.body.job.id });
    expect(application.status).toBe(201);

    const context = await request(app).get('/api/assistant/context').set(authHeader(adminToken));
    expect(context.status).toBe(200);
    expect(context.body).toMatchObject({ role: 'admin', stats: { openJobs: 1, totalApplications: 1, totalCandidates: 1 } });
    expect(context.body.openRoles[0]).toMatchObject({ title: 'FastAPI Engineer', applicationCount: 1 });
    expect(context.body.candidates[0]).toMatchObject({ role: 'FastAPI Engineer', status: 'applied' });

    const response = await chat(adminToken, { message: 'How many people applied to each open role?' });
    expect(response.status).toBe(200);
    expect(response.body.assistantType).toBe('admin');
    expect(response.body.usage.groundedInAdminWorkspace).toBe(true);
    expect(generateAssistantReply.mock.calls[0][0]).toContain('FastAPI Engineer');
    expect(generateAssistantReply.mock.calls[0][1]).toContain('authenticated administrator');
  });

  async function createApplication() {
    const job = await request(app).post('/api/jobs').set(authHeader(adminToken)).send({
      title: 'Backend Engineer', company: 'Demo', skills: ['Python'], experienceLevel: 1,
      city: 'Remote', description: 'Build documented APIs.',
    });
    expect(job.status).toBe(201);
    const applied = await request(app).post('/api/applications').set(authHeader(token)).send({ jobId: job.body.job.id });
    expect(applied.status).toBe(201);
    return applied.body.application.id;
  }

  async function createNewerProfile() {
    const original = await ProfileSubmission.findById(report.submission_id);
    const newer = await ProfileSubmission.create({
      user_id: original.user_id, resume_file_ref: 'later.pdf', resume_text: 'Built Python models.',
      target_role: 'AI Engineer', submitted_at: new Date(Date.now() + 1000),
    });
    await ReadinessReport.create({ submission_id: newer._id, target_role: 'AI Engineer', status: 'completed', score: 99, completedAt: new Date() });
    const { ExtractedSkillProfile } = await import('../src/models/extractedSkillProfile.js');
    await ExtractedSkillProfile.create({ submission_id: newer._id, gemini_model: 'mock', skills: [{ name: 'Python', confidence: 'medium', sources: ['resume'] }] });
    return newer;
  }

  it('grounds each application in its own captured profile after a newer analysis', async () => {
    const { ExtractedSkillProfile } = await import('../src/models/extractedSkillProfile.js');
    await ExtractedSkillProfile.create({ submission_id: report.submission_id, gemini_model: 'mock', skills: [{ name: 'React', confidence: 'medium', sources: ['resume'] }] });
    const firstId = await createApplication();
    await createNewerProfile();
    const secondId = await createApplication();
    const context = await request(app).get('/api/assistant/context').set(authHeader(adminToken));
    expect(context.status).toBe(200);
    expect(context.body.candidates.find((candidate) => candidate.applicationId === firstId))
      .toMatchObject({ targetRole: 'SDE', readinessScore: 42, demonstratedSkills: ['React'] });
    expect(context.body.candidates.find((candidate) => candidate.applicationId === secondId))
      .toMatchObject({ targetRole: 'AI Engineer', readinessScore: 99, demonstratedSkills: ['Python'] });
    const details = await request(app).get(`/api/admin/applications/${firstId}`).set(authHeader(adminToken));
    expect(context.body.candidates.find((candidate) => candidate.applicationId === firstId).readinessScore)
      .toBe(details.body.review.roleReadinessScore);
    const response = await chat(adminToken, { message: 'What is the readiness for each Backend Engineer application?' });
    expect(response.status).toBe(200);
    const prompt = generateAssistantReply.mock.calls[0][0];
    expect(prompt).toContain('"readinessScore":42');
    expect(prompt).toContain('"readinessScore":99');
  });

  it.each(['profile', 'report'])('keeps a deleted captured %s absent from the admin assistant', async (missing) => {
    const applicationId = await createApplication();
    await createNewerProfile();
    if (missing === 'profile') await ProfileSubmission.deleteOne({ _id: report.submission_id });
    else await report.deleteOne();
    const context = await request(app).get('/api/assistant/context').set(authHeader(adminToken));
    expect(context.status).toBe(200);
    const candidate = context.body.candidates.find((entry) => entry.applicationId === applicationId);
    expect(candidate.readinessScore).toBeNull();
    expect(candidate.targetRole).toBe(missing === 'profile' ? null : 'SDE');
    expect(candidate.demonstratedSkills).not.toContain('Python');
  });

  it('keeps a captured absence of a completed report after one is created later', async () => {
    await report.deleteOne();
    const applicationId = await createApplication();
    await ReadinessReport.create({ submission_id: report.submission_id, target_role: 'SDE', status: 'completed', score: 99, completedAt: new Date() });
    const context = await request(app).get('/api/assistant/context').set(authHeader(adminToken));
    expect(context.status).toBe(200);
    expect(context.body.candidates.find((candidate) => candidate.applicationId === applicationId))
      .toMatchObject({ targetRole: 'SDE', readinessScore: null, strongSkills: [], missingSkills: [] });
  });

  it('keeps a captured absence of a profile after a profile is created later', async () => {
    const ownerId = (await ProfileSubmission.findById(report.submission_id)).user_id;
    await ProfileSubmission.deleteOne({ _id: report.submission_id });
    const applicationId = await createApplication();
    const newer = await ProfileSubmission.create({ user_id: ownerId, resume_file_ref: 'later.pdf', resume_text: 'New evidence', target_role: 'AI Engineer' });
    await ReadinessReport.create({ submission_id: newer._id, target_role: 'AI Engineer', status: 'completed', score: 99, completedAt: new Date() });
    const context = await request(app).get('/api/assistant/context').set(authHeader(adminToken));
    expect(context.status).toBe(200);
    expect(context.body.candidates.find((candidate) => candidate.applicationId === applicationId))
      .toMatchObject({ targetRole: null, readinessScore: null, demonstratedSkills: [] });
  });

  it('bounds detailed admin records while retaining exact global totals', async () => {
    const mongoose = (await import('mongoose')).default;
    const { Job } = await import('../src/models/job.js');
    const { Application } = await import('../src/models/application.js');
    const { User } = await import('../src/models/user.js');
    const administrator = await User.findOne({ email: 'admin@test.com' });
    const jobs = await Job.insertMany(Array.from({ length: 205 }, (_, index) => ({ title: `Role ${index}`, company: 'Demo', skills: ['Python'], experienceLevel: 1, city: 'Remote', description: 'Demo role', createdBy: administrator._id })));
    await Application.insertMany(Array.from({ length: 251 }, (_, index) => ({ applicant: new mongoose.Types.ObjectId(), job: jobs[index % jobs.length]._id })));
    const response = await request(app).get('/api/assistant/context').set(authHeader(adminToken));
    expect(response.status).toBe(200);
    expect(response.body.stats).toMatchObject({ totalJobs: 205, openJobs: 205, totalApplications: 251, totalCandidates: 251 });
    expect(response.body.openRoles).toHaveLength(200);
    expect(response.body.candidates).toHaveLength(250);
    expect(response.body.stats.detailCoverage).toContain('Global totals');
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});

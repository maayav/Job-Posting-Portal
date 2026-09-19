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
    const prompt=generateAssistantReply.mock.calls[0][0];expect(prompt).toContain('System Design');expect(prompt).toContain('"atsScore":42');expect(prompt).not.toContain('"atsScore":100');
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
});

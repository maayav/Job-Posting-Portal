import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, initDb, closeDb, clearDb, registerUser } from './helpers.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { ReadinessReport } from '../src/models/readinessReport.js';
import { generateAssistantReply } from '../src/services/geminiService.js';
import { AppError } from '../src/utils/errors.js';
vi.mock('../src/services/geminiService.js', () => ({ generateAssistantReply: vi.fn(async () => 'Start with System Design.'), extractSkills: vi.fn() }));

describe('Assistant ownership and grounding', () => {
  let token, otherToken, report;
  beforeAll(initDb); afterAll(closeDb);
  beforeEach(async () => {
    await clearDb(); vi.clearAllMocks();
    const owner=await registerUser({email:'owner@test.com'}); token=owner.token;
    otherToken=(await registerUser({email:'other@test.com'})).token;
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
  it('rejects access to another student analysis',async()=>expect((await chat(otherToken,{message:'What next?',analysisId:String(report._id)})).status).toBe(403));
  it('handles missing analysis',async()=>expect((await chat(otherToken,{message:'What next?'})).status).toBe(409));
  it('rejects oversized messages',async()=>expect((await chat(token,{message:'a'.repeat(1201)})).status).toBe(400));
  it('returns a controlled provider failure',async()=>{
    generateAssistantReply.mockRejectedValueOnce(new AppError('Please retry shortly.',503,'ai_rate_limited'));
    const r=await chat(token,{message:'What next?'});expect(r.status).toBe(503);expect(r.body.error).toBe('ai_rate_limited');
  });
});

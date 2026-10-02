import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadinessReport } from '../src/models/readinessReport.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { ExtractedSkillProfile } from '../src/models/extractedSkillProfile.js';
import { SkillOntology } from '../src/models/skillOntology.js';
import { enrichCareerPlan } from '../src/services/ai/studyPlanService.js';
import { generateReport } from '../src/services/scoringService.js';
import { reconcileAnalysisJobs, runAnalysis, STALE_ANALYSIS_MS } from '../src/services/analysisService.js';
import { withRequestBudget } from '../src/utils/requestBudget.js';

vi.mock('../src/config/env.js', () => ({ env: { EMBEDDING_MODEL: 'pinned', EMBEDDING_VERSION: 'v1' } }));
vi.mock('../src/models/readinessReport.js', () => ({ ReadinessReport: { findOneAndUpdate: vi.fn(), updateMany: vi.fn(), updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) } }));
vi.mock('../src/models/profileSubmission.js', () => ({ ProfileSubmission: { findById: vi.fn() } }));
vi.mock('../src/models/extractedSkillProfile.js', () => ({ ExtractedSkillProfile: { findOne: vi.fn() } }));
vi.mock('../src/models/skillOntology.js', () => ({ SkillOntology: { find: vi.fn() } }));
vi.mock('../src/services/profileAssessmentService.js', () => ({ buildProfileAssessment: vi.fn(() => ({ score: 50, assessedSources: 1, totalSources: 5 })) }));
vi.mock('../src/services/skillService.js', () => ({ processExtraction: vi.fn() }));
vi.mock('../src/services/ai/embeddingProvider.js', () => ({ generateEmbeddings: vi.fn() }));
vi.mock('../src/services/scoringService.js', () => ({ generateReport: vi.fn(), buildStudyPlan: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/services/ai/studyPlanService.js', () => ({ enrichCareerPlan: vi.fn() }));

let report;
beforeEach(() => {
  vi.clearAllMocks();
  report = { _id: 'report', submission_id: 'submission', target_role: 'Test role', status: 'processing', startedAt: new Date() };
  ReadinessReport.findOneAndUpdate.mockResolvedValueOnce(report);
  ProfileSubmission.findById.mockResolvedValue({ _id: 'submission' });
  ExtractedSkillProfile.findOne.mockResolvedValue({
    skills: [{ name: 'Python', toObject: () => ({ name: 'Python' }) }],
    embedding_model: 'pinned', embedding_version: 'v1', embeddings: [{ vector: [1, 0] }],
  });
  SkillOntology.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([{ roles: [{ role_name: 'Test role', weight: 1 }], embedding_model: 'pinned', embedding_version: 'v1', embedding_vector: [1, 0] }]) });
  generateReport.mockResolvedValue({ score: 84, strong_areas: [], developing_areas: [], gaps: [], study_plan: [] });
  enrichCareerPlan.mockResolvedValue({ studyPlan: [], careerActions: { projects: [], practice: [], posts: [] } });
});
afterEach(() => vi.useRealTimers());

describe('Analysis ownership and timeout persistence', () => {
  it('claims only queued work and persists the unchanged score under its processing lease', async () => {
    ReadinessReport.findOneAndUpdate.mockResolvedValueOnce({ ...report, status: 'completed', score: 84 });
    expect((await runAnalysis('report')).status).toBe('completed');
    expect(ReadinessReport.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: 'report', status: 'queued' });
    expect(ReadinessReport.findOneAndUpdate.mock.calls[1][0]).toEqual({ _id: 'report', status: 'processing', startedAt: report.startedAt });
    expect(ReadinessReport.findOneAndUpdate.mock.calls[1][1].$set.score).toBe(84);
  });

  it('does not restart an already claimed or terminal job', async () => {
    ReadinessReport.findOneAndUpdate.mockReset().mockResolvedValueOnce(null);
    expect(await runAnalysis('report')).toBeNull();
    expect(ProfileSubmission.findById).not.toHaveBeenCalled();
  });

  it('persists a controlled timeout and permits a new attempt after failure', async () => {
    vi.useFakeTimers();
    enrichCareerPlan.mockImplementation(() => new Promise(() => {}));
    ReadinessReport.findOneAndUpdate.mockResolvedValueOnce({ ...report, status: 'failed', errorCode: 'analysis_timeout' });
    const result = withRequestBudget(() => runAnalysis('report'), { timeoutMs: 100 });
    const expectation = expect(result).resolves.toMatchObject({ status: 'failed', errorCode: 'analysis_timeout' });
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
    const [filter, update] = ReadinessReport.findOneAndUpdate.mock.calls[1];
    expect(filter).toEqual({ _id: 'report', status: 'processing', startedAt: report.startedAt });
    expect(update.$set.status).toBe('failed');
    expect(update.$set.errorCode).toBe('analysis_timeout');
  });

  it('does not overwrite a stale-reaped terminal job when an old runner finishes', async () => {
    ReadinessReport.findOneAndUpdate.mockResolvedValueOnce(null);
    expect(await runAnalysis('report')).toBeNull();
    expect(ReadinessReport.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(ReadinessReport.findOneAndUpdate.mock.calls[1][0].status).toBe('processing');
  });

  it('reaps expired queued and processing work while keeping fresh work eligible', async () => {
    const now = Date.now();
    ReadinessReport.updateMany.mockResolvedValue({ modifiedCount: 2 });
    expect(await reconcileAnalysisJobs(now)).toBe(2);
    const [filter, update] = ReadinessReport.updateMany.mock.lastCall;
    expect(filter.$or).toContainEqual({ status: 'queued', createdAt: { $lt: new Date(now - STALE_ANALYSIS_MS) } });
    expect(filter.$or).toContainEqual({ status: 'processing', startedAt: { $lt: new Date(now - STALE_ANALYSIS_MS) } });
    expect(filter.$or).toContainEqual({ status: 'processing', startedAt: null, createdAt: { $lt: new Date(now - STALE_ANALYSIS_MS) } });
    expect(update.$set).toMatchObject({ status: 'failed', errorCode: 'analysis_timeout' });
  });
});

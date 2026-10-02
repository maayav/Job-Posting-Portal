import { env } from '../config/env.js';
import { ReadinessReport } from '../models/readinessReport.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { ExtractedSkillProfile } from '../models/extractedSkillProfile.js';
import { SkillOntology } from '../models/skillOntology.js';
import { processExtraction } from './skillService.js';
import { generateEmbeddings as embedSkillsBatch } from './ai/embeddingProvider.js';
import { generateReport, buildStudyPlan } from './scoringService.js';
import { enrichStudyPlan } from './ai/studyPlanService.js';
import { assertRequestBudget, withinRequestBudget } from '../utils/requestBudget.js';

export const STALE_ANALYSIS_MS = 10 * 60 * 1000;

export async function reconcileAnalysisJobs(now = Date.now()) {
  const cutoff = new Date(now - STALE_ANALYSIS_MS);
  const result = await ReadinessReport.updateMany(
    {
      $or: [
        { status: 'processing', startedAt: { $lt: cutoff } },
        { status: 'processing', startedAt: null, createdAt: { $lt: cutoff } },
        { status: 'queued', createdAt: { $lt: cutoff } },
      ],
    },
    { $set: { status: 'failed', errorCode: 'analysis_timeout', completedAt: new Date(now) } },
  );
  return result.modifiedCount ?? 0;
}

function logTransition(report, to, extra = {}) {
  console.log(JSON.stringify({
    event: 'analysis_job',
    report_id: report._id.toString(),
    submission_id: report.submission_id?.toString() ?? null,
    status: to,
    ...extra,
  }));
}

export async function runAnalysis(reportId) {
  let report;
  try {
    assertRequestBudget();
    // Claim only queued work. A second runner cannot restart a completed job or
    // take over a processing job owned by another request.
    report = await ReadinessReport.findOneAndUpdate(
      { _id: reportId, status: 'queued' },
      { $set: { status: 'processing', startedAt: new Date(), errorCode: null } },
      { returnDocument: 'after', maxTimeMS: 5000 },
    );
    if (!report) return null;
    logTransition(report, 'processing');
    assertRequestBudget();

    const submission = await withinRequestBudget(() => ProfileSubmission.findById(report.submission_id));
    if (!submission) {
      throw new Error('submission_missing');
    }

    let skillProfile = await withinRequestBudget(() => ExtractedSkillProfile.findOne({ submission_id: submission._id }));
    if (!skillProfile || skillProfile.skills.length === 0) {
      skillProfile = await withinRequestBudget(() => processExtraction(submission._id, null));
    }

    const rawOntology = await withinRequestBudget(() => SkillOntology.find({ roles: { $elemMatch: { role_name: report.target_role } } }).lean());
    if (rawOntology.length === 0) {
      const err = new Error('ontology_missing');
      err.code = 'ontology_missing';
      throw err;
    }

    const ontologySkills = rawOntology.map((skill) => {
      const role = (skill.roles || []).find((r) => r.role_name === report.target_role);
      return { ...skill, weight: role?.weight ?? 0 };
    });

    if (rawOntology.some((skill) => skill.embedding_model !== env.EMBEDDING_MODEL || skill.embedding_version !== env.EMBEDDING_VERSION)) {
      const error = new Error('Stored ontology uses another embedding model. Re-embed the ontology before analysis.');
      error.code = 'embedding_model_mismatch';
      throw error;
    }

    // Reuse cached skill vectors when they were produced by the pinned model;
    // otherwise embed once and cache them on the profile.
    const cacheValid = skillProfile.embedding_model === env.EMBEDDING_MODEL
      && skillProfile.embedding_version === env.EMBEDDING_VERSION
      && Array.isArray(skillProfile.embeddings)
      && skillProfile.embeddings.length === skillProfile.skills.length
      && skillProfile.embeddings.every((entry) => Array.isArray(entry.vector) && entry.vector.length > 0);

    let vectors;
    if (cacheValid) {
      vectors = skillProfile.embeddings.map((entry) => entry.vector);
    } else {
      vectors = await withinRequestBudget(() => embedSkillsBatch(skillProfile.skills.map((s) => s.name)));
      skillProfile.embeddings = skillProfile.skills.map((skill, index) => ({ name: skill.name, vector: vectors[index] }));
      skillProfile.embedding_model = env.EMBEDDING_MODEL;
      skillProfile.embedding_version = env.EMBEDDING_VERSION;
      await withinRequestBudget(() => skillProfile.save().catch(() => {}));
    }

    if (vectors.some((vector) => rawOntology.some((skill) => skill.embedding_vector.length !== vector.length))) {
      const error = new Error('Stored vector dimensions do not match the configured embedding model.');
      error.code = 'embedding_dimension_mismatch';
      throw error;
    }
    const candidateVectors = skillProfile.skills.map((skill, i) => ({ ...skill.toObject(), vector: vectors[i] }));

    const result = await withinRequestBudget(() => generateReport(ontologySkills, candidateVectors));
    const developingPlan = await withinRequestBudget(() => buildStudyPlan(result.developing_areas.map((area) => ({ ...area, priority: 0.4 }))));
    result.study_plan = await withinRequestBudget(() => enrichStudyPlan([...result.study_plan, ...developingPlan], report.target_role, skillProfile.skills.map((skill) => skill.name)));

    if (!Number.isFinite(result.score)) {
      throw new Error('scoring_failed');
    }

    assertRequestBudget();
    const completed = await ReadinessReport.findOneAndUpdate(
      { _id: reportId, status: 'processing', startedAt: report.startedAt },
      { $set: {
        score: result.score,
        strong_areas: result.strong_areas,
        developing_areas: result.developing_areas,
        gaps: result.gaps,
        study_plan: result.study_plan,
        embedding_model: env.EMBEDDING_MODEL,
        embedding_version: env.EMBEDDING_VERSION,
        status: 'completed', errorCode: null,
        completedAt: new Date(), generated_at: new Date(),
      } },
      { returnDocument: 'after', maxTimeMS: 5000 },
    );
    if (completed) logTransition(completed, 'completed', { score: completed.score });
    return completed;
  } catch (err) {
    const errorCode = err.code === 'request_timeout' ? 'analysis_timeout' : err.code ?? 'analysis_failed';
    // This write deliberately uses the reserved time after upstream cancellation.
    // A stale reaper or another terminal transition must win over a late runner.
    const failed = await ReadinessReport.findOneAndUpdate(
      { _id: reportId, status: report ? 'processing' : 'queued', ...(report ? { startedAt: report.startedAt } : {}) },
      { $set: { status: 'failed', errorCode, completedAt: new Date() } },
      { returnDocument: 'after', maxTimeMS: 5000 },
    );
    if (failed) logTransition(failed, 'failed', { errorCode });
    return failed;
  }
}

export function queueAnalysis(reportId) {
  if (env.NODE_ENV === 'test') {
    runAnalysis(reportId).catch((err) => {
      console.error(JSON.stringify({ event: 'analysis_job', report_id: String(reportId), fatal: true, code: err.code ?? 'analysis_failed' }));
    });
    return;
  }
  setImmediate(() => {
    runAnalysis(reportId).catch((err) => {
      console.error(JSON.stringify({ event: 'analysis_job', report_id: String(reportId), fatal: true, code: err.code ?? 'analysis_failed' }));
    });
  });
}

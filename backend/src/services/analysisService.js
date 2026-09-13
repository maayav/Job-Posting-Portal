import { env } from '../config/env.js';
import { ReadinessReport } from '../models/readinessReport.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { ExtractedSkillProfile } from '../models/extractedSkillProfile.js';
import { SkillOntology } from '../models/skillOntology.js';
import { processExtraction } from './skillService.js';
import { embedSkill } from './embeddingService.js';
import { generateReport } from './scoringService.js';

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
  const report = await ReadinessReport.findById(reportId);
  if (!report) return;

  try {
    report.status = 'processing';
    report.startedAt = new Date();
    await report.save();
    logTransition(report, 'processing');

    const submission = await ProfileSubmission.findById(report.submission_id);
    if (!submission) {
      throw new Error('submission_missing');
    }

    let skillProfile = await ExtractedSkillProfile.findOne({ submission_id: submission._id });
    if (!skillProfile || skillProfile.skills.length === 0) {
      skillProfile = await processExtraction(submission._id, null);
    }

    const rawOntology = await SkillOntology.find({ roles: { $elemMatch: { role_name: report.target_role } } }).lean();
    if (rawOntology.length === 0) {
      const err = new Error('ontology_missing');
      err.code = 'ontology_missing';
      throw err;
    }

    const ontologySkills = rawOntology.map((skill) => {
      const role = (skill.roles || []).find((r) => r.role_name === report.target_role);
      return { ...skill, weight: role?.weight ?? 0 };
    });

    const candidateVectors = [];
    for (const skill of skillProfile.skills) {
      const vector = await embedSkill(skill.name);
      candidateVectors.push({ name: skill.name, vector });
    }

    const result = await generateReport(ontologySkills, candidateVectors);

    if (!Number.isFinite(result.score)) {
      throw new Error('scoring_failed');
    }

    report.score = result.score;
    report.strong_areas = result.strong_areas;
    report.developing_areas = result.developing_areas;
    report.gaps = result.gaps;
    report.study_plan = result.study_plan;
    report.embedding_model = env.EMBEDDING_MODEL;
    report.embedding_version = env.EMBEDDING_VERSION;
    report.status = 'completed';
    report.completedAt = new Date();
    report.generated_at = new Date();
    await report.save();
    logTransition(report, 'completed', { score: report.score });
  } catch (err) {
    const errorCode = err.code ?? 'analysis_failed';
    await ReadinessReport.findByIdAndUpdate(reportId, {
      $set: {
        status: 'failed',
        errorCode,
        completedAt: new Date(),
      },
    });
    report.status = 'failed';
    report.errorCode = errorCode;
    logTransition(report, 'failed', { errorCode, message: err.message?.slice(0, 200) });
  }
}

export function queueAnalysis(reportId) {
  setImmediate(() => {
    runAnalysis(reportId).catch((err) => {
      console.error(JSON.stringify({ event: 'analysis_job', report_id: String(reportId), fatal: true, message: err.message }));
    });
  });
}
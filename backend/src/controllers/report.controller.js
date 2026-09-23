import { ReadinessReport } from '../models/readinessReport.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';
import { hydrateStudyPlan } from '../services/resourceService.js';

function toJson(report) {
  return {
    report_id: report._id.toString(),
    submission_id: report.submission_id.toString(),
    target_role: report.target_role,
    status: report.status,
    errorCode: report.errorCode,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    score: report.score,
    strong_areas: report.strong_areas,
    developing_areas: report.developing_areas,
    gaps: report.gaps,
    study_plan: report.study_plan,
    embedding_model: report.embedding_model,
    embedding_version: report.embedding_version,
    generated_at: report.generated_at,
  };
}

export async function getReport(req, res) {
  const report = req.resource;
  if (report.status !== 'completed') {
    throw new AppError('Report is not ready yet', 409, 'report_not_ready');
  }
  res.json({ ...toJson(report), study_plan: await hydrateStudyPlan(report.study_plan) });
}

export async function markStudyPlanItemDone(req, res) {
  const { id, itemId } = req.params;
  const report = await ReadinessReport.findById(id);
  if (!report) {
    throw new AppError('Report not found', 404, 'not_found');
  }

  const submission = await report.populate('submission_id');
  if (!submission.submission_id || submission.submission_id.user_id.toString() !== req.user.id) {
    if (req.user.role !== 'admin') {
      throw new AppError('Insufficient permissions', 403, 'forbidden');
    }
  }

  const item = report.study_plan.id(itemId);
  if (!item) {
    throw new AppError('Study plan item not found', 404, 'not_found');
  }

  item.done = !item.done;
  await report.save();
  res.json({ report_id: report._id.toString(), item_id: itemId, done: item.done });
}

async function historyForUser(userId) {
  const submissions = await ProfileSubmission.find({ user_id: userId }).select('_id').lean();
  const reports = await ReadinessReport.find({
    submission_id: { $in: submissions.map((s) => s._id) },
    status: 'completed',
  })
    .sort({ completedAt: 1 })
    .lean();

  return reports.map((r) => ({
    report_id: r._id.toString(),
    score: r.score,
    target_role: r.target_role,
    completed_at: r.completedAt,
  }));
}

export async function getOwnHistory(req, res) {
  const history = await historyForUser(req.user.id);
  res.json({ history });
}

// GET /api/report/roadmap — the latest report for every role the student has
// analyzed, so the dashboard can show what to study per role (including the
// roles behind their job applications). Roles whose latest report is not
// completed are returned with their status and an empty plan.
export async function getRoadmap(req, res) {
  const submissions = await ProfileSubmission.find({ user_id: req.user.id }).select('_id').lean();
  if (submissions.length === 0) {
    res.json({ roadmaps: [] });
    return;
  }

  const reports = await ReadinessReport.find({
    submission_id: { $in: submissions.map((s) => s._id) },
  })
    .sort({ createdAt: -1 })
    .lean();

  const latestByRole = new Map();
  for (const report of reports) {
    if (!latestByRole.has(report.target_role)) latestByRole.set(report.target_role, report);
  }

  const entries = [...latestByRole.values()];
  const completed = entries.filter((report) => report.status === 'completed');

  // Hydrate every role's plan with one resource query instead of one per role.
  const hydrated = await hydrateStudyPlan(completed.flatMap((report) => report.study_plan ?? []));
  let cursor = 0;
  const completedById = new Map();
  for (const report of completed) {
    const count = report.study_plan?.length ?? 0;
    completedById.set(report._id.toString(), hydrated.slice(cursor, cursor + count));
    cursor += count;
  }

  const roadmaps = entries.map((report) => {
    const id = report._id.toString();
    const plan = completedById.get(id) ?? [];
    return {
      target_role: report.target_role,
      report_id: id,
      status: report.status,
      score: report.status === 'completed' ? report.score : null,
      generated_at: report.generated_at,
      gap_count: report.status === 'completed' ? report.gaps?.length ?? 0 : 0,
      gaps: report.status === 'completed'
        ? (report.gaps ?? []).map((gap) => ({ skill: gap.skill, percent: gap.percent }))
        : [],
      study_plan: plan,
    };
  });

  const statusRank = { completed: 0, processing: 1, queued: 2, failed: 3 };
  roadmaps.sort((a, b) => (
    (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9)
    || b.gap_count - a.gap_count
    || a.target_role.localeCompare(b.target_role)
  ));
  res.json({ roadmaps });
}

export async function getUserReports(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError('Invalid user id', 400, 'invalid_id');
  }
  const history = await historyForUser(userId);
  res.json({ user_id: userId, history });
}

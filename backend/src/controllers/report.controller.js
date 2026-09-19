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

export async function getUserReports(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError('Invalid user id', 400, 'invalid_id');
  }
  const history = await historyForUser(userId);
  res.json({ user_id: userId, history });
}

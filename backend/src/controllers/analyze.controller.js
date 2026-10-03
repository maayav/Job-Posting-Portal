import { z } from 'zod';
import { ReadinessReport } from '../models/readinessReport.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { queueAnalysis, reconcileAnalysisJobs, runAnalysis } from '../services/analysisService.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const COOLDOWN_MS = 60 * 1000;

const createSchema = z.object({
  submission_id: z.string().min(1),
});

export async function createAnalysis(req, res) {
  const { submission_id } = createSchema.parse(req.body);
  await reconcileAnalysisJobs();

  const submission = await ProfileSubmission.findById(submission_id);
  if (!submission) {
    throw new AppError('Submission not found', 404, 'not_found');
  }
  if (submission.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Insufficient permissions', 403, 'forbidden');
  }

  const existing = await ReadinessReport.findOne({
    submission_id,
    status: { $in: ['queued', 'processing'] },
  });
  if (existing) {
    return res.status(202).json({ report_id: existing._id.toString(), status: existing.status });
  }

  const mostRecentCompleted = await ReadinessReport.findOne({ submission_id, status: 'completed' })
    .sort({ completedAt: -1 });

  if (mostRecentCompleted?.completedAt) {
    const elapsedMs = Date.now() - new Date(mostRecentCompleted.completedAt).getTime();
    if (elapsedMs < COOLDOWN_MS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((COOLDOWN_MS - elapsedMs) / 1000));
      return res.status(429).json({
        error: 'analysis_cooldown',
        message: 'Please wait before re-analyzing this submission.',
        retryAfterSeconds,
        report_id: mostRecentCompleted._id.toString(),
      });
    }
  }

  let report;
  try {
    report = await ReadinessReport.create({
      submission_id,
      target_role: submission.target_role,
      status: 'queued',
      embedding_model: null,
      embedding_version: null,
    });
  } catch (error) {
    // Two requests may both pass the read above. The database's active-job
    // constraint chooses the winner; the other request follows that same job.
    if (error.code === 11000) {
      const active = await ReadinessReport.findOne({ submission_id, status: { $in: ['queued', 'processing'] } });
      if (active) return res.status(202).json({ report_id: active._id.toString(), status: active.status, errorCode: active.errorCode ?? null });
    }
    throw error;
  }

  // Serverless platforms freeze the process after the response, so the job must
  // finish inside the request there; long-lived servers keep the async queue.
  let responseReport = report;
  if (env.NODE_ENV === 'test' || process.env.VERCEL) {
    responseReport = await runAnalysis(report._id) || await ReadinessReport.findById(report._id);
  } else {
    queueAnalysis(report._id);
  }

  res.status(202).json({ report_id: report._id.toString(), status: responseReport?.status ?? report.status, errorCode: responseReport?.errorCode ?? null });
}

export async function getAnalysisStatus(req, res) {
  const report = req.resource;
  res.set('Cache-Control', 'private, no-store');
  res.json({
    report_id: report._id.toString(),
    submission_id: report.submission_id.toString(),
    status: report.status,
    stage: report.stage ?? report.status,
    errorCode: report.errorCode,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
  });
}

// The profile ID is known before the serverless POST finishes. This read-only
// endpoint lets the UI show actual stages while that request is still running.
export async function getSubmissionAnalysisStatus(req, res) {
  const report = await ReadinessReport.findOne({ submission_id: req.resource._id }).sort({ createdAt: -1 });
  if (!report) return res.status(204).end();
  req.resource = report;
  return getAnalysisStatus(req, res);
}

import { z } from 'zod';
import { ReadinessReport } from '../models/readinessReport.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { queueAnalysis, runAnalysis } from '../services/analysisService.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const COOLDOWN_MS = 60 * 1000;

const createSchema = z.object({
  submission_id: z.string().min(1),
});

export async function createAnalysis(req, res) {
  const { submission_id } = createSchema.parse(req.body);

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
      });
    }
  }

  const report = await ReadinessReport.create({
    submission_id,
    target_role: submission.target_role,
    status: 'queued',
    embedding_model: null,
    embedding_version: null,
  });

  if (env.NODE_ENV === 'test') {
    await runAnalysis(report._id);
  } else {
    queueAnalysis(report._id);
  }

  res.status(202).json({ report_id: report._id.toString(), status: report.status });
}

export async function getAnalysisStatus(req, res) {
  const report = req.resource;
  res.json({
    report_id: report._id.toString(),
    submission_id: report.submission_id.toString(),
    status: report.status,
    errorCode: report.errorCode,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
  });
}
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { ReadinessReport } from '../models/readinessReport.js';

export function requireOwnership(Model, paramName = 'id') {
  return async (req, res, next) => {
    const doc = await Model.findById(req.params[paramName]);
    if (!doc) {
      throw new AppError('Resource not found', 404, 'not_found');
    }
    const isOwner = doc.user_id?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError('Insufficient permissions', 403, 'forbidden');
    }
    req.resource = doc;
    next();
  };
}

export async function requireReportAccess(req, res, next) {
  const report = await ReadinessReport.findById(req.params.id);
  if (!report) {
    throw new AppError('Report not found', 404, 'not_found');
  }
  const submission = await ProfileSubmission.findById(report.submission_id);
  if (!submission) {
    throw new AppError('Report not found', 404, 'not_found');
  }
  const isOwner = submission.user_id.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('Insufficient permissions', 403, 'forbidden');
  }
  req.resource = report;
  next();
}

export function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}
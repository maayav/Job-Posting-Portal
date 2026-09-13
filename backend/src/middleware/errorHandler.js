import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

function sendError(res, err) {
  const body = { error: err.error ?? err.code, message: err.message };
  if (err.issues) body.issues = err.issues;
  res.status(err.statusCode).json(body);
}

export function notFoundHandler(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'not_found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    sendError(res, err);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, {
      statusCode: 400,
      error: 'validation_error',
      message: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      sendError(res, new AppError('File exceeds the 5 MB size limit', 413, 'file_too_large'));
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      sendError(res, new AppError('Unexpected file field', 400, 'invalid_upload'));
      return;
    }
    sendError(res, new AppError(err.message, 400, 'invalid_upload'));
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, new AppError('Malformed JSON body', 400, 'invalid_json'));
    return;
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    sendError(res, new AppError(`A record with this ${field} already exists`, 409, 'duplicate'));
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    sendError(res, new AppError('Invalid resource id', 400, 'invalid_id'));
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    sendError(res, new AppError(err.message, 400, 'validation_error'));
    return;
  }

  console.error('Unhandled error:', err);
  sendError(res, new AppError('Internal server error', 500, 'internal_error'));
}
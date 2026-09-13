import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';

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

export function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}
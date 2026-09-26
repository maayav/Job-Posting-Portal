import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { User } from '../models/user.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Authentication required', 401, 'unauthorized');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired token', 401, 'invalid_token');
  }

  if (!payload.id || !payload.sid) {
    throw new AppError('Invalid or expired token', 401, 'invalid_token');
  }

  const user = await User.findById(payload.id).select('+activeSessionId +sessionExpiresAt');
  if (!user || user.activeSessionId !== payload.sid) {
    throw new AppError('Your session has ended. Please sign in again.', 401, 'session_ended');
  }

  if (user.sessionExpiresAt && user.sessionExpiresAt.getTime() <= Date.now()) {
    throw new AppError('Your session has expired. Please sign in again.', 401, 'session_expired');
  }

  req.user = { id: payload.id, role: user.role };
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      throw new AppError('Insufficient permissions', 403, 'forbidden');
    }
    next();
  };
}

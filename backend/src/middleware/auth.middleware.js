import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function signTokenForUser(user) {
  return signToken(user);
}

export function requireAuth(req, res, next) {
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

  if (!payload.id) {
    throw new AppError('Invalid or expired token', 401, 'invalid_token');
  }

  req.user = { id: payload.id, role: payload.role };
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
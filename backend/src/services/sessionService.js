import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.js';
import { AppError } from '../utils/errors.js';

export function signSessionToken(user, sessionId) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, sid: sessionId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

export async function startSession(user) {
  const sessionId = crypto.randomUUID();
  const token = signSessionToken(user, sessionId);
  const decoded = jwt.decode(token);
  const sessionExpiresAt = new Date(decoded.exp * 1000);

  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { activeSessionId: null },
        { sessionExpiresAt: null },
        { sessionExpiresAt: { $lte: new Date() } },
      ],
    },
    { $set: { activeSessionId: sessionId, sessionExpiresAt } },
    { returnDocument: 'after' }
  );

  if (!claimed) {
    throw new AppError(
      'This account is already logged in on another device. Log out there first, or wait for that session to expire.',
      409,
      'already_logged_in'
    );
  }

  return token;
}

export async function endSession(userId) {
  await User.updateOne(
    { _id: userId },
    { $set: { activeSessionId: null, sessionExpiresAt: null } }
  );
}

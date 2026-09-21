import { z } from 'zod';
import { Notification } from '../models/notification.js';
import { AppError } from '../utils/errors.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

function toNotificationResponse(notification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    status: notification.status ?? '',
    application: notification.application ? notification.application.toString() : null,
    job: notification.job ? notification.job.toString() : null,
    read: !!notification.read,
    createdAt: notification.createdAt,
  };
}

// GET /api/notifications — the current user's notifications, newest first.
export async function listNotifications(req, res) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  res.json({ notifications: notifications.map(toNotificationResponse), unreadCount });
}

// PATCH /api/notifications/:id/read — mark one of the current user's notifications read.
export async function markNotificationRead(req, res) {
  const id = objectIdSchema.parse(req.params.id);
  const notification = await Notification.findOneAndUpdate(
    { _id: id, user: req.user.id },
    { $set: { read: true } },
    { returnDocument: 'after' }
  ).lean();
  if (!notification) {
    throw new AppError('Notification not found', 404, 'not_found');
  }
  res.json({ notification: toNotificationResponse(notification) });
}

// POST /api/notifications/read-all — mark all of the current user's notifications read.
export async function markAllNotificationsRead(req, res) {
  await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
}
import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['application_status', 'application_submitted', 'system'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'application_status' },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, default: '' },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
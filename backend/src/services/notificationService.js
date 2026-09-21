import { Notification } from '../models/notification.js';
import { STATUS_LABELS } from '../models/application.js';

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

// Notify a student that their application status changed (admin action).
export async function notifyApplicationStatus(application, jobTitle) {
  await Notification.create({
    user: application.applicant,
    type: 'application_status',
    title: `Application ${statusLabel(application.status)}`,
    message: `Your application for "${jobTitle || 'a job'}" is now "${statusLabel(application.status)}".`,
    status: application.status,
    application: application._id,
    job: application.job,
  });
}

// Confirm to the student that the application was received.
export async function notifyApplicationSubmitted(application, jobTitle) {
  await Notification.create({
    user: application.applicant,
    type: 'application_submitted',
    title: 'Application received',
    message: `We received your application for "${jobTitle || 'a job'}". You can track its status in My Applications.`,
    status: application.status,
    application: application._id,
    job: application.job,
  });
}
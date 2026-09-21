import mongoose from 'mongoose';

export const APPLICATION_STATUSES = [
  'applied',
  'under_review',
  'shortlisted',
  'interview_scheduled',
  'rejected',
  'selected',
];

export const STATUS_LABELS = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  rejected: 'Rejected',
  selected: 'Selected',
};

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'applied' },
    appliedAt: { type: Date, default: Date.now },
    coverLetter: { type: String, trim: true, maxlength: 3000, default: '' },
    // Contact email chosen at apply time (defaults to the account email).
    applicantEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
    // Server-generated storage filename for a resume attached to this application.
    resumeFileRef: { type: String, trim: true, default: '' },
    resumeOriginalName: { type: String, trim: true, maxlength: 200, default: '' },
    resumeUrl: { type: String, trim: true, maxlength: 500, default: '' },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

// One application per student per job.
applicationSchema.index({ applicant: 1, job: 1 }, { unique: true });
applicationSchema.index({ appliedAt: -1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ job: 1 });

// New applications always start in "applied" and record the initial history entry.
applicationSchema.pre('validate', function seedHistory() {
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.status ?? 'applied',
      changedAt: this.appliedAt ?? new Date(),
      changedBy: this.applicant ?? null,
    });
  }
});

export const Application = mongoose.model('Application', applicationSchema);
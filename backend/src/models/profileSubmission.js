import mongoose from 'mongoose';

const profileSubmissionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resume_file_ref: { type: String, required: true },
    resume_text: { type: String, required: true },
    github_username: { type: String, trim: true, default: '' },
    github_status: {
      type: String,
      enum: ['ok', 'unavailable', 'not_found', 'none'],
      default: 'none',
    },
    target_role: { type: String, enum: ['SDE', 'ML Engineer'], required: true },
    submitted_at: { type: Date, default: Date.now },
    extraction_status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    extraction_error: { type: String, default: null },
  },
  { timestamps: true }
);

export const ProfileSubmission = mongoose.model('ProfileSubmission', profileSubmissionSchema);
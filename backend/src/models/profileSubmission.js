import mongoose from 'mongoose';

const profileSubmissionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    demo_key: { type: String, default: null },
    demo_content_hash: { type: String, default: null },
    resume_file_ref: { type: String, required: true },
    resume_text: { type: String, required: true },
    github_username: { type: String, trim: true, default: '' },
    github_status: {
      type: String,
      enum: ['ok', 'unavailable', 'not_found', 'none'],
      default: 'none',
    },
    leetcode_username: { type: String, trim: true, default: '' },
    leetcode_status: { type: String, enum: ['none', 'ok', 'not_found', 'unavailable'], default: 'none' },
    linkedinUrl: { type: String, trim: true, maxlength: 500, default: '' },
    linkedinSummaryText: { type: String, trim: true, maxlength: 10000, default: '' },
    linkedinDataSource: { type: String, enum: ['user_provided_text'], default: null },
    codingProfileUrl: { type: String, trim: true, maxlength: 500, default: '' },
    codingSummaryText: { type: String, trim: true, maxlength: 10000, default: '' },
    source_evidence: {
      capturedAt: Date,
      github: {
        available: Boolean,
        partial: Boolean,
        fetchedAt: Date,
        repos: [{
          _id: false, name: String, description: String, readme: String, readmeStatus: String,
          language: String, topics: [String],
          languages: { type: mongoose.Schema.Types.Mixed },
          manifests: { type: mongoose.Schema.Types.Mixed },
        }],
      },
      leetcode: {
        available: Boolean,
        totalSolved: { type: Number, default: null },
        easy: { type: Number, default: null },
        medium: { type: Number, default: null },
        hard: { type: Number, default: null },
        languages: [{ _id: false, name: String, solved: Number }],
      },
    },
    target_role: { type: String, required: true, trim: true },
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

profileSubmissionSchema.index({ user_id: 1, submitted_at: -1 });

export const ProfileSubmission = mongoose.model('ProfileSubmission', profileSubmissionSchema);

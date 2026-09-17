import mongoose from 'mongoose';

const areaSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const gapSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    priority: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const studyPlanItemSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true },
    priority: { type: Number, required: true, min: 0, max: 1 },
    resources: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, enum: ['documentation', 'course', 'practice-set', 'video'], required: true },
        verified: { type: Boolean, default: true },
      },
    ],
    done: { type: Boolean, default: false },
    reason: String,
    learningObjectives: [String],
    practiceProblems: [String],
    projectRecommendations: [String],
    estimatedEffortHours: Number,
  },
  { _id: true }
);

const readinessReportSchema = new mongoose.Schema(
  {
    submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfileSubmission', required: true },
    target_role: { type: String, required: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    errorCode: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    score: { type: Number, default: null, min: 0, max: 100 },
    strong_areas: { type: [areaSchema], default: [] },
    developing_areas: { type: [areaSchema], default: [] },
    gaps: { type: [gapSchema], default: [] },
    study_plan: { type: [studyPlanItemSchema], default: [] },
    embedding_model: { type: String, default: null },
    embedding_version: { type: String, default: null },
    generated_at: { type: Date, default: null },
  },
  { timestamps: true }
);

readinessReportSchema.index(
  { submission_id: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['queued', 'processing'] } } }
);

readinessReportSchema.index({ submission_id: 1, completedAt: -1 });

export const ReadinessReport = mongoose.model('ReadinessReport', readinessReportSchema);

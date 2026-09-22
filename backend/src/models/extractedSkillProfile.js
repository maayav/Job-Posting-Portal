import mongoose from 'mongoose';

const CATEGORIES = [
  'language',
  'frontend_framework',
  'backend_framework',
  'database',
  'ml_framework',
  'devops_tool',
  'cloud_platform',
  'testing_tool',
  'other',
];

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, default: 'other' },
    confidence: { type: String, enum: ['low', 'medium', 'high'], required: true },
    sources: [{ type: String, enum: ['resume', 'github', 'leetcode'] }],
    evidence: [
      {
        source: { type: String, enum: ['resume', 'github', 'leetcode'], required: true },
        text: { type: String, required: true },
      },
    ],
    proficiency_signals: {
      projects_count: { type: Number, default: 0, min: 0, max: 5 },
      has_production_usage: { type: Boolean, default: false },
      mentions_depth: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    },
  },
  { _id: false }
);

const extractedSkillProfileSchema = new mongoose.Schema(
  {
    submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfileSubmission', required: true, unique: true },
    skills: { type: [skillSchema], default: [] },
    gemini_model: { type: String, required: true },
    // Cached skill vectors so analysis does not re-embed unchanged profiles.
    embeddings: {
      type: [{ name: { type: String, required: true }, vector: { type: [Number], default: [] } }],
      default: [],
    },
    embedding_model: { type: String, default: '' },
    embedding_version: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ExtractedSkillProfile = mongoose.model('ExtractedSkillProfile', extractedSkillProfileSchema);
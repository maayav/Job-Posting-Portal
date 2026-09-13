import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    confidence: { type: String, enum: ['low', 'medium', 'high'], required: true },
    sources: [{ type: String, enum: ['resume', 'github'] }],
    evidence: [
      {
        source: { type: String, enum: ['resume', 'github'], required: true },
        text: { type: String, required: true },
      },
    ],
  },
  { _id: false }
);

const extractedSkillProfileSchema = new mongoose.Schema(
  {
    submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfileSubmission', required: true, unique: true },
    skills: { type: [skillSchema], default: [] },
    gemini_model: { type: String, required: true },
  },
  { timestamps: true }
);

export const ExtractedSkillProfile = mongoose.model('ExtractedSkillProfile', extractedSkillProfileSchema);
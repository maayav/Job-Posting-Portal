import mongoose from 'mongoose';

const skillOntologySchema = new mongoose.Schema(
  {
    skill_name: { type: String, required: true, trim: true, unique: true, index: true },
    category: { type: String, default: 'general' },
    embedding_model: { type: String, required: true },
    embedding_version: { type: String, required: true },
    embedding_vector: { type: [Number], required: true },
    roles: [
      {
        role_name: { type: String, required: true },
        weight: { type: Number, required: true, min: 0, max: 1 },
      },
    ],
  },
  { timestamps: true }
);

export const SkillOntology = mongoose.model('SkillOntology', skillOntologySchema);
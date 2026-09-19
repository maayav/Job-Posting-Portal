import mongoose from 'mongoose';
import { normalizeSkills } from '../utils/skillNormalizer.js';

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    company: { type: String, trim: true, maxlength: 150, default: '' },
    skills: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one skill is required',
      },
    },
    skillsLower: { type: [String], default: [] },
    experienceLevel: { type: Number, required: true, min: 0, max: 50 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    cityLower: { type: String, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: ['open', 'closed', 'archived'], default: 'open', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Normalize skills to canonical names, then derive normalized search fields.
jobSchema.pre('validate', function deriveSearchFields() {
  if (Array.isArray(this.skills)) {
    this.skills = normalizeSkills(this.skills);
  }
  this.skillsLower = [
    ...new Set((this.skills || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean)),
  ];
  this.cityLower = typeof this.city === 'string' ? this.city.trim().toLowerCase() : '';
});

jobSchema.index({ skillsLower: 1 });
jobSchema.index({ cityLower: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ cityLower: 1, experienceLevel: 1 });

export const Job = mongoose.model('Job', jobSchema);

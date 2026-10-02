import mongoose from 'mongoose';
const { Schema } = mongoose;
const score = { type: Number, min: 0, max: 100, default: null };
export const profileAssessmentSchema = new Schema({
  version: String, score, assessedSources: Number, totalSources: Number, summary: String, capturedAt: Date,
  sources: [{ _id: false, id: String, label: String, status: String, score, roleAlignment: score, matchedSkills: [String], formula: String, details: [String] }],
  crossSourceSkills: [{ _id: false, skill: String, sources: [String] }],
  resumeOnlySkills: [String],
  projects: [{ _id: false, name: String, description: String, hasReadme: Boolean, url: String }],
}, { _id: false });
export const careerActionsSchema = new Schema({
  mode: { type: String, enum: ['ai_assisted', 'curated'], default: 'curated' },
  projects: [{ _id: false, title: String, skill: String, reason: String, deliverables: [String] }],
  practice: [{ _id: false, id: String, title: String, platform: String, topic: String, difficulty: String, url: String, reason: String }],
  posts: [{ _id: false, title: String, skill: String, outline: [String], draft: String }],
  note: String,
}, { _id: false });

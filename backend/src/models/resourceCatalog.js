import mongoose from 'mongoose';

const resourceCatalogSchema = new mongoose.Schema(
  {
    skill_name: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['documentation', 'course', 'practice-set', 'video'], required: true },
    verified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

resourceCatalogSchema.index({ skill_name: 1, url: 1 }, { unique: true });

export const ResourceCatalog = mongoose.model('ResourceCatalog', resourceCatalogSchema);
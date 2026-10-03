import mongoose from 'mongoose';

// Durable resume bytes for generated demo data. Real uploads keep using the
// filesystem provider; demo resumes must survive serverless cold starts and
// redeploys, so they live in MongoDB behind the storage service contract.
const resumeBlobSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true, index: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, default: 'application/pdf' },
    originalName: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
);

export const ResumeBlob = mongoose.model('ResumeBlob', resumeBlobSchema);

import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../utils/errors.js';

// Vercel serverless functions reject request bodies above 4.5 MB, so the cap is
// lowered there; other hosts keep the documented 5 MB limit.
export const MAX_RESUME_BYTES = (process.env.VERCEL ? 4 : 5) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES, files: 1 },
});

export const uploadResume = upload.single('resume');

export async function validateResumeFile(req, res, next) {
  if (!req.file) {
    throw new AppError('No resume file uploaded (field "resume")', 400, 'no_file');
  }

  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!type || type.ext !== 'pdf' || type.mime !== 'application/pdf') {
    throw new AppError('Only PDF resumes are accepted', 400, 'invalid_file_type');
  }

  next();
}

// Application resumes are optional: the student may attach a different resume,
// use the one already on their profile, or apply without one.
export const uploadApplicationResume = upload.single('resume');

export async function validateOptionalResumeFile(req, res, next) {
  if (!req.file) {
    next();
    return;
  }

  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!type || type.ext !== 'pdf' || type.mime !== 'application/pdf') {
    throw new AppError('Only PDF resumes are accepted', 400, 'invalid_file_type');
  }

  next();
}
import { AppError } from '../utils/errors.js';

let unpdfPromise;

// unpdf bundles everything it needs (no pdfjs worker file, no canvas binary),
// which is what makes PDF text extraction reliable on serverless hosts such as
// Vercel; pdf-parse's dynamic worker import is not traced into the bundle. The
// import stays lazy so parsing problems can never crash the server at startup.
async function loadUnpdf() {
  if (!unpdfPromise) {
    unpdfPromise = import('unpdf');
  }
  return unpdfPromise;
}

export async function extractResumeText(buffer) {
  try {
    const { extractText, getDocumentProxy } = await loadUnpdf();
    const document = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(document, { mergePages: true });
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) {
      throw new AppError('No readable text found in this PDF', 422, 'resume_unreadable');
    }
    return normalized;
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('resume extraction failed:', err.message);
    throw new AppError('Resume could not be read or parsed', 422, 'resume_unreadable');
  }
}
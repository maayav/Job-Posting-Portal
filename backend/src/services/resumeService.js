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

const SECTION_KEYWORDS = [
  'experience', 'employment', 'education', 'skills', 'projects', 'summary',
  'objective', 'certification', 'achievements', 'internship', 'coursework',
  'technologies', 'work history', 'qualifications',
];
const ROLE_KEYWORDS = /\b(engineer|developer|intern|analyst|designer|scientist|manager|consultant|architect|administrator|specialist)\b/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/;
const PROFILE_LINK = /(linkedin\.com|github\.com|leetcode\.com|gitlab\.com|behance\.net|dribbble\.com)/i;
const YEAR = /\b(19|20)\d{2}\b/;

// Heuristic resume detector. Weighted so ordinary resumes (including short or
// creative ones) pass while handouts, papers, and slide decks are rejected.
export function resumeSignalScore(text) {
  const lower = text.toLowerCase();
  let score = 0;
  if (EMAIL.test(text)) score += 2;
  if (PROFILE_LINK.test(text)) score += 1;
  if (PHONE.test(text)) score += 1;
  if (ROLE_KEYWORDS.test(text)) score += 1;
  const sections = SECTION_KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
  if (sections >= 2) score += 1;
  if (sections >= 4) score += 1;
  if (YEAR.test(text)) score += 1;
  const bullets = text.split('\n').filter((line) => /^\s*[-•*·]/.test(line)).length;
  if (bullets >= 3) score += 1;
  return score;
}

export const RESUME_SIGNAL_MINIMUM = 3;

export function assertLooksLikeResume(text) {
  if (text.trim().length < 120 || resumeSignalScore(text) < RESUME_SIGNAL_MINIMUM) {
    throw new AppError(
      'This PDF does not look like a resume. Upload a resume that includes your contact details, skills, education, or experience.',
      422,
      'not_a_resume'
    );
  }
}

export async function extractResumeText(buffer) {
  try {
    const { extractText, getDocumentProxy } = await loadUnpdf();
    const document = await getDocumentProxy(new Uint8Array(buffer));
    let { text } = await extractText(document, { mergePages: true });
    let normalized = typeof text === 'string' ? text.trim() : '';
    if (normalized.length < 40) {
      // Some converter-generated PDFs confuse the merged extraction path;
      // retry page by page before giving up.
      const perPage = await extractText(document, { mergePages: false });
      const pages = Array.isArray(perPage.text) ? perPage.text : [perPage.text];
      normalized = pages.map((page) => String(page ?? '').trim()).filter(Boolean).join('\n').trim();
    }
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
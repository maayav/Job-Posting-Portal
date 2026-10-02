import { AppError } from '../utils/errors.js';

export const MAX_LINKEDIN_SUMMARY_LENGTH = 10000;

export function normalizeLinkedInUrl(value) {
  const input = String(value ?? '').trim();
  if (!input) return '';

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new AppError('Enter a valid LinkedIn profile URL', 400, 'invalid_linkedin_url');
  }

  const hostname = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['linkedin.com', 'www.linkedin.com'].includes(hostname)) {
    throw new AppError('LinkedIn profile URL must use https://www.linkedin.com', 400, 'invalid_linkedin_url');
  }
  let slug;
  try { slug = decodeURIComponent(path.slice('/in/'.length)); } catch { slug = ''; }
  if (!path.startsWith('/in/') || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,199}$/u.test(slug)) {
    throw new AppError('Enter a public LinkedIn profile URL such as https://www.linkedin.com/in/example-user/', 400, 'invalid_linkedin_url');
  }

  const normalized = `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
  if (normalized.length > 500) throw new AppError('LinkedIn profile URL is too long', 400, 'invalid_linkedin_url');
  return normalized;
}

export function normalizeLinkedInSummary(value) {
  const summary = String(value ?? '').trim();
  if (summary.length > MAX_LINKEDIN_SUMMARY_LENGTH) {
    throw new AppError('LinkedIn summary must be 10,000 characters or fewer', 400, 'linkedin_summary_too_long');
  }
  // Keep user-supplied profile content as plain text, with active HTML removed.
  return summary
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

import { AppError } from '../utils/errors.js';
import { normalizeLinkedInSummary } from './linkedinService.js';

// These links identify user-supplied evidence. We never fetch arbitrary URLs.
const HOSTS = new Set(['hackerrank.com', 'www.hackerrank.com', 'codeforces.com', 'www.codeforces.com', 'codechef.com', 'www.codechef.com']);
export function normalizeCodingProfileUrl(value) {
  const input = String(value ?? '').trim();
  if (!input) return '';
  let url;
  try { url = new URL(input); } catch { throw new AppError('Enter a public HTTPS coding profile URL.', 400, 'invalid_coding_profile_url'); }
  const path = url.pathname.replace(/\/+$/, '');
  const host = url.hostname.toLowerCase();
  const validPath = host.endsWith('hackerrank.com') ? /^\/(?:profile\/)?[\w-]{1,100}$/ : host.endsWith('codeforces.com') ? /^\/profile\/[\w.-]{1,100}$/ : /^\/users\/[\w-]{1,100}$/;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS.has(host) || !validPath.test(path)) {
    throw new AppError('Use a HackerRank, Codeforces, or CodeChef profile URL.', 400, 'invalid_coding_profile_url');
  }
  return `https://${host.replace(/^www\./, '')}${path}`;
}

export function normalizeCodingSummary(value) {
  if (String(value ?? '').trim().length > 10000) throw new AppError('Coding profile text must be 10,000 characters or fewer.', 400, 'coding_summary_too_long');
  return normalizeLinkedInSummary(value);
}

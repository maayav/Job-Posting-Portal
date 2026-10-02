import { corsOptions, isAllowedOrigin } from '../config/cors.js';

function appendVary(res, values) {
  const existing = String(res.getHeader?.('Vary') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const value of values) {
    if (!existing.some((current) => current.toLowerCase() === value.toLowerCase())) {
      existing.push(value);
    }
  }
  res.setHeader('Vary', existing.join(', '));
}

// Apply the same allowlist before Vercel's database gate and health shortcut.
// Returns true when an OPTIONS request has been answered.
export function applyServerlessCors(req, res) {
  const origin = req.headers?.origin;
  const isOriginAllowed = isAllowedOrigin(origin);

  if (origin) appendVary(res, ['Origin']);
  if (isOriginAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin.replace(/\/$/, ''));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method?.toUpperCase() !== 'OPTIONS') return false;

  appendVary(res, ['Access-Control-Request-Method', 'Access-Control-Request-Headers']);
  if (isOriginAllowed) {
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(','));
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
  }
  res.statusCode = 204;
  res.end();
  return true;
}

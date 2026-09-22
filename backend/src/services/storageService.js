import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Serverless hosts (Vercel) have a read-only project filesystem; only /tmp is
// writable, and it is per-instance ephemeral. Local/Docker hosts keep using the
// project storage directory.
const STORAGE_DIR = process.env.VERCEL
  ? path.join('/tmp', 'vortex-storage')
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'storage');

export async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

export function generateStoredFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase() || '.pdf';
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
}

export async function saveResume(buffer, originalName) {
  await ensureStorageDir();
  const filename = generateStoredFilename(originalName);
  const filePath = path.join(STORAGE_DIR, filename);
  await fs.writeFile(filePath, buffer, { flag: 'wx' });
  return filename;
}

export async function deleteResume(filename) {
  if (!filename) return;
  const safe = path.basename(filename);
  const filePath = path.join(STORAGE_DIR, safe);
  await fs.rm(filePath, { force: true });
}

export async function readResume(filename) {
  const safe = path.basename(filename);
  return fs.readFile(path.join(STORAGE_DIR, safe));
}
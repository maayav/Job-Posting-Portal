import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ResumeBlob } from '../models/resumeBlob.js';

const DEFAULT_STORAGE_DIR = process.env.RESUME_STORAGE_DIR
  ? path.resolve(process.env.RESUME_STORAGE_DIR)
  : process.env.VERCEL
  ? path.join('/tmp', 'vortex-storage')
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'storage');

function safeStoredName(value) {
  const filename = String(value ?? '');
  if (!filename || filename !== path.basename(filename) || filename.includes('/') || filename.includes('\\')) {
    const error = new Error('Invalid stored resume reference');
    error.code = 'ENOENT';
    throw error;
  }
  return filename;
}

/**
 * Storage provider contract. Durable providers can be added behind this
 * interface without changing profile/application controllers. Existing local
 * references remain plain generated filenames for backward compatibility.
 */
export function createResumeStorageService(provider) {
  for (const method of ['save', 'read', 'delete']) {
    if (typeof provider?.[method] !== 'function') {
      throw new TypeError(`Resume storage provider must implement ${method}()`);
    }
  }
  return Object.freeze({
    saveResume: (buffer, originalName) => provider.save(buffer, originalName),
    readResume: (reference) => provider.read(reference),
    deleteResume: (reference) => provider.delete(reference),
    getStatus: () => provider.getStatus?.() ?? { provider: 'custom', durability: 'unknown' },
    ensureStorageDir: () => provider.ensure?.(),
  });
}

export function generateStoredFilename(originalName) {
  const ext = path.extname(String(originalName ?? '')).toLowerCase() || '.pdf';
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
}

export function createFilesystemResumeProvider({ directory = DEFAULT_STORAGE_DIR, ephemeral = Boolean(process.env.VERCEL) } = {}) {
  async function ensureDirectory() {
    await fs.mkdir(directory, { recursive: true });
  }

  return Object.freeze({
    ensure: ensureDirectory,
    async save(buffer, originalName) {
      await ensureDirectory();
      const filename = generateStoredFilename(originalName);
      await fs.writeFile(path.join(directory, filename), buffer, { flag: 'wx' });
      return filename;
    },
    async read(reference) {
      const filename = safeStoredName(reference);
      return fs.readFile(path.join(directory, filename));
    },
    async delete(reference) {
      if (!reference) return;
      const filename = safeStoredName(reference);
      await fs.rm(path.join(directory, filename), { force: true });
    },
    getStatus() {
      return {
        provider: 'filesystem',
        durability: ephemeral ? 'ephemeral' : 'host-managed',
      };
    },
  });
}

const storage = createResumeStorageService(createFilesystemResumeProvider());

// Durable references are prefixed so reads can route to MongoDB instead of the
// filesystem. Generated demo resumes use these; real uploads keep plain
// filenames for backward compatibility.
const RESUME_BLOB_PREFIX = 'db:';

export function isResumeBlobRef(reference) {
  return typeof reference === 'string' && reference.startsWith(RESUME_BLOB_PREFIX);
}

export async function saveResumeBlob(buffer, originalName = '') {
  const reference = `${RESUME_BLOB_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
  await ResumeBlob.create({
    ref: reference,
    data: buffer,
    originalName: String(originalName ?? '').slice(0, 200),
  });
  return reference;
}

// .lean() surfaces Buffer fields as BSON Binary, whose bytes live behind
// value(true); Buffer.from(binary) silently returns an empty buffer.
function asResumeBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data && typeof data.value === 'function') {
    const value = data.value(true);
    return Buffer.isBuffer(value) ? value : Buffer.from(value ?? []);
  }
  return Buffer.from(data ?? []);
}

async function readResumeBlob(reference) {
  const blob = await ResumeBlob.findOne({ ref: reference }).select('data').lean();
  if (!blob?.data) {
    const error = new Error('Stored resume blob not found');
    error.code = 'ENOENT';
    throw error;
  }
  return asResumeBuffer(blob.data);
}

async function deleteResumeBlob(reference) {
  await ResumeBlob.deleteOne({ ref: reference });
}

export const saveResume = storage.saveResume;
export const readResume = (reference) => (
  isResumeBlobRef(reference) ? readResumeBlob(reference) : storage.readResume(reference)
);
export const deleteResume = (reference) => (
  isResumeBlobRef(reference) ? deleteResumeBlob(reference) : storage.deleteResume(reference)
);
export const getResumeStorageStatus = storage.getStatus;
export const ensureStorageDir = storage.ensureStorageDir;

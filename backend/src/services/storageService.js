import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

export const saveResume = storage.saveResume;
export const readResume = storage.readResume;
export const deleteResume = storage.deleteResume;
export const getResumeStorageStatus = storage.getStatus;
export const ensureStorageDir = storage.ensureStorageDir;

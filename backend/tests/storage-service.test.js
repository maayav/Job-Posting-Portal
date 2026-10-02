import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createFilesystemResumeProvider, createResumeStorageService } from '../src/services/storageService.js';

const directories = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function temporaryStorage() {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'vortex-storage-unit-'));
  directories.push(directory);
  return createResumeStorageService(createFilesystemResumeProvider({ directory, ephemeral: true }));
}

describe('private resume storage boundary', () => {
  it('stores generated references, reads bytes and deletes through the provider contract', async () => {
    const storage = await temporaryStorage();
    const bytes = Buffer.from('%PDF-demo');
    const reference = await storage.saveResume(bytes, '../../student-name.pdf');
    expect(reference).toMatch(/^[a-f0-9]{32}\.pdf$/);
    expect(await storage.readResume(reference)).toEqual(bytes);
    await storage.deleteResume(reference);
    await expect(storage.readResume(reference)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(storage.getStatus()).toEqual({ provider: 'filesystem', durability: 'ephemeral' });
  });
  it.each(['../private.pdf', '..\\private.pdf', '/etc/passwd', ''])('refuses references outside private storage: %s', async (reference) => {
    const storage = await temporaryStorage();
    await expect(storage.readResume(reference)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { assertDisposableTestDatabase } from './test-environment.js';

export default async function globalSetup() {
  const uri = process.env.TEST_MONGO_URI;
  assertDisposableTestDatabase(uri);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  await connection.db.command({ ping: 1 });
  await connection.close();

  return async () => {
    assertDisposableTestDatabase(uri);
    const cleanup = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    try {
      await cleanup.db.dropDatabase();
    } finally {
      await cleanup.close();
    }
    const directory = process.env.TEST_RESUME_STORAGE_DIR;
    if (directory && path.dirname(directory) === tmpdir() && path.basename(directory).startsWith('vortex-test-resumes-')) {
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
}

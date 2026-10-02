import { defineConfig } from 'vitest/config';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTestDatabaseUri } from './tests/test-environment.js';

// TEST_MONGO_URI selects a local endpoint; every run gets a fresh database.
process.env.TEST_MONGO_URI = createTestDatabaseUri(process.env.TEST_MONGO_URI);
process.env.TEST_RESUME_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'vortex-test-resumes-'));

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    globalSetup: './tests/global-setup.js',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: 'forks',
    env: {
      TEST_MONGO_URI: process.env.TEST_MONGO_URI,
      TEST_RESUME_STORAGE_DIR: process.env.TEST_RESUME_STORAGE_DIR,
    },
  },
});

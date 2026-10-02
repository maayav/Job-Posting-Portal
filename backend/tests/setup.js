import { assertDisposableTestDatabase, createTestDatabaseUri } from './test-environment.js';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || createTestDatabaseUri();
assertDisposableTestDatabase(process.env.MONGO_URI);
if (process.env.TEST_RESUME_STORAGE_DIR) process.env.RESUME_STORAGE_DIR = process.env.TEST_RESUME_STORAGE_DIR;
process.env.JWT_SECRET = 'test-secret';
process.env.GITHUB_TOKEN = '';
// Drift tests need the real key (loaded from .env by dotenv); all other tests
// run with mocked AI services and a dummy key.
if (process.env.RUN_DRIFT_TEST !== '1') {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'test-key';
}
process.env.GROQ_MODEL = 'openai/gpt-oss-120b';
process.env.GROQ_FALLBACK_MODELS = 'openai/gpt-oss-20b';
process.env.EMBEDDING_MODEL = 'gemini-embedding-2';
process.env.EMBEDDING_VERSION = '2026-09';

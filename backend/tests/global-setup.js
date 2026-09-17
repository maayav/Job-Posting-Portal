process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/placement_skill_gap_test';
process.env.JWT_SECRET = 'test-secret';
// Drift runs need the real key from .env — don't poison the worker env with a dummy.
if (process.env.RUN_DRIFT_TEST !== '1') {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'test-key';
}

export default async function globalSetup() {
  const { connectDB, disconnectDB } = await import('../src/config/db.js');
  const mongoose = (await import('mongoose')).default;
  try {
    await connectDB({ retry: false });
    await mongoose.connection.db.dropDatabase();
    await disconnectDB();
  } catch (err) {
    console.error('Test DB unavailable — is dockerized MongoDB running?', err.message);
    process.exit(1);
  }
}

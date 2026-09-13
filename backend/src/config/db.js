import mongoose from 'mongoose';
import { env } from './env.js';

const MAX_POOL_SIZE = 10;
const MAX_STARTUP_ATTEMPTS = 5;

export async function connectDB({ retry = true } = {}) {
  const attempts = retry ? MAX_STARTUP_ATTEMPTS : 1;
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      await mongoose.connect(env.MONGO_URI, {
        maxPoolSize: MAX_POOL_SIZE,
        serverSelectionTimeoutMS: 5000,
      });
      return mongoose.connection;
    } catch (err) {
      if (attempt >= attempts) {
        throw err;
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.error(`MongoDB connection attempt ${attempt} failed, retrying in ${delay}ms:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export { MAX_POOL_SIZE };
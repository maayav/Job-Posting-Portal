import app from './src/app.js';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import { ensureStorageDir } from './src/services/storageService.js';

async function start() {
  try {
    await connectDB();
    await ensureStorageDir();
    app.listen(env.PORT, () => {
      console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
import app from './src/app.js';
import { env } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { ensureStorageDir } from './src/services/storageService.js';

const HOST = '0.0.0.0';

async function start() {
  try {
    await connectDB();
    await ensureStorageDir();

    const server = app.listen(env.PORT, HOST, () => {
      console.log(`Vortex API listening on ${HOST}:${env.PORT} (${env.NODE_ENV})`);
      if (!env.CLIENT_URL) {
        console.warn('[config] CLIENT_URL is not set — the deployed frontend origin will be blocked by CORS.');
      }
    });

    // Render and other PaaS platforms send SIGTERM before replacing a container.
    async function shutdown(signal) {
      console.log(`${signal} received — closing server.`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 10000).unref();
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
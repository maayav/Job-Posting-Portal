import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { isAllowedOrigin } from '../src/config/cors.js';

// Vercel Node.js serverless entry point. The Express app is itself a valid
// (req, res) handler, but the serverless runtime never runs server.js, so the
// MongoDB connection must be established (and cached across invocations) here.
let connectionPromise;

function ready() {
  if (!connectionPromise) {
    connectionPromise = connectDB({ retry: false }).catch((error) => {
      connectionPromise = undefined; // allow the next invocation to retry
      throw error;
    });
  }
  return connectionPromise;
}

export default async function handler(req, res) {
  try {
    await ready();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    // Attach CORS headers here too so the browser can read this error instead of
    // reporting an opaque CORS failure.
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.status(503).json({ error: 'service_unavailable', message: 'Database is temporarily unavailable. Please retry.' });
    return;
  }
  app(req, res);
}

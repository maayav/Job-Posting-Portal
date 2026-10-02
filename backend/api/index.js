import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { applyServerlessCors } from '../src/middleware/serverlessCors.js';
import { reconcileAnalysisJobs } from '../src/services/analysisService.js';
import { withRequestBudget, withinRequestBudget } from '../src/utils/requestBudget.js';

// Vercel Node.js serverless entry point. The Express app is itself a valid
// (req, res) handler, but the serverless runtime never runs server.js, so the
// MongoDB connection must be established (and cached across invocations) here.
let connectionPromise;

function ready() {
  if (!connectionPromise) {
    connectionPromise = connectDB({ retry: false }).then(async (connection) => {
      await reconcileAnalysisJobs();
      return connection;
    }).catch((error) => {
      connectionPromise = undefined; // allow the next invocation to retry
      throw error;
    });
  }
  return connectionPromise;
}

async function handleRequest(req, res) {
  const revision = process.env.VERCEL_GIT_COMMIT_SHA;
  if (revision && /^[a-f0-9]{40}$/i.test(revision)) res.setHeader('X-Vortex-Revision', revision);
  // Vercel's health shortcut runs before Express (and its CORS middleware), so
  // handle browser preflight/CORS here without making health depend on MongoDB.
  const isPreflight = applyServerlessCors(req, res);
  if (isPreflight) return;

  // Health must answer even when the database is unreachable.
  if (req.url?.split('?')[0] === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  try {
    await withinRequestBudget(() => ready());
  } catch (error) {
    console.error('Database readiness failed:', { name: error.name, code: error.code });
    res.status(503).json({ error: 'service_unavailable', message: 'Database is temporarily unavailable. Please retry.' });
    return;
  }
  app(req, res);
}

export default async function handler(req, res) {
  return withRequestBudget(async () => {
    // Keep the shared clock alive through asynchronous Express controllers and
    // cold-start DB readiness, until the response actually finishes.
    const responseFinished = new Promise((resolve) => {
      const finish = () => {
        res.removeListener('finish', finish);
        res.removeListener('close', finish);
        resolve();
      };
      res.once('finish', finish);
      res.once('close', finish);
    });
    await handleRequest(req, res);
    if (!res.writableFinished && !res.destroyed) await responseFinished;
  });
}

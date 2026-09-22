import app from '../src/app.js';

// Vercel Node.js serverless entry point. The Express app is itself a valid
// (req, res) handler, so exporting it is enough; vercel.json rewrites every
// path to this function.
export default app;

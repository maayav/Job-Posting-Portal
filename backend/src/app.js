import express from 'express';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import analyzeRoutes from './routes/analyze.routes.js';
import reportRoutes from './routes/report.routes.js';
import userRoutes from './routes/user.routes.js';
import jobRoutes from './routes/job.routes.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import analyzeRoutes from './routes/analyze.routes.js';
import reportRoutes from './routes/report.routes.js';
import userRoutes from './routes/user.routes.js';
import jobRoutes from './routes/job.routes.js';
import roleRoutes from './routes/role.routes.js';
import applicationRoutes from './routes/application.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import assistantRoutes from './routes/assistant.routes.js';

const app = express();

// Vercel (and other reverse proxies) forward the client IP in X-Forwarded-For;
// express-rate-limit needs the proxy trust setting to identify clients correctly.
if (process.env.VERCEL || env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(cors(corsOptions));
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
app.use('/api/roles', roleRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/assistant', assistantRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

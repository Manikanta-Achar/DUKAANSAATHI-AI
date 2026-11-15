import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { connectDB } from './config/db.js';
import udhaarRoutes from './routes/udhaarRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { requireAuth, csrfProtection, sessionToken } from './middleware/auth.js';
import { seedDatabase } from './services/dataService.js';
import { getUdhaar } from './controllers/udhaarController.js';
import { sendApiError } from './utils/apiErrors.js';

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) });
const app = express();
const origins = [process.env.CLIENT_URL, process.env.FRONTEND_URL].filter(Boolean).join(',').split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean);
const allowedOrigins = new Set(['http://localhost:5173', ...origins]);
if ((process.env.VERCEL || process.env.NODE_ENV === 'production') && !origins.length) console.error('Configuration error: CLIENT_URL must contain the frontend origin.');
app.disable('x-powered-by');
app.set('etag', false);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(Object.assign(new Error('Origin is not allowed.'), { statusCode: 403 }));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-CSRF-Token', 'Idempotency-Key', 'Cache-Control'],
}));
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '16kb' }));
app.get('/', (_req, res) => res.json({ success: true, status: 'healthy', message: 'DukaanSaathi AI backend running' }));
app.get('/api/health', (_req, res) => res.json({ success: true, status: 'healthy' }));
app.use('/api', async (req, res, next) => {
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.get('X-Requested-With') !== 'XMLHttpRequest' || !req.is('application/json'))) {
      return res.status(403).json({ success: false, message: 'Use an authenticated JSON request.' });
    }
    if (!['/auth/register', '/auth/login'].includes(req.path) && !sessionToken(req)) return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    await connectDB();
    next();
  } catch (error) { next(error); }
});
app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, csrfProtection);
app.get('/api/customers', getUdhaar);
app.use('/api/udhaar', udhaarRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/transactions', transactionRoutes);
app.post('/api/seed', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return res.status(403).json({ success: false, message: 'Demo seeding is disabled on hosted deployments.' });
  try { res.json({ success: true, ...await seedDatabase(req.user._id) }); }
  catch (error) { next(error); }
});
app.use((_req, res) => res.status(404).json({ success: false, message: 'Endpoint not found.' }));
app.use((error, _req, res, _next) => sendApiError(res, error));

// Importing the Vercel handler or the test app must not bind a listening socket.
if (!process.env.VERCEL && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(process.env.PORT || 5000, () => console.log('DukaanSaathi AI server listening.'));
}
export default app;

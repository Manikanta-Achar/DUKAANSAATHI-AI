import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import udhaarRoutes from './routes/udhaarRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import { seedDatabase } from './services/dataService.js';
import { getUdhaar } from './controllers/udhaarController.js';
import { sendApiError } from './utils/apiErrors.js';

dotenv.config();

const app = express();
const configuredFrontendOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set(['http://localhost:5173', ...configuredFrontendOrigins]);

app.set('etag', false);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS.');
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// Health check
app.get('/', (_req, res) =>
  res.json({
    status: 'healthy',
    message: 'DukaanSaathi AI backend running',
    version: '1.0.0',
    tagline: 'Speak. Record. Manage. — Your Shop, Your Voice.',
  })
);

// API responses are always fresh; API writes and reads must use the same persistent source.
app.use('/api', async (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  try {
    await connectDB();
    next();
  } catch (error) {
    return sendApiError(res, error, 503);
  }
});

// Core API Routes
app.get('/api/customers', getUdhaar);
app.use('/api/udhaar', udhaarRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/transactions', transactionRoutes);

// Explicit Seed Endpoint for Demo
app.post('/api/seed', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return res.status(403).json({ success: false, message: 'Demo seeding is disabled on hosted deployments.' });
  }
  try {
    const { force = false } = req.body || {};
    const result = await seedDatabase(force);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
});

// Centralized error handler
app.use((err, _req, res, _next) => {
  return sendApiError(res, err, 500);
});

const port = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🚀 DukaanSaathi AI Server running on http://localhost:${port}`);
  });
}

export default app;

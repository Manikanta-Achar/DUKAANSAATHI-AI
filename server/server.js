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

dotenv.config();

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// Reuse a connection attempt per warm instance, but retry after failures.
let dbPromise = null;
const initDb = () => {
  if (!dbPromise) {
    dbPromise = connectDB().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
};

app.use('/api', async (_req, res, next) => {
  try {
    await initDb();
    next();
  } catch (error) {
    console.error('Database unavailable for API request:', error.message);
    res.status(503).json({
      success: false,
      message: 'Database unavailable. Please try again later.',
    });
  }
});

// Core API Routes
app.use('/api/udhaar', udhaarRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/transactions', transactionRoutes);

// Explicit Seed Endpoint for Demo
app.post('/api/seed', async (req, res) => {
  try {
    const { force = false } = req.body || {};
    const result = await seedDatabase(force);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Centralized error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

const port = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🚀 DukaanSaathi AI Server running on http://localhost:${port}`);
  });
}

export default app;

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { connectDB } from '../config/db.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
try {
  await connectDB();
  for (const name of ['customers', 'products', 'transactions']) {
    const count = await mongoose.connection.db.collection(name).countDocuments({ $or: [{ ownerId: { $exists: false } }, { ownerId: null }] });
    console.log(`${name}: ${count} unowned records preserved and excluded from shop queries.`);
  }
  console.log('Read-only audit. Obtain explicit authorization and a reviewed ID manifest before any ownership migration. See DEPLOYMENT.md.');
} catch { console.error('Legacy audit could not connect. No records changed.'); process.exitCode = 1; }
finally { await mongoose.disconnect(); }

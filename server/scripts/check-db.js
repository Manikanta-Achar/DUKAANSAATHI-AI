import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { setServers } from 'node:dns';
import { connectDB } from '../config/db.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
if (process.argv.includes('--public-dns')) {
  setServers(['1.1.1.1']);
  console.log('Using public DNS for this diagnostic process only. OS/app configuration is unchanged.');
}
// Read-only diagnostic: never load models or create indexes/collections.
const uri = process.env.MONGODB_URI || '';
console.log('Database configuration:', {
  variable: 'MONGODB_URI', present: Boolean(uri),
  placeholderCredentials: /(?:USERNAME|PASSWORD|<[^>]+>)/.test(uri),
  placeholderHost: /(?:CLUSTER\.mongodb|your[-_]cluster|cluster\.mongodb)/i.test(uri),
  frontendOriginConfigured: Boolean(process.env.CLIENT_URL || process.env.FRONTEND_URL),
});
try {
  await connectDB();
  await mongoose.connection.db.command({ ping: 1 });
  console.log('MongoDB ping succeeded. No records changed.');
} catch { console.error('MongoDB ping failed. See the safe connection category above.'); process.exitCode = 1; }
finally { await mongoose.disconnect(); }

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.MONGOMS_DOWNLOAD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../.cache/mongodb-binaries');
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
process.env.CLIENT_URL = 'http://localhost:5173';
delete process.env.VERCEL;
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
process.env.MONGODB_URI = replica.getUri('dukaansaathi_browser_test');
const { connectDB } = await import('../config/db.js');
const { default: app } = await import('../server.js');
await connectDB();
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
const server = app.listen(5001, () => console.log('Isolated browser-test API listening on port 5001.'));
const close = async () => {
  server.close();
  await mongoose.disconnect();
  await replica.stop();
  process.exit(0);
};
process.once('SIGINT', close);
process.once('SIGTERM', close);

import mongoose from 'mongoose';

const cache = globalThis.__dukaanSaathiMongoConnection ||= { promise: null };

export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    this.statusCode = 503;
  }
}

export function databaseFailureCategory(error) {
  const code = error?.code || error?.cause?.code;
  if (code === 18 || /authentication failed|bad auth/i.test(error?.message || '')) return 'authentication';
  if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL', 'ECONNREFUSED', 'ETIMEOUT'].includes(code) && /srv|dns|query/i.test(error?.message || '')) return 'dns';
  if (/certificate|tls|ssl/i.test(error?.message || '')) return 'tls';
  if (/parse|scheme|invalid.*uri/i.test(error?.message || '')) return 'configuration';
  return 'network_or_atlas_access';
}

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (cache.promise) return cache.promise;
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    console.error('MongoDB connection failed:', { category: 'configuration', variable: 'MONGODB_URI' });
    throw new DatabaseUnavailableError('A valid MONGODB_URI is required.');
  }
  cache.promise = (async () => {
    try {
      await Promise.resolve().then(() => mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, waitQueueTimeoutMS: 8000,
        maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000,
      }));
      return mongoose.connection;
    } catch (error) {
      // Categories only: driver messages can contain credentials or hosts.
      console.error('MongoDB connection failed:', { category: databaseFailureCategory(error), name: error.name, code: error.code || error.cause?.code || null });
      throw new DatabaseUnavailableError('MongoDB connection failed.');
    } finally {
      cache.promise = null;
    }
  })();
  return cache.promise;
}

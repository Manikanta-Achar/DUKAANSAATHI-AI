import mongoose from 'mongoose';

const connectionCache =
  globalThis.__dukaanSaathiMongoConnection ||
  (globalThis.__dukaanSaathiMongoConnection = { promise: null, failures: 0, retryAfter: 0 });
connectionCache.failures ||= 0;
connectionCache.retryAfter ||= 0;
mongoose.connection.on('disconnected', () => {
  connectionCache.promise = null;
});

const isHosted = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    this.statusCode = 503;
  }
}

function redactMongoUri(message, uri) {
  let safeMessage = String(message || 'Unknown MongoDB error');
  if (uri) safeMessage = safeMessage.split(uri).join('[REDACTED_MONGODB_URI]');
  return safeMessage.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[REDACTED_MONGODB_URI]');
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    if (isHosted()) {
      throw new DatabaseUnavailableError('MONGODB_URI is not configured.');
    }
    console.info('MONGODB_URI is not configured; using the development-only in-memory store.');
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    connectionCache.failures = 0;
    connectionCache.retryAfter = 0;
    return mongoose.connection;
  }
  if (Date.now() < connectionCache.retryAfter) {
    throw new DatabaseUnavailableError('MongoDB connection retry is cooling down.');
  }

  const cacheConnectionAttempt = (promise) => {
    connectionCache.promise = promise
      .then(() => {
        connectionCache.failures = 0;
        connectionCache.retryAfter = 0;
        return mongoose.connection;
      })
      .catch((error) => {
        connectionCache.promise = null;
        connectionCache.failures += 1;
        const delay = Math.min(30000, 1000 * 2 ** (connectionCache.failures - 1));
        connectionCache.retryAfter = Date.now() + delay;
        const safeMessage = redactMongoUri(error.message, uri);
        console.error('MongoDB connection failed:', {
          name: error.name,
          code: error.code || error.cause?.code || null,
          message: safeMessage,
        });
        throw new DatabaseUnavailableError('MongoDB connection failed.');
      });
  };

  if (mongoose.connection.readyState === 2) {
    if (!connectionCache.promise) {
      cacheConnectionAttempt(mongoose.connection.asPromise());
    }
  } else {
    connectionCache.promise = null;
    cacheConnectionAttempt(
      mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        minPoolSize: 0,
      })
    );
  }

  try {
    return await connectionCache.promise;
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) throw error;
    throw new DatabaseUnavailableError('MongoDB connection failed.');
  }
}

export function isDbConnected() {
  if (mongoose.connection.readyState === 1) return true;
  if (isHosted()) {
    throw new DatabaseUnavailableError('MongoDB is unavailable; persistent operations cannot continue.');
  }
  return false;
}

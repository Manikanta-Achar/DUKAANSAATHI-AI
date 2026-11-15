import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  let uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('MONGODB_URI is required in production.');
    }
    console.log('ℹ️ MONGODB_URI not provided. Running in Standalone In-Memory mode for immediate testing & demo.');
    return;
  }

  // Ensure database name is included if omitted
  if (uri.includes('.mongodb.net') && !uri.includes('.mongodb.net/')) {
    uri = uri.replace('.mongodb.net', '.mongodb.net/dukaansaathi?retryWrites=true&w=majority');
  }

  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Atlas connected successfully! Database: ${mongoose.connection.db?.databaseName || 'dukaansaathi'}`);
  } catch (err) {
    isConnected = false;
    console.warn(`⚠️ MongoDB Atlas connection notice: ${err.message}`);
    throw err;
  }
}

export function isDbConnected() {
  const connected = isConnected && mongoose.connection.readyState === 1;
  if (!connected && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
    throw new Error('MongoDB is unavailable; persistent data operations cannot continue.');
  }
  return connected;
}

import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  let uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
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
    console.warn(`⚠️ MongoDB Atlas connection notice: ${err.message}`);
    console.log('ℹ️ Running on In-Memory Store so the website and all features stay 100% functional without interruption.');
  }
}

export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

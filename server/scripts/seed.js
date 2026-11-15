import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { seedDatabase } from '../services/dataService.js';
import User from '../models/User.js';

dotenv.config();

async function runSeed() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('Usage: npm run seed -- owner@example.com (development only, empty shop only).');
  await connectDB();
  const user = await User.findOne({ email });
  if (!user) throw new Error('Register the shop owner before adding sample data.');
  const result = await seedDatabase(user._id);
  console.log(`✅ ${result.message}`);
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});

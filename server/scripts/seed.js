import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { seedDatabase } from '../services/dataService.js';

dotenv.config();

async function runSeed() {
  console.log('🌱 Starting DukaanSaathi demo seed...');
  await connectDB();
  const result = await seedDatabase(true); // force reload
  console.log(`✅ ${result.message}`);
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});

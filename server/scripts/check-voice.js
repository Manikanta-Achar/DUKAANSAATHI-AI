import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { parseShopCommand } from '../services/geminiService.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
// A fictional sample only; no shop data is sent and no database is imported.
try {
  const result = await parseShopCommand('Mahesh ko 100 rupaye udhaar do.', 'hi-IN');
  console.log('Voice interpretation diagnostic:', { engine: result.engine, action: result.action, amount: result.amount });
  if (result.action !== 'ADD_UDHAAR' || result.amount !== 100) process.exitCode = 1;
  if (!result.engine.startsWith('Google Gemini')) console.log('Gemini was not verified; the multilingual rules fallback interpreted the sample.');
} catch { console.error('Voice interpretation diagnostic failed.'); process.exitCode = 1; }

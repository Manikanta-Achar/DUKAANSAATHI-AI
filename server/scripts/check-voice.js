import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { parseShopCommand } from '../services/geminiService.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
// Fictional samples only; no shop data is sent and no database is imported.
try {
  for (const [command, language, action, amount] of [
    ['Create a new customer named Mahesh.', 'en-IN', 'CREATE_CUSTOMER', 0],
    ['Mahesh ko 100 rupaye udhaar do.', 'hi-IN', 'ADD_UDHAAR', 100],
  ]) {
    const result = await parseShopCommand(command, language);
    console.log('Voice interpretation diagnostic:', { engine: result.engine, action: result.action, amount: result.amount });
    if (result.action !== action || result.amount !== amount || result.customerName !== 'Mahesh') process.exitCode = 1;
    if (!result.engine.startsWith('Google Gemini')) console.log('Gemini was not verified; the multilingual rules fallback interpreted the sample.');
  }
} catch { console.error('Voice interpretation diagnostic failed.'); process.exitCode = 1; }

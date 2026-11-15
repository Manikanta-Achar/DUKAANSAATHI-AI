import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const directory = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (!fs.existsSync(directory)) throw new Error('Build client/dist before checking browser assets.');
const files = fs.readdirSync(directory, { recursive: true }).map((name) => `${directory}/${name}`).filter((file) => fs.statSync(file).isFile());
const secrets = ['MONGODB_URI', 'GEMINI_API_KEY', 'JWT_SECRET'].filter((key) => process.env[key]?.length >= 8);
let failures = 0;
for (const file of files) {
  const contents = fs.readFileSync(file, 'utf8');
  for (const key of secrets) {
    if (contents.includes(process.env[key])) { console.error(`Browser build contains a backend secret (${key}).`); failures += 1; }
  }
}
if (failures) process.exitCode = 1;
else console.log(`Checked ${files.length} browser assets: no configured backend secrets found.`);

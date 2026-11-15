import dotenv from 'dotenv';
import { Resolver } from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const uri = process.env.MONGODB_URI || '';
if (!uri.startsWith('mongodb+srv://')) throw new Error('SRV diagnostics require a mongodb+srv URI.');
const host = new URL(uri).hostname;
for (const [label, servers] of [['system', null], ['public DNS diagnostic only', ['1.1.1.1']]]) {
  const resolver = new Resolver({ timeout: 3000, tries: 1 });
  if (servers) resolver.setServers(servers);
  try {
    const records = await resolver.resolveSrv(`_mongodb._tcp.${host}`);
    console.log(label, { success: true, srvRecords: records.length });
  } catch (error) { console.log(label, { success: false, code: error.code }); }
}
// This never changes OS/application DNS settings or connects to a database.

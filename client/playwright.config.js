import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://localhost:5173', channel: 'chrome', headless: true },
  webServer: [
    { command: 'node ../server/scripts/e2e-server.js', url: 'http://localhost:5001/api/health', reuseExistingServer: false, timeout: 120000 },
    { command: 'npm run dev -- --host localhost --port 5173 --strictPort', url: 'http://localhost:5173', env: { VITE_API_BASE_URL: 'http://localhost:5001' }, reuseExistingServer: false },
  ],
});

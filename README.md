# DukaanSaathi AI

Voice-first udhaar and stock management for small shops, using React/Vite/Tailwind, Express, MongoDB/Mongoose, Gemini, and browser speech recognition.

The existing green-and-white Dashboard, Udhaar Ledger, Inventory, and Transaction History are preserved. Register and Login protect each shop's records.

**Local setup**

Use Node.js 22 or newer. Install both projects:

```powershell
cd server
npm ci
Copy-Item .env.example .env
cd ../client
npm ci
Copy-Item .env.example .env
```

If an `.env` already exists, edit it instead of overwriting it. Set `MONGODB_URI` to a working Atlas URI in `server/.env`. Set `CLIENT_URL=http://localhost:5173`. `GEMINI_API_KEY` enables Gemini interpretation; the existing multilingual rules remain available when Gemini is unavailable. Set `VITE_API_BASE_URL=http://localhost:5000` in `client/.env`.

Start the backend with `npm run dev` from `server`, and the frontend with `npm run dev` from `client`. Open `http://localhost:5173`, register a shop, and add a customer/product before making transactions. MongoDB is required in every environment; there is no in-memory or localStorage database fallback.

**Features**

- Shop registration, normalized unique email, bcrypt password hashing, login, session restoration, and logout.
- Customer search, active/archive tabs, editing, restoring, unused-customer deletion, and automatic archiving when financial history exists.
- Credit, repayment, inventory adjustments, cash sales through the stock API, and safe audited reversals.
- Dashboard totals include archived debt; sales exclude repayments and reversed entries. Activity uses India calendar dates.
- Paginated history with server-side search and transaction filters.
- Hindi, Kannada, and English speech or text interpretation. Every write needs preview confirmation; AI never executes database commands.
- Owner-scoped queries, CSRF protection, persistent authentication rate limits, atomic ledger/history writes, and idempotency for financial requests.

**Validation**

```powershell
cd server
npm test
npm run check:db
npm run check:dns
cd ../client
npm run build
npm run test:e2e
```

Backend and browser tests create their own temporary MongoDB replica sets and never use the configured Atlas URI. The first run downloads MongoDB 7.0.24. Browser tests use installed Google Chrome (`channel: 'chrome'`); install Chrome or adjust the channel in `client/playwright.config.js`. They reserve local ports 5001 and 5173. Database diagnostics perform only DNS lookups and a MongoDB ping.

Optional sample data is explicit and development-only: register an account, then use **Add Demo** on an empty shop, or run `npm run seed -- owner@example.com` from `server`. It never resets or deletes records and refuses nonempty shops.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the two-project Vercel setup, Atlas access, cookie verification, and the legacy-data migration procedure. See [FIX_REPORT.md](FIX_REPORT.md) for root causes, changed files, validation, and remaining verification limits.

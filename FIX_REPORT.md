# DukaanSaathi AI repair report

Completed locally on November 15, 2026. Existing Dashboard, Udhaar Ledger, Inventory, History, and green-and-white styling were retained. Register and Login were added. No production customer records were written, migrated, or deleted; no commit, push, or deployment was performed.

**1. Root causes and changes**

| Issue | Evidence and repair |
| --- | --- |
| MongoDB unavailable | The local Atlas SRV lookup fails with `ECONNREFUSED` using the system resolver. A public resolver returns three SRV records, and the same URI successfully pings Atlas when used by the optional diagnostic-only DNS flag. This is a verified local DNS problem, rather than evidence that the credentials are invalid. The old Vercel outage's infrastructure cause cannot be determined without its environment/logs/Atlas access settings. Connection code now shares a global pending connection, reuses warm pools, always awaits connection, clears failed promises including synchronous failures, and reports safe failure categories. |
| Fake or disappearing development data | The old development service switched between MongoDB and process-local memory, auto-populating demo records. Those memory records never persisted across process restarts; hosted mode already rejected unavailable persistent operations. The service now requires MongoDB in every environment and returns 503 during an outage. No localStorage fallback was introduced. Demo data is explicit, owner-scoped, development-only, and append-only into an empty shop. |
| Customer CORS failures | `refreshCustomers` sent a `Cache-Control` request header that the backend did not allow in preflight. Production origins depended on `FRONTEND_URL`, which was absent locally; deployed settings were inaccessible. The new CORS configuration supports `CLIENT_URL`, its old alias, explicit localhost, credentials, OPTIONS, and all actual application headers. The unnecessary cache request header was removed. Allowed-origin errors retain CORS headers. |
| Customer lists and counts disagree | The shared customer array contained whichever search/status request finished last. `refreshAll()` refetched active customers, potentially replacing an archived/search view; sidebar totals came from a separate dashboard request. The context now stores all owned customers; tabs/search filter locally; sidebar and tab counts use that same list. Request ordering protects both data and loading state. The preexisting MongoDB `$ne: true` compatibility for missing archive fields was preserved and tested. |
| Customer returns after deletion | Local in-memory operations did not survive process refresh; in the old seed path an emptied store could also repopulate. Existing deletion/archive logic is now MongoDB-only, owner-scoped, transaction-safe, and verified before success. Unused customers are deleted; any history or debt triggers archiving. History stays intact, restore persists, and archived financial operations are rejected. The confirmation/refetch UI was retained. |
| Repayment and reversal errors | `Math.max(0, balance - amount)` silently accepted overpayment, and read/save/history operations were separate writes. Concurrent updates could lose balances or leave history out of sync. MongoDB transactions now commit the balance/stock, audit entry, and idempotent response together. Overpayments, negative stock, unsafe reversals, invalid decimals, and duplicate request IDs with changed payloads are rejected. Concurrent repayments and replay are tested. |
| Inventory errors | Update accepted arbitrary body fields without an owner allowlist/validation; stock saves and audit entries were separate; `Number(threshold) || 5` discarded a valid zero. Updates now allow only product fields and validate them, adjustments are atomic and owner-scoped, editor quantity changes get an audit record, threshold zero survives, and products with history cannot be deleted underneath reversals. |
| Dashboard discrepancies | Outstanding debt was summed from active customers only, so archiving hid real debt. Chart boundaries mixed UTC and server-local dates. Dashboard debt now includes archived customers, active counts stay separate, and seven-day activity uses India calendar dates. Cash sales remain separate from repayments and exclude reversed entries. |
| History omissions and HTTP errors | The history API defaulted to a limited result with no pagination. Search/type filters and page navigation now work on the server. Existing write controllers classified unexpected errors as 400; unclassified write failures now return 500, validation errors 400, outages 503, conflicts 409, and inaccessible IDs 404. HTTP 304 was not itself a failure; authenticated APIs now explicitly disable storage/caching. |
| Voice reliability and Gemini | The old model `gemini-2.5-flash` returned HTTP 400 in a live fictional-command check. The supported configurable `gemini-3.5-flash-lite` replacement successfully returned `ADD_UDHAAR`, amount 100, using the existing key. JSON output is validated, provider calls have a timeout, and safe status/category logs identify failures. Existing fallback rules remain visible in the engine label; generic product names no longer invent brands, outstanding queries are recognized, Hindi-script/numeral support is extended, and negative spoken amounts need clarification. Execution requires explicit confirmation, owner-scoped lookups, CSRF, and an idempotency key. |
| Authentication and isolation absent | No User, session middleware, login/register pages, or ownership fields existed. All business routes were public and queried shared collections. These are now protected by persistent sessions and `ownerId` scope derived from the verified session; forged body owner IDs cannot change ownership. Unowned legacy records remain untouched and hidden. |
| Deployment configuration drift | The client could fall back to a hardcoded hosted API/legacy variable, and authenticated cross-site cookies were not configured. Production now uses `VITE_API_BASE_URL=/` and an external `/api` rewrite before the SPA rewrite. The backend exports the Vercel handler without binding a listener on import. Exact configuration and browser verification steps are in [DEPLOYMENT.md](DEPLOYMENT.md). |

Google's model status and replacement are documented in its [deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations). No conclusion about Vercel's old MongoDB outage is presented as a verified fact. The historical production deletion symptom was not reproduced by modifying real records; the reproducible local fallback/persistence issue and the shared-list race were repaired and tested in isolation.

**2. Registration, login, and security**

`Register.jsx` and `Login.jsx` reuse a shared form styled with the application's existing Tailwind palette and Lucide icons. Registration accepts full name, shop name, normalized email, password, and confirmation. Passwords require at least ten characters, uppercase, lowercase, a number, and no more than 72 UTF-8 bytes. bcrypt cost 12 hashes the password; a unique normalized email index handles races and duplicates. Errors, loading, login/register links, and Dashboard navigation are implemented.

`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout` share consistent JSON responses. Login issues an eight-hour opaque session. MongoDB stores the SHA-256 hash of a random 256-bit session ID; the browser receives an HttpOnly cookie. Hosted cookies add Secure and the `__Host-` prefix, with SameSite=Lax for the frontend proxy. The CSRF token is held only in React/module memory and restored by `/me`. Session expiry is checked on every request even before the MongoDB TTL cleanup runs. Logout deletes the active server session; copied cookies stop working. There is no JWT secret or localStorage token.

All business APIs require authentication; mutating routes additionally require a CSRF token, JSON content type, and a custom request header. Login/registration use MongoDB-backed IP and email rate limits, so warm/cold instances share attempt counts. Only trusted origins receive CORS access. All data CRUD, history, aggregates, archives, restores, reversals, and voice queries include the authenticated owner. Input allowlists prevent owner/balance/operator injection. API errors redact secrets and server errors do not expose internal exception messages.

Customer/Product/Transaction model names and existing balance field `totalUdhaar` were retained. New `ownerId` indexes do not reassign existing records. [DEPLOYMENT.md](DEPLOYMENT.md) describes a backup, reviewed manifest, explicit target-owner authorization, transactional ownership update, and verification procedure for any later migration. The included audit script is read-only. No ownership-writing migration was run.

The unused browser Gemini SDK was removed. Backend password hashing is the only new runtime dependency. Tests use mongodb-memory-server and Playwright as development dependencies. Node's built-in watch mode replaces nodemon, eliminating the reported vulnerable minimatch development dependency.

**3. Validation**

| Check | Result |
| --- | --- |
| `cd server; npm test` | 32 tests passed, zero failed. Runs against a temporary MongoDB 7.0 replica set and imports the actual Vercel handler. Covers auth/duplicate/invalid credentials/session refresh/expiry/logout, CORS/CSRF, legacy archive compatibility, persistence/delete/archive/restore, 100 credit minus 40 repayment = 60, stock 20 minus 5 = 15, owner isolation across IDs and voice, concurrent repayments, duplicate financial retries, history rollback, reversal guards, pagination, rate limits, outage 503, warm connection reuse, and failed promise retries. |
| `cd client; npm run test:e2e` | Two Chrome tests passed: full registration → refresh → customer/credit/repayment → archive/restore → inventory/reduction → confirmed voice → logout/login workflow; mobile Login/Register layout. No browser page exceptions in the full workflow. |
| `cd client; npm run build` | Production Vite build passed. |
| `cd server; npm audit` | Zero known dependency vulnerabilities after replacing nodemon. Frontend installation audit also reported zero. |
| `cd server; npm run check:db` | Fails at local system DNS resolution; this remains a local environment issue. |
| `cd server; npm run check:dns` | System resolver refused SRV lookup; public resolver found three records. |
| `cd server; npm run check:db -- --public-dns` | Atlas ping passed, without loading models or changing records. |
| `cd server; npm run check:voice` | Live Gemini sample passed with the replacement model: ADD_UDHAAR, amount 100. |
| Secret/build and diff checks | `check:client-build` checks generated assets for configured backend secret values without printing them. `git diff --check` checks whitespace. Only `.env.example` files are tracked. |

Initial checks found and corrected a model-initialization error caused by globally disabling Mongoose buffering, a synchronous failed-promise retry edge case, and unexpected write errors being incorrectly classified as 400. Initial browser failures were mismatched test selectors for the existing buttons/cards; final browser tests pass. An initial sandbox download block was resolved for the isolated test binary. The remaining unsuccessful check is the default-resolver Atlas ping described above, not an application test failure.

Microphone hardware, live spoken recognition quality, Vercel's production cookie forwarding/CORS/env configuration, and the deployed frontend/backend remain unverified. The browser test submits typed voice commands through the same preview/confirmation APIs. No production deployment was authorized.

**4. Required configuration and push commands**

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for exact Vercel settings, Atlas checks, local DNS diagnosis, production browser steps, and migration approval requirements. Required values are backend `MONGODB_URI`, `CLIENT_URL`, `NODE_ENV=production`, `GEMINI_API_KEY`, optional `GEMINI_MODEL=gemini-3.5-flash-lite`, `COOKIE_SAME_SITE=lax`; frontend `VITE_API_BASE_URL=/`. Verify the backend hostname in the frontend rewrite. Do not use secrets in `VITE_` variables.

Once you review and approve, from the repository root:

```powershell
git status --short
git diff --check
git add .gitignore README.md DEPLOYMENT.md FIX_REPORT.md client server
git diff --cached --name-only
git commit -m "Fix MongoDB persistence and add secure shop authentication"
git push origin main
```

These commands have not been executed.

**5. All changed and added files**

- Root: `.gitignore`, `README.md`, `DEPLOYMENT.md`, `FIX_REPORT.md`.
- Client configuration/dependencies: `client/.env.example`, `client/package.json`, `client/package-lock.json`, `client/vercel.json`, `client/playwright.config.js`.
- Client routing/API/context: `client/src/App.jsx`, `client/src/api/api.js`, `client/src/context/AuthContext.jsx`, `client/src/context/ShopContext.jsx`.
- Client components: `client/src/components/AuthForm.jsx`, `client/src/components/ConfirmationModal.jsx`, `client/src/components/Navbar.jsx`, `client/src/components/Sidebar.jsx`, `client/src/components/VoiceAssistant.jsx`.
- Client pages: `client/src/pages/Login.jsx`, `client/src/pages/Register.jsx`, `client/src/pages/Udhaar.jsx`, `client/src/pages/Inventory.jsx`, `client/src/pages/History.jsx`.
- Client tests: `client/test/auth-workflow.spec.js`.
- Server configuration/dependencies: `server/.env.example`, `server/package.json`, `server/package-lock.json`, `server/vercel.json`, `server/server.js`, `server/config/db.js`.
- Server controllers/routes/middleware: `server/controllers/dashboardController.js`, `server/controllers/inventoryController.js`, `server/controllers/udhaarController.js`, `server/controllers/voiceController.js`, `server/routes/authRoutes.js`, `server/routes/transactionRoutes.js`, `server/middleware/auth.js`.
- Server models: `server/models/User.js`, `server/models/Session.js`, `server/models/RateLimit.js`, `server/models/Operation.js`, `server/models/Customer.js`, `server/models/Product.js`, `server/models/Transaction.js`.
- Server services/utilities: `server/services/dataService.js`, `server/services/geminiService.js`, `server/services/seedData.js`, `server/utils/validation.js`, `server/utils/apiErrors.js`.
- Server scripts: `server/scripts/seed.js`, `server/scripts/audit-legacy.js`, `server/scripts/check-db.js`, `server/scripts/check-dns.js`, `server/scripts/check-voice.js`, `server/scripts/check-client-build.js`, `server/scripts/e2e-server.js`.
- Server tests: `server/test/workflow.test.js`, `server/test/connection.test.js`.

Ignored installed dependencies, browser/test outputs, downloaded test database binaries, and build output are excluded from the source change list. Existing `.env` files were read only and remain untracked.

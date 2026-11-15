# Deployment and existing data

Changes are local. No Git push, deployment, database migration, or production data writes were performed.

**1. Backend Vercel project**

1. Open the existing backend project → Settings → Build and Deployment. Set Root Directory to `server`, Framework Preset to Other, Install Command to `npm ci`, and leave custom Build Command and Output Directory unset. Choose Node.js 22 or newer under Settings → Functions/Node.js Version.
2. `server/vercel.json` builds `api/index.js` and routes API requests to that handler. Importing it does not start a listening server. Keep the repository's Vercel configuration.
3. Under Settings → Environment Variables, configure the following for Production and, if used, Preview/Development. Paste values without surrounding quotes:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas driver URI with the actual database username, URL-encoded password, host, and `/dukaansaathi` database name. Preserve your current database name if different. |
| `CLIENT_URL` | Exact frontend origin, e.g. `https://YOUR-FRONTEND.vercel.app`; no path or trailing slash. Multiple explicitly trusted origins may be comma-separated. |
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | Gemini key, backend only. If omitted, the UI identifies the rules fallback engine. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` (the default); use a currently supported text model enabled for your key. |
| `COOKIE_SAME_SITE` | `lax` for the recommended frontend proxy below. |

`FRONTEND_URL` remains a supported alias for old deployments, but use `CLIENT_URL` going forward. `JWT_SECRET` is not used: authentication uses random opaque sessions stored as SHA-256 hashes in MongoDB, rather than JWTs. `PORT` is local-only and optional.

The database user needs read/write and index-creation permissions on the application database. New session/authentication/idempotency indexes are created without deleting or resetting documents. Financial transactions require a replica set, which Atlas provides; a standalone local mongod is insufficient.

**2. Frontend Vercel project**

1. Keep Root Directory `client`, Framework Preset Vite, Install Command `npm ci`, Build Command `npm run build`, Output Directory `dist`.
2. Set **`VITE_API_BASE_URL=/`** for Production. Remove obsolete `VITE_API_URL`; the frontend now reads `VITE_API_BASE_URL`. Use `http://localhost:5000` only in local development. Do not append `/api` to the base URL.
3. `client/vercel.json` forwards `/api/:path*` to `https://dukaansaathi-api.vercel.app/api/:path*`, the backend hostname already present in this repository's local configuration. If your backend's actual production alias differs, replace that hostname in the rewrite before deployment. Keep the SPA `/index.html` rewrite after the API rewrite so `/login`, `/register`, `/udhaar`, `/inventory`, and `/history` work after refresh.
4. Set Preview API routing/origins explicitly if previews use a different backend. Do not allow arbitrary `*.vercel.app` origins.
5. Do not add MongoDB, Gemini, session, or password secrets to any `VITE_` variable. These variables become public browser code.

The recommended arrangement keeps two Vercel projects but sends browser API calls through the frontend origin. Vercel supports external API forwarding via [rewrites](https://vercel.com/docs/routing/rewrites). This avoids relying on third-party cookies between separate Vercel domains. Production cookies are host-only `__Host-dukaansaathi`, HttpOnly, Secure, Path=/, SameSite=Lax, with an eight-hour absolute expiry. Mutations also require an in-memory CSRF token and a JSON/custom-header request. Cookie session guidance: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

If you deliberately call a different origin directly, `withCredentials` is already enabled, CORS must list the frontend's exact origin, and the backend supports `COOKIE_SAME_SITE=none` over HTTPS. Browser third-party-cookie policies can still block it. Use the proxy for reliable browser authentication.

Once deployment is authorized, deploy the backend first and then the frontend after saving the environment variables. Environment changes require a new deployment. No deployment was initiated here.

**3. MongoDB Atlas manual checks**

1. In Atlas, open the correct project and check that its database deployment is running and not paused.
2. Open Security → Database & Network Access → Database Users. Verify the URI's **database user**, its password, and access to the application database. Atlas account credentials are different. Percent-encode special characters in the URI's username/password; preserve the Atlas-generated host and query options. See [Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).
3. Open IP Access List/Network Access. Add your current public IP for local development. For Vercel, allowlist the backend's actual egress addresses if your project has Static IPs or Secure Compute; your laptop IP does not allow Vercel traffic. See [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/) and [Vercel Static IPs](https://vercel.com/changelog/static-ips-are-now-available-for-more-secure-connectivity).
4. If your hackathon deployment uses dynamic Vercel egress and no static network option, Atlas's Add IP Address → Allow Access From Anywhere creates `0.0.0.0/0`. That explicitly permits connection attempts from all IPv4 addresses; decide this scope yourself, use a strong database password and a database-scoped user, and prefer a temporary entry. No network access rules were changed by this task.
5. Re-run `npm run check:db` from `server` after configuration. Logs distinguish configuration, authentication, DNS, TLS, and network/Atlas-access failures without printing the URI.

Local diagnosis on November 15, 2026: the system DNS resolver returned `ECONNREFUSED` for the Atlas SRV lookup. A public resolver found three SRV records. `npm run check:db -- --public-dns` then successfully pinged the configured Atlas cluster. This proves the configured credentials and cluster are reachable from this machine when the DNS issue is bypassed. It does not verify Vercel's environment or allowlist. The optional flag changes DNS only within that diagnostic process; no OS or application DNS setting was changed. Repair the local resolver, VPN, or firewall as appropriate instead of hardcoding public DNS into production.

**4. Verify authentication in the deployed browser**

After an authorized deployment:

1. Open the frontend and DevTools → Network. Requests must go to `https://YOUR-FRONTEND/api/...`. `/api/health` should return JSON, not `index.html`.
2. Register a new test shop. Confirm register returns 201 and sets the production cookie on the **frontend host**. It must have HttpOnly, Secure, SameSite=Lax, Path=/, no Domain attribute, and an eight-hour expiry. Password hashes and session IDs must not appear in response JSON.
3. Refresh the Dashboard and a direct `/udhaar` URL. `/api/auth/me` should restore the user and return a fresh usable CSRF token. The session ID stays in the HttpOnly cookie.
4. Add isolated test customer Mahesh, credit 100, repay 40, and verify 60 after refresh. Add Milk with quantity 20, reduce by 5, and verify 15. Confirm voice previews before saving. Check archived tabs and sidebar counts after opening the global voice modal.
5. Register a second isolated account in another browser profile. Verify its shop lists and totals are empty and it cannot read/update the first account's IDs.
6. Log out, verify the cookie is cleared and `/api/auth/me` returns 401, and verify a saved copy of that session cookie is also rejected.
7. Allowed-origin OPTIONS requests should return 204 with the explicit origin, credentials, and Content-Type/X-Requested-With/X-CSRF-Token/Idempotency-Key headers. Outage responses to allowed origins must keep CORS headers and return 503. Authenticated API responses are `no-store`; previous 304 responses alone were not proof of a server error.

Production browser/cookie forwarding, production CORS configuration, and Vercel logs remain unverified until the configured projects are deployed and inspected. Local browser tests exercise the same cookie/session workflow over HTTP with development cookie settings. A live fictional-command diagnostic succeeded with the existing Gemini key after replacing the old model: `gemini-3.5-flash-lite` returned `ADD_UDHAAR`, amount 100. Calls to the former `gemini-2.5-flash` returned HTTP 400. The multilingual fallback also works and is visibly identified as the fallback engine. Run `npm run check:voice` after configuring Vercel's key/model. The model is configurable because Google now marks `gemini-2.5-flash` deprecated; the default follows its recommended `gemini-3.5-flash-lite` replacement in [Google's deprecation documentation](https://ai.google.dev/gemini-api/docs/deprecations).

**5. Existing records and explicit migration strategy**

No ownerless document is assigned on registration. Every shop query requires the verified session's `ownerId`; legacy records remain preserved and inaccessible to new users. Run `npm run audit:legacy` for a read-only count when you want to review them.

Before any migration, obtain explicit authorization naming the target registered user's normalized email and the exact customer/product/transaction IDs to transfer. Take an Atlas backup/export, review an ID manifest and expected document counts, and reject manifests containing records already owned by anyone. Include every referenced customer/product for the chosen transactions; do not create cross-owner references. Validate balances and stock against approved historical records.

Apply the approved manifest in a MongoDB transaction with conditional `ownerId`-missing/null filters, verify matched/modified counts, and set ownership only. Do not change balances, dates, IDs, history, or delete anything. Verify each collection afterward from the intended account and a second account. Preserve the manifest and before/after ownership audit for rollback. This task implements the read-only audit and isolation; an ownership-writing migration must be prepared and authorized separately. No migration or deletion was attempted.

**6. Review, commit, and push when you approve**

From the repository root, review the diff and ensure `.env`, caches, binaries, and test outputs remain ignored:

```powershell
git status --short
git diff --check
git diff
git add .gitignore README.md DEPLOYMENT.md FIX_REPORT.md client server
git diff --cached --name-only
git commit -m "Fix MongoDB persistence and add secure shop authentication"
git push origin main
```

The current branch is `main`. These commands are provided for you; no commit or push was made. Do not push/deploy until you have reviewed and approved the changes.

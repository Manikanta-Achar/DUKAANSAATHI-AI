# DukaanSaathi AI

### Voice-First Udhaar & Inventory Management for Small Shops

**Speak naturally. Manage customer credit, stock, and sales. Keep your shop records organized.**

DukaanSaathi AI is a full-stack, AI-assisted shop management platform designed to help small retailers and local shopkeepers manage customer credit (*udhaar*), inventory, repayments, and transaction history through a simple digital interface.

It supports voice and text commands in **Kannada, Hindi, and English**, helping shopkeepers record transactions without manually navigating complicated forms.

The application uses React, Express.js, MongoDB, and optional Google Gemini integration. Financial operations require user confirmation before changes are saved.

---

## 1. Problem Statement

Many small retail shops still maintain customer credit, stock records, and daily transactions using physical notebooks or manual registers.

This approach creates several problems:

- Difficulty tracking outstanding customer credit.
- Risk of forgotten repayments and inaccurate balances.
- Time-consuming manual transaction entry.
- Poor visibility into inventory and sales.
- Difficulty searching historical transactions.
- Language and usability barriers with complex software.
- Risk of inconsistent records when transactions are corrected.

Small shopkeepers need an accessible, reliable, and easy-to-use system to manage daily business operations.

## 2. Our Solution

**DukaanSaathi AI** provides a centralized platform for managing shop operations with a voice-first experience.

Shopkeepers can register their shops, manage customers, record udhaar, update inventory, track sales, and review transaction history.

Its multilingual command interpretation converts spoken or typed requests into structured actions for the user to review.

**Important:** AI interprets requests but never directly executes database operations. The shopkeeper must confirm every write operation.

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| AI Integration | Google Gemini API (optional) |
| Voice Interface | Browser Speech Recognition |
| Authentication | bcrypt, authenticated sessions |
| Testing | Backend automated tests, Playwright browser tests |
| Development | Git, GitHub, npm |

## 4. Key Features

### Authentication and Shop Isolation

- Shop registration and login.
- Unique normalized email addresses.
- Secure password hashing using bcrypt.
- Session restoration and logout.
- Shop-specific access to customer, stock, and financial records.

### Udhaar Management

- Create and manage customer records.
- Record credit transactions.
- Record customer repayments.
- Track outstanding balances.
- Search customers.
- Edit and archive customer details.
- Restore archived customers.
- Preserve customers with financial history.

### Inventory Management

- Manage product records and quantities.
- Record stock adjustments.
- Process cash sales through stock operations.
- Maintain inventory-related transaction history.

### Voice-First AI Assistant

Supports:

- Kannada
- Hindi
- English

Uses browser speech recognition and optional Gemini interpretation.

Multilingual rule-based interpretation remains available when Gemini is unavailable.

Every transaction-changing command requires a preview and explicit confirmation.

### Transaction History

- Paginated history.
- Server-side transaction search.
- Transaction-type filtering.
- Credit and repayment records.
- Inventory and sales activity.
- Audited transaction reversals.

### Business Dashboard

- Customer credit overview.
- Outstanding balances.
- Sales summaries.
- Inventory information.
- Recent transactions.
- Activity grouped using India calendar dates.

Dashboard calculations include archived customer debt, exclude repayments from sales, and exclude reversed entries where applicable.

## 5. System Architecture

```text
Shopkeeper
    |
    v
React + Vite Frontend
    |
    +-- Dashboard
    +-- Udhaar Ledger
    +-- Inventory
    +-- Transaction History
    +-- Voice / Text Commands
    |
    v
Express REST API
    |
    +-- Authentication & Authorization
    +-- Customer Management
    +-- Credit & Repayment Operations
    +-- Stock & Sales Operations
    +-- Transaction History
    +-- Voice Command Interpretation
    |
    +--------------------+
    |                    |
    v                    v
MongoDB              Gemini API
Shop Records         Optional AI
Transactions         Interpretation
Inventory
```

MongoDB is required for application storage. There is no in-memory or localStorage database fallback.

## 6. Project Structure

```text
DukaanSaathi-AI/
├── client/              # React frontend
├── server/              # Express backend
├── DEPLOYMENT.md        # Deployment instructions
├── FIX_REPORT.md        # Fixes and verification report
└── README.md            # Project documentation
```

The `client` and `server` directories are independent npm projects.

## 7. Installation and Local Setup

### Prerequisites

- Node.js 22 or newer
- npm
- MongoDB Atlas or another compatible MongoDB deployment
- Google Chrome for the configured browser tests
- Gemini API key (optional)

### Step 1 — Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd DukaanSaathi-AI
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the actual repository address.

### Step 2 — Install Backend Dependencies

Open PowerShell:

```powershell
cd server
npm ci

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

### Step 3 — Configure Backend Environment

Open `server/.env`.

Configure these environment variables:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `CLIENT_URL` | Allowed frontend origin |
| `GEMINI_API_KEY` | Optional Gemini integration |

For local development:

```dotenv
CLIENT_URL=http://localhost:5173
```

Set `MONGODB_URI` to your working MongoDB Atlas URI.

Add `GEMINI_API_KEY` only if you want Gemini-powered interpretation.

Do not upload `.env` files or API credentials to GitHub.

### Step 4 — Install Frontend Dependencies

From the server directory:

```powershell
cd ../client
npm ci

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

Open `client/.env` and configure:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
```

### Step 5 — Start the Backend

Open a terminal inside `server/`:

```bash
npm run dev
```

The local backend uses:

`http://localhost:5000`

### Step 6 — Start the Frontend

Open another terminal inside `client/`:

```bash
npm run dev
```

Open:

`http://localhost:5173`

Register your shop, log in, and create a customer or product to start recording transactions.

## 8. Example User Workflow

1. Register a shop account.
2. Log in to the dashboard.
3. Add a customer.
4. Add products to inventory.
5. Record a credit transaction.
6. Record a customer repayment.
7. Use voice or text to request an operation.
8. Review the interpreted transaction preview.
9. Confirm the operation.
10. View updated customer balances, inventory, and transaction history.

Example voice request:

**"Ravi ge 200 rupees udhaar add maadi."**

Intended meaning: Add ₹200 to Ravi's credit balance.

The application interprets the command and presents a confirmation preview before applying any financial change.

Voice recognition availability and accuracy depend on the browser, microphone permissions, language support, and speech-recognition service.

## 9. Security and Data Integrity

DukaanSaathi AI includes:

- bcrypt password hashing.
- Owner-scoped database queries.
- Authentication and session management.
- CSRF protection.
- Persistent authentication rate limiting.
- Atomic financial ledger and history writes.
- Idempotency protection for financial requests.
- Audited transaction reversals.
- Explicit confirmation before write operations.

AI-generated interpretations are not treated as trusted database commands.

## 10. Testing and Verification

### Backend Tests

```powershell
cd server
npm test
```

### MongoDB Diagnostics

```powershell
npm run check:db
npm run check:dns
```

### Frontend Production Build

```powershell
cd ../client
npm run build
```

### Browser End-to-End Tests

```powershell
npm run test:e2e
```

**Testing notes:**

- Backend and browser tests use their own temporary MongoDB replica sets.
- Tests do not use the configured Atlas URI.
- The first test run downloads MongoDB 7.0.24.
- Browser tests use installed Google Chrome.
- Browser tests reserve ports 5001 and 5173.
- Database diagnostics perform DNS lookups and a MongoDB ping.
- If Chrome is unavailable, adjust the browser channel in `client/playwright.config.js`.

For actual test outcomes and verified fixes, refer to [FIX_REPORT.md](FIX_REPORT.md).

## 11. Optional Demo Data

Development-only sample data is available.

First register an account.

You can then select **Add Demo** when the shop is empty.

Alternatively, from `server/` run:

```bash
npm run seed -- owner@example.com
```

Replace the email with a registered owner account.

The demo seed process does not reset or delete existing records and refuses to populate a nonempty shop.

## 12. Deployment

The project includes documentation for a two-project Vercel deployment.

Deployment considerations include:

- Frontend and backend configuration.
- MongoDB Atlas connectivity.
- Production environment variables.
- Authentication cookie behavior.
- CSRF and cross-origin configuration.
- Legacy-data migration where required.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the actual deployment procedure.

A production deployment should be tested independently from local development, especially for authentication cookies, protected requests, and database connectivity.

## 13. Known Limitations

- MongoDB connectivity is required.
- Gemini-based interpretation requires a valid API key and available provider service.
- Browser speech recognition depends on browser compatibility and microphone permissions.
- Speech recognition and multilingual interpretation can make mistakes.
- Financial commands must always be reviewed before confirmation.
- Cloud deployment behavior must be validated separately from local test results.

## 14. Future Improvements

Potential future enhancements include:

- Offline-first transaction entry with safe synchronization.
- Customer payment reminders.
- Low-stock notifications.
- Exportable reports and statements.
- Additional Indian language support.
- Business analytics and sales forecasting.
- Barcode scanning and product search.

These are future ideas, not claims of completed functionality.

## 15. Project Documentation

- [Deployment Guide](DEPLOYMENT.md)
- [Fix and Verification Report](FIX_REPORT.md)

---

**DukaanSaathi AI — Making everyday shop management simpler through accessible, multilingual technology.**

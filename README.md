# DukaanSaathi AI — Voice-First Udhaar & Stock Assistant

> **"Speak. Record. Manage. — Your Shop, Your Voice."**

DukaanSaathi AI is a modern, responsive, voice-first web application designed specifically for Indian Kirana shopkeepers, chaiwalas, and small roadside vendors. 

Small shopkeepers are frequently busy handling customers and struggle to manually write down customer udhaar (credit), calculate repayments, count stock, and track business revenue. DukaanSaathi AI enables vendors to manage their entire shop simply by speaking natural voice commands in **Hindi**, **Kannada**, or **English**.

---

## 🚀 Key Features & 4 Core Pages

1. **Page 1: Dashboard (`/`)**
   - **Hero AI Voice Assistant Widget**: Instant voice recording with animated sound waves and quick command chips.
   - **Real-Time Key Metrics**:
     - **Total Cash Sales**: Strictly calculated from actual sales (customer repayments are never counted as sales).
     - **Outstanding Udhaar**: Sum of all active customer credit balances.
     - **Total Customers**: Active ledger accounts.
     - **Low Stock Items**: Count of inventory items at or below reorder threshold.
   - **7-Day Business Activity Chart**: Daily visual comparison of Cash Sales, Udhaar, and Repayments.
   - **Recent Transactions & Low Stock Alerts**: Instant view of the latest store activities.

2. **Page 2: Udhaar Ledger (`/udhaar`)**
   - Customer credit ledger with real-time outstanding balances.
   - Live search by customer name or phone number.
   - Add new customers with phone contact.
   - One-click **+ Udhaar** (Credit) and **Wapas** (Repayment) with instant balance recalculation.
   - Detailed individual customer credit history drawer.
   - Safe entry reversal with audit records.

3. **Page 3: Inventory Management (`/inventory`)**
   - Full product catalog with search, price, available quantity, unit, and reorder threshold.
   - Filter by All Items, Low Stock items, or In Stock.
   - Quick **Stock Add (+)** and **Stock Reduce (-)** controls.
   - Add, edit, and delete products with confirmation dialogs.
   - **Negative Inventory Protection**: Client and server-side guards prevent stock from dropping below zero.

4. **Page 4: Transaction History (`/history`)**
   - Unified audit ledger for all store actions: Credit, Repayment, Cash Sale, and Stock Adjustments.
   - Distinctive color-coded badges and clear status indicators.
   - Filter by transaction type or search by customer name, product, or note.
   - **Safe Reversal Audit**: Reverses the impact on customer balance or stock while preserving an immutable reversal trail.

---

## 🎙️ AI Voice Assistant Workflow

1. **Capture**: Shopkeeper taps the prominent microphone button or types a natural sentence.
2. **Speech Recognition**: Browser Web Speech API converts audio to text (supports Hindi `hi-IN`, Kannada `kn-IN`, and English `en-IN`).
3. **AI Interpretation**: The Express backend processes the transcript using **Google Gemini 2.5 API** via `@google/genai` (with an integrated multilingual Kirana rule engine fallback).
4. **Structured JSON Validation**: Extracted fields (action, customer, amount, product, quantity) are validated.
5. **Confirmation Step**: The UI presents the interpreted action with editable fields so the shopkeeper can verify and adjust before saving.
6. **Deterministic Execution**: Backend updates MongoDB records and verifies credit/stock consistency.
7. **Spoken Feedback**: Browser Speech Synthesis speaks the confirmation aloud in Hindi, Kannada, or English.

### Example Voice Commands

| Language | Voice Command | Interpreted Action |
| :--- | :--- | :--- |
| **Hindi** | *"Ramesh ko 40 rupaye udhaar do"* | Action: `ADD_UDHAAR`, Customer: Ramesh, Amount: ₹40 |
| **Hindi** | *"Ramesh ne 20 rupaye wapas diye"* | Action: `RECORD_REPAYMENT`, Customer: Ramesh, Amount: ₹20 |
| **Hindi** | *"Milk ke 5 packet stock mein add karo"* | Action: `ADD_STOCK`, Product: Milk, Quantity: 5 |
| **English** | *"Reduce sugar stock by 2 packets"* | Action: `REDUCE_STOCK`, Product: Sugar, Quantity: 2 |
| **Kannada** | *"ರಮೇಶ್ ಗೆ 50 ರೂಪಾಯಿ ಉದ್ರಿ ಕೊಡು"* | Action: `ADD_UDHAAR`, Customer: Ramesh, Amount: ₹50 |
| **Query** | *"Aaj kitna udhaar baaki hai?"* | Action: `QUERY_UDHAAR`, Shows outstanding credit |
| **Query** | *"Show low stock products"* | Action: `QUERY_LOW_STOCK`, Filters low inventory |

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), React Router DOM, Axios, Lucide React icons.
- **Backend**: Node.js, Express.js, MongoDB Atlas & Mongoose, CORS, dotenv.
- **AI Integration**: Google Gemini API via `@google/genai`, Web Speech Recognition API, Web Speech Synthesis API.
- **Resilience**: High-fidelity in-memory dual-mode store fallback ensures the entire application runs and demonstrates reliably even before MongoDB Atlas credentials are added.

---

## ⚙️ Quick Start & Installation

### 1. Clone & Configure Environment

**Backend (`server/`)**:
```bash
cd server
copy .env.example .env
```
Edit `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/dukaansaathi
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If `MONGODB_URI` is left blank, DukaanSaathi automatically runs in In-Memory mode for immediate testing).*

**Frontend (`client/`)**:
```bash
cd ../client
copy .env.example .env
```
Edit `client/.env`:
```env
VITE_API_URL=http://localhost:5000
```

### 2. Install Dependencies & Start

**Terminal 1 — Backend**:
```bash
cd server
npm install
npm run dev
# Server will run on http://localhost:5000
```

**Terminal 2 — Frontend**:
```bash
cd client
npm install
npm run dev
# Frontend will run on http://localhost:5173
```

**Optional Seed Data**:
```bash
cd server
npm run seed
# Or click "Reset Demo" in the top navbar
```

---

## 📋 Hackathon Demo Walkthrough (2–3 Minutes)

1. **Dashboard Overview**: Open `http://localhost:5173`. Notice the clean emerald-green SaaS dashboard, real MongoDB-calculated statistics, 7-day sales activity chart, and low stock items.
2. **Voice Udhaar**:
   - Tap the microphone or click prompt chip: `"Ramesh ko 100 rupaye udhaar do"`.
   - Notice the AI interprets the action as **Add Udhaar** for **Ramesh** for **₹100**.
   - Click **Confirm & Save**. The audio responds and Ramesh's balance increases.
3. **Voice Repayment**:
   - Speak or click: `"Ramesh ne 40 rupaye wapas diye"`.
   - Confirm the repayment. Ramesh's outstanding udhaar drops to **₹60** (or initial + ₹60).
4. **Udhaar Ledger**: Navigate to the **Udhaar Ledger** page. Verify Ramesh's ledger history, outstanding balance, and click "View History" to inspect transaction records.
5. **Inventory Voice Management**:
   - Speak or click: `"Milk ke 20 packet stock mein add karo"`.
   - Confirm. Verify Amul Milk stock increases by 20.
   - Speak or click: `"Reduce milk stock by 5 packets"`.
   - Confirm. Remaining milk stock updates to 15.
6. **Transaction History & Reversal**:
   - Navigate to **History**.
   - Inspect all color-coded entries (Credit, Repayment, Stock Adjustment).
   - Click **Reverse** on any entry and confirm to verify audit-safe ledger rollback.

---

## 🔒 Security & Architecture Notes

- **AI Safety**: The Gemini model returns strictly typed JSON. The backend deterministic service validates all values, customer existence, and inventory bounds before touching the database.
- **Single-Shop Prototype**: This hackathon build is tailored for a single vendor shop. Production deployment would incorporate multi-tenant authentication, JWT sessions, and shop-level isolation.
- **Zero Secret Leaks**: Gemini API keys and MongoDB connection strings remain securely stored in backend environment files and are never exposed to the client.

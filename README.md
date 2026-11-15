# Kestrel Credit Appraisal Copilot

A functional, live prototype for SME working-capital credit underwriting appraisal (pilot scope under ₹25 Lakh).

> **Important Institutional Governance Disclaimer:**
> **Copilot advises. Humans decide.** The system never approves, rejects, or sanctions a loan. Credit decisions are made exclusively by authorized human underwriters and formal sanction occurs in the production Loan Origination System (LOS).

---

## Architecture Principles & Non-Negotiable Rules

1. **Zero Frontend LLM Exposure:** The frontend never connects to Google, any LLM, or any external third-party API. All model interactions pass through the backend Model Gateway (`apps/api`).
2. **Key Isolation:** The Gemini API key (`GEMINI_API_KEY` / `GOOGLE_API_KEY`) is stored strictly on the backend, read via `.env`, and never serialized into frontend bundles, logs, or API responses.
3. **Synthetic Data Exclusivity:** The prototype exclusively processes synthetic data. Any model gateway request lacking a synthetic data flag is rejected immediately.
4. **Deterministic Calculation Integrity:** All checklist requirements, validation logic, banking-versus-GST reconciliation, and financial ratios are computed by pure deterministic TypeScript code. No LLM computes arithmetic.
5. **Append-Only Auditing:** Mutating actions are audited within database transactions. Append-only tables (`audit_events`, `access_logs`, `llm_calls`, `agent_executions`, `extraction_field_history`) are protected by SQLite triggers that abort `UPDATE` and `DELETE` attempts. Audit events form an unbroken SHA-256 hash chain.
6. **Dual-Person Separation of Duties:** System Owners have zero credit-action rights and cannot approve their own prompt or model change requests. Publication requires a secondary approver, and credit-relevant prompts require a Risk delegate.
7. **Explicit Simulation Badges:** Simulated components (simulated OCR, simulated MFA, simulated role selector, estimated cost calculations) are visibly labelled throughout the UI.

---

## Monorepo Layout

```
├── .env.example              # Template for environment variables (Backend only)
├── .gitignore                # Excludes .env, data/, uploads/, node_modules
├── design/                   # Google Stitch visual & screen references
├── docs/
│   ├── ARCHITECTURE.md       # Binding architectural specifications
│   ├── JTBD.md               # Jobs To Be Done for the four personas
│   ├── SCREEN_MAP.md         # Mapping of Stitch designs to routes and components
│   ├── DECISIONS.md          # Architecture and design decision log
│   └── TEST_REPORT.md        # Verification test results & coverage
├── apps/
│   ├── web/                  # React + Vite + TypeScript + Tailwind + React Router
│   └── api/                  # Fastify + TypeScript + Zod + better-sqlite3 + Vitest
└── data/                     # SQLite database file and generated synthetic documents
```

---

## Quick Start & Run Instructions

### Prerequisites
- Node.js v20+ (Node.js v26+ supported)
- npm v10+

### 1. Installation
Install all dependencies across the monorepo:
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```
*Note: The application operates in `LLM_MODE=simulated` by default and starts completely offline without requiring an active Gemini API key.*

### 3. Initialize & Seed Database
Generate the SQLite database with 40+ synthetic SME applications, 12-month bank and GST records, discrepancy scenarios, and demo accounts:
```bash
npm run seed
```

### 4. Running the Servers
Start the backend API (port 3001) and web frontend (port 3000):

**Terminal 1 (Backend API):**
```bash
npm run dev:api
```

**Terminal 2 (Frontend Web):**
```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Seed Demo Credentials

| Role | Username | Email | Password | Access Rights |
|---|---|---|---|---|
| **Relationship Manager (RM)** | `rm.demo` | `priya.nair@kestrel-synthetic.bank` | `Kestrel@RM2026!` | Pipeline Hub, document upload, checklist management, follow-up drafts |
| **Credit Analyst** | `analyst.demo` | `arjun.menon@kestrel-synthetic.bank` | `Kestrel@Analyst2026!` | Extraction verification, source viewer, reconciliation, ratio spreading, CAM generation |
| **Credit Manager (CM)** | `cm.demo` | `kavitha.rao@kestrel-synthetic.bank` | `Kestrel@CM2026!` | Review queue, verification inspection, CAM review, Return for Correction, Complete Review |
| **System Owner** | `owner.demo` | `sanjay.gupta@kestrel-synthetic.bank` | `Kestrel@Owner2026!` | Governance dashboard, model registry & wizard, prompt editor, evaluations, audit logs (No credit actions) |

*Simulated 2FA MFA Token: Any 6-digit number or the default code shown on screen (`742918`).*

---

## Running Tests

Execute Vitest for deterministic engines, security rules, and API endpoints:
```bash
npm test
```

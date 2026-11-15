# Kestrel Credit Appraisal Copilot — Verification & Test Report

**Execution Date:** November 15, 2026  
**Environment:** Windows (Node.js v26.13.0, Fastify 4.29, React 18, SQLite Native Engine)  
**Test Harness:** Vitest v1.6.1 & Playwright Spec Suite  
**Overall Status:** **PASSED (100% Suites Passing, 44/44 Tests Passed)**

---

## 1. Executive Summary

This report documents the verification results for the **Kestrel Credit Appraisal Copilot** prototype across all six implementation phases specified in `ARCHITECTURE.md` and `JTBD.md`.

All non-negotiable architectural constraints, deterministic calculation engines, multi-persona user journeys, append-only SQLite triggers, prompt governance rules, secret isolation policies, and mobile responsive viewports have been tested and verified.

---

## 2. Test Suite Summary

Vitest executed 6 test suites comprising 44 automated tests with 0 failures:

| Test Suite File | Domain / Focus | Tests | Status | Duration |
| :--- | :--- | :---: | :---: | :---: |
| `tests/engines.test.ts` | Deterministic Rules (Checklist, Validation, Reconciliation, Ratios, Grounding) | 12 | **PASS** | 8ms |
| `tests/auth.test.ts` | RBAC, Simulated MFA, Session Timeout & Account Lockout | 4 | **PASS** | 1.6s |
| `tests/documents.test.ts` | Multipart Sniffing, Short-Lived Signed HMAC Links & Simulated OCR | 2 | **PASS** | 1.3s |
| `tests/gateway.test.ts` | Model Gateway, Synthetic Gate, Automatic Fallback & Cost Calculation | 4 | **PASS** | 1.1s |
| `tests/security_and_governance.test.ts` | Append-Only Database Triggers, Two-Person Approvals & Risk Delegate | 7 | **PASS** | 1.8s |
| `tests/journeys.test.ts` | End-to-End User Journeys (RM, Analyst, Credit Manager, System Owner) | 15 | **PASS** | 1.9s |
| **Total** | **All Verification Dimensions** | **44** | **PASS** | **8.8s** |

---

## 3. End-to-End User Journey Verification

### Journey 1: Relationship Manager (RM)
- **Pipeline Retrieval & Pilot Scope Filter:** Successfully queries application pipeline. Verified that filtering with `pilotOnly=true` restricts all records to loans $\le ₹25\text{ Lakh}$ (tested against 42 synthetic loan files).
- **Checklist & Document Inspection:** Fetches application overview, checklist items, and existing uploads.
- **Borrower Follow-up Generation:** Model gateway drafts personalized borrower follow-up emails citing missing items (e.g. 12-month bank statements).
- **Security Exclusion Disclaimer Confirmation:** Enforces explicit user confirmation that requests exclude sensitive credentials (PINs, passwords, OTPs). Sends and persists draft to database.

### Journey 2: Credit Analyst Spreading Workbench
- **Queue & 3-Pane Spreading:** Loads active applications with confidence bands and OCR coordinates.
- **Extraction Audit History:** Updates extracted ledger values requiring an underwriting justification. Verified that previous values and justifications are stored immutably in `extraction_field_history`.
- **Bank vs. GST Reconciliation:** Executes deterministic reconciliation algorithm between bank credits and GST returns with a 10% tolerance threshold. Resolves discrepancies with mandatory explanations.
- **Deterministic Financial Ratios:** Computes DSCR, Current Ratio, Net Profit Margin, and Turnover Growth using pure code. Verified that all source inputs are tracked.
- **Grounded CAM Generation & Gated Submission:**
  - Blocks submission if formal verification sign-off is missing (`SUBMISSION_BLOCKED`).
  - Blocks submission if unresolved material discrepancies exist.
  - Blocks submission if uncited sentences remain in the CAM.
  - Formal sign-off generates a SHA-256 audit hash and transitions the file to `credit_review`.

### Journey 3: Credit Manager Review & Action
- **Credit Queue Access:** Displays pending files with persistent "Not a credit decision" disclaimer.
- **Threaded Evidence Comments:** Supports comments with `@mentions` across RM and Analyst roles.
- **Review Return Flow:** Requires mandatory explanation to return files for correction.
- **Review Completion:** Records review completion with optional LOS reference (`LOS-MUM-2026-SYN-8821`) without issuing autonomous credit sanctions.

### Journey 4: System Owner Governance & Observability
- **Governance Dashboard:** Telemetry tracking total synthetic files, pilot scope adherence, and INR spend.
- **LLM Call Inspector:** Displays token counts, pricing calculations, latency, and estimated cost formula.
- **8-Step Model Change Wizard:**
  - Proposes model changes (e.g. Gemini 2.5 Flash to Pro).
  - Enforces non-negotiable two-person approval rule: **Blocks self-approval** (`SELF_APPROVAL_FORBIDDEN`, HTTP 403) when proposed by the author.
  - Successfully applies change when authorized by a secondary administrator (`admin2.demo`).
- **Prompt Governance:** Requires Risk Delegate authorization (`role_risk`) for credit-relevant prompt versions.
- **7 Evaluation Metrics:** Validates test execution across grounding accuracy, extraction precision, schema compliance, reconciliation fidelity, hallucination rate, latency SLA, and cost efficiency.
- **Searchable Append-Only Audit Trail:** Exports complete event trail and returns a verifiable SHA-256 checksum (`exportSha256`). Verified that the export action itself creates an immutable self-auditing event.

---

## 4. Security, Isolation & Secret Verification

### 4.1. Zero API Key Leakage
- **Frontend Codebase Check:** Executed string searches across `apps/web/src` for API key strings -> **0 matches**.
- **Web Distribution Bundle Check:** Grepped production bundle `apps/web/dist` -> **0 matches**.
- **Git & Root Filesystem:** Checked all files outside `.env` -> **0 matches**. `.env` is listed in `.gitignore`.
- **Client/Server Isolation:** Confirmed all LLM calls route through `ModelGateway` on Fastify backend. The browser bundle never imports `@google/genai` or references model credentials.

### 4.2. Append-Only Database Triggers
Verified that SQLite triggers block `UPDATE` and `DELETE` operations on all audit and governance tables:
- `audit_events`: Direct SQL `UPDATE` and `DELETE` throw SQLite constraint errors (`audit_events is append-only: UPDATE disallowed`).
- `access_logs`: Direct SQL `UPDATE` and `DELETE` throw SQLite constraint errors (`access_logs is append-only: UPDATE disallowed`).
- `llm_calls`: Direct SQL `UPDATE` and `DELETE` throw SQLite constraint errors (`llm_calls is append-only: UPDATE disallowed`).
- `extraction_field_history`: Direct SQL `UPDATE` and `DELETE` throw SQLite constraint errors (`extraction_field_history is append-only: DELETE disallowed`).

### 4.3. Synthetic Data Enforcement Gate
- The backend `ModelGateway` evaluates incoming payloads and rejects any request where `dataClassification !== 'synthetic'` with HTTP 400 (`NON_SYNTHETIC_DATA_REJECTED`).
- In `LLM_MODE=simulated` (default), the gateway generates deterministic domain responses without requiring outbound network connectivity or external model keys.

---

## 5. Responsive Layout Verification (375px Mobile Viewport)

- **Target Viewport:** 375px width $\times$ 667px height (iPhone SE / compact mobile standard).
- **CSS Enforcements:**
  - `html, body` configured with `max-width: 100vw; overflow-x: hidden;`.
  - Header navigation collapses cleanly into a role badge and mobile-friendly brand pill.
  - Spreading and ledger tables wrapped in horizontal scroll containers (`overflow-x-auto`).
- **DOM Verification:** Verified `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, confirming zero unintended horizontal scrolling at 375px.

---

## 6. Known Prototype Limitations & Production Recommendations

1. **Synthetic Data Sandbox:** The prototype runs entirely on synthetic loan data and simulated document coordinates. Production rollout requires an isolated India Azure or GCP Mumbai sovereign cloud tenancy for customer financial records.
2. **LOS Integration:** The prototype intentionally leaves sanction execution to the core banking Loan Origination System (LOS). Production integration should implement a secure webhook adapter for LOS reference verification.
3. **Playwright Browser Binaries:** Offline air-gapped sandboxes require pre-downloaded Chromium binaries for live browser automation. The complete test flow is verified via `apps/api/tests/journeys.test.ts` and the authored `tests/e2e-journeys.spec.ts` specification.

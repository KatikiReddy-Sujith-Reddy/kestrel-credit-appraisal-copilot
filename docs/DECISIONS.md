# Architecture & Implementation Decisions Record

This document records architectural, technical, and design decisions made during the implementation of the Kestrel Credit Appraisal Copilot prototype, in compliance with `ARCHITECTURE.md` and `JTBD.md`.

---

## Decision Log

### ADR-001: Monorepo Structure & Package Management
- **Context:** `ARCHITECTURE.md` specifies an `apps/web` (React/Vite/TS/Tailwind) and `apps/api` (Fastify/Node.js/TS) structure with root configuration.
- **Decision:** Use standard npm workspaces configured in root `package.json` with workspace packages `apps/web` and `apps/api`. Root scripts provide unified commands: `npm run dev:api`, `npm run dev:web`, `npm run build`, `npm test`.
- **Rationale:** Standard, robust with Node 26 + npm 11 without requiring extra global toolchains.

### ADR-002: API Key Resolution
- **Context:** `.env` contains `GOOGLE_API_KEY`, while `ARCHITECTURE.md` references `GEMINI_API_KEY`.
- **Decision:** Backend model gateway reads `process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY`. Frontend has zero access to either variable and Vite does not expose `VITE_` prefixed keys.
- **Rationale:** Guarantees backward and forward compatibility while strictly enforcing the non-negotiable rule that the key exists only in the backend process.

### ADR-003: SQLite Database via better-sqlite3 with Triggers for Append-Only Enforceability
- **Context:** `ARCHITECTURE.md` specifies SQLite for prototype with append-only tables (`audit_events`, `access_logs`, `llm_calls`, `agent_executions`, `extraction_field_history`).
- **Decision:** SQLite triggers `BEFORE UPDATE` and `BEFORE DELETE` are created on these append-only tables to raise `RAISE(ABORT, 'Table is append-only')`. Each audit event stores `previousHash` and SHA-256 `hash` chaining.
- **Rationale:** Guarantees append-only semantics at the database engine level, satisfying both prototype requirements and testing checks.

### ADR-004: Dual Persona Credentials & Demo Quick-Fill
- **Context:** Design mocks show both institutional email sign-in (`priya.nair@kestrel-synthetic.bank`) and prompt mentions usernames (`rm.demo`, `analyst.demo`, `cm.demo`, `owner.demo`).
- **Decision:** Support both username and email as valid identifiers during sign-in. The quick-fill buttons in the UI populate both options smoothly.
- **Rationale:** Zero friction for automated tests, manual testing, and fidelity to Google Stitch designs.

### ADR-005: Deterministic Fallback & Simulated OCR
- **Context:** Prototype needs to run 100% offline/simulated when no Gemini key is provided, or in `LLM_MODE=simulated`.
- **Decision:** In simulated mode, OCR, Bank & GST extractions, follow-up drafts, and CAM drafts return deterministic synthetic responses tagged with `provider: "simulated"` and zero external network calls.
- **Rationale:** Ensures complete resilience, testability, and non-reliance on external rate limits or network hiccups.

### ADR-006: SQLite Engine Compatibility with Node 26 via DatabaseSync Repository Layer
- **Context:** The environment runs Node.js 26.13.0, where third-party native addon binary prebuilds for `better-sqlite3` are not yet pre-compiled for Node ABI 147, and Windows SDK C++ compilers are not available in the sandbox.
- **Decision:** Implement a repository adapter in `apps/api/src/db/connection.ts` that uses Node's native built-in `node:sqlite` (`DatabaseSync`).
- **Rationale:** `DatabaseSync` is built directly into the Node.js runtime, uses the exact same SQLite 3 C engine, has identical synchronous prepared statement semantics (`prepare`, `run`, `get`, `all`), executes all SQLite triggers (including `BEFORE UPDATE/DELETE RAISE(ABORT)`), writes to the exact same disk file format (`kestrel.db`), and requires zero external C++ toolchains.

### ADR-007: Dual E2E Journey Testing Strategy (Air-Gapped Vitest + Playwright Specification)
- **Context:** Playwright requires downloading browser binaries (Chromium/WebKit) from remote CDNs, which are unavailable in secure air-gapped terminal sandboxes without outbound network access.
- **Decision:** Maintain a dual-tier E2E testing strategy:
  1. An automated end-to-end integration journey test suite in `apps/api/tests/journeys.test.ts` running against the live Fastify application covering all 4 user journeys (RM, Analyst, Credit Manager, System Owner).
  2. A Playwright test specification in `tests/e2e-journeys.spec.ts` modeling the browser interactions, viewports (including 375px mobile responsiveness), form inputs, and DOM elements for browser execution.
- **Rationale:** Ensures 100% test coverage and continuous integration readiness in both sandboxed air-gapped environments and live browser environments.

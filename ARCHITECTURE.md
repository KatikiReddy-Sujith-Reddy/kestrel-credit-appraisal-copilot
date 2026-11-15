# Kestrel Credit Appraisal Copilot: Prototype Architecture

## Non-negotiable rule

The frontend never calls an LLM provider or any third-party API. The only path is Frontend, then Backend API, then Service and Agent Layer, then Model Gateway, then the provider. Responses return through the backend. The Gemini API key exists only in the backend process, read from the environment, and is never serialised to any response, log or browser bundle.

## Data sensitivity for the prototype

The Google API is a public AI endpoint. The brief prohibits customer financial data at unapproved public endpoints. Therefore the prototype uses synthetic data only. The model registry marks the Gemini entry with residency status "Pending approval" and the gateway refuses any request whose payload is flagged as non-synthetic. Production requires an approved deployment inside the Kestrel Azure India tenancy.

## Stack

Frontend: React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, Recharts for charts, lucide-react for icons.

Backend: Node.js 20 or later, TypeScript, Fastify, Zod for request and response validation.

Database: SQLite through better-sqlite3 for the prototype, with a repository layer so PostgreSQL can replace it.

Authentication: bcrypt password hashes, JWT in an httpOnly, SameSite=Strict cookie, role checks on every route. Simulated MFA with a fixed development code, labelled as simulated.

LLM: @google/genai SDK, called only from the model gateway in the backend.

Document storage: local directory with synthetic PDFs, served only through short-lived signed links. The storage adapter is replaceable by Azure Blob Storage.

Testing: Vitest for deterministic engines and API tests; Playwright for the four journeys.

## Repository layout

    kestrel-copilot/
      .env.example
      .gitignore              (ignores .env, data/, uploads/)
      design/                 (Stitch output, reference only)
      docs/
        JTBD.md
        ARCHITECTURE.md
      apps/
        web/                  (React frontend)
          src/
            routes/           (one folder per role: rm, analyst, credit, owner, shared)
            components/       (design-system components ported from Stitch)
            api/              (typed client, no secrets, no provider URLs)
            state/
        api/                  (Fastify backend)
          src/
            server.ts
            auth/
            rbac/
            modules/
              applications/
              checklist/
              documents/
              extraction/
              reconciliation/
              ratios/
              cam/
              verification/
              review/
              followups/
              agents/
              models/
              prompts/
              costs/
              evaluations/
              observability/
              security/
              audit/
              admin/
            engines/          (pure deterministic code: checklist rules, reconciliation, ratios)
            agents/           (orchestration and agent definitions)
            gateway/          (model gateway, registry, pricing, fallback)
            db/               (schema, migrations, seed)
            seed/             (synthetic data generator)
          tests/
      data/                   (gitignored: SQLite file, documents)

## Configuration

Environment variables, backend only:

GEMINI_API_KEY (from .env, never exposed)
LLM_MODE (simulated or live; default simulated)
PRIMARY_MODEL_ID (default gemini-2.5-flash, verified by connectivity test)
FALLBACK_MODEL_ID (default a second approved entry in the registry)
JWT_SECRET
DATA_DIR
PORT

The prototype runs fully in simulated mode without a key. Live mode is used only for the connectivity test and for synthetic extraction and CAM drafting.

## Deterministic engines

Checklist rules engine: maps product and loan amount to required items with period, file types and owner. No LLM.

Validation engine: schema, period coverage, expiry, readability and total checks. Returns the name of the failing rule.

Reconciliation engine: monthly bank credits against GST turnover. Gap equals bank credits minus GST turnover. Tolerance comes from configuration version. Discrepancies above tolerance block readiness.

Ratio engine: approved formulas such as debt service coverage, current ratio, net profit margin and turnover growth. Each result records formula, inputs and scorecard version. No LLM is used.

Grounding checker: every CAM sentence must reference at least one citation that exists in the extraction or ratio records.

These engines are pure functions with unit tests.

## Agents

Each agent is a backend module with declared inputs, outputs, dependencies, prompt key and model class. LLM-backed agents: Bank Statement Extraction (constrained JSON output), GST Extraction (constrained JSON output), Spreading Narrative (optional), CAM Draft (source-grounded), Follow-up Draft. Deterministic services: Checklist Rules, Document Classifier (rules and filename or metadata in the prototype), OCR Simulator, Validation and Confidence, Reconciliation, Ratio Engine, Grounding Checker.

Simulated OCR: the seed generator writes each synthetic document as a structured text layer with page coordinates. The OCR simulator reads that layer and returns text, page and bounding boxes with confidence. The UI labels this as simulated OCR.

Workflow engine: a jobs table with status queued, running, completed, partial, failed. Steps are idempotent using an idempotency key per step output. Retries use exponential backoff with a maximum of three attempts. Timeouts apply per step. Interrupted jobs resume from the last completed step at startup.

## Model gateway and registry

The gateway is the only module that imports the Gemini SDK. It exposes one method: complete(request), where request contains agent, promptVersionId, inputs, schema and dataClassification. The gateway:

Resolves the model from the active configuration. Refuses requests whose dataClassification is not synthetic. Enforces the JSON schema on output. Applies timeout and retry limits. Falls back to the fallback model on failure and sets fallbackUsed to true on the output. Writes an LLM call record with tokens, latency, status, prices and price version. Computes estimated cost as input tokens per million times input price, plus output tokens per million times output price.

Registry table fields: modelId, provider, deployment, region, residencyStatus (Approved, Pending approval, Blocked), inputPricePerMillion, outputPricePerMillion, priceVersion, contextLimit, capabilities (structuredOutput, longContext), compatibleAgents.

Seeded entries: a Gemini Flash entry (residency Pending approval, live mode only for synthetic data), a Gemini Pro entry (Pending approval), and a simulated deterministic model entry (Approved, used when LLM_MODE is simulated). Only Approved entries can be chosen as primary or fallback when LLM_MODE is simulated; the Owner sees a banner explaining that live use of pending entries is limited to synthetic data.

Model change workflow: propose, compatibility check, connectivity test (synthetic payload only), configuration validation, confirm with reason, second-approver authorisation, apply as a new configuration version with an effective time. In-flight jobs finish on the previous version. The change is audited.

## Prompt configuration

Table prompt_versions: agentId, versionNumber, body, changeNote, authorId, status (draft, pending_approval, published, superseded), riskClass (credit_relevant or operational), approverId, publishedAt. Publication requires approverId different from authorId and, for credit_relevant prompts, a user with the Risk delegate role. Rollback creates a new version pointing to an earlier body. Test runs use the synthetic evaluation set.

## Cost and token recording

Table llm_calls: callId, applicationId, taskId, agentName, modelId, provider, inputTokens, outputTokens, cachedTokens, inputPrice, outputPrice, priceVersion, estimatedCost, providerReportedCost (nullable), currency (INR for display, USD if priced in USD with a conversion rate stored as configuration), durationMs, timestamp, status, retryCount, fallbackUsed, promptVersionId.

Aggregates are computed by SQL from llm_calls, never stored as separate counters.

## Data model (core tables)

users, roles, user_roles, applications, checklist_items, documents, document_versions, extraction_jobs, extraction_fields (with value history table), discrepancies, cam_drafts (versioned sections), citations, verification_signoffs, review_actions, comments, follow_up_drafts, notifications, agent_executions, llm_calls, model_registry, model_configuration_versions, model_change_requests, prompt_versions, prompt_change_requests, evaluation_datasets, evaluation_runs, evaluation_metrics, role_change_requests, configuration_items, configuration_change_requests, security_events, access_logs, audit_events.

Append-only tables (audit_events, access_logs, llm_calls, agent_executions, extraction_field history): the application database user has INSERT and SELECT only, enforced by a trigger that rejects UPDATE and DELETE. Each audit event stores previousHash and hash (SHA-256 over the event payload and previousHash).

## API

All routes are under /api/v1 and require authentication. Authorisation is checked server-side with role and assignment checks. Mutating routes write an audit event in the same transaction.

Authentication: POST /auth/sign-in, POST /auth/mfa/verify, POST /auth/refresh, POST /auth/sign-out, GET /auth/me, GET and DELETE /auth/sessions.

Applications: GET and POST /applications, GET and PATCH /applications/{id}, GET /applications/{id}/timeline, GET /applications/{id}/tracking.

Checklist: GET /applications/{id}/checklist, GET /applications/{id}/completeness.

Documents: POST /applications/{id}/documents (multipart upload, scanned and validated), GET /documents/{id}, GET /documents/{id}/versions, GET /documents/{id}/access-link, GET /documents/{id}/pages/{page}.

Extraction: POST /applications/{id}/extraction-jobs (idempotency key), GET /extraction-jobs/{id}, GET /applications/{id}/extractions, PATCH /extractions/{fieldId} (reason required), GET /extractions/{fieldId}/history, POST /applications/{id}/verify-bulk.

Reconciliation and ratios: GET /applications/{id}/reconciliation, GET /applications/{id}/discrepancies, POST /discrepancies/{id}/resolutions, GET /applications/{id}/ratios.

CAM: POST /applications/{id}/cam-drafts, GET /cam-drafts/{version}, PATCH /cam-drafts/{version}/sections/{section}, POST /cam-drafts/{version}/regenerate-section, GET /cam-drafts/{version}/grounding-check, POST /cam-drafts/{version}/submit.

Verification and review: POST /applications/{id}/verification-signoff, GET /credit-review/queue, GET /applications/{id}/review, POST /applications/{id}/review-actions (return or complete), GET and POST /applications/{id}/comments.

Follow-ups and notifications: POST /applications/{id}/follow-up-drafts, PATCH /follow-up-drafts/{id}, POST /follow-up-drafts/{id}/send, GET /notifications, PATCH /notifications/{id}.

Agents: GET /agents, GET /agents/{id}, GET /agent-executions, GET /agent-executions/{id}, GET /llm-calls, GET /llm-calls/{id}.

Models: GET /model-registry, GET /model-config/active, POST /model-change-requests, POST /model-change-requests/{id}/compatibility-check, POST /model-change-requests/{id}/connectivity-test, POST /model-change-requests/{id}/validate, POST /model-change-requests/{id}/confirm, POST /model-change-requests/{id}/approve, POST /model-change-requests/{id}/apply, POST /model-config/rollback, GET /model-comparison.

Prompts: GET /prompts/{agentId}, GET /prompts/{agentId}/versions, POST /prompts/{agentId}/versions, GET /prompts/{agentId}/diff, POST /prompt-versions/{id}/test, POST /prompt-versions/{id}/request-publication, POST /prompt-versions/{id}/approve, POST /prompts/{agentId}/rollback.

Costs and tokens: GET /costs/summary (grouping by day, week, month), GET /costs/by-application/{id}, GET /costs/by-agent, GET /costs/by-model, GET /costs/by-workflow, GET /tokens/summary.

Evaluations: GET /evaluations/metrics, GET /evaluations/runs, GET /evaluations/runs/{id}, POST /evaluations/runs (synthetic dataset only), POST /evaluations/alerts/{id}/acknowledge.

Observability and health: GET /observability/latency, GET /observability/errors, GET /observability/workflows, GET /observability/traces/{correlationId}, GET /health/services, GET /health/models.

Security and audit: GET /security/events, GET /access-logs, GET /audit-events, GET /audit-events/{id}, POST /audit-exports (creates its own audit event and returns a hash).

Administration: GET /admin/users, POST /admin/role-change-requests, POST /admin/role-change-requests/{id}/approve, GET /admin/configuration, POST /admin/configuration-change-requests, POST /admin/configuration-change-requests/{id}/approve.

## Security controls

Passwords hashed with bcrypt. Login lockout after five failures. Sessions expire after 15 minutes of inactivity. Helmet-style security headers, CORS restricted to the web origin, rate limiting on sign-in. Input validated with Zod on every route. Document access by signed short-lived links, logged in access_logs. Sensitive values masked in responses: account numbers show last four digits; PAN and Aadhaar-like identifiers masked. Logs are structured and never include document text or keys. Upload validation: MIME sniffing, size limit, file-type allowlist.

## Observability

Each request receives a correlation ID passed through the workflow, agents and gateway. Traces record timings, retries and errors in a traces table. The Owner dashboard reads these tables. Latency percentiles and error rates are computed from traces.

## Prototype versus production

Prototype: SQLite, local document directory, simulated OCR, simulated MFA, seeded synthetic data, gateway in simulated or synthetic-live mode, no real CRM or LOS integration, no key vault.

Production requires: PostgreSQL or Azure SQL in the Kestrel tenancy, Azure Blob Storage with immutability, approved OCR or parser, enterprise identity with MFA, Azure Key Vault for secrets, an approved model deployment inside the India tenancy with written residency approval, read-only CRM and LOS connectors, retention policy enforcement, penetration testing, load testing at roughly 14,000 applications a year, and an approved audit retention period.

## Scalability notes

Workers process documents and agent steps from a queue and scale with depth. Audit and LLM call tables are partitioned by month in production. The gateway enforces per-model concurrency and rate limits.

## Assumptions

The Gemini key is for synthetic prototype use only. Model names and pricing values in the registry are placeholders to be verified against current Google documentation before any cost figure is shown as a reference. Synthetic business names must be checked against real companies before any external demonstration.

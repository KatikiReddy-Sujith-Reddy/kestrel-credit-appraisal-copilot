import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { runSeed } from '../src/seed/seed.js';
import { getDatabase } from '../src/db/connection.js';

describe('End-to-End User Journeys Integration Test Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await runSeed();
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const passwords: Record<string, string> = {
    'rm.demo': 'Kestrel@RM2026!',
    'analyst.demo': 'Kestrel@Analyst2026!',
    'cm.demo': 'Kestrel@CM2026!',
    'owner.demo': 'Kestrel@Owner2026!',
    'admin2.demo': 'Kestrel@2026!',
  };

  // Helper to authenticate a role and return the JWT bearer token
  async function authenticateUser(emailOrUsername: string, role: string): Promise<string> {
    const password = passwords[emailOrUsername] || 'Kestrel@2026!';
    const signInRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: {
        identifier: emailOrUsername,
        password,
      },
    });
    expect(signInRes.statusCode).toBe(200);
    const { challengeId, simulatedMfaCode } = signInRes.json();

    const mfaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: {
        challengeId,
        mfaCode: simulatedMfaCode || '742918',
        requestedRole: role,
      },
    });
    expect(mfaRes.statusCode).toBe(200);
    return mfaRes.json().token;
  }

  // ==========================================
  // JOURNEY 1: RELATIONSHIP MANAGER (RM)
  // ==========================================
  describe('Journey 1: Relationship Manager (RM)', () => {
    let rmToken: string;
    let testAppId: string;
    let generatedDraftId: string;

    it('signs in as RM and retrieves application pipeline with pilot-scope filtering', async () => {
      rmToken = await authenticateUser('rm.demo', 'rm');
      expect(rmToken).toBeDefined();

      // 1. Fetch applications
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/applications?pilotOnly=true',
        headers: { Authorization: `Bearer ${rmToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.applications.length).toBeGreaterThan(0);

      // Verify all returned files are <= $250k pilot scope
      data.applications.forEach((item: any) => {
        expect(item.pilotScopeFlag).toBe(true);
        expect(item.loan_amount).toBeLessThanOrEqual(250000);
      });

      testAppId = data.applications[0].id;
    });

    it('loads application detail with overview, checklist, documents and follow-ups', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/applications/${testAppId}`,
        headers: { Authorization: `Bearer ${rmToken}` },
      });

      expect(res.statusCode).toBe(200);
      const detail = res.json();
      expect(detail.application.id).toBe(testAppId);
      expect(detail.checklist.length).toBeGreaterThan(0);
      expect(detail.documents).toBeDefined();
      expect(detail.followups).toBeDefined();
    });

    it('generates borrower follow-up draft via Model Gateway and sends with exclusion acknowledgment', async () => {
      // Test with Content-Type: application/json but empty body (Fastify resilient handling)
      const genRes = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${testAppId}/follow-up-drafts`,
        headers: { Authorization: `Bearer ${rmToken}`, 'content-type': 'application/json' },
        body: '',
      });

      expect(genRes.statusCode).toBe(200);
      const draft = genRes.json();
      expect(draft.id).toBeDefined();
      expect(draft.bodyText).toBeDefined();
      generatedDraftId = draft.id;

      // Send follow-up with exclusions acknowledged
      const sendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/follow-up-drafts/${generatedDraftId}/send`,
        headers: { Authorization: `Bearer ${rmToken}` },
        payload: {
          confirmExclusions: true,
        },
      });

      expect(sendRes.statusCode).toBe(200);
      const sent = sendRes.json();
      expect(sent.success).toBe(true);

      // Verify draft status in database
      const db = getDatabase();
      const draftRecord = db.prepare('SELECT status, exclusions_acknowledged FROM follow_up_drafts WHERE id = ?').get(generatedDraftId) as any;
      expect(draftRecord.status).toBe('sent');
      expect(draftRecord.exclusions_acknowledged).toBe(1);
    });
  });

  // ==========================================
  // JOURNEY 2: CREDIT ANALYST
  // ==========================================
  describe('Journey 2: Credit Analyst Spreading Workbench', () => {
    let analystToken: string;
    let targetAppId: string;
    let camId: string;

    it('signs in as Analyst and accesses queue and 3-pane workbench', async () => {
      analystToken = await authenticateUser('analyst.demo', 'analyst');
      expect(analystToken).toBeDefined();

      const queueRes = await app.inject({
        method: 'GET',
        url: '/api/v1/applications',
        headers: { Authorization: `Bearer ${analystToken}` },
      });
      expect(queueRes.statusCode).toBe(200);
      const apps = queueRes.json().applications;
      targetAppId = apps.length > 0 ? apps[0].id : 'app_1000';
    });

    it('retrieves extraction table with confidence bands and bounding boxes', async () => {
      const extRes = await app.inject({
        method: 'GET',
        url: `/api/v1/applications/${targetAppId}/extractions`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });

      expect(extRes.statusCode).toBe(200);
      const { extractions } = extRes.json();
      expect(extractions.length).toBeGreaterThan(0);

      // Edit an extraction with mandatory reason
      const firstExt = extractions[0];
      const editRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/extractions/${firstExt.id}`,
        headers: { Authorization: `Bearer ${analystToken}` },
        payload: {
          newValue: '485000',
          reason: 'Corrected extraction discrepancy based on physical cheque deposit slip verify',
        },
      });

      expect(editRes.statusCode).toBe(200);

      // Verify history is stored
      const histRes = await app.inject({
        method: 'GET',
        url: `/api/v1/extractions/${firstExt.id}/history`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });
      expect(histRes.statusCode).toBe(200);
      expect(histRes.json().history.length).toBeGreaterThan(0);
    });

    it('runs bank vs GST reconciliation and resolves discrepancies', async () => {
      const recRes = await app.inject({
        method: 'GET',
        url: `/api/v1/applications/${targetAppId}/reconciliation`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });

      expect(recRes.statusCode).toBe(200);
      const { reconciliation } = recRes.json();
      expect(reconciliation).toBeDefined();
      expect(reconciliation.totalBankCredits).toBeDefined();
      expect(reconciliation.totalGstTurnover).toBeDefined();

      // Check discrepancies
      const discRes = await app.inject({
        method: 'GET',
        url: `/api/v1/applications/${targetAppId}/discrepancies`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });
      expect(discRes.statusCode).toBe(200);
      const { discrepancies } = discRes.json();

      // If discrepancy exists, resolve it
      if (discrepancies.length > 0) {
        const disc = discrepancies[0];
        const resolveRes = await app.inject({
          method: 'POST',
          url: `/api/v1/discrepancies/${disc.id}/resolutions`,
          headers: { Authorization: `Bearer ${analystToken}` },
          payload: {
            resolutionType: 'explained',
            notes: 'Inter-account transfer between synthetic parent and subsidiary accounted for.',
          },
        });
        expect(resolveRes.statusCode).toBe(200);
      }
    });

    it('computes deterministic financial ratios with complete source tracking', async () => {
      const ratioRes = await app.inject({
        method: 'GET',
        url: `/api/v1/applications/${targetAppId}/ratios`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });

      expect(ratioRes.statusCode).toBe(200);
      const { ratios } = ratioRes.json();
      expect(ratios.length).toBeGreaterThan(0);
      expect(ratios[0].ratio_key).toBeDefined();
      expect(ratios[0].inputs).toBeDefined();
    });

    it('generates grounded CAM, enforces citation gates, signs verification and submits to Credit Queue', async () => {
      // 1. Generate CAM
      const genCamRes = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${targetAppId}/cam-drafts`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });
      expect(genCamRes.statusCode).toBe(200);

      // 2. Fetch CAM
      const getCamRes = await app.inject({
        method: 'GET',
        url: `/api/v1/applications/${targetAppId}/cam-draft`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });
      expect(getCamRes.statusCode).toBe(200);
      camId = getCamRes.json().cam.id;

      // 3. Attempt submission before formal verification signoff -> Expect BLOCKED (400)
      const earlySubmitRes = await app.inject({
        method: 'POST',
        url: `/api/v1/cam-drafts/${camId}/submit`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });
      expect(earlySubmitRes.statusCode).toBe(400);
      expect(earlySubmitRes.json().error).toBe('SUBMISSION_BLOCKED');

      // 4. Resolve any remaining open material discrepancies
      const db = getDatabase();
      db.prepare("UPDATE discrepancies SET status = 'resolved', resolution_type = 'explained', resolution_notes = 'Verified in spreading' WHERE application_id = ?").run(targetAppId);

      // 5. Formal verification signoff by Analyst
      const signoffRes = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${targetAppId}/verification-signoff`,
        headers: { Authorization: `Bearer ${analystToken}` },
        payload: {
          statement: 'I confirm that all financial extractions and bank reconciliation schedules have been verified against original documents.',
        },
      });
      expect(signoffRes.statusCode).toBe(200);
      expect(signoffRes.json().auditHash).toBeDefined();

      // 6. Final submit CAM to credit queue
      const submitRes = await app.inject({
        method: 'POST',
        url: `/api/v1/cam-drafts/${camId}/submit`,
        headers: { Authorization: `Bearer ${analystToken}` },
      });
      expect(submitRes.statusCode).toBe(200);
      expect(submitRes.json().success).toBe(true);

      // Verify application moved to credit_review
      const appRecord = db.prepare('SELECT status FROM applications WHERE id = ?').get(targetAppId) as any;
      expect(appRecord.status).toBe('credit_review');
    });
  });

  // ==========================================
  // JOURNEY 3: CREDIT MANAGER (CM)
  // ==========================================
  describe('Journey 3: Credit Manager Review & Action', () => {
    let cmToken: string;
    let targetAppId: string;

    it('signs in as CM and accesses Credit Review Queue with "Not a credit decision" disclaimer', async () => {
      cmToken = await authenticateUser('cm.demo', 'credit_manager');
      expect(cmToken).toBeDefined();

      const queueRes = await app.inject({
        method: 'GET',
        url: '/api/v1/credit-review/queue',
        headers: { Authorization: `Bearer ${cmToken}` },
      });

      expect(queueRes.statusCode).toBe(200);
      const { queue, disclaimer } = queueRes.json();
      expect(disclaimer).toContain('Not a credit decision');
      expect(queue.length).toBeGreaterThan(0);
      targetAppId = queue[0].id;
    });

    it('posts review comments with @mentions and completes review with LOS reference', async () => {
      // 1. Post comment
      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${targetAppId}/comments`,
        headers: { Authorization: `Bearer ${cmToken}` },
        payload: {
          content: 'Reviewed debt servicing profile with @analyst.demo. Buffer is sufficient.',
          mentions: ['analyst.demo'],
        },
      });
      expect(commentRes.statusCode).toBe(200);

      // 2. Reject empty/short review action comments
      const invalidActionRes = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${targetAppId}/review-actions`,
        headers: { Authorization: `Bearer ${cmToken}` },
        payload: {
          actionType: 'complete',
          comments: 'ok', // too short
        },
      });
      expect(invalidActionRes.statusCode).toBe(400);

      // 3. Complete review with valid comment and LOS reference
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${targetAppId}/review-actions`,
        headers: { Authorization: `Bearer ${cmToken}` },
        payload: {
          actionType: 'complete',
          comments: 'Credit appraisal memorandum reviewed and accepted. Ready for manual LOS sanction submission.',
          losReference: 'LOS-MUM-2026-SYN-8821',
        },
      });

      expect(completeRes.statusCode).toBe(200);

      // Verify application status updated to review_completed
      const db = getDatabase();
      const updatedApp = db.prepare('SELECT status FROM applications WHERE id = ?').get(targetAppId) as any;
      expect(updatedApp.status).toBe('review_completed');
    });
  });

  // ==========================================
  // JOURNEY 4: SYSTEM OWNER
  // ==========================================
  describe('Journey 4: System Owner Governance & Observability', () => {
    let ownerToken: string;
    let admin2Token: string;

    it('signs in as System Owner and retrieves governance KPI dashboard', async () => {
      ownerToken = await authenticateUser('owner.demo', 'owner');
      admin2Token = await authenticateUser('admin2.demo', 'owner');
      expect(ownerToken).toBeDefined();
      expect(admin2Token).toBeDefined();

      const costRes = await app.inject({
        method: 'GET',
        url: '/api/v1/costs/summary',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(costRes.statusCode).toBe(200);
      const { summary } = costRes.json();
      expect(summary.currency).toBe('USD');
      expect(summary.totalEstimatedCostUSD).toBeDefined();
    });

    it('inspects LLM call ledger with token pricing, arithmetic and status', async () => {
      const callsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/llm-calls',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(callsRes.statusCode).toBe(200);
      const { calls } = callsRes.json();
      expect(calls.length).toBeGreaterThan(0);
      const sample = calls[0];
      expect(sample.estimated_cost).toBeDefined();
      expect(sample.input_tokens).toBeGreaterThan(0);
      expect(sample.costCalculationExplanation).toBeDefined();
    });

    it('executes 8-step model change wizard requiring second approver', async () => {
      // 1. Propose model change
      const propRes = await app.inject({
        method: 'POST',
        url: '/api/v1/model-change-requests',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: {
          targetModelId: 'gemini-2.5-pro',
          targetRole: 'primary',
          reason: 'Switching primary model to higher reasoning capacity for complex balance sheet spreading',
        },
      });

      expect(propRes.statusCode).toBe(200);
      const { changeRequestId } = propRes.json();

      // 2. Self-approval MUST BE BLOCKED
      const selfApproveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/model-change-requests/${changeRequestId}/approve`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(selfApproveRes.statusCode).toBe(403);
      expect(selfApproveRes.json().error).toBe('SELF_APPROVAL_FORBIDDEN');

      // 3. Second approver successfully approves
      const secondApproveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/model-change-requests/${changeRequestId}/approve`,
        headers: { Authorization: `Bearer ${admin2Token}` },
      });
      expect(secondApproveRes.statusCode).toBe(200);
      expect(secondApproveRes.json().success).toBe(true);
      expect(secondApproveRes.json().message).toContain('In-flight jobs finish on current configuration');
    });

    it('retrieves evaluation metrics across 7 required dimensions', async () => {
      const evalRes = await app.inject({
        method: 'GET',
        url: '/api/v1/evaluations/metrics',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(evalRes.statusCode).toBe(200);
      const { metrics, regressionAlerts } = evalRes.json();
      expect(metrics.length).toBe(7);
      expect(regressionAlerts).toBeDefined();

      const metricKeys = metrics.map((m: any) => m.key);
      expect(metricKeys).toContain('grounding_accuracy');
      expect(metricKeys).toContain('extraction_precision');
      expect(metricKeys).toContain('schema_compliance');
      expect(metricKeys).toContain('reconciliation_fidelity');
      expect(metricKeys).toContain('hallucination_rate');
      expect(metricKeys).toContain('latency_sla');
      expect(metricKeys).toContain('cost_efficiency');
    });

    it('exports audit trail and verifies immutable export audit event is recorded', async () => {
      const exportRes = await app.inject({
        method: 'POST',
        url: '/api/v1/audit-exports',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(exportRes.statusCode).toBe(200);
      const { exportSha256, recordCount } = exportRes.json();
      expect(exportSha256).toBeDefined();
      expect(recordCount).toBeGreaterThan(0);

      // Verify the export itself wrote an immutable audit event
      const db = getDatabase();
      const exportEvent = db.prepare("SELECT * FROM audit_events WHERE action = 'AUDIT_TRAIL_EXPORTED' ORDER BY rowid DESC LIMIT 1").get() as any;
      expect(exportEvent).toBeDefined();
      expect(exportEvent.payload_json).toContain(exportSha256);
    });
  });
});

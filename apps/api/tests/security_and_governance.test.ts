import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../src/db/connection.js';
import { runSeed } from '../src/seed/seed.js';
import { createServer } from '../src/server.js';
import { config } from '../src/config.js';

describe('Security & Governance Enforcement Tests', () => {
  let app: any;
  let ownerToken: string;
  let riskToken: string;

  beforeAll(async () => {
    await runSeed();
    app = await createServer();

    // Authenticate owner
    const oRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: { identifier: 'owner.demo', password: 'Kestrel@Owner2026!' },
    });
    const oData = JSON.parse(oRes.body);
    const oMfa = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { challengeId: oData.challengeId, mfaCode: oData.simulatedMfaCode, requestedRole: 'owner' },
    });
    ownerToken = JSON.parse(oMfa.body).token;

    // Authenticate risk delegate
    const rRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: { identifier: 'risk.demo', password: 'Kestrel@2026!' },
    });
    const rData = JSON.parse(rRes.body);
    const rMfa = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { challengeId: rData.challengeId, mfaCode: rData.simulatedMfaCode, requestedRole: 'risk_delegate' },
    });
    riskToken = JSON.parse(rMfa.body).token;
  });

  describe('Append-Only Database Trigger Enforcements', () => {
    it('aborts any UPDATE attempt on audit_events via database trigger', () => {
      const db = getDatabase();
      const event = db.prepare('SELECT id FROM audit_events LIMIT 1').get() as any;
      expect(event).toBeDefined();

      expect(() => {
        db.prepare('UPDATE audit_events SET action = ? WHERE id = ?').run('TAMPERED_ACTION', event.id);
      }).toThrow(/append-only/i);
    });

    it('aborts any DELETE attempt on audit_events via database trigger', () => {
      const db = getDatabase();
      const event = db.prepare('SELECT id FROM audit_events LIMIT 1').get() as any;

      expect(() => {
        db.prepare('DELETE FROM audit_events WHERE id = ?').run(event.id);
      }).toThrow(/append-only/i);
    });

    it('aborts any UPDATE or DELETE attempt on access_logs via database trigger', () => {
      const db = getDatabase();
      const testId = `acc_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // Insert a dummy log
      db.prepare(`
        INSERT INTO access_logs (id, document_id, user_id, access_type, ip_address, user_agent, token_hash, accessed_at)
        VALUES (?, 'doc_1', 'usr_1', 'download', '127.0.0.1', 'test', 'hash', datetime('now'))
      `).run(testId);

      expect(() => {
        db.prepare('UPDATE access_logs SET access_type = ? WHERE id = ?').run('tampered', testId);
      }).toThrow(/append-only/i);

      expect(() => {
        db.prepare('DELETE FROM access_logs WHERE id = ?').run(testId);
      }).toThrow(/append-only/i);
    });

    it('aborts any UPDATE or DELETE attempt on llm_calls via database trigger', () => {
      const db = getDatabase();
      const testId = `call_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      db.prepare(`
        INSERT INTO llm_calls (call_id, correlation_id, agent_name, model_id, provider, input_tokens, output_tokens, cached_tokens, input_price, output_price, price_version, estimated_cost, duration_ms, timestamp, status)
        VALUES (?, 'corr_1', 'agent_test', 'model_1', 'simulated', 10, 20, 0, 1, 2, 'v1', 0.05, 100, datetime('now'), 'success')
      `).run(testId);

      expect(() => {
        db.prepare('UPDATE llm_calls SET estimated_cost = 0 WHERE call_id = ?').run(testId);
      }).toThrow(/append-only/i);

      expect(() => {
        db.prepare('DELETE FROM llm_calls WHERE call_id = ?').run(testId);
      }).toThrow(/append-only/i);
    });
  });

  describe('Prompt Governance & Two-Person Authorization Rules', () => {
    it('blocks an author from approving their own prompt version', async () => {
      // 1. Owner proposes new version
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/prompts/bank-extractor/versions',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: {
          body: 'Extract 12-month bank statements with revised schema check.',
          changeNote: 'Updated field mappings',
          riskClass: 'credit_relevant',
        },
      });
      expect(createRes.statusCode).toBe(200);
      const versionId = JSON.parse(createRes.body).versionId;

      // 2. Owner attempts to approve their own version -> MUST BE BLOCKED
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/prompt-versions/${versionId}/approve`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(approveRes.statusCode).toBe(403);
      const approveBody = JSON.parse(approveRes.body);
      expect(approveBody.error).toBe('SELF_APPROVAL_FORBIDDEN');
    });

    it('requires Risk delegate to approve credit_relevant prompt version', async () => {
      // 1. Create a prompt authored by someone else (e.g. usr_owner_2)
      const db = getDatabase();
      const pvId = `pv_test_credit_${Date.now()}`;
      db.prepare(`
        INSERT INTO prompt_versions (id, agent_id, version_number, body, change_note, author_id, status, risk_class, approver_id, created_at)
        VALUES (?, 'bank-extractor', 99, 'Test credit prompt', 'testing', 'usr_owner_2', 'pending_approval', 'credit_relevant', NULL, datetime('now'))
      `).run(pvId);

      // 2. Owner tries to approve -> rejected because owner is not risk_delegate
      const ownerApprove = await app.inject({
        method: 'POST',
        url: `/api/v1/prompt-versions/${pvId}/approve`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(ownerApprove.statusCode).toBe(403);
      expect(JSON.parse(ownerApprove.body).error).toBe('RISK_DELEGATE_REQUIRED');

      // 3. Risk delegate approves -> success!
      const riskApprove = await app.inject({
        method: 'POST',
        url: `/api/v1/prompt-versions/${pvId}/approve`,
        headers: { Authorization: `Bearer ${riskToken}` },
      });
      expect(riskApprove.statusCode).toBe(200);
      expect(JSON.parse(riskApprove.body).success).toBe(true);
    });
  });

  describe('API Key Zero-Leakage Checks', () => {
    it('verifies that no API endpoint serializes or exposes the key', async () => {
      const endpoints = [
        '/api/v1/health',
        '/api/v1/model-registry',
        '/api/v1/llm-calls',
        '/api/v1/costs/summary',
      ];

      for (const ep of endpoints) {
        const res = await app.inject({
          method: 'GET',
          url: ep,
          headers: { Authorization: `Bearer ${ownerToken}` },
        });

        // String representation of the response
        const text = res.body;

        if (config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 5) {
          expect(text).not.toContain(config.GEMINI_API_KEY);
        }
        expect(text).not.toContain('AIzaSy');
      }
    });
  });
});

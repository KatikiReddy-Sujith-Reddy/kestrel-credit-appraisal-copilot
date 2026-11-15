import { describe, it, expect, beforeAll } from 'vitest';
import { createServer } from '../src/server.js';
import { runSeed } from '../src/seed/seed.js';
import { getDatabase } from '../src/db/connection.js';

describe('Document Flow, Validation & Simulated OCR Tests', () => {
  let app: any;
  let authToken: string;
  let testAppId: string;
  let testChecklistId: string;

  beforeAll(async () => {
    await runSeed();
    app = await createServer();

    // Authenticate as RM
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: { identifier: 'rm.demo', password: 'Kestrel@RM2026!' },
    });
    const login = JSON.parse(loginRes.body);
    const mfaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { challengeId: login.challengeId, mfaCode: login.simulatedMfaCode },
    });
    authToken = JSON.parse(mfaRes.body).token;

    // Pick a test application with pending docs
    const db = getDatabase();
    const testApp = db.prepare("SELECT id FROM applications WHERE status = 'documents_pending' LIMIT 1").get() as any;
    testAppId = testApp.id;
    const testItem = db.prepare("SELECT id FROM checklist_items WHERE application_id = ? AND status = 'missing' LIMIT 1").get(testAppId) as any;
    testChecklistId = testItem ? testItem.id : `chk_${testAppId}_pan_card`;
  });

  it('generates signed short-lived document links and logs access in access_logs', async () => {
    const db = getDatabase();
    const doc = db.prepare('SELECT id FROM documents LIMIT 1').get() as any;

    // 1. Get signed access link
    const linkRes = await app.inject({
      method: 'GET',
      url: `/api/v1/documents/${doc.id}/access-link`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(linkRes.statusCode).toBe(200);
    const linkData = JSON.parse(linkRes.body);
    expect(linkData.accessUrl).toContain('/download?token=');

    // 2. Access document via signed link
    const initialLogCount = (db.prepare('SELECT count(*) as c FROM access_logs').get() as any).c;

    const accessRes = await app.inject({
      method: 'GET',
      url: linkData.accessUrl,
    });

    expect(accessRes.statusCode).toBe(200);
    expect(accessRes.headers['content-type']).toBe('application/pdf');

    // 3. Verify access_logs row was created
    const finalLogCount = (db.prepare('SELECT count(*) as c FROM access_logs').get() as any).c;
    expect(finalLogCount).toBe(initialLogCount + 1);
  });

  it('returns simulated OCR coordinates and bounding boxes labelled as simulated', async () => {
    const db = getDatabase();
    const doc = db.prepare('SELECT id FROM documents LIMIT 1').get() as any;

    const ocrRes = await app.inject({
      method: 'GET',
      url: `/api/v1/documents/${doc.id}/ocr`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(ocrRes.statusCode).toBe(200);
    const ocrData = JSON.parse(ocrRes.body);
    expect(ocrData.isSimulated).toBe(true);
    expect(ocrData.provider).toContain('Simulated');
    expect(ocrData.pages.length).toBeGreaterThan(0);
    expect(ocrData.pages[0].tokens[0].bbox).toBeDefined();
  });
});

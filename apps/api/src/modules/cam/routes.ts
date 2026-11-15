import crypto from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../../db/connection.js';
import { authenticate, requireRole } from '../../auth/middleware.js';
import { recordAuditEvent } from '../../db/audit.js';
import { checkCamGrounding } from '../../engines/grounding.js';
import { ModelGateway } from '../../gateway/gateway.js';

export async function camRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get CAM Draft for Application
  app.get('/api/v1/applications/:id/cam-draft', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    const cam = db.prepare('SELECT * FROM cam_drafts WHERE application_id = ? ORDER BY created_at DESC, version_number DESC LIMIT 1').get(applicationId) as any;
    if (!cam) {
      return reply.status(404).send({ error: 'CAM_NOT_FOUND', message: 'No CAM drafted yet for this application.' });
    }

    const sections = db.prepare('SELECT * FROM cam_sections WHERE cam_draft_id = ? ORDER BY ordering ASC').all(cam.id) as any[];
    const citations = db.prepare('SELECT * FROM citations WHERE cam_draft_id = ? ORDER BY citation_number ASC').all(cam.id) as any[];
    const signoff = db.prepare('SELECT * FROM verification_signoffs WHERE application_id = ? ORDER BY signed_at DESC LIMIT 1').get(applicationId) as any;

    return reply.send({
      cam: {
        ...cam,
        isGroundingValid: Boolean(cam.is_grounding_valid),
      },
      sections,
      citations: citations.map(c => ({
        ...c,
        boundingBox: c.bounding_box_json ? JSON.parse(c.bounding_box_json) : null,
      })),
      signoff,
    });
  });

  // 2. Generate or Regenerate CAM Draft via Model Gateway
  app.post('/api/v1/applications/:id/cam-drafts', { preHandler: [authenticate, requireRole(['analyst', 'owner'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as any;
    if (!application) {
      return reply.status(404).send({ error: 'APPLICATION_NOT_FOUND' });
    }

    // Call Model Gateway
    const gatewayRes = await ModelGateway.complete({
      agentName: 'cam-draft',
      applicationId,
      userPrompt: `Draft grounded Credit Appraisal Memorandum for ${application.business_name} with loan facility $${application.loan_amount.toLocaleString('en-US')}.`,
      inputs: {
        businessName: application.business_name,
        loanAmount: `$${application.loan_amount.toLocaleString('en-US')}`,
        turnover: '$450,000',
        dscr: '1.35',
        currentRatio: '1.25',
      },
      dataClassification: 'synthetic',
      correlationId: req.correlationId,
    });

    const camId = `cam_${applicationId}_${Date.now()}`;
    const camTitle = `Credit Appraisal Memorandum: ${application.business_name}`;

    db.prepare(`
      INSERT INTO cam_drafts (id, application_id, version_number, title, status, overall_summary, is_grounding_valid, created_at, updated_at)
      VALUES (?, ?, 1, ?, 'draft', ?, 1, datetime('now'), datetime('now'))
    `).run(camId, applicationId, camTitle, gatewayRes.content);

    // Save Sections
    db.prepare(`
      INSERT INTO cam_sections (id, cam_draft_id, section_key, section_title, content_text, ordering, created_at, updated_at)
      VALUES (?, ?, 'executive_summary', '1. Executive Summary & Facility Request', ?, 1, datetime('now'), datetime('now'))
    `).run(`sec_${camId}_1`, camId, gatewayRes.content);

    // Citations
    const citationsList = [
      { num: 1, marker: '[1]', excerpt: 'Loan facility request form', page: 1 },
      { num: 2, marker: '[2]', excerpt: '12-month operative bank statement credits', page: 3 },
      { num: 3, marker: '[3]', excerpt: 'Deterministic ratio engine DSCR computation', page: 1 },
      { num: 4, marker: '[4]', excerpt: 'Balance sheet liquidity schedule', page: 2 },
      { num: 5, marker: '[5]', excerpt: 'Credit policy covenant matrix', page: 4 },
    ];

    const insertCit = db.prepare(`
      INSERT INTO citations (id, cam_draft_id, citation_number, marker, entity_type, source_excerpt, source_page, created_at)
      VALUES (?, ?, ?, ?, 'application', ?, ?, datetime('now'))
    `);

    for (const c of citationsList) {
      insertCit.run(`cit_${camId}_${c.num}`, camId, c.num, c.marker, c.excerpt, c.page);
    }

    return reply.send({ success: true, camId, content: gatewayRes.content });
  });

  // 3. Edit CAM Section
  app.patch('/api/v1/cam-drafts/:id/sections/:sectionKey', { preHandler: [authenticate, requireRole(['analyst', 'credit_manager', 'owner'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: camDraftId, sectionKey } = req.params as { id: string; sectionKey: string };
    const schema = z.object({
      contentText: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    db.prepare(`
      UPDATE cam_sections
      SET content_text = ?, updated_at = datetime('now')
      WHERE cam_draft_id = ? AND section_key = ?
    `).run(parsed.data.contentText, camDraftId, sectionKey);

    recordAuditEvent({
      entityType: 'cam_draft',
      entityId: camDraftId,
      action: 'CAM_SECTION_EDITED',
      actorId: req.user!.userId,
      actorRole: req.user!.activeRole,
      correlationId: req.correlationId,
      payload: { sectionKey, textLength: parsed.data.contentText.length },
    });

    return reply.send({ success: true, message: 'Section updated.' });
  });

  // 4. Grounding Check for CAM
  app.get('/api/v1/cam-drafts/:id/grounding-check', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: camDraftId } = req.params as { id: string };
    const db = getDatabase();

    const sections = db.prepare('SELECT content_text FROM cam_sections WHERE cam_draft_id = ?').all(camDraftId) as { content_text: string }[];
    const citations = db.prepare('SELECT marker FROM citations WHERE cam_draft_id = ?').all(camDraftId) as { marker: string }[];

    const fullText = sections.map(s => s.content_text).join(' ');
    const validMarkers = citations.map(c => c.marker);

    const report = checkCamGrounding(fullText, validMarkers);

    // Update is_grounding_valid on cam_drafts
    db.prepare(`
      UPDATE cam_drafts
      SET is_grounding_valid = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(report.isValid ? 1 : 0, camDraftId);

    return reply.send({ groundingReport: report });
  });

  // 5. Verification Sign-Off by Analyst
  app.post('/api/v1/applications/:id/verification-signoff', { preHandler: [authenticate, requireRole(['analyst', 'owner'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const schema = z.object({
      statement: z.string().min(10, 'Formal sign-off statement is required.'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    const analystId = req.user!.userId;
    const signoffId = `sign_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const auditHash = crypto.createHash('sha256').update(`${signoffId}|${applicationId}|${analystId}|${timestamp}|${parsed.data.statement}`).digest('hex');

    db.prepare(`
      INSERT INTO verification_signoffs (id, application_id, analyst_id, signoff_statement, signed_at, audit_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(signoffId, applicationId, analystId, parsed.data.statement, timestamp, auditHash);

    recordAuditEvent({
      entityType: 'verification_signoff',
      entityId: signoffId,
      action: 'ANALYST_FORMAL_VERIFICATION_SIGNED',
      actorId: analystId,
      actorRole: 'analyst',
      correlationId: req.correlationId,
      payload: { applicationId, auditHash, statement: parsed.data.statement },
    });

    return reply.send({ success: true, signoffId, auditHash, signedAt: timestamp });
  });

  // 6. Submit CAM to Credit Manager Queue (GATED)
  app.post('/api/v1/cam-drafts/:id/submit', { preHandler: [authenticate, requireRole(['analyst', 'owner'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: camDraftId } = req.params as { id: string };
    const db = getDatabase();

    const cam = db.prepare('SELECT * FROM cam_drafts WHERE id = ?').get(camDraftId) as any;
    if (!cam) {
      return reply.status(404).send({ error: 'CAM_NOT_FOUND' });
    }

    const applicationId = cam.application_id;

    // Check 1: Formal verification signoff
    const signoff = db.prepare('SELECT * FROM verification_signoffs WHERE application_id = ?').get(applicationId) as any;
    if (!signoff) {
      return reply.status(400).send({
        error: 'SUBMISSION_BLOCKED',
        message: 'Submission blocked: Analyst formal verification sign-off is required before submitting.',
      });
    }

    // Check 2: Unresolved material discrepancies
    const openMaterialDiscrepancies = db.prepare(`
      SELECT count(*) as count FROM discrepancies
      WHERE application_id = ? AND is_material = 1 AND status = 'open'
    `).get(applicationId) as any;

    if (openMaterialDiscrepancies.count > 0) {
      return reply.status(400).send({
        error: 'SUBMISSION_BLOCKED',
        message: `Submission blocked: ${openMaterialDiscrepancies.count} open material discrepancy(s) must be resolved (explained, corrected, or escalated).`,
      });
    }

    // Check 3: Grounding check
    const sections = db.prepare('SELECT content_text FROM cam_sections WHERE cam_draft_id = ?').all(camDraftId) as { content_text: string }[];
    const citations = db.prepare('SELECT marker FROM citations WHERE cam_draft_id = ?').all(camDraftId) as { marker: string }[];
    const fullText = sections.map(s => s.content_text).join(' ');
    const report = checkCamGrounding(fullText, citations.map(c => c.marker));

    if (!report.isValid) {
      return reply.status(400).send({
        error: 'SUBMISSION_BLOCKED',
        message: `Submission blocked: ${report.uncitedSentenceCount} uncited sentence(s) remain in the CAM draft. Every factual assertion must be cited.`,
        uncitedSentences: report.uncitedSentences,
      });
    }

    // All gates pass: Update CAM status and transition application to credit_review
    db.prepare("UPDATE cam_drafts SET status = 'submitted', updated_at = datetime('now') WHERE id = ?").run(camDraftId);
    db.prepare("UPDATE applications SET status = 'credit_review', updated_at = datetime('now') WHERE id = ?").run(applicationId);

    recordAuditEvent({
      entityType: 'cam_draft',
      entityId: camDraftId,
      action: 'CAM_SUBMITTED_TO_CREDIT_REVIEW',
      actorId: req.user!.userId,
      actorRole: 'analyst',
      correlationId: req.correlationId,
      payload: { applicationId, camDraftId },
    });

    return reply.send({ success: true, message: 'Application submitted to Credit Manager review queue.' });
  });
}

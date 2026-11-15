import crypto from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../../db/connection.js';
import { authenticate, requireRole } from '../../auth/middleware.js';
import { recordAuditEvent } from '../../db/audit.js';
import { ModelGateway } from '../../gateway/gateway.js';

export async function followupRoutes(app: FastifyInstance): Promise<void> {
  const allowedRoles = ['rm', 'analyst', 'credit_manager', 'owner'];

  // 1. Generate Follow-Up Draft
  app.post('/api/v1/applications/:id/follow-up-drafts', { preHandler: [authenticate, requireRole(allowedRoles)] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    const appRecord = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as any;
    if (!appRecord) {
      return reply.status(404).send({ error: 'APPLICATION_NOT_FOUND', message: `Application ${applicationId} not found.` });
    }

    // Missing checklist items
    const missingItems = db.prepare(`
      SELECT label FROM checklist_items
      WHERE application_id = ? AND status IN ('missing', 'invalid', 'expired')
    `).all(applicationId) as { label: string }[];

    const missingList = missingItems.length > 0
      ? missingItems.map(i => i.label)
      : ['Audited Financial Statements (Balance Sheet & P&L)', 'Latest 3 Months Operative Bank Account Statements'];

    try {
      const gatewayRes = await ModelGateway.complete({
        agentName: 'followup-draft',
        applicationId,
        userPrompt: `Draft borrower follow-up reminder for missing items: ${missingList.join(', ')}`,
        inputs: {
          borrowerName: appRecord.business_name,
          loanAmount: `$${appRecord.loan_amount.toLocaleString('en-US')}`,
          missingItems: missingList,
        },
        dataClassification: 'synthetic',
        correlationId: req.correlationId,
      });

      const draftId = `fup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const subject = gatewayRes.parsedJson?.subject || `Missing Documentation for Working Capital Facility: ${appRecord.business_name}`;
      const bodyText = gatewayRes.parsedJson?.body || gatewayRes.content;
      const recipientEmail = `${appRecord.business_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@synthetic-client.in`;

      db.prepare(`
        INSERT INTO follow_up_drafts (id, application_id, channel, recipient_email, subject, body_text, missing_items_json, status, exclusions_acknowledged, created_at)
        VALUES (?, ?, 'email', ?, ?, ?, ?, 'draft', 0, datetime('now'))
      `).run(draftId, applicationId, recipientEmail, subject, bodyText, JSON.stringify(missingList));

      recordAuditEvent({
        entityType: 'follow_up_draft',
        entityId: draftId,
        action: 'FOLLOWUP_DRAFT_GENERATED',
        actorId: req.user!.userId,
        actorRole: req.user!.activeRole,
        correlationId: req.correlationId,
        payload: { applicationId, missingCount: missingList.length },
      });

      return reply.send({
        id: draftId,
        recipientEmail,
        subject,
        bodyText,
        missingItems: missingList,
        status: 'draft',
      });
    } catch (err: any) {
      console.error('[Follow-up Gateway Error]', err);
      // Fallback deterministic draft synthesis in case gateway errors
      const draftId = `fup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const subject = `Urgent: Outstanding Documentation Required for ${appRecord.business_name}`;
      const bodyText = `Dear ${appRecord.business_name},\n\n` +
        `Regarding your working capital loan application for $${appRecord.loan_amount.toLocaleString('en-US')}, ` +
        `we have reviewed your submission and require the following documentation to complete credit appraisal:\n\n` +
        missingList.map((item, idx) => `${idx + 1}. ${item}`).join('\n') +
        `\n\nPlease upload these documents through the secure customer portal at your earliest convenience.\n` +
        `Security Notice: Kestrel will never ask for your banking passwords, ATM PINs, or SMS OTPs.\n\n` +
        `Warm regards,\nCredit Appraisal Team\nKestrel Financial Services`;
      const recipientEmail = `${appRecord.business_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@synthetic-client.in`;

      db.prepare(`
        INSERT INTO follow_up_drafts (id, application_id, channel, recipient_email, subject, body_text, missing_items_json, status, exclusions_acknowledged, created_at)
        VALUES (?, ?, 'email', ?, ?, ?, ?, 'draft', 0, datetime('now'))
      `).run(draftId, applicationId, recipientEmail, subject, bodyText, JSON.stringify(missingList));

      return reply.send({
        id: draftId,
        recipientEmail,
        subject,
        bodyText,
        missingItems: missingList,
        status: 'draft',
      });
    }
  });

  // 2. Edit Follow-Up Draft
  app.patch('/api/v1/follow-up-drafts/:id', { preHandler: [authenticate, requireRole(allowedRoles)] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: draftId } = req.params as { id: string };
    const schema = z.object({
      subject: z.string().min(1),
      bodyText: z.string().min(1),
      recipientEmail: z.string().email(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    db.prepare(`
      UPDATE follow_up_drafts
      SET subject = ?, body_text = ?, recipient_email = ?
      WHERE id = ?
    `).run(parsed.data.subject, parsed.data.bodyText, parsed.data.recipientEmail, draftId);

    return reply.send({ success: true, message: 'Draft updated.' });
  });

  // 3. Send Follow-Up Draft (Exclusion disclaimer must be acknowledged)
  app.post('/api/v1/follow-up-drafts/:id/send', { preHandler: [authenticate, requireRole(allowedRoles)] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: draftId } = req.params as { id: string };
    const schema = z.object({
      confirmExclusions: z.boolean().refine(val => val === true, {
        message: 'You must explicitly confirm that the communication excludes requests for sensitive passwords, PINs, or banking OTPs.',
      }),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM follow_up_drafts WHERE id = ?').get(draftId) as any;
    if (!existing) {
      return reply.status(404).send({ error: 'DRAFT_NOT_FOUND' });
    }

    const senderId = req.user!.userId;
    const sentAt = new Date().toISOString();

    db.prepare(`
      UPDATE follow_up_drafts
      SET status = 'sent', exclusions_acknowledged = 1, sent_at = ?, sent_by = ?
      WHERE id = ?
    `).run(sentAt, senderId, draftId);

    recordAuditEvent({
      entityType: 'follow_up_draft',
      entityId: draftId,
      action: 'FOLLOWUP_COMMUNICATION_DISPATCHED',
      actorId: senderId,
      actorRole: req.user!.activeRole,
      correlationId: req.correlationId,
      payload: {
        applicationId: existing.application_id,
        recipientEmail: existing.recipient_email,
        exclusionsAcknowledged: true,
      },
    });

    return reply.send({ success: true, sentAt, message: 'Follow-up communication successfully dispatched.' });
  });
}

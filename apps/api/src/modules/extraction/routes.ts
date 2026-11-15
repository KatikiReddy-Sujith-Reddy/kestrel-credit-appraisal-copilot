import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { getDatabase } from '../../db/connection.js';
import { authenticate, requireRole } from '../../auth/middleware.js';
import { recordAuditEvent } from '../../db/audit.js';

export async function extractionRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get Extraction Fields for Application
  app.get('/api/v1/applications/:id/extractions', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    const fields = db.prepare(`
      SELECT ef.*, d.original_name as source_document_name
      FROM extraction_fields ef
      LEFT JOIN documents d ON ef.source_document_id = d.id
      WHERE ef.application_id = ?
      ORDER BY ef.category ASC, ef.period_month DESC
    `).all(applicationId) as any[];

    const parsedFields = fields.map(f => ({
      ...f,
      autoAccepted: Boolean(f.auto_accepted),
      verified: Boolean(f.verified),
      edited: Boolean(f.edited),
      boundingBox: f.bounding_box_json ? JSON.parse(f.bounding_box_json) : null,
    }));

    return reply.send({
      extractions: parsedFields,
      summary: {
        total: fields.length,
        autoAccepted: fields.filter(f => f.auto_accepted).length,
        flaggedForReview: fields.filter(f => !f.auto_accepted && !f.verified).length,
        verified: fields.filter(f => f.verified).length,
        edited: fields.filter(f => f.edited).length,
      },
    });
  });

  // 2. Edit Extraction Field (REASON REQUIRED, APPEND-ONLY EDIT HISTORY)
  app.patch('/api/v1/extractions/:fieldId', { preHandler: [authenticate, requireRole(['analyst', 'credit_manager'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { fieldId } = req.params as { fieldId: string };
    const schema = z.object({
      newValue: z.string().min(1),
      normalizedValue: z.number().optional(),
      reason: z.string().min(5, 'A clear underwriting reason is mandatory for altering extracted ledger values.'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM extraction_fields WHERE id = ?').get(fieldId) as any;
    if (!existing) {
      return reply.status(404).send({ error: 'FIELD_NOT_FOUND' });
    }

    const historyId = `hist_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const editorId = req.user!.userId;
    const editorRole = req.user!.activeRole;

    // 1. Insert into extraction_field_history (APPEND-ONLY)
    db.prepare(`
      INSERT INTO extraction_field_history (id, field_id, previous_value, new_value, edit_reason, edited_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(historyId, fieldId, existing.extracted_value, parsed.data.newValue, parsed.data.reason, editorId);

    // 2. Update field
    db.prepare(`
      UPDATE extraction_fields
      SET extracted_value = ?, normalized_value = ?, edited = 1, verified = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(parsed.data.newValue, parsed.data.normalizedValue || null, fieldId);

    // 3. Record Audit Event
    recordAuditEvent({
      entityType: 'extraction_field',
      entityId: fieldId,
      action: 'EXTRACTION_FIELD_MANUALLY_CORRECTED',
      actorId: editorId,
      actorRole: editorRole,
      correlationId: req.correlationId,
      payload: {
        applicationId: existing.application_id,
        fieldKey: existing.field_key,
        previousValue: existing.extracted_value,
        newValue: parsed.data.newValue,
        reason: parsed.data.reason,
      },
    });

    return reply.send({ success: true, message: 'Field updated and immutable edit history recorded.' });
  });

  // 3. Bulk Verify Extractions
  app.post('/api/v1/applications/:id/verify-bulk', { preHandler: [authenticate, requireRole(['analyst', 'owner'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    db.prepare(`
      UPDATE extraction_fields
      SET verified = 1, updated_at = datetime('now')
      WHERE application_id = ?
    `).run(applicationId);

    recordAuditEvent({
      entityType: 'application',
      entityId: applicationId,
      action: 'ALL_EXTRACTION_FIELDS_BULK_VERIFIED',
      actorId: req.user!.userId,
      actorRole: req.user!.activeRole,
      correlationId: req.correlationId,
      payload: { applicationId },
    });

    return reply.send({ success: true, message: 'All extracted fields successfully verified.' });
  });

  // 4. Get Field History (APPEND-ONLY AUDIT LEDGER)
  app.get('/api/v1/extractions/:fieldId/history', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { fieldId } = req.params as { fieldId: string };
    const db = getDatabase();

    const history = db.prepare(`
      SELECT efh.*, u.full_name as editor_name
      FROM extraction_field_history efh
      LEFT JOIN users u ON efh.edited_by = u.id
      WHERE efh.field_id = ?
      ORDER BY efh.created_at DESC
    `).all(fieldId) as any[];

    return reply.send({ history });
  });
}

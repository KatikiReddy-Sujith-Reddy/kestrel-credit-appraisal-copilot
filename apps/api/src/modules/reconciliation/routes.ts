import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../../db/connection.js';
import { authenticate, requireRole } from '../../auth/middleware.js';
import { recordAuditEvent } from '../../db/audit.js';
import { reconcileBankAndGst } from '../../engines/reconciliation.js';

export async function reconciliationRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get Monthly Reconciliation Ledger
  app.get('/api/v1/applications/:id/reconciliation', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    // Fetch tolerance config
    const toleranceItem = db.prepare("SELECT value FROM configuration_items WHERE key = 'reconciliation_tolerance_pct'").get() as any;
    const tolerance = toleranceItem ? parseFloat(toleranceItem.value) : 10.0;

    // Fetch monthly bank credits and GST turnover
    const bankFields = db.prepare(`
      SELECT period_month as month, normalized_value as amount
      FROM extraction_fields
      WHERE application_id = ? AND category = 'bank' AND period_month IS NOT NULL
      ORDER BY period_month DESC
    `).all(applicationId) as any[];

    const gstFields = db.prepare(`
      SELECT period_month as month, normalized_value as amount
      FROM extraction_fields
      WHERE application_id = ? AND category = 'gst' AND period_month IS NOT NULL
      ORDER BY period_month DESC
    `).all(applicationId) as any[];

    const report = reconcileBankAndGst(
      bankFields.map(b => ({ month: b.month, amount: b.amount || 0 })),
      gstFields.map(g => ({ month: g.month, amount: g.amount || 0 })),
      tolerance
    );

    return reply.send({
      reconciliation: report,
    });
  });

  // 2. Get Discrepancies
  app.get('/api/v1/applications/:id/discrepancies', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    const discrepancies = db.prepare('SELECT * FROM discrepancies WHERE application_id = ? ORDER BY created_at DESC').all(applicationId) as any[];

    return reply.send({
      discrepancies: discrepancies.map(d => ({
        ...d,
        isMaterial: Boolean(d.is_material),
      })),
    });
  });

  // 3. Resolve Discrepancy (explain, correct, escalate)
  app.post('/api/v1/discrepancies/:id/resolutions', { preHandler: [authenticate, requireRole(['analyst', 'credit_manager', 'owner'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: discrepancyId } = req.params as { id: string };
    const schema = z.object({
      resolutionType: z.enum(['explained', 'corrected', 'escalated']),
      notes: z.string().min(5, 'Detailed rationale is mandatory for resolving a reconciliation discrepancy.'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(discrepancyId) as any;
    if (!existing) {
      return reply.status(404).send({ error: 'DISCREPANCY_NOT_FOUND' });
    }

    const resolverId = req.user!.userId;
    const resolverRole = req.user!.activeRole;

    db.prepare(`
      UPDATE discrepancies
      SET status = ?, resolution_type = ?, resolution_notes = ?, resolved_by = ?, resolved_at = datetime('now')
      WHERE id = ?
    `).run(parsed.data.resolutionType, parsed.data.resolutionType, parsed.data.notes, resolverId, discrepancyId);

    recordAuditEvent({
      entityType: 'discrepancy',
      entityId: discrepancyId,
      action: `DISCREPANCY_RESOLVED_${parsed.data.resolutionType.toUpperCase()}`,
      actorId: resolverId,
      actorRole: resolverRole,
      correlationId: req.correlationId,
      payload: {
        applicationId: existing.application_id,
        discrepancyId,
        resolutionType: parsed.data.resolutionType,
        notes: parsed.data.notes,
      },
    });

    return reply.send({ success: true, message: 'Discrepancy successfully resolved.' });
  });

  // 4. Get Deterministic Ratios
  app.get('/api/v1/applications/:id/ratios', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    const ratios = db.prepare('SELECT * FROM ratios WHERE application_id = ? ORDER BY rowid ASC').all(applicationId) as any[];

    return reply.send({
      ratios: ratios.map(r => ({
        ...r,
        inputs: JSON.parse(r.inputs_json || '{}'),
      })),
    });
  });
}

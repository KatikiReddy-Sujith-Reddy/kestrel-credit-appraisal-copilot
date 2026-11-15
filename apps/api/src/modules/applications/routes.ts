import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../../db/connection.js';
import { authenticate } from '../../auth/middleware.js';
import { recordAuditEvent } from '../../db/audit.js';

export async function applicationRoutes(app: FastifyInstance): Promise<void> {
  // 1. List Applications with filters
  app.get('/api/v1/applications', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();
    const query = req.query as {
      status?: string;
      pilotOnly?: string;
      search?: string;
      role?: string;
    };

    let sql = 'SELECT * FROM applications WHERE 1=1';
    const params: any[] = [];

    if (query.status && query.status !== 'all') {
      sql += ' AND status = ?';
      params.push(query.status);
    }

    if (query.pilotOnly === 'true') {
      sql += ' AND pilot_scope_flag = 1';
    }

    if (query.search) {
      sql += ' AND (lower(business_name) LIKE ? OR lower(application_number) LIKE ?)';
      params.push(`%${query.search.toLowerCase()}%`, `%${query.search.toLowerCase()}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const applications = db.prepare(sql).all(...params) as any[];

    // Fetch checklist summary for each application
    const results = applications.map((a) => {
      const items = db.prepare('SELECT status, required FROM checklist_items WHERE application_id = ?').all(a.id) as any[];
      const missingCount = items.filter(i => i.status === 'missing' || i.status === 'invalid' || i.status === 'expired').length;
      return {
        ...a,
        pilotScopeFlag: Boolean(a.pilot_scope_flag),
        checklistTotal: items.length,
        checklistMissing: missingCount,
      };
    });

    return reply.send({ applications: results, total: results.length });
  });

  // 2. Application Detail
  app.get('/api/v1/applications/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const db = getDatabase();

    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as any;
    if (!application) {
      return reply.status(404).send({ error: 'APPLICATION_NOT_FOUND' });
    }

    // Checklist items
    const checklist = db.prepare(`
      SELECT ci.*, d.original_name as document_name, d.mime_type as document_mime
      FROM checklist_items ci
      LEFT JOIN documents d ON ci.document_id = d.id
      WHERE ci.application_id = ?
      ORDER BY ci.item_key ASC
    `).all(id) as any[];

    // Documents
    const documents = db.prepare('SELECT * FROM documents WHERE application_id = ? ORDER BY created_at DESC').all(id) as any[];

    // Follow-ups
    const followups = db.prepare('SELECT * FROM follow_up_drafts WHERE application_id = ? ORDER BY created_at DESC').all(id) as any[];

    // Discrepancies count
    const discrepancies = db.prepare('SELECT * FROM discrepancies WHERE application_id = ?').all(id) as any[];

    return reply.send({
      application: {
        ...application,
        pilotScopeFlag: Boolean(application.pilot_scope_flag),
      },
      checklist: checklist.map(c => ({
        ...c,
        required: Boolean(c.required),
        allowedFileTypes: JSON.parse(c.allowed_file_types || '[]'),
      })),
      documents,
      followups: followups.map(f => ({
        ...f,
        missingItems: JSON.parse(f.missing_items_json || '[]'),
      })),
      discrepancies,
    });
  });

  // 3. Application Timeline / Audit Trail
  app.get('/api/v1/applications/:id/timeline', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const db = getDatabase();

    const events = db.prepare(`
      SELECT * FROM audit_events
      WHERE entity_id = ? OR payload_json LIKE ?
      ORDER BY timestamp DESC
    `).all(id, `%"applicationId":"${id}"%`) as any[];

    return reply.send({
      timeline: events.map(e => ({
        ...e,
        payload: JSON.parse(e.payload_json || '{}'),
      })),
    });
  });
}

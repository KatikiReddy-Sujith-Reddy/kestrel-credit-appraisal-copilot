import crypto from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../../db/connection.js';
import { authenticate, requireRole } from '../../auth/middleware.js';
import { recordAuditEvent } from '../../db/audit.js';

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  // 1. Credit Review Queue
  app.get('/api/v1/credit-review/queue', { preHandler: [authenticate, requireRole(['credit_manager', 'owner'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    const queue = db.prepare(`
      SELECT a.*, u.full_name as rm_name, u2.full_name as analyst_name
      FROM applications a
      LEFT JOIN users u ON a.rm_user_id = u.id
      LEFT JOIN users u2 ON a.analyst_user_id = u2.id
      WHERE a.status IN ('credit_review', 'returned_to_analyst')
      ORDER BY a.created_at DESC
    `).all() as any[];

    return reply.send({
      disclaimer: 'Not a credit decision. Formal sanction is executed in the production Loan Origination System (LOS).',
      queue: queue.map(q => ({
        ...q,
        pilotScopeFlag: Boolean(q.pilot_scope_flag),
      })),
    });
  });

  // 2. Perform Review Action ('return' or 'complete')
  app.post('/api/v1/applications/:id/review-actions', { preHandler: [authenticate, requireRole(['credit_manager'])] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const schema = z.object({
      actionType: z.enum(['return', 'complete']),
      comments: z.string().min(5, 'Mandatory review comments are required for audit trail.'),
      losReference: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    const appRecord = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as any;
    if (!appRecord) {
      return reply.status(404).send({ error: 'APPLICATION_NOT_FOUND' });
    }

    const cmId = req.user!.userId;
    const reviewId = `rev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Record review action
    db.prepare(`
      INSERT INTO review_actions (id, application_id, credit_manager_id, action_type, comments, los_reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(reviewId, applicationId, cmId, parsed.data.actionType, parsed.data.comments, parsed.data.losReference || null);

    // Update application state
    const newStatus = parsed.data.actionType === 'return' ? 'returned_to_analyst' : 'review_completed';
    db.prepare(`
      UPDATE applications
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, applicationId);

    // Also update CAM status if returning
    if (parsed.data.actionType === 'return') {
      db.prepare("UPDATE cam_drafts SET status = 'returned', updated_at = datetime('now') WHERE application_id = ?").run(applicationId);
    }

    recordAuditEvent({
      entityType: 'review_action',
      entityId: reviewId,
      action: parsed.data.actionType === 'return' ? 'CREDIT_REVIEW_RETURNED_FOR_CORRECTION' : 'CREDIT_REVIEW_COMPLETED',
      actorId: cmId,
      actorRole: 'credit_manager',
      correlationId: req.correlationId,
      payload: {
        applicationId,
        actionType: parsed.data.actionType,
        comments: parsed.data.comments,
        losReference: parsed.data.losReference,
        disclaimerNotice: 'Not a credit decision. Formal sanction is executed in LOS.',
      },
    });

    return reply.send({
      success: true,
      actionType: parsed.data.actionType,
      newStatus,
      disclaimer: 'Not a credit decision. Formal sanction is executed in LOS.',
    });
  });

  // 3. Comments (Threaded Communication with Mentions)
  app.get('/api/v1/applications/:id/comments', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const db = getDatabase();

    const comments = db.prepare(`
      SELECT * FROM comments
      WHERE application_id = ?
      ORDER BY created_at ASC
    `).all(applicationId) as any[];

    return reply.send({
      comments: comments.map(c => ({
        ...c,
        mentions: JSON.parse(c.mentions_json || '[]'),
      })),
    });
  });

  app.post('/api/v1/applications/:id/comments', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };
    const schema = z.object({
      content: z.string().min(1),
      mentions: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const db = getDatabase();
    const commentId = `cmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const authorId = req.user!.userId;
    const authorName = req.user!.fullName;
    const authorRole = req.user!.activeRole;

    db.prepare(`
      INSERT INTO comments (id, application_id, author_id, author_name, author_role, content, mentions_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(commentId, applicationId, authorId, authorName, authorRole, parsed.data.content, JSON.stringify(parsed.data.mentions || []));

    recordAuditEvent({
      entityType: 'comment',
      entityId: commentId,
      action: 'THREADED_COMMENT_POSTED',
      actorId: authorId,
      actorRole: authorRole,
      correlationId: req.correlationId,
      payload: { applicationId, mentions: parsed.data.mentions },
    });

    return reply.send({ success: true, commentId });
  });
}

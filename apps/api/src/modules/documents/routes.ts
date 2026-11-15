import fs from 'fs';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../auth/middleware.js';
import { DocumentService } from './service.js';

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  // 1. Upload Document against Checklist Item
  app.post('/api/v1/applications/:id/documents', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: applicationId } = req.params as { id: string };

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: 'FILE_REQUIRED', message: 'No file uploaded in multipart payload.' });
    }

    const fields = data.fields as Record<string, any>;
    const checklistItemId = fields.checklistItemId?.value || fields.checklistId?.value;

    if (!checklistItemId) {
      return reply.status(400).send({ error: 'CHECKLIST_ITEM_REQUIRED', message: 'checklistItemId field is required.' });
    }

    const fileBuffer = await data.toBuffer();
    const uploadedBy = req.user!.userId;

    try {
      const result = await DocumentService.processUpload(
        applicationId,
        checklistItemId,
        data.filename,
        fileBuffer,
        uploadedBy,
        req.correlationId
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: 'UPLOAD_PROCESSING_ERROR', message: err.message });
    }
  });

  // 2. Generate Signed Access Link (5-minute expiration)
  app.get('/api/v1/documents/:id/access-link', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: documentId } = req.params as { id: string };
    const link = DocumentService.createSignedAccessLink(documentId, req.user!.userId, 300);
    return reply.send(link);
  });

  // 3. Download/View via Signed Link (writes access_logs)
  app.get('/api/v1/documents/:id/download', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: documentId } = req.params as { id: string };
    const query = req.query as { token?: string; expires?: string; user?: string };

    if (!query.token || !query.expires || !query.user) {
      return reply.status(400).send({ error: 'INVALID_PARAMETERS', message: 'Signed token, expiry and user required.' });
    }

    try {
      const access = DocumentService.verifyAndAccessDocument(
        documentId,
        query.token,
        parseInt(query.expires, 10),
        query.user,
        req.ip,
        req.headers['user-agent']
      );

      if (!fs.existsSync(access.storagePath)) {
        return reply.status(404).send({ error: 'FILE_NOT_FOUND', message: 'Document file missing on storage disk.' });
      }

      const stream = fs.createReadStream(access.storagePath);
      reply.header('Content-Type', access.mimeType);
      reply.header('Content-Disposition', `inline; filename="${access.originalName}"`);
      return reply.send(stream);
    } catch (err: any) {
      if (err.message.startsWith('LINK_EXPIRED')) {
        return reply.status(410).send({ error: 'LINK_EXPIRED', message: err.message });
      }
      return reply.status(403).send({ error: 'FORBIDDEN', message: err.message });
    }
  });

  // 4. Simulated OCR Text Layer and Bounding Boxes
  app.get('/api/v1/documents/:id/ocr', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: documentId } = req.params as { id: string };
    try {
      const ocrData = DocumentService.getSimulatedOcr(documentId);
      return reply.send(ocrData);
    } catch (err: any) {
      return reply.status(404).send({ error: 'DOCUMENT_NOT_FOUND', message: err.message });
    }
  });
}

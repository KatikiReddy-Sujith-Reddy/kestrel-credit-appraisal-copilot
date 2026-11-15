import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDatabase } from '../../db/connection.js';
import { recordAuditEvent } from '../../db/audit.js';
import { sniffMimeTypeFromBuffer, validateDocument, NAMED_RULES, ValidationResult } from '../../engines/validation.js';
import { config } from '../../config.js';

export interface UploadResult {
  documentId: string;
  checklistId: string;
  filename: string;
  validation: ValidationResult;
  simulatedOcr: {
    isSimulated: boolean;
    pageCount: number;
    textLayers: any[];
  };
}

export class DocumentService {
  static async processUpload(
    applicationId: string,
    checklistItemId: string,
    originalFilename: string,
    fileBuffer: Buffer,
    uploadedBy: string,
    correlationId?: string
  ): Promise<UploadResult> {
    const db = getDatabase();

    // 1. MIME sniffing
    const detectedMime = sniffMimeTypeFromBuffer(fileBuffer) || 'application/octet-stream';
    const sizeBytes = fileBuffer.length;

    // 2. Deterministic validation
    const validation = validateDocument({
      filename: originalFilename,
      mimeType: detectedMime,
      sizeBytes,
      isReadable: true,
      periodMonthsCovered: 12,
    });

    // 3. Save to disk
    const docsDir = path.join(config.DATA_DIR, 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const documentId = `doc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const storageFilename = `${documentId}_${path.basename(originalFilename)}`;
    const storagePath = path.join(docsDir, storageFilename);
    fs.writeFileSync(storagePath, fileBuffer);

    // 4. Save document record
    const status = validation.isValid ? 'validated' : 'rejected';
    const validationErrorsJson = validation.errors.length > 0 ? JSON.stringify(validation.errors) : null;

    db.prepare(`
      INSERT INTO documents (
        id, application_id, checklist_item_id, filename, original_name, mime_type,
        size_bytes, storage_path, is_synthetic, page_count, status, validation_errors,
        uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, datetime('now'))
    `).run(
      documentId,
      applicationId,
      checklistItemId,
      storageFilename,
      originalFilename,
      detectedMime,
      sizeBytes,
      storagePath,
      status,
      validationErrorsJson,
      uploadedBy
    );

    // 5. Generate and store simulated OCR text layer with page coordinates
    const simulatedTokens = [
      { word: originalFilename.replace(/\.[^.]+$/, ''), bbox: [50, 40, 260, 60], page: 1, confidence: 0.99 },
      { word: 'SYNTHETIC_DOCUMENT_LAYER', bbox: [50, 70, 280, 85], page: 1, confidence: 0.98 },
      { word: `Processed: ${new Date().toISOString()}`, bbox: [50, 95, 300, 110], page: 1, confidence: 0.97 },
      { word: `File Size: ${(sizeBytes / 1024).toFixed(1)} KB`, bbox: [50, 120, 240, 135], page: 1, confidence: 0.99 },
    ];

    db.prepare(`
      INSERT INTO document_pages (id, document_id, page_number, text_layer_json)
      VALUES (?, ?, ?, ?)
    `).run(`page_${documentId}_1`, documentId, 1, JSON.stringify(simulatedTokens));

    // 6. Update Checklist Item Status & Application Completeness
    const checklistStatus = validation.isValid ? 'valid' : 'invalid';
    db.prepare(`
      UPDATE checklist_items
      SET status = ?, document_id = ?, failing_rule = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(checklistStatus, documentId, validation.failingRule, checklistItemId);

    // Re-evaluate application completeness score
    const allItems = db.prepare('SELECT status, required FROM checklist_items WHERE application_id = ?').all(applicationId) as any[];
    const requiredItems = allItems.filter(i => i.required);
    const validItems = requiredItems.filter(i => i.status === 'valid');
    const completeness = requiredItems.length > 0 ? Number((validItems.length / requiredItems.length).toFixed(2)) : 0;

    // If 100% complete, transition status to verification_queue
    const newStatus = completeness >= 1.0 ? 'verification_queue' : 'documents_pending';

    db.prepare(`
      UPDATE applications
      SET completeness_score = ?, status = CASE WHEN status = 'documents_pending' AND ? = 1.0 THEN 'verification_queue' ELSE status END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(completeness, completeness, applicationId);

    // 7. Append-only Audit Log
    recordAuditEvent({
      entityType: 'document',
      entityId: documentId,
      action: 'DOCUMENT_UPLOADED_AND_VALIDATED',
      actorId: uploadedBy,
      actorRole: 'rm',
      correlationId,
      payload: {
        applicationId,
        checklistItemId,
        originalFilename,
        mimeType: detectedMime,
        sizeBytes,
        isValid: validation.isValid,
        failingRule: validation.failingRule,
        completenessScore: completeness,
      },
    });

    return {
      documentId,
      checklistId: checklistItemId,
      filename: originalFilename,
      validation,
      simulatedOcr: {
        isSimulated: true,
        pageCount: 1,
        textLayers: simulatedTokens,
      },
    };
  }

  static createSignedAccessLink(documentId: string, userId: string, durationSeconds: number = 300): {
    accessUrl: string;
    expiresAt: number;
    token: string;
  } {
    const expiresAt = Date.now() + durationSeconds * 1000;
    const hmacMaterial = `${documentId}|${userId}|${expiresAt}`;
    const token = crypto.createHmac('sha256', config.JWT_SECRET).update(hmacMaterial).digest('hex');

    const accessUrl = `/api/v1/documents/${documentId}/download?token=${token}&expires=${expiresAt}&user=${userId}`;
    return {
      accessUrl,
      expiresAt,
      token,
    };
  }

  static verifyAndAccessDocument(
    documentId: string,
    token: string,
    expiresAt: number,
    userId: string,
    clientIp?: string,
    userAgent?: string
  ): { storagePath: string; mimeType: string; originalName: string } {
    // 1. Verify expiration
    if (Date.now() > expiresAt) {
      throw new Error('LINK_EXPIRED: Signed document access link has expired.');
    }

    // 2. Verify HMAC token
    const expectedMaterial = `${documentId}|${userId}|${expiresAt}`;
    const expectedToken = crypto.createHmac('sha256', config.JWT_SECRET).update(expectedMaterial).digest('hex');

    if (token !== expectedToken) {
      throw new Error('INVALID_TOKEN: Document access signature verification failed.');
    }

    // 3. Fetch document
    const db = getDatabase();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId) as any;
    if (!doc) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    // 4. Append to access_logs (APPEND-ONLY)
    const logId = `acc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare(`
      INSERT INTO access_logs (id, document_id, user_id, access_type, ip_address, user_agent, token_hash, accessed_at)
      VALUES (?, ?, ?, 'download', ?, ?, ?, datetime('now'))
    `).run(logId, documentId, userId, clientIp || '127.0.0.1', userAgent || 'KestrelClient', tokenHash);

    return {
      storagePath: doc.storage_path,
      mimeType: doc.mime_type,
      originalName: doc.original_name,
    };
  }

  static getSimulatedOcr(documentId: string): {
    documentId: string;
    isSimulated: boolean;
    provider: string;
    pages: { pageNumber: number; tokens: any[] }[];
  } {
    const db = getDatabase();
    const doc = db.prepare('SELECT id, filename, is_synthetic FROM documents WHERE id = ?').get(documentId) as any;
    if (!doc) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    const pages = db.prepare('SELECT page_number, text_layer_json FROM document_pages WHERE document_id = ? ORDER BY page_number ASC').all(documentId) as any[];

    return {
      documentId,
      isSimulated: true,
      provider: 'Simulated OCR Engine (Local Coordinate Text-Layer)',
      pages: pages.map(p => ({
        pageNumber: p.page_number,
        tokens: JSON.parse(p.text_layer_json),
      })),
    };
  }
}

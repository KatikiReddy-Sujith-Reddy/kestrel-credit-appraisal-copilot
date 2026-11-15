import crypto from 'crypto';
import { getDatabase, KestrelDatabase } from './connection.js';

export interface AuditEventParams {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorRole: string;
  correlationId?: string;
  payload?: any;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function recordAuditEvent(params: AuditEventParams, customDb?: KestrelDatabase): string {
  const db = customDb || getDatabase();

  // Find previous hash
  const lastEvent = db.prepare('SELECT hash FROM audit_events ORDER BY rowid DESC LIMIT 1').get() as { hash: string } | undefined;
  const previousHash = lastEvent ? lastEvent.hash : GENESIS_HASH;

  const id = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = new Date().toISOString();
  const correlationId = params.correlationId || `corr_${Date.now()}`;
  const payloadJson = JSON.stringify(params.payload || {});

  // Compute unbroken SHA-256 hash
  const hashMaterial = `${previousHash}|${timestamp}|${params.entityType}|${params.entityId}|${params.action}|${params.actorId}|${payloadJson}`;
  const hash = crypto.createHash('sha256').update(hashMaterial).digest('hex');

  const stmt = db.prepare(`
    INSERT INTO audit_events (
      id, entity_type, entity_id, action, actor_id, actor_role, correlation_id, payload_json, previous_hash, hash, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    params.entityType,
    params.entityId,
    params.action,
    params.actorId,
    params.actorRole,
    correlationId,
    payloadJson,
    previousHash,
    hash,
    timestamp
  );

  return id;
}

export function verifyAuditChain(customDb?: KestrelDatabase): { isValid: boolean; checkedCount: number; brokenAt?: string } {
  const db = customDb || getDatabase();
  const events = db.prepare('SELECT * FROM audit_events ORDER BY rowid ASC').all() as any[];

  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.previous_hash !== expectedPrev) {
      return { isValid: false, checkedCount: i, brokenAt: e.id };
    }
    const hashMaterial = `${e.previous_hash}|${e.timestamp}|${e.entity_type}|${e.entity_id}|${e.action}|${e.actor_id}|${e.payload_json}`;
    const calculated = crypto.createHash('sha256').update(hashMaterial).digest('hex');
    if (calculated !== e.hash) {
      return { isValid: false, checkedCount: i, brokenAt: e.id };
    }
    expectedPrev = e.hash;
  }

  return { isValid: true, checkedCount: events.length };
}

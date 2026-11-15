import crypto from 'crypto';
import { getDatabase } from '../db/connection.js';
import { recordAuditEvent } from '../db/audit.js';
import { ModelGateway } from '../gateway/gateway.js';

export interface WorkflowJob {
  id: string;
  applicationId: string;
  agentName: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  idempotencyKey: string;
  result?: any;
  retryCount: number;
}

export class WorkflowEngine {
  static async runExtractionJob(applicationId: string, documentId?: string, forceRefresh: boolean = false): Promise<WorkflowJob> {
    const db = getDatabase();
    const idempotencyKey = `job_ext_${applicationId}_${documentId || 'all'}`;

    // 1. Check existing job for idempotency
    const existing = db.prepare('SELECT * FROM extraction_jobs WHERE idempotency_key = ?').get(idempotencyKey) as any;
    if (existing && !forceRefresh && existing.status === 'completed') {
      return {
        id: existing.id,
        applicationId: existing.application_id,
        agentName: existing.agent_name,
        status: existing.status,
        idempotencyKey: existing.idempotency_key,
        result: existing.result_json ? JSON.parse(existing.result_json) : null,
        retryCount: 0,
      };
    }

    const jobId = existing ? existing.id : `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    if (existing) {
      db.prepare("UPDATE extraction_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(jobId);
    } else {
      db.prepare(`
        INSERT INTO extraction_jobs (id, application_id, document_id, agent_name, status, idempotency_key, result_json, created_at, updated_at)
        VALUES (?, ?, ?, 'financial-extraction-pipeline', 'running', ?, NULL, datetime('now'), datetime('now'))
      `).run(jobId, applicationId, documentId || null, idempotencyKey);
    }

    // Execution with up to 3 retries
    let attempt = 0;
    let lastError: any = null;

    while (attempt < 3) {
      attempt++;
      const startTime = Date.now();
      try {
        // Execute Bank Extraction step via gateway
        const bankRes = await ModelGateway.complete({
          agentName: 'bank-extractor',
          applicationId,
          taskId: jobId,
          userPrompt: `Extract 12-month bank statement credits and ledger summary for application ${applicationId}`,
          dataClassification: 'synthetic',
        });

        // Execute GST Extraction step via gateway
        const gstRes = await ModelGateway.complete({
          agentName: 'gst-extractor',
          applicationId,
          taskId: jobId,
          userPrompt: `Extract 12-month GSTR-3B and GSTR-1 turnover for application ${applicationId}`,
          dataClassification: 'synthetic',
        });

        const executionDuration = Date.now() - startTime;
        const result = {
          bankExtraction: bankRes.parsedJson || bankRes.content,
          gstExtraction: gstRes.parsedJson || gstRes.content,
          timestamp: new Date().toISOString(),
        };

        // Record agent execution row (APPEND-ONLY)
        const execId = `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        db.prepare(`
          INSERT INTO agent_executions (id, correlation_id, agent_name, task_id, application_id, status, input_json, output_json, duration_ms, retry_count, created_at)
          VALUES (?, ?, 'financial-extraction-pipeline', ?, ?, 'completed', ?, ?, ?, ?, datetime('now'))
        `).run(execId, `corr_${jobId}`, jobId, applicationId, JSON.stringify({ documentId }), JSON.stringify(result), executionDuration, attempt - 1);

        // Update extraction_jobs to completed
        db.prepare(`
          UPDATE extraction_jobs
          SET status = 'completed', result_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(result), jobId);

        return {
          id: jobId,
          applicationId,
          agentName: 'financial-extraction-pipeline',
          status: 'completed',
          idempotencyKey,
          result,
          retryCount: attempt - 1,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[Workflow Engine] Step attempt ${attempt} failed:`, err.message);
        if (attempt < 3) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 50));
        }
      }
    }

    // All retries failed
    db.prepare(`
      UPDATE extraction_jobs
      SET status = 'failed', updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);

    throw new Error(`WORKFLOW_JOB_FAILED: Extraction pipeline failed after 3 attempts. ${lastError?.message}`);
  }

  static resumeIncompleteJobs(): void {
    const db = getDatabase();
    const runningJobs = db.prepare("SELECT * FROM extraction_jobs WHERE status = 'running'").all() as any[];
    console.log(`[Workflow Engine] Resuming ${runningJobs.length} incomplete jobs from last checkpoint...`);
    for (const job of runningJobs) {
      WorkflowEngine.runExtractionJob(job.application_id, job.document_id || undefined, false).catch((err) => {
        console.error(`[Workflow Engine] Failed to resume job ${job.id}:`, err);
      });
    }
  }
}

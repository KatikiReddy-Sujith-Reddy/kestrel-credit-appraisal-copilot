import { describe, it, expect, beforeAll } from 'vitest';
import { ModelGateway } from '../src/gateway/gateway.js';
import { WorkflowEngine } from '../src/agents/workflow.js';
import { runSeed } from '../src/seed/seed.js';
import { getDatabase } from '../src/db/connection.js';

describe('Model Gateway & Workflow Engine Tests', () => {
  beforeAll(async () => {
    await runSeed();
  });

  it('strictly refuses requests with non-synthetic data classification', async () => {
    await expect(
      ModelGateway.complete({
        agentName: 'bank-extractor',
        userPrompt: 'Extract bank account for real customer',
        dataClassification: 'real_financials', // NON-SYNTHETIC
      })
    ).rejects.toThrow('FORBIDDEN_DATA_CLASSIFICATION');
  });

  it('executes simulated gateway call and writes append-only llm_calls row', async () => {
    const db = getDatabase();
    const initialCalls = (db.prepare('SELECT count(*) as c FROM llm_calls').get() as any).c;

    const res = await ModelGateway.complete({
      agentName: 'followup-draft',
      userPrompt: 'Draft reminder for pending tax certificates',
      inputs: { borrowerName: 'Aarohi Textiles', missingItems: ['GSTR-3B Dec 2024'] },
      dataClassification: 'synthetic',
    });

    expect(res.provider).toBe('simulated');
    expect(res.estimatedCost).toBeGreaterThanOrEqual(0);
    expect(res.content).toContain('Aarohi Textiles');

    const finalCalls = (db.prepare('SELECT count(*) as c FROM llm_calls').get() as any).c;
    expect(finalCalls).toBe(initialCalls + 1);

    // Verify row details in llm_calls
    const callRow = db.prepare('SELECT * FROM llm_calls WHERE call_id = ?').get(res.callId) as any;
    expect(callRow).toBeDefined();
    expect(callRow.provider).toBe('simulated');
    expect(callRow.currency).toBe('USD');
  });

  it('runs synthetic connectivity probe successfully', async () => {
    const probe = await ModelGateway.connectivityTest();
    expect(probe.connected).toBe(true);
    expect(probe.sampleResponse.length).toBeGreaterThan(0);
  });

  it('executes idempotent workflow jobs', async () => {
    const job1 = await WorkflowEngine.runExtractionJob('app_1000');
    expect(job1.status).toBe('completed');

    // Run again with same parameters - should return cached job via idempotencyKey
    const job2 = await WorkflowEngine.runExtractionJob('app_1000');
    expect(job2.id).toBe(job1.id);
  });
});

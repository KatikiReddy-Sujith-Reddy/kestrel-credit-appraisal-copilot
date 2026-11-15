import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { config, hasLiveGeminiKey } from '../config.js';
import { getDatabase } from '../db/connection.js';
import { ModelGatewayRequest, ModelGatewayResponse } from './types.js';

export class ModelGateway {
  private static geminiClient: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI | null {
    if (!ModelGateway.geminiClient && hasLiveGeminiKey()) {
      ModelGateway.geminiClient = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    }
    return ModelGateway.geminiClient;
  }

  static async complete(req: ModelGatewayRequest): Promise<ModelGatewayResponse> {
    const startTime = Date.now();
    const callId = `call_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const correlationId = req.correlationId || `corr_${Date.now()}`;

    // 1. NON-NEGOTIABLE RULE: Reject any non-synthetic data
    if (req.dataClassification !== 'synthetic') {
      const errorMsg = 'FORBIDDEN_DATA_CLASSIFICATION: Model Gateway strictly rejects any request not explicitly flagged as synthetic.';
      ModelGateway.recordLlmCall({
        callId,
        correlationId,
        applicationId: req.applicationId,
        taskId: req.taskId,
        agentName: req.agentName,
        modelId: 'rejected',
        provider: 'none',
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        inputPrice: 0,
        outputPrice: 0,
        priceVersion: 'v2026.1',
        estimatedCost: 0,
        durationMs: Date.now() - startTime,
        status: 'rejected_non_synthetic',
        retryCount: 0,
        fallbackUsed: false,
        promptVersionId: req.promptVersionId,
      });
      throw new Error(errorMsg);
    }

    // 2. Resolve Active Model Configuration & Registry Pricing
    const db = getDatabase();
    const activeConfig = db.prepare(`
      SELECT primary_model_id, fallback_model_id FROM model_configuration_versions
      WHERE status = 'active' ORDER BY version_number DESC LIMIT 1
    `).get() as { primary_model_id: string; fallback_model_id: string } | undefined;

    const primaryModelId = activeConfig?.primary_model_id || config.PRIMARY_MODEL_ID;
    const fallbackModelId = activeConfig?.fallback_model_id || config.FALLBACK_MODEL_ID;

    const primaryModelInfo = db.prepare('SELECT * FROM model_registry WHERE model_id = ?').get(primaryModelId) as any;
    const fallbackModelInfo = db.prepare('SELECT * FROM model_registry WHERE model_id = ?').get(fallbackModelId) as any;

    const inputPrice = primaryModelInfo?.input_price_per_million || 0.15;
    const outputPrice = primaryModelInfo?.output_price_per_million || 0.60;
    const priceVersion = primaryModelInfo?.price_version || 'v2026.1-usd';

    // 3. Execution Branch: SIMULATED vs LIVE
    if (config.LLM_MODE === 'simulated' || !hasLiveGeminiKey()) {
      return ModelGateway.executeSimulated(req, callId, correlationId, primaryModelId, inputPrice, outputPrice, priceVersion, startTime);
    }

    // 4. Live Mode with Primary Model & Automatic Fallback
    try {
      const liveRes = await ModelGateway.executeGemini(
        primaryModelId,
        req,
        callId,
        correlationId,
        inputPrice,
        outputPrice,
        priceVersion,
        false,
        startTime
      );
      return liveRes;
    } catch (primaryErr: any) {
      console.warn(`[Model Gateway] Primary model ${primaryModelId} failed. Triggering fallback to ${fallbackModelId}:`, primaryErr.message);

      try {
        const fallbackRes = await ModelGateway.executeGemini(
          fallbackModelId,
          req,
          callId,
          correlationId,
          fallbackModelInfo?.input_price_per_million || inputPrice,
          fallbackModelInfo?.output_price_per_million || outputPrice,
          fallbackModelInfo?.price_version || priceVersion,
          true,
          startTime
        );
        return fallbackRes;
      } catch (fallbackErr: any) {
        console.error(`[Model Gateway] Fallback model ${fallbackModelId} also failed:`, fallbackErr.message);
        // Record failure
        ModelGateway.recordLlmCall({
          callId,
          correlationId,
          applicationId: req.applicationId,
          taskId: req.taskId,
          agentName: req.agentName,
          modelId: fallbackModelId,
          provider: 'google',
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          inputPrice,
          outputPrice,
          priceVersion,
          estimatedCost: 0,
          durationMs: Date.now() - startTime,
          status: 'failed',
          retryCount: 1,
          fallbackUsed: true,
          promptVersionId: req.promptVersionId,
        });
        throw new Error(`MODEL_EXECUTION_FAILED: Primary and fallback models both failed. ${fallbackErr.message}`);
      }
    }
  }

  private static async executeGemini(
    modelId: string,
    req: ModelGatewayRequest,
    callId: string,
    correlationId: string,
    inputPrice: number,
    outputPrice: number,
    priceVersion: string,
    fallbackUsed: boolean,
    startTime: number
  ): Promise<ModelGatewayResponse> {
    const client = ModelGateway.getClient();
    if (!client) {
      throw new Error('Gemini API client uninitialized');
    }

    const contents = [
      ...(req.systemPrompt ? [{ role: 'system' as any, parts: [{ text: req.systemPrompt }] }] : []),
      { role: 'user' as any, parts: [{ text: req.userPrompt }] },
    ];

    const configOpts: any = {
      temperature: 0.1,
    };
    if (req.responseSchema) {
      configOpts.responseMimeType = 'application/json';
      configOpts.responseSchema = req.responseSchema;
    }

    const result = await (client.models as any).generateContent({
      model: modelId,
      contents,
      config: configOpts,
    });

    const responseText = result.text || '';
    const durationMs = Date.now() - startTime;

    // Token usage
    const inputTokens = result.usageMetadata?.promptTokenCount || Math.ceil((req.userPrompt.length + (req.systemPrompt?.length || 0)) / 4);
    const outputTokens = result.usageMetadata?.candidatesTokenCount || Math.ceil(responseText.length / 4);
    const cachedTokens = result.usageMetadata?.cachedContentTokenCount || 0;

    // Estimated Cost: (inputTokens / 1M * inputPrice) + (outputTokens / 1M * outputPrice)
    const estimatedCost = Number(((inputTokens / 1000000 * inputPrice) + (outputTokens / 1000000 * outputPrice)).toFixed(6));

    let parsedJson: any = undefined;
    if (req.responseSchema) {
      try {
        parsedJson = JSON.parse(responseText);
      } catch {
        parsedJson = undefined;
      }
    }

    const status = fallbackUsed ? 'fallback_success' : 'success';

    ModelGateway.recordLlmCall({
      callId,
      correlationId,
      applicationId: req.applicationId,
      taskId: req.taskId,
      agentName: req.agentName,
      modelId,
      provider: 'google',
      inputTokens,
      outputTokens,
      cachedTokens,
      inputPrice,
      outputPrice,
      priceVersion,
      estimatedCost,
      durationMs,
      status,
      retryCount: fallbackUsed ? 1 : 0,
      fallbackUsed,
      promptVersionId: req.promptVersionId,
    });

    return {
      callId,
      modelId,
      provider: 'google',
      content: responseText,
      parsedJson,
      inputTokens,
      outputTokens,
      cachedTokens,
      estimatedCost,
      currency: 'USD',
      durationMs,
      fallbackUsed,
      status,
      timestamp: new Date().toISOString(),
    };
  }

  private static executeSimulated(
    req: ModelGatewayRequest,
    callId: string,
    correlationId: string,
    modelId: string,
    inputPrice: number,
    outputPrice: number,
    priceVersion: string,
    startTime: number
  ): ModelGatewayResponse {
    let content = '';
    let parsedJson: any = undefined;
    const inputs = req.inputs || {};

    // Tailored deterministic synthetic responses by agent name
    if (req.agentName === 'followup-draft') {
      const missingList = inputs.missingItems || ['Latest 3-Month Bank Statement', 'Updated Udyam Registration'];
      content = `Dear ${inputs.borrowerName || 'Borrower'},\n\n` +
        `Regarding your working capital loan application for ${inputs.loanAmountFormatted || '$180,000'}, ` +
        `we have reviewed the document checklist and require the following outstanding items to proceed to credit appraisal:\n\n` +
        missingList.map((item: string, idx: number) => `${idx + 1}. ${item}`).join('\n') +
        `\n\nPlease upload these documents through the secure customer portal. ` +
        `Note: Kestrel will never ask for your banking passwords, PINs, or SMS OTPs.\n\n` +
        `Warm regards,\nRelationship Manager\nKestrel Financial Services`;

      parsedJson = {
        subject: `Outstanding Documents Required for Working Capital Application`,
        body: content,
        missingItems: missingList,
      };
    } else if (req.agentName === 'cam-draft') {
      content = `The borrower has requested a working capital facility of ${inputs.loanAmountFormatted || '$180,000'} [1]. ` +
        `Aggregate 12-month operative bank deposits were verified at ${inputs.turnoverFormatted || '$480,250'} [2], indicating consistent operational cashflows. ` +
        `The Debt Service Coverage Ratio (DSCR) is appraised at ${inputs.dscr || '1.35'}x [3], well above the minimum prudential benchmark of 1.25x. ` +
        `Current Ratio is computed at ${inputs.currentRatio || '1.25'}x [4]. ` +
        `Appraisal recommendation is subject to standard hypothecation and collateral covenants [5].`;

      parsedJson = {
        summary: content,
        isGroundingValid: true,
      };
    } else if (req.agentName === 'bank-extractor') {
      parsedJson = {
        accountNumber: '502000889211',
        ifsc: 'HDFC0001234',
        period: 'Dec 2024 - Nov 2025',
        totalCredits: 4250000,
        totalDebits: 3980000,
        averageMonthlyBalance: 245000,
        confidence: 0.98,
      };
      content = JSON.stringify(parsedJson, null, 2);
    } else if (req.agentName === 'gst-extractor') {
      parsedJson = {
        gstin: '27AABCT1000Q1ZP',
        filingFrequency: 'Monthly',
        annualTaxableTurnover: 4180000,
        itcAvailment: 345000,
        confidence: 0.97,
      };
      content = JSON.stringify(parsedJson, null, 2);
    } else {
      content = `Synthetic deterministic model response for agent: ${req.agentName}.`;
      parsedJson = { status: 'simulated_success', agent: req.agentName };
    }

    const durationMs = Math.max(12, Date.now() - startTime);
    const inputTokens = Math.ceil((req.userPrompt.length + (req.systemPrompt?.length || 0)) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    const estimatedCost = Number(((inputTokens / 1000000 * inputPrice) + (outputTokens / 1000000 * outputPrice)).toFixed(6));

    ModelGateway.recordLlmCall({
      callId,
      correlationId,
      applicationId: req.applicationId,
      taskId: req.taskId,
      agentName: req.agentName,
      modelId: 'simulated-deterministic',
      provider: 'simulated',
      inputTokens,
      outputTokens,
      cachedTokens: 0,
      inputPrice,
      outputPrice,
      priceVersion,
      estimatedCost,
      durationMs,
      status: 'success',
      retryCount: 0,
      fallbackUsed: false,
      promptVersionId: req.promptVersionId,
    });

    return {
      callId,
      modelId: 'simulated-deterministic',
      provider: 'simulated',
      content,
      parsedJson,
      inputTokens,
      outputTokens,
      cachedTokens: 0,
      estimatedCost,
      currency: 'USD',
      durationMs,
      fallbackUsed: false,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  }

  static async connectivityTest(): Promise<{
    connected: boolean;
    provider: string;
    modelId: string;
    latencyMs: number;
    sampleResponse: string;
    error?: string;
  }> {
    const startTime = Date.now();
    const syntheticPayload = 'Synthesize a 1-sentence confirmation that Kestrel SME Underwriting synthetic gateway is connected.';

    try {
      const res = await ModelGateway.complete({
        agentName: 'connectivity-probe',
        userPrompt: syntheticPayload,
        dataClassification: 'synthetic', // Mandatory flag
      });

      return {
        connected: true,
        provider: res.provider,
        modelId: res.modelId,
        latencyMs: Date.now() - startTime,
        sampleResponse: res.content.substring(0, 100),
      };
    } catch (err: any) {
      return {
        connected: false,
        provider: 'none',
        modelId: 'probe-failed',
        latencyMs: Date.now() - startTime,
        sampleResponse: '',
        error: err.message,
      };
    }
  }

  private static recordLlmCall(call: {
    callId: string;
    correlationId: string;
    applicationId?: string;
    taskId?: string;
    agentName: string;
    modelId: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    inputPrice: number;
    outputPrice: number;
    priceVersion: string;
    estimatedCost: number;
    durationMs: number;
    status: string;
    retryCount: number;
    fallbackUsed: boolean;
    promptVersionId?: string;
  }): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO llm_calls (
          call_id, correlation_id, application_id, task_id, agent_name, model_id, provider,
          input_tokens, output_tokens, cached_tokens, input_price, output_price, price_version,
          estimated_cost, provider_reported_cost, currency, duration_ms, timestamp, status,
          retry_count, fallback_used, prompt_version_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'USD', ?, datetime('now'), ?, ?, ?, ?)
      `).run(
        call.callId,
        call.correlationId,
        call.applicationId || null,
        call.taskId || null,
        call.agentName,
        call.modelId,
        call.provider,
        call.inputTokens,
        call.outputTokens,
        call.cachedTokens,
        call.inputPrice,
        call.outputPrice,
        call.priceVersion,
        call.estimatedCost,
        call.durationMs,
        call.status,
        call.retryCount,
        call.fallbackUsed ? 1 : 0,
        call.promptVersionId || null
      );
    } catch (e) {
      console.error('[Record LLM Call Error]', e);
    }
  }
}

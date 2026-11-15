export type DataClassification = 'synthetic' | 'customer_pii' | 'real_financials';

export interface ModelGatewayRequest {
  agentName: string;
  promptVersionId?: string;
  inputs?: Record<string, any>;
  systemPrompt?: string;
  userPrompt: string;
  responseSchema?: Record<string, any>; // JSON schema
  dataClassification: DataClassification;
  applicationId?: string;
  taskId?: string;
  correlationId?: string;
}

export interface ModelGatewayResponse {
  callId: string;
  modelId: string;
  provider: string;
  content: string;
  parsedJson?: any;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  estimatedCost: number;
  currency: string;
  durationMs: number;
  fallbackUsed: boolean;
  status: 'success' | 'fallback_success' | 'failed';
  timestamp: string;
}

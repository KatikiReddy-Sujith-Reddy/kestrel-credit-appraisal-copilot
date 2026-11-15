import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { config, hasLiveGeminiKey } from './config.js';
import { authRoutes } from './auth/routes.js';
import { documentRoutes } from './modules/documents/routes.js';
import { applicationRoutes } from './modules/applications/routes.js';
import { extractionRoutes } from './modules/extraction/routes.js';
import { reconciliationRoutes } from './modules/reconciliation/routes.js';
import { camRoutes } from './modules/cam/routes.js';
import { reviewRoutes } from './modules/review/routes.js';
import { followupRoutes } from './modules/followups/routes.js';
import { ownerRoutes } from './modules/owner/routes.js';

export async function createServer(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB limit
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie, {
    secret: config.JWT_SECRET,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Gracefully handle empty or valid JSON bodies when Content-Type is application/json
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body || body.trim() === '') {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Global correlation ID middleware
  app.addHook('onRequest', async (req, reply) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    (req as any).correlationId = correlationId;
    reply.header('x-correlation-id', correlationId);
  });

  // Register Routes
  await authRoutes(app);
  await documentRoutes(app);
  await applicationRoutes(app);
  await extractionRoutes(app);
  await reconciliationRoutes(app);
  await camRoutes(app);
  await reviewRoutes(app);
  await followupRoutes(app);
  await ownerRoutes(app);

  // Health and System Diagnostics
  app.get('/api/v1/health', async () => {
    return {
      status: 'healthy',
      system: 'Kestrel Credit Appraisal Copilot Backend',
      timestamp: new Date().toISOString(),
      llmMode: config.LLM_MODE,
      hasGeminiKey: hasLiveGeminiKey(),
      primaryModel: config.PRIMARY_MODEL_ID,
      fallbackModel: config.FALLBACK_MODEL_ID,
      pilotScopeMaxLoan: config.PILOT_MAX_LOAN_AMOUNT,
    };
  });

  return app;
}

// Direct startup when executed directly
if (process.argv[1] && process.argv[1].includes('server')) {
  createServer()
    .then(async (app) => {
      try {
        await app.listen({ port: config.PORT, host: config.HOST });
        console.log(`[Kestrel API] Server listening on http://${config.HOST}:${config.PORT}`);
        console.log(`[Kestrel API] LLM Mode: ${config.LLM_MODE}`);
        console.log(`[Kestrel API] Gemini Key Configured: ${hasLiveGeminiKey() ? 'YES (Key loaded securely on backend)' : 'NO (Operating in simulated mode)'}`);
      } catch (err) {
        app.log.error(err);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal initialization error:', err);
      process.exit(1);
    });
}

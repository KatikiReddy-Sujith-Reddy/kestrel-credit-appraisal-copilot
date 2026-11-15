import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from './service.js';
import { authenticate } from './middleware.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // 1. Standard User Sign-In
  app.post('/api/v1/auth/sign-in', async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      identifier: z.string().min(1),
      password: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const clientIp = req.ip || '127.0.0.1';

    try {
      const result = await AuthService.signIn(parsed.data.identifier, parsed.data.password, clientIp, req.correlationId);
      return reply.send(result);
    } catch (err: any) {
      if (err.message.startsWith('ACCOUNT_LOCKED')) {
        return reply.status(423).send({ error: 'ACCOUNT_LOCKED', message: err.message });
      }
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: err.message });
    }
  });

  // 2. Owner Tier-0 Sign-In
  app.post('/api/v1/auth/owner-sign-in', async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      hardwareToken: z.string().min(1),
      email: z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const clientIp = req.ip || '127.0.0.1';

    try {
      const result = await AuthService.ownerSignIn(parsed.data.hardwareToken, parsed.data.email || 'sanjay.gupta@kestrel-synthetic.bank', clientIp);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: err.message });
    }
  });

  // 3. MFA Verification
  app.post('/api/v1/auth/mfa/verify', async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      challengeId: z.string().min(1),
      mfaCode: z.string().length(6),
      requestedRole: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    const clientIp = req.ip || '127.0.0.1';

    try {
      const result = AuthService.verifyMfa(parsed.data.challengeId, parsed.data.mfaCode, parsed.data.requestedRole, clientIp);

      // Set httpOnly SameSite cookie
      reply.setCookie('kestrel_jwt', result.token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: false, // prototype localhost
        maxAge: 15 * 60, // 15 mins
      });

      return reply.send(result);
    } catch (err: any) {
      return reply.status(401).send({ error: 'MFA_FAILED', message: err.message });
    }
  });

  // 4. Role Selection / Switching (limited to assigned roles)
  app.post('/api/v1/auth/select-role', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      role: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.issues });
    }

    try {
      const result = AuthService.switchRole(req.user!, parsed.data.role);

      reply.setCookie('kestrel_jwt', result.token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        maxAge: 15 * 60,
      });

      return reply.send(result);
    } catch (err: any) {
      return reply.status(403).send({ error: 'FORBIDDEN_ROLE', message: err.message });
    }
  });

  // 5. Current Authenticated Profile
  app.get('/api/v1/auth/me', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ user: req.user });
  });

  // 6. Sign-Out
  app.post('/api/v1/auth/sign-out', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('kestrel_jwt', { path: '/' });
    return reply.send({ success: true, message: 'Signed out successfully.' });
  });
}

import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, UserTokenPayload } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserTokenPayload;
    correlationId?: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const cookieToken = (request.cookies as Record<string, string | undefined>)?.kestrel_jwt;

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' });
    return;
  }

  try {
    const payload = verifyToken(token);
    request.user = payload;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      reply.status(401).send({ error: 'SESSION_EXPIRED', message: 'Session expired after 15 minutes of inactivity. Please re-authenticate.' });
      return;
    }
    reply.status(401).send({ error: 'INVALID_TOKEN', message: 'Invalid or tampered authentication token.' });
    return;
  }
}

export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(request.user.activeRole)) {
      reply.status(403).send({
        error: 'FORBIDDEN',
        message: `Active role '${request.user.activeRole}' is not permitted to perform this operation. Required: [${allowedRoles.join(', ')}].`,
      });
      return;
    }
  };
}

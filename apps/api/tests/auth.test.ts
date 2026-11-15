import { describe, it, expect, beforeAll } from 'vitest';
import { createServer } from '../src/server.js';
import { runSeed } from '../src/seed/seed.js';

describe('Phase 2 Auth & Database Tests', () => {
  let app: any;

  beforeAll(async () => {
    await runSeed();
    app = await createServer();
  });

  it('allows RM demo user to sign in and initiate simulated MFA', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: {
        identifier: 'rm.demo',
        password: 'Kestrel@RM2026!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.requiresMfa).toBe(true);
    expect(body.simulatedMfaCode).toBe('742918');
    expect(body.user.username).toBe('rm.demo');
    expect(body.user.assignedRoles).toContain('rm');
  });

  it('completes simulated MFA verification and returns JWT token and cookie', async () => {
    // 1. Sign in
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: {
        identifier: 'analyst.demo',
        password: 'Kestrel@Analyst2026!',
      },
    });
    const loginBody = JSON.parse(loginRes.body);

    // 2. Verify MFA
    const mfaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: {
        challengeId: loginBody.challengeId,
        mfaCode: loginBody.simulatedMfaCode,
      },
    });

    expect(mfaRes.statusCode).toBe(200);
    const mfaBody = JSON.parse(mfaRes.body);
    expect(mfaBody.token).toBeDefined();
    expect(mfaBody.user.activeRole).toBe('analyst');
    expect(mfaRes.headers['set-cookie']).toBeDefined();
  });

  it('allows Owner sign in with FIDO2 hardware token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/owner-sign-in',
      payload: {
        hardwareToken: 'FIDO2_SECURE_TOKEN_SG_88301',
        email: 'sanjay.gupta@kestrel-synthetic.bank',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.requiresMfa).toBe(true);
    expect(body.user.assignedRoles).toContain('owner');
  });

  it('locks out user after 5 consecutive failed login attempts', async () => {
    // 5 bad password attempts
    for (let i = 1; i <= 4; i++) {
      const failRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/sign-in',
        payload: {
          identifier: 'cm.demo',
          password: 'WrongPassword!',
        },
      });
      expect(failRes.statusCode).toBe(401);
    }

    // 5th attempt locks account
    const fifthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: {
        identifier: 'cm.demo',
        password: 'WrongPassword!',
      },
    });
    expect(fifthRes.statusCode).toBe(423); // Locked

    // 6th attempt even with correct password is still locked
    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      payload: {
        identifier: 'cm.demo',
        password: 'Kestrel@CM2026!',
      },
    });
    expect(lockedRes.statusCode).toBe(423);
  });
});

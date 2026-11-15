import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase } from '../db/connection.js';
import { recordAuditEvent } from '../db/audit.js';
import { signToken, verifyToken, UserTokenPayload } from './jwt.js';

export const SIMULATED_MFA_CODE = '742918';

export interface MfaChallenge {
  challengeId: string;
  userId: string;
  username: string;
  email: string;
  fullName: string;
  assignedRoles: string[];
  simulatedMfaCode: string; // Shown only in UI as "simulated"
  expiresAt: number;
}

// In-memory MFA challenge storage
const activeChallenges = new Map<string, MfaChallenge>();

export class AuthService {
  static async signIn(identifier: string, password: string, clientIp: string, correlationId?: string): Promise<{
    requiresMfa: boolean;
    challengeId: string;
    simulatedMfaCode: string;
    user: { id: string; username: string; email: string; fullName: string; assignedRoles: string[] };
  }> {
    const db = getDatabase();

    // 1. Fetch user by username or email
    const user = db.prepare(`
      SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)
    `).get(identifier, identifier) as any;

    if (!user) {
      AuthService.recordSecurityEvent('LOGIN_FAILED_UNKNOWN_USER', 'warning', clientIp, null, { identifier });
      throw new Error('INVALID_CREDENTIALS');
    }

    // 2. Check lockout status
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until).getTime();
      const now = Date.now();
      if (now < lockExpiry) {
        const remainingMinutes = Math.ceil((lockExpiry - now) / 60000);
        AuthService.recordSecurityEvent('LOGIN_ATTEMPT_LOCKED_ACCOUNT', 'critical', clientIp, user.id, { remainingMinutes });
        throw new Error(`ACCOUNT_LOCKED: Account is locked due to 5 consecutive failed attempts. Try again in ${remainingMinutes} minute(s).`);
      } else {
        // Lockout expired, reset attempts
        db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
      }
    }

    // 3. Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil: string | null = null;

      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min lockout
        AuthService.recordSecurityEvent('ACCOUNT_LOCKED_MAX_FAILURES', 'critical', clientIp, user.id, { attempts: newAttempts });
      } else {
        AuthService.recordSecurityEvent('LOGIN_FAILED_BAD_PASSWORD', 'warning', clientIp, user.id, { attempts: newAttempts });
      }

      db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(newAttempts, lockedUntil, user.id);

      if (newAttempts >= 5) {
        throw new Error('ACCOUNT_LOCKED: Maximum 5 failed attempts reached. Account locked for 15 minutes.');
      } else {
        throw new Error(`INVALID_CREDENTIALS: Incorrect credentials. ${5 - newAttempts} attempt(s) remaining before lockout.`);
      }
    }

    // Reset failed attempts on success
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    // Fetch assigned roles
    const rolesRows = db.prepare(`
      SELECT r.name FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(user.id) as { name: string }[];
    const assignedRoles = rolesRows.map(r => r.name);

    // Create simulated MFA challenge
    const challengeId = `mfa_${crypto.randomBytes(16).toString('hex')}`;
    const challenge: MfaChallenge = {
      challengeId,
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      assignedRoles,
      simulatedMfaCode: SIMULATED_MFA_CODE,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min challenge expiry
    };
    activeChallenges.set(challengeId, challenge);

    return {
      requiresMfa: true,
      challengeId,
      simulatedMfaCode: SIMULATED_MFA_CODE,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        assignedRoles,
      },
    };
  }

  static async ownerSignIn(hardwareToken: string, email: string, clientIp: string): Promise<{
    requiresMfa: boolean;
    challengeId: string;
    simulatedMfaCode: string;
    user: { id: string; username: string; email: string; fullName: string; assignedRoles: string[] };
  }> {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT * FROM users WHERE lower(email) = lower(?)
    `).get(email || 'sanjay.gupta@kestrel-synthetic.bank') as any;

    if (!user) {
      throw new Error('INVALID_CREDENTIALS: Owner identity not found');
    }

    // Fetch roles and verify owner privilege
    const rolesRows = db.prepare(`
      SELECT r.name FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(user.id) as { name: string }[];
    const assignedRoles = rolesRows.map(r => r.name);

    if (!assignedRoles.includes('owner')) {
      AuthService.recordSecurityEvent('UNAUTHORIZED_OWNER_PORTAL_ATTEMPT', 'critical', clientIp, user.id, { assignedRoles });
      throw new Error('ACCESS_DENIED: User lacks Tier-0 Owner administrative privilege.');
    }

    // Verify hardware token format
    if (!hardwareToken || (!hardwareToken.startsWith('FIDO2_') && hardwareToken.length < 8)) {
      throw new Error('INVALID_CREDENTIALS: Valid FIDO2 hardware token required for Owner sign-in.');
    }

    const challengeId = `mfa_owner_${crypto.randomBytes(16).toString('hex')}`;
    const challenge: MfaChallenge = {
      challengeId,
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      assignedRoles,
      simulatedMfaCode: SIMULATED_MFA_CODE,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    activeChallenges.set(challengeId, challenge);

    return {
      requiresMfa: true,
      challengeId,
      simulatedMfaCode: SIMULATED_MFA_CODE,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        assignedRoles,
      },
    };
  }

  static verifyMfa(challengeId: string, mfaCode: string, requestedRole?: string, clientIp?: string): {
    token: string;
    user: UserTokenPayload;
  } {
    const challenge = activeChallenges.get(challengeId);
    if (!challenge || Date.now() > challenge.expiresAt) {
      throw new Error('MFA_EXPIRED: The MFA session has expired. Please sign in again.');
    }

    // Verify simulated MFA code (allows standard development code or test codes)
    if (mfaCode !== challenge.simulatedMfaCode && mfaCode !== '123456') {
      throw new Error('INVALID_MFA_CODE: The 6-digit MFA verification code is incorrect.');
    }

    activeChallenges.delete(challengeId);

    // Determine initial active role
    let activeRole = challenge.assignedRoles[0];
    if (requestedRole && challenge.assignedRoles.includes(requestedRole)) {
      activeRole = requestedRole;
    }

    const userPayload: Omit<UserTokenPayload, 'iat' | 'exp'> = {
      userId: challenge.userId,
      username: challenge.username,
      email: challenge.email,
      fullName: challenge.fullName,
      activeRole,
      assignedRoles: challenge.assignedRoles,
      isSynthetic: true,
    };

    const token = signToken(userPayload);

    // Audit log login
    recordAuditEvent({
      entityType: 'auth',
      entityId: challenge.userId,
      action: 'USER_AUTHENTICATED',
      actorId: challenge.userId,
      actorRole: activeRole,
      payload: {
        ipAddress: clientIp,
        activeRole,
        assignedRoles: challenge.assignedRoles,
        mfaMethod: 'simulated_totp',
      },
    });

    return {
      token,
      user: userPayload,
    };
  }

  static switchRole(currentUser: UserTokenPayload, newRole: string): { token: string; user: UserTokenPayload } {
    if (!currentUser.assignedRoles.includes(newRole)) {
      throw new Error(`FORBIDDEN_ROLE: Role '${newRole}' is not assigned to user '${currentUser.username}'.`);
    }

    const updatedPayload: Omit<UserTokenPayload, 'iat' | 'exp'> = {
      ...currentUser,
      activeRole: newRole,
    };

    const token = signToken(updatedPayload);

    recordAuditEvent({
      entityType: 'auth',
      entityId: currentUser.userId,
      action: 'ROLE_SWITCHED',
      actorId: currentUser.userId,
      actorRole: newRole,
      payload: {
        previousRole: currentUser.activeRole,
        newRole,
      },
    });

    return {
      token,
      user: updatedPayload,
    };
  }

  static recordSecurityEvent(eventType: string, severity: 'info' | 'warning' | 'critical', ip?: string, userId?: string | null, details?: any) {
    try {
      const db = getDatabase();
      const id = `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      db.prepare(`
        INSERT INTO security_events (id, event_type, severity, ip_address, user_id, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, eventType, severity, ip || '127.0.0.1', userId || null, JSON.stringify(details || {}));
    } catch (e) {
      console.error('[Security Event Error]', e);
    }
  }
}

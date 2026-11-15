import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface UserTokenPayload {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  activeRole: string;
  assignedRoles: string[];
  isSynthetic: boolean;
  iat?: number;
  exp?: number;
}

export interface MfaChallengePayload {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  assignedRoles: string[];
  simulatedMfaCode: string;
  expiresAt: number;
}

export function signToken(payload: Omit<UserTokenPayload, 'iat' | 'exp'>): string {
  // 15-minute expiration matching session timeout
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '15m' });
}

export function verifyToken(token: string): UserTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as UserTokenPayload;
}

export function signMfaChallenge(payload: MfaChallengePayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '5m' });
}

export function verifyMfaChallenge(token: string): MfaChallengePayload | null {
  try {
    return jwt.verify(token, config.JWT_SECRET) as MfaChallengePayload;
  } catch {
    return null;
  }
}

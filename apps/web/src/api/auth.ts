export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  activeRole: string;
  assignedRoles: string[];
  isSynthetic: boolean;
}

export interface SignInResponse {
  requiresMfa: boolean;
  challengeId: string;
  simulatedMfaCode: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    assignedRoles: string[];
  };
}

export interface MfaVerifyResponse {
  token: string;
  user: UserProfile;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. Please try again.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiSignIn(identifier: string, password: string): Promise<SignInResponse> {
  const res = await fetchWithTimeout('/api/v1/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Sign in failed' }));
    throw new Error(err.message || 'Invalid credentials');
  }
  return res.json();
}

export async function apiOwnerSignIn(hardwareToken: string, email: string): Promise<SignInResponse> {
  const res = await fetchWithTimeout('/api/v1/auth/owner-sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardwareToken, email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Owner sign in failed' }));
    throw new Error(err.message || 'Owner authentication failed');
  }
  return res.json();
}

export async function apiVerifyMfa(challengeId: string, mfaCode: string, requestedRole?: string): Promise<MfaVerifyResponse> {
  const res = await fetchWithTimeout('/api/v1/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, mfaCode, requestedRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'MFA verification failed' }));
    throw new Error(err.message || 'Invalid MFA code');
  }
  const data = await res.json();
  localStorage.setItem('kestrel_token', data.token);
  localStorage.setItem('kestrel_user', JSON.stringify(data.user));
  return data;
}

export async function apiSelectRole(role: string): Promise<{ token: string; user: UserProfile }> {
  const token = localStorage.getItem('kestrel_token');
  const res = await fetchWithTimeout('/api/v1/auth/select-role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Role change failed' }));
    throw new Error(err.message || 'Forbidden role');
  }
  const data = await res.json();
  localStorage.setItem('kestrel_token', data.token);
  localStorage.setItem('kestrel_user', JSON.stringify(data.user));
  return data;
}

export async function apiGetMe(): Promise<{ user: UserProfile }> {
  const token = localStorage.getItem('kestrel_token');
  const res = await fetchWithTimeout('/api/v1/auth/me', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }, 8000); // 8 second timeout for initial session check
  if (!res.ok) {
    throw new Error('Unauthenticated');
  }
  return res.json();
}

export async function apiSignOut(): Promise<void> {
  const token = localStorage.getItem('kestrel_token');
  await fetchWithTimeout('/api/v1/auth/sign-out', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }, 5000).catch(() => {});
  localStorage.removeItem('kestrel_token');
  localStorage.removeItem('kestrel_user');
}

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
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. Please check network/server status.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function extractErrorMessage(res: Response, defaultMsg: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error?.message === 'Protected deployment' || data?.message?.includes('Protected by Vercel Authentication')) {
      return 'Vercel Deployment Protection is active. Please turn off "Vercel Authentication" in your Vercel Project Settings > Deployment Protection.';
    }
    return data?.message || (typeof data?.error === 'string' ? data.error : defaultMsg);
  } catch {
    return `Server HTTP ${res.status}: ${res.statusText || defaultMsg}`;
  }
}

export async function apiSignIn(identifier: string, password: string): Promise<SignInResponse> {
  const res = await fetchWithTimeout('/api/v1/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const errorMsg = await extractErrorMessage(res, 'Invalid credentials');
    throw new Error(errorMsg);
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
    const errorMsg = await extractErrorMessage(res, 'Owner authentication failed');
    throw new Error(errorMsg);
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
    const errorMsg = await extractErrorMessage(res, 'Invalid MFA code');
    throw new Error(errorMsg);
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
    const errorMsg = await extractErrorMessage(res, 'Forbidden role');
    throw new Error(errorMsg);
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
  }, 8000);
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

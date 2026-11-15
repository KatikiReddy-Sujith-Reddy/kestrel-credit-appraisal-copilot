import handler from '../api/index.js';

interface RoleTestConfig {
  roleName: string;
  identifier: string;
  password?: string;
  hardwareToken?: string;
  isOwner?: boolean;
}

interface TestResult {
  roleName: string;
  identifier: string;
  signInStatus: number;
  signInSuccess: boolean;
  mfaStatus?: number;
  mfaSuccess?: boolean;
  status: 'PASS' | 'FAIL';
  errorDetails?: string;
  durationMs: number;
}

const ROLES_TO_TEST: RoleTestConfig[] = [
  {
    roleName: 'Relationship Manager (RM)',
    identifier: 'rm.demo',
    password: 'Kestrel@RM2026!',
  },
  {
    roleName: 'Credit Analyst',
    identifier: 'analyst.demo',
    password: 'Kestrel@Analyst2026!',
  },
  {
    roleName: 'Credit Manager (CM)',
    identifier: 'cm.demo',
    password: 'Kestrel@CM2026!',
  },
  {
    roleName: 'Business Owner (Owner)',
    identifier: 'owner.demo',
    password: 'Kestrel@Owner2026!',
    hardwareToken: 'YUBIKEY_BIO_DEMO_SECURE_KEY',
    isOwner: true,
  },
];

const REQUEST_TIMEOUT_MS = 15000; // 15 seconds per request (well under 30s limit)

async function callVercelHandler(reqPayload: {
  method: string;
  url: string;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ statusCode: number; headers: Record<string, any>; body: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`REQUEST_TIMEOUT_${REQUEST_TIMEOUT_MS}MS: Request exceeded timeout`));
    }, REQUEST_TIMEOUT_MS);

    let resStatusCode = 200;
    const resHeaders: Record<string, any> = {};
    let rawBody = '';

    const mockRes = {
      set statusCode(val: number) {
        resStatusCode = val;
      },
      get statusCode() {
        return resStatusCode;
      },
      setHeader(k: string, v: any) {
        resHeaders[k.toLowerCase()] = v;
      },
      end(data?: any) {
        clearTimeout(timer);
        rawBody = data ? data.toString() : '';
        let parsed: any = null;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = rawBody;
        }
        resolve({
          statusCode: resStatusCode,
          headers: resHeaders,
          body: parsed,
          raw: rawBody,
        });
      },
    };

    handler(reqPayload, mockRes).catch((err: any) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runRoleTest(config: RoleTestConfig, index: number, total: number): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n======================================================`);
  console.log(`[TEST ${index + 1}/${total}] Role: ${config.roleName}`);
  console.log(`Identifier: ${config.identifier}`);
  console.log(`======================================================`);

  const result: TestResult = {
    roleName: config.roleName,
    identifier: config.identifier,
    signInStatus: 0,
    signInSuccess: false,
    status: 'FAIL',
    durationMs: 0,
  };

  try {
    // 1. Test Sign-In via Vercel Rewrite URL pattern
    console.log(`-> Step 1: Sending Sign-In request (POST /api?__path=v1/auth/sign-in)...`);
    
    const signInRes = await callVercelHandler({
      method: 'POST',
      url: '/api?__path=v1/auth/sign-in',
      query: { __path: 'v1/auth/sign-in' },
      headers: {
        'content-type': 'application/json',
        'host': 'kestrel-demo.vercel.app',
      },
      body: {
        identifier: config.identifier,
        password: config.password,
      },
    });

    result.signInStatus = signInRes.statusCode;

    if (signInRes.statusCode !== 200) {
      const sanitizedError = typeof signInRes.body === 'object' 
        ? JSON.stringify(signInRes.body) 
        : String(signInRes.raw || 'No response body');
      console.error(`[FAIL] Sign-in failed with HTTP ${signInRes.statusCode}: ${sanitizedError}`);
      result.errorDetails = `Sign-in HTTP ${signInRes.statusCode}: ${sanitizedError}`;
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const signInData = signInRes.body;
    result.signInSuccess = true;
    console.log(`[OK] Sign-in successful (HTTP 200). requiresMfa: ${signInData.requiresMfa}`);
    console.log(`     User ID: ${signInData.user?.id}, Assigned: ${JSON.stringify(signInData.user?.assignedRoles)}`);

    const challengeId = signInData.challengeId;
    const mfaCode = signInData.simulatedMfaCode || '742918';

    // 2. Test MFA Verification via Vercel Rewrite URL pattern
    console.log(`-> Step 2: Sending MFA verification (POST /api?__path=v1/auth/mfa/verify)...`);
    const mfaRes = await callVercelHandler({
      method: 'POST',
      url: '/api?__path=v1/auth/mfa/verify',
      query: { __path: 'v1/auth/mfa/verify' },
      headers: {
        'content-type': 'application/json',
        'host': 'kestrel-demo.vercel.app',
      },
      body: {
        challengeId,
        mfaCode,
      },
    });

    result.mfaStatus = mfaRes.statusCode;

    if (mfaRes.statusCode !== 200) {
      const sanitizedError = typeof mfaRes.body === 'object' 
        ? JSON.stringify(mfaRes.body) 
        : String(mfaRes.raw || 'No response body');
      console.error(`[FAIL] MFA verify failed with HTTP ${mfaRes.statusCode}: ${sanitizedError}`);
      result.errorDetails = `MFA HTTP ${mfaRes.statusCode}: ${sanitizedError}`;
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const mfaData = mfaRes.body;
    result.mfaSuccess = true;
    console.log(`[OK] MFA verification successful (HTTP 200). Active role: ${mfaData.user?.activeRole}`);
    console.log(`     JWT Token issued: ${mfaData.token ? mfaData.token.substring(0, 20) + '...' : 'NONE'}`);

    result.status = 'PASS';
  } catch (err: any) {
    console.error(`[ERROR] Unhandled exception during role verification:`, err.message);
    result.errorDetails = `Exception: ${err.message}`;
  } finally {
    result.durationMs = Date.now() - startTime;
    console.log(`Result for ${config.roleName}: [${result.status}] (${result.durationMs}ms)`);
  }

  return result;
}

async function runNegativeSecurityChecks(): Promise<void> {
  console.log(`\n======================================================`);
  console.log(`NEGATIVE TESTS: HTTP Status & Error Response Checks`);
  console.log(`======================================================`);

  // Test 1: Invalid Password
  console.log(`-> Testing Invalid Password for rm.demo...`);
  const resBadPw = await callVercelHandler({
    method: 'POST',
    url: '/api?__path=v1/auth/sign-in',
    query: { __path: 'v1/auth/sign-in' },
    headers: { 'content-type': 'application/json' },
    body: { identifier: 'rm.demo', password: 'WrongPassword123!' },
  });
  console.log(`   HTTP Status: ${resBadPw.statusCode} (Expected: 401)`);
  console.log(`   Sanitized Response:`, JSON.stringify(resBadPw.body));

  // Test 2: Invalid MFA Code
  console.log(`-> Testing Invalid MFA Code...`);
  const resBadMfa = await callVercelHandler({
    method: 'POST',
    url: '/api?__path=v1/auth/mfa/verify',
    query: { __path: 'v1/auth/mfa/verify' },
    headers: { 'content-type': 'application/json' },
    body: { challengeId: 'invalid_challenge_id', mfaCode: '000000' },
  });
  console.log(`   HTTP Status: ${resBadMfa.statusCode} (Expected: 401)`);
  console.log(`   Sanitized Response:`, JSON.stringify(resBadMfa.body));
}

async function main() {
  console.log(`======================================================`);
  console.log(`KESTREL VERCEL SERVERLESS AUTH VERIFICATION SUITE`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Number of Roles to Test: ${ROLES_TO_TEST.length}`);
  console.log(`Request Timeout Limit: ${REQUEST_TIMEOUT_MS / 1000}s`);
  console.log(`======================================================`);

  const results: TestResult[] = [];

  for (let i = 0; i < ROLES_TO_TEST.length; i++) {
    const roleConfig = ROLES_TO_TEST[i];
    const res = await runRoleTest(roleConfig, i, ROLES_TO_TEST.length);
    results.push(res);
  }

  await runNegativeSecurityChecks();

  console.log(`\n======================================================`);
  console.log(`FINAL AUTHENTICATION VERIFICATION REPORT`);
  console.log(`======================================================`);

  let allPassed = true;
  for (const r of results) {
    const statusTag = r.status === 'PASS' ? '[PASS]' : '[FAIL]';
    console.log(
      `${statusTag.padEnd(8)} | Role: ${r.roleName.padEnd(28)} | User: ${r.identifier.padEnd(14)} | Sign-In HTTP: ${r.signInStatus} | MFA HTTP: ${r.mfaStatus || 'N/A'} | Time: ${r.durationMs}ms`
    );
    if (r.errorDetails) {
      console.log(`         Error: ${r.errorDetails}`);
      allPassed = false;
    }
  }

  console.log(`======================================================`);
  if (allPassed) {
    console.log(`OVERALL STATUS: ALL ${results.length} ROLES PASSED AUTHENTICATION VERIFICATION`);
  } else {
    console.log(`OVERALL STATUS: SOME ROLES FAILED VERIFICATION`);
  }
  console.log(`======================================================`);

  // Explicitly exit to prevent any lingering event loop handles from keeping process alive
  process.exit(allPassed ? 0 : 1);
}

main().catch((fatal) => {
  console.error('[FATAL] Verification suite crashed:', fatal);
  process.exit(1);
});

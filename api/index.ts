import { createServer } from '../apps/api/src/server.js';

let appPromise: any = null;

async function getFastifyApp() {
  if (!appPromise) {
    appPromise = createServer().then(async (app) => {
      await app.ready();
      return app;
    });
  }
  return appPromise;
}

export function resolveTargetUrl(req: any): string {
  // 1. Check req.query?.__path (from vercel.json rewrite: /api/(.*) -> /api?__path=$1)
  if (req.query?.__path) {
    const rawPath = Array.isArray(req.query.__path) ? req.query.__path.join('/') : String(req.query.__path);
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      urlObj.searchParams.delete('__path');
      const qs = urlObj.search;
      return `/api/${rawPath.replace(/^\/+/, '')}${qs}`;
    } catch {
      return `/api/${rawPath.replace(/^\/+/, '')}`;
    }
  }

  // 2. Check req.query?.path (from catch-all /api/[...path].ts)
  if (req.query?.path) {
    const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path);
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      urlObj.searchParams.delete('path');
      const qs = urlObj.search;
      return `/api/${rawPath.replace(/^\/+/, '')}${qs}`;
    } catch {
      return `/api/${rawPath.replace(/^\/+/, '')}`;
    }
  }

  // 3. Check x-matched-path header (Vercel edge proxy original route)
  const matchedPath = req.headers?.['x-matched-path'];
  if (typeof matchedPath === 'string' && matchedPath.startsWith('/api') && matchedPath !== '/api' && matchedPath !== '/api/') {
    const qIdx = (req.url || '').indexOf('?');
    const qs = qIdx !== -1 ? req.url.slice(qIdx) : '';
    return `${matchedPath}${qs}`;
  }

  // 4. Check x-forwarded-uri header
  const forwardedUri = req.headers?.['x-forwarded-uri'];
  if (typeof forwardedUri === 'string' && forwardedUri.startsWith('/api') && forwardedUri !== '/api' && forwardedUri !== '/api/') {
    return forwardedUri;
  }

  // 5. If req.url is already a specific endpoint under /api/
  if (req.url && req.url !== '/api' && req.url !== '/api/' && req.url.startsWith('/api/')) {
    return req.url;
  }

  // 6. If req.url starts with /v1/
  if (req.url && req.url.startsWith('/v1/')) {
    return `/api${req.url}`;
  }

  // Default fallback for /api or unknown root
  return '/api/v1/health';
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getFastifyApp();

    const targetUrl = resolveTargetUrl(req);

    const headers = { ...(req.headers || {}) };
    // Remove headers that might conflict with Fastify inject
    delete headers['content-length'];
    delete headers['transfer-encoding'];

    let payload: any = undefined;
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = String(headers['content-type'] || '');
      if (contentType.includes('application/json')) {
        payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
        headers['content-type'] = 'application/json';
      } else {
        payload = req.body;
      }
    }

    const response = await app.inject({
      method: req.method || 'GET',
      url: targetUrl,
      headers,
      payload,
    });

    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    }
    return res.end(response.rawPayload);
  } catch (err: any) {
    console.error('[Kestrel Vercel API Error]', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      error: 'INTERNAL_SERVER_ERROR',
      message: err?.message || 'Server error during API execution',
    }));
  }
}

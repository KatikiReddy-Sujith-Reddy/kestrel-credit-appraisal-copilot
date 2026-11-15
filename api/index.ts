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

export default async function handler(req: any, res: any) {
  try {
    const app = await getFastifyApp();

    const url = req.url || '/api/v1/health';

    const response = await app.inject({
      method: req.method || 'GET',
      url,
      headers: req.headers,
      payload: req.body,
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

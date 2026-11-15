import { createRequire } from 'module';
import os from 'os';
import fs from 'fs';
import path from 'path';

export default async function handler(req: any, res: any) {
  const diag: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      DATA_DIR: process.env.DATA_DIR,
      TMPDIR: os.tmpdir(),
    },
    sqlite: {
      loaded: false,
      error: null,
      version: null,
    },
    filesystem: {
      tmpWritable: false,
      tmpError: null,
    },
    appBoot: {
      success: false,
      error: null,
      stack: null,
    },
  };

  // 1. Test tmp filesystem write
  try {
    const testFile = path.join(os.tmpdir(), `kestrel_test_${Date.now()}.txt`);
    fs.writeFileSync(testFile, 'write_test_ok', 'utf8');
    const readBack = fs.readFileSync(testFile, 'utf8');
    fs.unlinkSync(testFile);
    diag.filesystem.tmpWritable = readBack === 'write_test_ok';
  } catch (err: any) {
    diag.filesystem.tmpError = err.message;
  }

  // 2. Test node:sqlite module
  try {
    const nodeReq = createRequire(import.meta.url);
    const sqlite = nodeReq('node:sqlite');
    diag.sqlite.loaded = Boolean(sqlite && sqlite.DatabaseSync);
    if (diag.sqlite.loaded) {
      const memDb = new sqlite.DatabaseSync(':memory:');
      memDb.exec('CREATE TABLE diag_test (val TEXT);');
      memDb.exec("INSERT INTO diag_test VALUES ('ok');");
      const row = memDb.prepare('SELECT val FROM diag_test').get() as any;
      diag.sqlite.version = row?.val;
      memDb.close();
    }
  } catch (err: any) {
    diag.sqlite.error = err.message;
  }

  // 3. Test booting createServer
  try {
    let serverMod: any;
    try {
      serverMod = await import('../apps/api/dist/server.js');
    } catch {
      serverMod = await import('../apps/api/src/server.js');
    }
    const { createServer } = serverMod;
    const app = await createServer();
    await app.ready();
    diag.appBoot.success = true;
  } catch (err: any) {
    diag.appBoot.error = err.message;
    diag.appBoot.stack = err.stack;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  return res.end(JSON.stringify(diag, null, 2));
}

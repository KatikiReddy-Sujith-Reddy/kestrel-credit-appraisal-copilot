import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { config } from '../config.js';

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite');

export interface PreparedStatement {
  run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface KestrelDatabase {
  exec(sql: string): void;
  prepare(sql: string): PreparedStatement;
  pragma(sql: string): any;
  close(): void;
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
}

let dbInstance: KestrelDatabase | null = null;

class NodeSqliteAdapter implements KestrelDatabase {
  private db: any;

  constructor(filePath: string) {
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: any[]) => stmt.run(...params),
      get: (...params: any[]) => stmt.get(...params),
      all: (...params: any[]) => stmt.all(...params),
    };
  }

  pragma(sql: string): any {
    return this.db.exec(`PRAGMA ${sql};`);
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]): T => {
      this.db.exec('BEGIN TRANSACTION;');
      try {
        const result = fn(...args);
        this.db.exec('COMMIT;');
        return result;
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    };
  }
}

export function getDatabase(): KestrelDatabase {
  if (!dbInstance) {
    try {
      if (!fs.existsSync(config.DATA_DIR)) {
        fs.mkdirSync(config.DATA_DIR, { recursive: true });
      }
      const dbPath = path.join(config.DATA_DIR, 'kestrel.db');
      dbInstance = new NodeSqliteAdapter(dbPath);
    } catch (err) {
      console.warn('[Kestrel DB] File-backed SQLite failed, falling back to in-memory database:', err);
      try {
        dbInstance = new NodeSqliteAdapter(':memory:');
      } catch (memErr) {
        console.error('[Kestrel DB] In-memory database failed:', memErr);
        throw memErr;
      }
    }
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

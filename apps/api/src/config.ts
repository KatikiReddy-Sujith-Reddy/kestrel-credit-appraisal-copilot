import os from 'os';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from root workspace or cwd
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultDataDir = isServerless ? path.join(os.tmpdir(), 'kestrel-data') : './data';
const defaultUploadDir = isServerless ? path.join(os.tmpdir(), 'kestrel-uploads') : './uploads';

export const config = {
  // Model Gateway Keys - kept strictly on backend
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  LLM_MODE: (process.env.LLM_MODE || 'simulated') as 'simulated' | 'live',
  PRIMARY_MODEL_ID: process.env.PRIMARY_MODEL_ID || 'gemini-2.5-flash',
  FALLBACK_MODEL_ID: process.env.FALLBACK_MODEL_ID || 'gemini-1.5-flash',
  
  // Auth and Security
  JWT_SECRET: process.env.JWT_SECRET || 'kestrel_default_jwt_secret_dev_32chars_min',
  SESSION_TIMEOUT_MINUTES: 15,
  MAX_LOGIN_FAILURES: 5,
  LOCKOUT_DURATION_MINUTES: 15,

  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',

  // Storage
  DATA_DIR: path.resolve(process.cwd(), process.env.DATA_DIR || defaultDataDir),
  UPLOAD_DIR: path.resolve(process.cwd(), process.env.UPLOAD_DIR || defaultUploadDir),

  // Pilot bounds
  PILOT_MAX_LOAN_AMOUNT: 250000, // $250,000 maximum pilot facility
};

export function hasLiveGeminiKey(): boolean {
  return Boolean(config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 5);
}

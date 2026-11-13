import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
const cwdEnvPath = resolve(process.cwd(), '.env');

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: cwdEnvPath });
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  firebaseApiKey: process.env.FIREBASE_API_KEY ?? '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replaceAll(String.raw`\n`, '\n'),
  isFirebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID),
  hasAdminServiceAccount: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
};

export const isGeminiConfigured = Boolean(config.geminiApiKey);
export const isGroqConfigured = Boolean(config.groqApiKey);

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
  llmProvider: (process.env.LLM_PROVIDER ?? 'auto').toLowerCase(),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  groqBaseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? 'auto').toLowerCase(),
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-004',
  embeddingApiKey: process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL ?? 'https://api.openai.com/v1',
  ragChunkSize: Math.max(100, Number(process.env.RAG_CHUNK_SIZE ?? 700)),
  ragChunkOverlap: Math.max(0, Number(process.env.RAG_CHUNK_OVERLAP ?? 120)),
  ragTopK: Math.max(1, Number(process.env.RAG_TOP_K ?? 4)),
  ragMinScore: Number(process.env.RAG_MIN_SCORE ?? 0.15),
  ragAllowLocalEmbeddingFallback: process.env.RAG_ALLOW_LOCAL_EMBEDDING_FALLBACK !== 'false',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  firebaseApiKey: process.env.FIREBASE_API_KEY ?? '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replaceAll(String.raw`\n`, '\n'),
  isFirebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID),
  hasAdminServiceAccount: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
};

export const isGeminiConfigured = Boolean(config.geminiApiKey);
export const isGroqConfigured = Boolean(config.groqApiKey);

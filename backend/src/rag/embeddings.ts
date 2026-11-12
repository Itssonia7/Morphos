import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config, isGeminiConfigured } from '../config.js';
import type { EmbeddingProviderMode } from './types.js';

export class EmbeddingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingUnavailableError';
  }
}

const LOCAL_VECTOR_DIMENSIONS = 256;

function fnv1a32(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function l2Normalize(vector: number[]): number[] {
  let normSq = 0;
  for (let i = 0; i < vector.length; i += 1) {
    normSq += vector[i] * vector[i];
  }
  if (normSq === 0) {
    return vector;
  }
  const invNorm = 1 / Math.sqrt(normSq);
  return vector.map((v) => Number((v * invNorm).toFixed(6)));
}

/**
 * Deterministic local dense vector embedder extending LangChain's Embeddings interface.
 * Projects unigrams, bigrams, and character n-grams into an L2-normalized 256-dim vector space
 * so cosine-similarity vector retrieval remains functional when external embedding APIs are
 * unconfigured, offline, or rate-limited (HTTP 429).
 */
export class LocalSemanticEmbeddings extends Embeddings {
  readonly modelName = 'local-semantic-ngram-256';
  private readonly dimensions: number;

  constructor(params: EmbeddingsParams & { dimensions?: number } = {}) {
    super(params);
    this.dimensions = params.dimensions ?? LOCAL_VECTOR_DIMENSIONS;
  }

  private embedSingle(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9_.\s-]/g, ' ').trim();
    if (!normalized) {
      return vector;
    }

    const tokens = normalized.split(/\s+/).filter((token) => token.length > 1);
    const projectFeature = (feature: string, weight: number) => {
      const h1 = fnv1a32(feature, 0x811c9dc5);
      const h2 = fnv1a32(feature, 0x9e3779b1);
      const idx1 = h1 % this.dimensions;
      const idx2 = h2 % this.dimensions;
      const sign1 = (h1 & 1) === 0 ? 1 : -1;
      const sign2 = (h2 & 2) === 0 ? 1 : -1;
      vector[idx1] += sign1 * weight;
      vector[idx2] += sign2 * weight * 0.75;
    };

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      projectFeature(`tok:${token}`, 2.0);

      if (i + 1 < tokens.length) {
        projectFeature(`bg:${token}_${tokens[i + 1]}`, 1.4);
      }

      if (token.length >= 4) {
        for (let j = 0; j <= token.length - 3; j += 1) {
          projectFeature(`c3:${token.slice(j, j + 3)}`, 0.45);
        }
      }
    }

    return l2Normalize(vector);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((doc) => this.embedSingle(doc));
  }

  async embedQuery(document: string): Promise<number[]> {
    return this.embedSingle(document);
  }
}

export class OpenAICompatibleEmbeddings extends Embeddings {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; model: string; baseUrl: string } & EmbeddingsParams) {
    super(options);
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  private async requestEmbeddings(input: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Embedding HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };

    if (!Array.isArray(payload.data) || payload.data.length !== input.length) {
      throw new Error('Malformed embedding response payload.');
    }

    return payload.data
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((item) => {
        if (!Array.isArray(item.embedding) || item.embedding.length === 0) {
          throw new Error('Embedding response contained empty vector.');
        }
        return item.embedding;
      });
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    if (documents.length === 0) return [];
    return this.requestEmbeddings(documents);
  }

  async embedQuery(document: string): Promise<number[]> {
    const [vector] = await this.requestEmbeddings([document]);
    return vector;
  }
}

export interface EmbeddingServiceOptions {
  provider?: string;
  model?: string;
  geminiApiKey?: string;
  embeddingApiKey?: string;
  embeddingBaseUrl?: string;
  allowLocalFallback?: boolean;
  customEmbeddings?: Embeddings;
  customProviderMode?: EmbeddingProviderMode;
  useLiveRemote?: boolean;
}

export interface BatchEmbeddingResult {
  vectors: number[][];
  provider: EmbeddingProviderMode;
  model: string;
  warning?: string;
}

export interface SingleEmbeddingResult {
  vector: number[];
  provider: EmbeddingProviderMode;
  model: string;
  warning?: string;
}

export class EmbeddingService {
  private readonly providerConfig: string;
  private readonly model: string;
  private readonly geminiApiKey: string;
  private readonly embeddingApiKey: string;
  private readonly embeddingBaseUrl: string;
  private readonly allowLocalFallback: boolean;
  private readonly customEmbeddings?: Embeddings;
  private readonly customProviderMode?: EmbeddingProviderMode;
  private readonly useLiveRemote: boolean;
  private readonly localFallback = new LocalSemanticEmbeddings();

  constructor(options: EmbeddingServiceOptions = {}) {
    this.providerConfig = (options.provider ?? config.embeddingProvider).toLowerCase();
    this.model = options.model ?? config.embeddingModel;
    this.geminiApiKey = options.geminiApiKey ?? config.geminiApiKey;
    this.embeddingApiKey = options.embeddingApiKey ?? config.embeddingApiKey;
    this.embeddingBaseUrl = options.embeddingBaseUrl ?? config.embeddingBaseUrl;
    this.allowLocalFallback = options.allowLocalFallback ?? config.ragAllowLocalEmbeddingFallback;
    this.customEmbeddings = options.customEmbeddings;
    this.customProviderMode = options.customProviderMode;
    this.useLiveRemote =
      options.useLiveRemote ??
      (process.env.NODE_ENV !== 'test' && process.env.USE_LIVE_EMBEDDINGS !== 'false');
  }

  private resolvePrimaryProvider(): {
    mode: EmbeddingProviderMode;
    model: string;
    instance: Embeddings;
  } | null {
    if (this.customEmbeddings) {
      return {
        mode: this.customProviderMode ?? 'gemini',
        model: this.model,
        instance: this.customEmbeddings,
      };
    }

    if (this.providerConfig === 'local' || this.providerConfig === 'local-fallback') {
      return {
        mode: 'local-fallback',
        model: this.localFallback.modelName,
        instance: this.localFallback,
      };
    }

    if (!this.useLiveRemote) {
      return null;
    }

    if (this.providerConfig === 'openai-compatible') {
      if (!this.embeddingApiKey) {
        return null;
      }
      return {
        mode: 'openai-compatible',
        model: this.model,
        instance: new OpenAICompatibleEmbeddings({
          apiKey: this.embeddingApiKey,
          model: this.model,
          baseUrl: this.embeddingBaseUrl,
        }),
      };
    }

    if (this.providerConfig === 'gemini') {
      if (!this.geminiApiKey) {
        return null;
      }
      return {
        mode: 'gemini',
        model: this.model,
        instance: new GoogleGenerativeAIEmbeddings({
          apiKey: this.geminiApiKey,
          model: this.model,
        }),
      };
    }

    // 'auto' mode: prefer configured Gemini, then OpenAI-compatible
    if (this.geminiApiKey || isGeminiConfigured) {
      const apiKey = this.geminiApiKey || config.geminiApiKey;
      if (apiKey) {
        return {
          mode: 'gemini',
          model: this.model,
          instance: new GoogleGenerativeAIEmbeddings({
            apiKey,
            model: this.model,
          }),
        };
      }
    }

    if (this.embeddingApiKey) {
      return {
        mode: 'openai-compatible',
        model: this.model,
        instance: new OpenAICompatibleEmbeddings({
          apiKey: this.embeddingApiKey,
          model: this.model,
          baseUrl: this.embeddingBaseUrl,
        }),
      };
    }

    return null;
  }

  async embedDocuments(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return {
        vectors: [],
        provider: 'local-fallback',
        model: this.localFallback.modelName,
      };
    }

    const primary = this.resolvePrimaryProvider();
    if (!primary) {
      if (!this.allowLocalFallback) {
        throw new EmbeddingUnavailableError(
          `Embedding provider "${this.providerConfig}" is not configured and local fallback is disabled.`,
        );
      }
      const vectors = await this.localFallback.embedDocuments(texts);
      return {
        vectors,
        provider: 'local-fallback',
        model: this.localFallback.modelName,
        warning: this.useLiveRemote
          ? 'External embedding API key is not configured; using deterministic local semantic embeddings.'
          : 'Offline/test mode active; using deterministic local semantic embeddings.',
      };
    }

    try {
      const vectors = await primary.instance.embedDocuments(texts);
      const valid =
        Array.isArray(vectors) &&
        vectors.length === texts.length &&
        vectors.every((vec) => Array.isArray(vec) && vec.length > 0 && vec.every((n) => Number.isFinite(n)));

      if (!valid) {
        throw new Error('Embedding provider returned malformed or empty vectors.');
      }

      return {
        vectors,
        provider: primary.mode,
        model: primary.model,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (!this.allowLocalFallback) {
        throw new EmbeddingUnavailableError(`Embedding API failed (${primary.mode}): ${reason}`);
      }
      console.warn(`Embedding provider (${primary.mode}) failed; falling back to local semantic embeddings.`, {
        reason,
      });
      const vectors = await this.localFallback.embedDocuments(texts);
      return {
        vectors,
        provider: 'local-fallback',
        model: this.localFallback.modelName,
        warning: `Primary embedding provider (${primary.mode}) unavailable (${reason}); used local semantic fallback.`,
      };
    }
  }

  async embedQuery(text: string): Promise<SingleEmbeddingResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      const vector = await this.localFallback.embedQuery('');
      return {
        vector,
        provider: 'local-fallback',
        model: this.localFallback.modelName,
        warning: 'Empty query text provided.',
      };
    }

    const primary = this.resolvePrimaryProvider();
    if (!primary) {
      if (!this.allowLocalFallback) {
        throw new EmbeddingUnavailableError(
          `Embedding provider "${this.providerConfig}" is not configured and local fallback is disabled.`,
        );
      }
      const vector = await this.localFallback.embedQuery(trimmed);
      return {
        vector,
        provider: 'local-fallback',
        model: this.localFallback.modelName,
        warning: this.useLiveRemote
          ? 'External embedding API key is not configured; using deterministic local semantic embeddings.'
          : 'Offline/test mode active; using deterministic local semantic embeddings.',
      };
    }

    try {
      const vector = await primary.instance.embedQuery(trimmed);
      if (!Array.isArray(vector) || vector.length === 0 || !vector.every((n) => Number.isFinite(n))) {
        throw new Error('Embedding provider returned malformed query vector.');
      }
      return {
        vector,
        provider: primary.mode,
        model: primary.model,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (!this.allowLocalFallback) {
        throw new EmbeddingUnavailableError(`Embedding query failed (${primary.mode}): ${reason}`);
      }
      console.warn(`Query embedding (${primary.mode}) failed; falling back to local semantic embeddings.`, {
        reason,
      });
      const vector = await this.localFallback.embedQuery(trimmed);
      return {
        vector,
        provider: 'local-fallback',
        model: this.localFallback.modelName,
        warning: `Primary embedding provider (${primary.mode}) unavailable (${reason}); used local semantic fallback.`,
      };
    }
  }

  async embedWithLocalFallback(text: string): Promise<number[]> {
    return this.localFallback.embedQuery(text);
  }
}


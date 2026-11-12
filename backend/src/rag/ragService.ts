import { config } from '../config.js';
import {
  deleteKnowledgeDocumentForUser,
  getKnowledgeChunksForUser,
  getKnowledgeDocumentsForUser,
  saveKnowledgeDocumentWithChunks,
} from '../services/firebase.js';
import { createKnowledgeChunks, RagValidationError } from './chunker.js';
import { EmbeddingService, type EmbeddingServiceOptions } from './embeddings.js';
import type {
  KnowledgeChunkRecord,
  KnowledgeContentType,
  KnowledgeDocumentRecord,
  RetrievalResult,
  RetrievedChunk,
} from './types.js';
import { MorphosVectorStore, type ChunkLoaderFn } from './vectorStore.js';

export interface IngestDocumentInput {
  userId: string;
  sourceName: string;
  content: string;
  projectId?: string;
  investigationId?: string;
  contentType?: KnowledgeContentType;
  section?: string;
  page?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IngestDocumentResult {
  documentId: string;
  sourceName: string;
  projectId: string;
  chunkCount: number;
  charCount: number;
  embeddingProvider: string;
  embeddingModel: string;
  storageMode: 'firebase' | 'dev-fallback';
  warning?: string;
}

export interface RetrieveKnowledgeInput {
  query: string;
  userId: string;
  projectId?: string;
  investigationId?: string;
  topK?: number;
  minScore?: number;
}

export interface RagServiceDeps {
  embeddingService?: EmbeddingService;
  embeddingOptions?: EmbeddingServiceOptions;
  loadChunks?: ChunkLoaderFn;
}

export function formatRetrievedContextForPrompt(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  return chunks
    .map((chunk, idx) => {
      const locationParts = [
        `Source: ${chunk.sourceName}`,
        `Chunk: ${chunk.chunkId}`,
        chunk.metadata.section ? `Section: ${chunk.metadata.section}` : null,
        chunk.metadata.page !== undefined ? `Page: ${chunk.metadata.page}` : null,
        `Similarity: ${chunk.score.toFixed(2)}`,
      ].filter(Boolean);

      return `[KB-${idx + 1}] (${locationParts.join(' | ')})\n${chunk.content}`;
    })
    .join('\n\n---\n\n');
}

export async function ingestKnowledgeDocument(
  input: IngestDocumentInput,
  deps: RagServiceDeps = {},
): Promise<IngestDocumentResult> {
  const chunked = createKnowledgeChunks(input);
  const embeddingService = deps.embeddingService ?? new EmbeddingService(deps.embeddingOptions);

  const texts = chunked.chunks.map((c) => c.content);
  const embedded = await embeddingService.embedDocuments(texts);

  const now = new Date().toISOString();
  const documentRecord: KnowledgeDocumentRecord = {
    id: chunked.documentId,
    userId: input.userId.trim(),
    projectId: chunked.projectId,
    ...(input.investigationId ? { investigationId: input.investigationId.trim() } : {}),
    sourceName: chunked.sourceName,
    contentType: chunked.contentType,
    chunkCount: chunked.chunks.length,
    charCount: chunked.charCount,
    embeddingProvider: embedded.provider,
    embeddingModel: embedded.model,
    createdAt: now,
    updatedAt: now,
  };

  const chunkRecords: KnowledgeChunkRecord[] = chunked.chunks.map((chunk, idx) => ({
    chunkId: chunk.metadata.chunkId,
    content: chunk.content,
    embedding: embedded.vectors[idx],
    embeddingProvider: embedded.provider,
    embeddingModel: embedded.model,
    metadata: chunk.metadata,
  }));

  const saved = await saveKnowledgeDocumentWithChunks(documentRecord, chunkRecords);

  return {
    documentId: chunked.documentId,
    sourceName: chunked.sourceName,
    projectId: chunked.projectId,
    chunkCount: chunked.chunks.length,
    charCount: chunked.charCount,
    embeddingProvider: embedded.provider,
    embeddingModel: embedded.model,
    storageMode: saved.mode,
    ...(embedded.warning ? { warning: embedded.warning } : {}),
  };
}

export async function retrieveKnowledgeContext(
  input: RetrieveKnowledgeInput,
  deps: RagServiceDeps = {},
): Promise<RetrievalResult> {
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  const topK = Math.max(1, Math.min(20, input.topK ?? config.ragTopK));
  const minScore = input.minScore ?? config.ragMinScore;
  const projectId = input.projectId?.trim() || undefined;
  const investigationId = input.investigationId?.trim() || undefined;

  if (!query || !userId) {
    return {
      chunks: [],
      contextText: '',
      query,
      topK,
      totalCandidatesEvaluated: 0,
      embeddingProvider: 'local-fallback',
      embeddingModel: 'none',
      hasContext: false,
      warning: !userId ? 'Missing authenticated userId for knowledge retrieval.' : 'Empty query provided.',
    };
  }

  const embeddingService = deps.embeddingService ?? new EmbeddingService(deps.embeddingOptions);

  try {
    const queryEmbedding = await embeddingService.embedQuery(query);
    const vectorStore = new MorphosVectorStore(
      {
        embedDocuments: async (docs) => (await embeddingService.embedDocuments(docs)).vectors,
        embedQuery: async (text) => (await embeddingService.embedQuery(text)).vector,
      },
      { loadChunks: deps.loadChunks },
    );

    let diagnostics = await vectorStore.similaritySearchVectorWithDiagnostics(
      queryEmbedding.vector,
      topK,
      {
        userId,
        projectId,
        investigationId,
        minScore,
      },
    );

    let warning = queryEmbedding.warning;
    let activeProvider = queryEmbedding.provider;
    let activeModel = queryEmbedding.model;

    // Handle cross-environment dimension mismatch gracefully (e.g., documents ingested with local-fallback 256-d
    // while query runs with remote 768-d, or vice versa) when no same-dimension matches were found.
    if (diagnostics.results.length === 0 && diagnostics.dimensionMismatchCount > 0) {
      const localVector = await embeddingService.embedWithLocalFallback(query);
      const fallbackDiag = await vectorStore.similaritySearchVectorWithDiagnostics(
        localVector,
        topK,
        {
          userId,
          projectId,
          investigationId,
          minScore,
        },
      );
      if (fallbackDiag.results.length > 0) {
        diagnostics = fallbackDiag;
        activeProvider = 'local-fallback';
        activeModel = 'local-semantic-ngram-256';
        warning = warning
          ? `${warning} Matched stored local-fallback vectors.`
          : 'Matched stored vectors using local semantic embedding dimensions.';
      }
    }

    const chunks: RetrievedChunk[] = diagnostics.results.map(([doc, score]) => ({
      chunkId: doc.metadata.chunkId,
      documentId: doc.metadata.documentId,
      sourceName: doc.metadata.sourceName,
      content: doc.pageContent,
      score,
      metadata: doc.metadata,
    }));

    return {
      chunks,
      contextText: formatRetrievedContextForPrompt(chunks),
      query,
      topK,
      totalCandidatesEvaluated: diagnostics.totalCandidatesEvaluated,
      embeddingProvider: activeProvider,
      embeddingModel: activeModel,
      hasContext: chunks.length > 0,
      ...(warning ? { warning } : {}),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('Knowledge retrieval failed; continuing investigation without KB context.', { reason });
    return {
      chunks: [],
      contextText: '',
      query,
      topK,
      totalCandidatesEvaluated: 0,
      embeddingProvider: 'local-fallback',
      embeddingModel: 'unavailable',
      hasContext: false,
      warning: `Knowledge retrieval unavailable (${reason}); continuing without KB context.`,
    };
  }
}

export async function listUserKnowledgeDocuments(
  userId: string,
  projectId?: string,
): Promise<KnowledgeDocumentRecord[]> {
  return getKnowledgeDocumentsForUser(userId, projectId);
}

export async function removeUserKnowledgeDocument(
  documentId: string,
  userId: string,
): Promise<'deleted' | 'not_found' | 'forbidden' | 'error'> {
  return deleteKnowledgeDocumentForUser(documentId, userId);
}

export { RagValidationError, getKnowledgeChunksForUser };


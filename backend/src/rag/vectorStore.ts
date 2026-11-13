import { Document } from '@langchain/core/documents';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import {
  getKnowledgeChunksForUser,
  saveKnowledgeDocumentWithChunks,
} from '../services/firebase.js';
import type {
  EmbeddingProviderMode,
  KnowledgeChunkMetadata,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
} from './types.js';

export interface VectorSearchFilter {
  userId: string;
  projectId?: string;
  investigationId?: string;
  minScore?: number;
}

export interface VectorSearchDiagnostics {
  results: Array<[Document<KnowledgeChunkMetadata>, number]>;
  totalCandidatesEvaluated: number;
  dimensionMismatchCount: number;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface ChunkLoaderFn {
  (userId: string, options: { projectId?: string; investigationId?: string }): Promise<KnowledgeChunkRecord[]>;
}

/**
 * LangChain VectorStore backed by Firestore (with in-memory fallback) and strict user/project isolation.
 */
export class MorphosVectorStore extends VectorStore {
  declare FilterType: VectorSearchFilter;
  private readonly loadChunks: ChunkLoaderFn;

  constructor(
    embeddings: EmbeddingsInterface,
    options: { loadChunks?: ChunkLoaderFn } = {},
  ) {
    super(embeddings, {});
    this.loadChunks = options.loadChunks ?? ((userId, scope) => getKnowledgeChunksForUser(userId, scope));
  }

  _vectorstoreType(): string {
    return 'morphos_firestore_vector_store';
  }

  async addDocuments(
    documents: Document<KnowledgeChunkMetadata>[],
    options?: {
      documentRecord?: KnowledgeDocumentRecord;
      embeddingProvider?: EmbeddingProviderMode;
      embeddingModel?: string;
    },
  ): Promise<string[]> {
    const texts = documents.map((doc) => doc.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents, options);
  }

  async addVectors(
    vectors: number[][],
    documents: Document<KnowledgeChunkMetadata>[],
    options?: {
      documentRecord?: KnowledgeDocumentRecord;
      embeddingProvider?: EmbeddingProviderMode;
      embeddingModel?: string;
    },
  ): Promise<string[]> {
    if (vectors.length !== documents.length) {
      throw new Error('Vectors count must match documents count.');
    }
    if (documents.length === 0) {
      return [];
    }

    const firstMeta = documents[0].metadata;
    if (!firstMeta?.userId) {
      throw new Error('userId metadata is required on all stored vectors.');
    }

    const provider = options?.embeddingProvider ?? 'local-fallback';
    const model = options?.embeddingModel ?? 'unknown';

    const chunkRecords: KnowledgeChunkRecord[] = documents.map((doc, idx) => ({
      chunkId: doc.metadata.chunkId,
      content: doc.pageContent,
      embedding: vectors[idx],
      embeddingProvider: provider,
      embeddingModel: model,
      metadata: doc.metadata,
    }));

    const documentRecord: KnowledgeDocumentRecord = options?.documentRecord ?? {
      id: firstMeta.documentId,
      userId: firstMeta.userId,
      projectId: firstMeta.projectId || 'default',
      ...(firstMeta.investigationId ? { investigationId: firstMeta.investigationId } : {}),
      sourceName: firstMeta.sourceName,
      contentType: 'text/plain',
      chunkCount: documents.length,
      charCount: documents.reduce((sum, doc) => sum + doc.pageContent.length, 0),
      embeddingProvider: provider,
      embeddingModel: model,
      createdAt: firstMeta.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveKnowledgeDocumentWithChunks(documentRecord, chunkRecords);
    return chunkRecords.map((c) => c.chunkId);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this['FilterType'],
  ): Promise<[Document<KnowledgeChunkMetadata>, number][]> {
    const diagnostics = await this.similaritySearchVectorWithDiagnostics(query, k, filter);
    return diagnostics.results;
  }

  async similaritySearchVectorWithDiagnostics(
    query: number[],
    k: number,
    filter?: VectorSearchFilter,
  ): Promise<VectorSearchDiagnostics> {
    if (!filter?.userId || !Array.isArray(query) || query.length === 0 || k <= 0) {
      return {
        results: [],
        totalCandidatesEvaluated: 0,
        dimensionMismatchCount: 0,
      };
    }

    const candidates = await this.loadChunks(filter.userId, {
      projectId: filter.projectId,
      investigationId: filter.investigationId,
    });

    if (candidates.length === 0) {
      return {
        results: [],
        totalCandidatesEvaluated: 0,
        dimensionMismatchCount: 0,
      };
    }

    const minScore = filter.minScore ?? 0;
    let dimensionMismatchCount = 0;

    const scored: Array<{ doc: Document<KnowledgeChunkMetadata>; score: number }> = [];

    for (const chunk of candidates) {
      // Defense-in-depth ownership check even if a backing store query was misconfigured
      if (chunk.metadata?.userId !== filter.userId) {
        continue;
      }
      if (filter.projectId && chunk.metadata?.projectId !== filter.projectId) {
        continue;
      }

      if (!Array.isArray(chunk.embedding) || chunk.embedding.length !== query.length) {
        dimensionMismatchCount += 1;
        continue;
      }

      const score = cosineSimilarity(query, chunk.embedding);
      if (Number.isFinite(score) && score >= minScore) {
        scored.push({
          doc: new Document<KnowledgeChunkMetadata>({
            pageContent: chunk.content,
            metadata: chunk.metadata,
          }),
          score: Number(score.toFixed(4)),
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return {
      results: scored.slice(0, k).map((entry) => [entry.doc, entry.score]),
      totalCandidatesEvaluated: candidates.length,
      dimensionMismatchCount,
    };
  }
}


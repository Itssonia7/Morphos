export type EmbeddingProviderMode = 'gemini' | 'openai-compatible' | 'local-fallback';

export type KnowledgeContentType = 'text/plain' | 'text/markdown' | 'application/json' | 'text/html';

export interface KnowledgeChunkMetadata {
  documentId: string;
  sourceName: string;
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  userId: string;
  projectId: string;
  investigationId?: string;
  section?: string;
  page?: number;
  createdAt: string;
}

export interface KnowledgeChunkRecord {
  chunkId: string;
  content: string;
  embedding: number[];
  embeddingProvider: EmbeddingProviderMode;
  embeddingModel: string;
  metadata: KnowledgeChunkMetadata;
}

export interface KnowledgeDocumentRecord {
  id: string;
  userId: string;
  projectId: string;
  investigationId?: string;
  sourceName: string;
  contentType: KnowledgeContentType;
  chunkCount: number;
  charCount: number;
  embeddingProvider: EmbeddingProviderMode;
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  sourceName: string;
  content: string;
  score: number;
  metadata: KnowledgeChunkMetadata;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  contextText: string;
  query: string;
  topK: number;
  totalCandidatesEvaluated: number;
  embeddingProvider: EmbeddingProviderMode;
  embeddingModel: string;
  hasContext: boolean;
  warning?: string;
}

export interface RagSummary {
  enabled: boolean;
  retrievedCount: number;
  sources: string[];
  embeddingProvider?: EmbeddingProviderMode;
  warning?: string;
}


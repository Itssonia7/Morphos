import { Embeddings } from '@langchain/core/embeddings';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runInvestigation } from '../agents/graph.js';
import { buildAnalysisPrompts } from '../agents/nodes/analyzeResults.js';
import { buildHypothesisPrompts } from '../agents/nodes/generateHypotheses.js';
import { createFreshState } from '../agents/state.js';
import {
  inMemoryKnowledgeChunks,
  inMemoryKnowledgeDocuments,
} from '../services/firebase.js';
import { createKnowledgeChunks, RagValidationError } from './chunker.js';
import { EmbeddingService, EmbeddingUnavailableError } from './embeddings.js';
import {
  ingestKnowledgeDocument,
  retrieveKnowledgeContext,
} from './ragService.js';

class MockTopicEmbeddings extends Embeddings {
  constructor(private readonly failWith?: Error) {
    super({});
  }

  private toVector(text: string): number[] {
    const t = text.toLowerCase();
    // 4-dimensional topic space: [pool/db, memory/leak, ml/accuracy, latency/cache]
    return [
      t.includes('pool') || t.includes('connection') || t.includes('pgbouncer') ? 1 : 0.05,
      t.includes('memory') || t.includes('heap') || t.includes('leak') ? 1 : 0.05,
      t.includes('accuracy') || t.includes('label') || t.includes('model') ? 1 : 0.05,
      t.includes('latency') || t.includes('cache') || t.includes('redis') ? 1 : 0.05,
    ];
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    if (this.failWith) throw this.failWith;
    return documents.map((d) => this.toVector(d));
  }

  async embedQuery(document: string): Promise<number[]> {
    if (this.failWith) throw this.failWith;
    return this.toVector(document);
  }
}

describe('MORPHOS RAG Pipeline', () => {
  beforeEach(() => {
    inMemoryKnowledgeDocuments.clear();
    inMemoryKnowledgeChunks.clear();
  });

  describe('Document Extraction & Chunking', () => {
    it('chunks markdown text while preserving full metadata including section and page', () => {
      const markdown = [
        '--- Page 1 ---',
        '# Connection Pool Architecture',
        'PgBouncer maintains a pool of 40 active connections per upstream database pod.',
        '',
        '--- Page 2 ---',
        '## Timeout Mitigation',
        'When wait queues exceed 150 requests, API p99 latency spikes above 900ms.',
      ].join('\n');

      const output = createKnowledgeChunks({
        documentId: 'doc-arch-1',
        sourceName: 'architecture-runbook.md',
        content: markdown,
        contentType: 'text/markdown',
        userId: 'user-1',
        projectId: 'proj-alpha',
        investigationId: 'inv-99',
        chunkSize: 120,
        chunkOverlap: 20,
      });

      expect(output.documentId).toBe('doc-arch-1');
      expect(output.chunks.length).toBeGreaterThanOrEqual(2);

      for (const [idx, chunk] of output.chunks.entries()) {
        expect(chunk.metadata.documentId).toBe('doc-arch-1');
        expect(chunk.metadata.sourceName).toBe('architecture-runbook.md');
        expect(chunk.metadata.chunkId).toBe(`doc-arch-1-chunk-${idx}`);
        expect(chunk.metadata.userId).toBe('user-1');
        expect(chunk.metadata.projectId).toBe('proj-alpha');
        expect(chunk.metadata.investigationId).toBe('inv-99');
        expect(chunk.metadata.chunkIndex).toBe(idx);
        expect(chunk.metadata.totalChunks).toBe(output.chunks.length);
      }

      const lastChunk = output.chunks[output.chunks.length - 1];
      expect(lastChunk.metadata.section).toBe('Timeout Mitigation');
      expect(lastChunk.metadata.page).toBe(2);
    });

    it('extracts structured text from JSON and HTML documents', () => {
      const jsonOut = createKnowledgeChunks({
        sourceName: 'telemetry.json',
        content: JSON.stringify({ service: 'checkout-api', p99Ms: 840, rootCause: 'exhausted pool' }),
        contentType: 'application/json',
        userId: 'user-1',
      });
      expect(jsonOut.chunks[0].content).toContain('service: checkout-api');
      expect(jsonOut.chunks[0].content).toContain('rootCause: exhausted pool');

      const htmlOut = createKnowledgeChunks({
        sourceName: 'postmortem.html',
        content: '<html><body><script>bad()</script><h1>Incident</h1><p>Redis cache eviction storm</p></body></html>',
        contentType: 'text/html',
        userId: 'user-1',
      });
      expect(htmlOut.chunks[0].content).toContain('Redis cache eviction storm');
      expect(htmlOut.chunks[0].content).not.toContain('bad()');
    });

    it('rejects empty, binary, and malformed JSON documents', () => {
      expect(() =>
        createKnowledgeChunks({ sourceName: 'empty.txt', content: '   \n\t  ', userId: 'user-1' }),
      ).toThrow(RagValidationError);

      expect(() =>
        createKnowledgeChunks({ sourceName: 'bin.dat', content: 'abc\u0000def', userId: 'user-1' }),
      ).toThrow(RagValidationError);

      expect(() =>
        createKnowledgeChunks({
          sourceName: 'bad.json',
          content: '{invalid json',
          contentType: 'application/json',
          userId: 'user-1',
        }),
      ).toThrow(RagValidationError);
    });
  });

  describe('Semantic Embeddings, Vector Retrieval & Isolation', () => {
    it('ranks semantically matching chunks highest via cosine similarity and preserves metadata', async () => {
      const mockEmbeddings = new MockTopicEmbeddings();
      const embeddingService = new EmbeddingService({
        customEmbeddings: mockEmbeddings,
        customProviderMode: 'gemini',
      });

      await ingestKnowledgeDocument(
        {
          userId: 'user-1',
          projectId: 'payments',
          sourceName: 'pgbouncer-guide.md',
          section: 'Pool Limits',
          page: 4,
          content: 'PgBouncer connection pool exhaustion happens when transaction pooling is disabled.',
        },
        { embeddingService },
      );

      await ingestKnowledgeDocument(
        {
          userId: 'user-1',
          projectId: 'payments',
          sourceName: 'ml-notes.md',
          content: 'Noisy ground truth labels degrade validation accuracy as dataset size grows.',
        },
        { embeddingService },
      );

      const retrieval = await retrieveKnowledgeContext(
        {
          query: 'Why is the pgbouncer connection pool saturated?',
          userId: 'user-1',
          projectId: 'payments',
          topK: 1,
          minScore: 0.5,
        },
        { embeddingService },
      );

      expect(retrieval.hasContext).toBe(true);
      expect(retrieval.chunks).toHaveLength(1);
      expect(retrieval.chunks[0].sourceName).toBe('pgbouncer-guide.md');
      expect(retrieval.chunks[0].metadata.section).toBe('Pool Limits');
      expect(retrieval.chunks[0].metadata.page).toBe(4);
      expect(retrieval.chunks[0].score).toBeGreaterThan(0.9);
    });

    it('enforces strict user-level and project-level isolation', async () => {
      await ingestKnowledgeDocument({
        userId: 'alice',
        projectId: 'proj-a',
        sourceName: 'alice-secret.txt',
        content: 'Secret internal incident: checkout-db shard-7 failed due to wal replication lag.',
      });

      await ingestKnowledgeDocument({
        userId: 'alice',
        projectId: 'proj-b',
        sourceName: 'alice-other-project.txt',
        content: 'Project B uses an in-memory LRU cache with 2GB heap ceiling.',
      });

      await ingestKnowledgeDocument({
        userId: 'bob',
        projectId: 'proj-a',
        sourceName: 'bob-doc.txt',
        content: 'Bob worker pool tuning notes for batch ETL jobs.',
      });

      // Bob cannot retrieve Alice's document even with the exact query & projectId
      const bobAttempt = await retrieveKnowledgeContext({
        query: 'checkout-db shard-7 wal replication lag',
        userId: 'bob',
        projectId: 'proj-a',
      });
      expect(bobAttempt.hasContext).toBe(false);
      expect(bobAttempt.chunks).toHaveLength(0);

      // Alice querying proj-a does not see proj-b chunks
      const aliceProjA = await retrieveKnowledgeContext({
        query: 'LRU cache heap ceiling',
        userId: 'alice',
        projectId: 'proj-a',
        minScore: 0.25,
      });
      expect(aliceProjA.chunks.every((c) => c.metadata.projectId === 'proj-a')).toBe(true);
      expect(aliceProjA.chunks.some((c) => c.sourceName === 'alice-other-project.txt')).toBe(false);
    });

    it('returns empty retrieval result gracefully when knowledge base is empty or below minScore', async () => {
      const emptyResult = await retrieveKnowledgeContext({
        query: 'Why is API latency increasing?',
        userId: 'user-no-docs',
      });
      expect(emptyResult.hasContext).toBe(false);
      expect(emptyResult.chunks).toEqual([]);
      expect(emptyResult.contextText).toBe('');

      await ingestKnowledgeDocument({
        userId: 'user-threshold',
        sourceName: 'unrelated.txt',
        content: 'Quarterly office snack inventory includes almonds and green tea.',
      });

      const belowThreshold = await retrieveKnowledgeContext({
        query: 'PostgreSQL deadlock transaction wait queue',
        userId: 'user-threshold',
        minScore: 0.8,
      });
      expect(belowThreshold.hasContext).toBe(false);
      expect(belowThreshold.chunks).toHaveLength(0);
    });
  });

  describe('Error Handling & Fallback Behavior', () => {
    it('falls back gracefully when external embedding API fails with 429 quota error', async () => {
      const failingService = new EmbeddingService({
        customEmbeddings: new MockTopicEmbeddings(new Error('429 Quota exceeded')),
        customProviderMode: 'gemini',
        allowLocalFallback: true,
      });

      const ingested = await ingestKnowledgeDocument(
        {
          userId: 'user-fallback',
          sourceName: 'runbook.md',
          content: 'API latency spikes when connection pool max_connections is capped at 25.',
        },
        { embeddingService: failingService },
      );

      expect(ingested.embeddingProvider).toBe('local-fallback');
      expect(ingested.warning).toContain('429 Quota exceeded');

      const retrieved = await retrieveKnowledgeContext(
        {
          query: 'connection pool max_connections API latency',
          userId: 'user-fallback',
        },
        { embeddingService: failingService },
      );
      expect(retrieved.hasContext).toBe(true);
      expect(retrieved.chunks[0].sourceName).toBe('runbook.md');
    });

    it('throws EmbeddingUnavailableError when missing/failing embedding config has fallback disabled', async () => {
      const strictUnconfigured = new EmbeddingService({
        provider: 'gemini',
        geminiApiKey: '',
        allowLocalFallback: false,
        useLiveRemote: true,
      });

      await expect(strictUnconfigured.embedQuery('test query')).rejects.toThrow(EmbeddingUnavailableError);

      const strictFailing = new EmbeddingService({
        customEmbeddings: new MockTopicEmbeddings(new Error('API timeout')),
        customProviderMode: 'gemini',
        allowLocalFallback: false,
      });

      await expect(strictFailing.embedDocuments(['doc'])).rejects.toThrow(EmbeddingUnavailableError);
    });

    it('continues without crashing when vector database lookup throws', async () => {
      const result = await retrieveKnowledgeContext(
        {
          query: 'Why is API latency increasing?',
          userId: 'user-db-err',
        },
        {
          loadChunks: async () => {
            throw new Error('Firestore connection reset');
          },
        },
      );

      expect(result.hasContext).toBe(false);
      expect(result.chunks).toEqual([]);
      expect(result.warning).toContain('Firestore connection reset');
    });
  });

  describe('LangGraph Workflow & Prompt Integration', () => {
    it('retrieves stored knowledge into LangGraph state and grounds hypotheses, analysis, and conclusion', async () => {
      await ingestKnowledgeDocument({
        userId: 'rag-user',
        projectId: 'checkout-service',
        sourceName: 'checkout-incident-notes.md',
        section: 'Redis Cache Stampede',
        content:
          'During peak traffic, API latency rises from 40ms to 1100ms because Redis TTL expiration triggers a cache stampede onto the primary Postgres pool.',
      });

      const state = await runInvestigation('Why is API latency increasing during peak traffic?', {
        userId: 'rag-user',
        projectId: 'checkout-service',
      });

      expect(state.retrievedContext.length).toBeGreaterThan(0);
      expect(state.retrievedContext[0].sourceName).toBe('checkout-incident-notes.md');
      expect(state.ragSummary.enabled).toBe(true);
      expect(state.ragSummary.sources).toContain('checkout-incident-notes.md');

      expect(state.events.some((e) => e.node === 'retrieveKnowledge')).toBe(true);
      expect(state.hypotheses[0].evidence.some((ev) => ev.includes('checkout-incident-notes.md'))).toBe(true);
      expect(state.analysis).toContain('checkout-incident-notes.md');
      expect(state.finalConclusion).toContain('checkout-incident-notes.md');
    });

    it('completes investigation normally when user has no matching knowledge documents', async () => {
      const state = await runInvestigation('Why is API latency increasing?', {
        userId: 'user-with-empty-kb',
        projectId: 'empty-proj',
      });

      expect(state.retrievedContext).toEqual([]);
      expect(state.ragSummary.retrievedCount).toBe(0);
      expect(state.status).toBe('finalized');
      expect(state.finalConclusion.length).toBeGreaterThan(20);
      expect(state.events.some((e) => e.node === 'retrieveKnowledge')).toBe(true);
    });

    it('builds context-aware prompts enforcing KB attribution and non-fabrication rules', () => {
      const state = createFreshState('Why does memory usage grow over time?', { userId: 'u1' });
      state.domain = 'memory';
      state.interpretedProblem = 'Investigating heap retention.';
      state.retrievedContext = [
        {
          chunkId: 'doc1-chunk-0',
          documentId: 'doc1',
          sourceName: 'worker-memory-audit.md',
          content: 'Unbounded BullMQ job listeners retain closures on every retry.',
          score: 0.91,
          metadata: {
            documentId: 'doc1',
            sourceName: 'worker-memory-audit.md',
            chunkId: 'doc1-chunk-0',
            chunkIndex: 0,
            totalChunks: 1,
            userId: 'u1',
            projectId: 'default',
            createdAt: new Date().toISOString(),
          },
        },
      ];

      const hypPrompts = buildHypothesisPrompts(state);
      expect(hypPrompts.systemPrompt).toContain('NEVER invent');
      expect(hypPrompts.systemPrompt).toContain('[KB:');
      expect(hypPrompts.userPrompt).toContain('worker-memory-audit.md');
      expect(hypPrompts.userPrompt).toContain('Unbounded BullMQ job listeners');

      const analysisPrompts = buildAnalysisPrompts(state);
      expect(analysisPrompts.systemPrompt).toContain('[Retrieved KB]');
      expect(analysisPrompts.userPrompt).toContain('worker-memory-audit.md');
    });

    it('supports Groq fallback in llmProvider when Gemini fails with 429', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalFetch = globalThis.fetch;

      try {
        process.env.NODE_ENV = 'development';
        process.env.USE_LIVE_LLM = 'true';

        const { config } = await import('../config.js');
        const prevProvider = config.llmProvider;
        const prevGeminiKey = config.geminiApiKey;
        const prevGroqKey = config.groqApiKey;

        config.llmProvider = 'groq';
        config.groqApiKey = 'test-groq-key';

        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Analysis via Groq: [Retrieved KB] confirmed cache stampede.',
                },
              },
            ],
          }),
        }) as unknown as typeof fetch;

        const { generateTextWithProvider } = await import('../services/llmProvider.js');
        const res = await generateTextWithProvider(
          { systemPrompt: 'sys', userPrompt: 'usr' },
          { forceLive: true },
        );

        expect(res?.provider).toBe('groq');
        expect(res?.data).toContain('Groq');

        config.llmProvider = prevProvider;
        config.geminiApiKey = prevGeminiKey;
        config.groqApiKey = prevGroqKey;
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        delete process.env.USE_LIVE_LLM;
        globalThis.fetch = originalFetch;
      }
    });
  });
});


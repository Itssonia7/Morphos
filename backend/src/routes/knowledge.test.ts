import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import {
  inMemoryInvestigations,
  inMemoryKnowledgeChunks,
  inMemoryKnowledgeDocuments,
} from '../services/firebase.js';

vi.mock('firebase-admin', () => ({
  default: {
    auth: () => ({
      verifyIdToken: async (token: string) => {
        if (token === 'alice-token') return { uid: 'alice-uid' };
        if (token === 'bob-token') return { uid: 'bob-uid' };
        throw new Error('Invalid token');
      },
    }),
  },
}));

describe('Knowledge Base & RAG API Routes', () => {
  beforeEach(() => {
    inMemoryInvestigations.clear();
    inMemoryKnowledgeDocuments.clear();
    inMemoryKnowledgeChunks.clear();
  });

  it('requires authentication on all knowledge endpoints', async () => {
    const ingestRes = await request(app).post('/api/knowledge').send({
      sourceName: 'doc.txt',
      content: 'Some content',
    });
    expect(ingestRes.status).toBe(401);

    const listRes = await request(app).get('/api/knowledge');
    expect(listRes.status).toBe(401);

    const searchRes = await request(app).post('/api/knowledge/search').send({ query: 'latency' });
    expect(searchRes.status).toBe(401);
  });

  it('ingests, lists, searches, and injects RAG context into POST /api/investigate for the owner only', async () => {
    const ingestRes = await request(app)
      .post('/api/knowledge')
      .set('Authorization', 'Bearer alice-token')
      .send({
        sourceName: 'gateway-postmortem.md',
        projectId: 'edge-gateway',
        contentType: 'text/markdown',
        content:
          '# API Gateway Latency Incident\nUpstream TLS handshake reuse was disabled on nginx ingress, adding 180ms to every API request under high concurrency.',
      });

    expect(ingestRes.status).toBe(201);
    expect(ingestRes.body.sourceName).toBe('gateway-postmortem.md');
    expect(ingestRes.body.projectId).toBe('edge-gateway');
    expect(ingestRes.body.chunkCount).toBeGreaterThanOrEqual(1);

    const documentId = ingestRes.body.documentId as string;

    // Alice lists her documents
    const listRes = await request(app)
      .get('/api/knowledge?projectId=edge-gateway')
      .set('Authorization', 'Bearer alice-token');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(documentId);

    // Bob cannot see Alice's documents or search them
    const bobList = await request(app)
      .get('/api/knowledge')
      .set('Authorization', 'Bearer bob-token');
    expect(bobList.status).toBe(200);
    expect(bobList.body).toHaveLength(0);

    const bobSearch = await request(app)
      .post('/api/knowledge/search')
      .set('Authorization', 'Bearer bob-token')
      .send({ query: 'nginx TLS handshake reuse API latency', projectId: 'edge-gateway' });
    expect(bobSearch.status).toBe(200);
    expect(bobSearch.body.hasContext).toBe(false);
    expect(bobSearch.body.chunks).toEqual([]);

    // Bob cannot delete Alice's document
    const bobDelete = await request(app)
      .delete(`/api/knowledge/${documentId}`)
      .set('Authorization', 'Bearer bob-token');
    expect(bobDelete.status).toBe(403);

    // Alice runs an investigation scoped to her project
    const invRes = await request(app)
      .post('/api/investigate')
      .set('Authorization', 'Bearer alice-token')
      .send({
        question: 'Why is API latency increasing on the edge gateway?',
        projectId: 'edge-gateway',
      });

    expect(invRes.status).toBe(200);
    expect(invRes.body.ragSummary.enabled).toBe(true);
    expect(invRes.body.ragSummary.retrievedCount).toBeGreaterThan(0);
    expect(invRes.body.retrievedContext[0].sourceName).toBe('gateway-postmortem.md');
    expect(invRes.body.finalConclusion).toContain('gateway-postmortem.md');

    // Alice can delete her own document
    const aliceDelete = await request(app)
      .delete(`/api/knowledge/${documentId}`)
      .set('Authorization', 'Bearer alice-token');
    expect(aliceDelete.status).toBe(200);
    expect(aliceDelete.body.success).toBe(true);
  });

  it('rejects empty or malformed knowledge payloads with 400', async () => {
    const emptyContent = await request(app)
      .post('/api/knowledge')
      .set('Authorization', 'Bearer alice-token')
      .send({ sourceName: 'blank.txt', content: '    ' });
    expect(emptyContent.status).toBe(400);

    const badJson = await request(app)
      .post('/api/knowledge')
      .set('Authorization', 'Bearer alice-token')
      .send({ sourceName: 'bad.json', content: '{not json', contentType: 'application/json' });
    expect(badJson.status).toBe(400);
  });
});


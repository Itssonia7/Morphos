import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';

vi.mock('firebase-admin', () => ({
  default: {
    auth: () => ({
      verifyIdToken: async (token: string) => {
        if (token !== 'test-firebase-token') {
          throw new Error('Invalid token');
        }

        return { uid: 'test-user-uid' };
      },
    }),
  },
}));

vi.mock('../services/firebase.js', () => ({
  getInvestigationById: async (id: string) => {
    if (id === 'owned-id') {
      return {
        id,
        userId: 'test-user-uid',
        question: 'Why is API latency increasing?',
        status: 'finalized',
        confidence: 0.82,
        iteration: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:05:00.000Z',
        hypotheses: [{ title: 'Queue saturation', confidence: 0.8, rationale: 'Backpressure is rising', evidence: ['Queue depth'] }],
        experiment: { name: 'Load profile', description: 'Measure queue growth', tool: 'benchmark', inputs: { concurrency: 6 } },
        selectedHypothesis: { title: 'Queue saturation', confidence: 0.8, rationale: 'Backpressure is rising', evidence: ['Queue depth'] },
        finalConclusion: 'Queue saturation caused the latency increase.',
      };
    }
    if (id === 'other-user-id') {
      return {
        id,
        userId: 'another-user-uid',
        question: 'Why is memory usage growing?',
        status: 'failed',
        confidence: 0.2,
        iteration: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:04:00.000Z',
      };
    }
    return null;
  },
  getInvestigationsForUser: async () => [
    {
      id: 'owned-id',
      userId: 'test-user-uid',
      question: 'Why is API latency increasing?',
      status: 'finalized',
      confidence: 0.82,
      iteration: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:05:00.000Z',
    },
  ],
  saveInvestigation: async (record: Record<string, unknown>) => ({ id: 'new-id', ...record }),
  deleteInvestigation: async (id: string, userId?: string) => id === 'owned-id' && userId === 'test-user-uid',
  getKnowledgeChunksForUser: async () => [],
  getKnowledgeDocumentsForUser: async () => [],
  getKnowledgeDocumentById: async () => null,
  saveKnowledgeDocumentWithChunks: async () => ({ stored: true, mode: 'dev-fallback', documentId: 'doc-1' }),
  deleteKnowledgeDocumentForUser: async () => 'not_found',
  getAnalyticsForUser: async () => ({
    totalInvestigations: 1,
    completedInvestigations: 1,
    averageConfidence: 0.82,
    averageIterations: 2,
    totalExperiments: 1,
    completionRate: 100,
    confidenceDistribution: { high: 1, medium: 0, low: 0 },
    experimentOutcomes: { completed: 1, failed: 0, running: 0 },
    investigationsOverTime: [{ date: '2026-01-01T00:00:00.000Z', count: 1 }],
    iterationsPerInvestigation: [{ label: 'Why is API latency increasing?', iterations: 2 }],
  }),
}));

describe('API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns health ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['ratelimit-limit']).toBe('100');
  });

  it('does not grant CORS access to unknown origins', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://untrusted.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('runs an investigation request', async () => {
    const response = await request(app)
      .post('/api/investigate')
      .set('Authorization', 'Bearer test-firebase-token')
      .send({
        question: 'Why is API latency increasing?',
      });

    expect(response.status).toBe(200);
    expect(response.body.question).toBe('Why is API latency increasing?');
    expect(response.body.finalConclusion).toBeTruthy();
  });

  it('returns investigation detail for the owner', async () => {
    const response = await request(app)
      .get('/api/investigations/owned-id')
      .set('Authorization', 'Bearer test-firebase-token');

    expect(response.status).toBe(200);
    expect(response.body.question).toBe('Why is API latency increasing?');
    expect(response.body.status).toBe('finalized');
  });

  it('denies investigation detail ownership violations', async () => {
    const response = await request(app)
      .get('/api/investigations/other-user-id')
      .set('Authorization', 'Bearer test-firebase-token');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Access denied.');
  });

  it('requires authentication for detail access', async () => {
    const response = await request(app).get('/api/investigations/owned-id');
    expect(response.status).toBe(401);
  });

  it('returns analytics for the authenticated user', async () => {
    const response = await request(app)
      .get('/api/analytics')
      .set('Authorization', 'Bearer test-firebase-token');

    expect(response.status).toBe(200);
    expect(response.body.totalInvestigations).toBe(1);
    expect(response.body.completedInvestigations).toBe(1);
  });

  it('deletes only the owner investigation', async () => {
    const response = await request(app)
      .delete('/api/investigations/owned-id')
      .set('Authorization', 'Bearer test-firebase-token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('blocks deletion for another user', async () => {
    const response = await request(app)
      .delete('/api/investigations/other-user-id')
      .set('Authorization', 'Bearer test-firebase-token');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Access denied.');
  });
});

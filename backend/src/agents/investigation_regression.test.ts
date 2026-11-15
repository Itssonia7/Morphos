import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { classifyDomain, isConclusionRelevant } from './domain.js';
import { runInvestigation } from './graph.js';
import { selectExperiment } from './nodes/selectExperiment.js';
import { finalize } from './nodes/finalize.js';
import { createFreshState } from './state.js';
import {
  saveInvestigation,
  getInvestigationsForUser,
  getInvestigationById,
  deleteInvestigation,
  inMemoryInvestigations,
} from '../services/firebase.js';

// Setup mock tokens for testing multi-user isolation
vi.mock('firebase-admin', () => ({
  default: {
    auth: () => ({
      verifyIdToken: async (token: string) => {
        if (token === 'user-a-token') {
          return { uid: 'user-a' };
        }
        if (token === 'user-b-token') {
          return { uid: 'user-b' };
        }
        if (token === 'user-empty-token') {
          return { uid: 'user-empty' };
        }
        if (token === 'test-firebase-token') {
          return { uid: 'test-user-uid' };
        }
        throw new Error('Invalid token');
      },
    }),
  },
}));

describe('PHASE 14 — Regression Test Suite', () => {
  beforeEach(() => {
    inMemoryInvestigations.clear();
  });

  // B, C, D, E: Domain Classification
  describe('Domain Classification', () => {
    it('B: classifies ML accuracy question as ml_model_performance', () => {
      const { domain } = classifyDomain('Why does model accuracy decrease with dataset size?');
      expect(domain).toBe('ml_model_performance');
    });

    it('C: classifies API latency question as api_latency', () => {
      const { domain } = classifyDomain('Why is API latency increasing?');
      expect(domain).toBe('api_latency');
    });

    it('D: classifies memory question as memory', () => {
      const { domain } = classifyDomain('Why does memory usage grow over time?');
      expect(domain).toBe('memory');
    });

    it('E: classifies database question as database', () => {
      const { domain } = classifyDomain('Why are database queries getting slower?');
      expect(domain).toBe('database');
    });

    it('classifies CPU / general question as general', () => {
      const { domain } = classifyDomain('Why does CPU usage increase during peak traffic?');
      expect(domain).toBe('general');
    });
  });

  // M: Experiment Template Safety
  describe('M: Experiment Template Safety', () => {
    it('marks no_matching_template and experiment: null for ml_model_performance', async () => {
      const state = createFreshState('Why does model accuracy decrease with dataset size?');
      state.domain = 'ml_model_performance';
      state.selectedHypothesis = {
        id: 'hypo-1',
        title: 'Label noise amplification',
        rationale: 'Noisy labels distort decision boundaries',
        confidence: 0.8,
        evidence: ['Label noise'],
      };

      const result = await selectExperiment(state);
      expect(result.experiment).toBeNull();
      expect(result.resultStatus).toBe('no_matching_template');
    });
  });

  // L: Conclusion Relevance Guard
  describe('L: Conclusion Relevance Guard', () => {
    it('rejects an unrelated database/socket conclusion for an ML question', () => {
      const isRelevant = isConclusionRelevant(
        'Database connection pool exhaustion and worker socket timeouts caused the drop.',
        'ml_model_performance',
        'Why does model accuracy decrease with dataset size?'
      );
      expect(isRelevant).toBe(false);
    });

    it('accepts a relevant ML conclusion for an ML question', () => {
      const isRelevant = isConclusionRelevant(
        'Increased dataset size introduced distribution shift and label noise, degrading test set generalization.',
        'ml_model_performance',
        'Why does model accuracy decrease with dataset size?'
      );
      expect(isRelevant).toBe(true);
    });

    it('finalize node recovers from an irrelevant conclusion with a domain-safe conclusion', async () => {
      const state = createFreshState('Why does model accuracy decrease with dataset size?');
      state.domain = 'ml_model_performance';
      state.selectedHypothesis = {
        id: 'hypo-2',
        title: 'Data Quality and Label Noise',
        rationale: 'Adding more data brought noisy annotations',
        confidence: 0.85,
        evidence: ['Error variance across folds'],
      };
      state.analysis = 'Observational synthesis confirms label noise.';
      state.resultStatus = 'no_matching_template';

      const finalizedState = await finalize(state);
      expect(finalizedState.finalConclusion).toBeDefined();
      expect(finalizedState.finalConclusion).not.toContain('database connection pool');
      expect(finalizedState.finalConclusion).not.toContain('worker socket');
      expect(
        isConclusionRelevant(
          finalizedState.finalConclusion!,
          'ml_model_performance',
          'Why does model accuracy decrease with dataset size?'
        )
      ).toBe(true);
    });

    it('does not include fabricated measured evidence in ML conclusion when resultStatus is no_matching_template', async () => {
      const state = createFreshState('Why does model accuracy decrease with dataset size?');
      state.domain = 'ml_model_performance';
      state.resultStatus = 'no_matching_template';
      state.selectedHypothesis = {
        id: 'ml-1',
        title: 'Overfitting and poor generalization',
        rationale: 'As dataset size or complexity increases, model capacity or regularization may fail to generalize effectively across broader feature distributions.',
        confidence: 0.72,
        evidence: [
          'Candidate hypothesis: Validation error diverging from training loss as data scales',
        ],
      };

      const finalizedState = await finalize(state);
      expect(finalizedState.finalConclusion).not.toContain('Validation error increases while training loss continues decreasing');
      expect(finalizedState.finalConclusion).toContain('No matching experiment was available for this question');
      expect(finalizedState.finalConclusion).toContain('these are domain-based hypotheses, not measured findings');
    });
  });

  // N: Events do not exponentially duplicate
  describe('N: Event Duplication Check', () => {
    it('keeps clean, non-duplicated events array throughout an investigation', async () => {
      const result = await runInvestigation('Why does model accuracy decrease with dataset size?');
      expect(result.events).toBeDefined();
      // Should have 8 to 20 events representing the pipeline stages, NOT hundreds or 262,143
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.length).toBeLessThan(30);

      // Verify no exact identical event duplication
      const eventSignatures = result.events.map((e) => `${e.node}:${e.message}`);
      const uniqueSignatures = new Set(eventSignatures);
      expect(uniqueSignatures.size).toBe(eventSignatures.length);
    });
  });

  // A & G: Different questions produce different relevant outputs & unique IDs
  describe('A & G: Investigation Isolation & Unique IDs', () => {
    it('produces distinct IDs, interpretations, and conclusions for different questions', async () => {
      const q1 = 'Why does model accuracy decrease with dataset size?';
      const q2 = 'Why is API latency increasing?';

      const res1 = await runInvestigation(q1);
      const res2 = await runInvestigation(q2);

      // Unique IDs
      expect(res1.id).toBeDefined();
      expect(res2.id).toBeDefined();
      expect(res1.id).not.toBe(res2.id);

      // Different domains
      expect(res1.domain).toBe('ml_model_performance');
      expect(res2.domain).toBe('api_latency');

      // Different result statuses
      expect(res1.resultStatus).toBe('no_matching_template');
      expect(res2.resultStatus).toBe('simulated');

      // Different interpretations
      expect(res1.interpretedProblem).not.toBe(res2.interpretedProblem);
      expect(res1.interpretedProblem.toLowerCase()).toContain('model');

      // Different conclusions
      expect(res1.finalConclusion).not.toBe(res2.finalConclusion);
      expect(res2.finalConclusion.toLowerCase()).not.toContain('overfitting');
    });
  });

  // F, H, I, J, K: API, Top-level ID, Multi-user Isolation, History
  describe('F, H, I, J, K: API & Multi-User Isolation', () => {
    it('F: POST /api/investigate returns a top-level ID and domain', async () => {
      const res = await request(app)
        .post('/api/investigate')
        .set('Authorization', 'Bearer user-a-token')
        .send({ question: 'Why is API latency increasing?' });

      expect(res.status).toBe(200);
      expect(typeof res.body.id).toBe('string');
      expect(res.body.id.length).toBeGreaterThan(0);
      expect(res.body.domain).toBe('api_latency');
      expect(res.body.resultStatus).toBe('simulated');
      expect(res.body.question).toBe('Why is API latency increasing?');
    });

    it('H & G: multiple investigations receive different IDs and create separate persisted records', async () => {
      const res1 = await request(app)
        .post('/api/investigate')
        .set('Authorization', 'Bearer user-a-token')
        .send({ question: 'Why is API latency increasing?' });

      const res2 = await request(app)
        .post('/api/investigate')
        .set('Authorization', 'Bearer user-a-token')
        .send({ question: 'Why does memory usage grow over time?' });

      expect(res1.body.id).not.toBe(res2.body.id);

      const doc1 = await getInvestigationById(res1.body.id);
      const doc2 = await getInvestigationById(res2.body.id);

      expect(doc1).not.toBeNull();
      expect(doc2).not.toBeNull();
      expect(doc1?.id).toBe(res1.body.id);
      expect(doc2?.id).toBe(res2.body.id);
      expect(doc1?.question).toBe('Why is API latency increasing?');
      expect(doc2?.question).toBe('Why does memory usage grow over time?');
    });

    it('I: GET /api/investigations returns all investigations for the authenticated user', async () => {
      await request(app)
        .post('/api/investigate')
        .set('Authorization', 'Bearer user-a-token')
        .send({ question: 'Why is API latency increasing?' });

      await request(app)
        .post('/api/investigate')
        .set('Authorization', 'Bearer user-a-token')
        .send({ question: 'Why does memory usage grow over time?' });

      const res = await request(app)
        .get('/api/investigations')
        .set('Authorization', 'Bearer user-a-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body.map((r: { question: string }) => r.question)).toEqual(
        expect.arrayContaining([
          'Why is API latency increasing?',
          'Why does memory usage grow over time?',
        ])
      );
    });

    it('J: empty history is correctly represented as an empty array', async () => {
      const res = await request(app)
        .get('/api/investigations')
        .set('Authorization', 'Bearer user-empty-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it("K: one user's investigation cannot be accessed by another user", async () => {
      // User A creates an investigation
      const res = await request(app)
        .post('/api/investigate')
        .set('Authorization', 'Bearer user-a-token')
        .send({ question: 'Why is API latency increasing?' });

      const investigationId = res.body.id;

      // User B tries to access it
      const unauthorizedGet = await request(app)
        .get(`/api/investigations/${investigationId}`)
        .set('Authorization', 'Bearer user-b-token');

      expect(unauthorizedGet.status).toBe(403);
      expect(unauthorizedGet.body.error).toBe('Access denied.');

      // User B tries to delete it
      const unauthorizedDelete = await request(app)
        .delete(`/api/investigations/${investigationId}`)
        .set('Authorization', 'Bearer user-b-token');

      expect(unauthorizedDelete.status).toBe(403);
    });
  });
  // P: Deterministic Network & Log Analysis Tools
  describe("P: Deterministic Network & Log Analysis Tools", () => {
    it("selects and executes network_trace deterministically for endpoint latency investigations", async () => {
      const q = "Why is API endpoint /api/v1/checkout experiencing high gateway latency?";
      const res1 = await runInvestigation(q);
      const res2 = await runInvestigation(q);

      expect(res1.experiment?.tool).toBe("network_trace");
      expect(res1.experimentResult).toMatchObject({
        ok: true,
        endpoint: "/api/v1/checkout",
        bottleneckStage: "upstream_ttfb",
      });
      expect(res1.experimentResult).toEqual(res2.experimentResult);
    });

    it("selects and executes log_analyzer deterministically for server error log investigations", async () => {
      const q = "Investigate 504 timeout error spike in server logs";
      const res1 = await runInvestigation(q);
      const res2 = await runInvestigation(q);

      expect(res1.experiment?.tool).toBe("log_analyzer");
      expect(res1.experimentResult).toMatchObject({
        ok: true,
        errorCode: "ERR_UPSTREAM_TIMEOUT",
        severity: "HIGH",
      });
      expect(res1.experimentResult).toEqual(res2.experimentResult);
    });
  });
});

import { Router } from 'express';
import { z } from 'zod';
import { runInvestigation } from '../agents/graph.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { deleteInvestigation, getAnalyticsForUser, getInvestigationById, getInvestigationsForUser, saveInvestigation } from '../services/firebase.js';

const router = Router();

const investigateSchema = z.object({
  question: z
    .string()
    .trim()
    .min(8, 'Investigation question must be at least 8 characters long.')
    .max(1000, 'Investigation question cannot exceed 1000 characters.'),
  projectId: z.string().trim().min(1).max(100).optional(),
  topK: z.number().int().min(1).max(20).optional(),
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/investigations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user?.uid;
    const items = await getInvestigationsForUser(uid);
    res.json(items);
  } catch (error) {
    console.error('Failed to fetch investigations', error);
    res.status(500).json({ error: 'Investigation history unavailable' });
  }
});

router.get('/investigations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const item = await getInvestigationById(id);
    if (!item) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const record = item as Record<string, unknown>;
    if (req.user && record.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    return res.json(item);
  } catch (error) {
    console.error('Failed to fetch investigation', error);
    return res.status(500).json({ error: 'Investigation detail unavailable' });
  }
});

router.get('/analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authenticated UID is required.' });
    }
    const analytics = await getAnalyticsForUser(uid);
    return res.json(analytics);
  } catch (error) {
    console.error('Failed to compute analytics', error);
    return res.status(500).json({ error: 'Analytics unavailable' });
  }
});

router.delete('/investigations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const item = await getInvestigationById(id);

    if (!item) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const record = item as Record<string, unknown>;
    if (req.user && record.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const deleted = await deleteInvestigation(id, req.user?.uid);
    if (!deleted) {
      return res.status(403).json({ error: 'Unable to delete investigation.' });
    }

    return res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Failed to delete investigation', error);
    return res.status(500).json({ error: 'Investigation deletion unavailable' });
  }
});

router.post('/investigate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = investigateSchema.parse(req.body ?? {});
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: 'Authenticated UID is required.' });
    }

    const investigation = await runInvestigation(parsed.question, {
      userId: uid,
      projectId: parsed.projectId,
      ragTopK: parsed.topK,
    });
    const investigationId = investigation.id || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const saved = await saveInvestigation({
      id: investigationId,
      userId: uid,
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      question: parsed.question,
      domain: investigation.domain,
      interpretedProblem: investigation.interpretedProblem,
      interpretation: investigation.interpretedProblem,
      retrievedContext: investigation.retrievedContext,
      ragSummary: investigation.ragSummary,
      hypotheses: investigation.hypotheses,
      selectedHypothesis: investigation.selectedHypothesis,
      experiment: investigation.experiment,
      experimentResult: investigation.experimentResult,
      analysis: investigation.analysis,
      confidence: investigation.confidence,
      iteration: investigation.iteration,
      finalConclusion: investigation.finalConclusion,
      conclusion: investigation.finalConclusion,
      status: investigation.status,
      resultStatus: investigation.resultStatus,
      events: investigation.events,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const finalId = saved.id || investigationId;

    const response = {
      ...investigation,
      id: finalId,
      userId: uid,
      domain: investigation.domain,
      resultStatus: investigation.resultStatus,
      firebase: saved,
    };

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request payload', details: error.flatten() });
    }

    console.error('Investigation failed', error);
    return res.status(500).json({ error: 'Investigation failed', details: 'Please try again.' });
  }
});

export default router;

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { runInvestigation } from '../agents/graph.js';
import { deleteInvestigation, getAnalyticsForUser, getInvestigationById, getInvestigationsForUser, saveInvestigation } from '../services/firebase.js';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

const investigateSchema = z.object({
  question: z
    .string()
    .trim()
    .min(8, 'Investigation question must be at least 8 characters long.')
    .max(1000, 'Investigation question cannot exceed 1000 characters.'),
});

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? '';
  const hasHeader = authHeader.length > 0;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.info('AUTH MIDDLEWARE: authorization header present:', hasHeader ? 'true' : 'false');

  if (!token) {
    console.warn('AUTH MIDDLEWARE: token verification: FAIL');
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    console.info('AUTH MIDDLEWARE: token verification: PASS');
    console.info('AUTH MIDDLEWARE: decoded UID present:', decodedToken.uid ? 'true' : 'false');
    return next();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';
    console.warn('AUTH MIDDLEWARE: token verification: FAIL', { code });
    return res.status(401).json({ error: 'Invalid or expired Firebase token.' });
  }
}

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

    const investigationId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const investigation = await runInvestigation(parsed.question, investigationId, uid);

    const saved = await saveInvestigation({
      id: investigationId,
      userId: uid,
      question: parsed.question,
      domain: investigation.domain,
      interpretedProblem: investigation.interpretedProblem,
      interpretation: investigation.interpretedProblem,
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

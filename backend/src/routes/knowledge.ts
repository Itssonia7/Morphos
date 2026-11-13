import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { EmbeddingUnavailableError } from '../rag/embeddings.js';
import {
  ingestKnowledgeDocument,
  listUserKnowledgeDocuments,
  RagValidationError,
  removeUserKnowledgeDocument,
  retrieveKnowledgeContext,
} from '../rag/ragService.js';
import { getKnowledgeDocumentById } from '../services/firebase.js';

const router = Router();

const ingestSchema = z.object({
  sourceName: z.string().trim().min(1, 'sourceName is required.').max(200),
  content: z.string().min(1, 'content is required.').max(90000),
  projectId: z.string().trim().min(1).max(100).optional(),
  investigationId: z.string().trim().min(1).max(100).optional(),
  contentType: z.enum(['text/plain', 'text/markdown', 'application/json', 'text/html']).optional(),
  section: z.string().trim().min(1).max(200).optional(),
  page: z.number().int().positive().optional(),
  chunkSize: z.number().int().min(100).max(4000).optional(),
  chunkOverlap: z.number().int().min(0).max(1000).optional(),
});

const searchSchema = z.object({
  query: z.string().trim().min(2, 'Query must be at least 2 characters long.').max(1000),
  projectId: z.string().trim().min(1).max(100).optional(),
  investigationId: z.string().trim().min(1).max(100).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  minScore: z.number().min(-1).max(1).optional(),
});

router.post('/knowledge', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authenticated UID is required.' });
    }

    const parsed = ingestSchema.parse(req.body ?? {});
    const result = await ingestKnowledgeDocument({
      userId: uid,
      sourceName: parsed.sourceName,
      content: parsed.content,
      projectId: parsed.projectId,
      investigationId: parsed.investigationId,
      contentType: parsed.contentType,
      section: parsed.section,
      page: parsed.page,
      chunkSize: parsed.chunkSize,
      chunkOverlap: parsed.chunkOverlap,
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid knowledge payload', details: error.flatten() });
    }
    if (error instanceof RagValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof EmbeddingUnavailableError) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Knowledge ingestion failed', error);
    return res.status(500).json({ error: 'Knowledge ingestion unavailable.' });
  }
});

router.get('/knowledge', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authenticated UID is required.' });
    }

    const projectId = typeof req.query.projectId === 'string' && req.query.projectId.trim()
      ? req.query.projectId.trim()
      : undefined;

    const docs = await listUserKnowledgeDocuments(uid, projectId);
    return res.json(docs);
  } catch (error) {
    console.error('Failed to list knowledge documents', error);
    return res.status(500).json({ error: 'Knowledge list unavailable.' });
  }
});

router.post('/knowledge/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authenticated UID is required.' });
    }

    const parsed = searchSchema.parse(req.body ?? {});
    const result = await retrieveKnowledgeContext({
      query: parsed.query,
      userId: uid,
      projectId: parsed.projectId,
      investigationId: parsed.investigationId,
      topK: parsed.topK,
      minScore: parsed.minScore,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid search payload', details: error.flatten() });
    }
    console.error('Knowledge search failed', error);
    return res.status(500).json({ error: 'Knowledge search unavailable.' });
  }
});

router.delete('/knowledge/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authenticated UID is required.' });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await getKnowledgeDocumentById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Knowledge document not found.' });
    }
    if (existing.userId !== uid) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const outcome = await removeUserKnowledgeDocument(id, uid);
    if (outcome === 'forbidden') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (outcome === 'not_found') {
      return res.status(404).json({ error: 'Knowledge document not found.' });
    }
    if (outcome === 'error') {
      return res.status(500).json({ error: 'Knowledge deletion unavailable.' });
    }

    return res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Failed to delete knowledge document', error);
    return res.status(500).json({ error: 'Knowledge deletion unavailable.' });
  }
});

export default router;


import admin from 'firebase-admin';
import { config } from '../config.js';
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from '../rag/types.js';

let firebaseEnabled = false;
const isTestEnvironment = process.env.NODE_ENV === 'test';
export let firebaseAdminConfigured = false;

// In-memory persistence for local fallback when Firebase is not configured or during testing
export const inMemoryInvestigations = new Map<string, Record<string, unknown>>();
export const inMemoryFindings: Array<Record<string, unknown>> = [];
export const inMemoryKnowledgeDocuments = new Map<string, KnowledgeDocumentRecord>();
export const inMemoryKnowledgeChunks = new Map<string, KnowledgeChunkRecord>();

function initializeFirebaseAdmin() {
  if (firebaseEnabled || isTestEnvironment) {
    return;
  }

  const hasServiceAccount = Boolean(
    config.firebaseProjectId && config.firebaseClientEmail && config.firebasePrivateKey,
  );

  if (hasServiceAccount) {
    try {
      admin.initializeApp({
        projectId: config.firebaseProjectId,
        credential: admin.credential.cert({
          projectId: config.firebaseProjectId,
          clientEmail: config.firebaseClientEmail,
          privateKey: config.firebasePrivateKey,
        }),
      });
      firebaseEnabled = true;
      firebaseAdminConfigured = true;
      return;
    } catch (error) {
      console.warn('Firebase Admin SDK service-account initialization failed. Operating in fallback mode.', {
        error: error instanceof Error ? error.message : String(error),
      });
      firebaseEnabled = false;
      firebaseAdminConfigured = false;
    }
  }

  if (config.isFirebaseConfigured) {
    try {
      admin.initializeApp({
        projectId: config.firebaseProjectId,
        credential: admin.credential.applicationDefault(),
      });
      firebaseEnabled = true;
      firebaseAdminConfigured = true;
    } catch (error) {
      console.warn('Firebase Admin SDK unavailable without ADC or service-account credentials.', error);
      firebaseEnabled = false;
      firebaseAdminConfigured = false;
    }
  }
}

initializeFirebaseAdmin();

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, stripUndefined(nested)]),
    );
  }

  return value;
}

function normalizeInvestigation(record: Record<string, unknown>): Record<string, unknown> {
  const cleanRecord = stripUndefined(record) as Record<string, unknown>;
  return {
    ...cleanRecord,
    createdAt: (cleanRecord.createdAt as string) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const MAX_IN_MEMORY_INVESTIGATIONS = 1000;

function setBoundedInMemoryInvestigation(id: string, payload: Record<string, unknown>) {
  if (inMemoryInvestigations.size >= MAX_IN_MEMORY_INVESTIGATIONS && !inMemoryInvestigations.has(id)) {
    const oldestKey = inMemoryInvestigations.keys().next().value;
    if (oldestKey) {
      inMemoryInvestigations.delete(oldestKey);
    }
  }
  inMemoryInvestigations.set(id, payload);
}

export async function saveInvestigation(record: Record<string, unknown>) {
  const payload = normalizeInvestigation(record);
  const id = (record.id as string) || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  payload.id = id;

  if (isTestEnvironment || !firebaseEnabled) {
    setBoundedInMemoryInvestigation(id, payload);
    return {
      stored: true,
      id,
      mode: 'dev-fallback',
      record: payload,
    };
  }

  try {
    const db = admin.firestore();
    const ref = db.collection('investigations').doc(id);
    await ref.set(payload);

    return {
      stored: true,
      id: ref.id,
      mode: 'firebase',
      record: payload,
    };
  } catch (error) {
    console.warn('Firebase persistence unavailable; switching to local fallback.', error);
    setBoundedInMemoryInvestigation(id, payload);
    return {
      stored: true,
      id,
      mode: 'dev-fallback',
      record: payload,
    };
  }
}

export async function getInvestigationsForUser(userId?: string) {
  if (!userId) {
    return [];
  }

  if (isTestEnvironment || !firebaseEnabled) {
    const items = Array.from(inMemoryInvestigations.values()).filter(
      (doc) => doc.userId === userId
    );
    return items.sort((a, b) => {
      const aTime = new Date(String((a.updatedAt ?? a.createdAt ?? 0) as string)).getTime();
      const bTime = new Date(String((b.updatedAt ?? b.createdAt ?? 0) as string)).getTime();
      return bTime - aTime;
    });
  }

  try {
    const db = admin.firestore();
    const snapshot = await db.collection('investigations').where('userId', '==', userId).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<Record<string, unknown>>;
    return items.sort((a, b) => {
      const aTime = new Date(String((a.updatedAt ?? a.createdAt ?? 0) as string)).getTime();
      const bTime = new Date(String((b.updatedAt ?? b.createdAt ?? 0) as string)).getTime();
      return bTime - aTime;
    });
  } catch (error) {
    console.warn('Firestore history unavailable in this environment; falling back to in-memory.', error);
    const items = Array.from(inMemoryInvestigations.values()).filter(
      (doc) => doc.userId === userId
    );
    return items.sort((a, b) => {
      const aTime = new Date(String((a.updatedAt ?? a.createdAt ?? 0) as string)).getTime();
      const bTime = new Date(String((b.updatedAt ?? b.createdAt ?? 0) as string)).getTime();
      return bTime - aTime;
    });
  }
}

export async function getInvestigationById(id: string) {
  if (!id) return null;

  if (isTestEnvironment || !firebaseEnabled) {
    return inMemoryInvestigations.get(id) ?? null;
  }

  try {
    const db = admin.firestore();
    const doc = await db.collection('investigations').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : inMemoryInvestigations.get(id) ?? null;
  } catch (error) {
    console.warn('Firestore detail lookup unavailable in this environment.', error);
    return inMemoryInvestigations.get(id) ?? null;
  }
}

export async function saveFinding(record: Record<string, unknown>) {
  if (isTestEnvironment || !firebaseEnabled) {
    inMemoryFindings.push(record);
    return { stored: true, mode: 'dev-fallback', record };
  }

  try {
    const db = admin.firestore();
    await db.collection('findings').add({
      ...record,
      createdAt: new Date().toISOString(),
    });

    return { stored: true, mode: 'firebase' };
  } catch (error) {
    console.warn('Firebase findings persistence unavailable; using local fallback.', error);
    inMemoryFindings.push(record);
    return { stored: true, mode: 'dev-fallback', record };
  }
}

export async function deleteInvestigation(id: string, userId?: string) {
  if (!id || !userId) {
    return false;
  }

  if (isTestEnvironment || !firebaseEnabled) {
    const item = inMemoryInvestigations.get(id);
    if (!item || item.userId !== userId) {
      return false;
    }
    inMemoryInvestigations.delete(id);
    return true;
  }

  try {
    const db = admin.firestore();
    const ref = db.collection('investigations').doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return false;
    }

    const record = doc.data() as Record<string, unknown> | undefined;
    if (record?.userId !== userId) {
      return false;
    }

    await ref.delete();
    inMemoryInvestigations.delete(id);
    return true;
  } catch (error) {
    console.warn('Failed to delete investigation from Firestore.', error);
    return false;
  }
}

export async function getAnalyticsForUser(userId?: string) {
  if (!userId) {
    return {
      totalInvestigations: 0,
      completedInvestigations: 0,
      averageConfidence: 0,
      averageIterations: 0,
      totalExperiments: 0,
      completionRate: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      experimentOutcomes: { completed: 0, failed: 0, running: 0 },
      investigationsOverTime: [],
      iterationsPerInvestigation: [],
    };
  }

  const items = await getInvestigationsForUser(userId);
  const completedInvestigations = items.filter((item) => ['finalized', 'completed'].includes(String(item.status ?? '').toLowerCase())).length;
  const totalExperiments = items.filter((item) => item.experiment).length;
  const averageConfidence = items.length ? items.reduce((sum, item) => sum + Number(item.confidence ?? 0), 0) / items.length : 0;
  const averageIterations = items.length ? items.reduce((sum, item) => sum + Number(item.iteration ?? 0), 0) / items.length : 0;
  const completionRate = items.length ? (completedInvestigations / items.length) * 100 : 0;

  const confidenceDistribution = items.reduce<{ high: number; medium: number; low: number }>(
    (acc, item) => {
      const confidence = Number(item.confidence ?? 0);
      if (confidence >= 0.7) acc.high += 1;
      else if (confidence >= 0.4) acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const experimentOutcomes = items.reduce<{ completed: number; failed: number; running: number }>(
    (acc, item) => {
      const status = String(item.status ?? '').toLowerCase();
      if (status === 'finalized' || status === 'completed') acc.completed += 1;
      else if (status === 'failed') acc.failed += 1;
      else acc.running += 1;
      return acc;
    },
    { completed: 0, failed: 0, running: 0 },
  );

  const investigationsOverTime = [...items]
    .sort((a, b) => new Date(String(a.createdAt ?? 0)).getTime() - new Date(String(b.createdAt ?? 0)).getTime())
    .map((item) => ({
      date: String(item.createdAt ?? ''),
      count: 1,
    }));

  const iterationsPerInvestigation = items.map((item) => ({
    label: String(item.question ?? 'Investigation'),
    iterations: Number(item.iteration ?? 0),
  }));

  return {
    totalInvestigations: items.length,
    completedInvestigations,
    averageConfidence,
    averageIterations,
    totalExperiments,
    completionRate,
    confidenceDistribution,
    experimentOutcomes,
    investigationsOverTime,
    iterationsPerInvestigation,
  };
}

export function isFirebaseAvailable() {
  return firebaseEnabled;
}

const MAX_IN_MEMORY_KNOWLEDGE_DOCS = 500;
const MAX_IN_MEMORY_KNOWLEDGE_CHUNKS = 5000;

function setBoundedKnowledgeDocument(id: string, record: KnowledgeDocumentRecord) {
  if (inMemoryKnowledgeDocuments.size >= MAX_IN_MEMORY_KNOWLEDGE_DOCS && !inMemoryKnowledgeDocuments.has(id)) {
    const oldestKey = inMemoryKnowledgeDocuments.keys().next().value;
    if (oldestKey) {
      inMemoryKnowledgeDocuments.delete(oldestKey);
    }
  }
  inMemoryKnowledgeDocuments.set(id, record);
}

function setBoundedKnowledgeChunk(chunkId: string, record: KnowledgeChunkRecord) {
  if (inMemoryKnowledgeChunks.size >= MAX_IN_MEMORY_KNOWLEDGE_CHUNKS && !inMemoryKnowledgeChunks.has(chunkId)) {
    const oldestKey = inMemoryKnowledgeChunks.keys().next().value;
    if (oldestKey) {
      inMemoryKnowledgeChunks.delete(oldestKey);
    }
  }
  inMemoryKnowledgeChunks.set(chunkId, record);
}

export async function saveKnowledgeDocumentWithChunks(
  document: KnowledgeDocumentRecord,
  chunks: KnowledgeChunkRecord[],
): Promise<{ stored: boolean; mode: 'firebase' | 'dev-fallback'; documentId: string }> {
  if (!document.userId) {
    throw new Error('userId is required to persist knowledge documents.');
  }

  const cleanDoc = stripUndefined(document) as KnowledgeDocumentRecord;
  const cleanChunks = chunks.map((chunk) => ({
    ...chunk,
    userId: document.userId,
    projectId: document.projectId,
    documentId: document.id,
    ...(document.investigationId ? { investigationId: document.investigationId } : {}),
    metadata: stripUndefined(chunk.metadata) as KnowledgeChunkRecord['metadata'],
  }));

  if (isTestEnvironment || !firebaseEnabled) {
    setBoundedKnowledgeDocument(cleanDoc.id, cleanDoc);
    for (const chunk of cleanChunks) {
      setBoundedKnowledgeChunk(chunk.chunkId, chunk);
    }
    return { stored: true, mode: 'dev-fallback', documentId: cleanDoc.id };
  }

  try {
    const db = admin.firestore();
    const docRef = db.collection('knowledge_documents').doc(cleanDoc.id);
    await docRef.set(cleanDoc);

    // Firestore batch limit is 500 operations per batch
    for (let i = 0; i < cleanChunks.length; i += 400) {
      const batch = db.batch();
      const slice = cleanChunks.slice(i, i + 400);
      for (const chunk of slice) {
        const chunkRef = db.collection('knowledge_chunks').doc(chunk.chunkId);
        batch.set(chunkRef, chunk);
      }
      await batch.commit();
    }

    return { stored: true, mode: 'firebase', documentId: cleanDoc.id };
  } catch (error) {
    console.warn('Firestore knowledge persistence unavailable; switching to local fallback.', error);
    setBoundedKnowledgeDocument(cleanDoc.id, cleanDoc);
    for (const chunk of cleanChunks) {
      setBoundedKnowledgeChunk(chunk.chunkId, chunk);
    }
    return { stored: true, mode: 'dev-fallback', documentId: cleanDoc.id };
  }
}

export async function getKnowledgeDocumentsForUser(
  userId?: string,
  projectId?: string,
): Promise<KnowledgeDocumentRecord[]> {
  if (!userId) {
    return [];
  }

  const filterInMemory = () =>
    Array.from(inMemoryKnowledgeDocuments.values())
      .filter((doc) => doc.userId === userId && (!projectId || doc.projectId === projectId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isTestEnvironment || !firebaseEnabled) {
    return filterInMemory();
  }

  try {
    const db = admin.firestore();
    let query: admin.firestore.Query = db.collection('knowledge_documents').where('userId', '==', userId);
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }
    const snapshot = await query.get();
    const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as KnowledgeDocumentRecord);
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Firestore knowledge document list unavailable; falling back to in-memory.', error);
    return filterInMemory();
  }
}

export async function getKnowledgeDocumentById(documentId: string): Promise<KnowledgeDocumentRecord | null> {
  if (!documentId) return null;

  if (isTestEnvironment || !firebaseEnabled) {
    return inMemoryKnowledgeDocuments.get(documentId) ?? null;
  }

  try {
    const db = admin.firestore();
    const doc = await db.collection('knowledge_documents').doc(documentId).get();
    return doc.exists
      ? ({ id: doc.id, ...doc.data() } as KnowledgeDocumentRecord)
      : inMemoryKnowledgeDocuments.get(documentId) ?? null;
  } catch (error) {
    console.warn('Firestore knowledge document lookup unavailable.', error);
    return inMemoryKnowledgeDocuments.get(documentId) ?? null;
  }
}

export async function getKnowledgeChunksForUser(
  userId?: string,
  options: { projectId?: string; investigationId?: string } = {},
): Promise<KnowledgeChunkRecord[]> {
  if (!userId) {
    return [];
  }

  const matchesScope = (chunk: KnowledgeChunkRecord) => {
    const chunkUserId = chunk.metadata?.userId ?? (chunk as unknown as { userId?: string }).userId;
    if (chunkUserId !== userId) {
      return false;
    }
    const chunkProjectId = chunk.metadata?.projectId ?? (chunk as unknown as { projectId?: string }).projectId;
    if (options.projectId && chunkProjectId !== options.projectId) {
      return false;
    }
    if (options.investigationId && chunk.metadata?.investigationId && chunk.metadata.investigationId !== options.investigationId) {
      return false;
    }
    return true;
  };

  if (isTestEnvironment || !firebaseEnabled) {
    return Array.from(inMemoryKnowledgeChunks.values()).filter(matchesScope);
  }

  try {
    const db = admin.firestore();
    let query: admin.firestore.Query = db.collection('knowledge_chunks').where('userId', '==', userId);
    if (options.projectId) {
      query = query.where('projectId', '==', options.projectId);
    }
    const snapshot = await query.get();
    const chunks = snapshot.docs.map((doc) => doc.data() as KnowledgeChunkRecord);
    if (chunks.length === 0) {
      // Also include any in-memory fallback chunks written during transient Firestore outage
      return Array.from(inMemoryKnowledgeChunks.values()).filter(matchesScope);
    }
    return chunks.filter(matchesScope);
  } catch (error) {
    console.warn('Firestore knowledge chunks query unavailable; falling back to in-memory.', error);
    return Array.from(inMemoryKnowledgeChunks.values()).filter(matchesScope);
  }
}

export async function deleteKnowledgeDocumentForUser(
  documentId: string,
  userId?: string,
): Promise<'deleted' | 'not_found' | 'forbidden' | 'error'> {
  if (!documentId || !userId) {
    return 'forbidden';
  }

  if (isTestEnvironment || !firebaseEnabled) {
    const existing = inMemoryKnowledgeDocuments.get(documentId);
    if (!existing) {
      return 'not_found';
    }
    if (existing.userId !== userId) {
      return 'forbidden';
    }
    inMemoryKnowledgeDocuments.delete(documentId);
    for (const [chunkId, chunk] of inMemoryKnowledgeChunks.entries()) {
      if (chunk.metadata.documentId === documentId && chunk.metadata.userId === userId) {
        inMemoryKnowledgeChunks.delete(chunkId);
      }
    }
    return 'deleted';
  }

  try {
    const db = admin.firestore();
    const docRef = db.collection('knowledge_documents').doc(documentId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      const memExisting = inMemoryKnowledgeDocuments.get(documentId);
      if (!memExisting) return 'not_found';
      if (memExisting.userId !== userId) return 'forbidden';
      inMemoryKnowledgeDocuments.delete(documentId);
      return 'deleted';
    }

    const record = snapshot.data() as KnowledgeDocumentRecord | undefined;
    if (record?.userId !== userId) {
      return 'forbidden';
    }

    const chunksSnapshot = await db
      .collection('knowledge_chunks')
      .where('userId', '==', userId)
      .where('documentId', '==', documentId)
      .get();

    for (let i = 0; i < chunksSnapshot.docs.length; i += 400) {
      const batch = db.batch();
      for (const chunkDoc of chunksSnapshot.docs.slice(i, i + 400)) {
        batch.delete(chunkDoc.ref);
      }
      await batch.commit();
    }

    await docRef.delete();
    inMemoryKnowledgeDocuments.delete(documentId);
    for (const [chunkId, chunk] of inMemoryKnowledgeChunks.entries()) {
      if (chunk.metadata.documentId === documentId && chunk.metadata.userId === userId) {
        inMemoryKnowledgeChunks.delete(chunkId);
      }
    }

    return 'deleted';
  } catch (error) {
    console.warn('Failed to delete knowledge document from Firestore.', error);
    return 'error';
  }
}

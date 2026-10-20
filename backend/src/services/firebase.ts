import admin from 'firebase-admin';
import { config } from '../config.js';

let firebaseEnabled = false;
const isTestEnvironment = process.env.NODE_ENV === 'test';
export let firebaseAdminConfigured = false;

// In-memory persistence for local fallback when Firebase is not configured or during testing
export const inMemoryInvestigations = new Map<string, Record<string, unknown>>();
export const inMemoryFindings: Array<Record<string, unknown>> = [];

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

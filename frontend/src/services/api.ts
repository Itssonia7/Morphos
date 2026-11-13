import type { InvestigationEvent, InvestigationResponse } from '../types';

export type { InvestigationEvent, InvestigationResponse };

let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
while (API_BASE_URL.endsWith('/')) {
  API_BASE_URL = API_BASE_URL.slice(0, -1);
}

export async function investigate(
  question: string,
  authToken: string,
  options?: { projectId?: string; topK?: number },
): Promise<InvestigationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/investigate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      question,
      ...(options?.projectId ? { projectId: options.projectId } : {}),
      ...(options?.topK ? { topK: options.topK } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error('Investigation request failed');
  }

  return response.json();
}

export async function ingestKnowledgeDocument(
  payload: {
    sourceName: string;
    content: string;
    projectId?: string;
    contentType?: 'text/plain' | 'text/markdown' | 'application/json' | 'text/html';
  },
  authToken: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Knowledge ingestion failed');
  }

  return response.json();
}

export async function listKnowledgeDocuments(
  authToken: string,
  projectId?: string,
): Promise<Array<Record<string, unknown>>> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/knowledge${query}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Knowledge list request failed');
  }

  return response.json();
}

export async function searchKnowledge(
  query: string,
  authToken: string,
  options?: { projectId?: string; topK?: number },
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      query,
      ...(options?.projectId ? { projectId: options.projectId } : {}),
      ...(options?.topK ? { topK: options.topK } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error('Knowledge search failed');
  }

  return response.json();
}

export async function deleteKnowledgeDocument(
  id: string,
  authToken: string,
): Promise<{ success: boolean; deletedId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Knowledge deletion failed');
  }

  return response.json();
}

export async function getInvestigations(authToken: string): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`${API_BASE_URL}/api/investigations`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Investigation history request failed');
  }
  return response.json();
}

export async function getInvestigationById(id: string, authToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/investigations/${id}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Investigation detail request failed');
  }

  return response.json();
}

export async function getAnalytics(authToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/analytics`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Analytics request failed');
  }

  return response.json();
}

export async function deleteInvestigation(id: string, authToken: string): Promise<{ success: boolean; deletedId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/investigations/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Investigation deletion failed');
  }

  return response.json();
}

export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}

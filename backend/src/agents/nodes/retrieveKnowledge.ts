/**
 * File README
 * What this file does: retrieves relevant user/project knowledge base chunks via semantic vector search.
 * Why it exists: grounds downstream hypothesis generation and analysis in verified user documentation before reasoning.
 * Data in: the user's question, authenticated userId, optional projectId, and topK configuration.
 * Data out: retrievedContext chunks, ragSummary metadata, and a workflow event.
 * LangGraph connection: runs after interpretQuestion and before generateHypotheses.
 */
import { retrieveKnowledgeContext } from '../../rag/ragService.js';
import { createEvent, InvestigationState } from '../state.js';

export async function retrieveKnowledge(state: InvestigationState): Promise<InvestigationState> {
  if (!state.userId) {
    return {
      ...state,
      retrievedContext: [],
      ragSummary: {
        enabled: false,
        retrievedCount: 0,
        sources: [],
      },
      status: 'knowledge_skipped',
      events: [
        ...state.events,
        createEvent('retrieveKnowledge', 'Knowledge retrieval skipped (no authenticated user scope)'),
      ],
    };
  }

  try {
    const retrieval = await retrieveKnowledgeContext({
      query: state.question,
      userId: state.userId,
      projectId: state.projectId,
      investigationId: state.id,
      topK: state.ragTopK,
    });

    const uniqueSources = Array.from(new Set(retrieval.chunks.map((chunk) => chunk.sourceName)));

    const message = retrieval.hasContext
      ? `Retrieved ${retrieval.chunks.length} knowledge chunk(s) from ${uniqueSources.length} source(s) (${retrieval.embeddingProvider})`
      : retrieval.warning
        ? `No knowledge context retrieved (${retrieval.warning}); continuing with standard reasoning`
        : 'No matching knowledge base context found; continuing with standard reasoning';

    return {
      ...state,
      retrievedContext: retrieval.chunks,
      ragSummary: {
        enabled: true,
        retrievedCount: retrieval.chunks.length,
        sources: uniqueSources,
        embeddingProvider: retrieval.embeddingProvider,
        ...(retrieval.warning ? { warning: retrieval.warning } : {}),
      },
      status: retrieval.hasContext ? 'knowledge_retrieved' : 'knowledge_empty',
      events: [...state.events, createEvent('retrieveKnowledge', message)],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('retrieveKnowledge node failed gracefully; continuing without KB context.', { reason });
    return {
      ...state,
      retrievedContext: [],
      ragSummary: {
        enabled: true,
        retrievedCount: 0,
        sources: [],
        warning: `Knowledge retrieval failed (${reason}); continued without KB context.`,
      },
      status: 'knowledge_unavailable',
      events: [
        ...state.events,
        createEvent('retrieveKnowledge', 'Knowledge retrieval unavailable; continuing with standard reasoning', 'error'),
      ],
    };
  }
}


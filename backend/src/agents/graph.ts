/**
 * File README
 * What this file does: wires the MORPHOS investigation as a real LangGraph state machine.
 * Why it exists: it turns the workflow into a controlled cycle with safe stopping conditions instead of a free-form chatbot loop.
 * Data in: a user question, initial state (including optional userId/projectId for RAG), and intermediate node outputs.
 * Data out: the final investigation state with retrieved context, conclusion, confidence, and events list.
 * LangGraph connection: this file defines the graph edges, nodes, and conditional branching between generateHypotheses and finalize.
 */
import { START, END, StateGraph, Annotation } from '@langchain/langgraph';
import type { RagSummary, RetrievedChunk } from '../rag/types.js';
import {
  createFreshState,
  CreateFreshStateOptions,
  InvestigationDomain,
  InvestigationState,
  ResultStatus,
  WorkflowEvent,
} from './state.js';
import { interpretQuestion } from './nodes/interpretQuestion.js';
import { retrieveKnowledge } from './nodes/retrieveKnowledge.js';
import { generateHypotheses } from './nodes/generateHypotheses.js';
import { selectExperiment } from './nodes/selectExperiment.js';
import { executeExperiment } from './nodes/executeExperiment.js';
import { analyzeResults } from './nodes/analyzeResults.js';
import { finalize } from './nodes/finalize.js';
import { evaluateConfidence } from './nodes/evaluateConfidence.js';

export function shouldContinue(state: InvestigationState): string {
  if (state.confidence >= 0.7) {
    return 'finalize';
  }

  if (state.iteration >= state.maxIterations) {
    return 'finalize';
  }

  return 'generate_hypotheses';
}

export async function runInvestigation(
  question: string,
  idOrOptions?: string | CreateFreshStateOptions,
): Promise<InvestigationState> {
  const initialState = createFreshState(question, idOrOptions);

  const InvestigationAnnotation = Annotation.Root({
    id: Annotation<string>(),
    userId: Annotation<string | undefined>(),
    projectId: Annotation<string | undefined>(),
    ragTopK: Annotation<number | undefined>(),
    question: Annotation<string>(),
    domain: Annotation<InvestigationDomain>(),
    interpretedProblem: Annotation<string>(),
    retrievedContext: Annotation<RetrievedChunk[]>({
      reducer: (_left: RetrievedChunk[] = [], right: RetrievedChunk[]) =>
        Array.isArray(right) ? right : _left,
      default: () => [],
    }),
    ragSummary: Annotation<RagSummary>(),
    hypotheses: Annotation<any[]>({
      reducer: (left: any[] = [], right: any) => (Array.isArray(right) ? right : left.concat(right ?? [])),
      default: () => [],
    }),
    selectedHypothesis: Annotation<any | null>(),
    experiment: Annotation<any | null>(),
    experimentResult: Annotation<any | null>(),
    analysis: Annotation<string>(),
    confidence: Annotation<number>(),
    iteration: Annotation<number>(),
    maxIterations: Annotation<number>(),
    events: Annotation<WorkflowEvent[]>({
      reducer: (left: WorkflowEvent[] = [], right: WorkflowEvent | WorkflowEvent[]) =>
        Array.isArray(right) ? right : left.concat([right]),
      default: () => [],
    }),
    finalConclusion: Annotation<string>(),
    status: Annotation<string>(),
    resultStatus: Annotation<ResultStatus>(),
  });

  const workflow: any = new StateGraph(InvestigationAnnotation);

  workflow.addNode('interpretQuestion', interpretQuestion);
  workflow.addNode('retrieveKnowledge', retrieveKnowledge);
  workflow.addNode('generateHypotheses', generateHypotheses);
  workflow.addNode('selectExperiment', selectExperiment);
  workflow.addNode('executeExperiment', async (state: InvestigationState) => executeExperiment(state));
  workflow.addNode('analyzeResults', analyzeResults);
  workflow.addNode('evaluateConfidence', evaluateConfidence);
  workflow.addNode('finalize', finalize);

  workflow.addEdge(START, 'interpretQuestion');
  workflow.addEdge('interpretQuestion', 'retrieveKnowledge');
  workflow.addEdge('retrieveKnowledge', 'generateHypotheses');
  workflow.addEdge('generateHypotheses', 'selectExperiment');
  workflow.addEdge('selectExperiment', 'executeExperiment');
  workflow.addEdge('executeExperiment', 'analyzeResults');
  workflow.addEdge('analyzeResults', 'evaluateConfidence');
  workflow.addConditionalEdges('evaluateConfidence', shouldContinue, {
    finalize: 'finalize',
    generate_hypotheses: 'generateHypotheses',
  });
  workflow.addEdge('finalize', END);

  const app = workflow.compile();
  const result = await app.invoke(initialState);

  return {
    ...result,
    id: result.id || initialState.id,
    domain: result.domain || initialState.domain || 'general',
    retrievedContext: result.retrievedContext ?? [],
    ragSummary: result.ragSummary ?? initialState.ragSummary,
    resultStatus: result.resultStatus || initialState.resultStatus || 'simulated',
    finalConclusion: result.finalConclusion || result.analysis || 'Investigation completed.',
  } as InvestigationState;
}

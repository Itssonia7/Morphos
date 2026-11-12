/**
 * File README
 * What this file does: defines the shared state for the MORPHOS agent workflow.
 * Why it exists: every LangGraph node reads and writes the same investigation structure so the loop stays consistent.
 * Data in: the user's question plus intermediate findings, retrieved knowledge context, selected hypotheses, experiments, results, and status.
 * Data out: a fully typed state object that the workflow can pass between nodes.
 * LangGraph connection: this is the state contract used by the graph and each node that mutates the workflow.
 */
import type { RagSummary, RetrievedChunk } from '../rag/types.js';

export type InvestigationDomain =
  | 'ml_model_performance'
  | 'api_latency'
  | 'memory'
  | 'database'
  | 'general';

export type ResultStatus = 'real' | 'simulated' | 'no_matching_template';

export type WorkflowEvent = {
  type: 'node_completed' | 'status_changed' | 'error';
  node: string;
  timestamp: string;
  message: string;
};

export type Hypothesis = {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
  evidence: string[];
};

export type Experiment = {
  id: string;
  name: string;
  description: string;
  tool: string;
  inputs: Record<string, unknown>;
  result?: Record<string, unknown>;
};

export type InvestigationState = {
  id?: string;
  userId?: string;
  projectId?: string;
  ragTopK?: number;
  question: string;
  domain: InvestigationDomain;
  interpretedProblem: string;
  retrievedContext: RetrievedChunk[];
  ragSummary: RagSummary;
  hypotheses: Hypothesis[];
  selectedHypothesis: Hypothesis | null;
  experiment: Experiment | null;
  experimentResult: Record<string, unknown> | null;
  analysis: string;
  confidence: number;
  iteration: number;
  maxIterations: number;
  events: WorkflowEvent[];
  finalConclusion: string;
  status: string;
  resultStatus: ResultStatus;
};

export function createEvent(node: string, message: string, type: WorkflowEvent['type'] = 'node_completed'): WorkflowEvent {
  return {
    type,
    node,
    timestamp: new Date().toISOString(),
    message,
  };
}

export const defaultState: InvestigationState = {
  question: '',
  domain: 'general',
  interpretedProblem: '',
  retrievedContext: [],
  ragSummary: {
    enabled: false,
    retrievedCount: 0,
    sources: [],
  },
  hypotheses: [],
  selectedHypothesis: null,
  experiment: null,
  experimentResult: null,
  analysis: '',
  confidence: 0,
  iteration: 0,
  maxIterations: 3,
  events: [],
  finalConclusion: '',
  status: 'idle',
  resultStatus: 'simulated',
};

export interface CreateFreshStateOptions {
  id?: string;
  userId?: string;
  projectId?: string;
  ragTopK?: number;
}

export function createFreshState(
  question: string,
  idOrOptions?: string | CreateFreshStateOptions,
): InvestigationState {
  const opts: CreateFreshStateOptions =
    typeof idOrOptions === 'string' ? { id: idOrOptions } : (idOrOptions ?? {});

  return {
    id: opts.id || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.projectId ? { projectId: opts.projectId } : {}),
    ...(opts.ragTopK ? { ragTopK: opts.ragTopK } : {}),
    question: question.trim(),
    domain: 'general',
    interpretedProblem: '',
    retrievedContext: [],
    ragSummary: {
      enabled: Boolean(opts.userId),
      retrievedCount: 0,
      sources: [],
    },
    hypotheses: [],
    selectedHypothesis: null,
    experiment: null,
    experimentResult: null,
    analysis: '',
    confidence: 0,
    iteration: 0,
    maxIterations: 3,
    events: [createEvent('graph', 'Investigation started')],
    finalConclusion: '',
    status: 'starting',
    resultStatus: 'simulated',
  };
}

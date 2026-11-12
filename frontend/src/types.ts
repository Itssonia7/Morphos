export type InvestigationDomain =
  | 'ml_model_performance'
  | 'api_latency'
  | 'memory'
  | 'database'
  | 'general';

export type ResultStatus = 'real' | 'simulated' | 'no_matching_template';

export type InvestigationEvent = {
  type: 'node_completed' | 'status_changed' | 'error';
  node: string;
  timestamp: string;
  message: string;
};

export type Hypothesis = {
  id?: string;
  title: string;
  rationale: string;
  confidence: number;
  evidence: string[];
};

export type Experiment = {
  id?: string;
  name: string;
  description: string;
  tool: string;
  inputs?: Record<string, unknown>;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  sourceName: string;
  content: string;
  score: number;
  metadata?: {
    projectId?: string;
    section?: string;
    page?: number;
    chunkIndex?: number;
  };
};

export type RagSummary = {
  enabled: boolean;
  retrievedCount: number;
  sources: string[];
  embeddingProvider?: string;
  warning?: string;
};

export type InvestigationResponse = {
  id?: string;
  question: string;
  domain?: InvestigationDomain;
  resultStatus?: ResultStatus;
  interpretedProblem: string;
  retrievedContext?: RetrievedChunk[];
  ragSummary?: RagSummary;
  hypotheses: Hypothesis[];
  selectedHypothesis: Hypothesis | null;
  experiment: Experiment | null;
  experimentResult: Record<string, unknown> | null;
  analysis: string;
  confidence: number;
  iteration: number;
  maxIterations: number;
  events: InvestigationEvent[];
  finalConclusion: string;
  status: string;
  firebase?: { id?: string };
  isLocal?: boolean;
};

export type InvestigationRecord = Record<string, unknown> & {
  id?: string;
  question?: string;
  domain?: InvestigationDomain;
  resultStatus?: ResultStatus;
  status?: string;
  confidence?: number;
  createdAt?: string;
  updatedAt?: string;
  iteration?: number;
  maxIterations?: number;
  finalConclusion?: string;
  interpretedProblem?: string;
  retrievedContext?: RetrievedChunk[];
  ragSummary?: RagSummary;
  analysis?: string;
  selectedHypothesis?: Hypothesis | null;
  hypotheses?: Hypothesis[];
  experiment?: Experiment | null;
  experimentResult?: Record<string, unknown> | null;
  events?: Array<Record<string, unknown>>;
  userId?: string;
  isLocal?: boolean;
};

export type AnalyticsState = {
  totalInvestigations: number;
  completedInvestigations: number;
  averageConfidence: number;
  averageIterations: number;
  totalExperiments: number;
  completionRate: number;
  confidenceDistribution: { high: number; medium: number; low: number };
  experimentOutcomes: { completed: number; failed: number; running: number };
  investigationsOverTime: Array<{ date: string; count: number }>;
  iterationsPerInvestigation: Array<{ label: string; iterations: number }>;
};

export type ViewId = 'overview' | 'investigations' | 'experiments' | 'insights' | 'analytics' | 'profile';

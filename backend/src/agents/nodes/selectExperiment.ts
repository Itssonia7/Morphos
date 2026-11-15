/**
 * File README
 * What this file does: selects the single most informative experiment for the current investigation.
 * Why it exists: the workflow should avoid random tests and pick the experiment that best distinguishes between hypotheses.
 * Data in: the current question, domain, and generated hypotheses.
 * Data out: the selected experiment object with its tool name and input values.
 * LangGraph connection: it runs after generateHypotheses and before executeExperiment.
 */
import { createEvent, InvestigationState } from '../state.js';

const scenarioToExperiment = {
  latency: {
    id: 'exp-latency',
    name: 'Load and bottleneck benchmark',
    description: 'Measure latency under increasing request volume and compare database, CPU, and memory contributions.',
    tool: 'benchmark_tool',
    inputs: { datasetSize: 5000, loadFactor: 6 },
  },
  networkTrace: {
    id: 'exp-network-trace',
    name: 'Endpoint network latency trace',
    description: 'Trace DNS, TCP, TLS, and TTFB timings across API gateway and upstream handlers.',
    tool: 'network_trace',
    inputs: { endpoint: '/api/v1/checkout' },
  },
  logAnalysis: {
    id: 'exp-log-analysis',
    name: 'Structured server error log analysis',
    description: 'Aggregate matching error codes, severity, and peak failure latency from server logs.',
    tool: 'log_analyzer',
    inputs: { query: 'timeout error', timeframe: '15m' },
  },
  database: {
    id: 'exp-db',
    name: 'Database contention experiment',
    description: 'Simulate DB workloads and inspect connection pool health and latency under load.',
    tool: 'mock_data_tool',
    inputs: { scenario: 'database performance' },
  },
  memory: {
    id: 'exp-memory',
    name: 'Memory retention experiment',
    description: 'Observe memory pressure and retention after repeated operations.',
    tool: 'mock_data_tool',
    inputs: { scenario: 'memory usage' },
  },
  dataset: {
    id: 'exp-dataset',
    name: 'Scaling complexity benchmark',
    description: 'Measure runtime and throughput as data volume increases.',
    tool: 'benchmark_tool',
    inputs: { datasetSize: 20000, loadFactor: 8 },
  },
};

function extractEndpointFromQuestion(question: string): string {
  const pathMatch = question.match(/(\/[a-zA-Z0-9._/-]+)/);
  return pathMatch ? pathMatch[1] : '/api/v1/checkout';
}

export function selectExperiment(state: InvestigationState): InvestigationState {
  const domain = state.domain || 'general';
  const selectedHypothesis = state.hypotheses[0] ?? null;
  const q = state.question.toLowerCase();

  // ML model performance does not have an in-repo execution sandbox
  if (domain === 'ml_model_performance') {
    return {
      ...state,
      selectedHypothesis,
      experiment: null,
      resultStatus: 'no_matching_template',
      status: 'experiment_selected',
      events: [
        ...state.events,
        createEvent('selectExperiment', 'No matching experiment template available for ML model evaluation; simulated result flagged'),
      ],
    };
  }

  const isLogInvestigation =
    /\blogs?\b|error spike|502|503|504|exception|stack trace|crash/i.test(q);
  const isNetworkTraceInvestigation =
    /network|dns|tls|handshake|ttfb|gateway|upstream|endpoint|\/[a-zA-Z0-9_-]+/i.test(q);

  const selection = isLogInvestigation
    ? {
        ...scenarioToExperiment.logAnalysis,
        inputs: {
          query: state.question.trim() || 'timeout error',
          timeframe: '15m',
        },
      }
    : isNetworkTraceInvestigation
    ? {
        ...scenarioToExperiment.networkTrace,
        inputs: {
          endpoint: extractEndpointFromQuestion(state.question),
        },
      }
    : domain === 'database'
    ? scenarioToExperiment.database
    : domain === 'memory'
    ? scenarioToExperiment.memory
    : domain === 'api_latency'
    ? scenarioToExperiment.latency
    : scenarioToExperiment.dataset;

  return {
    ...state,
    selectedHypothesis,
    experiment: {
      ...selection,
      result: undefined,
    },
    resultStatus: state.resultStatus === 'real' ? 'real' : 'simulated',
    status: 'experiment_selected',
    events: [...state.events, createEvent('selectExperiment', `Experiment selected: ${selection.name}`)],
  };
}

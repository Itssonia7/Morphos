import { START, END, StateGraph, Annotation } from '@langchain/langgraph';
import { emitGraphState } from '../services/socket.js';
import { createFreshState, InvestigationDomain, InvestigationState, ResultStatus, WorkflowEvent } from './state.js';
import { interpretQuestion } from './nodes/interpretQuestion.js';
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

function withTelemetry(
  nodeName: string,
  nodeFn: (state: InvestigationState) => Promise<InvestigationState> | InvestigationState,
  userId?: string,
) {
  return async (state: InvestigationState): Promise<InvestigationState> => {
    const nextState = await nodeFn(state);
    const runId = nextState.id || state.id || 'unknown-run';
    const latestEvent = nextState.events[nextState.events.length - 1];

    emitGraphState(
      runId,
      nodeName,
      {
        runId,
        stage: nodeName,
        status: nextState.status,
        domain: nextState.domain,
        confidence: nextState.confidence,
        iteration: nextState.iteration,
        message: latestEvent?.message ?? `Completed stage: ${nodeName}`,
        timestamp: latestEvent?.timestamp ?? new Date().toISOString(),
      },
      userId,
    );

    return nextState;
  };
}

export async function runInvestigation(
  question: string,
  id?: string,
  userId?: string,
): Promise<InvestigationState> {
  const initialState = createFreshState(question, id);
  const runId = initialState.id!;

  emitGraphState(
    runId,
    'started',
    {
      runId,
      stage: 'started',
      status: initialState.status,
      domain: initialState.domain,
      confidence: initialState.confidence,
      iteration: initialState.iteration,
      message: 'Investigation started',
      timestamp: new Date().toISOString(),
    },
    userId,
  );

  const InvestigationAnnotation = Annotation.Root({
    id: Annotation<string>(),
    question: Annotation<string>(),
    domain: Annotation<InvestigationDomain>(),
    interpretedProblem: Annotation<string>(),
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

  workflow.addNode('interpretQuestion', withTelemetry('interpretQuestion', interpretQuestion, userId));
  workflow.addNode('generateHypotheses', withTelemetry('generateHypotheses', generateHypotheses, userId));
  workflow.addNode('selectExperiment', withTelemetry('selectExperiment', selectExperiment, userId));
  workflow.addNode('executeExperiment', withTelemetry('executeExperiment', executeExperiment, userId));
  workflow.addNode('analyzeResults', withTelemetry('analyzeResults', analyzeResults, userId));
  workflow.addNode('evaluateConfidence', withTelemetry('evaluateConfidence', evaluateConfidence, userId));
  workflow.addNode('finalize', withTelemetry('finalize', finalize, userId));

  workflow.addEdge(START, 'interpretQuestion');
  workflow.addEdge('interpretQuestion', 'generateHypotheses');
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
    resultStatus: result.resultStatus || initialState.resultStatus || 'simulated',
    finalConclusion: result.finalConclusion || result.analysis || 'Investigation completed.',
  } as InvestigationState;
}

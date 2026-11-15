/**
 * File README
 * What this file does: executes the chosen experiment by invoking LangChain tools.
 * Why it exists: the agent has to collect measurable evidence before deciding whether the hypothesis is strong enough.
 * Data in: the selected experiment object, including tool name and inputs.
 * Data out: experimentResult, which contains the observable metrics from the tool invocation.
 * LangGraph connection: it sits between selectExperiment and analyzeResults in the main workflow.
 */
import { createEvent, InvestigationState } from '../state.js';
import { benchmarkTool } from '../tools/benchmarkTool.js';
import { calculatorTool } from '../tools/calculatorTool.js';
import { logAnalyzerTool } from '../tools/logAnalyzerTool.js';
import { mockDataTool } from '../tools/mockDataTool.js';
import { networkTraceTool } from '../tools/networkTraceTool.js';

export async function executeExperiment(state: InvestigationState): Promise<InvestigationState> {
  const experiment = state.experiment;
  if (!experiment) {
    return {
      ...state,
      experimentResult: null,
      status: 'experiment_skipped',
      events: [
        ...state.events,
        createEvent('executeExperiment', 'Experiment execution skipped: simulated result (no matching template)'),
      ],
    };
  }

  let result: Record<string, unknown>;

  if (experiment.tool === 'benchmark_tool') {
    const args = experiment.inputs as { datasetSize?: number; loadFactor?: number };
    const raw = await benchmarkTool.invoke({
      datasetSize: args.datasetSize ?? 1000,
      loadFactor: args.loadFactor ?? 1,
    });
    result = JSON.parse(String(raw));
  } else if (experiment.tool === 'network_trace') {
    const args = experiment.inputs as { endpoint?: string };
    const raw = await networkTraceTool.invoke({
      endpoint: String(args.endpoint ?? '/api/v1/checkout'),
    });
    result = JSON.parse(String(raw));
  } else if (experiment.tool === 'log_analyzer') {
    const args = experiment.inputs as { query?: string; timeframe?: string };
    const raw = await logAnalyzerTool.invoke({
      query: String(args.query ?? state.question),
      timeframe: String(args.timeframe ?? '15m'),
    });
    result = JSON.parse(String(raw));
  } else if (experiment.tool === 'calculator_tool') {
    const args = experiment.inputs as { expression?: string };
    const raw = await calculatorTool.invoke({
      expression: String(args.expression ?? '1 + 1'),
    });
    result = JSON.parse(String(raw));
  } else {
    const raw = await mockDataTool.invoke({
      scenario: String((experiment.inputs as { scenario?: string }).scenario ?? 'api latency'),
    });
    result = JSON.parse(String(raw));
  }

  return {
    ...state,
    experimentResult: result,
    status: 'experiment_running',
    events: [...state.events, createEvent('executeExperiment', `Running experiment: ${experiment.name}`)],
  };
}

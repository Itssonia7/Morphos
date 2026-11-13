/**
 * File README
 * What this file does: interprets the experiment output and retrieved knowledge context to write a plain-English analysis.
 * Why it exists: the graph needs a clear bridge between raw metrics, user knowledge base context, and a coherent reasoning summary.
 * Data in: the experiment result, retrieved knowledge chunks, and the selected hypothesis.
 * Data out: the analysis string and the updated event history.
 * LangGraph connection: it prepares state for confidence evaluation and decides whether the evidence is strong enough.
 */
import { formatRetrievedContextForPrompt } from '../../rag/ragService.js';
import { generateTextWithProvider } from '../../services/llmProvider.js';
import { createEvent, InvestigationState } from '../state.js';

function summarizeKbContext(state: InvestigationState): string {
  if (!state.retrievedContext || state.retrievedContext.length === 0) {
    return '';
  }

  const citations = state.retrievedContext.slice(0, 3).map((chunk) => {
    const snippet = chunk.content.replace(/\s+/g, ' ').trim().slice(0, 140);
    return `[KB: ${chunk.sourceName} (${chunk.chunkId}, score=${chunk.score.toFixed(2)})] "${snippet}${chunk.content.length > 140 ? '...' : ''}"`;
  });

  return ` Retrieved Knowledge Base Context: ${citations.join(' | ')}`;
}

export function buildAnalysisPrompts(state: InvestigationState): {
  systemPrompt: string;
  userPrompt: string;
} {
  const hasRagContext = Array.isArray(state.retrievedContext) && state.retrievedContext.length > 0;
  const formattedContext = hasRagContext ? formatRetrievedContextForPrompt(state.retrievedContext) : '';

  const systemPrompt = `You are MORPHOS, an autonomous systems investigator writing a concise technical analysis.
Rules:
1. Distinguish clearly between [Retrieved KB], [Experiment Telemetry], and [Model Reasoning].
2. Never invent facts as coming from the knowledge base if they are not in the retrieved chunks.
3. If no experiment was executed (no_matching_template), explicitly state that the analysis is hypothesis-based reasoning rather than measured experiment findings.
4. Keep the analysis concise (2-4 sentences) and strictly relevant to the "${state.domain}" domain.`;

  const userPrompt = `Question: ${state.question}
Domain: ${state.domain}
Selected Hypothesis: ${state.selectedHypothesis ? `${state.selectedHypothesis.title} — ${state.selectedHypothesis.rationale}` : 'None'}
Result Status: ${state.resultStatus}
Experiment Result: ${state.experimentResult ? JSON.stringify(state.experimentResult) : 'None (no matching template)'}

Retrieved Knowledge Base Context:
${formattedContext || '(none)'}`;

  return { systemPrompt, userPrompt };
}

export async function analyzeResults(state: InvestigationState): Promise<InvestigationState> {
  const kbSummary = summarizeKbContext(state);

  const { systemPrompt, userPrompt } = buildAnalysisPrompts(state);
  const llmText = await generateTextWithProvider({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
  });

  if (llmText?.data) {
    return {
      ...state,
      analysis: llmText.data,
      status: 'analyzed',
      events: [...state.events, createEvent('analyzeResults', `Results analyzed via ${llmText.provider}`)],
    };
  }

  if (state.domain === 'ml_model_performance' || !state.experimentResult || state.resultStatus === 'no_matching_template') {
    const analysis = `No matching experiment was available for this question. Evaluated domain hypotheses based on model architecture and data scaling theory: primary suspected factor is ${state.selectedHypothesis?.title.toLowerCase() || 'model generalization degradation'}. These are domain-based hypotheses, not measured findings; validate them with real model training and evaluation data.${kbSummary}`;
    return {
      ...state,
      analysis,
      status: 'analyzed',
      events: [...state.events, createEvent('analyzeResults', 'Hypothesis-based reasoning completed (no matching experiment template)')],
    };
  }

  const result = state.experimentResult ?? {};
  const metrics = (result as { metrics?: Record<string, unknown>; latencyMs?: number }).metrics ?? {};
  const latency = (result as { latencyMs?: number }).latencyMs ?? (metrics as { databaseLatency?: number }).databaseLatency ?? 0;

  const analysis = `Experiment Telemetry: dominant signal around ${latency} ms with the highest stress in ${Object.keys(metrics).length ? Object.keys(metrics).join(', ') : 'the simulated workload'}. Domain Reasoning: this points to the selected bottleneck (${state.selectedHypothesis?.title ?? 'primary bottleneck'}) as the most likely root cause.${kbSummary}`;

  return {
    ...state,
    analysis,
    status: 'analyzed',
    events: [...state.events, createEvent('analyzeResults', 'Results analyzed')],
  };
}

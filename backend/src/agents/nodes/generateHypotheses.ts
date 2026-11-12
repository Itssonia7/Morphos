/**
 * File README
 * What this file does: produces candidate explanations for the investigation, grounded in retrieved RAG context when available.
 * Why it exists: the agent must reason about multiple plausible causes before choosing a test.
 * Data in: the interpreted problem, the user's question, and any retrieved knowledge base chunks.
 * Data out: a list of hypothesis objects with rationale, evidence, and confidence.
 * LangGraph connection: it follows retrieveKnowledge (and loop-backs from evaluateConfidence) and precedes experiment selection.
 */
import { z } from 'zod';
import { formatRetrievedContextForPrompt } from '../../rag/ragService.js';
import { generateStructuredWithProvider } from '../../services/llmProvider.js';
import { DOMAIN_HYPOTHESES } from '../domain.js';
import { createEvent, Hypothesis, InvestigationDomain, InvestigationState } from '../state.js';

const HypothesisListSchema = z.object({
  hypotheses: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      rationale: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
    }),
  ),
});

function summarizeExcerpt(text: string, maxLen = 180): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLen - 3)}...`;
}

function getDomainAnchorLabel(domain: InvestigationDomain): string {
  switch (domain) {
    case 'ml_model_performance':
      return 'Model accuracy and generalization bottleneck';
    case 'api_latency':
      return 'API request latency bottleneck';
    case 'memory':
      return 'Memory retention and heap growth bottleneck';
    case 'database':
      return 'Database query and connection bottleneck';
    default:
      return 'System performance bottleneck';
  }
}

function buildKnowledgeGroundedHypotheses(
  state: InvestigationState,
  domainTemplates: Hypothesis[],
): Hypothesis[] {
  const topChunks = state.retrievedContext.slice(0, 2);
  if (topChunks.length === 0) {
    return domainTemplates;
  }

  const primary = topChunks[0];
  const domain = state.domain || 'general';
  const baseTemplate = domainTemplates[0];
  const anchor = getDomainAnchorLabel(domain);
  const location = primary.metadata.section
    ? `${primary.sourceName} § ${primary.metadata.section}`
    : primary.sourceName;

  const kbHypothesis: Hypothesis = {
    id: `kb-${primary.chunkId}`,
    title: baseTemplate
      ? `${baseTemplate.title} (KB: ${primary.sourceName})`
      : `${anchor} documented in ${primary.sourceName}`,
    rationale: `Retrieved KB context (${location}): "${summarizeExcerpt(primary.content, 200)}" | Independent domain reasoning: ${baseTemplate?.rationale ?? 'System behavior aligns with observed bottleneck patterns.'}`,
    confidence: Number(Math.min(0.88, Math.max(0.68, 0.55 + primary.score * 0.35)).toFixed(2)),
    evidence: [
      ...topChunks.map(
        (chunk) =>
          `[KB: ${chunk.sourceName} | similarity=${chunk.score.toFixed(2)}] ${summarizeExcerpt(chunk.content, 160)}`,
      ),
      ...(baseTemplate?.evidence?.slice(0, 1).map((item) => `[Domain reasoning] ${item}`) ?? []),
    ],
  };

  return [kbHypothesis, ...domainTemplates.slice(0, 2)];
}

export function buildHypothesisPrompts(state: InvestigationState): {
  systemPrompt: string;
  userPrompt: string;
} {
  const domain = state.domain || 'general';
  const hasRagContext = Array.isArray(state.retrievedContext) && state.retrievedContext.length > 0;
  const formattedContext = hasRagContext ? formatRetrievedContextForPrompt(state.retrievedContext) : '';

  const systemPrompt = `You are MORPHOS, an autonomous investigation planner. You are investigating an issue in the domain: "${domain}".
Generate 2-4 structured hypotheses strictly relevant to the question and the "${domain}" domain.
Do NOT generate hypotheses from unrelated domains (for example: do not discuss database locks or worker sockets for machine learning model performance).

Grounding & Attribution Rules:
1. ${hasRagContext ? 'Review the Retrieved Knowledge Base Context below and incorporate relevant facts when forming hypotheses.' : 'No knowledge base documents matched this query; rely on your domain engineering reasoning.'}
2. Clearly distinguish retrieved knowledge base facts from your own independent reasoning: prefix evidence or rationale statements derived from retrieved documents with "[KB: <sourceName>]" and prefix your own analytical reasoning with "[Reasoning]".
3. NEVER invent, extrapolate, or fabricate facts as supposedly coming from the knowledge base if they do not appear in the retrieved chunks.
4. If the retrieved context is only partially relevant or unrelated, continue reasoning normally using domain knowledge without forcing irrelevant citations.`;

  const userPrompt = hasRagContext
    ? `Question: ${state.question}
Interpreted Problem: ${state.interpretedProblem}
Domain: ${domain}

Retrieved Knowledge Base Context:
${formattedContext}

Return a JSON object with a hypotheses array where each item includes id, title, rationale, confidence (0.0 to 1.0), and evidence (array of strings).`
    : `Question: ${state.question}
Interpreted Problem: ${state.interpretedProblem}
Domain: ${domain}

Retrieved Knowledge Base Context: (none)

Return a JSON object with a hypotheses array where each item includes id, title, rationale, confidence (0.0 to 1.0), and evidence (array of strings).`;

  return { systemPrompt, userPrompt };
}

export async function generateHypotheses(state: InvestigationState): Promise<InvestigationState> {
  const domain = state.domain || 'general';
  const domainTemplates = [...(DOMAIN_HYPOTHESES[domain] ?? DOMAIN_HYPOTHESES.general)];
  let hypotheses: Hypothesis[] = buildKnowledgeGroundedHypotheses(state, domainTemplates);
  let resultStatus: 'real' | 'simulated' | 'no_matching_template' =
    domain === 'ml_model_performance' ? 'no_matching_template' : 'simulated';

  const { systemPrompt, userPrompt } = buildHypothesisPrompts(state);
  const llmResponse = await generateStructuredWithProvider({
    systemPrompt,
    userPrompt,
    schema: HypothesisListSchema,
    temperature: 0.3,
  });

  if (llmResponse?.data.hypotheses && llmResponse.data.hypotheses.length > 0) {
    hypotheses = llmResponse.data.hypotheses as Hypothesis[];
    if (domain !== 'ml_model_performance') {
      resultStatus = 'real';
    }
  }

  const kbSuffix = state.retrievedContext.length > 0
    ? ` grounded with ${state.retrievedContext.length} KB chunk(s)`
    : '';

  return {
    ...state,
    hypotheses,
    resultStatus,
    status: 'hypotheses_ready',
    events: [
      ...state.events,
      createEvent('generateHypotheses', `Generated ${hypotheses.length} hypotheses for domain: ${domain}${kbSuffix}`),
    ],
  };
}

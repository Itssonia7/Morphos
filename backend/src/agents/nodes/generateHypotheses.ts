import { ChatPromptTemplate } from '@langchain/core/prompts';
import type { Runnable } from '@langchain/core/runnables';
import { z } from 'zod';
import { isGeminiConfigured, isGroqConfigured } from '../../config.js';
import { DOMAIN_HYPOTHESES } from '../domain.js';
import { getRobustStructuredLLM } from '../llmConfig.js';
import { createEvent, Hypothesis, InvestigationState } from '../state.js';

export const HypothesisListSchema = z.object({
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

const shouldUseLiveLLM =
  (isGeminiConfigured || isGroqConfigured) &&
  process.env.NODE_ENV !== 'test' &&
  process.env.USE_LIVE_GEMINI !== 'false' &&
  process.env.USE_LIVE_LLM !== 'false';

let model: Runnable<any, any> | null = shouldUseLiveLLM
  ? getRobustStructuredLLM(HypothesisListSchema, { temperature: 0.3 })
  : null;

export function setHypothesisModelForTesting(customModel: Runnable<any, any> | null): void {
  model = customModel;
}

export async function generateHypotheses(state: InvestigationState): Promise<InvestigationState> {
  const domain = state.domain || 'general';
  let hypotheses: Hypothesis[] = [...(DOMAIN_HYPOTHESES[domain] ?? DOMAIN_HYPOTHESES.general)];
  let resultStatus: 'real' | 'simulated' | 'no_matching_template' =
    domain === 'ml_model_performance' ? 'no_matching_template' : 'simulated';

  if (model) {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are MORPHOS, an autonomous investigation planner. You are investigating an issue in the domain: "${domain}".
Generate 2-4 structured hypotheses strictly relevant to the question and the "${domain}" domain.
Do NOT generate hypotheses from unrelated domains (for example: do not discuss database locks or worker sockets for machine learning model performance).`,
        ],
        [
          'human',
          'Question: {question}\nDomain: {domain}\nReturn a JSON object with a hypotheses array where each item includes id, title, rationale, confidence (0.0 to 1.0), and evidence (array of strings).',
        ],
      ]);
      const content = await prompt.invoke({ question: state.question, domain });
      const response = await model.invoke(content);
      const structured = response as { hypotheses?: Hypothesis[] };
      if (structured.hypotheses && structured.hypotheses.length > 0) {
        hypotheses = structured.hypotheses as Hypothesis[];
        resultStatus = 'real';
      }
    } catch (error) {
      console.warn('Falling back from LLM hypothesis generation; using domain-aware templates.', error);
    }
  }

  return {
    ...state,
    hypotheses,
    resultStatus,
    status: 'hypotheses_ready',
    events: [...state.events, createEvent('generateHypotheses', `Generated ${hypotheses.length} hypotheses for domain: ${domain}`)],
  };
}

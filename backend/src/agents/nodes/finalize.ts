/**
 * File README
 * What this file does: turns the entire workflow into a final explanation suitable for the frontend and API response.
 * Why it exists: the end user needs a crisp summary with evidence, retrieved knowledge attribution, confidence, and next steps.
 * Data in: the chosen hypothesis, retrieved knowledge context, experiment metadata, confidence, and result summary.
 * Data out: finalConclusion and the finalized status.
 * LangGraph connection: it is the terminal node reached when the confidence gate decides the investigation is complete.
 */
import { createEvent, InvestigationState } from '../state.js';
import { getDomainInsights, isConclusionRelevant } from '../domain.js';

export function finalize(state: InvestigationState): InvestigationState {
  const rootCause = state.selectedHypothesis?.title ?? 'primary bottleneck';
  const evidence = state.selectedHypothesis?.evidence?.join('; ') ?? 'simulated indicators';
  const domain = state.domain || 'general';
  const retrievedSources = Array.isArray(state.retrievedContext) && state.retrievedContext.length > 0
    ? Array.from(new Set(state.retrievedContext.map((chunk) => chunk.sourceName)))
    : [];
  const kbAttribution = retrievedSources.length > 0
    ? ` Retrieved knowledge sources consulted: ${retrievedSources.join(', ')}.`
    : '';

  let conclusion = '';
  if (state.resultStatus === 'no_matching_template' || domain === 'ml_model_performance') {
    conclusion = `Preliminary assessment: Possible causes include overfitting, noisy labels, distribution shift, or insufficient regularization (most likely: ${rootCause}). Evidence: No matching experiment was available for this question; these are domain-based hypotheses, not measured findings.${kbAttribution} Recommended next action: validate them with real model training and evaluation data.`;
  } else {
    conclusion = `Most likely root cause: ${rootCause}. Evidence: ${evidence}.${kbAttribution} Experiments performed: ${state.experiment?.name ?? 'simulated benchmark'}. Confidence: ${state.confidence}. Recommended next action: validate with real telemetry and inspect the identified bottleneck before scaling.`;
  }

  // Phase 10 Relevance Guard
  if (!isConclusionRelevant(conclusion, domain, state.question)) {
    console.warn(`Conclusion failed domain relevance check for ${domain}. Regenerating safe domain conclusion.`);
    const insights = getDomainInsights(domain, rootCause);
    conclusion = `Most likely root cause: ${rootCause}. ${insights.plainEnglishAnswer}${kbAttribution} Recommended next action: ${insights.recommendedActions[0] || 'Inspect relevant system metrics.'}`;

    // If still fails, mark as needing review / unavailable
    if (!isConclusionRelevant(conclusion, domain, state.question)) {
      return {
        ...state,
        finalConclusion: `Conclusion unavailable — generated explanation failed domain relevance verification for ${domain}.`,
        status: 'needs_review',
        events: [...state.events, createEvent('finalize', 'Conclusion rejected by relevance guard; marked for review', 'error')],
      };
    }
  }

  return {
    ...state,
    finalConclusion: conclusion,
    status: 'finalized',
    events: [...state.events, createEvent('finalize', `Final conclusion generated and verified for domain: ${domain}`)],
  };
}

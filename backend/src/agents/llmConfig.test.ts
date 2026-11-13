import { RunnableLambda } from '@langchain/core/runnables';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRobustLLM, getRobustStructuredLLM } from './llmConfig.js';
import {
  generateHypotheses,
  HypothesisListSchema,
  setHypothesisModelForTesting,
} from './nodes/generateHypotheses.js';
import { createFreshState } from './state.js';

describe('LLM Fallback Chaining (Gemini -> Groq)', () => {
  afterEach(() => {
    setHypothesisModelForTesting(null);
  });

  it('uses primary Gemini provider normally when it succeeds', async () => {
    const geminiFn = vi.fn(async () => ({ provider: 'gemini', text: 'Primary response' }));
    const groqFn = vi.fn(async () => ({ provider: 'groq', text: 'Fallback response' }));

    const chain = getRobustLLM({
      primaryOverride: RunnableLambda.from(geminiFn),
      fallbackOverride: RunnableLambda.from(groqFn),
    });

    const result = await chain!.invoke('Test prompt');

    expect(result).toEqual({ provider: 'gemini', text: 'Primary response' });
    expect(geminiFn).toHaveBeenCalledTimes(1);
    expect(groqFn).not.toHaveBeenCalled();
  });

  it('automatically falls back to Groq when Gemini throws a 429 quota/rate-limit error', async () => {
    const geminiFn = vi.fn(async () => {
      const rateLimitError = new Error('429 Too Many Requests: RESOURCE_EXHAUSTED quota limit');
      (rateLimitError as any).status = 429;
      throw rateLimitError;
    });

    const groqPayload = {
      hypotheses: [
        {
          id: 'groq-h1',
          title: 'Upstream connection pool exhaustion',
          rationale: 'Burst concurrency exhausts available database sockets.',
          confidence: 0.84,
          evidence: ['HTTP 504 timeouts correlate with pool saturation'],
        },
      ],
    };
    const groqFn = vi.fn(async () => groqPayload);

    const structuredChain = getRobustStructuredLLM(HypothesisListSchema, {
      primaryOverride: RunnableLambda.from(geminiFn),
      fallbackOverride: RunnableLambda.from(groqFn),
    });

    const response = await structuredChain!.invoke('Generate hypotheses');

    expect(geminiFn).toHaveBeenCalledTimes(1);
    expect(groqFn).toHaveBeenCalledTimes(1);
    expect(response).toEqual(groqPayload);
  });

  it('integrates fallback chain into generateHypotheses node on Gemini rate-limit failure', async () => {
    const geminiFn = vi.fn(async () => {
      throw new Error('429 Quota exceeded for generativelanguage.googleapis.com');
    });

    const groqFn = vi.fn(async () => ({
      hypotheses: [
        {
          id: 'groq-lat-1',
          title: 'Keep-alive socket starvation under load',
          rationale: 'Idle connection reuse limits cause queueing delays.',
          confidence: 0.81,
          evidence: ['P99 latency spikes during concurrent bursts'],
        },
      ],
    }));

    const chain = getRobustStructuredLLM(HypothesisListSchema, {
      primaryOverride: RunnableLambda.from(geminiFn),
      fallbackOverride: RunnableLambda.from(groqFn),
    });

    setHypothesisModelForTesting(chain);

    const state = createFreshState('Why is API latency increasing?');
    state.domain = 'api_latency';

    const updated = await generateHypotheses(state);

    expect(geminiFn).toHaveBeenCalledTimes(1);
    expect(groqFn).toHaveBeenCalledTimes(1);
    expect(updated.resultStatus).toBe('real');
    expect(updated.hypotheses).toHaveLength(1);
    expect(updated.hypotheses[0].id).toBe('groq-lat-1');
  });

  it('degrades gracefully to deterministic domain templates if both Gemini and Groq fail', async () => {
    const failingPrimary = RunnableLambda.from(async () => {
      throw new Error('429 Gemini quota exceeded');
    });
    const failingFallback = RunnableLambda.from(async () => {
      throw new Error('503 Groq service unavailable');
    });

    const chain = getRobustStructuredLLM(HypothesisListSchema, {
      primaryOverride: failingPrimary,
      fallbackOverride: failingFallback,
    });

    setHypothesisModelForTesting(chain);

    const state = createFreshState('Why is API latency increasing?');
    state.domain = 'api_latency';

    const updated = await generateHypotheses(state);

    expect(updated.resultStatus).toBe('simulated');
    expect(updated.hypotheses.length).toBeGreaterThan(0);
  });
});

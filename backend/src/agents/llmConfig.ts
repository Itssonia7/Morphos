import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import type { Runnable } from '@langchain/core/runnables';
import type { z } from 'zod';
import { config, isGeminiConfigured, isGroqConfigured } from '../config.js';

export interface RobustLLMOptions {
  temperature?: number;
  geminiModel?: string;
  groqModel?: string;
  primaryOverride?: Runnable<any, any>;
  fallbackOverride?: Runnable<any, any>;
}

export function getRobustLLM(options: RobustLLMOptions = {}): Runnable<any, any> | null {
  const temperature = options.temperature ?? 0.3;

  const primary: Runnable<any, any> | null =
    options.primaryOverride ??
    (isGeminiConfigured
      ? new ChatGoogleGenerativeAI({
          model: options.geminiModel ?? process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
          apiKey: config.geminiApiKey,
          temperature,
          maxRetries: 1,
        })
      : null);

  const fallback: Runnable<any, any> | null =
    options.fallbackOverride ??
    (isGroqConfigured
      ? new ChatGroq({
          model: options.groqModel ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
          apiKey: config.groqApiKey,
          temperature,
          maxRetries: 1,
        })
      : null);

  if (primary && fallback) {
    return primary.withFallbacks({ fallbacks: [fallback] });
  }

  return primary ?? fallback;
}

export function getRobustStructuredLLM<T extends z.ZodTypeAny>(
  schema: T,
  options: RobustLLMOptions = {},
): Runnable<any, any> | null {
  const temperature = options.temperature ?? 0.3;

  const primary: Runnable<any, any> | null =
    options.primaryOverride ??
    (isGeminiConfigured
      ? new ChatGoogleGenerativeAI({
          model: options.geminiModel ?? process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
          apiKey: config.geminiApiKey,
          temperature,
          maxRetries: 1,
        }).withStructuredOutput(schema)
      : null);

  const fallback: Runnable<any, any> | null =
    options.fallbackOverride ??
    (isGroqConfigured
      ? new ChatGroq({
          model: options.groqModel ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
          apiKey: config.groqApiKey,
          temperature,
          maxRetries: 1,
        }).withStructuredOutput(schema)
      : null);

  if (primary && fallback) {
    return primary.withFallbacks({ fallbacks: [fallback] });
  }

  return primary ?? fallback;
}

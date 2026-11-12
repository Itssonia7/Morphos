import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { ZodType } from 'zod';
import { config } from '../config.js';

export type LlmProviderName = 'gemini' | 'groq';

export interface StructuredLlmRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  temperature?: number;
}

export interface TextLlmRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface LlmResult<T> {
  data: T;
  provider: LlmProviderName;
  model: string;
}

export function isLiveLlmEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  if (process.env.USE_LIVE_LLM === 'false' || process.env.USE_LIVE_GEMINI === 'false') {
    return false;
  }
  return Boolean(config.geminiApiKey || config.groqApiKey);
}

function getProviderOrder(): LlmProviderName[] {
  const pref = config.llmProvider;
  const hasGemini = Boolean(config.geminiApiKey);
  const hasGroq = Boolean(config.groqApiKey);
  if (pref === 'groq') {
    return hasGroq ? ['groq'] : [];
  }
  if (pref === 'gemini') {
    return hasGemini ? ['gemini'] : [];
  }
  const order: LlmProviderName[] = [];
  if (hasGemini) order.push('gemini');
  if (hasGroq) order.push('groq');
  return order;
}

async function callGroqChat(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  expectJson: boolean,
): Promise<string> {
  const url = `${config.groqBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.groqModel,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  if (expectJson) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Groq HTTP ${response.status}: ${text || response.statusText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned empty completion content.');
  }
  return content;
}

export async function generateStructuredWithProvider<T>(
  request: StructuredLlmRequest<T>,
  options: { forceLive?: boolean } = {},
): Promise<LlmResult<T> | null> {
  if (!options.forceLive && !isLiveLlmEnabled()) {
    return null;
  }

  const providers = getProviderOrder();
  const temperature = request.temperature ?? 0.3;

  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        const model = new ChatGoogleGenerativeAI({
          model: config.geminiModel,
          apiKey: config.geminiApiKey,
          temperature,
        }).withStructuredOutput(request.schema);

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', '{systemPrompt}'],
          ['human', '{userPrompt}'],
        ]);
        const messages = await prompt.invoke({
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
        });
        const response = await model.invoke(messages);
        const parsed = request.schema.parse(response);
        return {
          data: parsed,
          provider: 'gemini',
          model: config.geminiModel,
        };
      }

      if (provider === 'groq') {
        const raw = await callGroqChat(
          `${request.systemPrompt}\nRespond strictly with valid JSON.`,
          request.userPrompt,
          temperature,
          true,
        );
        const parsedJson = JSON.parse(raw) as unknown;
        const parsed = request.schema.parse(parsedJson);
        return {
          data: parsed,
          provider: 'groq',
          model: config.groqModel,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`LLM provider (${provider}) failed for structured output; trying next fallback.`, {
        message,
      });
    }
  }

  return null;
}

export async function generateTextWithProvider(
  request: TextLlmRequest,
  options: { forceLive?: boolean } = {},
): Promise<LlmResult<string> | null> {
  if (!options.forceLive && !isLiveLlmEnabled()) {
    return null;
  }

  const providers = getProviderOrder();
  const temperature = request.temperature ?? 0.2;

  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        const model = new ChatGoogleGenerativeAI({
          model: config.geminiModel,
          apiKey: config.geminiApiKey,
          temperature,
        });
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', '{systemPrompt}'],
          ['human', '{userPrompt}'],
        ]);
        const messages = await prompt.invoke({
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
        });
        const response = await model.invoke(messages);
        const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        if (text.trim()) {
          return {
            data: text.trim(),
            provider: 'gemini',
            model: config.geminiModel,
          };
        }
      }

      if (provider === 'groq') {
        const text = await callGroqChat(request.systemPrompt, request.userPrompt, temperature, false);
        if (text.trim()) {
          return {
            data: text.trim(),
            provider: 'groq',
            model: config.groqModel,
          };
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`LLM provider (${provider}) failed for text generation; trying next fallback.`, {
        message,
      });
    }
  }

  return null;
}

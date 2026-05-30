import { SYSTEM_PROMPT, buildUserPrompt, MAX_OUTPUT_TOKENS } from '@/lib/ai/prompt-builder';
import { GeneratedPlanSchema } from '@/lib/schemas/plan';
import { extractJson, type GenerationResult } from '@/lib/ai/anthropic-client';
import type { WizardInput } from '@/lib/schemas';
import type { PlanProvider, ProviderOptions } from './index';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_ATTEMPTS = 2;

type OpenAIResponse = {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
};

async function callGroq(
  userPrompt: string,
  apiKey: string,
  timeout: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Groq API ${res.status}: ${errBody}`);
    }

    const json = (await res.json()) as OpenAIResponse;
    return {
      text: json.choices[0]?.message.content ?? '',
      inputTokens: json.usage.prompt_tokens,
      outputTokens: json.usage.completion_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const groqProvider: PlanProvider = {
  isAvailable() {
    return Boolean(process.env.GROQ_API_KEY);
  },

  async generatePlan(input: WizardInput, opts?: ProviderOptions): Promise<GenerationResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'Groq API key not configured',
        stage: 'api',
        durationMs: 0,
        attempts: 0,
        metadata: { strategy: 'single', batches: 0, total_attempts: 0 },
      };
    }

    const timeout = opts?.timeout ?? 50_000;
    const start = Date.now();
    const userPrompt = buildUserPrompt(input);
    const usage = { input_tokens: 0, output_tokens: 0 };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let text: string;
      try {
        const resp = await callGroq(userPrompt, apiKey, timeout);
        text = resp.text;
        usage.input_tokens += resp.inputTokens;
        usage.output_tokens += resp.outputTokens;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          stage: 'api',
          durationMs: Date.now() - start,
          attempts: attempt,
          metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
        };
      }

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            stage: 'json_parse',
            durationMs: Date.now() - start,
            attempts: attempt,
            metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
          };
        }
        continue;
      }

      const zodResult = GeneratedPlanSchema.safeParse(parsed);
      if (!zodResult.success) {
        if (attempt >= MAX_ATTEMPTS) {
          return {
            success: false,
            error: zodResult.error.message,
            stage: 'schema',
            durationMs: Date.now() - start,
            attempts: attempt,
            metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
          };
        }
        continue;
      }

      return {
        success: true,
        plan: zodResult.data,
        usage,
        durationMs: Date.now() - start,
        attempts: attempt,
        metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
      };
    }

    /* v8 ignore next 2 */
    throw new Error('unreachable');
  },
};

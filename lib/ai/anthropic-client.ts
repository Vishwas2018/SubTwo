import Anthropic from '@anthropic-ai/sdk';
import { GeneratedPlanSchema, type GeneratedPlan } from '@/lib/schemas/plan';
import { validatePlan, type PlanInput } from '@/lib/plan-validators';
import { SYSTEM_PROMPT, buildUserPrompt, MAX_OUTPUT_TOKENS } from './prompt-builder';
import type { WizardInput } from '@/lib/schemas';

// ─── Public types ─────────────────────────────────────────────────────────────

export type GenerationResult =
  | {
      success: true;
      plan: GeneratedPlan;
      usage: { input_tokens: number; output_tokens: number };
      durationMs: number;
      attempts: number;
    }
  | {
      success: false;
      error: string;
      stage: 'api' | 'json_parse' | 'schema' | 'business_rules';
      durationMs: number;
      attempts: number;
    };

// Minimal injectable interface so tests never touch the network
export type AnthropicResponse = {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
};

type MessagesCreate = (params: {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}) => Promise<AnthropicResponse>;

export type ClientLike = { messages: { create: MessagesCreate } };

export type AnthropicClientOptions = {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  client?: ClientLike;
};

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generatePlan(
  input: WizardInput,
  opts: AnthropicClientOptions = {},
): Promise<GenerationResult> {
  const start = Date.now();
  const maxRetries = opts.maxRetries ?? 2;
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4';

  const client: ClientLike =
    opts.client ??
    new Anthropic({
      apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
      ...(opts.fetchImpl ? { fetch: opts.fetchImpl } : {}),
    });

  const usage = { input_tokens: 0, output_tokens: 0 };
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: buildUserPrompt(input) },
  ];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    // ── API call ────────────────────────────────────────────────────────────
    let rawText: string;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      });
      const block = response.content[0];
      rawText = block?.type === 'text' && block.text !== undefined ? block.text : '';
      usage.input_tokens += response.usage.input_tokens;
      usage.output_tokens += response.usage.output_tokens;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        stage: 'api',
        durationMs: Date.now() - start,
        attempts: attempt,
      };
    }

    // ── JSON parse ──────────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch (err) {
      if (attempt > maxRetries) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          stage: 'json_parse',
          durationMs: Date.now() - start,
          attempts: attempt,
        };
      }
      messages.push({ role: 'assistant', content: rawText });
      messages.push({
        role: 'user',
        content: `Previous output failed JSON parsing: ${err instanceof Error ? err.message : String(err)}. Return corrected JSON only.`,
      });
      continue;
    }

    // ── Zod schema ──────────────────────────────────────────────────────────
    const zodResult = GeneratedPlanSchema.safeParse(parsed);
    if (!zodResult.success) {
      const errorMsg = zodResult.error.message;
      if (attempt > maxRetries) {
        return {
          success: false,
          error: errorMsg,
          stage: 'schema',
          durationMs: Date.now() - start,
          attempts: attempt,
        };
      }
      messages.push({ role: 'assistant', content: rawText });
      messages.push({
        role: 'user',
        content: `Previous output failed schema validation: ${errorMsg}. Return corrected JSON only.`,
      });
      continue;
    }

    // ── Business rules ──────────────────────────────────────────────────────
    const plan = zodResult.data;
    const planInput = toPlanInput(plan, input.experience_level);
    const validation = validatePlan(planInput);
    const errors = validation.issues.filter((i) => i.severity === 'error');

    if (errors.length > 0) {
      const errorMsg = errors.map((i) => i.message).join('; ');
      if (attempt > maxRetries) {
        return {
          success: false,
          error: errorMsg,
          stage: 'business_rules',
          durationMs: Date.now() - start,
          attempts: attempt,
        };
      }
      messages.push({ role: 'assistant', content: rawText });
      messages.push({
        role: 'user',
        content: `Previous output failed business rule validation: ${errorMsg}. Return corrected JSON only.`,
      });
      continue;
    }

    return {
      success: true,
      plan,
      usage,
      durationMs: Date.now() - start,
      attempts: attempt,
    };
  }

  /* v8 ignore next 2 */
  // TypeScript narrowing — loop above always returns or continues
  throw new Error('unreachable');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenceMatch ? fenceMatch[1]!.trim() : trimmed;

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in response');
  }

  const jsonStr = candidate.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function toPlanInput(plan: GeneratedPlan, experienceLevel: WizardInput['experience_level']): PlanInput {
  const sessions: PlanInput['sessions'] = plan.weeks.flatMap((week) =>
    week.sessions.map((s) => ({
      week_number: s.week_number,
      day_of_week: s.day_of_week,
      session_type: s.session_type,
      distance_km: s.distance_km,
      target_pace_seconds_per_km: s.target_pace_seconds_per_km,
    })),
  );
  return { experience_level: experienceLevel, sessions };
}

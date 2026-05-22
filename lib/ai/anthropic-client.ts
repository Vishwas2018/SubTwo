import Anthropic from '@anthropic-ai/sdk';
import {
  GeneratedPlanSchema,
  PlanSkeletonSchema,
  WeekBatchSchema,
  type GeneratedPlan,
  type PlanSkeleton,
} from '@/lib/schemas/plan';
import { validatePlan, type PlanInput } from '@/lib/plan-validators';
import {
  SYSTEM_PROMPT,
  SKELETON_SYSTEM_PROMPT,
  BATCH_SYSTEM_PROMPT,
  buildUserPrompt,
  buildSkeletonPrompt,
  buildBatchPrompt,
  computeTotalWeeks,
  MAX_OUTPUT_TOKENS,
} from './prompt-builder';
import type { WizardInput } from '@/lib/schemas';

// ─── Pricing ──────────────────────────────────────────────────────────────────

export const SONNET_PRICING = { input_per_mtok: 3, output_per_mtok: 15 } as const;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * SONNET_PRICING.input_per_mtok +
    (outputTokens / 1_000_000) * SONNET_PRICING.output_per_mtok
  );
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type GenerationMetadata = {
  strategy: 'single' | 'batch';
  batches: number;
  total_attempts: number;
};

export type GenerationResult =
  | {
      success: true;
      plan: GeneratedPlan;
      usage: { input_tokens: number; output_tokens: number };
      durationMs: number;
      attempts: number;
      metadata: GenerationMetadata;
    }
  | {
      success: false;
      error: string;
      stage: 'api' | 'json_parse' | 'schema' | 'business_rules';
      durationMs: number;
      attempts: number;
      metadata: GenerationMetadata;
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
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const maxRetries = opts.maxRetries ?? 2;
  const client: ClientLike =
    opts.client ??
    new Anthropic({
      apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
      ...(opts.fetchImpl ? { fetch: opts.fetchImpl } : {}),
    });

  const totalWeeks = computeTotalWeeks(input);

  if (totalWeeks > 12) {
    return generatePlanBatch(input, { start, model, maxRetries, client });
  }
  return generatePlanSingle(input, { start, model, maxRetries, client });
}

// ─── Internal context ─────────────────────────────────────────────────────────

type InternalCtx = { start: number; model: string; maxRetries: number; client: ClientLike };

// ─── Single-call path (≤12 weeks) ─────────────────────────────────────────────

async function generatePlanSingle(input: WizardInput, ctx: InternalCtx): Promise<GenerationResult> {
  const { start, model, maxRetries, client } = ctx;
  const usage = { input_tokens: 0, output_tokens: 0 };
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: buildUserPrompt(input) },
  ];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
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
        metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
      };
    }

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
          metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
        };
      }
      messages.push({ role: 'assistant', content: rawText });
      messages.push({
        role: 'user',
        content: `Previous output failed JSON parsing: ${err instanceof Error ? err.message : String(err)}. Return corrected JSON only.`,
      });
      continue;
    }

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
          metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
        };
      }
      messages.push({ role: 'assistant', content: rawText });
      messages.push({
        role: 'user',
        content: `Previous output failed schema validation: ${errorMsg}. Return corrected JSON only.`,
      });
      continue;
    }

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
          metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
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
      metadata: { strategy: 'single', batches: 0, total_attempts: attempt },
    };
  }

  /* v8 ignore next 2 */
  throw new Error('unreachable');
}

// ─── Batch path (>12 weeks) ───────────────────────────────────────────────────

const BATCH_SIZE = 6;

type SkeletonFetch =
  | { ok: true; skeleton: PlanSkeleton; attempts: number }
  | { ok: false; result: GenerationResult; attempts: number };

async function fetchSkeleton(
  input: WizardInput,
  ctx: InternalCtx,
  usage: { input_tokens: number; output_tokens: number },
): Promise<SkeletonFetch> {
  const { model, maxRetries, client, start } = ctx;
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: buildSkeletonPrompt(input) },
  ];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    let rawText: string;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SKELETON_SYSTEM_PROMPT,
        messages,
      });
      const block = response.content[0];
      rawText = block?.type === 'text' && block.text !== undefined ? block.text : '';
      usage.input_tokens += response.usage.input_tokens;
      usage.output_tokens += response.usage.output_tokens;
    } catch (err) {
      return {
        ok: false,
        attempts: attempt,
        result: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          stage: 'api',
          durationMs: Date.now() - start,
          attempts: attempt,
          metadata: { strategy: 'batch', batches: 0, total_attempts: attempt },
        },
      };
    }

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch (err) {
      if (attempt > maxRetries) {
        return {
          ok: false,
          attempts: attempt,
          result: {
            success: false,
            error: `Skeleton JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
            stage: 'json_parse',
            durationMs: Date.now() - start,
            attempts: attempt,
            metadata: { strategy: 'batch', batches: 0, total_attempts: attempt },
          },
        };
      }
      messages.push({ role: 'assistant', content: rawText });
      messages.push({
        role: 'user',
        content: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}. Return corrected JSON only.`,
      });
      continue;
    }

    const zodResult = PlanSkeletonSchema.safeParse(parsed);
    if (!zodResult.success) {
      if (attempt > maxRetries) {
        return {
          ok: false,
          attempts: attempt,
          result: {
            success: false,
            error: `Skeleton schema invalid: ${zodResult.error.message}`,
            stage: 'schema',
            durationMs: Date.now() - start,
            attempts: attempt,
            metadata: { strategy: 'batch', batches: 0, total_attempts: attempt },
          },
        };
      }
      messages.push({ role: 'assistant', content: rawText });
      messages.push({
        role: 'user',
        content: `Schema validation failed: ${zodResult.error.message}. Return corrected JSON only.`,
      });
      continue;
    }

    return { ok: true, skeleton: zodResult.data, attempts: attempt };
  }

  /* v8 ignore next 2 */
  throw new Error('unreachable');
}

type BatchFetch =
  | { ok: true; weeks: GeneratedPlan['weeks']; attempts: number }
  | { ok: false; result: GenerationResult; attempts: number };

async function fetchWeekBatch(
  skeleton: PlanSkeleton,
  batchIndex: number,
  weekRange: { start: number; end: number },
  priorWeekKm: number | null,
  totalAttemptsSoFar: number,
  ctx: InternalCtx,
  usage: { input_tokens: number; output_tokens: number },
): Promise<BatchFetch> {
  const { model, maxRetries, client, start } = ctx;
  const prompt = buildBatchPrompt(skeleton, weekRange, priorWeekKm);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const totalAttempts = totalAttemptsSoFar + attempt;
    let rawText: string;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: BATCH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content[0];
      rawText = block?.type === 'text' && block.text !== undefined ? block.text : '';
      usage.input_tokens += response.usage.input_tokens;
      usage.output_tokens += response.usage.output_tokens;
    } catch (err) {
      if (attempt > maxRetries) {
        return {
          ok: false,
          attempts: attempt,
          result: {
            success: false,
            error: `Batch ${batchIndex + 1} API error: ${err instanceof Error ? err.message : String(err)}`,
            stage: 'api',
            durationMs: Date.now() - start,
            attempts: totalAttempts,
            metadata: { strategy: 'batch', batches: batchIndex, total_attempts: totalAttempts },
          },
        };
      }
      continue;
    }

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch {
      if (attempt > maxRetries) {
        return {
          ok: false,
          attempts: attempt,
          result: {
            success: false,
            error: `Batch ${batchIndex + 1} JSON parse failed after ${attempt} attempts`,
            stage: 'json_parse',
            durationMs: Date.now() - start,
            attempts: totalAttempts,
            metadata: { strategy: 'batch', batches: batchIndex, total_attempts: totalAttempts },
          },
        };
      }
      continue;
    }

    const zodResult = WeekBatchSchema.safeParse(parsed);
    if (!zodResult.success) {
      if (attempt > maxRetries) {
        return {
          ok: false,
          attempts: attempt,
          result: {
            success: false,
            error: `Batch ${batchIndex + 1} schema invalid: ${zodResult.error.message}`,
            stage: 'schema',
            durationMs: Date.now() - start,
            attempts: totalAttempts,
            metadata: { strategy: 'batch', batches: batchIndex, total_attempts: totalAttempts },
          },
        };
      }
      continue;
    }

    return { ok: true, weeks: zodResult.data.weeks, attempts: attempt };
  }

  /* v8 ignore next 2 */
  throw new Error('unreachable');
}

async function generatePlanBatch(input: WizardInput, ctx: InternalCtx): Promise<GenerationResult> {
  const { start } = ctx;
  const usage = { input_tokens: 0, output_tokens: 0 };
  let totalAttempts = 0;

  // Phase A: skeleton
  const skeletonFetch = await fetchSkeleton(input, ctx, usage);
  totalAttempts += skeletonFetch.attempts;
  if (!skeletonFetch.ok) {
    return { ...skeletonFetch.result, attempts: totalAttempts };
  }
  const skeleton = skeletonFetch.skeleton;
  const numBatches = Math.ceil(skeleton.total_weeks / BATCH_SIZE);

  // Phase B: session batches (sequential)
  const allWeeks: GeneratedPlan['weeks'] = [];
  for (let b = 0; b < numBatches; b++) {
    const batchStart = b * BATCH_SIZE + 1;
    const batchEnd = Math.min((b + 1) * BATCH_SIZE, skeleton.total_weeks);
    const priorWeekKm = allWeeks.length > 0 ? allWeeks[allWeeks.length - 1]!.total_km : null;

    const batchFetch = await fetchWeekBatch(
      skeleton,
      b,
      { start: batchStart, end: batchEnd },
      priorWeekKm,
      totalAttempts,
      ctx,
      usage,
    );
    totalAttempts += batchFetch.attempts;
    if (!batchFetch.ok) {
      return { ...batchFetch.result, attempts: totalAttempts };
    }
    allWeeks.push(...batchFetch.weeks);
  }

  // Assembly + full plan validation
  const assembled: unknown = {
    summary: skeleton.summary,
    pace_zones: skeleton.pace_zones,
    checkpoints: skeleton.checkpoints,
    weeks: allWeeks,
    total_weeks: skeleton.total_weeks,
  };

  const zodResult = GeneratedPlanSchema.safeParse(assembled);
  if (!zodResult.success) {
    return {
      success: false,
      error: `Assembled plan failed schema: ${zodResult.error.message}`,
      stage: 'schema',
      durationMs: Date.now() - start,
      attempts: totalAttempts,
      metadata: { strategy: 'batch', batches: numBatches, total_attempts: totalAttempts },
    };
  }

  const plan = zodResult.data;
  const validation = validatePlan(toPlanInput(plan, input.experience_level));
  const errors = validation.issues.filter((i) => i.severity === 'error');

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.map((i) => i.message).join('; '),
      stage: 'business_rules',
      durationMs: Date.now() - start,
      attempts: totalAttempts,
      metadata: { strategy: 'batch', batches: numBatches, total_attempts: totalAttempts },
    };
  }

  return {
    success: true,
    plan,
    usage,
    durationMs: Date.now() - start,
    attempts: totalAttempts,
    metadata: { strategy: 'batch', batches: numBatches, total_attempts: totalAttempts },
  };
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

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { WizardInputSchema } from '@/lib/schemas';
import { estimateCost } from '@/lib/ai/anthropic-client';
import { checkBudget, maybySendBudgetAlert } from '@/lib/ai/budget';
import { persistGeneratedPlan } from '@/lib/plans/persist';
import { rateLimit } from '@/lib/rate-limit';
import {
  isValidProvider,
  isFreeProvider,
  getProvider,
  type Provider,
} from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(req: Request) {
  const t0 = Date.now();

  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t1 = Date.now();
  Sentry.addBreadcrumb({ category: 'generate', message: 'auth', data: { ms: t1 - t0 }, level: 'info' });

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 },
    );
  }

  // 2. Parse body — extract provider before wizard schema validation
  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid JSON body.' } },
      { status: 422 },
    );
  }

  const { provider: providerRaw, ...wizardBodyRaw } = rawBody;
  const requestedProvider: Provider = isValidProvider(providerRaw) ? providerRaw : 'claude';

  // 3. Validate wizard input (provider field already stripped)
  const parsed = WizardInputSchema.safeParse(wizardBodyRaw);
  const t3 = Date.now();
  Sentry.addBreadcrumb({ category: 'generate', message: 'validate', data: { ms: t3 - t1 }, level: 'info' });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: 'Invalid wizard input.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }
  const wizardInput = parsed.data;

  // 4. Per-provider distributed rate limit
  const limiterName = isFreeProvider(requestedProvider) ? 'free_ai_generation' : 'ai_generation';
  const rateLimitKey = isFreeProvider(requestedProvider)
    ? `free_ai:${user.id}`
    : `ai:${user.id}`;
  const aiLimit = await rateLimit(rateLimitKey, limiterName);
  const t4 = Date.now();
  Sentry.addBreadcrumb({ category: 'generate', message: 'rate_limit', data: { ms: t4 - t3, provider: requestedProvider }, level: 'info' });

  if (!aiLimit.allowed) {
    const providerLabel = requestedProvider === 'claude' ? 'Claude' : requestedProvider === 'groq' ? 'Groq' : 'Qwen';
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: `${providerLabel} rate limit exceeded. Try again later.`,
          retry_after: Math.ceil((aiLimit.reset - Date.now()) / 1000),
        },
      },
      { status: 429 },
    );
  }

  // 5. Quota check (DB-level, applies to all providers)
  const { data: quota, error: quotaErr } = await supabase.rpc('check_ai_quota', {
    p_user_id: user.id,
  });
  const t5 = Date.now();
  Sentry.addBreadcrumb({ category: 'generate', message: 'quota_check', data: { ms: t5 - t4 }, level: 'info' });

  if (quotaErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Quota check failed.' } },
      { status: 500 },
    );
  }

  const quotaResult = quota as {
    allowed: boolean;
    lifetime_used: number;
    lifetime_cap: number;
    daily_used: number;
    daily_cap: number;
    reason: string | null;
  };

  if (!quotaResult.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'quota_exhausted',
          message: quotaResult.reason ?? 'AI generation quota exceeded.',
          details: {
            lifetime_used: quotaResult.lifetime_used,
            lifetime_cap: quotaResult.lifetime_cap,
            daily_used: quotaResult.daily_used,
            daily_cap: quotaResult.daily_cap,
          },
        },
      },
      { status: 429 },
    );
  }

  // 6. Global AI budget check — only for Claude (free providers cost $0)
  if (!isFreeProvider(requestedProvider)) {
    try {
      const budget = await checkBudget();
      if (budget.hard_exceeded) {
        await maybySendBudgetAlert('hard', budget.month_spend);
        return NextResponse.json(
          { error: { code: 'ai_budget_exceeded', message: 'Generation temporarily unavailable.' } },
          { status: 503 },
        );
      }
      if (budget.soft_exceeded) {
        void maybySendBudgetAlert('soft', budget.month_spend);
      }
    } catch {
      // fail-open: budget check is best-effort
    }
  }
  const t6 = Date.now();
  Sentry.addBreadcrumb({
    category: 'generate',
    message: 'budget_check',
    data: { ms: t6 - t5, pre_ai_ms: t6 - t0 },
    level: 'info',
  });

  // 7. Generate plan — try requested provider, fall back to Claude on failure
  const elapsed = t6 - t0;
  const sdkTimeout = Math.max(10_000, 55_000 - elapsed);

  let result = await (await getProvider(requestedProvider)).generatePlan(wizardInput, { timeout: sdkTimeout });
  let actualProvider: Provider = requestedProvider;

  // Fallback to Claude if free provider failed
  if (!result.success && isFreeProvider(requestedProvider)) {
    console.log(
      JSON.stringify({
        event: 'generate.fallback',
        from: requestedProvider,
        to: 'claude',
        error: result.error,
        stage: result.stage,
      }),
    );
    Sentry.addBreadcrumb({
      category: 'generate',
      message: 'provider_fallback',
      data: { from: requestedProvider, to: 'claude', stage: result.stage },
      level: 'warning',
    });
    const fallbackElapsed = Date.now() - t0;
    const fallbackTimeout = Math.max(10_000, 55_000 - fallbackElapsed);
    result = await (await getProvider('claude')).generatePlan(wizardInput, { timeout: fallbackTimeout });
    actualProvider = 'claude';
  }

  const t7 = Date.now();
  const durationMs = t7 - t6;
  Sentry.addBreadcrumb({
    category: 'generate',
    message: 'sdk_call',
    data: { ms: durationMs, provider: actualProvider, requested: requestedProvider, strategy: result.metadata.strategy },
    level: 'info',
  });

  const serviceClient = createServiceClient();

  // 8. Log ai_generations row
  const costUsd =
    result.success && actualProvider === 'claude'
      ? estimateCost(result.usage.input_tokens, result.usage.output_tokens)
      : 0;

  const modelLabel =
    actualProvider === 'claude'
      ? (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6')
      : actualProvider === 'groq'
      ? 'llama-3.3-70b-versatile'
      : 'qwen-plus';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genInsert: any = {
    user_id: user.id,
    purpose: 'initial_plan',
    model: modelLabel,
    provider: actualProvider, // column added in migration 029; types regenerated post-migration
    input_tokens: result.success ? result.usage.input_tokens : null,
    output_tokens: result.success ? result.usage.output_tokens : null,
    estimated_cost_usd: result.success ? costUsd : null,
    success: result.success,
    error_message: result.success
      ? requestedProvider !== actualProvider
        ? `Fell back from ${requestedProvider} to ${actualProvider}`
        : null
      : result.error,
    duration_ms: durationMs,
  };

  const { data: genRow, error: genErr } = await serviceClient
    .from('ai_generations')
    .insert(genInsert)
    .select('id')
    .single();
  const t8 = Date.now();
  Sentry.addBreadcrumb({ category: 'generate', message: 'db_log', data: { ms: t8 - t7 }, level: 'info' });

  if (genErr || !genRow) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to log generation.' } },
      { status: 500 },
    );
  }

  // 9. If generation failed → 502
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: 'integration_error',
          message: 'Plan generation failed. Please try again.',
        },
      },
      { status: 502 },
    );
  }

  // 10. Persist plan atomically
  let persisted: { planId: string; versionId: string; sessionCount: number };
  try {
    persisted = await persistGeneratedPlan({
      userId: user.id,
      wizardInput,
      generated: result.plan,
      generationId: genRow.id as string,
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'server_error',
          message: 'Failed to save plan. Please try again.',
        },
      },
      { status: 500 },
    );
  }
  const t9 = Date.now();
  const totalMs = t9 - t0;
  Sentry.addBreadcrumb({
    category: 'generate',
    message: 'persist',
    data: { ms: t9 - t8, total_ms: totalMs },
    level: 'info',
  });

  console.log(
    JSON.stringify({
      event: 'generate.timing',
      auth_ms: t1 - t0,
      validate_ms: t3 - t1,
      rate_limit_ms: t4 - t3,
      quota_ms: t5 - t4,
      budget_ms: t6 - t5,
      pre_ai_ms: t6 - t0,
      sdk_ms: durationMs,
      db_log_ms: t8 - t7,
      persist_ms: t9 - t8,
      total_ms: totalMs,
      provider: actualProvider,
      requested_provider: requestedProvider,
    }),
  );

  return NextResponse.json(
    {
      data: {
        plan_id: persisted.planId,
        version_id: persisted.versionId,
        weeks: result.plan.weeks,
        pace_zones: result.plan.pace_zones,
        checkpoints: result.plan.checkpoints,
        ai_metadata: {
          model: modelLabel,
          provider: actualProvider,
          duration_ms: durationMs,
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          estimated_cost_usd: costUsd,
        },
      },
    },
    { status: 201 },
  );
}

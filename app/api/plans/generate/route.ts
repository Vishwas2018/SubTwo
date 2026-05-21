import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { WizardInputSchema } from '@/lib/schemas';
import { generatePlan, estimateCost } from '@/lib/ai/anthropic-client';
import { persistGeneratedPlan } from '@/lib/plans/persist';

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 },
    );
  }

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid JSON body.' } },
      { status: 422 },
    );
  }

  const parsed = WizardInputSchema.safeParse(body);
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

  // 3. Quota check (uses authenticated client — RLS aware)
  const { data: quota, error: quotaErr } = await supabase.rpc('check_ai_quota', {
    p_user_id: user.id,
  });

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

  // 4. Generate plan
  const start = Date.now();
  const result = await generatePlan(wizardInput);
  const durationMs = Date.now() - start;

  const serviceClient = createServiceClient();

  // 5. Log ai_generations row (service role bypasses RLS)
  const costUsd =
    result.success
      ? estimateCost(result.usage.input_tokens, result.usage.output_tokens)
      : 0;

  const { data: genRow, error: genErr } = await serviceClient
    .from('ai_generations')
    .insert({
      user_id: user.id,
      purpose: 'initial_plan',
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      input_tokens: result.success ? result.usage.input_tokens : null,
      output_tokens: result.success ? result.usage.output_tokens : null,
      estimated_cost_usd: result.success ? costUsd : null,
      success: result.success,
      error_message: result.success ? null : result.error,
      duration_ms: durationMs,
    })
    .select('id')
    .single();

  if (genErr || !genRow) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to log generation.' } },
      { status: 500 },
    );
  }

  // 6. If generation failed → 502 (not counted toward quota — only success=true rows count)
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

  // 7. Persist plan atomically
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

  // 8. Increment profiles.ai_generation_count (best-effort; non-fatal)
  await serviceClient
    .from('profiles')
    .update({ ai_generation_count: (quotaResult.lifetime_used ?? 0) + 1 })
    .eq('id', user.id);

  // 9. Return 201
  return NextResponse.json(
    {
      data: {
        plan_id: persisted.planId,
        version_id: persisted.versionId,
        weeks: result.plan.weeks,
        pace_zones: result.plan.pace_zones,
        checkpoints: result.plan.checkpoints,
        ai_metadata: {
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
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

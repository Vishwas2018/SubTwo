import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { WizardInputSchema } from '@/lib/schemas';
import { generatePlan, estimateCost } from '@/lib/ai/anthropic-client';
import { rateLimit } from '@/lib/rate-limit';

type QuotaResult = {
  allowed: boolean;
  lifetime_used: number;
  lifetime_cap: number;
  daily_used: number;
  daily_cap: number;
  reason: string | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  // Distributed AI rate limit (complements DB quota)
  const aiLimit = await rateLimit(`ai:${user.id}`, 'ai_generation');
  if (!aiLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'AI generation rate limit exceeded. Try again later.',
          retry_after: Math.ceil((aiLimit.reset - Date.now()) / 1000),
        },
      },
      { status: 429 },
    );
  }

  // Fetch plan to verify ownership and get baseline_data
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, user_id, baseline_data')
    .eq('id', id)
    .single();

  if (planErr || !plan || plan.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Plan not found.' } },
      { status: 404 },
    );
  }

  // Parse wizard input from stored baseline_data
  const wizardParsed = WizardInputSchema.safeParse(plan.baseline_data);
  if (!wizardParsed.success) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Invalid baseline data.' } },
      { status: 500 },
    );
  }
  const wizardInput = wizardParsed.data;

  // Quota check (authenticated client — RLS aware)
  const { data: quota, error: quotaErr } = await supabase.rpc('check_ai_quota', {
    p_user_id: user.id,
  });

  if (quotaErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Quota check failed.' } },
      { status: 500 },
    );
  }

  const quotaResult = quota as QuotaResult;
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

  // Optional reason from request body (non-fatal if missing/invalid)
  let reason: string | null = null;
  try {
    const body = (await req.json()) as { reason?: string };
    reason = body.reason?.trim() ?? null;
  } catch {
    // body is optional
  }

  // Generate new plan
  const start = Date.now();
  const result = await generatePlan(wizardInput);
  const durationMs = Date.now() - start;

  const serviceClient = createServiceClient();
  const costUsd = result.success
    ? estimateCost(result.usage.input_tokens, result.usage.output_tokens)
    : 0;

  // Log ai_generations row
  const { data: genRow, error: genErr } = await serviceClient
    .from('ai_generations')
    .insert({
      user_id: user.id,
      purpose: 'regen_full',
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

  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'integration_error', message: 'Plan generation failed. Please try again.' } },
      { status: 502 },
    );
  }

  // Add new plan version via migration 022 RPC (typed via database.types.ts)
  const { data: versionData, error: versionErr } = await serviceClient.rpc('create_plan_version', {
    p_plan_id: id,
    p_plan: result.plan as unknown as import('@/types/database.types').Json,
    p_generation_id: genRow.id,
  });

  if (versionErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to save new version.' } },
      { status: 500 },
    );
  }

  const vd = versionData as { plan_id: string; version_id: string; version_number: number };

  // Best-effort: store regeneration reason on the new plan_version
  if (reason) {
    await serviceClient
      .from('plan_versions')
      .update({ reason })
      .eq('id', vd.version_id);
  }

  // NOTE: ai_generation_count column is deprecated; check_ai_quota derives the
  // authoritative count via COUNT(*) from ai_generations. No increment needed.

  return NextResponse.json({
    data: {
      plan_id: vd.plan_id,
      version_id: vd.version_id,
      version_number: vd.version_number,
    },
  });
}

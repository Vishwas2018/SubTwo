import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { GeneratedPlan } from '@/lib/schemas/plan';

type QuotaResult = {
  allowed: boolean;
  lifetime_used: number;
  lifetime_cap: number;
  daily_used: number;
  daily_cap: number;
};

export async function GET(
  _req: Request,
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

  // Fetch plan
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single();

  if (planErr || !plan) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Plan not found.' } },
      { status: 404 },
    );
  }

  // Ownership check (belt-and-suspenders over RLS)
  if (plan.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Plan not found.' } },
      { status: 404 },
    );
  }

  // Fetch current version via service client (bypasses RLS on plan_versions)
  const serviceClient = createServiceClient();
  const { data: version, error: verErr } = await serviceClient
    .from('plan_versions')
    .select('id, version_number, raw_plan_json')
    .eq('id', plan.current_version_id ?? '')
    .single();

  if (verErr || !version) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Could not load plan version.' } },
      { status: 500 },
    );
  }

  // Quota — how many regenerations remain
  const { data: quota } = await supabase.rpc('check_ai_quota', { p_user_id: user.id });
  const q = quota as QuotaResult | null;

  return NextResponse.json({
    data: {
      id: plan.id,
      status: plan.status,
      race_distance_km: Number(plan.race_distance_km),
      race_name: plan.race_name ?? null,
      race_date: plan.race_date,
      start_date: plan.start_date,
      total_weeks: plan.total_weeks,
      experience_level: plan.experience_level,
      goal_time_seconds: plan.goal_time_seconds ?? null,
      version_id: version.id,
      version_number: version.version_number,
      generated_plan: version.raw_plan_json as GeneratedPlan,
      quota: {
        allowed: q?.allowed ?? false,
        lifetime_remaining: q ? q.lifetime_cap - q.lifetime_used : 0,
        daily_remaining: q ? q.daily_cap - q.daily_used : 0,
      },
    },
  });
}

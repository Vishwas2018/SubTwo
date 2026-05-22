import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { computeVerdict, recommendedAction } from '@/lib/checkpoint-logic';
import type { Database } from '@/types/database.types';

type CheckpointSpec = {
  week: number;
  type: string;
  target_seconds: number;
  target_distance_km: number;
};

type RawPlanJson = Database['public']['Tables']['plan_versions']['Row']['raw_plan_json'];

function parseCheckpointSpecs(raw: RawPlanJson): CheckpointSpec[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj['checkpoints'])) return [];
  return (obj['checkpoints'] as unknown[]).filter(
    (c): c is CheckpointSpec =>
      !!c &&
      typeof c === 'object' &&
      typeof (c as Record<string, unknown>)['week'] === 'number' &&
      typeof (c as Record<string, unknown>)['type'] === 'string' &&
      typeof (c as Record<string, unknown>)['target_seconds'] === 'number' &&
      typeof (c as Record<string, unknown>)['target_distance_km'] === 'number',
  );
}

const PostBodySchema = z.object({
  checkpoint_type: z.string().trim().min(1).max(100),
  actual_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  result_seconds: z.number().int().min(1).max(86400),
  run_id: z.string().uuid().optional(),
  athlete_notes: z.string().trim().max(500).optional(),
});

export async function GET() {
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

  const { data: plan } = await supabase
    .from('plans')
    .select('id, race_date, race_name, race_distance_km, total_weeks, current_version_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ data: { plan: null, specs: [] } });
  }

  let specs: CheckpointSpec[] = [];
  if (plan.current_version_id) {
    const { data: version } = await supabase
      .from('plan_versions')
      .select('raw_plan_json')
      .eq('id', plan.current_version_id)
      .single();
    if (version) {
      specs = parseCheckpointSpecs(version.raw_plan_json);
    }
  }

  const { data: completed } = await supabase
    .from('checkpoints')
    .select('*')
    .eq('plan_id', plan.id)
    .order('created_at', { ascending: false });

  // Map each spec to its latest completed checkpoint (if any)
  const enriched = specs.map((spec) => {
    const match = (completed ?? []).find((c) => c.checkpoint_type === spec.type) ?? null;
    return { spec, completed: match };
  });

  return NextResponse.json({
    data: {
      plan: {
        id: plan.id,
        race_date: plan.race_date,
        race_name: plan.race_name,
        race_distance_km: plan.race_distance_km,
        total_weeks: plan.total_weeks,
      },
      specs: enriched,
    },
  });
}

export async function POST(req: Request) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid JSON body.' } },
      { status: 422 },
    );
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid checkpoint data.', details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const input = parsed.data;

  const { data: plan } = await supabase
    .from('plans')
    .select('id, race_date, total_weeks, current_version_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'No active plan found.' } },
      { status: 404 },
    );
  }

  // Derive target_seconds from plan spec
  let target_seconds = 0;
  let target_week = 0;
  if (plan.current_version_id) {
    const { data: version } = await supabase
      .from('plan_versions')
      .select('raw_plan_json')
      .eq('id', plan.current_version_id)
      .single();
    if (version) {
      const specs = parseCheckpointSpecs(version.raw_plan_json);
      const match = specs.find((s) => s.type === input.checkpoint_type);
      if (match) {
        target_seconds = match.target_seconds;
        target_week = match.week;
      }
    }
  }

  if (!target_seconds) {
    return NextResponse.json(
      { error: { code: 'not_found', message: `No checkpoint spec found for type: ${input.checkpoint_type}` } },
      { status: 404 },
    );
  }

  // Deviation: positive = faster than target (good), negative = slower (behind)
  const pct_deviation = ((target_seconds - input.result_seconds) / target_seconds) * 100;
  const verdict = computeVerdict(pct_deviation);

  // Weeks to race from actual_date
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksToRace = Math.max(
    0,
    Math.ceil((new Date(plan.race_date).getTime() - new Date(input.actual_date).getTime()) / msPerWeek),
  );
  const action = recommendedAction(verdict, weeksToRace);

  const serviceClient = createServiceClient();
  const { data: checkpoint, error: insertErr } = await serviceClient
    .from('checkpoints')
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      checkpoint_type: input.checkpoint_type,
      target_week,
      actual_date: input.actual_date,
      result_seconds: input.result_seconds,
      target_seconds,
      verdict,
      pct_deviation,
      recommended_action: action,
      run_id: input.run_id ?? null,
      athlete_notes: input.athlete_notes ?? null,
    })
    .select('id, verdict, pct_deviation, recommended_action')
    .single();

  if (insertErr || !checkpoint) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to save checkpoint.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: checkpoint }, { status: 201 });
}

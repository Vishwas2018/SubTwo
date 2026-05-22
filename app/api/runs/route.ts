import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { RunInputSchema } from '@/lib/schemas';
import { rateLimit } from '@/lib/rate-limit';

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

  const rl = await rateLimit(`write:${user.id}`, 'api_write');
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Slow down.',
          retry_after: Math.ceil((rl.reset - Date.now()) / 1000),
        },
      },
      { status: 429 },
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

  const parsed = RunInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: 'Invalid run data.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const durationSec = input.duration_seconds;
  const distKm = input.distance_km;
  // avg_pace_seconds is a GENERATED ALWAYS column — Postgres computes it automatically

  const serviceClient = createServiceClient();
  const { data: run, error: insertErr } = await serviceClient
    .from('runs')
    .insert({
      user_id: user.id,
      source: 'manual',
      run_date: input.run_date,
      distance_km: distKm,
      duration_seconds: durationSec,
      avg_hr: input.avg_hr ?? null,
      max_hr: input.max_hr ?? null,
      elevation_gain_m: input.elevation_gain_m ?? null,
      avg_cadence: input.avg_cadence ?? null,
      rpe: input.rpe ?? null,
      felt_easy: input.felt_easy ?? null,
      stitch_occurred: input.stitch_occurred ?? false,
      stitch_severity: input.stitch_occurred ? (input.stitch_severity ?? null) : null,
      shoes: input.shoes ?? null,
      weather: input.weather ?? null,
      notes: input.notes ?? null,
      planned_session_id: input.planned_session_id ?? null,
    })
    .select('id')
    .single();

  if (insertErr || !run) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to save run.' } },
      { status: 500 },
    );
  }

  const runId = run.id as string;

  // Auto-match to planned session if no explicit link provided
  if (!input.planned_session_id) {
    await supabase.rpc('match_run_to_planned_session', { p_run_id: runId });
  }

  return NextResponse.json({ data: { run_id: runId } }, { status: 201 });
}

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { RunInputSchema } from '@/lib/schemas';
import type { Database } from '@/types/database.types';

type RunUpdate = Database['public']['Tables']['runs']['Update'];
type RouteParams = { params: Promise<{ id: string }> };

async function getOwnedRun(id: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('runs')
    .select('id, user_id, deleted_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!data || data.user_id !== userId) return null;
  return data;
}

export async function PATCH(req: Request, { params }: RouteParams) {
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

  if (!(await getOwnedRun(id, user.id))) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Run not found.' } },
      { status: 404 },
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

  const parsed = RunInputSchema.partial().safeParse(body);
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
  const updatePayload: RunUpdate = {};

  if (input.run_date !== undefined) updatePayload.run_date = input.run_date;
  if (input.distance_km !== undefined) updatePayload.distance_km = input.distance_km;
  if (input.duration_seconds !== undefined) updatePayload.duration_seconds = input.duration_seconds;
  if (input.avg_hr !== undefined) updatePayload.avg_hr = input.avg_hr;
  if (input.max_hr !== undefined) updatePayload.max_hr = input.max_hr;
  if (input.elevation_gain_m !== undefined) updatePayload.elevation_gain_m = input.elevation_gain_m;
  if (input.avg_cadence !== undefined) updatePayload.avg_cadence = input.avg_cadence;
  if (input.rpe !== undefined) updatePayload.rpe = input.rpe;
  if (input.felt_easy !== undefined) updatePayload.felt_easy = input.felt_easy;
  if (input.stitch_occurred !== undefined) updatePayload.stitch_occurred = input.stitch_occurred;
  if (input.stitch_severity !== undefined) updatePayload.stitch_severity = input.stitch_severity;
  if (input.shoes !== undefined) updatePayload.shoes = input.shoes;
  if (input.notes !== undefined) updatePayload.notes = input.notes;
  if (input.planned_session_id !== undefined) updatePayload.planned_session_id = input.planned_session_id;
  if (input.weather !== undefined) updatePayload.weather = input.weather ?? null;

  // avg_pace_seconds is GENERATED ALWAYS — Postgres recomputes it automatically when
  // distance_km or duration_seconds change; do not set it directly.

  const serviceClient = createServiceClient();
  const { error: updateErr } = await serviceClient
    .from('runs')
    .update(updatePayload)
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to update run.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { run_id: id } });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
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

  if (!(await getOwnedRun(id, user.id))) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Run not found.' } },
      { status: 404 },
    );
  }

  const serviceClient = createServiceClient();
  const { error: deleteErr } = await serviceClient
    .from('runs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (deleteErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to delete run.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { deleted: true } });
}

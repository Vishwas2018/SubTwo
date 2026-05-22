import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { CheckinInputSchema } from '@/lib/schemas';

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

  const parsed = CheckinInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: 'Invalid check-in data.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const serviceClient = createServiceClient();

  // UPSERT on (user_id, checkin_date) — unique constraint in daily_checkins table
  const { data: checkin, error: upsertErr } = await serviceClient
    .from('daily_checkins')
    .upsert(
      {
        user_id: user.id,
        checkin_date: input.checkin_date,
        sleep_hours: input.sleep_hours ?? null,
        resting_hr: input.resting_hr ?? null,
        weight_kg: input.weight_kg ?? null,
        energy_1to5: input.energy_1to5 ?? null,
        mood_1to5: input.mood_1to5 ?? null,
        niggle_today: input.niggle_today ?? false,
        notes: input.notes ?? null,
      },
      { onConflict: 'user_id,checkin_date' },
    )
    .select('id')
    .single();

  if (upsertErr || !checkin) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to save check-in.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { checkin_id: checkin.id } }, { status: 201 });
}

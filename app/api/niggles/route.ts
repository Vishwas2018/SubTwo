import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const BODY_PARTS = [
  'knee', 'hip', 'hamstring', 'calf', 'it_band', 'shin', 'foot', 'ankle',
  'glute', 'quad', 'lower_back', 'upper_back', 'shoulder', 'achilles', 'plantar_fascia', 'other',
] as const;

const PostBodySchema = z.object({
  body_part: z.enum(BODY_PARTS),
  severity: z.number().int().min(1).max(10),
  started_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const activeParam = searchParams.get('active');
  // Default: active=true (only unresolved). Pass active=false or all=true for all.
  const activeOnly = searchParams.get('all') !== 'true' && activeParam !== 'false';

  let query = supabase
    .from('niggles')
    .select('*')
    .eq('user_id', user.id)
    .order('started_date', { ascending: false });

  if (activeOnly) {
    query = query.is('resolved_date', null);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to fetch niggles.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
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

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid niggle data.', details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const serviceClient = createServiceClient();

  const { data: niggle, error: insertErr } = await serviceClient
    .from('niggles')
    .insert({
      user_id: user.id,
      body_part: input.body_part,
      severity: input.severity,
      started_date: input.started_date,
      notes: input.notes ?? null,
    })
    .select('id, body_part, severity, started_date, notes')
    .single();

  if (insertErr || !niggle) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to save niggle.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: niggle }, { status: 201 });
}

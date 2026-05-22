import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

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

  const rl = await rateLimit(`export:${user.id}`, 'export');
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Export limit reached. Try again in an hour.',
          retry_after: Math.ceil((rl.reset - Date.now()) / 1000),
        },
      },
      { status: 429 },
    );
  }

  const uid = user.id;

  // Fetch all user-owned data in parallel (RLS ensures ownership)
  const [
    profileRes,
    plansRes,
    sessionsRes,
    runsRes,
    checkinsRes,
    checkpointsRes,
    nigglesRes,
    adjustmentsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('plans').select('*').eq('user_id', uid),
    supabase
      .from('planned_sessions')
      .select('*, plans!inner(user_id)')
      .eq('plans.user_id', uid),
    supabase.from('runs').select('*').eq('user_id', uid).is('deleted_at', null),
    supabase.from('daily_checkins').select('*').eq('user_id', uid),
    supabase.from('checkpoints').select('*').eq('user_id', uid),
    supabase.from('niggles').select('*').eq('user_id', uid),
    supabase
      .from('plan_adjustments')
      .select('*, plans!inner(user_id)')
      .eq('plans.user_id', uid),
  ]);

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user_id: uid,
    profile: profileRes.data ?? null,
    plans: plansRes.data ?? [],
    planned_sessions: (sessionsRes.data ?? []).map(({ plans: _p, ...rest }) => rest),
    runs: runsRes.data ?? [],
    daily_checkins: checkinsRes.data ?? [],
    checkpoints: checkpointsRes.data ?? [],
    niggles: nigglesRes.data ?? [],
    plan_adjustments: (adjustmentsRes.data ?? []).map(({ plans: _p, ...rest }) => rest),
  };

  const json = JSON.stringify(exportPayload, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="subtwo-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}

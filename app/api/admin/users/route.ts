import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/auth/require-admin-api';

export async function GET() {
  const auth = await verifyAdminRequest();
  if (!auth.ok) return auth.response;
  const { svc } = auth;

  const { data: profiles, error } = await svc
    .from('profiles')
    .select('id, email, display_name, is_admin, suspended, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Per-user plan + run counts in one query each
  const { data: planCounts } = await svc
    .from('plans')
    .select('user_id');

  const { data: runCounts } = await svc
    .from('runs')
    .select('user_id');

  const planMap = new Map<string, number>();
  for (const { user_id } of planCounts ?? []) {
    planMap.set(user_id, (planMap.get(user_id) ?? 0) + 1);
  }

  const runMap = new Map<string, number>();
  for (const { user_id } of runCounts ?? []) {
    runMap.set(user_id, (runMap.get(user_id) ?? 0) + 1);
  }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    plan_count: planMap.get(p.id) ?? 0,
    run_count: runMap.get(p.id) ?? 0,
  }));

  return NextResponse.json({ data: users });
}

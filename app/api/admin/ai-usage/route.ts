import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/auth/require-admin-api';
import { SOFT_CAP, HARD_CAP } from '@/lib/ai/budget';

const TOP_N = 10;

export async function GET() {
  const auth = await verifyAdminRequest();
  if (!auth.ok) return auth.response;
  const { svc } = auth;

  // Global spend via helper function
  const { data: spendRaw, error: spendErr } = await svc.rpc('get_monthly_ai_spend');
  if (spendErr) return NextResponse.json({ error: spendErr.message }, { status: 500 });
  const month_spend = Number(spendRaw ?? 0);

  // Per-user generation counts (top N) for current month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: gens, error: gensErr } = await svc
    .from('ai_generations')
    .select('user_id, estimated_cost_usd, success, created_at, purpose, model')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false });

  if (gensErr) return NextResponse.json({ error: gensErr.message }, { status: 500 });

  // Aggregate per user
  const userMap = new Map<
    string,
    { generation_count: number; total_cost: number }
  >();
  for (const g of gens ?? []) {
    if (!g.user_id) continue;
    const existing = userMap.get(g.user_id) ?? { generation_count: 0, total_cost: 0 };
    existing.generation_count += 1;
    existing.total_cost += Number(g.estimated_cost_usd ?? 0);
    userMap.set(g.user_id, existing);
  }

  // Fetch emails for top-N users
  const topUserIds = [...userMap.entries()]
    .sort((a, b) => b[1].generation_count - a[1].generation_count)
    .slice(0, TOP_N)
    .map(([id]) => id);

  const { data: profiles } = await svc
    .from('profiles')
    .select('id, email')
    .in('id', topUserIds.length > 0 ? topUserIds : ['00000000-0000-0000-0000-000000000000']);

  const emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const per_user = topUserIds.map((uid) => ({
    user_id: uid,
    email: emailMap.get(uid) ?? uid,
    ...userMap.get(uid)!,
  }));

  // Recent 20 generations (all users)
  const recent = (gens ?? []).slice(0, 20).map((g) => ({
    user_id: g.user_id,
    purpose: g.purpose,
    model: g.model,
    cost: Number(g.estimated_cost_usd ?? 0),
    success: g.success,
    created_at: g.created_at,
  }));

  return NextResponse.json({
    data: {
      month_spend,
      soft_cap: SOFT_CAP,
      hard_cap: HARD_CAP,
      soft_exceeded: month_spend >= SOFT_CAP,
      hard_exceeded: month_spend >= HARD_CAP,
      per_user,
      recent,
    },
  });
}

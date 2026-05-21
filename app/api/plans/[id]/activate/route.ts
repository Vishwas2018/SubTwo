import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Minimal interface for RPCs not yet in generated DB types (migration 022)
interface UntypedRpc {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

export async function POST(
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

  // Verify ownership via RLS-aware client
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, user_id, status')
    .eq('id', id)
    .single();

  if (planErr || !plan || plan.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Plan not found.' } },
      { status: 404 },
    );
  }

  if (plan.status !== 'draft') {
    return NextResponse.json(
      { error: { code: 'conflict', message: 'Only draft plans can be activated.' } },
      { status: 409 },
    );
  }

  // Atomically archive existing active plan + promote this one (migration 022)
  const serviceClient = createServiceClient() as unknown as UntypedRpc;
  const { error: activateErr } = await serviceClient.rpc('activate_plan', {
    p_plan_id: id,
    p_user_id: user.id,
  });

  if (activateErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: activateErr.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { plan_id: id, status: 'active' } });
}

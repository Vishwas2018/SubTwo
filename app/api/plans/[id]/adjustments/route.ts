/**
 * GET /api/plans/[id]/adjustments
 * List adjustment history for a plan (auth + ownership).
 * Refs: P3-04, P3-05
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

  // Ownership check
  const { data: plan } = await supabase.from('plans').select('id, user_id').eq('id', id).single();

  if (!plan || plan.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Plan not found.' } },
      { status: 404 },
    );
  }

  const svc = createServiceClient();
  const { data: adjustments, error } = await svc
    .from('plan_adjustments')
    .select('id, trigger, change_summary, change_details, affected_session_ids, user_override, created_at')
    .eq('plan_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to load adjustments.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: adjustments ?? [] });
}

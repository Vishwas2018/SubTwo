/**
 * POST /api/plans/[id]/adjustments/[adjId]/override
 * Mark an adjustment as user-overridden and revert affected session changes.
 * Refs: P3-04
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revertAdjustment } from '@/lib/adjustments/apply';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; adjId: string }> },
) {
  const { id, adjId } = await params;

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

  // Ownership: verify the plan belongs to this user
  const { data: plan } = await supabase.from('plans').select('id, user_id').eq('id', id).single();

  if (!plan || plan.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Plan not found.' } },
      { status: 404 },
    );
  }

  const reverted = await revertAdjustment(adjId, id);

  if (!reverted) {
    return NextResponse.json(
      { error: { code: 'conflict', message: 'Adjustment not found or already overridden.' } },
      { status: 409 },
    );
  }

  return NextResponse.json({ data: { overridden: true } });
}

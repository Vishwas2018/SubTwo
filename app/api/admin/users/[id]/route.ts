import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest } from '@/lib/auth/require-admin-api';
import { logAudit } from '@/lib/audit/log';

const PatchSchema = z.object({
  suspended: z.boolean().optional(),
  is_coach: z.boolean().optional(),
}).refine((d) => d.suspended !== undefined || d.is_coach !== undefined, {
  message: 'At least one field required',
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdminRequest();
  if (!auth.ok) return auth.response;
  const { adminId, svc } = auth;

  const { id } = await params;

  // Admins cannot suspend themselves
  if (id === adminId) {
    return NextResponse.json({ error: 'Cannot suspend your own account' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  }

  const updatePayload: Record<string, boolean> = {};
  if (parsed.data.suspended !== undefined) updatePayload.suspended = parsed.data.suspended;
  if (parsed.data.is_coach !== undefined) updatePayload.is_coach = parsed.data.is_coach;

  const { data, error } = await svc
    .from('profiles')
    .update(updatePayload)
    .eq('id', id)
    .select('id, email, suspended, is_coach')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
  }

  const action =
    parsed.data.suspended !== undefined
      ? parsed.data.suspended ? 'user_suspended' : 'user_unsuspended'
      : parsed.data.is_coach ? 'user_made_coach' : 'user_removed_coach';

  await logAudit({
    action,
    entityType: 'profiles',
    entityId: id,
    userId: adminId,
  });
  return NextResponse.json({ data });
}

import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/auth/require-admin-api';
import { logAudit } from '@/lib/audit/log';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdminRequest();
  if (!auth.ok) return auth.response;
  const { svc } = auth;

  const { id } = await params;

  // Only allow revoking unused codes (use_count = 0)
  const { data: existing, error: fetchErr } = await svc
    .from('invite_codes')
    .select('use_count')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if ((existing.use_count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot revoke a code that has already been used' },
      { status: 409 },
    );
  }

  const { error } = await svc.from('invite_codes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ action: 'invite_code_revoked', entityType: 'invite_codes', entityId: id });
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function DELETE(
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

  // RLS athlete_manages_access enforces athlete_id = auth.uid()
  const { data: invite } = await supabase
    .from('viewer_access')
    .select('id, status')
    .eq('id', id)
    .eq('athlete_id', user.id)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Invite not found.' } },
      { status: 404 },
    );
  }

  if (invite.status === 'revoked') {
    return NextResponse.json(
      { error: { code: 'conflict', message: 'Invite already revoked.' } },
      { status: 409 },
    );
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from('viewer_access')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to revoke invite.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { id, status: 'revoked' } });
}

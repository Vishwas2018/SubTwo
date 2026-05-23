import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest } from '@/lib/auth/require-admin-api';

const PatchSchema = z.object({ suspended: z.boolean() });

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

  const { data, error } = await svc
    .from('profiles')
    .update({ suspended: parsed.data.suspended })
    .eq('id', id)
    .select('id, email, suspended')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

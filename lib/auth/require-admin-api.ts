import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Verify the request comes from an admin.
 * Returns { svc } on success, or a 404 NextResponse to return immediately.
 * Using 404 instead of 403 so the route's existence is not revealed.
 */
export async function verifyAdminRequest(): Promise<
  | { ok: true; adminId: string; svc: ReturnType<typeof createServiceClient> }
  | { ok: false; response: NextResponse }
> {
  const not_found = () => ({
    ok: false as const,
    response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
  });

  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return not_found();

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('id, is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return not_found();

  return { ok: true, adminId: user.id, svc };
}

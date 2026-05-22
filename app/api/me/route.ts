import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const PatchSchema = z.object({
  display_name: z.string().trim().max(100).nullable().optional(),
  timezone: z.string().max(64).optional(),
});

export async function GET() {
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

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, timezone, is_admin, ai_generation_count, created_at')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Profile not found.' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: profile });
}

export async function PATCH(req: Request) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid JSON body.' } },
      { status: 422 },
    );
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: 'Invalid profile data.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const updates: {
    updated_at: string;
    display_name?: string | null;
    timezone?: string;
  } = { updated_at: new Date().toISOString() };
  if (parsed.data.display_name !== undefined) updates.display_name = parsed.data.display_name;
  if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;

  const svc = createServiceClient();
  const { data: profile, error } = await svc
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, email, display_name, timezone')
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to update profile.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: profile });
}

export async function DELETE() {
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

  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to delete account.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { deleted: true } });
}

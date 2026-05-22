import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const PatchBodySchema = z.object({
  severity: z.number().int().min(1).max(10).optional(),
  resolved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine((d) => d.severity !== undefined || d.resolved_date !== undefined || d.notes !== undefined, {
  message: 'At least one of severity, resolved_date, or notes must be provided.',
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Verify ownership
  const { data: existing } = await supabase
    .from('niggles')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Niggle not found.' } },
      { status: 404 },
    );
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Access denied.' } },
      { status: 403 },
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

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid update data.', details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const input = parsed.data;
  type NiggleUpdate = {
    updated_at: string;
    severity?: number;
    resolved_date?: string | null;
    notes?: string | null;
  };
  const updates: NiggleUpdate = { updated_at: new Date().toISOString() };
  if (input.severity !== undefined) updates.severity = input.severity;
  if (input.resolved_date !== undefined) updates.resolved_date = input.resolved_date;
  if (input.notes !== undefined) updates.notes = input.notes;

  const serviceClient = createServiceClient();
  const { data: niggle, error: updateErr } = await serviceClient
    .from('niggles')
    .update(updates)
    .eq('id', id)
    .select('id, body_part, severity, started_date, resolved_date, notes, updated_at')
    .single();

  if (updateErr || !niggle) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to update niggle.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: niggle });
}

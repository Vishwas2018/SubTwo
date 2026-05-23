import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const CommentSchema = z.object({
  comment: z
    .string()
    .min(1)
    .max(500)
    .transform((s) => s.trim())
    .refine((s) => !s.includes('\n'), { message: 'Comment must be a single line.' }),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params;
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

  // RLS handles visibility: author + run_owner + active viewers all see comments
  const { data: comments, error } = await supabase
    .from('run_comments')
    .select('id, comment, created_at, author_id')
    .eq('run_id', runId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to load comments.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: comments ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params;
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

  const rl = await rateLimit(`write:${user.id}`, 'api_write');
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Slow down.',
          retry_after: Math.ceil((rl.reset - Date.now()) / 1000),
        },
      },
      { status: 429 },
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

  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid comment.',
        },
      },
      { status: 422 },
    );
  }

  // RLS enforces: athlete uses author_owns_comment; viewers use viewer_can_insert_comment
  const { data: comment, error: insertErr } = await supabase
    .from('run_comments')
    .insert({ run_id: runId, author_id: user.id, comment: parsed.data.comment })
    .select('id, comment, created_at, author_id')
    .single();

  if (insertErr || !comment) {
    const isRls = insertErr?.code === '42501' || insertErr?.message?.includes('violates');
    return NextResponse.json(
      {
        error: {
          code: isRls ? 'forbidden' : 'server_error',
          message: isRls ? 'You do not have permission to comment on this run.' : 'Failed to save comment.',
        },
      },
      { status: isRls ? 403 : 500 },
    );
  }

  return NextResponse.json({ data: comment }, { status: 201 });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest } from '@/lib/auth/require-admin-api';

const CreateSchema = z.object({
  note: z.string().max(200).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

export async function GET() {
  const auth = await verifyAdminRequest();
  if (!auth.ok) return auth.response;
  const { svc } = auth;

  const { data, error } = await svc
    .from('invite_codes')
    .select('id, code, note, max_uses, use_count, expires_at, created_at, created_by')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const codes = (data ?? []).map((row) => {
    const expired =
      row.expires_at != null && new Date(row.expires_at) <= now;
    const used = (row.use_count ?? 0) >= (row.max_uses ?? 1);
    const status = used ? 'used' : expired ? 'expired' : 'active';
    return { ...row, status };
  });

  return NextResponse.json({ data: codes });
}

export async function POST(req: Request) {
  const auth = await verifyAdminRequest();
  if (!auth.ok) return auth.response;
  const { adminId, svc } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  }
  const { note, expires_in_days } = parsed.data;

  const expires_at =
    expires_in_days != null
      ? new Date(Date.now() + expires_in_days * 86_400_000).toISOString()
      : null;

  // Retry on (rare) code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await svc
      .from('invite_codes')
      .insert({ code, note: note ?? null, expires_at, max_uses: 1, created_by: adminId })
      .select('id, code, note, expires_at, created_at')
      .single();

    if (!error) return NextResponse.json({ data }, { status: 201 });
    if (!error.message.includes('duplicate')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Could not generate unique code' }, { status: 500 });
}

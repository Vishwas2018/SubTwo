import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const SignupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  invite_code: z.string().regex(/^[A-Z0-9]{8}$/, 'Invalid code format'),
});

const GENERIC_INVALID_INVITE = {
  error: {
    code: 'invalid_invite',
    message: "That code doesn't work. Check with whoever invited you.",
  },
};

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = await rateLimit(`signup:${ip}`, 'signup');
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many attempts. Try again later.',
          retry_after: Math.ceil((limit.reset - Date.now()) / 1000),
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
      { error: { code: 'validation_error', message: 'Invalid request' } },
      { status: 422 },
    );
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    if (firstIssue?.path.includes('password')) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: firstIssue.message } },
        { status: 422 },
      );
    }
    return NextResponse.json(GENERIC_INVALID_INVITE, { status: 400 });
  }
  const { email, password, invite_code } = parsed.data;

  const admin = createServiceClient();

  // Validate + atomically consume the invite code
  const { data: validResult, error: validErr } = await admin.rpc('validate_invite_code', {
    p_code: invite_code,
  });
  if (validErr || validResult !== true) {
    return NextResponse.json(GENERIC_INVALID_INVITE, { status: 400 });
  }

  // Create user — email_confirm: true bypasses confirmation email (beta path)
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    const msg = createErr.message?.toLowerCase() ?? '';
    if (msg.includes('already registered') || msg.includes('already exists') || (createErr as { status?: number }).status === 422) {
      return NextResponse.json(
        { error: { code: 'email_taken', message: 'An account with that email already exists.' } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Could not create account. Try again.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { created: true } }, { status: 201 });
}

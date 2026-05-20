import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkLimit } from '@/lib/rate-limit/memory';

const SignupSchema = z.object({
  email: z.string().email().max(254),
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
  const limit = checkLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many attempts. Try again later.' } },
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
    return NextResponse.json(GENERIC_INVALID_INVITE, { status: 400 });
  }
  const { email, invite_code } = parsed.data;

  const admin = createServiceClient();
  const { data: validResult, error: validErr } = await admin.rpc('validate_invite_code', {
    p_code: invite_code,
  });
  if (validErr || validResult !== true) {
    return NextResponse.json(GENERIC_INVALID_INVITE, { status: 400 });
  }

  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback?invite=${invite_code}`,
    },
  });

  if (otpErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Could not send magic link. Try again.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { sent: true } }, { status: 201 });
}

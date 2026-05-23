import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit/log';

const InviteSchema = z.object({
  email: z.string().email(),
  can_comment: z.boolean().default(true),
});

export async function POST(req: Request) {
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

  const rl = await rateLimit(`invite:${user.id}`, 'invite');
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many invites. Try again tomorrow.',
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

  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: 'Invalid invite data.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { email, can_comment } = parsed.data;
  const svc = createServiceClient();

  // One coach per athlete — block if pending/active already exists
  const { data: existing } = await svc
    .from('viewer_access')
    .select('id')
    .eq('athlete_id', user.id)
    .in('status', ['pending', 'active'])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: {
          code: 'conflict',
          message: 'You already have a pending or active coach. Revoke it first.',
        },
      },
      { status: 409 },
    );
  }

  const token = crypto.randomUUID();
  const { data: invite, error: insertErr } = await svc
    .from('viewer_access')
    .insert({
      athlete_id: user.id,
      invite_email: email,
      invite_token: token,
      can_comment,
      status: 'pending',
    })
    .select('id, invited_at')
    .single();

  if (insertErr || !invite) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to create invite.' } },
      { status: 500 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const acceptUrl = `${appUrl}/invite/accept/${token}`;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const { data: profile } = await svc
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single();
      const athleteName = profile?.display_name ?? profile?.email ?? 'Your athlete';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SubTwo <invites@subtwo.app>',
          to: email,
          subject: `${athleteName} invited you to view their training plan`,
          text:
            `${athleteName} has invited you to view their training plan on SubTwo.\n\n` +
            `Accept the invite: ${acceptUrl}\n\nThis link expires in 7 days.`,
        }),
      });
      emailSent = true;
    } catch {
      // best-effort
    }
  }

  await logAudit({ action: 'coach_invite_sent', entityType: 'viewer_access', entityId: invite.id, userId: user.id });
  return NextResponse.json(
    { data: { id: invite.id, accept_url: acceptUrl, email_sent: emailSent } },
    { status: 201 },
  );
}

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

  const { data: invites, error } = await supabase
    .from('viewer_access')
    .select('id, invite_email, can_comment, status, invited_at, accepted_at, revoked_at, viewer_id')
    .eq('athlete_id', user.id)
    .order('invited_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to load invites.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: invites ?? [] });
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1_000;

function isTokenExpired(invitedAt: string): boolean {
  return Date.now() - new Date(invitedAt).getTime() > TOKEN_EXPIRY_MS;
}

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  const svc = createServiceClient();

  const { data: invite } = await svc
    .from('viewer_access')
    .select('id, status, invited_at, athlete_id')
    .eq('invite_token', token)
    .maybeSingle();

  if (!invite) {
    return (
      <ErrorCard
        title="Invalid invite"
        body="This invite link is invalid or has already been used."
      />
    );
  }

  if (invite.status !== 'pending') {
    return (
      <ErrorCard
        title={`Invite ${invite.status}`}
        body={`This invite has already been ${invite.status}.`}
        linkHref="/coach"
        linkLabel="Go to coach portal"
      />
    );
  }

  if (isTokenExpired(invite.invited_at)) {
    return (
      <ErrorCard
        title="Invite expired"
        body="This invite link expired after 7 days. Ask your athlete to send a new one."
      />
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-2">
            <div className="text-3xl">🏃</div>
            <h1 className="text-xl font-semibold text-slate-900">You&apos;ve been invited</h1>
            <p className="text-slate-500 text-sm">
              You&apos;ve been invited to view an athlete&apos;s training plan on SubTwo as a coach.
            </p>
          </div>
          <div className="space-y-3">
            <Link
              href={`/login`}
              className="block w-full text-center py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Log in to accept
            </Link>
            <Link
              href={`/signup`}
              className="block w-full text-center py-2.5 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Sign up to accept
            </Link>
          </div>
          <p className="text-xs text-slate-400 text-center">
            After signing in, return to this link to accept the invite.
          </p>
        </div>
      </main>
    );
  }

  if (invite.athlete_id === user.id) {
    return (
      <ErrorCard
        title="Cannot accept own invite"
        body="You cannot accept an invite you sent to yourself."
      />
    );
  }

  const { error: updateErr } = await svc
    .from('viewer_access')
    .update({
      viewer_id: user.id,
      status: 'active',
      accepted_at: new Date().toISOString(),
      invite_token: null,
    })
    .eq('id', invite.id);

  if (updateErr) {
    return (
      <ErrorCard
        title="Something went wrong"
        body="Failed to accept the invite. Please try again."
      />
    );
  }

  redirect('/coach');
}

function ErrorCard({
  title,
  body,
  linkHref,
  linkLabel,
}: {
  title: string;
  body: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-slate-500 text-sm">{body}</p>
        {linkHref && linkLabel && (
          <Link href={linkHref} className="text-emerald-600 hover:underline text-sm">
            {linkLabel}
          </Link>
        )}
        <div className="pt-2">
          <Link href="/" className="text-slate-400 hover:text-slate-600 text-xs">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}

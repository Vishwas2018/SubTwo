// DEV-ONLY: direct session cookie injection for local E2E testing.
// Guarded by NODE_ENV — returns 404 in production.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const email = new URL(request.url).searchParams.get('email') ?? process.env.DEV_TEST_EMAIL ?? 'dev@localhost';

  // Generate OTP + exchange it server-side via service role
  const admin = createServiceClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: 'http://localhost:3000' },
  });
  if (linkErr || !linkData.properties?.email_otp) {
    return NextResponse.json({ error: linkErr?.message ?? 'generateLink failed' }, { status: 500 });
  }

  const { data: sessionData, error: sessionErr } = await admin.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: 'email',
  });
  if (sessionErr || !sessionData.session) {
    return NextResponse.json({ error: sessionErr?.message ?? 'verifyOtp failed' }, { status: 500 });
  }

  // Write session cookies onto the redirect response
  const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );
  await supabase.auth.setSession({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });

  return redirectResponse;
}

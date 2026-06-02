#!/usr/bin/env tsx
/**
 * Provider sanity: fires one minimal generation per provider (claude / groq / qwen)
 * using beta01's credentials.  Checks ai_generations rows for correct provider column.
 *
 * Usage: pnpm tsx scripts/provider-sanity.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://subtwo.vercel.app').replace(/\/$/, '');
const PROJECT_REF = SUPABASE_URL.match(/\/\/([^.]+)\./)?.[1] ?? '';

const BETA01_EMAIL = 'beta01@subtwo.app';
const BETA01_PASS  = 'Tr4#mNp8kQx!';

// Minimal valid wizard input — matches WizardInputSchema discriminated union
// 8 weeks out → ≤12 weeks → single-call path for Claude (avoids batch timeout on Vercel hobby)
const raceDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
})();

const MINIMAL_INPUT = {
  experience_level: 'beginner',
  race_distance_km: 5,
  race_date: raceDate,
  race_name: 'Provider Sanity 5K',
  wizard_data: {
    weekly_km_current: 10,
    longest_recent_run_km: 3,
    can_run_5k_without_stopping: 'sometimes' as const,
    days_per_week: 3,
    long_run_day: 'sat' as const,
  },
};

// Build @supabase/ssr-compatible cookie from a Supabase session
function buildSessionCookie(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string };
}): string {
  const json = JSON.stringify({
    access_token: session.access_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token,
    user: session.user,
  });
  const value = 'base64-' + Buffer.from(json, 'utf8').toString('base64url');
  return `sb-${PROJECT_REF}-auth-token=${value}`;
}

async function getSession(): Promise<ReturnType<typeof buildSessionCookie>> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email: BETA01_EMAIL, password: BETA01_PASS }),
  });
  const json = await res.json() as {
    access_token?: string; refresh_token?: string; expires_in?: number;
    user?: { id: string; email?: string };
  };
  if (!json.access_token) throw new Error(`Login failed: ${JSON.stringify(json).slice(0, 200)}`);
  return buildSessionCookie({
    access_token: json.access_token,
    refresh_token: json.refresh_token!,
    expires_in: json.expires_in ?? 3600,
    user: json.user!,
  });
}

async function logout(accessToken: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
  });
}

async function generate(provider: string, cookie: string): Promise<{
  ok: boolean; status: number; plan_id?: string; error?: string;
  ai_meta?: { provider: string; duration_ms: number };
}> {
  const res = await fetch(`${APP_URL}/api/plans/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ provider, ...MINIMAL_INPUT }),
  });
  const text = await res.text();
  let json: { data?: { plan_id: string; ai_metadata?: { provider: string; duration_ms: number } }; error?: { code: string; message: string } } = {};
  try { json = JSON.parse(text) as typeof json; } catch {
    console.log(`  [raw response HTTP ${res.status}]:`, text.slice(0, 300));
    return { ok: false, status: res.status, error: `non-JSON response: ${text.slice(0, 100)}` };
  }
  return {
    ok: res.ok,
    status: res.status,
    plan_id: json.data?.plan_id,
    ai_meta: json.data?.ai_metadata,
    error: json.error ? `${json.error.code}: ${json.error.message}` : undefined,
  };
}

async function main() {
  console.log(`\nProvider sanity test — ${APP_URL}\n`);

  // Login once
  process.stdout.write('Logging in as beta01… ');
  const cookie = await getSession();
  console.log('✓');

  // Extract access token for logout later
  const atMatch = cookie.match(/base64-([^;]+)/);
  let accessToken = '';
  if (atMatch) {
    try {
      const decoded = JSON.parse(Buffer.from(atMatch[1]!, 'base64url').toString('utf8')) as { access_token?: string };
      accessToken = decoded.access_token ?? '';
    } catch {}
  }

  const providers = ['claude', 'groq', 'qwen'] as const;
  const summary: { provider: string; ok: boolean; status: number; ms?: number; fallback: boolean; error?: string }[] = [];

  for (const provider of providers) {
    process.stdout.write(`\nGenerating with ${provider}… (this may take 20–40 s)\n`);
    const start = Date.now();
    const result = await generate(provider, cookie);
    const elapsed = Date.now() - start;

    const reportedProvider = result.ai_meta?.provider ?? 'unknown';
    const isFallback = result.ok && reportedProvider !== provider;

    if (result.ok) {
      console.log(`  ✓ ${provider} — plan_id: ${result.plan_id} | ${Math.round(elapsed / 1000)}s | ai_meta.provider: ${reportedProvider}${isFallback ? ' ← FALLBACK' : ''}`);
    } else {
      console.log(`  ✗ ${provider} — HTTP ${result.status} | ${result.error}`);
    }
    summary.push({ provider, ok: result.ok, status: result.status, ms: result.ai_meta?.duration_ms, fallback: isFallback, error: result.error });
  }

  // Verify ai_generations rows
  console.log('\nVerifying ai_generations rows…');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: gens, error: genErr } = await admin
    .from('ai_generations')
    .select('provider, success, duration_ms, created_at')
    .eq('purpose', 'initial_plan')
    .order('created_at', { ascending: false })
    .limit(10);

  if (genErr) {
    console.log('  ✗ Could not query ai_generations:', genErr.message);
  } else {
    console.log(`  Found ${gens?.length ?? 0} recent rows:`);
    (gens ?? []).forEach(g =>
      console.log(`    provider=${g.provider} | success=${g.success} | ${g.duration_ms}ms | ${g.created_at}`)
    );
  }

  // Logout
  if (accessToken) await logout(accessToken);
  console.log('\nLogged out.');

  // Final summary
  console.log('\n─── Summary ───────────────────────────────');
  for (const s of summary) {
    const mark = s.ok ? '✓' : '✗';
    const note = s.fallback ? ' ← FALLBACK' : '';
    console.log(`  ${mark} ${s.provider.padEnd(8)} HTTP ${s.status}${note}${s.error ? ' ' + s.error : ''}`);
  }
  const fallbackCount = summary.filter(s => s.fallback).length;
  console.log(`  Fallbacks: ${fallbackCount}`);
}

main().catch(err => { console.error('\n✗', err.message); process.exit(1); });

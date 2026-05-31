/**
 * Mints 10 beta invite codes via /api/admin/invites.
 *
 * Auth: generates a magic link for the admin user, follows the redirect manually
 * to extract session tokens (same pattern as tests/e2e/auth.setup.ts), then sends
 * the @supabase/ssr session cookie with each admin API call.
 *
 * Run: pnpm tsx scripts/mint-beta-codes.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local before anything else
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://subtwo.vercel.app';
// Admin is set by migration 019: promote_initial_admin trigger fires for jvishu21@gmail.com
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'jvishu21@gmail.com';
const PROJECT_REF = SUPABASE_URL.match(/\/\/([^.]+)\./)?.[1] ?? '';

if (!SUPABASE_URL || !SERVICE_KEY || !PROJECT_REF) {
  console.error('✗ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Check .env.local');
  process.exit(1);
}

// ── Step 1: Get admin access token via magic link ──────────────────────────────

async function getAdminSession(): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });

  if (error || !data?.properties?.action_link) {
    throw new Error(`Magic link failed: ${error?.message ?? 'no action_link'}`);
  }

  // Follow the verify URL with redirect:manual — Supabase puts tokens in Location hash
  const res = await fetch(data.properties.action_link, { redirect: 'manual' });
  const location = res.headers.get('location') ?? '';
  const hashIdx = location.indexOf('#');

  if (hashIdx === -1) {
    throw new Error(`No hash in Location: ${location.slice(0, 300)}`);
  }

  const p = new URLSearchParams(location.slice(hashIdx + 1));
  const accessToken = p.get('access_token') ?? '';
  const refreshToken = p.get('refresh_token') ?? '';
  const expiresIn = parseInt(p.get('expires_in') ?? '3600', 10);

  if (!accessToken) {
    throw new Error(`No access_token in Location hash: ${location.slice(0, 300)}`);
  }

  return { accessToken, refreshToken, expiresIn };
}

// ── Step 2: Build @supabase/ssr session cookie ────────────────────────────────

function buildCookie(accessToken: string, refreshToken: string, expiresIn: number): string {
  const json = JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: refreshToken,
    user: { email: ADMIN_EMAIL },
  });
  const value = 'base64-' + Buffer.from(json, 'utf8').toString('base64url');
  return `sb-${PROJECT_REF}-auth-token=${value}`;
}

// ── Step 3: Create a single invite code ───────────────────────────────────────

async function createInviteCode(cookie: string, note: string): Promise<string> {
  const res = await fetch(`${APP_URL}/api/admin/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ note }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /api/admin/invites → ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { data?: { code: string } };
  const code = json.data?.code;
  if (!code) throw new Error(`No code in response: ${JSON.stringify(json)}`);
  return code;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const COUNT = 10;
  console.log(`\n🪪  Minting ${COUNT} beta codes on ${APP_URL}`);

  const { accessToken, refreshToken, expiresIn } = await getAdminSession();
  console.log('✓ Admin session obtained');

  const cookie = buildCookie(accessToken, refreshToken, expiresIn);

  const codes: string[] = [];
  for (let i = 1; i <= COUNT; i++) {
    const code = await createInviteCode(cookie, 'Beta wave 1');
    codes.push(code);
    console.log(`  ${i}/${COUNT}  ${code}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(__dirname, '..', 'docs', 'BETA_CODES.md');
  const md = [
    '# Beta Codes — Wave 1',
    '',
    `**Generated:** ${today}  `,
    `**Count:** ${codes.length}  `,
    `**Note:** Beta wave 1`,
    '',
    '| Code | Status |',
    '|------|--------|',
    ...codes.map((c) => `| \`${c}\` | active |`),
    '',
    '> Each code is single-use. Manage at https://subtwo.vercel.app/admin/invites',
  ].join('\n');

  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\n✓ ${codes.length} codes written to docs/BETA_CODES.md`);
}

main().catch((err: Error) => {
  console.error('\n✗', err.message);
  process.exit(1);
});

/**
 * Auth setup: generates a Supabase magic link, follows the redirect chain,
 * extracts the access/refresh tokens from the URL hash (implicit flow), injects
 * them as Supabase SSR cookies, then saves browser state for downstream projects.
 *
 * Magic links use the implicit flow: Supabase sends tokens as a URL hash fragment
 * to /auth/callback. Our server-side /auth/callback only handles PKCE (?code=),
 * so the server redirects to /login?error=auth_failed but the browser retains the
 * original hash — giving us the tokens to inject manually.
 *
 * Required env vars (from .env.test or CI secrets):
 *   SUPABASE_URL         — Supabase project URL
 *   SUPABASE_SERVICE_KEY — Service-role key
 *   E2E_USER_EMAIL       — Email of the pre-existing test user
 */
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const STORAGE_STATE = path.join(__dirname, '../../playwright/.auth/user.json');
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? 'vishwas.joshi01@gmail.com';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://subtwo.vercel.app';
const PROJECT_REF = SUPABASE_URL?.match(/\/\/([^.]+)\./)?.[1] ?? '';

setup.skip(
  !SUPABASE_URL || !SUPABASE_SERVICE_KEY,
  'SUPABASE_URL / SUPABASE_SERVICE_KEY not set — skipping auth setup',
);

setup('authenticate test user', async ({ page }) => {
  // If a valid storage state already exists, reuse it to avoid consuming tokens
  if (fs.existsSync(STORAGE_STATE)) {
    const age = Date.now() - fs.statSync(STORAGE_STATE).mtimeMs;
    if (age < 50 * 60 * 1000) { // reuse if less than 50 minutes old
      console.log('Reusing existing auth state (< 50 min old)');
      return;
    }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generate a magic link with redirect to /auth/callback (on the whitelist)
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: E2E_USER_EMAIL,
    options: { redirectTo: `${BASE_URL}/auth/callback` },
  });

  if (error ?? !data?.properties?.action_link) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? 'no action_link'}`);
  }

  // Follow the Supabase verify URL.
  // Supabase redirects to /auth/callback#access_token=...&refresh_token=...
  // Our server handler (PKCE only) then redirects to /login?error=auth_failed
  // but the browser preserves the hash, landing at:
  //   /login?error=auth_failed#access_token=...&refresh_token=...
  await page.goto(data.properties.action_link, { timeout: 30_000 });
  await page.waitForTimeout(3_000); // allow redirect chain to settle

  const currentUrl = page.url();

  // Extract tokens from the URL hash fragment
  const tokens = await page.evaluate(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    const p = new URLSearchParams(hash);
    return {
      accessToken: p.get('access_token') ?? '',
      refreshToken: p.get('refresh_token') ?? '',
      expiresIn: parseInt(p.get('expires_in') ?? '3600', 10),
    };
  });

  if (!tokens?.accessToken) {
    throw new Error(
      `No access_token in URL hash after magic link flow.\nCurrent URL: ${currentUrl}`
    );
  }

  // Inject session as Supabase SSR cookie.
  // @supabase/ssr v0.10+ defaults cookieEncoding="base64url", so the value
  // must be "base64-" + base64url(JSON.stringify(session)).  Plain JSON is
  // rejected because " is not a valid cookie-octet (RFC 6265) and gets
  // truncated by the cookie parser before it reaches getUser().
  const domain = new URL(BASE_URL).hostname;
  const sessionJson = JSON.stringify({
    access_token: tokens.accessToken,
    token_type: 'bearer',
    expires_in: tokens.expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + tokens.expiresIn,
    refresh_token: tokens.refreshToken,
    user: { email: E2E_USER_EMAIL },
  });
  // Node ≥16 supports 'base64url' encoding natively; alphabet matches @supabase/ssr
  const cookieValue = 'base64-' + Buffer.from(sessionJson, 'utf8').toString('base64url');

  const cookieName = `sb-${PROJECT_REF}-auth-token`;
  const chunkSize = 3600;

  if (cookieValue.length > chunkSize) {
    const chunks = cookieValue.match(new RegExp(`.{1,${chunkSize}}`, 'g')) ?? [];
    for (let i = 0; i < chunks.length; i++) {
      await page.context().addCookies([{
        name: `${cookieName}.${i}`,
        value: chunks[i]!,
        domain, path: '/', secure: true, httpOnly: false, sameSite: 'Lax',
      }]);
    }
  } else {
    await page.context().addCookies([{
      name: cookieName,
      value: cookieValue,
      domain, path: '/', secure: true, httpOnly: false, sameSite: 'Lax',
    }]);
  }

  // Verify the session cookie gives us access to a protected page
  await page.goto(`${BASE_URL}/dashboard`, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});

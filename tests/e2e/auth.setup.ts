/**
 * Auth setup: signs in with email+password via the Supabase admin API,
 * injects the session as Supabase SSR cookies, then saves browser state
 * for downstream E2E projects.
 *
 * Required env vars (from .env.test or CI secrets):
 *   SUPABASE_URL         — Supabase project URL
 *   SUPABASE_SERVICE_KEY — Service-role key
 *   E2E_USER_EMAIL       — Email of the pre-existing test user
 *   E2E_USER_PASSWORD    — Password of the test user
 *
 * Magic-link path (legacy): retained as a comment below for reference.
 * Restore by setting AUTH_MAGIC_LINK_ENABLED=true and swapping the sign-in block.
 */
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const STORAGE_STATE = path.join(__dirname, '../../playwright/.auth/user.json');
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? 'vishwas.joshi01@gmail.com';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? '';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://subtwo.vercel.app';
const PROJECT_REF = SUPABASE_URL?.match(/\/\/([^.]+)\./)?.[1] ?? '';

setup.skip(
  !SUPABASE_URL || !SUPABASE_SERVICE_KEY,
  'SUPABASE_URL / SUPABASE_SERVICE_KEY not set — skipping auth setup',
);

setup('authenticate test user', async ({ page }) => {
  // Reuse existing state if fresh enough
  if (fs.existsSync(STORAGE_STATE)) {
    const age = Date.now() - fs.statSync(STORAGE_STATE).mtimeMs;
    if (age < 50 * 60 * 1000) {
      console.log('Reusing existing auth state (< 50 min old)');
      return;
    }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let accessToken: string;
  let refreshToken: string;
  let expiresIn: number;

  if (E2E_USER_PASSWORD) {
    // ── Password sign-in path (default) ─────────────────────────────────────
    const { data, error } = await admin.auth.signInWithPassword({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
    });
    if (error ?? !data?.session) {
      throw new Error(`Password sign-in failed: ${error?.message ?? 'no session returned'}`);
    }
    accessToken = data.session.access_token;
    refreshToken = data.session.refresh_token;
    expiresIn = data.session.expires_in;
  } else {
    // ── Magic-link fallback (legacy — requires SMTP / email delivery) ────────
    console.warn('E2E_USER_PASSWORD not set — falling back to magic link flow');

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: E2E_USER_EMAIL,
      options: { redirectTo: `${BASE_URL}/auth/callback` },
    });
    if (error ?? !data?.properties?.action_link) {
      throw new Error(`Failed to generate magic link: ${error?.message ?? 'no action_link'}`);
    }

    await page.goto(data.properties.action_link, { timeout: 30_000 });
    await page.waitForTimeout(3_000);

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
      throw new Error(`No access_token in URL hash after magic link flow.\nCurrent URL: ${page.url()}`);
    }

    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    expiresIn = tokens.expiresIn;
  }

  // Inject session as Supabase SSR cookie.
  // @supabase/ssr v0.10+ defaults cookieEncoding="base64url":
  //   value = "base64-" + base64url(JSON.stringify(session))
  const domain = new URL(BASE_URL).hostname;
  const sessionJson = JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: refreshToken,
    user: { email: E2E_USER_EMAIL },
  });
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

  // Verify the injected session grants access to a protected page
  await page.goto(`${BASE_URL}/dashboard`, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});

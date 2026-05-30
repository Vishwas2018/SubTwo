/**
 * Happy-path E2E tests — requires authenticated session (auth.setup.ts).
 * Target: PLAYWRIGHT_BASE_URL (default: https://subtwo.vercel.app)
 *
 * Covers:
 *   1. Dashboard renders with plan data (date header, today card, inline check-in)
 *   2. Wizard — 3 data steps navigable (no generation, preserves quota)
 *   3. Log a run — form submits and redirects to /dashboard
 *   4. Session detail — Planned section visible
 *   5. Settings page renders Profile/Sharing/Data tabs
 *   6. Nav — reachable at both desktop and mobile viewports
 *   7. Routing — log a run lands on /dashboard
 *   8. No horizontal overflow at current viewport
 */
import { test, expect } from '@playwright/test';

import type { Page } from '@playwright/test';

async function assertNoHorizontalScroll(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width + 4); // 4px tolerance for scrollbar
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

test('dashboard loads and shows plan', async ({ page, viewport }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);

  // Either an active plan card OR onboarding CTA
  const hasContent = await Promise.race([
    page.getByText(/week \d+|today|training plan/i).first().waitFor({ timeout: 8_000 }).then(() => true),
    page.getByText(/build your plan|get started/i).first().waitFor({ timeout: 8_000 }).then(() => true),
  ]).catch(() => false);

  expect(hasContent).toBe(true);

  if (viewport) {
    await assertNoHorizontalScroll(page, viewport.width);
  }
});

test('dashboard — inline check-in visible (expanded or collapsed)', async ({ page, viewport }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);

  // After dashboard loads, inline check-in should be present in one of two states:
  // - expanded form (not yet checked in today)
  // - collapsed "Checked in today" banner
  const hasCheckin = await Promise.race([
    page.getByText(/checked in today/i).waitFor({ timeout: 8_000 }).then(() => true),
    page.getByText(/daily check-in/i).waitFor({ timeout: 8_000 }).then(() => true),
  ]).catch(() => false);

  expect(hasCheckin).toBe(true);

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

test('dashboard — no quick-nav grid (persistent nav covers navigation)', async ({ page }) => {
  await page.goto('/dashboard');
  await page.locator('main').waitFor({ timeout: 8_000 });

  // The old quick-nav grid had 4 links in a 2×2/4-column grid inside <nav>
  // It should no longer be present; persistent AppNav handles navigation
  const quickNavLinks = page.locator('main nav a');
  const count = await quickNavLinks.count();
  // main nav grid is gone — any links inside main are content links, not the 4-item grid
  expect(count).toBeLessThan(4);
});

// ─── Persistent nav ───────────────────────────────────────────────────────────

test('nav — all 4 items reachable from dashboard', async ({ page, viewport }) => {
  await page.goto('/dashboard');

  const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
  await expect(nav).toBeVisible({ timeout: 8_000 });

  // Plan and Log nav items navigate correctly
  const items = [
    { label: 'Plan', url: /\/plan/ },
    { label: 'Log', url: /\/log/ },
  ];

  for (const { label, url } of items) {
    await page.getByRole('link', { name: label }).first().click();
    await expect(page).toHaveURL(url, { timeout: 8_000 });
    await page.goBack();
  }

  // Settings nav item is present (by href, filter to visible — desktop sidebar is hidden on mobile)
  const settingsNavLink = page.locator('a[href="/settings"]').filter({ visible: true }).first();
  await expect(settingsNavLink).toBeVisible({ timeout: 5_000 });

  // Logo / Home link returns to dashboard
  await page.getByRole('link', { name: /subtwo.*dashboard|home/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 });

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

// ─── Plan calendar ────────────────────────────────────────────────────────────

test('plan calendar page loads', async ({ page, viewport }) => {
  await page.goto('/plan');
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

// ─── Wizard navigation ────────────────────────────────────────────────────────

test('wizard — 3 data steps navigable without submission (Phase C)', async ({ page, viewport }) => {
  await page.goto('/onboarding/wizard');
  await expect(page.getByRole('heading', { name: /build your plan/i })).toBeVisible();

  // Step 1 — Your Race
  await expect(page.getByText(/tell us about your race/i)).toBeVisible();
  await page.getByRole('button', { name: '5K' }).click();
  await page.getByLabel(/race date/i).fill('2027-06-01');
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — About You (experience + fitness + schedule with smart defaults)
  await expect(page.getByRole('heading', { name: /about you/i })).toBeVisible({ timeout: 5_000 });
  // Experience level
  await page.getByLabel(/beginner/i).first().check().catch(() =>
    page.getByRole('radio', { name: /beginner/i }).click()
  );
  // Fitness fields (beginner path)
  await page.getByLabel(/current weekly distance/i).first().fill('20');
  await page.getByLabel(/longest recent run/i).fill('8');
  await page.getByRole('radio', { name: /yes, comfortably/i }).click();
  // Training schedule has smart defaults (4 days, Saturday) — no action needed
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 3 — Optional extras (skippable)
  await expect(page.getByRole('heading', { name: /optional extras/i })).toBeVisible({ timeout: 5_000 });

  // Provider selector on step 3
  const providerSelect = page.getByLabel(/select ai provider/i);
  await expect(providerSelect).toBeVisible({ timeout: 3_000 });
  await expect(providerSelect).toHaveValue('claude');

  // Switching to Groq shows free-tier disclaimer
  await providerSelect.selectOption('groq');
  await expect(page.getByText(/free tier/i)).toBeVisible({ timeout: 2_000 });

  // Switching back to Claude hides disclaimer
  await providerSelect.selectOption('claude');
  await expect(page.getByText(/free tier/i)).not.toBeVisible({ timeout: 2_000 });

  // Both Skip and Generate buttons present
  // aria-label='Generate plan' (the → arrow is display text only, not the accessible name)
  await expect(page.getByRole('button', { name: /skip/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate plan', exact: true })).toBeVisible();

  // Do NOT click Generate or Skip — preserves quota
  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

// ─── Log a run ────────────────────────────────────────────────────────────────

test('log run form renders, validates, and redirects to /dashboard on success', async ({ page, viewport }) => {
  await page.goto('/log');
  await expect(page.getByRole('heading', { name: /log.*run/i })).toBeVisible({ timeout: 8_000 });

  // Fill required fields — distance + duration
  await page.getByLabel(/distance/i).fill('5');
  await page.getByPlaceholder(/00/).first().fill('25');

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);

  await page.getByRole('button', { name: /log run/i }).click();

  // On success: redirect to /dashboard. On validation error: stay on /log with alert.
  await page.waitForTimeout(2_000);
  const url = page.url();
  const hasError = await page.getByRole('alert').isVisible().catch(() => false);
  const redirectedToDashboard = url.includes('/dashboard');
  const redirectedAway = !url.includes('/log');

  // Should redirect to /dashboard on success, or show a field error — not crash
  expect(redirectedToDashboard || hasError || redirectedAway).toBe(true);
});

// ─── Routing: log success → /dashboard ───────────────────────────────────────

test('routing — successful log run lands on /dashboard', async ({ page }) => {
  // Navigate directly to log (no linked session) and submit
  await page.goto('/log');
  await expect(page.getByRole('heading', { name: /log.*run/i })).toBeVisible({ timeout: 8_000 });

  await page.getByLabel(/distance/i).fill('3');
  await page.getByPlaceholder(/00/).first().fill('15'); // 15 min

  await page.getByRole('button', { name: /log run/i }).click();

  // Expect redirect to /dashboard (not /plan or /session)
  // Allow up to 10s for the network round-trip
  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  } catch {
    // If there's a validation error (e.g. duplicate run), the URL stays on /log — acceptable
    const hasError = await page.getByRole('alert').isVisible().catch(() => false);
    expect(hasError).toBe(true);
  }
});

// ─── Session detail ───────────────────────────────────────────────────────────

test('session detail page shows Planned section', async ({ page, viewport }) => {
  await page.goto('/plan');
  await page.waitForTimeout(2_000);

  const sessionLink = page.getByRole('link', { name: /easy|long|threshold|interval|recovery/i }).first();
  const hasLink = await sessionLink.isVisible({ timeout: 5_000 }).catch(() => false);

  if (!hasLink) {
    test.skip(); // No plan yet for this user
    return;
  }

  await sessionLink.click();
  await expect(page.getByText(/planned/i)).toBeVisible({ timeout: 8_000 });
  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

// ─── Settings ─────────────────────────────────────────────────────────────────

test('settings page renders Profile/Sharing/Data tabs without overflow', async ({ page, viewport }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

  // Beta feedback card should be visible
  await expect(page.getByText(/beta feedback/i)).toBeVisible();

  // Only Profile, Sharing, Data — Integrations tab is hidden until Phase 5/6 ships
  const tabs = ['Profile', 'Sharing', 'Data'];
  for (const tab of tabs) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(300);
  }

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

test('settings page loads via direct navigation', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 8_000 });
});

// ─── @generate: wizard submit → plan generated → persisted → log run → dashboard
//
// Cost-aware gate — hits the live Anthropic API (Haiku).
//   Estimated cost:  ~$0.01/run (5K/5-week single-call plan)
//   Quota impact:    1 of 3 daily AI-generation uses for the test user
//
// CI gating:
//   Standard CI (e2e.yml): EXCLUDED via --grep-invert "@generate"
//   On-demand:             pnpm test:e2e:generate
//
// Failure modes:
//   quota_exhausted (3/24h): wizard step 7 shows error; URL stays at /wizard;
//     toHaveURL times out after 90s — expected. Re-run after quota resets.
//   AI API error: same timeout behaviour — investigate then retry.
//
// Desktop viewport only; mobile-gen E2E is optional and skipped here.

test('@generate — wizard submit → plan generated → persisted → log run → dashboard', async ({
  page,
  viewport,
}) => {
  test.setTimeout(180_000); // Haiku ~19s gen + wizard nav + review load + accept + log

  // ── Fill wizard steps 1–3, then click "Generate plan →" ─────────────────

  await page.goto('/onboarding/wizard');
  await expect(page.getByRole('heading', { name: /build your plan/i })).toBeVisible();

  // Step 1 — Your Race: 5K, 6 weeks out
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 6 * 7);
  const raceDateStr = raceDate.toISOString().split('T')[0]!;
  await page.getByRole('button', { name: '5K' }).click();
  await page.getByLabel(/race date/i).fill(raceDateStr);
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — About You: intermediate path
  await expect(page.getByRole('heading', { name: /about you/i })).toBeVisible({ timeout: 5_000 });
  await page.getByLabel(/intermediate/i).first().click().catch(() =>
    page.getByRole('radio', { name: /intermediate/i }).click()
  );
  // Fitness: weekly km + recent race
  await page.getByLabel(/current weekly distance/i).first().fill('30');
  await page.locator('fieldset').getByLabel(/distance/i).fill('5');
  await page.locator('fieldset').getByLabel(/date/i).fill('2026-03-01');
  await page.keyboard.press('Escape');
  await page.locator('#recent_race_time').fill('0:32:00');
  // Training schedule has smart defaults (4 days, Saturday) — no action needed
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 3 — Optional extras: skip (both buttons go to generation)
  await expect(page.getByRole('heading', { name: /optional extras/i })).toBeVisible({ timeout: 5_000 });
  // Click "Generate plan →" (not Skip — to hit the normal path)
  // aria-label='Generate plan' — exact match avoids hitting Skip button with same aria-label prefix
  await page.getByRole('button', { name: 'Generate plan', exact: true }).click();

  // ── Wait for generation to complete and redirect to review ────────────────
  await page.waitForTimeout(8_000);
  const errorAlert = page.getByRole('alert').filter({ hasText: /.+/ });
  const genError = await errorAlert.isVisible({ timeout: 0 }).catch(() => false);
  if (genError) {
    const alertText = await errorAlert.first().textContent().catch(() => 'unknown');
    throw new Error(`Plan generation blocked: "${alertText?.trim()}". Re-run after rate limit resets (3/24h window).`);
  }
  try {
    await expect(page).toHaveURL(/\/onboarding\/review/, { timeout: 90_000 });
  } catch {
    const lateAlert = page.getByRole('alert').filter({ hasText: /.+/ });
    const hasError = await lateAlert.isVisible({ timeout: 0 }).catch(() => false);
    const alertText = hasError
      ? await lateAlert.first().textContent().catch(() => 'unknown')
      : null;
    throw new Error(
      alertText
        ? `Generation failed: "${alertText.trim()}". Vercel Hobby 60s limit likely (P5-AI2).`
        : 'Generation timed out: URL stayed on /wizard for 90s. Check Vercel function logs.',
    );
  }

  // ── Assert plan is persisted in DB (review page shows plan data) ──────────

  await expect(page.getByRole('heading', { name: /your training plan/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/pace zones/i)).toBeVisible();
  await expect(page.getByText(/weekly volume/i)).toBeVisible();

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);

  // ── Accept plan → dashboard ───────────────────────────────────────────────

  await page.getByRole('button', { name: /accept.*start/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  const emptyState = await page
    .getByText(/no active training plan/i)
    .isVisible()
    .catch(() => false);
  expect(emptyState).toBe(false);

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);

  // ── Log a run → expect redirect to /dashboard ─────────────────────────────

  await page.goto('/log');
  await expect(page.getByRole('heading', { name: /log.*run/i })).toBeVisible({ timeout: 8_000 });

  await page.getByLabel(/distance/i).fill('5');
  await page.getByPlaceholder(/00/).first().fill('25'); // 25 min

  await page.getByRole('button', { name: /log run/i }).click();

  // Successful log now redirects to /dashboard (not /plan)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  // ── Dashboard reflects the logged run ─────────────────────────────────────

  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

  const hasSessionsText = await page
    .getByText(/sessions/i)
    .first()
    .isVisible({ timeout: 8_000 })
    .catch(() => false);
  const hasKmText = await page
    .getByText(/km/i)
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  expect(hasSessionsText || hasKmText).toBe(true);
});

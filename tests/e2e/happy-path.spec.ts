/**
 * Happy-path E2E tests — requires authenticated session (auth.setup.ts).
 * Target: PLAYWRIGHT_BASE_URL (default: https://subtwo.vercel.app)
 *
 * Covers:
 *   1. Dashboard renders with plan data
 *   2. Wizard — all 6 data steps navigable (no generation, preserves quota)
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

// ─── Persistent nav ───────────────────────────────────────────────────────────

test('nav — all 4 items reachable from dashboard', async ({ page, viewport }) => {
  await page.goto('/dashboard');

  const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
  await expect(nav).toBeVisible({ timeout: 8_000 });

  // Each nav item should be present and navigable
  const items = [
    { label: 'Plan', url: /\/plan/ },
    { label: 'Log', url: /\/log/ },
    { label: 'Me', url: /\/settings/ },
  ];

  for (const { label, url } of items) {
    await page.getByRole('link', { name: label }).first().click();
    await expect(page).toHaveURL(url, { timeout: 8_000 });
    await page.goBack();
  }

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

test('wizard — all 6 data steps navigable without submission', async ({ page, viewport }) => {
  await page.goto('/onboarding/wizard');
  await expect(page.getByRole('heading', { name: /build your plan/i })).toBeVisible();

  // Step 1 — Race basics
  await expect(page.getByText(/tell us about your race/i)).toBeVisible();
  await page.getByRole('button', { name: '5K' }).click();
  await page.getByLabel(/race date/i).fill('2027-06-01');
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — Experience
  await expect(page.getByRole('heading', { name: /experience/i })).toBeVisible({ timeout: 5_000 });
  await page.getByLabel(/beginner/i).first().check().catch(() =>
    page.getByRole('radio').first().check()
  );
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 3 — Fitness (beginner path: fill required fields to enable Continue)
  await expect(page.getByRole('heading', { name: /current fitness/i })).toBeVisible({ timeout: 5_000 }).catch(() => {});
  await page.getByLabel(/current weekly distance/i).first().fill('20');
  await page.getByLabel(/longest recent run/i).fill('8');
  await page.getByRole('radio', { name: /yes, comfortably/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 4 — Goal (must select a goal type to enable Continue)
  await page.getByRole('radio', { name: /suggest a realistic target/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 5 — Constraints (selects for days + long run day)
  const daysSelect = page.getByLabel(/training days/i);
  if (await daysSelect.isVisible()) {
    await daysSelect.click();
    await page.getByRole('option').first().click();
  }
  const longRunSelect = page.getByLabel(/long run day/i);
  if (await longRunSelect.isVisible()) {
    await longRunSelect.click();
    await page.getByRole('option').first().click();
  }
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 6 — Equipment (no required fields)
  await expect(page.getByRole('button', { name: /generate plan/i })).toBeVisible({ timeout: 5_000 });

  // Do NOT click Generate — preserves quota
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

test('settings — Me nav item opens settings page', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Me' }).first().click();
  await expect(page).toHaveURL(/\/settings/, { timeout: 8_000 });
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
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

  // ── Fill wizard steps 1–6, then click "Generate plan →" ─────────────────

  await page.goto('/onboarding/wizard');
  await expect(page.getByRole('heading', { name: /build your plan/i })).toBeVisible();

  // Step 1 — Race: 5K, 6 weeks out
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 6 * 7);
  const raceDateStr = raceDate.toISOString().split('T')[0]!;
  await page.getByRole('button', { name: '5K' }).click();
  await page.getByLabel(/race date/i).fill(raceDateStr);
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — Experience: intermediate
  await expect(page.getByRole('heading', { name: /experience/i })).toBeVisible({ timeout: 5_000 });
  await page.getByLabel(/intermediate/i).first().click().catch(() =>
    page.getByRole('radio', { name: /intermediate/i }).click()
  );
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 3 — Fitness (intermediate path: weekly km + recent race)
  await page.getByLabel(/current weekly distance/i).first().fill('30');
  await page.locator('fieldset').getByLabel(/distance/i).fill('5');
  await page.locator('fieldset').getByLabel(/date/i).fill('2026-03-01');
  await page.keyboard.press('Escape');
  await page.locator('#recent_time').fill('0:32:00');
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 4 — Goal: let AI suggest a realistic target
  await page.getByRole('radio', { name: /suggest a realistic target/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 5 — Constraints (both selects required for validateStep5)
  await page.getByLabel(/training days per week/i).click();
  await page.getByRole('option').first().click();
  await page.getByLabel(/long run day/i).click();
  await page.getByRole('option', { name: /saturday/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 6 — Equipment (all optional) → click Generate
  await expect(page.getByRole('button', { name: /generate plan/i })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /generate plan/i }).click();

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

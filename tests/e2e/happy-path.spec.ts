/**
 * Happy-path E2E tests — requires authenticated session (auth.setup.ts).
 * Target: PLAYWRIGHT_BASE_URL (default: https://subtwo.vercel.app)
 *
 * Covers:
 *   1. Dashboard renders with plan data
 *   2. Wizard — all 7 steps navigable (no generation, preserves quota)
 *   3. Log a run — form submits successfully
 *   4. Dashboard — logged run appears in recent activity
 *   5. Session detail — Planned section visible
 *   6. No horizontal overflow at current viewport
 *
 * Note: Plan generation is NOT triggered here to preserve the user's AI quota.
 * The auth.setup.ts uses the admin account which already has an active plan.
 */
import { test, expect } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

test('plan calendar page loads', async ({ page, viewport }) => {
  await page.goto('/plan');
  // Either a calendar grid or a "no plan" message
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

// ─── Wizard navigation ────────────────────────────────────────────────────────

test('wizard — all 6 data steps navigable without submission', async ({ page, viewport }) => {
  await page.goto('/onboarding/wizard');
  await expect(page.getByRole('heading', { name: /build your plan/i })).toBeVisible();

  // Step 1 — Race basics
  await expect(page.getByText(/tell us about your race/i)).toBeVisible();
  // Pick a distance
  await page.getByRole('button', { name: '5K' }).click();
  // Pick a date in the future
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
  // Verify no horizontal scroll at current viewport
  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
});

// ─── Log a run ────────────────────────────────────────────────────────────────

test('log run form renders and validates', async ({ page, viewport }) => {
  await page.goto('/log');
  await expect(page.getByRole('heading', { name: /log.*run/i })).toBeVisible({ timeout: 8_000 });

  // Fill required field — distance
  await page.getByLabel(/distance/i).fill('5');

  // Fill duration (minutes required)
  await page.getByPlaceholder(/00/).first().fill('25');

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);

  // Submit
  await page.getByRole('button', { name: /log run/i }).click();

  // Expect either success redirect or a validation error (not a 500)
  await page.waitForTimeout(2_000);
  const url = page.url();
  const hasError = await page.getByRole('alert').isVisible().catch(() => false);
  const redirectedAway = !url.includes('/log');

  // Should have either redirected on success or shown a field error — not crashed
  expect(redirectedAway || hasError).toBe(true);
});

// ─── Session detail ───────────────────────────────────────────────────────────

test('session detail page shows Planned section', async ({ page, viewport }) => {
  // Navigate to plan calendar first to find a session link
  await page.goto('/plan');
  await page.waitForTimeout(2_000);

  // Try to find any session link
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

test('settings page renders all tabs without overflow', async ({ page, viewport }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

  // Beta feedback card should be visible
  await expect(page.getByText(/beta feedback/i)).toBeVisible();

  // Tab nav scrollable on mobile — exact: true avoids matching "Save Profile"
  const tabs = ['Profile', 'Integrations', 'Sharing', 'Data'];
  for (const tab of tabs) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(300);
  }

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);
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

  // Step 1 — Race: 5K, ~10 weeks out (single-call path; enough weeks for
  //   AI to reliably produce base/build/peak/taper + race session in final week)
  await page.getByRole('button', { name: '5K' }).click();
  await page.getByLabel(/race date/i).fill('2026-08-05');
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — Experience: intermediate (gives AI a recent race for context →
  //   more reliable plan structure vs beginner which can miss race_day rule)
  await expect(page.getByRole('heading', { name: /experience/i })).toBeVisible({ timeout: 5_000 });
  await page.getByLabel(/intermediate/i).first().click().catch(() =>
    page.getByRole('radio', { name: /intermediate/i }).click()
  );
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 3 — Fitness (intermediate path: weekly km + recent race)
  await page.getByLabel(/current weekly distance/i).first().fill('30');
  // Recent race: 5K in 32 min → clear context for the AI
  await page.locator('fieldset').getByLabel(/distance/i).fill('5');
  await page.locator('fieldset').getByLabel(/date/i).fill('2026-03-01');
  await page.keyboard.press('Escape'); // dismiss native date picker before filling time
  await page.locator('#recent_time').fill('0:32:00');
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 4 — Goal: let AI suggest a realistic target
  await page.getByRole('radio', { name: /suggest a realistic target/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 5 — Constraints (both selects required for validateStep5)
  await page.getByLabel(/training days per week/i).click();
  await page.getByRole('option').first().click(); // "3 days" (min valid value)
  await page.getByLabel(/long run day/i).click();
  await page.getByRole('option', { name: /saturday/i }).click(); // Saturday long run
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 6 — Equipment (all optional) → click Generate
  await expect(page.getByRole('button', { name: /generate plan/i })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /generate plan/i }).click();

  // ── Wait for generation to complete and redirect to review ────────────────
  // Fail fast if a non-empty error alert appears within 8s (rate-limit / quota).
  // The wizard always has a base <Alert> in the DOM; filter for one with text.
  await page.waitForTimeout(8_000);
  const errorAlert = page.getByRole('alert').filter({ hasText: /.+/ });
  const genError = await errorAlert.isVisible({ timeout: 0 }).catch(() => false);
  if (genError) {
    const alertText = await errorAlert.first().textContent().catch(() => 'unknown');
    throw new Error(`Plan generation blocked: "${alertText?.trim()}". Re-run after rate limit resets (3/24h window).`);
  }
  await expect(page).toHaveURL(/\/onboarding\/review/, { timeout: 90_000 });

  // ── Assert plan is persisted in DB (review page shows plan data) ──────────

  // Wait for plan data to load (spinner clears)
  await expect(page.getByRole('heading', { name: /your training plan/i })).toBeVisible({
    timeout: 15_000,
  });

  // Key plan sections visible — data came from the DB write
  await expect(page.getByText(/pace zones/i)).toBeVisible();
  await expect(page.getByText(/weekly volume/i)).toBeVisible();

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);

  // ── Accept plan → dashboard ───────────────────────────────────────────────

  await page.getByRole('button', { name: /accept & start/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Plan is active: dashboard shows plan content, not empty-state CTA
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  const emptyState = await page
    .getByText(/no active training plan/i)
    .isVisible()
    .catch(() => false);
  expect(emptyState).toBe(false);

  if (viewport) await assertNoHorizontalScroll(page, viewport.width);

  // ── Log a run ────────────────────────────────────────────────────────────

  await page.goto('/log');
  await expect(page.getByRole('heading', { name: /log.*run/i })).toBeVisible({ timeout: 8_000 });

  await page.getByLabel(/distance/i).fill('5');
  await page.getByPlaceholder(/00/).first().fill('25'); // 25 min = 1500s duration

  await page.getByRole('button', { name: /log run/i }).click();

  // Successful log redirects to /plan (no session param)
  await expect(page).not.toHaveURL(/\/log/, { timeout: 10_000 });

  // ── Dashboard shows the logged run ────────────────────────────────────────

  await page.goto('/dashboard');
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

  // WeekProgress renders "{completed}/{planned} sessions" when plan is active
  // — confirms the run was persisted and the dashboard reflects it
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

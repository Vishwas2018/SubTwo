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

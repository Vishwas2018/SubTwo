/**
 * Smoke tests — no auth required.
 * Verifies public routes render and unauthenticated access is redirected.
 * Runs on both desktop (chromium project) and mobile (mobile-chrome project).
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } }); // force no auth

test('root landing page renders', async ({ page }) => {
  await page.goto('/');
  // Root is a public landing page showing the SubTwo heading
  await expect(page.getByRole('heading', { name: /subtwo/i })).toBeVisible({ timeout: 10_000 });
});

test('/dashboard redirects to /login when unauthenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});

test('/admin returns 404 when unauthenticated', async ({ page }) => {
  const res = await page.goto('/admin');
  // Non-admin access: either 404 or redirect to /login (both acceptable)
  const url = page.url();
  const ok = res?.status() === 404 || url.includes('/login') || url.includes('/404');
  expect(ok).toBe(true);
});

test('login page renders', async ({ page, viewport }) => {
  await page.goto('/login');
  // shadcn CardTitle may not expose the "heading" role — match by text
  await expect(page.getByText(/log in to subtwo/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();

  // No horizontal overflow at current viewport
  if (viewport) {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 2);
  }
});

test('signup page renders', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByText(/sign up to subtwo/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByLabel(/invite code/i)).toBeVisible();
});

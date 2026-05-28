import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Load test env vars (SUPABASE_URL, SUPABASE_SERVICE_KEY, E2E_USER_EMAIL)
loadEnv({ path: '.env.test' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://subtwo.vercel.app';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // NODE_OPTIONS=--use-system-ca needed on this machine (corporate proxy)
    ignoreHTTPSErrors: false,
  },

  projects: [
    // Auth setup — runs first, saves session to disk
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },

    // Desktop Chromium — authenticated
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile viewport (Pixel 5 = 393px, Chromium) — authenticated
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright runs against the Vite dev server so the MSW worker and the
 * `window.__WORMAGE__` instrumentation are available.
 * `channel: 'chrome'` uses an installed Chrome instead of downloading browsers.
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 90_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1366, height: 820 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
});

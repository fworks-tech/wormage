import { expect, test } from '@playwright/test';

test('the home-screen manifest and its icons are served', async ({ page, request }) => {
  await page.goto('/project');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/manifest+json');

  const manifest = (await response.json()) as {
    start_url: string;
    scope: string;
    display: string;
    icons: Array<{ src: string }>;
  };
  expect(manifest.start_url).toBe('/demo');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');

  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.status(), icon.src).toBe(200);
    expect(asset.headers()['content-type'], icon.src).toContain('image/png');
  }

  const apple = await request.get('/icons/apple-touch-icon.png');
  expect(apple.status()).toBe(200);
  expect(apple.headers()['content-type']).toContain('image/png');
});

import { expect, test } from '@playwright/test';

const startMatch = async (page: import('@playwright/test').Page) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
};

type Box = { x: number; y: number; width: number; height: number };

const box = async (page: import('@playwright/test').Page, selector: string): Promise<Box> => {
  const found = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, selector);
  if (!found) throw new Error(`no box for ${selector}`);
  return found;
};

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const expectTarget = (boxValue: Box, label: string) => {
  expect(boxValue.width, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(boxValue.height, `${label} height`).toBeGreaterThanOrEqual(44);
};

const checkViewport = async (page: import('@playwright/test').Page, viewport: { width: number; height: number }) => {
  await startMatch(page);

  const jump = page.getByTestId('btn-jump');
  await expect(jump).toBeVisible();
  expectTarget(await box(page, '[aria-label="Aim up"]'), 'aim up');
  expectTarget(await box(page, '[aria-label="Aim down"]'), 'aim down');
  expectTarget(await box(page, '[data-testid="btn-end-turn"]'), 'end turn');
  expectTarget(await box(page, '[data-testid="btn-pause"]'), 'pause');
  expectTarget(await box(page, '[data-testid="btn-jump"]'), 'jump');
  expectTarget(await box(page, '[data-testid="weapon-bazooka"]'), 'weapon');
  expectTarget(await box(page, '[data-testid="btn-rope"]'), 'rope');
  expectTarget(await box(page, '[data-testid="btn-fire"]'), 'fire');

  await expect(page.locator('.power-wrap')).toBeHidden();
  await expect(page.getByTestId('btn-fire')).toContainText('hold');

  const cards = await Promise.all([
    box(page, '[data-testid="team-panel-0"]'),
    box(page, '[data-testid="team-panel-1"]'),
  ]);
  expect(Math.abs(cards[0].width - cards[1].width), 'team cards match').toBeLessThanOrEqual(1);
  await expect(page.getByTestId('hud-wind')).toBeVisible();
  await expect(page.getByTestId('hud-wind')).toHaveAttribute('aria-label', /^Wind: /);
  const windGauge = await box(page, '[data-testid="hud-wind"]');
  expect(windGauge.width, 'wind gauge width').toBeLessThanOrEqual(89);
  expect(windGauge.height, 'wind gauge height').toBeLessThanOrEqual(26);

  const top = [
    '[data-testid="team-panel-0"]',
    '[data-testid="team-panel-1"]',
    '[data-testid="btn-pause"]',
    '.turn-block',
  ];
  const topBoxes = await Promise.all(top.map((selector) => box(page, selector)));
  for (let i = 0; i < topBoxes.length; i += 1) {
    for (let j = i + 1; j < topBoxes.length; j += 1) {
      expect(overlaps(topBoxes[i], topBoxes[j]), `${top[i]} overlaps ${top[j]}`).toBe(false);
    }
  }

  const bottom = '.hud-bottom';
  const bottomBox = await box(page, bottom);
  expect(bottomBox.y + bottomBox.height, 'bottom HUD inside viewport').toBeLessThanOrEqual(viewport.height);

  const controls = [
    '[data-testid="btn-left"]',
    '[aria-label="Aim up"]',
    '[aria-label="Aim down"]',
    '[data-testid="btn-right"]',
    '[data-testid="btn-jump"]',
    '[data-testid="btn-fire"]',
    '[data-testid="btn-end-turn"]',
  ];
  const controlBoxes = await Promise.all(controls.map((selector) => box(page, selector)));
  for (let i = 0; i < controlBoxes.length; i += 1) {
    for (let j = i + 1; j < controlBoxes.length; j += 1) {
      expect(overlaps(controlBoxes[i], controlBoxes[j]), `${controls[i]} overlaps ${controls[j]}`).toBe(false);
    }
  }

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width);

  return { bottomBox };
};

test.describe('HUD layout 412x839', () => {
  test.use({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 });

  test('portrait 412', async ({ page }) => {
    const { bottomBox } = await checkViewport(page, { width: 412, height: 839 });
    expect(bottomBox.height).toBeLessThanOrEqual(170);
  });
});

test.describe('HUD layout 390x664', () => {
  test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test('portrait 390', async ({ page }) => {
    const { bottomBox } = await checkViewport(page, { width: 390, height: 664 });
    expect(bottomBox.height).toBeLessThanOrEqual(170);
  });
});

test.describe('HUD layout 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('portrait 360', async ({ page }) => {
    const { bottomBox } = await checkViewport(page, { width: 360, height: 640 });
    expect(bottomBox.height).toBeLessThanOrEqual(170);
  });
});

test.describe('HUD layout 915x412 landscape', () => {
  test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 });

  test('landscape 915', async ({ page }) => {
    const { bottomBox } = await checkViewport(page, { width: 915, height: 412 });
    expect(bottomBox.height).toBeLessThanOrEqual(105);

    const cards = await page.locator('.weapon-card').evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();
        return { x: +rect.x.toFixed(1), y: +rect.y.toFixed(1), w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) };
      }),
    );
    expect(new Set(cards.map((card) => card.y)).size, 'weapon cards in one row').toBe(1);
    expect(Math.max(...cards.map((card) => card.h))).toBeGreaterThanOrEqual(44);
    expect((await box(page, '.weapon-dock')).height).toBeLessThanOrEqual(52);
  });
});

test('the desktop HUD hides the touch controls and centers the weapon dock', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop-only layout');
  await startMatch(page);

  const [mine, theirs] = await Promise.all([
    box(page, '[data-testid="team-panel-0"]'),
    box(page, '[data-testid="team-panel-1"]'),
  ]);
  expect(Math.abs(mine.width - theirs.width), 'team cards match').toBeLessThanOrEqual(1);
  const gauge = page.getByTestId('hud-wind');
  await expect(gauge).toBeVisible();

  // One ribbon for calm, two for breeze, three for gust/gale: strength is not colour-only.
  const winds = [
    { wind: 0, label: 'calm', ribbons: 1 },
    { wind: -20, label: 'breeze ←', ribbons: 2 },
    { wind: 60, label: 'gust →', ribbons: 3 },
    { wind: -90, label: 'gale ←', ribbons: 3 },
  ];
  for (const { wind, label, ribbons } of winds) {
    await page.evaluate((value) => {
      (window as never as { __WORMAGE__: { engine: { wind: number } } }).__WORMAGE__.engine.wind = value;
    }, wind);
    await expect(gauge).toHaveAttribute('aria-label', `Wind: ${label}`);
    await expect(gauge).toHaveClass(new RegExp(`wind-${label.split(' ')[0]}\\b`));
    await expect(gauge.locator('.wind-ribbon')).toHaveCount(ribbons);
    const mirrored = (await gauge.getAttribute('class'))?.includes('wind-left') ?? false;
    expect(mirrored, `${label} direction`).toBe(wind < 0);
  }

  for (const id of ['btn-pause', 'btn-left', 'btn-right', 'btn-jump', 'btn-fire', 'btn-end-turn']) {
    await expect(page.getByTestId(id)).toBeHidden();
  }
  await expect(page.getByTestId('weapon-bazooka')).toBeVisible();
  await expect(page.getByTestId('btn-rope')).toBeVisible();

  const dock = await box(page, '.weapon-dock');
  expect(Math.abs(dock.x + dock.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);

  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');
  expect((await page.evaluate(() => (window as never as { __WORMAGE__: { snapshot: () => { phase: string } } }).__WORMAGE__.snapshot())).phase).not.toBe('aim');

  await page.keyboard.press('p');
  await expect(page.getByTestId('btn-resume')).toBeVisible();
  await expect(page.getByTestId('btn-controls')).toBeVisible();
});

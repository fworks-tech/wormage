import { expect, test } from '@playwright/test';

type Snapshot = {
  phase: string;
  turn: number;
  activeTeam: number;
  charging: boolean;
  power: number;
};

const startMatch = async (page: import('@playwright/test').Page) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
};

const snapshot = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot());

const centerOf = async (page: import('@playwright/test').Page, testId: string) => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`no box for ${testId}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.describe('touch HUD', () => {
  test.use({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 });

  test('a tap on the arena aims without firing', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const arena = await centerOf(page, 'arena');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [arena] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);

    expect((await snapshot(page)).phase).toBe('aim');
  });

  test('a two-pixel jitter on the arena does not fire', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const arena = await centerOf(page, 'arena');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [arena] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: arena.x + 2, y: arena.y + 2 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);

    expect((await snapshot(page)).phase).toBe('aim');
  });

  test('a deliberate drag on the arena fires', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const arena = await centerOf(page, 'arena');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [arena] });
    for (let i = 1; i <= 4; i += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: arena.x + i * 6, y: arena.y - i * 4 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);

    expect((await snapshot(page)).phase).not.toBe('aim');
  });

  test('a cancelled arena touch does not fire', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const arena = await centerOf(page, 'arena');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [arena] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: arena.x + 40, y: arena.y - 30 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForTimeout(150);

    expect((await snapshot(page)).phase).toBe('aim');
  });

  test('a cancelled FIRE touch cancels the charge instead of firing', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const fire = await centerOf(page, 'btn-fire');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fire] });
    await page.waitForFunction(
      () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().charging,
    );
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForTimeout(150);

    const after = await snapshot(page);
    expect(after.phase).toBe('aim');
    expect(after.charging).toBe(false);
    expect(after.power).toBe(0);
  });

  test('a foreign pointerup does not release the charge', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const fire = await centerOf(page, 'btn-fire');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fire] });
    await page.waitForFunction(
      () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().charging,
    );

    // A second finger lifting elsewhere must not release the held shot.
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99 })));
    await page.waitForTimeout(100);
    expect((await snapshot(page)).phase).toBe('aim');
    expect((await snapshot(page)).charging).toBe(true);

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  });

  test('an arena release during a charge does not fire', async ({ page }) => {
    await startMatch(page);
    await page.evaluate(() =>
      (window as never as { __WORMAGE__: { engine: { startCharge: () => void } } }).__WORMAGE__.engine.startCharge(),
    );
    const arena = await centerOf(page, 'arena');

    await page.mouse.move(arena.x - 40, arena.y);
    await page.mouse.down();
    await page.mouse.move(arena.x + 40, arena.y - 20, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    expect((await snapshot(page)).phase).toBe('aim');
    await page.evaluate(() =>
      (window as never as { __WORMAGE__: { engine: { cancelCharge: () => void } } }).__WORMAGE__.engine.cancelCharge(),
    );
  });

  test('releasing FIRE still fires', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const fire = await centerOf(page, 'btn-fire');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fire] });
    await page.waitForTimeout(250);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);

    expect((await snapshot(page)).phase).not.toBe('aim');
  });

  test('the FIRE button shows the charge percentage', async ({ page }) => {
    await startMatch(page);
    const cdp = await page.context().newCDPSession(page);
    const fire = await centerOf(page, 'btn-fire');

    await expect(page.getByTestId('btn-fire')).toContainText('hold');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fire] });
    await page.waitForFunction(
      () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().charging,
    );
    await expect(page.getByTestId('btn-fire')).toContainText('%');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  });
});

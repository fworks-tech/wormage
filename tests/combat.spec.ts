import { expect, test } from '@playwright/test';

type Snapshot = {
  phase: string;
  turn: number;
  activeTeam: number;
  activeWormId: string;
  power: number;
  weapon: string;
  timeLeft: number;
  teams: Array<{ hp: number; worms: Array<{ alive: boolean; x: number; y: number }> }>;
};

const startMatch = async (page: import('@playwright/test').Page) => {
  await page.goto('/?seed=4242');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGEDDON__?: unknown }).__WORMAGEDDON__));
};

const snapshot = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as never as { __WORMAGEDDON__: { snapshot: () => Snapshot } }).__WORMAGEDDON__.snapshot());

test('firing runs a projectile and hands the turn to the AI', async ({ page }) => {
  await startMatch(page);
  const before = await snapshot(page);
  expect(before.phase).toBe('aim');
  expect(before.activeTeam).toBe(0);
  expect(before.teams[0].hp).toBe(300);

  await page.getByTestId('btn-fire').click();
  await page.waitForTimeout(150);
  expect(['projectile', 'settle']).toContain((await snapshot(page)).phase);

  await page.waitForFunction(() => (window as never as { __WORMAGEDDON__: { snapshot: () => Snapshot } }).__WORMAGEDDON__.snapshot().turn >= 2, undefined, { timeout: 15000 });
  const after = await snapshot(page);
  expect(after.activeTeam).toBe(1);
});

test('walking changes the worm x position and respects the arena edge', async ({ page }) => {
  await startMatch(page);
  const before = await snapshot(page);
  const startX = before.teams[0].worms.find((w) => w.alive)!.x;

  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  const moved = await snapshot(page);
  const movedX = moved.teams[0].worms.find((w) => w.alive)!.x;
  expect(movedX).toBeGreaterThan(startX);

  await page.keyboard.down('a');
  await page.waitForTimeout(2500);
  await page.keyboard.up('a');
  const edge = await snapshot(page);
  expect(edge.teams[0].worms.find((w) => w.alive)!.x).toBeGreaterThanOrEqual(12);
});

test('weapon selection follows ammo and keyboard shortcuts', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('weapon-dynamite').click();
  expect((await snapshot(page)).weapon).toBe('dynamite');

  await page.keyboard.press('1');
  expect((await snapshot(page)).weapon).toBe('bazooka');
});

test('pause freezes the turn timer until resumed', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-pause').click();
  await expect(page.getByTestId('btn-resume')).toBeVisible();
  const frozen = (await snapshot(page)).timeLeft;
  await page.waitForTimeout(900);
  expect((await snapshot(page)).timeLeft).toBe(frozen);

  await page.getByTestId('btn-resume').click();
  await page.waitForTimeout(700);
  expect((await snapshot(page)).timeLeft).toBeLessThan(frozen);
});

test('ending the turn switches sides without damage', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-end-turn').click();
  await page.waitForFunction(() => (window as never as { __WORMAGEDDON__: { snapshot: () => Snapshot } }).__WORMAGEDDON__.snapshot().turn === 2, undefined, { timeout: 5000 });
  const after = await snapshot(page);
  expect(after.activeTeam).toBe(1);
  expect(after.teams[0].hp).toBe(300);
  expect(after.teams[1].hp).toBe(300);
});

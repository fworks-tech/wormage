import { describe, expect, test } from 'vitest';
import { GameEngine } from '../../src/game/engine';
import { ROPE } from '../../src/game/config';
import type { AiTerrain } from '../../src/game/ai';
import type { MatchConfig, Worm } from '../../src/game/types';
import { openTerrain } from './terrainFixture';

const config = (overrides: Partial<MatchConfig> = {}): MatchConfig => ({
  turnSeconds: 30,
  wind: 'light',
  difficulty: 'veteran',
  seed: 4242,
  wormsPerTeam: 3,
  ...overrides,
});

const DT = 1 / 60;
const step = (engine: GameEngine, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i += 1) engine.update(DT);
};

/** Flat ground at y = 500 plus a solid wall from `wallX` upward. */
const wall = (wallX: number) => {
  const state = { solid: true };
  return {
    state,
    isSolid: (x: number, y: number) => y >= 500 || (state.solid && x >= wallX),
    groundY: (_x: number, fromY: number, maxDown = 260) =>
      fromY <= 500 && fromY + maxDown >= 500 ? 500 : null,
  };
};

/** A ceiling at y = 300 over x = 300..500, so a vertical rope hangs straight down. */
const ceiling = {
  isSolid: (x: number, y: number) => y >= 500 || (x >= 300 && x <= 500 && y <= 300),
  groundY: (_x: number, fromY: number, maxDown = 260) =>
    fromY <= 500 && fromY + maxDown >= 500 ? 500 : null,
};

const setup = (t: AiTerrain = wall(520)) => {
  const engine = new GameEngine(config());
  Object.assign(engine.terrain, t);
  const worm = engine.activeWorm!;
  worm.x = 400;
  worm.y = 500;
  worm.vx = 0;
  worm.vy = 0;
  worm.onGround = true;
  worm.airborne = false;
  worm.fallDistance = 0;
  worm.facing = 1;
  worm.aimAngle = -0.9;
  return {
    engine,
    worm,
    state: (t as { state?: { solid: boolean } }).state ?? null,
  };
};

describe('anchored rope', () => {
  test('attaches to the first terrain on the aim ray', () => {
    const { engine, worm } = setup();

    engine.useRope();

    const rope = worm.rope!;
    expect(rope).not.toBeNull();
    expect(rope.anchorX).toBeGreaterThanOrEqual(520);
    const chestDistance = Math.hypot(worm.x - rope.anchorX, worm.y - 14 - rope.anchorY);
    expect(chestDistance).toBeCloseTo(rope.length, 0);
    expect(engine.snapshot().ropeAttached).toBe(true);
  });

  test('does not attach when the aim ray meets no terrain', () => {
    const engine = new GameEngine(config());
    Object.assign(engine.terrain, openTerrain);
    const worm = engine.activeWorm!;

    engine.useRope();

    expect(worm.rope).toBeNull();
  });

  test('does not attach beyond the rope range', () => {
    const { engine, worm } = setup(wall(400 + ROPE.range + 80));

    engine.useRope();

    expect(worm.rope).toBeNull();
  });

  test('reeling in shortens the rope and raises the worm', () => {
    const { engine, worm } = setup();
    engine.useRope();
    const initialLength = worm.rope!.length;
    const initialY = worm.y;

    engine.setReel(-1);
    step(engine, 0.2);

    expect(worm.rope!.length).toBeLessThan(initialLength - 20);
    expect(worm.y).toBeLessThan(initialY);
  });

  test('holding a direction swings the worm sideways', () => {
    const { engine, worm } = setup(ceiling);
    engine.useRope();
    const initialX = worm.x;

    engine.setMove(1);
    step(engine, 0.2);

    expect(worm.x).toBeGreaterThan(initialX + 10);
  });

  test('letting go keeps the swing momentum', () => {
    const { engine, worm } = setup(ceiling);
    engine.useRope();
    engine.setMove(1);
    step(engine, 0.3);

    engine.jump();

    expect(worm.rope).toBeNull();
    expect(Math.abs(worm.vx)).toBeGreaterThan(0);
    expect(engine.snapshot().ropeAttached).toBe(false);
  });

  test('a carved anchor drops the rope', () => {
    const { engine, worm, state } = setup();

    engine.useRope();
    state!.solid = false;
    step(engine, DT);

    expect(worm.rope).toBeNull();
  });

  test('death clears the rope', () => {
    const { engine, worm } = setup();
    engine.useRope();
    const internals = engine as unknown as {
      hurt(worm: Worm, amount: number, x: number, y: number, team: number): void;
    };

    internals.hurt(worm, 999, worm.x, worm.y, 1);

    expect(worm.rope).toBeNull();
  });

  test('ending the turn clears the rope', () => {
    const { engine, worm } = setup();
    engine.useRope();

    engine.endTurn();

    expect(worm.rope).toBeNull();
    expect(engine.activeWorm!.rope).toBeNull();
  });

  test('the player rope action cannot attach the AI worm', () => {
    const { engine } = setup();
    engine.endTurn();
    const aiWorm = engine.activeWorm!;
    aiWorm.aimAngle = -0.9;

    engine.useRope();

    expect(aiWorm.rope).toBeNull();
  });

  test('replay records the rope and reel actions', () => {
    const { engine } = setup();

    engine.record({ type: 'rope' });
    engine.record({ type: 'reel', dir: -1 });

    expect(engine.log[0].action).toEqual({ type: 'rope' });
    expect(engine.log[1].action).toEqual({ type: 'reel', dir: -1 });
  });

  test('the AI ropes a ledge above jump reach instead of hopping', () => {
    const engine = new GameEngine(config());
    // An 80 px plateau with a pillar rising above it: high enough to need the
    // rope, with a face the AI can anchor to.
    const ledge = {
      isSolid: (x: number, y: number) =>
        y >= 500 || (x >= 520 && y >= 420) || (x >= 560 && x <= 580 && y >= 200),
      groundY: (x: number, fromY: number, maxDown = 260) => {
        const top = x >= 560 && x <= 580 ? 200 : x >= 520 ? 420 : 500;
        const start = Math.max(top, Math.ceil(fromY / 4) * 4);
        return start <= fromY + maxDown ? start : null;
      },
    };
    Object.assign(engine.terrain, ledge);
    engine.endTurn();
    const worm = engine.activeWorm!;
    worm.x = 400;
    worm.y = 500;
    worm.vy = 0;
    worm.onGround = true;
    worm.airborne = false;
    worm.fallDistance = 0;

    const internals = engine as unknown as {
      aiPlan: {
        weapon: 'bazooka';
        fireX: number;
        fireY: number;
        angle: number;
        power: number;
        retreatX: number;
      } | null;
      aiThinking: boolean;
    };
    internals.aiPlan = {
      weapon: 'bazooka',
      fireX: 600,
      fireY: 420,
      angle: -0.5,
      power: 0.5,
      retreatX: 400,
    };
    internals.aiThinking = false;

    step(engine, 1.2);

    expect(worm.rope).not.toBeNull();
    expect(engine.events.filter((event) => event.type === 'rope')).toHaveLength(1);
    expect(engine.events.filter((event) => event.type === 'jump')).toHaveLength(0);
  });
});

import { describe, expect, test } from 'vitest';
import { GameEngine } from '../../src/game/engine';
import type { MatchConfig } from '../../src/game/types';
import { terrain } from './terrainFixture';

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

/** Flat ground at y = 500 so a jump arc is independent of the generated island. */
const flatEngine = () => {
  const engine = new GameEngine(config());
  Object.assign(engine.terrain, terrain());
  const worm = engine.activeWorm!;
  worm.x = 400;
  worm.y = 500;
  worm.vy = 0;
  worm.onGround = true;
  worm.airborne = false;
  worm.fallDistance = 0;
  return { engine, worm };
};

describe('jump physics', () => {
  test('a jump with a held direction carries the worm forward or back', () => {
    const front = flatEngine();
    front.engine.jump(1);
    step(front.engine, 0.4);
    expect(front.worm.x).toBeGreaterThan(430);

    const back = flatEngine();
    back.engine.jump(-1);
    step(back.engine, 0.4);
    expect(back.worm.x).toBeLessThan(370);
  });

  test('a second jump in the air flips to a higher apex', () => {
    const single = flatEngine();
    single.engine.jump(0);
    let singleApex = single.worm.y;
    for (let i = 0; i < 120; i += 1) {
      single.engine.update(DT);
      singleApex = Math.min(singleApex, single.worm.y);
      if (single.worm.onGround && i > 5) break;
    }

    const double = flatEngine();
    double.engine.jump(0);
    step(double.engine, 0.35);
    double.engine.jump(0);
    let doubleApex = double.worm.y;
    for (let i = 0; i < 120; i += 1) {
      double.engine.update(DT);
      doubleApex = Math.min(doubleApex, double.worm.y);
      if (double.worm.onGround && i > 5) break;
    }

    expect(doubleApex).toBeLessThan(singleApex - 40);
  });

  test('a turn allows unlimited jumps', () => {
    const { engine } = flatEngine();
    for (let i = 0; i < 6; i += 1) engine.jump(0);

    expect(engine.events.filter((event) => event.type === 'jump')).toHaveLength(6);
  });

  test('jumping is legal after firing, while the projectile is in flight', () => {
    const { engine, worm } = flatEngine();
    engine.fire();
    expect(engine.phase).toBe('projectile');
    expect(engine.retreatActive).toBe(true);

    engine.jump(0);

    expect(worm.vy).toBeLessThan(0);
    expect(engine.events.some((event) => event.type === 'jump')).toBe(true);
  });

  test('repeated flips never leave the top of the world', () => {
    const { engine, worm } = flatEngine();
    worm.y = 20;
    for (let i = 0; i < 20; i += 1) {
      engine.jump(0);
      engine.update(DT);
    }

    expect(worm.y).toBeGreaterThanOrEqual(0);
  });

  test('a dead worm cannot jump', () => {
    const { engine, worm } = flatEngine();
    worm.alive = false;
    engine.jump(0);

    expect(engine.events.some((event) => event.type === 'jump')).toBe(false);
  });

  test('a replay records the jump direction', () => {
    const { engine, worm } = flatEngine();
    engine.record({ type: 'jump', dir: -1 });

    expect(engine.log[0].action).toEqual({ type: 'jump', dir: -1 });
    expect(worm.vx).toBeLessThan(0);
  });

  test('the AI jumps when its walk is blocked', () => {
    const engine = new GameEngine(config());
    const blockedX = 1200;
    Object.assign(engine.terrain, terrain(blockedX));
    engine.endTurn();
    expect(engine.activeTeam).toBe(1);

    const worm = engine.activeWorm!;
    worm.y = 500;
    worm.vy = 0;
    worm.onGround = true;
    worm.airborne = false;
    worm.fallDistance = 0;

    // A plan beyond the wall forces the AI to walk into it and stall.
    const internals = engine as unknown as {
      aiPlan: { weapon: 'bazooka'; fireX: number; angle: number; power: number; retreatX: number } | null;
      aiThinking: boolean;
    };
    internals.aiPlan = {
      weapon: 'bazooka',
      fireX: blockedX + 100,
      angle: -0.5,
      power: 0.5,
      retreatX: worm.x,
    };
    internals.aiThinking = false;

    step(engine, 2.5);

    expect(engine.events.some((event) => event.type === 'jump')).toBe(true);
  });
});

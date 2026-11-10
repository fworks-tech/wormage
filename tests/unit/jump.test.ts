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

  test('a jump in the air is ignored', () => {
    const { engine, worm } = flatEngine();
    engine.jump(0);
    step(engine, 0.2);
    const vy = worm.vy;
    const jumps = engine.events.filter((event) => event.type === 'jump').length;

    engine.jump(0);

    expect(worm.vy).toBe(vy);
    expect(engine.events.filter((event) => event.type === 'jump')).toHaveLength(jumps);
  });

  test('holding a direction steers a vertical jump in the air', () => {
    const { engine, worm } = flatEngine();
    engine.jump(0);
    step(engine, 0.15);
    const startX = worm.x;

    engine.setMove(1);
    step(engine, 0.3);

    expect(worm.onGround).toBe(false);
    expect(worm.x).toBeGreaterThan(startX + 30);
  });

  test('a worm must land before it can jump again', () => {
    const { engine, worm } = flatEngine();
    engine.jump(0);
    step(engine, 1.2);
    expect(worm.onGround).toBe(true);

    engine.jump(0);

    expect(engine.events.filter((event) => event.type === 'jump')).toHaveLength(2);
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

  test('the player jump action cannot move the AI worm', () => {
    const engine = new GameEngine(config());
    engine.endTurn();
    expect(engine.activeTeam).toBe(1);

    const worm = engine.activeWorm!;
    engine.jump(1);

    expect(worm.vy).toBe(0);
    expect(engine.events.some((event) => event.type === 'jump')).toBe(false);
  });

  test('the AI does not jump at a ledge above jump reach', () => {
    const engine = new GameEngine(config());
    Object.assign(engine.terrain, {
      isSolid: (x: number, y: number) => y >= (x >= 460 ? 420 : 500),
      groundY: (x: number, fromY: number, maxDown = 260) => {
        const top = x >= 460 ? 420 : 500;
        const start = Math.max(top, Math.ceil(fromY / 4) * 4);
        return start <= fromY + maxDown ? start : null;
      },
    });
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
      fireX: 500,
      fireY: 420,
      angle: -0.5,
      power: 0.5,
      retreatX: worm.x,
    };
    internals.aiThinking = false;

    step(engine, 2.5);

    expect(engine.events.filter((event) => event.type === 'jump')).toHaveLength(0);
    expect(engine.hasFired).toBe(true);
  });

  test('the AI fires instead of jumping when its firing spot vanished', () => {
    const engine = new GameEngine(config());
    Object.assign(engine.terrain, {
      isSolid: (x: number) => x >= 430,
      groundY: (x: number) => (x >= 430 ? null : 500),
    });
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
      fireX: 500,
      fireY: 500,
      angle: -0.5,
      power: 0.5,
      retreatX: worm.x,
    };
    internals.aiThinking = false;

    step(engine, 2.5);

    expect(engine.events.filter((event) => event.type === 'jump')).toHaveLength(0);
    expect(engine.hasFired).toBe(true);
  });

  test('the AI keeps jumping while its walk is blocked', () => {
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
      fireX: blockedX + 100,
      fireY: 500,
      angle: -0.5,
      power: 0.5,
      retreatX: worm.x,
    };
    internals.aiThinking = false;

    step(engine, 5.2);

    expect(engine.events.filter((event) => event.type === 'jump').length).toBeGreaterThan(2);
  });
});

import { describe, expect, test } from 'vitest';
import { blastFalloff, GameEngine } from '../../src/game/engine';
import { WIND_ACCEL, WEAPONS, WORM } from '../../src/game/config';
import type { MatchConfig } from '../../src/game/types';

const config = (overrides: Partial<MatchConfig> = {}): MatchConfig => ({
  turnSeconds: 30,
  wind: 'light',
  difficulty: 'veteran',
  seed: 4242,
  wormsPerTeam: 3,
  ...overrides,
});

/** Drive the engine the way GameView does: whole 60 Hz steps only. */
const DT = 1 / 60;
const step = (engine: GameEngine, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i += 1) engine.update(DT);
};

describe('engine rules without a browser', () => {
  test('constructs a seeded match with no DOM', () => {
    const engine = new GameEngine(config());
    expect(engine.phase).toBe('aim');
    expect(engine.teams.map((team) => team.worms.length)).toEqual([3, 3]);
    expect(engine.activeWorm?.alive).toBe(true);
    expect(engine.timeLeft).toBe(30);
  });

  test('ending a turn hands play over and re-scopes the clock and wind', () => {
    const engine = new GameEngine(config({ wind: 'strong' }));
    engine.endTurn();
    expect(engine.activeTeam).toBe(1);
    expect(engine.turn).toBe(2);
    expect(engine.timeLeft).toBe(30);
    expect(Math.abs(engine.wind)).toBeLessThanOrEqual(WIND_ACCEL.strong);
  });

  test('wind never exceeds the ruleset maximum', () => {
    const engine = new GameEngine(config({ wind: 'light' }));
    for (let i = 0; i < 10; i += 1) {
      engine.endTurn();
      expect(Math.abs(engine.wind)).toBeLessThanOrEqual(WIND_ACCEL.light);
    }
  });

  test('wind is calm when the ruleset turns it off', () => {
    const engine = new GameEngine(config({ wind: 'off' }));
    engine.endTurn();
    expect(engine.wind).toBe(0);
  });

  test('firing spends limited ammo but not the bazooka', () => {
    const engine = new GameEngine(config());
    engine.fire();
    expect(engine.teams[0].ammo.bazooka).toBe(Infinity);

    const second = new GameEngine(config());
    second.selectWeapon('dynamite');
    second.fire();
    expect(second.teams[0].ammo.dynamite).toBe((WEAPONS.dynamite.ammo ?? 0) - 1);
  });

  test('a wipeout ends the match and scores the survivor', () => {
    const engine = new GameEngine(config());
    const shooter = engine.activeWorm;
    expect(shooter).not.toBeNull();
    for (const worm of engine.teams[1].worms) {
      worm.x = shooter!.x;
      worm.y = shooter!.y;
      worm.hp = 1;
    }
    engine.selectWeapon('dynamite');
    engine.fire();
    step(engine, 4);

    expect(engine.phase).toBe('gameover');
    expect(engine.winnerTeam).toBe(0);
    expect(engine.endReason).toBe('wipeout');
    expect(engine.kills[0]).toBe(3);
  });

  test('surrender hands the win away and scoring rewards the winner', () => {
    const engine = new GameEngine(config());
    expect(engine.scoreFor(0)).toBe(300);
    engine.surrender();
    expect(engine.phase).toBe('gameover');
    expect(engine.winnerTeam).toBe(1);
    expect(engine.endReason).toBe('surrender');
    expect(engine.scoreFor(1)).toBe(300 + 150 + 420);
  });
});

describe('blast damage', () => {
  const reach = WEAPONS.bazooka.radius + WORM.radius;

  test('falls off linearly from full damage at the centre', () => {
    expect(blastFalloff(0, reach)).toBeCloseTo(1);
    expect(blastFalloff(reach / 2, reach)).toBeCloseTo(0.5);
  });

  test('never drops below 22%, even outside the radius', () => {
    expect(blastFalloff(reach, reach)).toBeCloseTo(0.22);
    expect(blastFalloff(reach * 4, reach)).toBe(0.22);
  });
});

import { expect, test } from 'vitest';
import { planAiShot } from '../../src/game/ai';
import { GameEngine } from '../../src/game/engine';
import type { MatchConfig } from '../../src/game/types';

const DT = 1 / 60;
const MAX_TICKS = 60 * 180;

const config = (): MatchConfig => ({
  turnSeconds: 30,
  wind: 'light',
  difficulty: 'veteran',
  seed: 777,
  wormsPerTeam: 3,
});

/**
 * Play one match through recorded inputs: a walk, a low grenade that bounces,
 * then bazooka shots planned by the legacy solver until the match ends.
 */
function recordMatch(): GameEngine {
  const engine = new GameEngine(config());
  let lastTurn = -1;
  let plan: { angle: number; power: number } | null = null;
  let grenadeThrown = false;

  const tick = () => engine.update(DT);

  while (engine.phase !== 'gameover' && engine.tick < MAX_TICKS) {
    if (engine.phase === 'aim' && !engine.teams[engine.activeTeam].isAi) {
      if (engine.turn !== lastTurn) {
        lastTurn = engine.turn;
        const shooter = engine.activeWorm;
        if (!shooter) {
          tick();
          continue;
        }
        if (!grenadeThrown) {
          grenadeThrown = true;
          engine.record({ type: 'move', dir: 1 });
          for (let i = 0; i < 20; i += 1) tick();
          engine.record({ type: 'move', dir: 0 });
          engine.record({ type: 'weapon', id: 'grenade' });
          engine.record({ type: 'aim', delta: -0.1 - shooter.aimAngle });
          engine.record({ type: 'startCharge' });
          for (let i = 0; i < 10; i += 1) tick();
          engine.record({ type: 'releaseCharge' });
          continue;
        }
        const target = engine.teams[1].worms
          .filter((worm) => worm.alive)
          .sort(
            (a, b) =>
              Math.hypot(a.x - shooter.x, a.y - shooter.y) - Math.hypot(b.x - shooter.x, b.y - shooter.y),
          )[0];
        if (target) {
          plan = planAiShot(
            engine.terrain,
            shooter.x,
            shooter.y,
            target.x,
            target.y,
            engine.wind,
            { angleError: 0, powerError: 0 },
            () => 0.5,
            engine.teams.flatMap((team) => team.worms).filter((worm) => worm.alive && worm.id !== shooter.id),
          );
          engine.record({ type: 'aim', delta: plan.angle - shooter.aimAngle });
          engine.record({ type: 'weapon', id: 'bazooka' });
          engine.record({ type: 'startCharge' });
        }
        continue;
      }
      if (plan && engine.charging && engine.power >= plan.power) {
        engine.record({ type: 'releaseCharge' });
        plan = null;
      }
    }
    tick();
  }

  return engine;
}

test('a recorded match replays to the same final snapshot', () => {
  const live = recordMatch();

  expect(live.phase).toBe('gameover');
  expect(live.endReason).toBe('wipeout');
  expect(live.log.some((entry) => entry.action.type === 'move')).toBe(true);
  expect(live.events.some((event) => event.type === 'bounce')).toBe(true);
  expect(live.kills[0] + live.kills[1]).toBeGreaterThan(0);

  const replay = new GameEngine(config());
  let cursor = 0;
  while (replay.phase !== 'gameover' && replay.tick < MAX_TICKS) {
    while (cursor < live.log.length && live.log[cursor].tick === replay.tick) {
      replay.applyAction(live.log[cursor].action);
      cursor += 1;
    }
    replay.update(DT);
  }

  expect(replay.tick).toBe(live.tick);
  expect(replay.snapshot()).toEqual(live.snapshot());
  expect(replay.winnerTeam).toBe(live.winnerTeam);
  expect(replay.endReason).toBe(live.endReason);
  expect(replay.kills).toEqual(live.kills);
  expect(replay.elapsed).toBeCloseTo(live.elapsed, 10);
});

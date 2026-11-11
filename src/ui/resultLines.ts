import type { SessionResult } from '../types';

const WINS = [
  'You brought a bazooka to a worm fight.',
  'Rustbelt is compost.',
  'Total carnage. The island is yours.',
  'Textbook artillery — frame that last arc.',
  'The tide came in. They did not.',
  'They dug in. You dug them under.',
];

const LOSSES = [
  'Your worm is now a landmark.',
  'The wind never read the plan.',
  'Rustbelt keeps the ridge and the bragging rights.',
  'That last shot had character. It also had gravity.',
  'Scattered, smoking and out of ammo.',
  'The island wins this round. You get the crater.',
];

/** Same match, same line: a refresh must not rewrite the story. */
export function resultLine(result: SessionResult): string {
  if (result.endReason === 'surrender') return 'The worms will talk.';
  if (result.endReason === 'time') {
    return result.playerWon ? 'The clock ran out. The island is still yours.' : 'The clock won. The worms blame each other.';
  }

  const pool = result.playerWon ? WINS : LOSSES;
  const pick = (result.config.seed ^ (result.kills * 0x9e3779b1) ^ (result.durationSeconds * 0x85ebca6b)) >>> 0;
  return pool[pick % pool.length];
}

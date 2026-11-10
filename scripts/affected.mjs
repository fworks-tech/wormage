// Selects the tests a diff can reach. The map is deliberately coarse: a missed
// dependency silently skips tests, while a wide match only costs a few minutes.
// Anything without a rule falls back to the full suite.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const GAME_UNIT = [
  'tests/unit/ai.test.ts',
  'tests/unit/engine.test.ts',
  'tests/unit/jump.test.ts',
  'tests/unit/parity.test.ts',
  'tests/unit/replay.test.ts',
];
const GAME_E2E = ['tests/combat.spec.ts', 'tests/jump.spec.ts'];
const UI_E2E = [
  'tests/combat.spec.ts',
  'tests/data.spec.ts',
  'tests/fullscreen.spec.ts',
  'tests/hud-layout.spec.ts',
  'tests/jump.spec.ts',
  'tests/menu.spec.ts',
  'tests/mobile-hud.spec.ts',
  'tests/pwa.spec.ts',
];

const FULL_FILES = [
  'index.html',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'src/App.tsx',
  'src/main.tsx',
  'src/styles.css',
  'src/types.ts',
  'src/game/types.ts',
];
const FULL_DIRS = ['.github/', 'scripts/'];

const RULES = [
  // config.ts also feeds the HUD, menu, result screen and stored settings.
  { files: ['src/game/config.ts'], unit: GAME_UNIT, e2e: UI_E2E },
  { dirs: ['src/game/'], unit: GAME_UNIT, e2e: GAME_E2E },
  {
    files: ['src/ui/GameView.tsx'],
    unit: [],
    e2e: ['tests/combat.spec.ts', 'tests/fullscreen.spec.ts', 'tests/jump.spec.ts', 'tests/mobile-hud.spec.ts', 'tests/hud-layout.spec.ts', 'tests/data.spec.ts'],
  },
  {
    files: ['src/ui/Hud.tsx'],
    unit: [],
    e2e: ['tests/combat.spec.ts', 'tests/jump.spec.ts', 'tests/mobile-hud.spec.ts', 'tests/hud-layout.spec.ts'],
  },
  {
    files: ['src/ui/fullscreen.ts'],
    unit: ['tests/unit/fullscreen.test.ts', 'tests/unit/manifest.test.ts'],
    e2e: ['tests/fullscreen.spec.ts', 'tests/pwa.spec.ts'],
  },
  { files: ['src/ui/MainMenu.tsx'], unit: [], e2e: ['tests/data.spec.ts', 'tests/fullscreen.spec.ts', 'tests/menu.spec.ts'] },
  // Every gameplay spec starts by clicking Start Game on this screen.
  { files: ['src/ui/NewGameMenu.tsx'], unit: [], e2e: UI_E2E },
  { files: ['src/ui/OptionsPanel.tsx'], unit: [], e2e: ['tests/menu.spec.ts'] },
  {
    files: ['src/ui/Leaderboard.tsx', 'src/ui/MatchHistory.tsx', 'src/ui/ResultScreen.tsx'],
    unit: [],
    e2e: ['tests/data.spec.ts', 'tests/menu.spec.ts'],
  },
  {
    dirs: ['src/api/', 'src/mocks/', 'src/state/'],
    unit: ['tests/unit/mockServer.test.ts'],
    e2e: ['tests/data.spec.ts', 'tests/menu.spec.ts'],
  },
  // A new screen or component still runs every spec: over-selecting is cheap.
  { dirs: ['src/ui/'], unit: [], e2e: UI_E2E },
  { dirs: ['docs/'], unit: [], e2e: [] },
  { files: ['LICENSE'], unit: [], e2e: [] },
];

const NO_TEST_EXTENSIONS = ['.md', '.png', '.jpg', '.svg'];

// Vitest and Playwright both discover tests recursively, so the reachability
// check must too.
function listTestsIn(root, dir, pattern) {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => `${dir}/${file.replace(/\\/g, '/')}`)
    .filter((file) => pattern.test(file))
    .sort();
}

export function listTests(root = ROOT) {
  return {
    specs: listTestsIn(root, 'tests', /\.spec\.ts$/).filter((file) => !file.startsWith('tests/unit/')),
    units: listTestsIn(root, 'tests/unit', /\.test\.ts$/),
  };
}

function fullResult(reason) {
  return { full: true, unit: [], e2e: [], reason };
}

function isFull(file) {
  return FULL_FILES.includes(file) || FULL_DIRS.some((dir) => file.startsWith(dir));
}

function selectFor(file) {
  if (isFull(file)) return fullResult(`full trigger: ${file}`);
  if (NO_TEST_EXTENSIONS.some((ext) => file.endsWith(ext))) return { unit: [], e2e: [] };
  if (file.startsWith('tests/unit/')) {
    return { unit: file.endsWith('.test.ts') ? [file] : listTests().units, e2e: [] };
  }
  if (file.startsWith('tests/') && file.endsWith('.spec.ts')) return { unit: [], e2e: [file] };

  const rule = RULES.find(
    (candidate) => (candidate.files ?? []).includes(file) || (candidate.dirs ?? []).some((dir) => file.startsWith(dir)),
  );
  if (!rule) return fullResult(`unmapped path: ${file}`);
  return { unit: rule.unit, e2e: rule.e2e };
}

export function selectTests({ changed, labels = [] }) {
  if (labels.includes('ci:full')) return fullResult('ci:full label');
  if (changed.length === 0) return { full: false, unit: [], e2e: [], reason: 'no changed files' };

  const unit = new Set();
  const e2e = new Set();
  for (const file of changed) {
    const selection = selectFor(file);
    if (selection.full) return selection;
    selection.unit.forEach((test) => unit.add(test));
    selection.e2e.forEach((test) => e2e.add(test));
  }

  const existing = (files) => [...files].filter((file) => existsSync(join(ROOT, file))).sort();
  return { full: false, unit: existing(unit), e2e: existing(e2e), reason: `${changed.length} changed file(s)` };
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function defaultBase() {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main'], { cwd: ROOT, stdio: 'ignore' });
    return 'origin/main';
  } catch {
    return null;
  }
}

// Union of the branch diff and the local worktree, so the pre-push hook sees
// uncommitted and untracked files too. In CI the worktree is clean.
// Deletions and the old side of a rename still need the tests for that area,
// so include D and turn rename detection off.
function changedFiles(base) {
  const files = new Set();
  const add = (args) => git(args).forEach((file) => files.add(file));
  add(['diff', '--name-only', '--no-renames', '--diff-filter=ACDMRT', `${base}...HEAD`]);
  add(['diff', '--name-only', '--no-renames', '--diff-filter=ACDMRT']);
  add(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACDMRT']);
  add(['ls-files', '--others', '--exclude-standard']);
  return [...files];
}

function parseArgs(argv) {
  const args = { base: null, labels: [], full: false, run: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') args.base = argv[++index];
    else if (arg === '--labels') args.labels = (argv[++index] ?? '').split(',').map((label) => label.trim()).filter(Boolean);
    else if (arg === '--full') args.full = true;
    else if (arg === '--run') args.run = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function report(selection) {
  const scope = selection.full ? 'full' : selection.unit.length || selection.e2e.length ? 'selective' : 'none';
  console.log(`scope: ${scope} (${selection.reason})`);
  console.log(`unit: ${selection.unit.join(' ') || '-'}`);
  console.log(`e2e: ${selection.e2e.join(' ') || '-'}`);

  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  appendFileSync(
    output,
    [
      `run_unit=${selection.full || selection.unit.length > 0}`,
      `unit_args=${selection.unit.join(' ')}`,
      `run_e2e=${selection.full || selection.e2e.length > 0}`,
      `e2e_args=${selection.e2e.join(' ')}`,
      `scope=${selection.full ? 'full' : 'selective'}`,
    ].join('\n') + '\n',
  );
}

function run(command, args) {
  const result = spawnSync('npx', [command, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runSelected(selection) {
  if (selection.full || selection.unit.length) run('vitest', ['run', ...(selection.full ? [] : selection.unit)]);
  if (selection.full || selection.e2e.length) run('playwright', ['test', ...(selection.full ? [] : selection.e2e)]);
  if (!selection.full && !selection.unit.length && !selection.e2e.length) console.log('No tests affected.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let selection;
  if (args.full) {
    selection = fullResult('--full');
  } else {
    const base = args.base ?? defaultBase();
    if (!base) {
      selection = fullResult('no base ref');
    } else {
      try {
        selection = selectTests({ changed: changedFiles(base), labels: args.labels });
      } catch (error) {
        selection = fullResult(`git diff failed: ${error.message}`);
      }
    }
  }
  report(selection);
  if (args.run) runSelected(selection);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

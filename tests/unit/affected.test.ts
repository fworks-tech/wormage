import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { listTests, selectTests } from '../../scripts/affected.mjs';

const selection = (changed: string[], labels: string[] = []) => selectTests({ changed, labels });

test('a docs-only change runs no tests', () => {
  const result = selection(['docs/ARCHITECTURE.md', 'README.md', 'mobile-arena.png']);
  expect(result.full).toBe(false);
  expect(result.unit).toEqual([]);
  expect(result.e2e).toEqual([]);
});

test('a narrow UI change runs only the specs that can reach it', () => {
  expect(selection(['src/ui/OptionsPanel.tsx']).e2e).toEqual(['tests/menu.spec.ts']);
  expect(selection(['src/ui/MainMenu.tsx']).e2e).toEqual([
    'tests/data.spec.ts',
    'tests/fullscreen.spec.ts',
    'tests/menu.spec.ts',
  ]);
  // Every gameplay spec starts on the /demo landing screen.
  expect(selection(['src/ui/NewGameMenu.tsx']).e2e).toEqual(selection(['src/ui/SomeNewScreen.tsx']).e2e);
});

test('a config change runs the game units and every UI spec', () => {
  const result = selection(['src/game/config.ts']);
  expect(result.full).toBe(false);
  expect(result.unit).toContain('tests/unit/parity.test.ts');
  expect(result.e2e).toEqual(selection(['src/ui/SomeNewScreen.tsx']).e2e);
});

test('game sources run the game units and the gameplay specs', () => {
  const result = selection(['src/game/engine.ts']);
  expect(result.full).toBe(false);
  expect(result.unit).toEqual([
    'tests/unit/ai.test.ts',
    'tests/unit/engine.test.ts',
    'tests/unit/jump.test.ts',
    'tests/unit/parity.test.ts',
    'tests/unit/replay.test.ts',
    'tests/unit/rope.test.ts',
  ]);
  expect(result.e2e).toEqual(['tests/combat.spec.ts', 'tests/jump.spec.ts', 'tests/rope.spec.ts']);
});

test('a changed unit test runs itself and a shared fixture runs the unit suite', () => {
  expect(selection(['tests/unit/engine.test.ts']).unit).toEqual(['tests/unit/engine.test.ts']);
  expect(selection(['tests/unit/terrainFixture.ts']).unit).toEqual([...listTests().units].sort());
});

test('listTests finds nested specs and unit tests', () => {
  const root = mkdtempSync(join(tmpdir(), 'wormage-affected-'));
  try {
    mkdirSync(join(root, 'tests/unit/deep'), { recursive: true });
    writeFileSync(join(root, 'tests/nested.spec.ts'), '');
    writeFileSync(join(root, 'tests/unit/deep/nested.test.ts'), '');
    expect(listTests(root)).toEqual({
      specs: ['tests/nested.spec.ts'],
      units: ['tests/unit/deep/nested.test.ts'],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('unmapped sources, shared files and the ci:full label fall back to the full suite', () => {
  expect(selection(['src/unknown.ts']).full).toBe(true);
  expect(selection(['package.json']).full).toBe(true);
  expect(selection(['src/styles.css']).full).toBe(true);
  expect(selection(['.github/workflows/ci.yml']).full).toBe(true);
  expect(selection(['docs/ARCHITECTURE.md'], ['ci:full']).full).toBe(true);
});

test('every test file is reachable from a source change', () => {
  const { specs, units } = listTests();
  const sources = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(ts|tsx|css)$/.test(file))
    .map((file) => `src/${file.replace(/\\/g, '/')}`);

  const reachedUnit = new Set<string>();
  const reachedE2e = new Set<string>();
  for (const file of sources) {
    const result = selection([file]);
    if (result.full) continue;
    result.unit.forEach((test) => reachedUnit.add(test));
    result.e2e.forEach((test) => reachedE2e.add(test));
  }

  expect(specs.filter((spec) => !reachedE2e.has(spec))).toEqual([]);
  // The selector's own test needs the scripts/ full trigger, not a source rule.
  expect(selection(['scripts/affected.mjs']).full).toBe(true);
  expect(units.filter((unit) => !reachedUnit.has(unit) && unit !== 'tests/unit/affected.test.ts')).toEqual([]);
});

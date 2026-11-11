# tests — Playwright and Vitest

## Run

```bash
npm test                         # Vitest, Node, no browser
npm run test:e2e                 # Playwright, both projects
npm run test:affected            # only the tests origin/main + your worktree can reach
npx playwright test --project=desktop
npx playwright test tests/combat.spec.ts -g "firing"
npx playwright show-report       # HTML report
```

Vitest only picks up `tests/unit/**/*.test.ts`. The Playwright config uses `channel: 'chrome'` so no browser download is required, and starts/reuses the Vite dev server on `http://localhost:5173`.

## CI test selection

Pull requests run only the tests their diff can reach; pushes to `main` run everything. The map lives in [`scripts/affected.mjs`](../scripts/affected.mjs): add a rule when a new spec needs a new source area, otherwise that spec only runs when the spec file itself changes. Unmapped paths fall back to the full suite. Add the `ci:full` label to force it.

```bash
npm run test:affected   # runs the selection (uncommitted and untracked files included)
node scripts/affected.mjs --base origin/main   # print the selection without running it
```

The same script runs in CI with the PR base commit, so local and CI agree. To run it before every push, opt in once per clone:

```bash
git config core.hooksPath .githooks
```

`git push --no-verify` skips the hook.

## Instrumentation

Gameplay assertions read the authoritative simulation through:

```ts
window.__WORMAGE__.snapshot()   // GameSnapshot
window.__WORMAGE__.engine       // imperative engine (surrender, endTurn…)
window.__WORMAGE__.painter      // TerrainPainter, for canvas assertions
```

This hook exists only to make E2E deterministic; it is not used by the UI. Tests still drive real buttons, keys and pointer gestures for anything the user can do.

Seeds: `/demo?seed=4242` fixes terrain generation and AI jitter so combat tests are reproducible. `/?seed=4242` works too — the root redirect keeps the query string.

## Suites

| File | Covers |
| --- | --- |
| `unit/engine.test.ts` | seeded construction without a DOM, wind, ammo, turn transitions, wipeout, surrender, scoring, blast falloff |
| `unit/ai.test.ts` | reticle radius, AI weapon/firing-spot choice, jump-reach limit, left-facing aim, retreat and dynamite escape, preview and aim clamp |
| `unit/mockServer.test.ts` | leaderboard pagination and ranking, ruleset filter, idempotent registration |
| `unit/replay.test.ts` | a recorded action log (walk, grenade bounce, kill) replays to the same final snapshot; jump/end-turn dispatch |
| `unit/jump.test.ts` | ground-only jumps, directional jumps, air steering, jump during flight, AI jump when blocked |
| `unit/rope.test.ts` | rope attach/range, reel, swing, release momentum, carved anchor, turn cleanup, AI rope attempt, replay |
| `unit/parity.test.ts` | `simulateShot`/`previewFlight` read speed, gravity, wind, lifetime, fuse and bounce damping from `WEAPONS`/`BOUNCE` |
| `unit/fullscreen.test.ts` | `/project` is excluded, unsupported/already-fullscreen/no-DOM no-ops, a refused request resolves false, landscape only on coarse pointers |
| `unit/manifest.test.ts` | manifest fields, icon files and PNG dimensions, and the `index.html` links |
| `unit/bindings.test.ts` | defaults, Zod sanitize (corrupt/old schema/reserved codes), arrow aliases, duplicate swap, rejection classes, labels |
| `unit/storage.test.ts` | empty, corrupt and old-schema localStorage fall back safely |
| `menu.spec.ts` | root redirect, demo/project routes, menu, tabs, options validation/persistence, empty and error states, ruleset-scoped board |
| `fullscreen.spec.ts` | fullscreen after Start and Play Again, a deliberate exit plus pause-dialog re-entry, landscape lock/unlock on touch, `/project` stays windowed |
| `pwa.spec.ts` | the manifest link and every icon are served on both routes |
| `combat.spec.ts` | firing, turn handoff, walking (keyboard and pads), weapon selection, pause/freeze, retreat window, dynamite fuse, crater carving, end turn |
| `mobile-hud.spec.ts` | touch firing: tap/slop, deliberate drag, pointer cancel, pointer ownership, charge percentage |
| `hud-layout.spec.ts` | 360/390/412 portrait and 915 landscape: target sizes, overlaps, Jump, compact landscape HUD |
| `jump.spec.ts` | Jump button hop, in-air press ignored, front/back jumps, key-repeat guard, Jump stays enabled through retreat |
| `rope.spec.ts` | HUD rope card anchors, reels in, and Jump lets go |
| `data.spec.ts` | result screen, match registration, history/ranking visibility, persistence after refresh |
| `settings.spec.ts` | Settings/Controls dialogs, persistence, rebind/swap/reset/cancel, reserved-key rejection, arrow aliases, paused settings apply to the next match, Restart Match |

Each Playwright spec runs twice, once per project (`desktop` / `mobile`). There are no visual baselines yet; the suite asserts engine state through the instrumentation hook instead. Visual baselines are planned for M1.

## Conventions

- Unit tests run in plain Node: import the engine, terrain and AI directly; no DOM, no Playwright.
- Playwright gives each test a fresh browser context, so localStorage starts empty. Specs that need stored data seed it in `addInitScript`.
- Prefer `data-testid` selectors owned by the UI, not CSS structure.
- Never assert on animation timing; wait for a state predicate (`waitForFunction`) or a test id.
- Failures keep traces and screenshots in `test-results/`.
- Touch specs use `Input.dispatchTouchEvent` over CDP; the describe sets `isMobile`/`hasTouch` so the same spec runs on both projects.

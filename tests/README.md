# tests — Playwright

## Run

```bash
npm run test:e2e                 # both projects
npx playwright test --project=desktop
npx playwright test tests/combat.spec.ts -g "firing"
npx playwright show-report       # HTML report
```

The config uses `channel: 'chrome'` so no browser download is required, and starts/reuses the Vite dev server on `http://localhost:5173`.

## Instrumentation

Gameplay assertions read the authoritative simulation through:

```ts
window.__WORMAGE__.snapshot()   // GameSnapshot
window.__WORMAGE__.engine       // imperative engine (surrender, endTurn…)
```

This hook exists only to make E2E deterministic; it is not used by the UI. Tests still drive real buttons, keys and pointer gestures for anything the user can do.

Seeds: `/?seed=4242` fixes terrain generation and AI jitter so combat tests are reproducible.

## Suites

| File | Covers |
| --- | --- |
| `menu.spec.ts` | menu, tabs, options validation/persistence, empty and error states, ruleset-scoped board |
| `combat.spec.ts` | firing, turn handoff, walking and arena bounds, weapon selection, pause/freeze, end turn |
| `data.spec.ts` | result screen, match registration, history/ranking visibility, persistence after refresh |

Every spec runs twice, once per project (`desktop` / `mobile`). There are no visual baselines yet; the suite asserts engine state through the instrumentation hook instead. Visual baselines are planned for M1.

## Conventions

- Playwright gives each test a fresh browser context, so localStorage starts empty. Specs that need stored data seed it in `addInitScript`.
- Prefer `data-testid` selectors owned by the UI, not CSS structure.
- Never assert on animation timing; wait for a state predicate (`waitForFunction`) or a test id.
- Failures keep traces and screenshots in `test-results/`.

# AGENTS.md

Operating guide for automated agents working in this repository. Humans should read [CONTRIBUTING.md](CONTRIBUTING.md); the rules are the same, this file adds the context an agent needs before editing code.

## Project

Wormage is a turn-based artillery duel in the browser: React 18 + strict TypeScript around a self-contained PixiJS 8 simulation, built with Vite 6. TanStack Query, Axios and MSW 2 power the mocked ranking/history API; Playwright covers the UI. It is a static SPA — there is no server, database or authentication yet.

Live build: <https://wormage.flabs.tech>. Vercel auto-deploys `main`.

## Read first

| Document | Why |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | layers, frame loop, terrain, combat rules, AI |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | every tunable number and where it lives |
| [docs/DECISIONS.md](docs/DECISIONS.md) | code-level trade-offs that already exist |
| [docs/adr/](docs/adr/README.md) | cross-cutting architecture decisions: hosting, AWS, online play, content pipeline, timestep |
| [docs/ROADMAP.md](docs/ROADMAP.md) | milestones and current scope |
| [CONTRIBUTING.md](CONTRIBUTING.md) | branch, commit and PR rules |

The GitHub milestones are the source of truth for scope. `docs/ROADMAP.md` mirrors them; if they disagree, fix the document, not the milestone silently.

## Commands

Node 20+. `npm run build` already runs `tsc --noEmit`.

```bash
npm ci
npm run dev            # http://localhost:5173, starts MSW
npm run typecheck
npm run build
npm run build:single   # one self-contained HTML file (no service worker)
npm run test:e2e       # Playwright, desktop + mobile
npx playwright test tests/combat.spec.ts -g "firing"
npx playwright show-report
```

Playwright uses the installed Chrome (`channel: 'chrome'`); do not download browsers. It starts or reuses Vite on port 5173.

## Layout

| Path | Contents |
| --- | --- |
| `src/game/` | simulation and Pixi renderer. No React imports. |
| `src/game/config.ts` | every balance number: world, physics, weapons, teams, difficulty, defaults |
| `src/game/types.ts` | shared contracts (`GameSnapshot`, `WeaponDef`, `GameEvent`…) |
| `src/game/engine.ts` | turn state machine, worm physics, projectiles, damage, scoring, AI scheduling |
| `src/game/ai.ts` | forward simulation (`simulateShot`), shot planner, angle helpers |
| `src/game/aim.ts` | bounded reticle: marches the aim ray to `AIM.radius` or the first terrain hit |
| `src/game/renderer.ts` | Pixi scene, worms, particles, aim preview |
| `src/ui/` | React screens and HUD; `GameView` owns the loop and input |
| `src/state/`, `src/api/`, `src/mocks/` | persistence, HTTP client and queries, MSW fixtures |
| `tests/` | Playwright specs and conventions (`tests/README.md`) |

## Invariants

- **Engine owns the truth.** The renderer only reads. React gets throttled snapshots (~10 Hz) and calls engine actions through refs; it never mutates worms or projectiles.
- **The simulation stays renderer-free.** `src/game/` imports no React; only `terrain.ts` and `renderer.ts` may touch a DOM canvas.
- **One physics source.** AI and the aim preview run `simulateShot`; combat integrates with the same constants in `config.ts`. Never re-declare speeds, gravity or wind scales in another file.
- **Numbers live in `config.ts`.** Balance changes should not touch `engine.ts`, the renderer or React.
- **Weapons are data.** Add a `WeaponDef` to `WEAPONS` and `WEAPON_ORDER`; keep its physics in the same shape as the others.
- **The renderer is read-only and disposable.** If it disappears, the match still resolves.
- **The simulation runs at a fixed 60 Hz.** `GameView` feeds `engine.update(FIXED_DT)` from an accumulator; never pass a frame delta to the engine. Replays are not implemented yet (#12), and cross-machine float determinism stays out of scope (ADR 0003).
- **The AI has no pathfinding.** If a planned or current position is unreachable or blocked, fall back to a shot from where the worm stands; never teleport.

## Workflow

1. **Issue first.** Every change traces to an issue with scope and acceptance criteria.
2. **Branch per issue**, named `type/short-slug` (`feat/online-match-api`, `fix/end-turn-mid-flight`, `docs/truth-pass`, `chore/rename-wormage`).
3. **Conventional Commits.** The type matches the branch type; the scope names the area. Write the body as what changed and why.
4. **One PR per issue**, linked with `Closes #N`. Keep unrelated changes out.
5. **Never merge, close or force-push a shared branch without explicit confirmation from the maintainer.** Opening or updating a PR is fine; merging is the maintainer's call.
6. **Stacks:** target the parent branch as the PR base, note the dependency, and rebase onto `main` after the parent merges. Never merge a child before its parent.
7. **Keep docs honest.** A previous truth pass removed claims the code did not back (#5, #26). If behavior and docs disagree, fix one of them in the same PR.

## Definition of done

- `npm run typecheck` passes.
- `npm run build` passes.
- `npx playwright test` passes on desktop and mobile, or the PR explains why it does not apply.
- New behavior has a test that fails without the change.
- Docs updated when behavior, commands or architecture change; an ADR is added when a decision is expensive to reverse.
- No unrelated files, drive-by refactors or new dependencies for a few lines.

## Testing rules

- Assert on state, not pixels or animation timing. Read `window.__WORMAGE__.snapshot()` or `window.__WORMAGE__.engine`; drive real buttons, keys and pointers.
- Wait with a predicate (`waitForFunction`) or a `data-testid`, never with fixed sleeps.
- `/?seed=4242` fixes terrain and AI jitter for reproducible combat tests.
- Pure logic (ballistics, scoring, helpers) can be tested in a plain Node module under `tests/`; no canvas needed.
- Each spec runs twice, once per Playwright project (`desktop`, `mobile`).

## Style

- TypeScript `strict`; no `any` at a typed boundary.
- Two-space indent, single quotes, named exports, no default exports.
- Prefer the existing helper or platform feature over a new abstraction.
- Comment the why, not the what. Anything intentionally limited gets a `shortcut:` comment naming the limit and when to revisit.
- Do not add a dependency when the platform or an installed package can do the job.

## Current gaps (as of this file)

- Vitest and deterministic replay are M1 work (#11–#14).
- Ranking and history still run on MSW fixtures; AWS arrives in M3 (#16).

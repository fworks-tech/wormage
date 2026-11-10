# Contributing

Automated agents should also read [AGENTS.md](AGENTS.md), which restates these rules in the form they need.

## Setup

```bash
npm ci
npm run dev            # http://localhost:5173
npm run typecheck
npm test               # Vitest unit tests
npm run build
npm run test:e2e       # uses installed Chrome
```

Node 20+ is required.

## Workflow

1. **Open an issue first.** Every change traces to an issue with scope and acceptance criteria. Milestones are defined in [docs/ROADMAP.md](docs/ROADMAP.md).
2. **Branch per issue**, named `type/short-slug`:
   - `feat/online-match-api`
   - `fix/end-turn-mid-flight`
   - `docs/truth-pass`
   - `chore/rename-wormage`
   - `refactor/weapon-physics-source`
   - `test/deterministic-replay`
3. **Commit with Conventional Commits.** The type matches the branch type; the scope is optional and names the area.
4. **Open one PR per issue.** Link it with `Closes #N`. Keep unrelated changes out.
5. **Do not merge without review.** A PR needs an approving review and a green CI run — typecheck, build and Playwright on desktop and mobile.

### Stacked PRs

When a change depends on an unmerged branch, target that branch as the PR base and note the dependency in the description. Rebase onto `main` after the parent merges; do not merge a child before its parent.

## Commit types

| Type | Use |
| --- | --- |
| `feat` | New player-visible behavior |
| `fix` | A bug fix |
| `refactor` | Behavior-preserving code change |
| `test` | Tests only |
| `docs` | Documentation only |
| `chore` | Build, tooling, dependencies, rename |
| `ci` | CI configuration |
| `perf` | Measured performance improvement |

Example:

```
fix(engine): only end the turn during the aim phase

endTurn() allowed ending the turn while a projectile was in flight.
```

## Pull request checklist

- [ ] Linked issue (`Closes #N`)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `npm run test:e2e` passes, or the PR explains why it does not apply
- [ ] New behavior has a test that fails without the change
- [ ] Docs updated when behavior, commands or architecture changed
- [ ] Screenshot or recording for UI changes
- [ ] No unrelated files or drive-by refactors

## Decisions

Decisions that are expensive to reverse get an ADR in [docs/adr/](docs/adr/README.md). Number it sequentially, add it to the index and use the template in that index. Code-level trade-offs that describe the current implementation live in [docs/DECISIONS.md](docs/DECISIONS.md).

## Style

- TypeScript `strict`; no `any` unless the boundary is genuinely untyped.
- The simulation in `src/game/` must not import React or the renderer.
- Balance numbers live in `src/game/config.ts`, not inline in engine code.
- Prefer the existing helper over a new abstraction. Add a dependency only when the platform or an installed package cannot do the job.
- Comment the why, not the what.

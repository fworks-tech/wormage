# Architecture

Wormage is a single-page React app wrapped around a self-contained PixiJS game. The design goal is the one the challenge grades: **the rules must not depend on the renderer, the frame rate, or React.**

## 1. Layers

```
┌──────────────────────────────────────────────┐
│ React screens (menu, HUD, result, dialogs)   │  ~10 Hz snapshots
├──────────────────────────────────────────────┤
│ GameView: input, pause rules, event routing  │  requestAnimationFrame (Pixi ticker)
├──────────────────────────────────────────────┤
│ GameEngine (pure TS)                         │  fixed-ish dt, substeps
│  ├─ Terrain (bitmask + canvas)               │
│  ├─ AI (forward simulation)                  │
│  └─ Turn state machine                       │
├──────────────────────────────────────────────┤
│ ArenaRenderer (Pixi)                         │  reads engine, never writes
└──────────────────────────────────────────────┘
```

- `src/game/*` imports nothing from React or the DOM except `document.createElement('canvas')` in `terrain-painter.ts` and `renderer.ts`.
- `GameEngine` exposes imperative actions (`setMove`, `aimBy`, `startCharge`, `fire`, `endTurn`) and a `snapshot()` value object.
- `GameView` owns the only loop. It feeds `dt` to the engine, drains `engine.events` to the renderer and the sound kit, then throttles the React snapshot.
- React never mutates simulation state directly; HUD buttons call callbacks that delegate to the engine.

### Routes

Two static routes and no router dependency. `/demo` plays: New Game dialog → match → result. `/project` is the informational menu (briefing, ranking, history, options). `boot()` in `main.tsx` replaces `/` with `/demo`, keeping `?seed=`; `App.tsx` treats any path starting with `/project` as the project page and everything else as the demo. Vercel's existing rewrite serves `index.html` for both. Navigations are real page loads, which is fine for a static SPA; the single-file build only works from `/` and hides the project link.

`/demo` also owns fullscreen: the Start Game and Play Again clicks request it, since browsers only grant fullscreen from a user gesture. `/project` never asks, and the pause dialog restores it after a deliberate Esc. See [DECISIONS.md](DECISIONS.md) §16. `public/manifest.webmanifest` installs the origin as a home-screen app that launches `/demo`; the manifest is app-wide (`scope: "/"`), while the Fullscreen API request stays `/demo`-only.

## 2. Frame loop and time

```ts
const dt = Math.min(0.08, ticker.deltaMS / 1000);
accumulator += dt;
while (accumulator >= FIXED_DT) {
  applyInput(FIXED_DT);
  engine.update(FIXED_DT);
  accumulator -= FIXED_DT;
}
renderer.render(dt, paused);
```

- The simulation advances only in fixed `FIXED_DT` (1/60 s) steps, so a 144 Hz display and a 60 Hz one integrate the same trajectory. Rendering reads the latest step; it does not interpolate.
- `dt` is clamped so a background tab returning after ten seconds cannot teleport worms through terrain or run a long catch-up loop.
- The engine counts fixed ticks and accepts a serializable `GameAction` log (`record`/`applyAction`). The same seed plus the same log reproduces the final snapshot on the same build; cross-machine float identity stays out of scope (ADR 0003).
- Movement, gravity, fuses, turn timers and AI delays are all expressed in seconds, never in frames.
- Projectiles advance in substeps sized by velocity (`ceil(speed * dt / 5)`), which prevents tunnelling through thin terrain at 1500 px/s.
- Pausing stops `engine.update` entirely. The renderer keeps drawing the frozen state, and fuses/timers resume from the same value. Resuming is an explicit user action. Pausing also cancels a charge in progress, so a key or pointer release under the pause card cannot fire.

## 3. Terrain

The island exists twice, in two classes:

1. **Collision:** `Terrain` (`terrain.ts`) owns the `Uint8Array` bitmask at 4 px resolution (320 × 180 cells), generation, `isSolid`, `groundY` and crater carving. It imports no DOM, so the engine can be constructed in Node.
2. **Rendering:** `TerrainPainter` (`terrain-painter.ts`) owns the 1280 × 720 offscreen canvas painted once (gradient soil, grass, pebbles, strata, two floating shelves). Pixi samples it as a `Texture`.

Destruction (`Terrain.carve`) zeroes the mask circle, then fires `onCarve`. The renderer hands those coordinates to `TerrainPainter`, which punches the circle out of the canvas with `destination-out`, paints a scorched rim clipped to the remaining dirt (`source-atop`), and refreshes the GPU texture.

`groundY(x, fromY, maxDown)` returns the first solid row under a point. Worms use it to walk slopes and to detect that the ground was removed under their feet; projectiles never need it because they sweep the mask directly.

## 4. Physics and combat rules

- Gravity: worms 780 px/s², projectiles 520 px/s² scaled per weapon.
- A jump starts only from the ground; there is no double jump. Holding a direction while airborne sets horizontal velocity, so a vertical hop can be steered sideways over a ledge.
- Wind: `-max..max` units per ruleset, applied as horizontal acceleration scaled per weapon (`windScale`); the AI and the aim preview use the same value.
- Aiming is an absolute world angle stored in `[AIM.min, AIM.max]` (`-3.04` to `-0.1`); facing is derived from `cos(angle)`. Walking flips the angle with `mirrorAngle` so the barrel stays on the leading side.
- Damage falls off linearly with distance, floored at 22% of the weapon's base damage inside the blast radius.
- Every worm in radius takes damage, including the shooter. Knockback is applied as a small horizontal shove plus upward velocity, which can push worms into water or off ledges.
- Fall damage starts above 150 px and costs 0.16 HP per extra pixel.
- A team loses when every worm is dead. Water kills instantly.

### Turn state machine

```
aim ──fire──▶ projectile ──(no projectiles)──▶ settle
 │                                              │
 │                          settle + retreat window over
 │                                              ▼
 └───────── timer 0 / end turn ────────────▶ next turn
```

The projectile and settle phases also run a 3 s retreat window (`RETREAT_SECONDS`): the shooter may keep walking, and the turn only passes once the settle delay and the window are both over. The dynamite fuse (2.2 s) is shorter than the window, so its blast resolves first.

`gameover` is terminal: `update` returns immediately, so movement, damage, AI and the clock all stop together. The result payload is built once and handed to React.

## 5. AI

`planAiTurn` plans the whole turn. It builds walkable firing positions within the part of the turn it can spend walking, then evaluates bazooka, grenade, shotgun and dynamite from each one by running the **real** projectile integrator (`simulateShot`). The simulation stops at the first worm in the flight path, so an ally in the way is scored as friendly damage instead of an open shot. A shot is scored by damage to enemies minus a penalty for friendly and self damage; dynamite is only considered when the worm can leave its blast before the 2.2 s fuse ends. The plan also picks a retreat spot within the 3 s window, away from the enemy, outside that blast and reachable on foot — walls, pits and water between the worm and the spot disqualify it.

The engine walks the AI worm to `fireX`, fires the chosen weapon, then steers the same worm to `retreatX` while the retreat window is open. If the path is blocked or the turn clock runs low, it falls back to the legacy `planAiShot` bazooka solution from where it stands. Difficulty jitter is applied to projectile angle and power; a dynamite drop has neither.

Because the solver and the game share one integrator, the CPU never "cheats" — it just searches better than a human can. The player's aim preview uses the same function for the dotted arc, while the reticle itself is the bounded aim indicator from `aim.ts` (not an impact prediction).

## 6. Rendering

`ArenaRenderer` builds, in order: sky canvas (gradient, sun, hills, water reflection), water graphics, terrain sprite, projectile graphics, worms, FX, aim layer, vignette and drifting clouds.

- Worms are `Graphics` built once per worm, with a redrawn HP bar only when HP or active state changes.
- Particles are plain objects integrated in `render` and drawn into a single cleared `Graphics` per frame (sparks, smoke, dirt, splashes, shockwave rings), capped at 420.
- Screen shake decays exponentially and offsets the world container only, never the HUD.
- The world is 1280 × 720 and letterboxed: `scale = min(screenW / 1280, screenH / 720)`. `toWorld()` inverts that transform for pointer input, so aiming stays accurate at any window size or device pixel ratio.
- Cleanup: `GameView` removes the ticker callback and calls `renderer.destroy()`, which destroys the Pixi app, all worm views, particle graphics and the texture cache. React StrictMode mounts twice in development; the async renderer creation is guarded by a `disposed` flag so the first instance is destroyed instead of leaking a second canvas.

## 7. React ↔ game contract

`GameSnapshot` contains exactly what the HUD needs: phase, turn, timer, wind, active team/worm, aim, power, weapon and per-team HP/ammo/worm states. It is produced from engine state, never stored in React.

- UI pushes at most every 100 ms.
- Buttons call engine methods; no state is copied into React for writing.
- The HUD is a pure function of `snapshot`.
- Accessibility: the arena is a labelled `role="img"`, a polite live region announces the active team/worm and remaining seconds (not every frame), all controls are real buttons with labels, and the pause dialog traps attention with `aria-modal`.

## 8. Data layer

`src/api/client.ts` owns two Axios instances: a normal one (MSW intercepts) and one with a local adapter. `initApiLayer()` runs before React mounts and picks a transport:

- **dev / standard build:** start the MSW worker. Requests travel the real network stack and are answered by `src/mocks/handlers.ts`.
- **MSW unavailable or `--mode single`:** use the adapter, which calls the same `mockServer` functions in-process.

Both paths share `src/api/types.ts` (contracts) and `src/api/mockServer.ts` (fixtures, pagination, idempotent writes, scenario latency/failures). TanStack Query handles caching, retries, background refresh and cache invalidation for both boards after a match is registered.

Match registration is idempotent on `clientMatchId`: a retry after a timeout returns the existing record, so the player never appears twice. The result screen keeps a retry action while the request is failing.

## 9. Persistence

`src/state/storage.ts` wraps localStorage with safe fallbacks (private mode, opaque iframe):

- settings (turn timer, wind, difficulty, sound) — validated and clamped on read;
- player identity (id + display name);
- last completed result, restored after refresh;
- mock database + demo network scenario.

## 10. Testing strategy

- Vitest runs browserless unit tests in `tests/unit/`: the engine in Node, ballistics/AI helpers and `mockServer` rules.
- Playwright drives real clicks/keys and asserts engine state through `window.__WORMAGE__` (documented as instrumentation, not a gameplay shortcut).
- Deterministic seeds are passed via `?seed=123` (ruleset snapshot) so terrain and AI jitter are reproducible.
- Visual baselines are planned for M1; the suite currently asserts state, not pixels.
- The mock layer supports deterministic latency/failure scenarios, which is how the loading/empty/error and duplicate-write tests are written.

See `tests/` for the suites and `docs/DECISIONS.md` for why these choices were made.

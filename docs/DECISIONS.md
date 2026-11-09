# Decisions

Short ADR-style notes for the choices that shaped the codebase. Each entry says what was decided, why, and what it costs.

## 1. Artillery instead of a conventional arena shooter

A top-down shooter is a well-trodden demo: bullets, spawns and a score counter. Artillery asks for more interesting machinery — destructible geometry, ballistic arcs, wind, a turn state machine and an opponent that must plan — while still needing the same product scaffolding around it.

**Cost:** more custom physics than a bullet-and-spawn loop, and no reusable art. Every visual is generated at runtime.

## 2. Terrain as a bitmask plus a canvas

A heightmap cannot represent tunnels or overhangs, and a full pixel-perfect bitmap is expensive to query. The compromise is a 4 px `Uint8Array` for collision and a 1× canvas for looks.

**Why:** `isSolid` costs one array lookup; craters stay sharp on screen; texture updates happen only when the ground changes.
**Cost:** 4 px collision granularity. Worms can stand on a pixel-wide ledge that is only 4 px wide. Acceptable for a cartoon game and invisible in practice.

## 3. One integrator, three consumers

`simulateShot` in `game/ai.ts` powers the CPU, the dotted aim preview and (by shared constants) the live projectile. There is no second, simplified physics model.

**Why:** the preview never lies, and the AI never gets special rules.
**Cost:** the preview and AI run the same arithmetic the game does, which is why collisions are not simulated in the preview (it shows terrain only).

## 4. React gets 10 Hz snapshots, not frames

The engine pushes a `GameSnapshot` to React at most every 100 ms. The Pixi renderer reads engine state every frame.

**Why:** React re-rendering a HUD sixty times per second is wasted work and makes jank visible. Snapshots are cheap value objects.
**Cost:** the HUD value can lag the simulation by up to 100 ms. That is below perception for a turn-based game.

## 5. Absolute aim angles

Aim is stored as a world angle in `[-π, -0.08]` with `cos(angle)` deciding facing, instead of "angle relative to facing".

**Why:** the same number feeds `Math.cos/sin` for the muzzle, the preview and the AI. Flipping direction is `mirrorAngle` (`-π - angle`), which keeps the barrel pointing where it pointed.
**Cost:** special cases for clamping and mirroring live in one place (`clampAngle`, `mirrorAngle`) and must be used everywhere.

## 6. MSW in dev, an in-process adapter for the single-file build

The spec-style requirement is network-level mocking. Service workers do not exist inside a sandboxed iframe or a `file://` page, and the portfolio also ships as one HTML file.

**Why:** one mock implementation (`mockServer.ts`), two transports (`handlers.ts` for MSW, `localAdapter` for Axios). Tests and production builds use the same fixtures and idempotency logic.
**Cost:** two code paths to keep honest. `docs/ARCHITECTURE.md` §8 documents the split; both call the same functions.

## 7. Idempotent match registration

`POST /api/matches` keys on `clientMatchId`. The id is generated once per match and reused by every retry.

**Why:** a timeout after the server committed must not create a duplicate leaderboard entry. Retrying is safe by construction.
**Cost:** the client must generate the id before the first attempt, not per request.

## 8. No external art or audio

Terrain, worms, explosions, HUD and sounds are generated at runtime.

**Why:** licensing is unambiguous, the download is tiny, and the portfolio demonstrates canvas/graphics work instead of asset gathering.
**Cost:** a real production game would hire an artist. The renderer is structured so sprite atlases can replace `WormView` and `drawProjectile` without touching the simulation.

## 9. Fixed 1280×720 world, letterboxed

The simulation always runs in the same logical coordinates.

**Why:** balance, AI ranges and terrain generation stay meaningful on every device; input is mapped with one inverse transform.
**Cost:** ultra-wide screens get letterbox bars. The alternative (resizing the world) changes gameplay per viewport.

## 10. Settings are snapshotted per match

Changing options only affects the next match; `GameView` reads `settings` once at mount and builds the engine from it.

**Why:** a live ruleset change mid-match would corrupt the ranking comparison and the AI plan in flight.
**Cost:** the options screen is unreachable during a match (by design).

## 11. StrictMode-safe mount

`GameView` creates the engine synchronously and the Pixi app asynchronously, guarded by `disposed`. On the second StrictMode mount the first renderer is destroyed instead of appended.

**Why:** React 18 dev builds mount, clean up and mount again. Leaked tickers and canvases are the classic symptom.
**Cost:** a few extra lines of teardown bookkeeping.

## 12. localStorage, not IndexedDB

Persisted state is small and synchronous: settings, player identity, last result, mock DB.

**Why:** zero dependencies and no migration machinery for a demo.
**Cost:** no multi-tab sync and a ~5 MB ceiling. Both are documented limitations, not accidents.

## 13. Pause on blur, resume only by action

`window.blur` and `visibilitychange` force a pause. Resuming requires a click or keypress.

**Why:** a hidden tab should not keep the turn timer running or the AI firing. Requiring an explicit action also means no queued inputs fire the instant the tab returns.
**Cost:** clicking outside the window mid-turn pauses the game, which can feel abrupt until the pause card explains it.

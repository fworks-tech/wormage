# Decisions

Short ADR-style notes for the choices that shaped the codebase. Each entry says what was decided, why, and what it costs.

Cross-cutting architecture decisions — hosting, AWS, online play, the content pipeline and the simulation timestep — live in [docs/adr/](adr/README.md). The notes below stay here because they describe code that already exists.

## 1. Artillery instead of a conventional arena shooter

A top-down shooter is a well-trodden demo: bullets, spawns and a score counter. Artillery asks for more interesting machinery — destructible geometry, ballistic arcs, wind, a turn state machine and an opponent that must plan — while still needing the same product scaffolding around it.

**Cost:** more custom physics than a bullet-and-spawn loop, and no reusable art. Every visual is generated at runtime.

## 2. Terrain as a bitmask plus a canvas

A heightmap cannot represent tunnels or overhangs, and a full pixel-perfect bitmap is expensive to query. The compromise is a 4 px `Uint8Array` for collision and a 1× canvas for looks. They live in two classes — `Terrain` (mask) and `TerrainPainter` (canvas) — so the engine runs in Node without a DOM.

**Why:** `isSolid` costs one array lookup; craters stay sharp on screen; texture updates happen only when the ground changes.
**Cost:** 4 px collision granularity. Worms can stand on a pixel-wide ledge that is only 4 px wide. Acceptable for a cartoon game and invisible in practice. Carving has to keep two representations in sync through the `onCarve` callback.

## 3. One integrator, three consumers

`simulateShot` in `game/ai.ts` powers the CPU, the dotted aim preview and (by shared constants) the live projectile. There is no second, simplified physics model.

**Why:** the preview never lies, and the AI never gets special rules.
**Cost:** the preview and AI run the same arithmetic the game does, which is why collisions are not simulated in the preview (it shows terrain only).

## 4. React gets 10 Hz snapshots, not frames

The engine pushes a `GameSnapshot` to React at most every 100 ms. The Pixi renderer reads engine state every frame.

**Why:** React re-rendering a HUD sixty times per second is wasted work and makes jank visible. Snapshots are cheap value objects.
**Cost:** the HUD value can lag the simulation by up to 100 ms. That is below perception for a turn-based game.

## 5. Absolute aim angles

Aim is stored as a world angle in `[-3.04, -0.1]` with `cos(angle)` deciding facing, instead of "angle relative to facing".

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

## 14. The reticle is an aim indicator, not a prediction

`aimPoint` marches the aim ray up to `AIM.radius` and stops on the first terrain it meets; otherwise it returns the point on the circle. The dotted trajectory keeps using `simulateShot`, so the real physics stay visible.

**Why:** an impact-predicting reticle can sit far outside the arena or on a surface the player cannot reason about, and it duplicates information the arc already gives.
**Cost:** the reticle no longer tells you exactly where a bouncing grenade will stop. The dots are the authoritative hint.

## 15. The AI plans movement, weapon and retreat together

`planAiTurn` searches positions reachable within the turn, evaluates every weapon with the shared integrator, and returns a firing spot plus a retreat spot. Dynamite is only a candidate when the escape walk clears its own blast along an unobstructed path.

**Why:** a CPU that fires from wherever it spawned makes weapon choice meaningless and cannot use short-fuse weapons without killing itself.
**Cost:** one planning pass costs a few milliseconds when the AI turn starts; the search is bounded by the walk budget and does not pathfind around walls (the engine stops at an obstruction and falls back to a bazooka shot).

## 16. Fullscreen is entered on a gesture, never forced

`/demo` requests document fullscreen from the Start Game and Play Again clicks, because browsers reject `requestFullscreen` without a transient user activation. Leaving fullscreen with Esc is respected: the pause dialog offers a `Fullscreen` button instead of auto-requesting on every later click. `/project` never asks. Browsers without the API (iPhone Safari in a tab) keep the viewport-filling layout; installing to the home screen is the only chrome-free path there (§17). A request on load stays out: the API requires a gesture, and on `/demo` no earlier gesture exists than Start Game. A fullscreen session on a touch device also locks landscape (§18).

**Why:** the browser chrome is the only part of the presentation the page cannot remove, and starting a match is the first reliable gesture. An automatic re-entry loop would trap keyboard users who press Esc.
**Cost:** a player who lands on `/demo` and never starts a match stays windowed, and after a deliberate exit fullscreen returns only through the pause dialog or a new match.

## 17. A home-screen manifest, not a service worker

`public/manifest.webmanifest` names the app, pins `start_url` to `/demo` with scope `/`, declares `display: standalone` and carries the 192/512 icons; `index.html` also adds the favicon, Apple touch icon and Apple web-app metas. Installing from iOS Safari (Share → Add to Home Screen) therefore launches the demo without Safari's chrome. `display: fullscreen` is deliberately not used: iOS ignores it and falls back to standalone, while a desktop install would start borderless outside the match.

**Why:** an iPhone tab cannot fullscreen an element at all, and a Home Screen web app is the only chrome-free path there. iOS 26 makes every Home Screen site a web app by default; the manifest still supplies the name, icon and launch URL on older iOS and Android.
**Cost:** Android Chrome needs a service worker to mint a WebAPK, so without one Add to Home screen only creates a browser shortcut. The offline shell, real install prompt and cross-device profile stay in M6 (#20), and true fullscreen on iOS remains impossible.

## 18. Landscape only while the match is fullscreen

After a successful fullscreen request on `/demo`, the page asks for a landscape orientation lock on coarse-pointer devices. Leaving fullscreen releases it. Every refusal is swallowed: Safari has no Screen Orientation API and desktop Chrome always rejects the call. Windowed portrait play is unchanged.

**Why:** fullscreen is the immersive presentation, and the HUD already has a dedicated landscape-phone layout (`max-height: 480px`). The portrait layout from #59 stays available by leaving fullscreen.
**Cost:** on Android a fullscreen match rotates even if the player prefers portrait; the way out is exiting fullscreen. iOS players rotate manually, because Safari ignores the lock.

## 19. The rope is a tool, not a weapon

The anchored rope is a per-worm tool with its own pendulum state, no ammo slot and no `WeaponDef`. It hangs from the first terrain point on the aim ray; gravity, swing input and reel input drive it in the fixed step, and Jump releases the momentum.

**Why:** every worm should be able to traverse, the rope never damages anything, and keeping it out of `WEAPONS` avoids inventing damage/fuse fields that would never be read.
**Cost:** it needs its own state (`Worm.rope`), HUD card and renderer line, and the AI needs a bounded climb attempt with a shoot-from-here fallback.

## 20. The CPU telegraphs its aim

The CPU walks to its firing spot with the reticle hidden, then stops and slews the reticle to the planned angle at `AI.aimRadiansPerSecond`; `fire()` is gated on the reticle matching the plan within `1e-6` radians.

**Why:** a shot that leaves from an angle the player never saw reads as a cheat, and the pause makes the turn legible instead of instantaneous. The gate also catches a planner angle outside the `AIM` bounds.
**Cost:** up to ~0.37 s of extra turn time for a half-turn of slew, and the CPU's intent is visible before it fires. The fallback bazooka shot is retargeted once so the visible animation has a stable angle to chase.

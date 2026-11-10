# Configuration

Every gameplay number lives in `src/game/config.ts`. Balance changes should never require touching `engine.ts`, the renderer or React.

## Where things live

| File | Owns |
| --- | --- |
| `src/game/config.ts` | weapons, physics constants, aim limits, teams, difficulty, defaults, sanitisation |
| `src/game/types.ts` | contracts (`GameSettings`, `MatchConfig`, `GameSnapshot`, `WeaponDef`…) |
| `src/state/storage.ts` | what is persisted and how it is validated |
| `src/api/mockServer.ts` | fixtures, pagination, idempotency, latency/error scenarios |

## World and physics

| Constant | Value | Unit | Notes |
| --- | --- | --- | --- |
| `WORLD_W` / `WORLD_H` | 1280 × 720 | px | logical arena; renderer letterboxes it |
| `WATER_Y` | 668 | px | below this a worm drowns, projectiles splash |
| `GRAVITY` | 780 | px/s² | worms only |
| `PROJECTILE_GRAVITY` | 520 | px/s² | multiplied by the weapon's `gravityScale` |
| `WORM.walkSpeed` | 74 | px/s | unaffected by wind |
| `WORM.jumpVelocity` | 300 | px/s | jump start only from the ground; one jump per landing |
| `WORM.jumpPush` | 180 | px/s | horizontal carry of a jump, and the air-steer speed while holding a direction |
| `AI.jumpWindowSeconds` | 6 | s | a blocked AI walk may keep jumping before it shoots from where it stands |
| `WORM.maxHp` | 100 | HP | per worm |
| `WORM.fallSafePx` | 150 | px | free fall before damage |
| `WORM.fallDamagePerPx` | 0.16 | HP/px | linear after the safe distance |
| `AIM.min` / `AIM.max` | -3.04 / -0.1 | rad | upper half-plane only |
| `AIM.radius` | 130 | px | the reticle never leaves this circle around the worm |
| `FIXED_DT` | 1/60 | s | simulation step; rendering may run at any frame rate |
| `CHARGE_SECONDS` | 1.1 | s | time from 0 to 100% power |
| `RETREAT_SECONDS` | 3 | s | post-fire movement window before the turn passes |
| `PREVIEW_SECONDS` | 3 | s | free-flight span the dotted aim preview samples when a weapon has no fuse or life |

`WIND_ACCEL` maps the three wind settings to maximum wind units (`off: 0`, `light: 46`, `strong: 105`). Actual wind is re-rolled each turn in `[-max, +max]`, then applied to projectiles as `wind * windScale * 0.9` px/s².

## Weapons

`WEAPONS` is a `Record<WeaponId, WeaponDef>`; adding a weapon means adding one entry, one icon branch in `renderer.drawProjectile`, and one entry in `WEAPON_ORDER`.

| Property | Meaning |
| --- | --- |
| `kind` | `projectile` (drawn with a reticle) or `drop` (placed at the worm, no reticle) |
| `ammo` | `null` = infinite, otherwise per-team stock per match |
| `damage` | base damage at the centre of the blast |
| `radius` | damage radius (px) |
| `terrainRadius` | crater radius (px); intentionally smaller than `radius` |
| `speedMin` / `speedMax` | muzzle speed at 0% / 100% power (px/s) |
| `gravityScale` | fraction of projectile gravity |
| `windScale` | fraction of wind acceleration |
| `fuse` | seconds before detonation, `null` = detonate on impact |
| `bounces` | reflects off terrain with 0.45 damping |

Current loadout: bazooka 42 dmg / 48 px, grenade 52 / 54 with 3 s fuse, shotgun 24 / 12 (flat, 0.34 s life), dynamite 78 / 78 with a 2.2 s fuse (a drop weapon).

Damage falloff: `max(0.22, 1 - distance / (radius + 11))`. A worm on the edge still takes 22%.

## Difficulty

`DIFFICULTY[difficulty].angleError` and `.powerError` are the half-width of random jitter applied to the AI's best solved shot. Rookie ≈ 4.3°/9% power, Veteran ≈ 2°/4.5%, Elite ≈ 0.7°/1.5%. The solver itself is identical; a dynamite drop has no angle or power to jitter.

## Match rules

- Turn timer: 20–90 s in 5 s steps (`TURN_SECONDS`), default 45.
- After firing, the shooter may walk for up to 3 s (`RETREAT_SECONDS`) before the turn passes.
- Teams: 3 worms each, 100 HP.
- Scoring: `kills × 100 + surviving HP + 150 win bonus + max(0, 420 - elapsed)`.
- End reasons: `wipeout`, `surrender` (the result screen also understands `time` for fixture data).

## Settings lifecycle

1. `loadSettings()` reads localStorage, passes it through `sanitizeSettings()`, and clamps invalid values.
2. The menu edits a draft; **Save options** persists and updates React state.
3. Starting a match freezes those values into `MatchConfig` (plus a seed). Later edits apply to the next match only.
4. `configKey` = `` `${turnSeconds}s-${wind}-${difficulty}` `` travels with every match record so the leaderboard only compares like with like.

## Demo network scenarios

`src/api/mockServer.ts` stores a scenario in localStorage and applies it to both transports:

| Scenario | Behaviour |
| --- | --- |
| `normal` | ~120 ms latency |
| `slow` | ~1500 ms latency (shows skeletons and background refresh) |
| `empty` | valid empty pages (shows empty states) |
| `error` | HTTP 503 on reads and writes (shows error states and retry) |

Reset with **Reset demo data** in Options, or `localStorage.removeItem('wormage.mockdb.v1')`.

## Common tweaks

- **Faster, bloodier matches:** `WORM.maxHp = 70`, bazooka `damage = 55`.
- **No wind:** settings only, no code change (`wind: 'off'`).
- **New weapon:** add to `WeaponId`, `WEAPONS` (with `kind`), `WEAPON_ORDER`, then a `drawProjectile` branch.
- **Longer matches:** raise `turnSeconds` in Options; the board separates rulesets automatically.

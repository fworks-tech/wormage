# src/game — simulation and rendering

This folder has **no React imports**. It can be unit-tested or moved to a worker without touching the UI.

| File | Responsibility |
| --- | --- |
| `config.ts` | every tunable number: world size, gravity, wind, weapons, teams, difficulty, defaults |
| `types.ts` | contracts shared by engine, renderer and UI (`GameSnapshot`, `WeaponDef`, `GameEvent`…) |
| `terrain.ts` | seeded island generator, 4 px collision bitmask, destructible canvas, crater carving |
| `engine.ts` | turn state machine, input actions, worm physics, projectiles, damage, scoring, AI scheduling |
| `aim.ts` | bounded aim reticle: fixed-radius circle, stops on terrain inside it |
| `ai.ts` | ballistic forward simulation (`simulateShot`), turn planner (`planAiTurn`), fallback shot planner, angle helpers |
| `capybara-animation.ts` | frame layout and frame selection for the capybara sprite atlas |
| `renderer.ts` | Pixi application, scene graph, worm sprites, particles, aim preview, camera shake, resize/letterbox |
| `audio.ts` | WebAudio synth for fire/explosion/jump/turn/victory |

## Rules of the folder

1. **Engine owns the truth.** Nothing outside may mutate worms or projectiles; expose actions instead.
2. **Renderer is read-only.** It may read engine state and consume `GameEvent`s, never change rules.
3. **Config over constants.** Gameplay numbers belong in `config.ts`; magic numbers in `engine.ts` should be rare and commented.
4. **Time in seconds.** Every rate is per second and multiplied by `dt`; never assume 60 fps.
5. **Events are one-shot.** `engine.events` is a queue drained by the view each frame for sound and particles.

## Data flow per frame

```
GameView tick
  ├─ engine.update(dt)              # simulation
  ├─ engine.events.splice(0)        # → renderer.handleEvent + SoundKit
  ├─ renderer.render(dt, paused)    # pixi scene
  └─ throttled engine.snapshot()    # → React HUD
```

## Adding a weapon

1. Extend `WeaponId` in `types.ts`.
2. Add a `WeaponDef` (marked `projectile` or `drop`) to `WEAPONS` and to `WEAPON_ORDER` in `config.ts`.
3. Add a `drawProjectile` branch in `renderer.ts` (visual only).
4. Ammo, damage, blast radius, wind and gravity are picked up automatically by the engine, AI and preview.

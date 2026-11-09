# 0007. Campaign and progression layer

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

A single skirmish mode has limited retention. The product direction is an RPG layer: a sequence of missions, boss encounters and unlocks that gives players a reason to return and a way to express progress.

## Decision

Wormage gets a **campaign** of authored missions with objectives, boss fights and a progression system:

- XP and levels earned from missions and matches;
- weapons, maps and modes unlocked through progression;
- mission definitions built on the data-driven content schema (ADR 0005);
- progress stored per player account once authentication exists, with a local fallback for the offline demo.

The campaign ships after the content pipeline and online foundation, not before.

## Alternatives considered

- **Cosmetic-only progression** — cheaper to balance, but does not change how the game is played.
- **Roguelite runs instead of authored missions** — high replay value, but a different content and balance model that does not exercise the mission schema.
- **No progression** — keeps the game a pure skill duel, but gives new players no ramp and returning players no goal.

## Consequences

- Mission authoring, objectives and boss mechanics add content work beyond the engine.
- XP and unlocks need server-side validation to resist tampering.
- Balance becomes a moving target as unlocks change the available sandbox.
- Save data needs versioning and migration from the start.

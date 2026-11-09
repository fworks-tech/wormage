# 0004. Weapons, maps and modes as data

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

The campaign needs many weapons, maps and mission types, and balance changes should not require editing engine branches. Today `WEAPONS` in `src/game/config.ts` already centralizes weapon physics, but maps and modes are still implicit in code.

## Decision

Weapons, maps, modes and missions are **typed data**, validated when loaded and consumed by generic engine code. Content has stable string IDs, explicit versions and a schema. Game logic must not branch on a specific content ID unless the mechanic is genuinely unique.

The content pipeline lands before campaign content so missions are authored against a stable schema.

## Alternatives considered

- **Hardcode each weapon and map** — fastest for the first few, but every addition edits the engine and multiplies test surface.
- **Remote CMS from day one** — allows live tuning, but adds an editor, caching and migration burden before the schema is understood.
- **JSON blobs without validation** — flexible, but a typo becomes a runtime crash in the middle of a match.

## Consequences

- Content changes can ship without engine changes and can be tested in isolation.
- The schema becomes an API: changes need versioning and migration.
- Validation must run at build time and at load time for remote content.
- Campaign, unlocks and balance tooling can share the same definitions.

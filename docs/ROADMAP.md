# Roadmap

The GitHub milestones are the source of truth for scope and status. This page mirrors them so the plan is readable from the repository.

| Milestone | Goal | Issues | Exit criteria |
| --- | --- | --- | --- |
| **M0 — Rename + ship** | Ship the renamed project on a public URL with honest docs and a green pipeline | #1–#9, #21, #32, #33 | No old-name leftovers; docs match the code; CI runs typecheck, build and E2E; `wormage.flabs.tech` serves the game |
| **M1 — Reproducible core** | Make the simulation deterministic and unit-testable | #10–#14, #37 | Fixed 60 Hz step; Vitest suite; a recorded action log replays to the same state |
| **M2 — Content pipeline** | Treat weapons, maps, modes and missions as validated data | #15 | New content can be added without engine branches; schema validation runs in CI |
| **M3 — AWS foundation** | Stand up the backend | #16 | CDK stack deploys; API serves matches; DynamoDB single-table access patterns documented |
| **M4a — Hotseat** | Two players, one device | #17 | Turn handoff, hidden information and end-of-match flow work without a server |
| **M4b — Authoritative online** | Online matches with a trusted result | #18 | Server validates actions, stores action logs and replays matches; clients sync by polling |
| **M5 — Campaign + progression** | RPG layer | #19 | Missions, bosses, XP/levels and unlocks persist per account |
| **M6 — Multiplatform** | Installable on every screen | #20 | Installable PWA, offline shell, touch parity and the same profile across devices; native wrapper optional (ADR 0008) |

## Milestone detail

### M0 — Rename + ship

In progress. Rename, runtime namespace, turn-end bug, single weapon physics source, documentation truth pass, CI, MIT license, Vercel deployment, tests in typecheck, the demo notice and project story, and these decision records.

### M1 — Reproducible core

- Fixed 60 Hz timestep (ADR 0006).
- Vitest and engine unit tests.
- Deterministic replay of an action log.
- Terrain collision split from the canvas painter.
- Bounded aim reticle, retreat window and planning AI (#37).

### M2 — Content pipeline

Data-driven weapons, maps, modes and missions (ADR 0005), with schema validation and stable IDs.

### M3 — AWS foundation

CDK, API Gateway HTTP API, Lambda, DynamoDB and the first real endpoints (ADR 0003).

### M4a — Hotseat

Local two-player turns on one device. Proves the turn handoff before networking adds latency.

### M4b — Authoritative online

Server-authoritative play with action-log replay (ADR 0004). Multiplayer follows the staged path: hotseat → challenge links → authoritative online.

### M5 — Campaign + progression

Authored missions, bosses, XP, levels and unlocks (ADR 0007).

### M6 — Multiplatform

PWA install, offline shell and touch parity (ADR 0008), with an optional Capacitor wrapper and cloud save when the ADR's trigger is met.

## Working agreement

One issue per branch and per pull request, Conventional Commits, and a PR that links its issue. See [CONTRIBUTING.md](../CONTRIBUTING.md) for humans and [AGENTS.md](../AGENTS.md) for automated agents.

# Architecture decision records

An ADR captures a decision that is expensive to reverse, the context that forced it, the alternatives considered and what it costs. Code-level trade-offs that describe the current implementation live in [../DECISIONS.md](../DECISIONS.md); this directory holds cross-cutting architecture and roadmap decisions.

Status values: **Proposed** (under discussion), **Accepted** (the direction), **Superseded** (replaced by a later ADR).

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-rename-to-wormage.md) | Rename the project to Wormage | Accepted |
| [0002](0002-vercel-frontend-aws-backend.md) | Vercel frontend, AWS backend | Accepted |
| [0003](0003-aws-serverless-stack.md) | AWS serverless stack and polling | Accepted |
| [0004](0004-server-authoritative-online.md) | Server-authoritative online play | Accepted |
| [0005](0005-data-driven-content.md) | Weapons, maps and modes as data | Accepted |
| [0006](0006-fixed-timestep-simulation.md) | Fixed 60 Hz simulation step | Accepted |
| [0007](0007-campaign-and-progression.md) | Campaign and progression layer | Accepted |
| [0008](0008-pwa-first-multiplatform.md) | PWA-first multiplatform | Accepted |

## Template

Copy this into `NNNN-short-title.md`, number it sequentially and add it to the table.

```md
# NNNN. Title in the imperative

- **Status:** Proposed
- **Date:** YYYY-MM-DD
- **Supersedes:** none

## Context

What forces the decision: constraints, requirements, failure modes.

## Decision

What we will do, in one or two paragraphs.

## Alternatives considered

- **Option** — why it was rejected.

## Consequences

What becomes easier, what becomes harder, and what we accept as a cost.
```

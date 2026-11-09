# Architecture decision records

An ADR captures a decision that is expensive to reverse, the context that forced it, the alternatives considered and what it costs. Code-level trade-offs that describe the current implementation live in [../DECISIONS.md](../DECISIONS.md); this directory holds cross-cutting architecture decisions. Scope and sequencing belong in [../ROADMAP.md](../ROADMAP.md) — an ADR says how the system is built, not what ships next.

Status values: **Proposed** (under discussion), **Accepted** (the direction), **Superseded** (replaced by a later ADR).

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-vercel-frontend-aws-backend.md) | Vercel frontend, AWS backend | Accepted |
| [0002](0002-aws-serverless-stack.md) | AWS serverless stack and polling | Accepted |
| [0003](0003-server-authoritative-online.md) | Server-authoritative online play | Accepted |
| [0004](0004-data-driven-content.md) | Weapons, maps and modes as data | Accepted |
| [0005](0005-fixed-timestep-simulation.md) | Fixed 60 Hz simulation step | Accepted |

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

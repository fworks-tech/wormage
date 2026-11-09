# 0003. Server-authoritative online play

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

Online matches need both players to see the same result and must resist tampering. The simulation uses floating-point arithmetic; running it independently in two browsers can drift after many steps, and browsers differ in math implementations and timing. A peer-to-peer lockstep model would surface that drift as desyncs that are hard to reproduce.

## Decision

The **server is the authority**. Clients submit actions (angle, power, weapon, movement, end turn), the server validates and applies them to the canonical engine, stores the action log and returns the resulting state. Clients render what the server returns and may animate locally for responsiveness, but the server state wins.

Replays are the stored action log applied to the same engine version.

## Alternatives considered

- **Lockstep peer simulation** — no server compute, but any float or timing difference desyncs the match and there is no trusted result.
- **Client-authoritative with sanity checks** — simple, but a modified client can invent damage or positions, and the checks would need to reimplement the simulation anyway.
- **WebRTC peer-to-peer** — low latency, but still needs an authority for results and adds NAT traversal work.

## Consequences

- The engine must be deterministic for a fixed engine version and serializable across the network.
- Ruleset and engine versions must be stored with each match; replays only guarantee correctness on the version that produced them.
- The server needs the same simulation code as the client, packaged for Lambda.
- Every action needs validation, idempotency and authorization checks.
- Turn-based play tolerates the added round trip; real-time play would not.

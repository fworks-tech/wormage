# 0005. Fixed 60 Hz simulation step

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

The engine currently advances physics with the renderer's delta time. A 144 Hz monitor and a throttled background tab therefore integrate different steps, producing different trajectories from the same shot. Replays and server-side simulation need the same inputs to produce the same result.

## Decision

The simulation advances in **fixed 1/60 s steps** through an accumulator. Rendering may interpolate between steps, but gameplay math only runs in fixed steps. Catch-up is capped so a stalled tab cannot run hundreds of steps at once.

## Alternatives considered

- **Variable delta time** — simplest, but results depend on frame rate and cannot be replayed reliably.
- **Semi-fixed steps with a variable remainder** — reduces the problem without removing it.
- **Deterministic lockstep without fixed steps** — still depends on identical step sequences across peers.

## Consequences

- Trajectories become reproducible for a given seed, action sequence and engine version.
- The engine loop, AI simulation and tests must use the same step function.
- Rendering needs interpolation to avoid visible stutter.
- Floating-point math is still platform-dependent in theory; the server-as-authority model in ADR 0003 makes that acceptable in practice.

# 0003. AWS serverless stack and polling

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

The backend must store players, matches, campaign progress and online game state, authenticate requests and stay cheap while the game has little traffic. The team is small and does not want to operate servers, databases or a realtime fleet.

## Decision

- **AWS CDK (TypeScript)** defines all infrastructure.
- **API Gateway HTTP API** exposes the REST surface.
- **Lambda (Node.js, TypeScript)** handles requests.
- **DynamoDB single-table** stores players, matches and game state.
- **Cognito** provides accounts when online play needs identity.
- **Polling** drives online turns; no WebSocket connection is required.

## Alternatives considered

- **WebSocket API + connection state** — lower latency, but adds connection lifecycle, fan-out and reconnection logic that a turn-based game does not need.
- **ALB + ECS/Fargate** — more control, but always-on compute and container operations for a workload that is mostly idle.
- **RDS/Aurora** — relational integrity, but a minimum bill, connection management and migrations that DynamoDB access patterns avoid.
- **Firebase/Supabase** — faster start, but moves the data model and auth off AWS, which the project wants to exercise.

## Consequences

- Cold starts add latency to the first request after idle periods.
- DynamoDB access patterns must be designed before writing endpoints; single-table queries are less flexible than SQL.
- Polling costs one request per interval per active match. Intervals can be relaxed when no turn is pending.
- Vendor lock-in to AWS is accepted in exchange for managed operations.

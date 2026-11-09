# 0002. Vercel frontend, AWS backend

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

Wormage is a static Vite SPA that needs a backend for accounts, match records, campaign progress and authoritative online play. The frontend is already a static bundle and does not need server-side rendering. The backend is expected to be idle most of the day with short bursts around matches.

## Decision

- The frontend is hosted on **Vercel** at `wormage.flabs.tech`.
- The backend runs on **AWS** at `api.wormage.flabs.tech`.
- The SPA reads the API base URL from `VITE_API_URL`; production builds point at the AWS endpoint.
- Both sides deploy independently.

## Alternatives considered

- **Everything on Vercel** — simplest single pipeline, but Vercel Functions are a poor fit for a persistent game API with DynamoDB, queues and scheduled work, and would keep the data layer tied to a hosting vendor.
- **Everything on AWS (S3 + CloudFront)** — one cloud and one bill, but loses Vercel's preview deployments and zero-config static hosting for no gameplay benefit.
- **Same-origin proxy through Vercel** — hides CORS, but adds a hop and a second place where routing can break.

## Consequences

- Two deploy pipelines and two sets of environment variables.
- The API must allow the frontend origin in CORS. Auth uses bearer tokens rather than same-origin cookies.
- Preview deployments need their own allowed origins or a permissive preview policy.
- DNS for `flabs.tech` must point the frontend and API hostnames at the right providers.

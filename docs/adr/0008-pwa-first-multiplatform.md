# 0008. PWA-first multiplatform

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

The game already runs in desktop and mobile browsers with touch controls. Reaching players through app stores means two more codebases, review cycles and release overhead. The core loop is turn-based and does not need native APIs.

## Decision

The web build is the primary product and ships as a **PWA**: installable, with an app manifest, an offline shell for the menu and cached assets, and responsive/touch-first controls. Native wrappers are considered only if store discovery or platform APIs become a measured blocker.

## Alternatives considered

- **Native iOS/Android now** — better store presence, but multiplies maintenance before the game has proven retention.
- **Electron desktop build** — adds distribution size and an update pipeline for a game that already runs in the browser.
- **Responsive web only, no PWA** — simpler, but loses installability and the offline shell that makes the demo resilient.

## Consequences

- One codebase and one deploy target for every platform.
- Offline play is limited to cached content; online play still needs the API.
- iOS imposes storage and background restrictions that the offline strategy must respect.
- No app-store discovery; distribution depends on links and the web.
- Touch parity is a release requirement, not a port done later.

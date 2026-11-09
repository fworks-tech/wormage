# 0001. Rename the project to Wormage

- **Status:** Accepted
- **Date:** 2026-11-09
- **Supersedes:** none

## Context

The project shipped as **Wormageddon**, a pun on Armageddon. The roadmap now includes a mage/RPG layer and a broader identity than a single artillery match. The name is still private: no public URL, accounts or third-party integrations depend on it. Renaming later would mean migrating storage keys, bookmarks, search results and player identities.

## Decision

The product is **Wormage** (Worm + mage, Worm + age). The GitHub repository is `fworks-tech/wormage`, package metadata and UI copy use the new name, localStorage keys use the `wormage.*` namespace and the E2E hook is `window.__WORMAGE__`.

The runtime key rename ships without a migration. Pre-launch demo data may reset once.

## Alternatives considered

- **Keep Wormageddon** — cheaper now, but locks the RPG direction to a one-note pun and makes the eventual rename more expensive.
- **Keep the old name for storage and only rebrand the UI** — leaves two vocabularies in the codebase and docs forever.
- **Write a migration for existing localStorage data** — the only data at risk is demo matches and settings created by developers; the migration would outlive its usefulness.

## Consequences

- Old GitHub URLs redirect automatically.
- Existing local settings, match history and last result reset once for anyone who ran the old build.
- Every new key, test id and doc must use the new name; `grep -ri wormageddon` should stay empty outside this record.

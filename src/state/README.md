# src/state — persistence

`storage.ts` is the only module that touches `localStorage`. Every read is validated, every write is wrapped so private browsing or opaque-origin iframes degrade to in-memory behaviour instead of crashing.

| Key | Contents | Consumer |
| --- | --- | --- |
| `wormage.settings.v1` | turn timer, wind, difficulty, sound | `App` via `loadSettings`/`saveSettings` |
| `wormage.player.v1` | stable player id + display name | `App`, match registration |
| `wormage.lastResult.v1` | last completed `SessionResult` | menu “last drop”, restored after refresh |
| `wormage.mockdb.v1` | mock matches (fixtures + player records) | `src/api/mockServer.ts` |
| `wormage.netScenario.v1` | demo network scenario | `src/api/mockServer.ts` |

## Rules

- **Validate on read.** `sanitizeSettings` clamps the turn timer to 20–90 s in 5 s steps and rejects unknown wind/difficulty values.
- **Never store secrets or credentials.** Only local game data.
- **Version the keys** (`v1`) so a future schema change can migrate or discard safely.
- **Writes are best-effort.** `saveLastResult` failing must not break the result screen.

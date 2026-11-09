# src/ui — React screens and HUD

React renders menus, dialogs and the in-match HUD. It never owns gameplay state.

| File | Responsibility |
| --- | --- |
| `MainMenu.tsx` | hero/briefing, tab navigation, last-result line, start match |
| `OptionsPanel.tsx` | turn timer, wind, difficulty, sound, demo network scenarios |
| `Leaderboard.tsx` | paginated ranking table + shared `Pager` and `formatDuration` |
| `MatchHistory.tsx` | the player's paginated match archive |
| `ResultScreen.tsx` | outcome, score, stats, registration status and retry |
| `GameView.tsx` | mounts engine + Pixi renderer, owns the loop, input, pause rules |
| `Hud.tsx` | team panels, timer, wind, weapons, power, touch/keyboard controls |

## Conventions

- **Snapshot in, callbacks out.** Components receive a `GameSnapshot` and call `onAction` props; they never import the engine.
- **No per-frame renders.** `GameView` pushes snapshots at ~10 Hz. If a new value must be shown, add it to `GameSnapshot` rather than reading the engine from a component.
- **Accessibility is part of the UI.** Buttons have labels, the pause dialog is `aria-modal`, the HUD exposes a polite live region with turn/seconds, and keyboard focus is visible.
- **Touch and mouse share handlers.** Pointer events drive movement pads, aim pads, charge/fire and the drag-to-aim canvas gesture.

## Where to change what

| Need | File |
| --- | --- |
| New menu tab | `MainMenu.tsx` (`TABS`) |
| Extra option | `OptionsPanel.tsx` + `GameSettings` + `sanitizeSettings` |
| HUD element | `Hud.tsx` + `GameSnapshot` |
| Pause/visibility rules | `GameView.tsx` |

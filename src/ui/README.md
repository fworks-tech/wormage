# src/ui — React screens and HUD

React renders menus, dialogs and the in-match HUD. It never owns gameplay state.

| File | Responsibility |
| --- | --- |
| `MainMenu.tsx` | hero/briefing, tab navigation, last-result line, start match |
| `OptionsPanel.tsx` | turn timer, wind, difficulty, sound, demo network scenarios |
| `GameSettingsFields.tsx` | the four match-setting rows shared by Options and Settings |
| `SettingsDialog.tsx` | match settings from the New Game and pause cards |
| `ControlsDialog.tsx` | shortcut list, key capture with reserved-key feedback, duplicate swap, reset and save |
| `useDialogFocus.ts` | moves focus into an open overlay, keeps it inside (Tab, Shift+Tab and stray focus) and returns it to the opener |
| `Leaderboard.tsx` | paginated ranking table + shared `Pager` and `formatDuration` |
| `MatchHistory.tsx` | the player's paginated match archive |
| `ResultScreen.tsx` | outcome, score, stats, registration status and retry |
| `GameView.tsx` | mounts engine + Pixi renderer, owns the loop, input, pause rules |
| `Hud.tsx` | team panels, timer, wind, weapons, power, touch controls (hidden on a fine pointer) |
| `WeaponIcon.tsx` | inline SVG weapon and rope art shared by the HUD and the briefing arsenal |
| `fullscreen.ts` | demo-route guard, Fullscreen API request, `fullscreenchange` state and the fullscreen-only landscape lock |

## Conventions

- **Snapshot in, callbacks out.** Components receive a `GameSnapshot` and call `onAction` props; they never import the engine.
- **No per-frame renders.** `GameView` pushes snapshots at ~10 Hz. If a new value must be shown, add it to `GameSnapshot` rather than reading the engine from a component.
- **Accessibility is part of the UI.** Buttons have labels, the pause dialog is `aria-modal`, the HUD exposes a polite live region with turn/seconds, and keyboard focus is visible. `useDialogFocus` moves focus into an open overlay, wraps Tab, pulls back focus that escapes and restores the opener when the dialog closes; a sub-panel hands focus back to the button that opened it. Escape closes a sub-panel before it resumes the match, except while fullscreen.
- **Touch and mouse share handlers.** Pointer events drive movement pads, aim/reel pads, charge/fire, jump/air steer, the rope card and the drag-to-aim canvas gesture. On touch a tap only aims, a drag past 8 px fires, and `pointercancel` cancels instead of firing.
- **The HUD follows the pointer.** `@media (hover: hover) and (pointer: fine)` hides touch-only controls and centers the weapon dock.
- **Bindings are data.** `src/state/bindings.ts` owns the action list, defaults, labels, Zod validation, reserved-code rules and swap; `GameView` reads the saved map, keeps fixed arrow aliases and the Controls dialog edits a draft. Escape cancels capture and toggles pause outside fullscreen.

## Where to change what

| Need | File |
| --- | --- |
| New menu tab | `MainMenu.tsx` (`TABS`) |
| Extra option | `OptionsPanel.tsx` + `GameSettings` + `sanitizeSettings` |
| HUD element | `Hud.tsx` + `GameSnapshot` |
| Pause/visibility rules | `GameView.tsx` |

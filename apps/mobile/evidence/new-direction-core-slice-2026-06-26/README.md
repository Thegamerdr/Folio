# New direction — core slice (2026-06-26)

Premium money-pressure-map rebuild of the user-facing core slice. The canonical engine,
local storage, review-before-truth behaviour, tests, and APK pipeline are unchanged — only
the user-facing design language of the core slice was replaced, in a new surface at
`apps/mobile/src/surfaces/pressureMap/`.

The screens in `screens/` are captured from the **installed Android APK** on `emulator-5554`
(AVD `CloseLedger_Phone`, 1080×2400). `video/` holds the tap-through recording.

## What each capture shows

| File                       | Screen                 | What it proves                                                                                                                               |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-start.png`             | Pressure Moment        | Opens on the real question ("Will your money last to payday?"), one dominant action, quiet secondary paths — a doorway, not a dashboard/menu |
| `02-rough-input-empty.png` | Rough First Answer     | One topic at a time ("What money can you see today?"), in-app money pad, Skip allowed — a relief path, not a form                            |
| `03-rough-input-value.png` | Rough First Answer     | Same flow with a value entered                                                                                                               |
| `04-review-row.png`        | One-row Truth Decision | "Is this your Tesco? · £42 out · 26 Jun · From your statement" + consequence; Add owns the row                                               |
| `05-review-more.png`       | One-row Truth Decision | "More" expanded below Add/Edit/Ignore — Add stays visible and is never covered                                                               |
| `06-today-path.png`        | Signature Money Path   | The route as the screen's hero object: today → lowest point → payday, waiting-review uncertainty, no overlapping labels                      |
| `07-point-explanation.png` | Point Explanation      | Human explanation of a tapped point (left after this / cause / still waiting) — no engine vocab                                              |
| `08-data-privacy.png`      | Trust / Control        | "It stays on this device." + three plain promises + Export / See what's saved / Start fresh — trust, not admin                               |

## Honest scope note

Secondary sheets reached from quiet links on Today ("What if I spend something?",
"What's behind this picture?") still use the previous styling — they are out of the
core-slice scope for this pass.

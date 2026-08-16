# Phase E performance

## Measurements captured

Current available evidence is automated Node/Vitest and TypeScript timing, not Android runtime timing.

| Area                               | Evidence                                | Result                                                                          |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| Critical journey pure helpers      | `pnpm test -- criticalJourneys ...`     | `criticalJourneys.test.ts`: 9 tests in ~58 ms                                   |
| What Changed summary               | focused Vitest run                      | 10 tests in ~37 ms                                                              |
| Store migration/ledger regressions | focused Vitest run                      | 272 store tests in ~10.1 s; slowest tests are existing 2000-row retention cases |
| Mobile typecheck                   | `pnpm --filter @folio/mobile typecheck` | passed in ~20 s                                                                 |
| Full automated suite               | `pnpm test -- --reporter=dot`           | 233 files / 2696 tests passed; observed ~31 s in latest run                     |
| Root typecheck                     | `pnpm typecheck`                        | passed; observed ~39 s in latest run                                            |
| Mobile bundle build                | `pnpm --filter @folio/mobile build`     | passed; observed ~3 s with warm cache in latest run                             |

## Runtime measurements blocked

Cold start, Today rendering, receipt load, correction recalculation on emulator and logcat checks are blocked by the Android artifact issue documented in `MELO_PHASE_E_ANDROID_EVIDENCE.md`.

## Phase E performance rule

No critical journey requires an LLM call. All Phase E helpers are deterministic and local.

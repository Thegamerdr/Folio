# S9 normal-state contamination audit — 2026-08-26

Read-only audit requested for candidate `21f5bdf5`, package `com.folio.v2.greenfield`, physical S9
serial `2af26a2c19017ece`.

## Hard evidence

- Command used: `C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe devices -l`.
- At `2026-08-26` the only attached target was `emulator-5570`; the requested S9 serial was absent.
- Serial-scoped probes (`getprop ro.product.model`, Android release, `pm path`, and package
  `dumpsys`) therefore returned `device '2af26a2c19017ece' not found`.
- No install, clear-data, app launch, input, UI-hierarchy dump, persistence read, or finance-state
  mutation was performed against the S9.
- The checked-in prior S9 capture record identifies a Samsung SM-G960F / Android 10 / SDK 29 and
  records retained app data, but it is not a live persistence read for this audit.

## Baseline result and limitation

Cold-start, tab, background/resume, UI hierarchy, logcat, and app-private persistence timings could
not be measured because the physical serial was unavailable. The emulator was intentionally not used
as a substitute for the requested physical-S9 baseline, and the old `21f5bdf5` candidate was not
installed or changed.


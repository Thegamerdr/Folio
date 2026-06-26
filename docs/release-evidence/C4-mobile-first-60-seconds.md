# C4 Mobile Shell And First 60 Seconds

## Phase / task IDs

Phase 4. Primary task range: T060 through T070.

## Result

Phase 4 has a live Expo development-build first-minute shell on Android, with the visible
first-value paths implemented through a pure `@folio/first-minute` model package and a mobile
adapter in `apps/mobile`.

The phase gate is met for a truthful labelled preview and temporary three-fact projection:
a new user can reach visible value without sign-in, upfront permission prompts or fake
personalisation. The full locked/unlocked vault release claim is not met yet because native key
wrapping and app-lock proof remain blocked by T016/T017.

## What was built

- `@folio/first-minute`, a pure TypeScript package for first-minute state and validation.
- Synthetic labelled preview data that is explicitly marked as not user finances.
- Three-fact quick-start projection using available now, next income and next important outgoing.
- First-launch data path choices for statement import, quick start and demo.
- Local-first privacy route summary with cloud, banking, camera, microphone, notification and
  calendar routes off until chosen.
- Phase 4 bottom navigation model: Today, Timeline, Money, Plans and Calendar, with Search,
  Transactions and Settings reachable as secondary destinations.
- Mobile Phase 4 first-minute screen in the Expo shell.
- Manual native diagnostics section kept separate from the first-launch value path.
- Figma Phase 4 evidence frame and Huashu critique.

## Task coverage

| Task                         | Status                                                                              | Evidence                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| T060 Expo mobile shell       | Android live preview passed; locked/unlocked network-disabled claim remains blocked | `android-live-preview-phase4.png`, `android-live-preview-phase4-scroll.png` |
| T061 First-run vault create  | Blocked                                                                             | Requires T016 native Keychain/Keystore wrapping and T017 recovery proof     |
| T062 Vault unlock/app lock   | Blocked                                                                             | Requires native unlock, timeout, relaunch and re-enrolment proof            |
| T063 Accessible primitives   | Partially covered                                                                   | Token proof exists; manual TalkBack/large text/reduced-motion pass pending  |
| T064 Today skeleton          | Implemented as first-launch shell                                                   | Mobile screen shows Today/Melo header, important item and gateways          |
| T065 Labelled preview        | Implemented and tested                                                              | `syntheticPreviewTimeline`, app preview list and Android screenshot         |
| T066 Three-fact quick start  | Implemented and tested                                                              | `buildQuickStartProjection`, mobile adapter tests and quick-start panel     |
| T067 Data-path chooser       | Implemented and tested                                                              | Import, quick start and demo choices; no upfront permission prompts         |
| T068 Local-first explanation | Implemented as visible route summary                                                | Mobile privacy section and `localFirstPrivacyRouteSummary`                  |
| T069 Mobile IA               | Implemented and tested                                                              | Bottom nav model and visible nav skeleton                                   |
| T070 Usability test          | Research protocol only; real participant evidence blocked                           | Requires debt-focused and financially avoidant participant sessions         |

## Android live preview evidence

Evidence captured on 2026-06-20:

- Emulator/device: Android emulator development client.
- Runtime package: `com.folio.v2.greenfield`.
- Final Metro log after clean prebuild/reinstall:
  `docs/release-evidence/metro-phase4-live-preview-final.log`.
- Final first viewport screenshot: `docs/release-evidence/android-live-preview-phase4-final.png`.
- Final synthetic timeline screenshot:
  `docs/release-evidence/android-live-preview-phase4-final-scroll.png`.
- Final Today/nav screenshot: `docs/release-evidence/android-live-preview-phase4-final-bottom.png`.
- Final gate screenshot: `docs/release-evidence/android-live-preview-phase4-final-gates.png`.
- Earlier first viewport screenshot: `docs/release-evidence/android-live-preview-phase4.png`.
- Earlier scrolled proof screenshot: `docs/release-evidence/android-live-preview-phase4-scroll.png`.
- UIAutomator dumps:
  - `docs/release-evidence/android-window-phase4-final.xml`
  - `docs/release-evidence/android-window-phase4-final-scroll.xml`
  - `docs/release-evidence/android-window-phase4-final-bottom.xml`
  - `docs/release-evidence/android-window-phase4-final-gates.xml`
  - `docs/release-evidence/android-window-phase4.xml`
  - `docs/release-evidence/android-window-phase4-scroll.xml`

The screenshots show the first-minute shell, local-mode copy, the three reversible paths,
the labelled synthetic demo, the Today skeleton, bottom navigation and Phase 4 gate rows.
The Android dev-client floating menu is visible in evidence screenshots; release-frame
screenshots without the development overlay are still required before public/store claims.

## Verification evidence

Latest completed runs on 2026-06-20:

- `pnpm run ci`: passed.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 14 files and 75 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: dependencies are up to date.
- `pnpm --filter @folio/mobile exec expo prebuild --clean --no-install`: passed.
- Android development-build smoke after clean prebuild/reinstall: passed with explicit
  `JAVA_HOME` and `ANDROID_HOME` in the shell environment and `--no-bundler` against the
  already-running Metro server. Gradle reported `BUILD SUCCESSFUL in 2m 58s`, installed
  `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` and opened the dev-client URL.

The bare `pnpm --filter @folio/mobile native:smoke:android` script still requires Java, Android
SDK environment variables and either a free Metro port or `--no-bundler` handling in the calling
shell. Without those shell variables, Gradle cannot locate Java/Android SDK tooling.

## Figma evidence

Editable Figma evidence exists at:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=6-3`

Figma is review evidence only. The repository, tests and emulator artifacts remain the source
of truth.

## Huashu UI/UX critique

Huashu review outcome:

- The screen is correctly Today-first rather than a generic finance dashboard.
- The preview avoids fake personalisation by labelling every demo item as fictional.
- The data-path chooser avoids account walls, permission walls and goal-questionnaire friction.
- The local-first promise is visible before any import or bank route is selected.
- Native security blockers are visible instead of hidden behind comforting copy.

Issues carried forward:

- The repeated first-launch choices are functional grouped controls; keep monitoring so they do
  not drift into a dashboard card grid.
- The dev-client overlay must be removed from release-frame screenshots.
- Manual TalkBack, large text and reduced-motion testing is still required.
- Real T070 usability evidence requires participant sessions.
- Native vault/app-lock security must not be claimed until T061/T062 are unblocked.

## Boundary conclusion

Phase 4 is complete for the first-minute shell, labelled preview, quick-start model, privacy
copy and navigation skeleton. T061 and T062 remain explicit native-security blockers. T070 remains
blocked on external usability research. No V1 donor runtime code or assets were used.

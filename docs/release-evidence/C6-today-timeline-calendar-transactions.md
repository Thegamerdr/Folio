# C6 Today, Timeline, Calendar And Transactions

## Phase / task IDs

Phase 6. Primary task range: T087 through T098.

## Result

Phase 6 remains the historical pure daily-loop baseline, and the current Melo Android app now also
implements the formerly blocked local calendar-reminder boundary against real user-authored local
state. The release APK has proven explicit notification permission, exact local scheduling,
privacy-safe foreground delivery, quiet channels and persistence across a killed/relaunched app
process. External calendar sync, iOS delivery, manual screen-reader recordings and a full
real-device airplane-mode matrix are still outside the evidence claimed here.

## What was built

- `@folio/today-engine`, a pure TypeScript package for deterministic daily-loop view models.
- Briefing candidate ranking with urgent handling, a maximum of three nonurgent items, confidence
  penalties, fatigue penalties, deterministic ordering and explainable reasons.
- Position summaries that expose account/cashflow inputs, assumptions, protected floor and text
  equivalents.
- Event-first timeline rows that distinguish actual and expected items.
- Transaction list/detail view models with provenance, relationships, split metadata and blocked
  correction placeholders.
- Internal Today, week, month and timeline calendar view models.
- Task/reminder planning plus an Android native local-reminder adapter for real internal-calendar
  events, absolute dates, quiet hours, budgets, owned replacement and restart-safe runtime state.
- Bounded actual-versus-expected variance questions.
- Accessible visual text helpers for chart-like values.
- `@folio/search-engine`, a pure local search contract with workspace scoping, archive/privacy
  controls, typed filters, deterministic natural-language parsing, ranking and highlights.
- Mobile Phase 6 shell evidence in `apps/mobile/src/phase6` and the Expo Today screen.
- Huashu critique record and Figma Phase 6 review evidence.

## Task coverage

| Task                         | Status                                           | Evidence                                                        |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| T087 Briefing engine         | Implemented and tested                           | `rankBriefingCandidates`, max-three nonurgent test              |
| T088 Position summary        | Implemented and tested                           | `buildPositionSummary`, input/assumption tests                  |
| T089 Event-first timeline    | Implemented and tested                           | `buildTimelineRows`, actual/expected ordering tests             |
| T090 Transaction list/detail | Implemented as view model; writes blocked        | `buildTransactionListView`, `buildTransactionDetailView`        |
| T091 Internal calendar views | Implemented and tested                           | `buildInternalCalendarViews`, mobile calendar shell             |
| T092 Tasks/reminders         | Android MVP implemented and tested               | planner model, Add Event reminder controls, absolute requests   |
| T093 Local notifications     | Android release scheduling live-proven           | permission, exact alarm, quiet channels, restart/delivery proof |
| T094 Variance question       | Implemented and tested                           | `buildActualVarianceQuestion`, bounded answer options           |
| T095 Universal local search  | Implemented and tested                           | `@folio/search-engine`, parser/index/ranking tests              |
| T096 System calendar handoff | Blocked by design for launch                     | Internal calendar complete; external handoff requires opt-in    |
| T097 Accessible visuals      | Implemented and tested                           | text equivalents, data rows, non-colour cues, no motion needed  |
| T098 Offline daily-loop E2E  | Shell/pure loop implemented; release E2E blocked | synthetic shell tests; live dev preview                         |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/today-engine typecheck`: passed.
- `pnpm --filter @folio/search-engine typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm vitest run packages/today-engine/test/today-engine.test.ts packages/search-engine/test/search-engine.test.ts apps/mobile/src/phase6/shellEvidence.test.ts`: passed, 31 tests.
- `pnpm lint:boundaries`: passed.

Final Phase 6 gates completed on 2026-06-21:

- `pnpm run ci`: passed; boundaries, V1 proof, synthetic-data policy, constitution gate,
  formatting, typecheck, 20 test files, 131 tests and contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 20 files and 131 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks, 18
  forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.

Android reminder completion checks on 2026-07-14:

- `pnpm --filter @folio/mobile typecheck`: passed.
- focused Vitest run passed 6 files and 45 tests across notification requests, calendar reminders,
  settings migration/defaults, persisted runtime state, snapshot logic and Melo quiet-hour policy.
- `gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64`: passed.
- the release APK showed the real Add Event sheet with date, optional native time and Off / On day /
  Day before / Week before controls; a stale AM selection was visibly rejected.
- creating `Reminder verification` at 23:35 requested Android notification permission only after
  the explicit reminder action.
- `dumpsys alarm` reported Melo's `expo.modules.notifications.NOTIFICATION_EVENT` as an
  `RTC_WAKEUP` for `2026-07-14 23:35:00.000`.
- after `am kill com.folio.v2.greenfield` and a release-app relaunch, the same exact alarm remained
  registered and no fatal Android/React error was logged.
- `dumpsys notification --noredact` showed separate `melo-reminders` and `melo-updates` channels
  with no sound, vibration or badge.
- foreground delivery is owner-scoped: Melo calendar/insight notifications may appear quietly in
  Android's notification list, while unrelated notification owners are not globally opted in.
- a second release-build event, `Reminder delivery proof`, was scheduled for 23:55 while Melo
  remained foregrounded. Android posted it at 23:55 on `melo-reminders`; the visible notification
  contained only `Melo reminder` and `A reminder you chose is due.` and did not expose the event
  title.
- after capture, both diagnostic events were removed, the delivered notification was dismissed,
  reminders were restored to the fresh-account off state, and `dumpsys` confirmed no active Melo
  alarm or notification remained.

Captured release-build artifacts:

- `docs/release-evidence/android-melo-add-event-reminders.png`
- `docs/release-evidence/android-melo-notification-permission.png`
- `docs/release-evidence/android-melo-notification-delivered.png`
- `docs/release-evidence/android-melo-reminder-clean-state.png`
- `docs/release-evidence/android-melo-reminders-default-off.png`

## Android live preview evidence

The Phase 6 mobile shell is integrated into `apps/mobile/app/index.tsx` and was rendered in the
Android Expo development client on `CloseLedger_Phone` on 2026-06-21.

The first preview attempt used `http://127.0.0.1:8083` from the emulator and failed inside Expo
DevLauncher with an unexpected end-of-stream error. Diagnostic artifacts:

- `docs/release-evidence/android-live-preview-phase6-devlauncher-error.png`
- `docs/release-evidence/android-window-phase6-devlauncher-error.xml`
- `docs/release-evidence/android-phase6-devlauncher-error-logcat.log`
- `docs/release-evidence/metro-phase6-live-preview.log`

The successful preview used the emulator host bridge URL
`exp+folio-v2-greenfield://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8084`. Metro
bundled `node_modules\expo-router\entry.js` and the foreground Android window was
`com.folio.v2.greenfield/.MainActivity`.

Successful preview artifacts:

- `docs/release-evidence/metro-phase6-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase6-heading.png`
- `docs/release-evidence/android-window-phase6-heading.xml`
- `docs/release-evidence/android-live-preview-phase6-visible.png`
- `docs/release-evidence/android-window-phase6-visible.xml`

The heading accessibility dump confirms `Phase 6 daily loop`, `Today stays`, `Rent comes before
income`, `Briefing` and `Timeline`. The visible transaction/calendar dump confirms `Timeline` and
`Transactions`. The screenshots include the Expo dev-client floating control; that is development
tooling, not product UI.

This preview proves the synthetic shell renders through Metro in the Android development client. It
does not prove the release-only offline gate because the shell still runs against synthetic fixtures
and a live Metro server, not vault-backed records in airplane mode.

## Figma evidence

Editable Figma evidence is created from the Phase 6 repo contracts and mobile shell.

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=8-2`

Local rendered board:

- `docs/release-evidence/figma-phase6-evidence.png`

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- The new daily-loop UI follows the source package: Today is a flowing briefing, not a dashboard
  grid.
- The hierarchy is functional: briefing, position, timeline, transaction detail, calendar, tasks,
  policy copy, variance question, search and accessible visuals.
- The shell avoids fake personal data by using synthetic-labelled fixtures and explicit blockers.
- Expected and actual rows carry text labels, not colour-only status.
- Notification and calendar copy stays privacy-safe and does not request native permissions.
- Visual summaries include text equivalents, data rows, non-colour cues and no motion dependency.

Issues carried forward:

- Run manual TalkBack, large text and reduced-motion checks before release claims.
- Connect real transaction corrections only through the future vault-backed write adapter.
- Keep external calendar read/sync disabled until explicit opt-in and native evidence exist.
- Keep iOS notification delivery and the wider real-device matrix disabled until equivalent native
  scheduling, quiet-hours and lock-screen privacy evidence is captured there.

## Boundary conclusion

Phase 6 is complete for pure daily-loop contracts, deterministic local search, synthetic mobile
shell evidence, design-review evidence and the current Android local-reminder boundary. Real-data
briefing, vault-backed transaction mutation, iOS notification delivery, optional external calendar
sync and real airplane-mode E2E remain explicit blockers. No V1 donor runtime code or assets were
used.

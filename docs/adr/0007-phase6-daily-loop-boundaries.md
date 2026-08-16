# ADR 0007: Phase 6 Daily Loop Boundaries

Date: 2026-06-21

Status: Accepted with explicit blockers

## Context

Phase 6 introduces the daily loop: Today briefing, position summary, event-first timeline,
transaction inspection, internal calendar, tasks/reminders, notification policy copy, variance
questions, local search and accessible visual summaries.

The source package makes the internal calendar and offline daily loop core product behavior. It
also keeps system calendar handoff optional, and it requires local notification privacy controls
without sensitive default lock-screen text. Real device notification scheduling, external calendar
permissions, vault-backed transaction writes and real-user airplane-mode proof are not available
yet because the upstream native/vault work is still blocked.

## Decision

Implement the unblocked Phase 6 slices as pure contracts and a mobile shell:

- Add `@folio/today-engine` as a pure TypeScript package for deterministic briefing ranking,
  position summaries, timeline rows, transaction list/detail metadata, internal calendar views,
  task/reminder planning, variance questions and accessible visual text.
- Expand `@folio/search-engine` as a pure local search/index/query contract for workspace-scoped
  records, archive/privacy filters, typed filters, deterministic natural-language parsing,
  ranking and highlights.
- Add `apps/mobile/src/phase6` as a synthetic-labelled UI adapter and render it in the Expo Today
  shell as a linear briefing/timeline/planner flow, not a dashboard grid.
- Keep native notification scheduling, external calendar read/write integration and real vault row
  mutation out of this phase. Show policy/blocker copy instead of requesting permissions.
- Treat Figma and Huashu as review evidence only; repo code, tests and emulator artifacts remain
  source of truth.

## Android MVP amendment — 2026-07-14

The inherited Android product has now crossed the notification boundary that was intentionally
blocked in the original Phase 6 slice:

- `apps/mobile/src/folio/lib/calendarReminders.ts` converts user-authored internal calendar events
  into future-only absolute reminder requests with bounded daily/pending budgets.
- `apps/mobile/src/folio/lib/notifications.ts` schedules only Melo-owned local notifications,
  separates reminder/update channels and never globally cancels another notification owner.
- notification intent defaults off; Android permission is requested only when the user explicitly
  enables reminders or creates an event with a reminder.
- lock-screen copy is generic by default and event details require a separate explicit opt-in.
- daily counters and the coarse notification snapshot persist across process restarts without
  persisting amounts, merchant names, titles or notification copy.
- the Android release APK proved the Add Event sheet, native time selection, stale-time rejection,
  permission prompt, exact scheduled alarm, process-restart survival and privacy-safe foreground
  delivery on `CloseLedger_Phone`.

This amendment completes T092/T093 for the current Android MVP boundary. It does not claim iOS
delivery, remote push, marketing notifications, background bank sync, complex planner recurrence
or an external Google Calendar sync.

## Consequences

Phase 6 can validate the daily-loop contract and visible mobile shell while retaining honest
release boundaries. The shell may show synthetic sample values only as labelled proof. It must not
present them as imported personal data or as a live forecast.

The actual release-grade offline daily-loop E2E remains blocked until the vault-backed transaction
repository, native notification adapter, real device calendar handoff policy and manual
accessibility passes are available. System calendar sync remains optional and must not be required
for the internal calendar to work.

## Evidence

- `packages/today-engine/src/index.ts`
- `packages/today-engine/test/today-engine.test.ts`
- `packages/search-engine/src/index.ts`
- `packages/search-engine/test/search-engine.test.ts`
- `apps/mobile/src/phase6/shellEvidence.ts`
- `apps/mobile/src/phase6/shellEvidence.test.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C6-today-timeline-calendar-transactions.md`
- `docs/release-evidence/android-live-preview-phase6-heading.png`
- `docs/release-evidence/android-live-preview-phase6-visible.png`
- `docs/release-evidence/figma-phase6-evidence.png`

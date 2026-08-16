# Plan 109: Root error boundary, Sentry wiring, and background-lane catch discipline

> **Executor instructions**: Follow step by step; verify each step; STOP conditions are
> binding. Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx apps/mobile/src/folio/shell/FolioShell.tsx apps/mobile/src/folio/lib/notifyScheduler.ts apps/mobile/src/folio/widget/widgetSnapshotWriter.tsx apps/mobile/src/folio/widget/widgetTaskHandler.tsx`
> On changes, compare excerpts; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (additive; non-error paths byte-identical)
- **Depends on**: none
- **Category**: bug (launch readiness)
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

This is a local-first money app — a crash-loop locks a real user out of their own
unexported data. Today: (a) NO error boundary exists above FolioShell's screen-level one, so
a throw in root providers, index.tsx, or FolioShell's own chrome/hooks white-screens with no
recovery; (b) the one boundary that exists only `console.error`s — invisible in a release
build even though Sentry is initialized; (c) two boot-time background lanes fire-and-forget
without try/catch, breaking the codebase's own never-throw-from-a-lane convention.

## Current state

- `apps/mobile/src/folio/shell/FolioShell.tsx` (~line 795-825) — the existing
  `ScreenErrorBoundary` class component: catches, `console.error('Screen crashed:', ...)`,
  renders a calm fallback ("Nothing was lost. The rest of Melo is still here — try the
  screen..."). It wraps ONLY `<ScreenView .../>` (~line 462).
- `apps/mobile/src/folio/lib/errorReporting.ts` — `Sentry.init` is real (privacy-tuned);
  the module exports the `Sentry` namespace or an init function — READ IT FIRST to learn
  what to import for `captureException`; nothing in the repo calls captureException today.
- `apps/mobile/app/_layout.tsx` — root providers (fonts, ThemeProvider, optional Clerk,
  error reporting init, widget task handler); NO boundary.
- `apps/mobile/src/folio/lib/notifyScheduler.ts:74-120` — `recomputeAndReschedule()` (no
  try/catch in body) invoked twice as `void recomputeAndReschedule()`.
- `apps/mobile/src/folio/widget/widgetSnapshotWriter.tsx:40-62` — `syncNow()` same pattern.
- `apps/mobile/src/folio/widget/widgetTaskHandler.tsx:19-24` — headless handler, unguarded.
- Copy constraints: visible strings must pass the copy lint (no "again", no shouting caps).
  NOTE: FolioShell is currently EXCLUDED from the widened source-voice lint, but new files
  are not — keep fallback copy in FolioShell or reuse its existing strings.

## Commands

From repo root; pnpm broken — direct binaries:
tests `node node_modules/vitest/vitest.mjs run` (all pass);
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json` (exit 0);
format `node_modules\.bin\prettier.cmd --write <files>`.

## Scope

**In scope**: `apps/mobile/app/_layout.tsx`, `apps/mobile/src/folio/shell/FolioShell.tsx`,
`apps/mobile/src/folio/lib/notifyScheduler.ts`,
`apps/mobile/src/folio/widget/widgetSnapshotWriter.tsx`,
`apps/mobile/src/folio/widget/widgetTaskHandler.tsx`.
**Out of scope**: `errorReporting.ts` internals (only import from it), `app/index.tsx`
(covered by the root boundary above it), any store/persist file, Sentry config/DSN.

## Git workflow

Conventional commit: `fix: root error boundary + Sentry capture + lane catch discipline`. No push.

## Steps

### Step 1: Wire Sentry into the existing ScreenErrorBoundary

In FolioShell's `componentDidCatch`, alongside the existing console.error, capture to
Sentry. Import whatever `errorReporting.ts` exposes (read it first — if it only inits, add
a tiny exported helper THERE is out of scope; instead import `* as Sentry from
'@sentry/react-native'` directly, matching how errorReporting.ts itself imports it). Guard
the capture in try/catch so telemetry can never crash the fallback.

**Verify**: typecheck exit 0.

### Step 2: Root error boundary in `_layout.tsx`

Add a class component `RootErrorBoundary` in `_layout.tsx` (or extract to FolioShell? NO —
keep it IN `_layout.tsx`, self-contained, no folio imports so it can render even when the
folio module graph is the thing that threw). Minimal render on catch: dark-neutral View +
two Text lines (inline styles, no theme dependency): title `Something broke on the way in.`
body `Your data is safe on this device. Close and reopen the app.` Also
Sentry-capture (same guarded pattern). Wrap the OUTERMOST tree in the default export.

**Verify**: typecheck exit 0.

### Step 3: Lane catch discipline

Wrap the bodies of `recomputeAndReschedule` (notifyScheduler.ts), `syncNow`
(widgetSnapshotWriter.tsx), and the widget task handler (widgetTaskHandler.tsx) in
try/catch. Catch = silent no-op with a one-line comment matching the convention used in
`lib/persist.ts` ("best-effort — never blocks/crashes the lane"). widgetTaskHandler's catch
should render its existing null-snapshot fallback if the handler must return something —
read the file and mirror its null path.

**Verify**: typecheck exit 0; `node node_modules/vitest/vitest.mjs run` → all pass.

## Test plan

No new tests (RN class components + native lanes are outside the Node runner). Full suite +
typecheck gate. Reviewer smoke-tests the boundary on device later.

## Done criteria

- [ ] Typecheck exit 0; full suite green.
- [ ] `grep -n "captureException" apps/mobile/src/folio/shell/FolioShell.tsx apps/mobile/app/_layout.tsx` → ≥2 matches.
- [ ] `_layout.tsx` default export wraps the tree in the new boundary; the boundary imports NOTHING from `@/folio/*`.
- [ ] All three lane functions have try/catch bodies.
- [ ] Only in-scope files modified.

## STOP conditions

- `errorReporting.ts` shows Sentry is NOT actually initialized (stub) — report; Step 1/2
  telemetry calls would be dead code and the plan needs rethinking.
- Copy lint fails twice on the fallback strings.
- Any excerpt mismatch (drift).

## Maintenance notes

- The root fallback deliberately has no export button (would require folio imports —
  defeating the purpose). Follow-up idea (deferred): a minimal raw-file export path.
- Reviewer: confirm the root boundary renders with ZERO folio imports (check the import list).

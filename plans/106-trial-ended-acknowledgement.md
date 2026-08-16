# Plan 106: Render the trial-ended acknowledgement moment (plumbing exists, UI doesn't)

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If a STOP condition
> occurs, stop and report — do not improvise. Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/ui/WhatChangedRow.tsx apps/mobile/src/folio/lib/lens.ts apps/mobile/src/folio/screens/TodayScreen.tsx apps/mobile/src/folio/screens/TodayModeScreen.tsx apps/mobile/src/folio/screens/TodayStabilityScreen.tsx`
> On any change, compare "Current state" excerpts to live code; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (additive UI; store plumbing already exists)
- **Depends on**: none
- **Category**: bug (product-trust)
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

The app offers a one-cycle lens trial that auto-relocks when it ends. The store fully
plumbs an acknowledgement moment — `useLens()` returns `trialEndPending` (trial ended, user
not yet told) and `acknowledgeTrialEnd()` — but NOTHING renders it. A user sitting on a free
lens (Survival/Stability — the default) when the trial expires never learns why the paid
lenses relocked: the only passive signal (LensLockChip) renders exclusively on a LOCKED
lens's Today screen. With billing unavailable, the paywall's CTA for a spent trial is the
'none' branch (renders nothing). This is a silent take-away — the exact opposite of the
app's honesty doctrine — right where monetization trust matters most.

## Current state

- `apps/mobile/src/folio/lib/lens.ts` (~line 296) — `useLens()` computes and returns
  `trialEndPending` (true when `trialEndedCycleId` set, not acknowledged, not unlocked) and
  `acknowledgeTrialEnd` (writes `trialEndAcknowledged: true` via the store). Grep confirms
  ZERO consumers of either anywhere in `apps/mobile/src`.
- `apps/mobile/src/folio/ui/WhatChangedRow.tsx` — the pattern to copy EXACTLY: a small
  self-contained Pressable row component (inset background, hairline border, 6px calm dot,
  12px text, ≥44px min height, `makeStyles(t)` with `useTheme`), mounted on all three Today
  screens right under the status strip. Read this file fully before writing yours.
- Mount points (the row goes DIRECTLY BELOW the existing `<WhatChangedRow nav={nav} />` line
  in each file):
  - `apps/mobile/src/folio/screens/TodayScreen.tsx` (~line 560)
  - `apps/mobile/src/folio/screens/TodayModeScreen.tsx` (~line 1032)
  - `apps/mobile/src/folio/screens/TodayStabilityScreen.tsx` (~line 209)
- Copy constraints (CI-enforced): `apps/mobile/src/folio/copy/copyLint.test.ts` +
  `sourceVoiceLint.test.ts` ban the word "again" and shouting-caps in visible strings.
  Voice: calm, no shame, no urgency. Do not promise anything ("upgrade now") — state the
  fact and offer the door.

## Commands you will need

From repo root (`C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp`); pnpm is broken
on this machine — use direct binaries:

| Purpose   | Command                                                                         | Expected |
| --------- | ------------------------------------------------------------------------------- | -------- |
| Tests     | `node node_modules/vitest/vitest.mjs run`                                       | all pass |
| Typecheck | from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json` | exit 0   |
| Format    | `node_modules\.bin\prettier.cmd --write <files>`                                | exit 0   |

## Scope

**In scope**:

- `apps/mobile/src/folio/ui/TrialEndedRow.tsx` (create)
- The three Today screens listed above (one import + one JSX line each)
- `apps/mobile/src/folio/lib/whatChanged.test.ts` — NO. Tests go in a NEW file
  `apps/mobile/src/folio/lib/trialEndedRow.test.ts` ONLY IF you extract pure logic; if the
  component is pure-JSX + hook reads (expected), NO new test file — the vitest Node runner
  cannot load .tsx (see below), and the store plumbing is already tested.

**Out of scope**:

- `lib/lens.ts`, `store.ts` — the plumbing exists; do not change it.
- `PaywallScreen.tsx` / `ctaMode.ts` — the spent-trial paywall branch is deliberate.
- `LensPickerSheet.tsx`.

## Git workflow

Commit on your worktree branch, conventional style:
`feat: trial-ended acknowledgement row on Today`. Do NOT push.

## Steps

### Step 1: Create `apps/mobile/src/folio/ui/TrialEndedRow.tsx`

Model on `WhatChangedRow.tsx` (same doc-header style, same makeStyles pattern, same row
visual language). Behavior:

```tsx
export function TrialEndedRow({ nav }: { nav: Nav }) {
  const { trialEndPending, acknowledgeTrialEnd } = useLens();
  if (!trialEndPending) return null;
  // Row: dot + "Trial ended" + muted "Full lenses are locked — Free keeps working" + "Plans →"
  // onPress: acknowledgeTrialEnd(); nav.go('paywall');
  // Also render a small separate "OK" Pressable (hitSlop 8) that ONLY acknowledges
  // (acknowledgeTrialEnd()) without navigating — the user must be able to dismiss
  // without being routed to a sales surface (doctrine: never force a sell).
}
```

Visible copy (exact strings — they pass the copy lint):

- Title: `Trial ended`
- Body: `Full lenses are locked. Everything Free keeps working.`
- Actions: `Plans →` (routes to paywall) and `OK` (dismiss only).
  Accessibility label on the row: `Your trial ended — Full lenses are locked, everything
Free keeps working. See plans or dismiss.`

**Verify**: typecheck → exit 0.

### Step 2: Mount on the three Today screens

In each of the three files, directly below the existing `<WhatChangedRow nav={nav} />`:
`<TrialEndedRow nav={nav} />` plus the import
`import { TrialEndedRow } from '@/folio/ui/TrialEndedRow';` next to the WhatChangedRow import.

**Verify**: typecheck → exit 0; `node node_modules/vitest/vitest.mjs run` → all pass
(the source-voice lint sweeps source strings — if it fails on your copy, adjust wording
WITHOUT introducing "again" or all-caps words and report the change in NOTES).

## Test plan

No new unit tests (component is .tsx — outside the Node runner's glob; the
`trialEndPending`/`acknowledgeTrialEnd` mechanics are already covered by the store/lens
tests). The full suite + typecheck are the gates.

## Done criteria

- [ ] Typecheck exit 0; full vitest suite passes.
- [ ] `grep -rn "trialEndPending" apps/mobile/src/folio/ui/TrialEndedRow.tsx` → match.
- [ ] All three Today screens render `<TrialEndedRow nav={nav} />`.
- [ ] Dismiss path calls `acknowledgeTrialEnd()` WITHOUT `nav.go`.
- [ ] Only in-scope files modified (`git status`).

## STOP conditions

- `useLens()` does not return `trialEndPending`/`acknowledgeTrialEnd` (drift).
- The three screens no longer contain `<WhatChangedRow nav={nav} />` (drift).
- Copy lint fails twice after wording adjustments.

## Maintenance notes

- If a future briefing/inbox surface lands, this row should fold into it.
- Reviewer: check the row cannot render simultaneously contradicting LensLockChip on a
  locked lens (both can appear on TodayMode — acceptable: chip says the lens is locked,
  row explains why; if it reads badly, the row wins and the chip's lockedAfterTrial branch
  becomes redundant — note it, don't change it here).

# Folio — Faithful RN Re-port — BUILD PLAN

Track 2 (owner, 2026-06-29): a **faithful 1:1 RN re-port** of the Lovable web design
(`folio-melo` `origin/main`, worktree `C:\dev\folio-melo\.claude\worktrees\design-main`)
onto the shipping RN app `C:\dev\folio-v2-greenfield`, branch `claude/folio-rn-faithful-port`.
Follow the design docs as written. Do not break the green build (845 tests).

## 0. Understanding (complete — sources of truth)

- Spec layer read firsthand: `styles.css`, `COPY_DECK.md`, `COPY_LINT.md`, `STATES.md`, `MOTION.md`,
  `MELO_MOODS.md`, `POSITIONING.md`, `RN_PORT.md`, `HANDOFF.md`, `OPEN_QUESTIONS.md`, full 785-line
  `ENGINES.md`, `src/lib/store.ts`.
- Per-screen RN port specs (38): `C:\dev\folio-v2-greenfield\plans\rn-port\specs\*.spec.md`.
- Audit / theme-primitives / engine-contracts: `plans\rn-port\specs\_audit.md`, `_theme-primitives.md`, `_engines-contracts.md`.
- Depth digests (lib engines, router glue, Melo system, research vectors, design system, centerpieces):
  workflow `wf_46f889f6-000` output on disk.

## 1. Placement & isolation (don't break the working app)

- New expo-router route: `apps\mobile\app\folio.tsx` renders a **self-contained shell** (own screen
  state machine mirroring the web `routes/index.tsx` nav) — the existing `app\index.tsx` (FolioHome,
  2763 lines) and `src\surfaces\pressureMap\*` stay untouched.
- Faithful port tree: `apps\mobile\src\folio\` → `screens\`, `sheets\`, `shell\` (TabBar), `copy\`,
  `theme\` (mostly re-exports of kit), `melo\` (5-mood character). One screen/sheet per file, mirroring
  the web `src\components\folio\` tree.
- Swap the default route to the new shell only after it stands on its own + verifies on emulator.

## 2. Reuse map (the existing kit gives ~90%)

REUSE-AS-IS via alias `@/surfaces/pressureMap/...`:

- Tokens/theme: `kit` (`paper`/`paperDark`, `useTheme`, `makeStyles` pattern, `serif` Fraunces consts,
  `gap/radius/pressed/elevation`), `ThemeProvider` already mounted at `app\_layout.tsx`.
- Type prims: `Eyebrow/Display/Headline/Verdict/HeroMoney/Body/Muted`. Layout: `PressureScreen/Surface/Hairline`.
  Actions: `PrimaryAction/GhostButton/QuietLink/ChipToggle/MoneyPad`. Glyphs: `ChevronRight/CheckGlyph`.
- Money: `money/magnitude/poundsLabel` (→ `formatMinorAmount`). Nav: `BottomNav` (NAV_TABS Today/Review/Melo/More).
- Sheet: `@/surfaces/pressureMap/Sheet` (RN Modal+Reanimated — DO NOT add @gorhom). Motion: `useCountUp`.
  Route SVG: `MoneyPath`. Secondary: `secondaryKit` (`ScreenHeader/SectionLabel/MeloLine`).
  BUILD-FRESH (faithful gaps):
- **Melo character** — kit ships a 3–4 mood `MeloFigure`; the spec is **5 moods (calm/curious/cheer/concern/
  celebrate) + 6 poses** (`MELO_MOODS.md`). Build a faithful `src\folio\melo\Melo.tsx` (react-native-svg +
  reanimated breathe/blink/pose-in) to the spec; keep `<MeloLine>` composition.
- **EmptyState** primitive (compose Melo + Headline + Body + PrimaryAction).
- **Haptics** wrapper (only if a surface needs it; `expo install expo-haptics`).
  Deps: only `expo-haptics` is a candidate add. NO `@gorhom/bottom-sheet`, NO `lucide-react-native`
  (hand-rolled SVG glyphs + existing Sheet suffice). Reanimated 4.3.1 / svg 15.15.4 / Fraunces present.

## 3. Engines (8 + readers) — mostly verify/extend existing adapters

Existing adapters live in `apps\mobile\src\local\*` + `packages\{finance,calendar,import,today,plan}-engine`,
`packages\domain`. Build each to ENGINES.md §6 and clear the §7 `@rn-engine` lag. Pure modules + vitest.

1. **edit-txn** (§6 "Editing existing transactions", §7) — real `SheetEditTxn` form; write a `TxnEdit
{txnId,field,before,after,at,by}` correction record; original source preserved; `recomputeRoute()` on save.
2. **pot-cadence** (§6, §7) — read `pot.cadence` (`after-payday`|weekly|monthly|custom), NOT hardcoded Friday,
   in the calendar/finance derivation. `monthly` uses the payday clamp.
3. **payday-clamp** (§6, §7) — clamp invalid day-of-month to last valid (Feb 31→28/29); weekend default =
   previous working day; per-income `weekendRule`; `isBusinessDay()` hook for future UK holidays.
4. **undo-policy** (§6, §7) — unify to Tier-1 6s undo / Tier-2 7-day soft-delete recovery / Tier-3
   double-confirm + export-warning start-fresh. Replace the 3.5/4.5/5/8s mix.
5. **export** (§6, §7) — verify/extend `nativeDataExport.ts` to the full bundle (txns+edits, pots+ledger,
   subs incl paused/cancelled, bills, income, review waiting/ignored, source metadata, route assumptions,
   Melo audit, settings, derived 35-day calendar) → JSON + per-surface CSV in one zip via share sheet.
   Never paywalled.
6. **import-sheet** (§6, §7) — extend `import-engine` + paste reader: CSV/TSV + paste + column-mapping
   visualizer + Folio template → `CandidateMoneyItem[]` → Review. Never auto-counted.
7. **sub-signals** (§6 "Subs — usage decay", §8) — verify `recurringChargeDetection.ts` against
   `SUBSCRIPTION_SIGNAL_RESEARCH.md` thresholds; **surface payment facts only**. NEVER assert usage/value/
   cancel/decay; `usesPerMonth`/`lastUsedDaysAgo` are user-owned, default null, never inferred. Build-gate:
   visible-string scan rejects banned verdict phrases.
8. **hosted-calendar** (§8, HANDOFF §8a) — `calendarIcs.ts` ICS feed is real (RFC-5545); the webcal feed +
   Google one-way push are RN/infra (export/connect sheets are UI; button copy "Add to your calendar app",
   never ".ics"). Live feed/push deferred to infra; UI ports faithfully.
   Readers (ENGINES §0–1, RN_PORT "needs a real engine"): `statementExtraction.ts` (PDF), `nativeImageIntake.ts`
   (photo), `nativeTextExtraction.ts` (paste/CSV/TXT) → `CandidateMoneyItem[]` → Review. **Manual entry is
   failure-only, never the main path.** Store migration already met by `@folio/storage` (versioned, checksummed)
   on `@op-engineering/op-sqlite`.

## 4. Screen port order (waves)

- **Wave 0 — Foundation:** `src\folio\` scaffold; theme re-export + `useTheme`; copy module + copy-lint test;
  Melo 5-mood character; EmptyState; TabBar; the `app\folio.tsx` shell + nav state machine + Sheet host.
- **Wave 1 — Spine:** Start, SheetOnboarding, Today (+ today/ subcomponents: route-draw, nudges, spend strip,
  week tiles, recent txns), the path SVG.
- **Wave 2 — Truth gate:** Review (+ reader success/fallback: Pdf/Image/Paste, Visualizer, Intake, AddEntry),
  SheetEditItem/EditTxn/LogSpend.
- **Wave 3 — Core surfaces:** Pots, Subscriptions (+ SheetSubCaught), Insights, PaydayRitual.
- **Wave 4 — Forecast/recovery:** Calendar (Month/Week/Agenda + bridges + SheetAddEvent/CalendarExport/Connect),
  WhatIf, Shortfall, Recovery, SheetRouteDetail.
- **Wave 5 — Settings/misc:** More, Privacy, Timeline, Plans, GuidedCheckIn, Melo screen, SheetShare.
  Each screen: read its `*.spec.md` + the design-source `.tsx` + COPY_DECK; render all 5 STATES branches;
  named motions per MOTION.md; mood per MELO_MOODS.md; tokens only; no banned words.

## 5. Copy contract

- Port `COPY_DECK.md` to a typed keyed module `src\folio\copy\copy.ts` (ICU params, no concatenation).
- Port `scripts\copy-lint.mjs` → `src\folio\copy\copy-lint.test.ts` (vitest, \*.test.ts) scanning the copy
  module (+ folio strings) against the union of COPY_LINT.md banned strings/regex + COPY_DECK banned words.
- Honest-claims rule: no "stays on this device"/"encrypted"/"bank-grade"/"100%" unless literally true.

## 6. Verification protocol (commands)

- Typecheck: `pnpm --filter @folio/mobile typecheck` (also `pnpm --config.verify-deps-before-run=false run typecheck`).
- Tests: `pnpm --config.verify-deps-before-run=false run test` (vitest, \*.test.ts only). Engines = TDD.
- Lint already RED pre-existing (product-gate comment grep on "score"/"confidence" — avoid those words in
  product comments).
- APK: `pnpm mobile:apk:android`; install: `pnpm mobile:install:android`; smoke: `pnpm mobile:smoke:android`;
  `emulator-5554` live; adb `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.
- Per wave: typecheck + tests green, then emulator screenshot of each ported surface vs design source.

## 7. Multi-agent build orchestration

- **Foundation** (Wave 0): build sequentially/coherently (shared spine — orchestrator-led).
- **Per-screen port→verify pipeline:** for each surface — agent A ports it (from `*.spec.md` + source +
  reused kit), agent B adversarially verifies fidelity (layout/copy/states/motion/mood vs design source) +
  runs copy-lint + typecheck. Parallel across a wave.
- **Engine TDD** (parallel): one agent per engine — write vitest from §6 acceptance (RED) → implement/extend
  adapter (GREEN) → refactor. Pure modules, no RN imports.
- Worktree isolation only if agents would edit shared files concurrently; otherwise distinct new files.

## 8. Hard rules (non-negotiable)

- Review-before-truth: no reader output mutates the path/Today/route without explicit user accept.
- Melo writes only via its 4 named tools (`log_spend/income/refund/transfer` + `addToPot/borrowFromPot`),
  normalised matching, exactly-one-match resolves else return candidates.
- Local-first; no backend dependency in the core path. No new data concepts without an ENGINES.md entry.
- Pricing: never paywall local data, path/Today, Review, export, history. Flag before any monetisation UI.
- Banned words lint-enforced; honest claims only; tokens only (no new colour/font/spacing/radius/shadow);
  tap-only ≥44px; respect reduced motion; do NOT port the web showcase shell (HeroPhone/HeroLoop/Tokens/
  HandoffBoard/routes-index).

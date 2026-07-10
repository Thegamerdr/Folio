# MELO ALIGNMENT AUDIT — whole-app vs the new direction (2026-07-10)

> Commissioned by the owner: compare the existing app against the new Melo direction —
> **premium adaptive money clarity app** (safe / risky / changed / next), 9 modes, 10 core
> systems, Melo Fenice brand (one phoenix, Clarity Ember, coral/gold/cream, premium calm).
> Report + plan only; nothing was implemented. Six parallel read-only audit agents swept
> structure/nav, onboarding/home/systems, data domains/state, premium/settings/modes,
> copy/mascot/visual, and the direction docs. Worktree:
> `C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp` (branch `claude/melo-mvp`,
> HEAD `cc22623`, **3 commits unpushed**: `a52844b`, `3709a5d`, `cc22623`).

---

## 0. Final decision (output 9, up front)

**TARGETED FIXES — no rebuild of the app.** Plus exactly two surgical *layer* rebuilds:
the recurring-bill data model (relative-day counters → date-anchored records) and the
monetization product layer (subscriptions-only Plus/Pro → the owner-confirmed
Free / Full one-time / Live metered model).

Why no rebuild: the new direction is largely a **ratification of what the 07-05 Lovable
port already built**. All 9 target modes exist as real, distinct engine strategies with
per-mode Today heroes. The locked phoenix (`Melo.tsx`: "the owner's LOCKED brand mascot"),
the coral/gold/cream palette (`kit.tsx` "Quiet Paper Luxury", WCAG-annotated), and the
CI-enforced anti-shame copy lint already ARE the brand layer. The store/engine discipline
(encryption at rest, seed containment, import honesty, debt math, bank/card split) is
KEEP-grade. What's wrong is **wiring, framing, and the business layer** — flagship
sheets built but unreachable, payday-survival framing hardwired under all ten modes,
engines that never reach a surface, and an entitlement system that inverts the confirmed
money model. That is fix-and-wire work, not rebuild work.

The stale artifact is `MELO_BLUEPRINT.md` (07-02), not the code.

---

## 1. Current app map (output 1)

Boot: `apps\mobile\app\_layout.tsx` (fonts, ThemeProvider, optional Clerk, error
reporting, widget task handler) → `apps\mobile\app\index.tsx` (single route; hydrate →
melo-blob import → entitlement reconcile → persist → notification scheduler → widget
sync) → `src\folio\shell\FolioShell.tsx` (754 lines — the entire navigation: custom
in-memory ScreenId/SheetId state machine + `historyRef` back-stack; expo-router unused
beyond the one route).

Tabs (4): **Today** (mode-dispatched: survival → `TodayScreen`, stability →
`TodayStabilityScreen`, other 8 → generic `TodayModeScreen`) · **Review** → `TimelineScreen`
· **Melo** → `MeloScreen` · **More** → `MoreScreen` (flat 21-row hub driving most of the app).

Inventory: **30 screens** (`src\folio\screens\`, all resolvable, 2 effectively buried:
`StartScreen` only via Privacy, `GuidedCheckInScreen` only via Start) · **28 sheets**
(`src\folio\sheets\`; **2 orphans with zero openers: `SafeZoneSheet`, `AffordCheckSheet`**)
· 15 UI modules + phoenix companion (`src\folio\melo\Melo.tsx`, 24 importers) · Android
widget (`src\folio\widget\`) · onboarding = `OnboardingSheet` auto-offered on Today
(8 steps, intent→mode picker covering all 10 modes).

Engines that ship: `src\folio\lib\**` (modes/strategies ×10, safeZone, affordCheck,
shelf, caught-bills/subs/income/annual/drift, dedupe, income cadence, debtEngine,
planEngine, merchantCleaner, reconcileStatement, notify, wins) + `src\folio\store.ts`
(3,668-line module store, schema v8, AES-256-GCM at rest) + ~9 live files in `src\local\`
(statement reader chain). `packages\melo-engine` is dead except `notify.ts`.

Dead weight still in the compile/test loop (~55–60k lines): `src\phase4..14` (22 files),
`src\spikes`, `src\bootstrap`, empty `adapters/application/navigation`, ~70 dead files in
`src\local\`, and ~24k lines of `src\surfaces\` legacy (old `mobileShell.tsx` + the entire
pre-port screen set) of which only the kit subset (~3.4k lines: `kit.tsx`, `kitTheme.tsx`,
`Sheet.tsx`, `secondaryKit.tsx`, `MoneyPath.tsx` + helpers, `pressureMap\melo\*`) is live.

## 2. What exists — the asset register (output 2)

**Protected assets (the new direction already lives here — do not lose in any pass):**
- **Mode engine**: 10 lens strategies (`src\folio\lib\modes\strategies\`), each a pure
  `derive(ModeInputs) → ModeState` with its own safe-zone formula, verdict, weather
  thresholds, Melo mood/pose, AI voice tint. Real per-mode heroes in `TodayModeScreen`
  (growth pace, debt payoff, irregular runway bands, household split, planning goal,
  reset days-of-essentials, lowVis signal coverage). This is the strongest asset in the app.
- **Brand layer**: one phoenix, 5 PNG pose sprites, moods by tilt/float/halo/embers
  ("never by recolouring the bird"), locked coral/gold/cream; palette centralized in
  `kit.tsx`/`kitTheme.tsx` with only 6 hardcoded colors in the whole shipping surface;
  one button set, one Sheet primitive, Fraunces display faces. Ember/halo particle system
  = "Clarity Ember" in all but name.
- **Voice system**: all strings in `src\folio\copy\copy.ts` + two CI lint gates
  (`copyLint.test.ts`, melo-engine `BANNED_PATTERNS` incl. the "again" ban, no alarm
  emoji, no shame verbs) enforced against source literals. Zero shame/panic/hype found.
- **Trust machinery**: AES-256-GCM store encryption + keystore key; marker-based seed
  containment (`isRealUser`/`purgeSeedIfReal`); statement pipeline (chunked LLM read →
  removal-only merchant cleaning → reconcile-as-check → stable-hash dedupe → review gate);
  honest balance-source captions; `droppedTransactionCount`; hedged drift copy;
  suppressed-state upsell guard (`lensPaywall.ts` — never sell in storm/recovery/negative
  zone); honest paywall ("Your spare is under zero. Don't subscribe this week.");
  honest privacy screen + genuinely good `PRIVACY_POLICY.md`.
- **Flows that work**: Recovery one-move triage (preview-then-commit, real £ lift);
  payday ritual; review queue with merchant memory (two-tap flip, LRU cap); pots with
  real deposit/borrow/repay ledger; debts with closed-form amortisation + BNPL scheduler;
  Accounts P1/P2 (credit cards as real liabilities, net position, atomic
  pay-card-from-bank); 3-gate resets; real data export.

**Core-system scorecard vs the 10 named systems:**

| System | Status | Evidence |
|---|---|---|
| Money Weather | PARTIAL | Per-mode weather engine complete (8-word vocab in `modes\types.ts`); UI = 12px glyph in the lens pill + widget word. No weather surface/forecast. |
| Safe Zone | BUILT, DOOR MISSING | `modes\safeZone.ts` math + Stability/Mode heroes render it; `SafeZoneSheet` (decomposition + buffer stepper) has **zero openers**; the hero number is not tappable. |
| Bill Shield | ENGINE-ONLY | `shieldedBills()` line inside safeZoneMath + paywall copy. No surface; only visible via the unreachable SafeZoneSheet. |
| Before You Spend | BUILT, DOOR MISSING | `affordCheck.ts` (safe/tight/not-now/safe-later) + `AffordCheckSheet` — **zero openers**. |
| What Changed | PARTIAL | Detection engines strong (drift/caught-*), `TodayAfterScreen` after user actions. No standing "since you last looked" briefing on home. |
| Next Best Action | PARTIAL | `TodayNudges` = real prioritised single chip, framed as chores; per-mode action copy in `modes\action.ts`; no unified named system. |
| Recovery Mode | BUILT (as screen) | `RecoveryScreen` is real; "Recovery" is a screen, not a mode — naming/IA reconciliation with the reset lens needed. |
| Reset Mode | BUILT | `strategies\reset.ts` — days-of-essentials safe zone. Paywalled (Plus). |
| Growth Mode | BUILT | `strategies\growth.ts` + pots-pace hero. Paywalled (Plus). |
| Low Visibility | BUILT | `strategies\lowVis.ts` — signal coverage 0–100 instead of fake numbers. Paywalled (**Pro** — dearest tier for the "just let me see" entry mode). |

## 3. What conflicts with the new direction (output 3)

**A. Payday-survival is structural, not stray copy.**
- The route engine window is payday-bounded: every mode's `tightestSpare`, the app-wide
  pressure band, and Melo's mood derive from a today→next-payday projection
  (`storeRoute.ts`/`moneyPath.ts`). Pay-period math is the single lens under all ten modes.
- "N days to payday →" header on **all three** Today variants, incl. modes whose voice
  bans survival vocabulary. App tagline `copy.ts:41` = "Will my money last to payday?";
  default mode = survival; ~15 sites of make-it-to-payday phrasing (list in §5 of the
  copy audit — worst: `TodayNudges.tsx:156` "You won't make it to payday as things stand").
  Execution is calm (never red, never alarmed) — this is a reframe, not a tone fix.

**B. Monetization inverts the confirmed money model (MONEY_MODEL.md §2b).**
- Code implements superseded Plus £4.99 / Pro £8.99 subscriptions (`lib\lens.ts`,
  `lib\billing\iap.ts` — subscription SKUs only). Owner-confirmed: Free / Full one-time
  ~£29.99 / Live metered. Nothing in code reflects it.
- Exact cost inversion: unlimited AI statement reads + Melo chat (the per-use cost) are
  free to everyone; modes (which Decision B says are mostly fit-free) are the paid thing.
- **P0 bug: the trial never ends.** `endLensTrial()` (`store.ts:2194`) has zero callers;
  "Auto-locks at payday" copy is false — trial = permanent unlock.
- Crisis modes paywalled: Reset behind Plus, Low Visibility behind Pro — the broke and
  the blind pay most. Free line (survival+stability) contradicts confirmed Decision B
  ("fit free" — debt + irregular free at minimum).
- Onboarding gate hole: intent picker sets any mode incl. Pro-tier with no entitlement
  check; lock only bites in LensPickerSheet.
- Gateway has no per-user identity/metering/read-cache — every §4 cost lever unbuilt.

**C. Brand-layer violations (small, contained).**
- `MeloScreen.tsx` "Companion touches" wardrobe (Ember scarf / Paper crown / Listener
  cups, two Plus-gated) = the one dress-up pet-UI element, and it's monetized. The
  4-dot "Plumage" meter reads as XP despite the code insisting otherwise.
- Two mascot systems ship in one bundle: the phoenix vs legacy
  `pressureMap\melo\MeloFigure/MeloPresence` (still live via `MoneyPath` on
  `TodayAfterScreen`).
- `TodayAfterScreen` renders Melo twice; `SafeZoneWidget` is light-palette-only.

**D. Fake certainty (violates the core promise).**
- Melo chat is fed a **fabricated tight point** — hardcoded per-band table
  (612/325/184/42/−86) instead of the real route number (`lib\meloSnapshot.ts:27-34,97`).
- Survival verdict asserts "The middle of next week is the squeeze" purely off a ratio,
  regardless of the actual tight date (`strategies\survival.ts:76`).
- Irregular hero invents an invoice (`typicalInvoice = monthlyIn * 0.5`); Reset shows a
  per-day essentials number that doesn't match the one producing "N days covered";
  Growth projects this cycle's pace as fact; Paywall sells "Bill shield · What changed"
  as `live: true` when neither has a standing surface.
- `EditTxnSheet` cold-opens on a frozen fake row (Tesco · £42 · 26 Jun).

**E. Data-model conflicts.**
- **Bills**: no Bill entity; recurring outflows are `Sub` records keyed by name with
  `nextRenewalDaysAway` — a stored **relative** integer only decremented at ritual close.
  Skip the ritual 3 weeks → every bill date, the Bills Shield amount, and calendar events
  silently wrong by 3 weeks. Rebuild-grade for a "what's about to leave" product
  (`PotCadence` already models the correct date-anchored shape).
- **Balance split-brain** (new, from Accounts P1): `setAccountBalance` doesn't sync the
  legacy `currentBalance` scalar; after statement import + "Use it", Today is right but
  `CalendarScreen`, `AccountScreen`, `SheetDayDetail`, `PaywallScreen`, `ReviewScreen`
  read the stale scalar — the exact coherence-bug class the owner caught on 07-06.
- Sub usage-tracking fields (`markSubUsed` self-reported "pulse turns green") contradict
  the app's own payment-facts-only honesty rule.

**F. Structure/platform conflicts.**
- **No Android back handling anywhere** — system back exits the app from any depth;
  the shell's `historyRef` never connects to `BackHandler`.
- ~55–60k dead lines inside tsconfig/vitest globs; duplicated screen/sheet/nudge sets
  make "edited the wrong Calendar" a live failure mode; green test counts overstate health.
- Nav vocabulary drift: dead ScreenIds (`today-mode`, `today-stability`), stale
  `app/home.tsx` comment, 4-way manual sync to add a screen; no deep links/state restore.
- Boundary inversion: shipping `src\folio` → legacy `src\local` → back into `src\folio\lib`
  (statement reader chain) — naive `src\local` deletion breaks import.
- Docs actively wrong: `STATUS.md`/`HANDOFF.md` describe the other branch/surface;
  blueprint §1/§3/§8/§15 contradict the locked brand and money model.

**G. Scope deltas needing an owner call.**
- Build has a 10th mode (`optimizer`) the new direction omits — kill or keep.
- "Survival" as a user-facing mode NAME collides with the new positioning (~10 files).
- Weather vocabulary: build ~5–6 states vs blueprint 8.
- App identity: Folio (repo, voice doc, release register) vs Melo (blueprint, money
  model) vs "Melo Fenice" — app-name vs companion-name unsettled.

## 4. What is missing (output 4)

1. **Doors to built systems**: `openSheet('safe-zone')` + `openSheet('afford-check')`
   call sites; a Bill Shield surface; a tappable Safe Zone hero.
2. **Standing What-Changed briefing** on home ("since you last looked") — detection
   engines exist; only the after-action surface renders.
3. **Named Next Best Action slot** on home (reframe TodayNudges from chores to
   "next move for your money"; unify with `modes\action.ts`).
4. **Adaptive mode detection wiring**: `modes\suggest.ts` (`suggestMode`) is exported,
   tested, imported by nothing — the "adaptive" in adaptive clarity.
5. **Goals layer (ACCOUNTS_MODEL P5)**: no `Goal` entity (debt-free / buffer /
   clear-debt / save-target) anywhere; spec already written.
6. **Tone as a persistent, app-wide dial (P6)**: `MeloTone` exists but chat-only,
   un-persisted (resets every sheet open), absent from settings.
7. **Accounts hub (P3)** + card payoff UI: no screen reads `s.accounts`;
   `addCardPayoffDetails`/`payCreditCardFromBank`/`needsPayoffDetails` have no surface.
8. **Debts on the route/calendar**: `calendarEvents.ts` has no debt source — in Debt
   mode the money path ignores the largest scheduled outflows.
9. **Metering/allowance layer**: per-user identity at the gateway, usage counting,
   file-hash read-cache, free-read allowance; Full (non-consumable) + Live products in IAP.
10. **Transaction detail view** (correction history + import origin — the "no hidden
    authority" promise) and **date editing** in EditTxnSheet.
11. **Android BackHandler**; deep-link/state restoration story.
12. **Durability**: atomic blob writes (temp+rename), backup rotation, decrypt-failure
    UX (currently silent empty boot, then the next write encrypts empty state OVER the
    old blob), future-schema downgrade message, import log rows (filename/closing
    balance never stamped, no list UI), review-queue TTL expiry honesty, reminder/widget
    health row.
13. **True multi-user household** (current = single-device split calculator, honestly
    marked 'soon') and income smoothing for irregular mode.
14. **Real app lock** (or remove the dead "Face ID · off" stub row); font-scaling
    ceiling (`maxFontSizeMultiplier`); widget dark palette.
15. **Money Weather as an experience** (forecast/`weather about the future`) — currently
    a 12px glyph.

## 5. What to fix first (output 5) — P0, in order

1. **Balance split-brain** — sync `setAccountBalance` → `currentBalance` (or repoint the
   5 stale readers). Correctness of the number on screen; owner's known bug class.
2. **Persistence durability** — atomic write + one-generation backup + visible
   decrypt-failure state (stop silently overwriting the old blob with empty state).
   Data loss is unrecoverable post-encryption.
3. **Trial relock** — call `endLensTrial()` at ritual close/cycle roll; until then the
   paywall copy lies and all monetization data is meaningless.
4. **Wire the two orphaned sheets** — tap-target on the Safe Zone hero → `SafeZoneSheet`;
   a "Before you spend" entry on Today → `AffordCheckSheet`. Hours of work; unlocks two
   of the ten flagship systems and the only view of Bill Shield.
5. **Android BackHandler** bridged to the shell's `historyRef`.
6. **Melo chat fabricated tightPoint** — pass the real route number.
7. **EditTxnSheet fake cold-open row** — empty/error state instead of fabricated money.
8. **Paywall truth pass** — flip "Bill shield / What changed" to `live:false` until
   surfaced; fix "Auto-locks at payday" copy or make it true (see 3).

## 6. What NOT to touch yet (output 6)

- **Mode strategy engine** — retier via `lens.ts` constants only after the owner ratifies
  the free line; don't refactor strategies during alignment.
- **Phoenix, palette, copy-lint system** — protected assets; no visual redesign pass.
- **Import pipeline, seed containment, encryption format** — hardened + proven on real
  data; only the durability wrapper (P0-2) touches persistence.
- **Recovery flow** — works; only naming/IA reconciliation later.
- **`src\local` wholesale deletion** — the statement reader lives there (boundary
  inversion); relocate the ~9 live files first, then delete.
- **"Survival" rename, optimizer kill, app-name decision, Full/Live prices** — owner
  decisions; don't pre-empt in code.
- **Open banking / LIVE-tier infra** — stays deferred per OPEN_BANKING_PLAN.md.
- **The blueprint's deferred list** (extra characters, seasonal, store cosmetics beyond
  wardrobe removal, Watch, web) — still deferred.

## 7. Recommended implementation phases (output 7)

**Phase 0 — Stabilize + de-lie (few days).** All 8 P0 items in §5. Plus: dead-code
removal (phases/spikes/bootstrap/empty dirs; dead `src\surfaces` after inlining the
4-value `ProductScreen` type; dead `src\local` after relocating the live reader files;
retire legacy `MeloFigure/MeloPresence` from `MoneyPath`), tsconfig/vitest glob tightening,
delete dead ScreenIds + stale comments. Push the 3 unpushed commits first.

**Phase 1 — Alignment wiring (the visible new-direction work, ~1–2 weeks).**
Home answers all four questions: standing What-Changed row, named Next-Best-Action slot,
tappable Safe Zone → sheet, Before-You-Spend entry, `suggestMode` banner (honest,
dismissible). De-payday the frame: mode-aware header (payday countdown only where the
mode wants it), tagline swap, the ~15 copy sites, onboarding cadence phrasing; keep the
payday route window internally but stop letting it brand every mode's surface.
Persist onboarding mode-extras for all 10 modes (currently discarded for 8).
Free-tier line per Decision B in `lens.ts` (one-constant change, after owner sign-off).
Formally supersede blueprint §1/§3/§8/§15; refresh STATUS.md/HANDOFF.md.

**Phase 2 — Data-model truth (~1–2 weeks).** Date-anchored bill records (migrate
`nextRenewalDaysAway` → cadence records; reuse the `PotCadence` shape); debts feed
calendar/route; Accounts P3 money hub + card payoff surfaces + P4 multi-account proof;
transaction detail view + date edit; remove sub usage-theater fields.

**Phase 3 — Product layers (~2 weeks).** Goals P5 entity + surfaces; tone P6 (persist,
settings row, app-wide gating of guidance); monetization rebuild — Full (non-consumable)
+ Live (metered) SKUs, gateway per-user auth + usage counting + read-cache + free-read
allowance; paywall restructured to the three-door model with the suppressed-state guard
kept intact.

**Phase 4 — Brand & experience polish (~1 week).** Replace wardrobe/plumage with an
adult companion treatment; Money Weather forecast surface; font-scale ceiling; widget
dark palette; single-Melo-per-screen rule; premium-calm sweep of InsightsScreen tiles;
weather vocabulary decision (5 vs 8).

Gates: Phase 1 needs owner decisions D1–D4 below; Phase 3 needs D5–D6.

## 8. Risk list (output 8)

1. **Silent total data loss** (single non-atomic encrypted blob; decrypt failure boots
   empty then overwrites) — worst-case user event; P0-2.
2. **Monetization false promise** (immortal trial + "auto-locks" copy + `live:true`
   over-claims) — trust + Play-policy exposure the moment billing goes live.
3. **Wrong-file edits** from duplicated legacy trees while they remain in the graph.
4. **Melo AI quoting fabricated numbers** (quantized tightPoint) — the AI face of the
   product contradicting the honesty doctrine.
5. **Coherence regressions** repeating the 07-06 class (balance split-brain pattern
   will recur as accounts work continues; add a selector-only rule for balance reads).
6. **Doc rot steering future sessions wrong** (STATUS/HANDOFF/blueprint all point at
   dead worlds; this file + supersession notes are the mitigation).
7. **Paywalled crisis modes** (Reset/LowVis) — reputational risk squarely against the
   "no shame, safety free" doctrine if shipped as-is.
8. **Release-blocker register stale** (no row re-assessed since 06-30; billing/Sentry/
   privacy work landed after) — ship decisions could rest on outdated gates.
9. **3 unpushed commits** on a single machine + single blob = compound loss risk.
10. **Payday reframe touches the modes doctrine** — "Survival" is both a mode name and
    the old identity; renaming without the owner re-anchoring copy risks drift the other
    way (losing the honest bluntness that works).

## 9. Owner decisions needed before/during Phase 1

- **D1**: `optimizer` mode — kill (9-mode canon) or keep (10th lens)?
- **D2**: "Survival" mode naming/framing under the new positioning (rename vs reframe).
- **D3**: Ratify the free-mode line in code per MONEY_MODEL Decision B (which modes free).
- **D4**: App identity — app name (Melo? Melo Fenice?) vs companion name; settles
  privacy policy + store listing copy too.
- **D5**: Full one-time price + Live metering numbers (MONEY_MODEL §7.3 open items).
- **D6**: Wardrobe — remove outright, or replace with earned-only non-cosmetic
  treatment (blueprint's earned/unbuyable idea, de-childed)?
- **D7**: Weather vocabulary — 5-state MVP or the 8-word blueprint set.

---

*Full agent evidence (file:line for every claim) lives in the six audit transcripts of
session `d2af3fcf` (2026-07-10). Companion docs: `MELO_DRIFT_AUDIT.md` (blueprint→build,
07-02, partly historical — audited the since-archived surface), `MONEY_MODEL.md` (§2b
confirmed model), `ACCOUNTS_MODEL.md` (P3–P6 specs), `GAP_MAP.md`/`PARITY_GAPS.md`
(Lovable→RN parity, mostly closed).*

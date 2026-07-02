# Melo Drift Audit — owner brief → blueprint → build

> Commissioned by the owner (2026-07-02): "what else are you overlooking that you're not telling me that you actually dropped?" Three auditors compared (A) the owner's original brief, (B) MELO_BLUEPRINT.md, (C) the built code on claude/melo-mvp. Statuses: **dropped-silently** = vanished with no decision record · **reinterpreted** = survived as something meaningfully different · **deferred-explicitly** = written decision moved it later · **partial** / **built**.

## A. Brief → Blueprint (translation drift)

### 🔴 Choosable/customizable mascot roster — *reinterpreted*

**Source:** "Users can choose or customize characters such as a gecko, fox, weasel, bear, robot, cat, ghost, or other mascots. The mascot should fit the app's brand and the user's style."

The brief's core idea is a day-one CHOICE of character. The blueprint replaces it with ONE invented custom creature ('Melo') in 3 colorways free; every animal the owner named becomes paid content or dies. Gecko and weasel are killed in §0 with reasons (GEICO, 'weasel' connotation) — that kill IS logged. But the bigger move is not logged as a delta anywhere: fox (Juno), bear (Bruno), robot (Tally), cat (Miso), ghost (Echo) survive only as §3.3 'candidates' relegated to 'premium roster drops (one per quarter)' starting Phase 4/7 — Pebble (otter) and Nugget (dragon), animals the owner never mentioned, jump the queue as the first two premium alternates. Free-tier choice = colorway only ('colorway is aesthetic, not mechanics'). MVP = 'one character (Melo), 3 colorways'. The §16.9 index maps 'Mascot system → §3' as if delivered as asked; the reduction from 'user chooses their character' to 'everyone gets our brand character, choice costs money' is presented as portfolio strategy, never as a departure from the brief.

### 🟠 Cracked-heart / damage states — *partial*

**Source:** "If the user has no money, it can show sadness or damage, such as a cracked heart, but without shame or cruelty."

The owner's specific visual idea (cracked heart, visible damage) survives as exactly one parenthetical clause in the §3.2 Sadness row: 'Damage metaphors (cracks) heal visibly in Recovery — damage is never permanent.' No cracked-heart design, no damage tier in the emotion table, no damage entry in the 20 mascot reactions (§16.4), nothing in the state machine (§4). Design law §3.1.2 ('It can't die, sicken, or be neglected into misery') and the 'Sadness III is rare' framing bias the whole system away from damage. The §0 kill of 'feeding/care/neglect-sickness mechanics' is adjacent but never mentions the damage/cracked-heart idea, so the owner was never shown this got shrunk to a footnote.

### 🟠 Mascot care loop — *reinterpreted*

**Source:** "mascot care/progression loop" (§7 retention loops list)

The 'care' half of the requested loop is killed and philosophically inverted: §0 logs 'Mascot feeding / care / neglect-sickness mechanics — KILLED... Melo cares for you, not you for it', and §3.1.2 makes it design law ('The mascot needs nothing — no food, no cleaning, no health bar'). §7 loop 7 is renamed 'Mascot progression loop' (unlocks/wardrobe only). This one is at least explicitly logged with reasoning — but note the inversion also deletes the entire Finch-style attachment mechanic the owner may have wanted (investment-through-nurture), replacing it with cosmetics-only investment.

### 🟠 Mascot centrality vs. Quiet Mode (blueprint addition that hedges the owner's bet) — *reinterpreted*

**Source:** "But the mascot must not be decoration. It must become part of the product engine."

The blueprint ADDS Quiet Mode (§0 PROMOTED #1, MVP item 16, ships day one): 'one toggle that de-mascots the entire app' — and elevates 'the product still works [without the character] — that's the test' (§3.1.5) into a design law. The owner asked for a mascot-led product; the blueprint builds a Safe-Zone-led product the mascot merely 'carries' (§16.8: 'the mascot its carrier, never its replacement'), with a sanctioned character-free skin. Defensible strategy against the 'childish' risk the owner also flagged — but it structurally demotes the mascot from 'the core idea' (owner's words: 'The current core idea is a customizable mascot/character system') to an optional layer, and that reframing is presented as a promotion, not a departure.

### 🟠 Achievement cosmetics as sellable emotional premium — *reinterpreted*

**Source:** "Emotional premium: rare outfits, advanced mascot customization, animated reactions, seasonal themes, premium rooms, alternate mascots, voice/personality styles, achievement cosmetics, companion pets"

The brief lists 'achievement cosmetics' as a PREMIUM (sellable) category. The blueprint inverts it: achievement items are 'earned only, never sold... visibly *unbuyable* — that's what makes them status' (§3.5). Similarly 'rare outfits' is neutered — §8.1.5 bans artificial scarcity ('Seasonal items return every year', 'limited-time but not artificially scarce'), and 'animated reactions' as premium collides with §8.1.2 'Mood is never for sale' so only celebration-effect *styles* are sellable. These are likely correct ethics calls, but three of the owner's nine named emotional-premium revenue lines were deleted or softened with no §0 entry flagging the change.

### 🟠 Functional premium: alerts and advanced recovery plans as paid features — *partial*

**Source:** "Functional premium: advanced forecasting, custom rules, deeper safe-zone logic, subscriptions/leaks, payday automation, scenario planning, household mode, advanced recovery plans, widgets, weekly/monthly reports, export, alerts"

Two of the owner's twelve functional-premium items are effectively deleted: 'alerts' — screen 23 rules 'Notification volume is never monetized in either direction' (no §0 record); 'advanced recovery plans' — §0 logs 'Recovery Mode free forever' and Pillar 4 allows only a vague future 'proactive recovery planning (pre-storm rehearsal)' which then never appears in the actual Plus catalog (§8.2) or the top-20 premium unlocks (§16.3). 'Widgets' and 'export' are split: widget DATA and raw data export made free-forever (§5.2 #24/#25), only layouts/PDF-reports paid. Net effect: the owner's premium surface was ethically pruned in four places with only one of the four flagged in the decision log.

### ⚪ Brand packs — *dropped-silently*

**Source:** "job packs, brand packs, voice/personality styles" (premium unlock list, brief line 18)

'Brand packs' never appears in the blueprint. The closest survivor is Phase 7's 'collab skins (one tasteful partner/year max)' with an explicit bias to refuse ('collab tackiness — say no a lot'). A named monetization category from the brief became a throttled maybe in the last roadmap phase, with no decision-log entry and no use of the owner's term.

### ⚪ Money Weather screen — *deferred-explicitly*

**Source:** "Include screens for: ... Money Weather screen" (§5) and "2. Money Weather — A simple emotional state system" (§2)

§0 logs the kill: 'Money Weather as its own screen — KILLED... Weather is an ambient layer... not a destination.' It survives as the ambient home layer plus a 'forecast sheet — not a tab' (§5.2 #10), and the pillar itself is kept. Functionally strong, and the delta is honestly recorded — included here so the owner knows a requested screen was demoted to a sheet. Also: the brief's weather states 'danger mode' and 'recovery mode' were absorbed into the §4 state machine rather than kept as weather, and 'night mode' became 'Clear night'; 'Snow' was added.

### ⚪ Money Time Machine as its own pillar and screen — *deferred-explicitly*

**Source:** "9. Money Time Machine — Scenario planning: what happens if I spend, save, work overtime, pay debt, use Klarna, cancel a subscription, or delay a purchase?"

§0 logs the merge: '90% overlaps Before You Spend. Merged into one simulator with two horizons: Now and Later.' Screen 14 keeps the name as 'the Later tab of Ask'. All the owner's scenario examples (overtime shift, Klarna, cancel sub, delay, debt payment) survive as chips. Additionally note it is NOT in the MVP ('scenarios/Later horizon' explicitly cut, §14) — the pillar the owner ranked ninth of ten ships in Phase 4+ behind a paywall for anything beyond 1 active scenario.

### ⚪ Premium tease in onboarding — *partial*

**Source:** "premium tease without blocking value" (§9 onboarding requirements)

The blueprint hardens this to 'no paywall anywhere in the flow' (§9 design law) with only an 'unclickable' locked-wardrobe glimpse and a 'blurred roster glimpse' at mascot selection. The owner asked for a tease; the blueprint delivers roughly 10% of one and states the opposite principle as law. Small, but it's a third instance of the pattern: monetization instructions quietly sanded down by the ethics frame.

### ⚪ Voice/personality styles — *reinterpreted*

**Source:** "voice/personality styles" (premium lists, brief lines 18 and 287)

Delivered as 'personality voices (copy skins: Chattier / Quieter / Dry — changes flavor lines only, never data or warnings)' (§3.5, §8.2). If the owner meant audio voices or genuinely distinct personalities, that's gone — the blueprint deliberately constrains it to text flavor. (A separate 'Voice ask' spoken-verdict idea appears in §16.2 #9, unconnected to mascot personality.)

### ⚪ Requested state list fidelity (Storm, Low Balance) — *reinterpreted*

**Source:** "Include states such as: ... Storm ... Low Balance ... Overspent" (§4)

Two of the owner's ~17 named states were folded: Storm merged into 'OVERSPENT / STORM' (one state), and Low Balance dissolved into Tight/Danger with an inline rationale ('Balance alone is never a state — trajectory is'). Both documented inline, both functionally reasonable; listed so the owner knows the state machine is 15-ish states plus overlays, not the literal 17. 'Payday Eve' was added unprompted (a good one).

### ⚪ Everything else in the brief's 16 sections — *built*

**Source:** Sections 1–16 of the brief (thesis, pillars, state system, 25 screens, home concepts, loops, plans/pricing, onboarding, copy+banned list, 5 visual directions, 11 competitors, risks, MVP, 8-phase roadmap, all 23 deliverables incl. seven top-20 lists)

Faithfully delivered and mapped in the §16.9 index: all 10 pillars (2 restructured as noted above), all requested states plus per-state never-say fields, all 25 screens in the requested per-screen format, 5 home concepts with verdicts, 11 loops in the requested trigger/action/reward/investment format, Free/Plus/Pro+pricing+paywall+anti-paywall+ethics rules, ~90s onboarding, full copy system with CI-enforced banned list, 5 visual directions, full competitor table, 17 risks with mitigations, MVP + fake-manually + rule-based-before-AI answers, 8 phases with goals/risks/validation/metrics, and all seven top-20 lists. The blueprint's compliance with the brief's STRUCTURE is excellent — the deltas are concentrated almost entirely in the mascot roster and the monetization catalog.

*Auditor notes:* PATTERN DIAGNOSIS: the blueprint has one systematic bias — wherever the owner's brief said "sell it," the blueprint's self-imposed ethics frame (mood never for sale / no scarcity / suppressed states / safety free forever) quietly shrank the catalog, and only some of those shrinkages made it into the §0 decision log (Recovery-free and the gecko/weasel kills are logged; achievement-cosmetics inversion, alerts, brand packs, rare-scarcity, and the roster-to-paywall move are not). The second bias: the blueprint consistently protects itself against the "childish mascot" risk (which the owner also flagged) by demoting the mascot from "the core idea" to "the carrier" — Quiet Mode, Safe-Zone-first home, "the product must work without the character." Both biases are defensible product judgment, arguably better than the brief — but they are Fable's calls, not the owner's, and the doc presents them as fulfilled brief rather than amended brief.

WHAT THE BLUEPRINT ADDED that the owner never asked for (so credit/blame lands correctly): Melo the invented custom creature itself (the brand=character play); Quiet Mode; the 24-Hour Shelf; co-breathing storm mode; the "Can you afford Melo?" honesty-check paywall; Fog-state epistemic honesty + never-forecast-on-stale-data; danger-date DELTA notifications ("notify on change, not state"); the ban on the word "again" + banned-list-as-CI-lint; statement-import-first go-to-market (no open banking until the loop proves); the UK renters 22–40 wedge-market pick (brief named no market); Payday Eve state; the suppressed-state monetization rule enforced in code; post-overdraft 7-day upsell embargo; StepChange/Citizens Advice/Trussell signposting; "sessions are not the KPI, afford-checks/week is" north star; one-subscription-covers-household; Pebble and Nugget as the first premium characters; Snow weather; the Build-on-Folio reuse mapping; Warm Paper/Night Ledger/Swiss-as-Quiet-Mode theme strategy; à la carte cosmetic pricing; the 4-tab+floating-Ask navigation. Most are strong additions — but several (Quiet Mode, statement-import-first, the UK wedge, the honesty-check paywall's deliberate conversion cost) are strategic decisions with real consequences the owner should ratify explicitly rather than inherit silently. Blueprint file: C:\dev\folio-v2-greenfield\MELO_BLUEPRINT.md; brief: scratchpad\original_brief.md.

## B. Blueprint → Build: core system

### 🔴 Home-screen widget (the glance loop) — *dropped-silently*

**Source:** §14 MVP item 14: "One widget (small: mascot + number + weather tint)"; §5.1: "for many users the widget *is* the app most days"; metric: "Widget adoption ≥25% of D7 users (the glance loop's leading indicator)"

No widget code exists anywhere — zero matches for 'widget' in apps/mobile/src/melo, no native widget module, no expo widget config. The 0.5-second glance loop the whole product thesis rests on ('glance at Melo the way you glance at the sky') currently requires opening the app. No decision record defers it.

### 🔴 Notification delivery (all of it) — *partial*

**Source:** §14 MVP item 12: "Notifications v1 (payday, danger-entry, danger-date-delta, bill-landed-covered, weekly review; budget enforced)"; §0 promoted #6: "Danger-date delta as the flagship notification"

packages/melo-engine/src/notify.ts builds the full decision logic (budget, quiet hours, transition-only, 9 keys) but NOTHING binds it: zero references to expo-notifications or planNotification anywhere in apps/. Not one notification can ever fire — the flagship 'danger date moved' moment, the payday prompt, the recovery daily check-in (recoveryCheckinDue input exists, surface never computes it) are all engine-only. Also two of item 12's five named pings are missing even from the engine catalog: 'bill-landed-covered' and 'weekly review'. The retention system (§7) is effectively absent at the surface.

### 🔴 Quiet Mode — *reinterpreted*

**Source:** §0 promoted #1: "one toggle that de-mascots the entire app into a minimalist adult utility (same engine, no character)"; §3.1.5: "Quiet Mode removes the character entirely and the product still works — that's the test"; §14 item 16

The toggle exists (MeloSettings.tsx:220) but does something else entirely: MeloGlance.tsx:277-282 only suppresses optional 'info'/'review' action cards. The mascot, its speech lines, and all character chrome remain fully visible. The blueprint's #1 promoted idea — the escape valve against the 'childish' objection (§13 risk 1's named mitigation, 'Quiet Mode at launch') — is not what shipped under that name.

### 🟠 WINNING state (and everything trajectory-based) — *dropped-silently*

**Source:** §4.2 WINNING: "Trigger: 2+ cycles ending positive, savings growing, no recovery in 60d"

derive.ts:210 hardwires cyclesEndedPositive: 0 and :212 daysSinceRecoveryEnd: null; no cycle-history tracking exists in the store, so the engine's 'winning' ladder state (fully implemented in states.ts with weather/mascot/copy) is unreachable for every real user forever. savingsGrowing (:211) is also reinterpreted as the static setup.savingsPence > 0 — a commitment amount, not growth. The 'good month' half of the emotional range is dead code; §13 risk 15 ('too boring — calm months are churn months') loses one of its named answers.

### 🟠 MILESTONE overlay + milestone notification + commemorative items — *dropped-silently*

**Source:** §4.2 MILESTONE: "buffer thresholds (£100/£500/£1k), debt-free date, N green cycles, 1-year anniversary… commemorative item appears in wardrobe (earned, unbuyable)… Notification: yes — this is what notifications are *for*"

derive.ts:215 hardwires milestoneReached: false. The engine's milestone overlay, its notification key, and its copy path can never trigger in live mode. The only echo is the 'buffer-500' tiny win (wins.ts). No earned/unbuyable wardrobe layer exists (all 10 items are freely selectable in settings). The shareable milestone card doesn't exist either.

### 🟠 NEGLECTED → RETURN (the welcome back) — *dropped-silently*

**Source:** §4.2: "Wording (on return): 'Hey. No guilt — money kept moving, I kept notes. 60-second catch-up?' … UI: catch-up card (what changed…)"

Triple-dead: (1) derive.ts:216 hardwires returnedAfterAbsence: false so the overlay never fires; (2) even if it fired, computeCopyKey in states.ts never returns 'return' — COPY.return in copy.ts is unreachable dead copy; (3) no catch-up card UI exists and no day-10 re-engagement ping (notify.ts has no key for it). The state the blueprint uses to define itself against Duolingo guilt mechanics silently vanished between engine and surface.

### 🟠 UNSAFE UNTIL PAYDAY (the honest shortfall flow) — *dropped-silently*

**Source:** §4.2 UNSAFE UNTIL PAYDAY: "Options: shift the phone bill (moves £38), pause 2 subs (£17), or a £61 plan we build together… options-first layout"; §13 risk 12: the flow for users "for whom 'spend less' is arithmetic violence"

No engine computation distinguishes 'this cycle structurally doesn't fit even at minimum' from ordinary overspend, and no options-first UI (bill-shift guidance, pause-subs, build-a-plan) exists. A user whose bills exceed income gets generic Overspent/Recovery copy ('It went over — no lecture') which is subtly wrong: they didn't overspend, the cycle doesn't fit. §13 risk 12's signposting to StepChange/Citizens Advice on 2+ structural-shortfall cycles is also absent. Onboarding's honest-reveal variant exists (MeloOnboarding Reveal 'Tight month already') but the ongoing state does not.

### 🟠 BNPL visibility — *dropped-silently*

**Source:** §2 P1 formula: "− BNPL installments"; §5.2 screen 5 preset chips: "…debt payments, BNPL"; §13 risk 11: "being the app that makes Klarna visible is a positioning gift"

The engine's Bill type has kind: 'bnpl' (safeZone.ts:11) but nothing ever creates one: BILL_PRESETS (presets.ts) has no BNPL chip, onboarding/settings offer no BNPL entry, statement import doesn't tag them, and there's no installment-schedule concept (bills are single monthly dueDay only — a 3-payment Klarna plan can't be represented). The show-the-math waterfall has no BNPL row. A named formula term and a named strategic wedge exist only as an unused string literal.

### 🟠 Mascot fidelity: intensities, idle library, rig — *partial*

**Source:** §14 item 6: "one character (Melo), 3 colorways, 6 emotion families × 2 intensities, idle library, ~10 wardrobe items (free), rigged 2D"; §3.2 micro-idle library "randomized, 8–12s cadence… alive at rest — that's where attachment forms"

3 colorways ✓, 10 wardrobe items ✓, 7 families ✓ (squint added). But: the engine emits intensity 1|2|3 and MeloMascot.tsx accepts only `emotion: MascotFamily` — intensity is computed and then discarded at render (MeloGlance passes model.view.mascot.family only). The idle library is one breathing scale-loop; no blinks, no glances at the weather, no ledger check, no outfit adjust — the 'alive at rest' attachment mechanic isn't there. Rig is static react-native-svg, not Rive/rigged animation. Onboarding 'mascot reacts to every answer' (§9 design law) also absent — it appears only at cold open, picker, and reveal.

### 🟠 Onboarding beats 6–7 + resume + irregular income — *partial*

**Source:** §9 table: beat 6 "Accuracy fork: connect (read-only) / import statement / stay manual"; beat 7 "Notifications honest pitch… → [Fair] / [Essentials only]"; "abandons at 2–4 → next open resumes in place"; beat 3 "'it varies' path"; §5.2 screen 3 patterns "last working day… every 2 weeks, irregular"

Built beats: cold open, pick, payday, income, balance (added, sensibly), bills, reveal — all good. Missing: the accuracy fork never appears (statement import is only discoverable later via a small underlined link inside the balance-edit card on home); the notifications-permission beat is gone (consistent with no notifications, but it means launch can't add pings without a permission story); onboarding progress isn't persisted so abandoning at beat 4 restarts from zero; there is no 'it varies' irregular-income path or P25 mode; payday patterns are 7 fixed day-of-month chips with a 'pick the 28th for now' workaround for last-working-day.

### 🟠 Afford-check asserts the forecast instead of computing it — *reinterpreted*

**Source:** §2 P8: verdict card shows "the post-purchase Safe Zone, danger-date impact, and one alternative"; §13 risk 3: never fabricate reassurance

checkAfford (safeZone.ts:109) returns only verdict + leftAfterPence. The copy then claims forecast outcomes it never computed: affordSafe says "and {dangerDay} stays on plan" / blueprint's 'Thursday stays sunny' without re-projecting the danger date at the reduced zone. COPY.billWeek similarly asserts "all shielded" without checking billsCovered (the danger copy WAS guarded via dangerUncovered — the same discipline wasn't applied here). 'Safe on [date]' alternative exists only as the notNow line's payday mention.

### 🟠 Payday ritual savings step is a non-choice — *partial*

**Source:** §2 P3: "Set aside savings (pre-committed amount, one tap, skippable without guilt)"; §14 item 7: "ledger-allocation sweep"

MeloRitual beat 3 shows 'Set aside £40' vs 'not this month' — both buttons do exactly the same thing (setBeat(4)); no state is written either way. Because setup.savingsPence is always subtracted in computeSafeZone, a user who taps 'not this month' still has savings withheld from their Safe Zone for the cycle. The choice is theater; the sweep allocates nothing. (Rest of the ritual — 5 beats, protect list, honest negative-month reveal variant, real smartMove — is genuinely built.)

### 🟠 Statement import: PDF path — *partial*

**Source:** §14 item 15: "Statement import (CSV/PDF → balance + recurring-bill detection)"

CSV/TSV/TXT paste + file-pick works end-to-end (parse, closing balance, bill detection, dedupe, atomic apply — solid). PDF is explicitly rejected: MeloImport.tsx looksLikeTextStatement turns away anything non-text with 'That file type can't be read here — CSV or TXT works.' Many UK banks export PDF-only; the Folio statement-reader heritage the blueprint cites as the reuse path handles PDFs, so this is a scoped-down import, not the blueprinted one.

### ⚪ Danger-state 3-item micro-plan — *partial*

**Source:** §4.2 DANGER: "Action: 3-item micro-plan (move £X, pause sub Y, shift bill Z); 'talk it through' (Ask Melo)"

Danger offers a single keep-dry per-day number and the recovery walkthrough. There is no pause-a-sub or shift-a-bill action anywhere (bills have no pause/shift affordance). 'Ask Melo' chat is legitimately deferred (§14 puts AI later), but the deterministic micro-plan was MVP-compatible arithmetic and isn't there; smartMoves.ts billCluster suggests spreading bills but only as prose inside the payday ritual.

### ⚪ monetizationAllowed + overdraft embargo consumed nowhere — *partial*

**Source:** §4.3: "monetization_allowed… Enforced at the component level so no future feature can accidentally upsell a drowning user"; states.ts §8.4 OVERDRAFT_EMBARGO_DAYS

The flag is computed correctly in the engine but its only consumer is the __DEV__ debug chip (MeloGlance.tsx:951). No enforcement component/guard exists for future surfaces. Its daysSinceOverdraftEvent input is hardwired null in derive.ts:214 (no overdraft-event history is stored), so the 7-day post-overdraft embargo can never trigger even when a store ships. Defensible now (store is excluded from MVP by §14) but the contract's enforcement point doesn't exist and one input is already dead.

### ⚪ PROTECTED state criteria diluted — *reinterpreted*

**Source:** §4.2 PROTECTED: "Calm, and 100% of cycle bills shielded + buffer intact"

derive.ts:208-209 sets allBillsShielded = engineBills.length > 0 (having ANY bill counts) and bufferIntact = safeZonePence >= 0 (zone non-negative, not buffer untouched). A user with one bill entered and £1 of zone reads as 'Bills covered, buffer intact. This is a good place.' — a mild fabricated-reassurance risk in the state whose whole point is verified protection.

### ⚪ Accuracy-feedback trust metric not instrumented — *partial*

**Source:** §5.2 screen 9: "accuracy feedback ('does this feel right?' 👍/👎 — the trust flywheel and the tuning signal)"; §14 metrics: "Trust: ≥80% 👍 on the Safe-Zone accuracy prompt"

The math sheet has 'Looks right' / 'Something's off' buttons (the latter routes to settings — good), but neither calls store.bump(), so the §14 trust metric — one of the seven MVP success gates — has no data. Other events are instrumented (check, ritualDone, importApplied…), making this the one named metric with zero signal.

### ⚪ Comfortable per-day threshold hardwired — *reinterpreted*

**Source:** §4.2 TIGHT: "per-day < comfortable threshold (learned)"

derive.ts:192 hardwires comfortablePerDayPence: 800 (£8/day) for every user. 'Learned' silently became a universal constant that isn't user-visible or editable — a London user and a rural user get the same Tight boundary. Not in §14's sanctioned 'fake manually' list (which covers payday detection, bill detection, smart moves, copy).

### ⚪ Tiny-win types diverge from the blueprint's list — *reinterpreted*

**Source:** §2 P10: "cancelled a sub, pushed the danger date back, first £10 saved, a whole cycle without overdraft, checked before buying, survived bill week"

wins.ts has 8 types satisfying §14 item 11's count, but three of the blueprint's motivating examples are absent: 'pushed the danger date back' (the product's flagship proof-of-agency moment has no win), 'a whole cycle without overdraft' (needs the missing cycle history), and 'survived bill week'. Replacements (first-spend-logged, five-checks-week, first-ritual) skew toward app-usage wins rather than money-outcome wins.

### ⚪ Hysteresis bands replaced with a different anti-flap scheme — *reinterpreted*

**Source:** §4.1: "hysteresis bands on every ladder boundary (enter Warning at ≤4 days runway, exit at ≥6); min dwell 24h per ladder state"

states.ts implements: any projected danger date → Warning immediately (worsening bypasses dwell — a deliberate, documented safety-over-stability call), 24h dwell on improvement only, and Warning exit requiring runway ≥ daysToPayday + 2. Different numbers and shape from the spec'd ≤4/≥6 bands. Arguably better (safety is never delayed), and the deviation is comment-documented in the file header — flagged because it is a spec change made without a §0-style decision record.

### ⚪ SAFE UNTIL PAYDAY banner (P80 confidence) — *dropped-silently*

**Source:** §4.2 SAFE UNTIL PAYDAY: "Trigger: even at P80 spend, user reaches payday positive… green-tick variant of the forecast strip"

No percentile spend model exists (run-rate is a single trailing-7-day mean, spend.ts) and no 'even a heavy week doesn't break it' banner or green-tick strip variant is rendered. Calm copy partially covers the feeling, but the computed all-clear — and the surplus-sweep suggestion attached to it — is absent.

### ⚪ Clear-night and snow weather — *deferred-explicitly*

**Source:** §2 P2: "Sunny, Clear night, Cloudy, Rain, Storm, Fog, Rainbow, Snow"

§14 item 4 scopes MVP weather to 5 states (sunny, cloudy, rain, storm, fog); build ships those plus rainbow (a bonus beyond the MVP list). Clear night and snow are legitimately out per the written MVP definition. Noted only so the count difference isn't mistaken for a silent drop.

### ⚪ Fog suspends some forecasting but not all — *partial*

**Source:** §4.2 FOG: "forecasting suspended (never forecast on fog — wrong-number risk, §13)"

Afford-check correctly refuses in fog (affordFog verdict), the sub shows staleness, and a 'stale' badge renders. But deriveLive still computes the danger date on stale data and MeloGlance still passes dangerDay to the RunwayStrip, so the storm cell stays on the runway during fog — a forecast rendered from data the app just said it can't trust.

*Auditor notes:* Scope: compared MELO_BLUEPRINT.md §2/§4/§9/§14 against C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp (packages/melo-engine/src/*.ts + apps/mobile/src/melo/**). What IS faithfully built and deserves credit: Safe Zone engine with exact-sum breakdown and show-the-math sheet; danger-date projection with run-rate observation and the two-distinct-days guard; the full 4-layer state machine with sticky journey persisted across restarts; Recovery 3-step + in-app daily move + earned-green-days graduation; Bills Shield with honest coverage bar; Payday Ritual 5 beats with real smartMove rule table; Before-You-Spend Now + 24-Hour Shelf with next-day re-verdict; 8 tiny wins + ticker + weekly review; CSV statement import with dedupe and atomic apply; copy system with the §10.3 banned-list enforced as a CI test (lintCopy) including the 'again' ban; co-breathing danger mascot (10s ≈ 6 breaths/min); reduce-motion respect; encrypted-at-rest store; demo mode behind 'look around first'; manual 'I got paid'; weekend-payday Friday shift. §14's explicit exclusions (leaks, Later horizon, bank connect, store, extra characters, household, seasonal) are correctly absent. The two systemic failure patterns to watch: (1) StateInputs hardwired at derive.ts:210-216 (cyclesEndedPositive:0, milestoneReached:false, returnedAfterAbsence:false, daysSinceRecoveryEnd:null, daysSinceOverdraftEvent:null) silently kill four fully-built engine states — the engine looks complete in tests but a third of the emotional range is unreachable in production; (2) the surface occasionally asserts what the engine never computed (afford 'stays on plan', billWeek 'all shielded', PROTECTED's diluted criteria) — the exact §13-risk-3 fabricated-reassurance class the codebase elsewhere guards against (dangerUncovered). Biggest absolute gaps vs the MVP list: item 14 (widget) and item 12 (notification delivery) — the two surfaces the blueprint calls the glance loop and the retention loop.

## C. Blueprint → Build: experience layers

### 🔴 Quiet Mode (de-mascoted app) — *reinterpreted*

**Source:** §0 PROMOTED #1: "Quiet Mode — one toggle that de-mascots the entire app into a minimalist adult utility (same engine, no character)"; §6.2E: "ships at launch as Quiet Mode (one toggle)... no character"

The build's Quiet Mode (MeloSettings.tsx 'Ambient only — No nudges, no prompts') only suppresses optional info/review action cards in MeloGlance.tsx; the mascot, sky, and character remain fully present. The blueprint's Quiet Mode is the escape valve for its #1 brand risk ('mascot reads childish') and was specified as a §14 MVP item ('Quiet Mode toggle'). What shipped is a notification-quietness toggle wearing the feature's name — the 'Swiss Money / no character' skin does not exist. No decision record for the change.

### 🔴 Notifications v1 (delivery) — *partial*

**Source:** §14 item 12: "Notifications v1 (payday, danger-entry, danger-date-delta, bill-landed-covered, weekly review; budget enforced)"; §16.5 catalog; MELO_PHASE2_PLAN §2.5 lists it as in-scope

packages/melo-engine/src/notify.ts is a complete, tested, pure decision engine (budget ≤1/day, quiet hours, transition-not-state, 9 keys incl. the flagship dangerDateMoved). But grep for planNotification/expo-notifications in apps/mobile returns ZERO matches — nothing calls it, no scheduling, no permission ask, no OS notification will ever fire. The app is mute when closed, which kills the danger-warning, Sunday-reset, and payday loops for any user who doesn't open the app. The only record is a code comment ('the surface binds decisions to expo-notifications once that module ships in a native build') — not a plan-level decision. The §9 onboarding notification-consent beat (beat 7) is also absent.

### 🔴 Phase-1 user-validation gate (test kit) — no record it ran — *dropped-silently*

**Source:** §15 Phase 1 validation questions + MELO_PHASE2_PLAN header: "Phase-1 user validation is the remaining gate: run prototypes\melo-phase1\MELO_USER_TEST_KIT.md first" and §4: "green-light Melo Phase 2 only on a passed gate"

The Phase-2 build exists in full, but nothing in the worktree records the test kit being run or the gate passing — the plan's own days-1–3 precondition ('Is the number understood unprompted? Does the character read adult?... zero 'it's for kids' reads') appears to have been skipped in favor of building. If the kit was run elsewhere, the result was not written down; if it wasn't, the art-direction and comprehension risks (§13 risk 1) are being carried into code unvalidated — the exact sequencing the plan was written to prevent.

### 🟠 Widget (small: mascot + number + tint) — *deferred-explicitly*

**Source:** §14 item 14: "One widget (small: mascot + number + weather tint)"; §5.2 screen 24: "the true daily surface — the glance without the open"; §7 loop 9: "the widget is the top of every other loop's funnel"

No widget code exists anywhere in the melo surface. MELO_PHASE2_PLAN §2.7 wrote the deferral down: 'only if the 30 days allow; otherwise first item of Phase 2.5'. Legitimate, but note the blueprint makes the widget the daily-glance loop's engine and a §14 success metric (widget adoption ≥25% of D7) — the MVP bet ('return daily because of how it feels') is being tested without its main return mechanism.

### 🟠 Copy linter coverage (§10.3 'enforced as CI lint') — *partial*

**Source:** §10.3: "The banned list (enforced as a CI copy-lint, not a vibe)"; §4.3: "All copy keys route through the tone linter in CI"

copy.ts implements BANNED_PATTERNS + lintCopy and copy.test.ts runs it against engine COPY templates — real enforcement, and 'again' is banned outright. Two honest gaps: (1) BANNED_PATTERNS is self-described as 'the machine-checkable subset' — missing entries include 'what happened', 'you should have', 'be careful', 'only £X', 'Melo will miss you', 'piggy bank', 'treat yourself' IS present but the corporate list ('empower', 'financial wellness journey', 'insufficient funds' IS present) is mostly absent; (2) surface-level strings never pass through the linter — LIVE_L2 in MeloGlance.tsx, all ritual/recovery/onboarding/settings copy live as raw literals in .tsx, outside CI enforcement. One bad string in a screen file ships unchecked, which is exactly the drift §13 risk 2 warned about.

### 🟠 Payday patterns + weekend-shift rule (§13 risk 16) — *dropped-silently*

**Source:** §5.2 screen 3: "date picker with patterns (last working day, specific date, every 2 weeks, irregular); weekend-shift rule (UK paydays drift — ask once, handle forever)"; §16.1 #14: "every UK competitor gets it wrong"

Build offers only fixed day-of-month chips (1/5/10/15/20/25/28) with the note 'Paid the last working day? Pick the 28th for now' (MeloOnboarding.tsx) — the exact approximation the blueprint called out as the thing everyone gets wrong. No last-working-day pattern, no fortnightly, no weekend-shift rule. Partially softened by the manual 'I got paid' trigger in MeloSettings (a §14-sanctioned fake), but the flagship ritual will misfire on the wrong day for last-working-day payees, which §13 risk 16 says breaks the signature moment.

### 🟠 Irregular / variable income path (§13 risk 8) — *dropped-silently*

**Source:** §5.2 screen 3 secondary CTA: "'It's irregular' → switches engine to percentile mode"; screen 4: "variable-income toggle → 'what's a low month?' (plan on P25)"; §13 risk 8: gig workers are "a huge slice of the wedge"

No 'it varies' toggle, no P25 planning, no income ranges anywhere in onboarding, settings, or engine. The full irregular-income ENGINE is Plus/Phase 5, but the onboarding acknowledgment path was in the §5 screen spec and vanished without a note — a zero-hours user hits a single 'Roughly what lands?' box and a fixed payday chip with no honest handling of their reality.

### 🟠 BNPL visibility (§13 risk 11) — *partial*

**Source:** §2 P1 formula: "− BNPL installments"; §5.2 screen 5 chips include "BNPL"; §13 risk 11: "being the app that makes Klarna visible is a positioning gift"; MELO_PHASE2_PLAN kill criteria name "BNPL schedules"

The engine supports it (safeZone.ts BillKind = 'bill' | 'bnpl' | 'debt', tested in safeZone.test.ts with a Klarna case) but no UI path exists: BILL_PRESETS in presets.ts has no BNPL/Klarna chip (only 'Debt payment'), there is no installment-schedule entry, no multi-cycle overlay in the afford check, and the Glance math breakdown has no BNPL row. A user cannot actually make their Klarna visible — the positioning gift is engine-only.

### 🟠 Safe Zone setup beat (buffer + essentials questions) — *dropped-silently*

**Source:** §5.2 screen 6: "essentials estimate (food/transport — slider); buffer choice (£0/£25/£50/£100 with plain meaning: '£50 buffer = I'll warn you £50 early')"

Onboarding hardcodes essentialsPerDayPence: 1_400, savingsPence: 4_000, bufferPence: 2_000 (MeloOnboarding.tsx draft) — the user is never asked. The values are editable later in Settings, but the reveal number is computed from invented essentials the user never saw, which strains the 'show the math' trust story: the first math sheet contains an 'Essentials · estimated' line the user didn't provide. The blueprint made these 'the last two inputs the formula needs' before the reveal.

### 🟠 Mascot reacting live during onboarding — *dropped-silently*

**Source:** §9 design law: "the mascot reacts to every answer (the form is alive)"; §5.2 screen 1 mascot: "reacts live to each answer"; screen 5: "mascot stacks each into the chest — the Shield builds live"

The mascot appears only on the cold-open beat and the reveal (MeloOnboarding.tsx); the payday/income/balance/bills beats are plain form steps with no character presence — no calendar-circling, no ledger-writing, no bill-stacking into the chest. The 'alive form' was the blueprint's stated mechanism for making the 90 seconds feel like meeting a companion rather than filling in a form.

### 🟠 Unsafe-cycle options flow (§4 UNSAFE, §13 risk 12) — *dropped-silently*

**Source:** §4 UNSAFE UNTIL PAYDAY: "Options: shift the phone bill (moves £38), pause 2 subs (£17), or a £61 plan we build together"; §13 risk 12 mitigation: "The Unsafe-cycle flow (options, not lectures)"

There is no options-first Unsafe state or flow anywhere. Bills-exceed-income at onboarding gets the honest 'Tight month already' reveal variant (built, good) and negative Safe Zone routes to Recovery, but the distinct 'this cycle doesn't fit — here are the options' treatment for structural shortfall does not exist. Related and also absent: the StepChange/Citizens Advice/Trussell signposting the blueprint required 'natively, unmonetized, when shortfall is structural for 2+ cycles' — the ethical floor for exactly the users the wedge targets.

### 🟠 Accuracy-feedback instrumentation (trust flywheel) — *partial*

**Source:** §5.2 screen 9: "accuracy feedback ('does this feel right?' 👍/👎 — the trust flywheel and the tuning signal)"; §14 metric: "≥80% 👍 on the Safe-Zone accuracy prompt"

The math sheet has 'Looks right' / 'Something's off' buttons and the correction path ('Something's off' → Settings editor) — the UX exists. But neither button is instrumented (store.bump covers check/spendLogged/balanceUpdated/ritualDone/etc., nothing for looks-right/off), so the §14 trust success metric (≥80% 👍, <5% 'number felt wrong') cannot be measured. The plan said 'instrument from day one'.

### 🟠 Money Weather forecast sheet (7-day) — *partial*

**Source:** §5.2 screen 10: "the week ahead as weather; entered by tapping the sky or strip... 7-day forecast row; each day expandable... 'Fix Thursday'"

The ambient sky, weather chip, and 6 weather visuals (incl. rainbow) exist and are state-driven (WeatherSky, weather.ts) — that satisfies §14 item 4's ambient+strip+vocabulary scope. But there is no forecast sheet: tapping the sky does nothing, the runway strip opens Bills Shield (a reasonable substitution), and no per-day weather projection or 'fix Thursday' prevention plan exists. The 'weather forecast' half of the metaphor — weather about the FUTURE — is not experienceable.

### 🟠 Payday Ritual — cycle card + lighter-income handling; sweep is presentational — *partial*

**Source:** §5.2 screen 11: "Ends on a 'cycle card' (shareable, amounts hidden by default)"; danger row: "income lower than expected → ritual acknowledges first ('lighter than usual — let's make it work')"; §14 item 7: "ledger-allocation sweep"

The 5-beat ritual is built and skippable without comment (MeloRitual.tsx — celebrate, protect, savings, reveal, smart move with a real rule-table pickSmartMove). Missing: the shareable cycle card ending; the lighter-than-usual income acknowledgment; and the 'sweep' writes nothing — beats display existing setup numbers and completion just opens the balance editor, so no ledger allocation state changes (the blueprint said 'the decision is the value', but nothing is recorded as decided beyond lastRitualISO).

### 🟠 Mascot progression loop (earned items, milestones) — *dropped-silently*

**Source:** §7 loop 7: "Trigger: milestone/seasonal drop/earned unlock → studio session"; §3.5: "achievement items (earned only, never sold — the flex layer)"; §16.1 #16: "Earned items are unbuyable"

All 10 wardrobe items are free and available from minute one via a chip row in Settings (wardrobe.tsx, MeloSettings 'MELO'S WARDROBE — ALL FREE'). Nothing is earned, nothing unlocks, no milestone→cosmetic link exists (the engine has a milestone overlay but only buffer-500 as a win and no wardrobe consequence). The investment/progression loop — wardrobe as 'visible history of the user's money journey' — has no mechanism at all. §14 only promised '~10 wardrobe items (free)' so the count is met, but the loop the items were for is absent without a recorded call.

### 🟠 Settings trust infrastructure: data export + delete — *dropped-silently*

**Source:** §5.2 screen 25: "data & privacy (export everything, free, always — one tap; delete account with real deletion honestly described)"; copy: "Your data leaves with you whenever you want."

MeloSettings.tsx is setup-editing only (numbers, bills, wardrobe, quiet mode, 'I got paid'). No data export, no delete/reset, no privacy surface. Store is encrypted at rest (melo.tsx comment) which honors the privacy stance, but the exit-that-doesn't-punish trust promise has no implementation.

### ⚪ Monetization / store / Plus (§8) — *deferred-explicitly*

**Source:** §8.2 plans, §8.3 paywall moments, §5.2 screen 20 Premium Store; gated by §14: "store/monetization (nothing sold until the loop is proven)" and §15 Phase 4

CONFIRMED ~nothing built, and this matches the phase gating rather than a silent skip: blueprint §14 exclusion list, §15 Phase 4, and MELO_PHASE2_PLAN §2 ('Explicitly deferred... store/monetization') all record it. Notably the ETHICS plumbing shipped ahead of need: the engine state contract carries monetizationAllowed (visible in the dev chip as 'sell on/off'), so the suppressed-state rule (§8.1.3) has its enforcement hook before there is anything to sell. The honesty-check paywall, plans, and cosmetics catalog are all correctly absent.

### ⚪ Recovery extras: co-breathing invite + 'talk it through' (Ask Melo) — *partial*

**Source:** §5.2 screen 12 components: "co-breathing toggle; 'talk it through' (Ask Melo in support register)"; §0 PROMOTED #3 co-breathing storm mode

Recovery core is faithfully built (RecoveryWalkthrough.tsx: 3 steps, one decision per screen, days-counted-forward, honest 'entered' distinction, respected 'not today', no upsells). The mascot does slow-breathe in danger (breatheFor 10s loop) — co-regulation exists ambiently — but there is no explicit co-breathing invite/toggle, and 'talk it through' is impossible because Ask Melo (conversational layer) is absent entirely (phase plan marks the ai-gateway 'NOT MVP-critical' — a written deferral for the chat, not for the toggle).

### ⚪ Before You Spend — 'Safe on [date]' verdict + danger-date impact + example chips — *partial*

**Source:** §5.2 screen 13: "verdict card: Safe / Tight / Not now / Safe on [date], with the post-purchase Safe Zone, danger-date impact"; empty state: "three example chips ('£4 coffee,' '£60 trainers,' '£300 flight')"

Afford-check with Safe/Tight/Not-now verdicts, left-after amount, and the full 24-Hour Shelf with next-day re-verdict is built (a §0 promoted idea, faithfully delivered). Missing: the fourth verdict 'Safe on [date]' as computed output (affordNotNow copy says 'On [payday] it's a yes' — payday-only, not a computed date), danger-date delta on the verdict, the optional what/when field, and the teaching example chips. Amount-only number-pad input also means no BNPL-style queries.

### ⚪ Social/share loop — *dropped-silently*

**Source:** §7 loop 10: "milestone card / year-in-weather / a 'Melo said no to selling me Plus' screenshot → share (amounts hidden by default)"; §5.2 screens 11/22 shareable cards

No share affordance exists anywhere — no milestone card, no cycle card, no share sheet. Not on the §14 exclusion list (which names monthly review, seasonal, household etc.) so it fell between the cracks rather than being deferred. Zero-cost growth loop with nothing behind it.

### ⚪ Weekly review — delivery + weather recap — *partial*

**Source:** §5.2 screen 21: "week weather recap strip... Delivered as a Sunday-evening notification"; secondary CTA "'Just the numbers' (skips narrative)"

MeloReview.tsx is built and honest (engine-built headline, no green medal on an empty log, wins noticed, next week's bills). But it is pull-only — reachable via a home nudge card and a 'this week' link; the Sunday-evening notification cannot exist (notifications unwired), there is no weather recap of the week, and no 'just the numbers' variant. The Sunday Reset RETENTION loop therefore depends entirely on the user already being in the app.

### ⚪ Neglected→Return welcome-back flow — *partial*

**Source:** §4 NEGLECTED → RETURN: "(on return): 'Hey. No guilt — money kept moving, I kept notes. 60-second catch-up?'... catch-up card (what changed)"

The engine models it (Overlay 'neglectedReturn' computed from returnedAfterAbsence, COPY.return string exists and is linted) but no UI consumes it — there is no catch-up card or return treatment in MeloGlance. Engine-complete, surface-absent.

### ⚪ Savings goals / buffer tracker — *partial*

**Source:** §14 exclusion: "savings goals beyond a single buffer tracker" (i.e., a single buffer tracker WAS in scope); §5.2 screen 17: "Start the buffer — £2/day"

Goals are correctly deferred, but even the sanctioned 'single buffer tracker' is thinner than named: savings and buffer are just two editable numbers in Settings and rows in the math sheet. No tracker UI, no growth view, no rebuild tracker after Recovery (§4 REBUILDING specifies a 'buffer-rebuild tracker'). The rebuilding STATE exists in the engine; its tracker surface does not.

### ⚪ Overdraft-aware model ('my true floor') — *partial*

**Source:** §13 risk 10 mitigation: "user sets 'my true floor'; Safe Zone measures to the floor, danger date = floor breach"

Overdrawn balances are enterable (onboarding in-credit/overdrawn toggle, signed parse — a genuine risk-10 nod) but there is no arranged-overdraft floor setting; £0 is the implicit floor everywhere, so a user living inside a £1,500 arranged overdraft is permanently 'overspent'. Overdraft-fee-as-leak is correctly gated behind the deferred leaks engine.

### ⚪ Milestone ladder + tiny-win celebrations — *partial*

**Source:** §4 MILESTONE: "buffer thresholds (£100/£500/£1k)"; §5.2 screen 18: "celebration moments (≤2s, non-blocking)"; §14 item 11: "8 win types, ticker + weekly digest"

Exactly 8 win types built (wins.ts), ticker + review digest present — §14 scope met. But the milestone ladder is a single buffer-500 threshold (no £100/£250/£1k), and there are no mascot celebration moments at all — wins surface as a ticker line only. The 'variable-interval positive reinforcement' is text-only.

*Auditor notes:* Scope note: the build is Phase-2 manual-input MVP per MELO_BLUEPRINT §14 + MELO_PHASE2_PLAN, so bank connections, leaks, scenarios/Later, household, monthly review, store, extra characters, seasonal, and Watch are all correctly and EXPLICITLY deferred — none are listed as gaps above except monetization (included to confirm the requested check: ~nothing exists and that matches the written gating; the monetizationAllowed suppression flag even shipped ahead of need). What IS built is high-fidelity where it exists: the Glance Stack home, engine-driven state machine with hysteresis/fog/journey persistence, verbatim §10 copy with a real CI banned-list test, the Shelf with next-day re-verdict, honest Recovery, a skippable 5-beat ritual, statement import (CSV paste/file), demo mode, and reduce-motion/a11y care. The pattern in the gaps: engine-complete/surface-absent (notifications, neglected-return, BNPL, milestones) and spec-softening without decision records (Quiet Mode's meaning, weekend paydays, hardcoded essentials/buffer, the alive onboarding). The three things a founder should look at first: (1) Quiet Mode is not the feature the blueprint sold as the childish-objection killer; (2) the app cannot speak when closed — every notification-driven retention loop is currently theoretical; (3) the plan's own Phase-1 user-test gate has no recorded result. Files: build at C:\\dev\\folio-v2-greenfield\\.claude\\worktrees\\melo-mvp\\apps\\mobile\\src\\melo\\ + packages\\melo-engine\\; blueprint at C:\\dev\\folio-v2-greenfield\\MELO_BLUEPRINT.md; plan at C:\\dev\\folio-v2-greenfield\\.claude\\worktrees\\melo-mvp\\MELO_PHASE2_PLAN.md.

## Correction to one finding

The "Phase-1 user-validation gate skipped" finding is NOT a silent drop: the owner explicitly skipped the test-kit gate on 2026-07-02 ("no time, get it done") — an owner decision on record, carried here for completeness.

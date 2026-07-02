# MELO — Phase 2 Build Plan (manual-input MVP)

2026-07-02 · Follows `C:\dev\folio-v2-greenfield\MELO_BLUEPRINT.md` §14–§15.
Status: Phase 1 design settled — **Version A (blueprint-led "Warm Paper") chosen** over the Lovable-led B in a side-by-side (Lovable project `melo-phase1-prototype`, A at `/`, B parked at `/b`). Phase-1 user validation is the remaining gate: run `prototypes\melo-phase1\MELO_USER_TEST_KIT.md` first.

**The bet Phase 2 tests:** people will check a mascot-carried Safe Zone before spending, and return daily because of how it feels. Everything below serves that; anything that doesn't, waits.

---

## 1. Reuse map (what already exists in this repo)

| MVP need (§14) | Existing asset | Gap |
|---|---|---|
| Bills / recurrence / danger-date math | recurrence engine (packages, 300+ tests) | wire to Safe Zone formula; hysteresis bands are new |
| Statement import (accuracy path, no open banking) | statement reader (Folio's chosen wedge) | map output → balance + recurring-bill candidates |
| Local-first persistence + privacy stance | E2EE store | new melo state slices only |
| Ask-Melo conversational layer (post-MVP) | services/ai-gateway (CF Worker) | NOT MVP-critical; deploy status per MELO_AI_SETUP.md |
| Theming (Warm Paper + Night Ledger later) | kitTheme/useTheme makeStyles pattern + dark mode | add Warm Paper token set |
| Test/verify toolchain | vitest/tsc/prettier direct binaries (pnpm gate workaround), emulator-5554 loop | none |
| Design reference | Lovable Version A + local `prototypes/melo-phase1/index.html` | port 1:1, RN-native |

## 2. Genuinely new (the actual Phase-2 work)

1. **`packages/melo-engine`** — pure TS, test-first: Safe Zone formula (balance − shielded bills − essentials − savings − BNPL − buffer, round DOWN), per-day math, danger-date projection, and the §4 state machine (health ladder + overlays + fog + hysteresis + `monetization_allowed` flag). ~3 days incl. tests. **The number must be right before any UI exists.**
2. **Mascot rig (RN)** — port the 6-emotion SVG rig via react-native-svg for MVP (Rive upgrade is Phase 4); colorways as props; breathing/idle via Reanimated with reduced-motion respect.
3. **Weather layer** — state-driven sky gradients + forecast strip; motion REDUCES in bad states (the §4 calm-down law, enforced in the component).
4. **Surfaces** — onboarding (6 beats + reveal), Home Glance Stack, math sheet, afford-check + Shelf, payday ritual v1 (manual trigger, ledger-allocation sweep), Recovery mode v1, weekly review v1, tiny wins v1 (8 types).
5. **Notifications v1** — payday, danger-entry, danger-date-delta, bill-landed-covered, weekly; ≤1/day budget enforced in the dispatcher; quiet hours default.
6. **Copy system as code** — state-keyed strings from the blueprint + the banned-list lint as a unit test (the §10 list is a CI test, not a guideline).
7. **One widget** (small: mascot + number + tint) — end of scope, only if the 30 days allow; otherwise first item of Phase 2.5.

Explicitly deferred (per §14): bank connections, leaks engine, scenarios/Later tab, household, store/monetization, extra characters, monthly review, seasonal, Watch.

## 3. Isolation & sequencing (the honest flag)

- **Branch:** `claude/melo-mvp` — new surface at `apps/mobile/src/melo/` following the repo's surface pattern. Engines consumed as dependencies, never edited on this branch.
- **Zero contact** with `claude/folio-rn-faithful-port` and the shipping `apps/mobile/src/folio/` surface — no shared file edits, no conflicts by construction.
- **The owner's call, stated plainly:** the faithful-port program is the active mandated track for Folio-the-product. Melo MVP can be built in parallel without touching it, but *owner attention* (device testing, dogfooding, direction) is the scarce resource — running both dilutes both. Recommended sequence: run the Phase-1 test kit (days 1–3, no code), and green-light Melo Phase 2 only on a passed gate; if the gate passes, decide then whether Melo MVP replaces or queues behind the port work. This plan makes either order cheap.

## 4. 30-day scope with gates

| Days | Work | Gate (owner-visible) |
|---|---|---|
| 1–3 | Run the user test kit (no code) | Phase-1 gates pass → proceed / fail → fix prototype, retest |
| 4–8 | melo-engine package: formula + state machine + hysteresis, full test suite | engine demo: given inputs → number + state + danger date, 100% deterministic, tests green |
| 9–14 | Mascot rig + weather layer + Home Glance Stack on device | **Gate 1:** the glance works on the emulator — state chip cycles all six states natively |
| 15–20 | Onboarding + reveal + afford-check + Shelf + math sheet | **Gate 2:** cold install → Safe Zone reveal < 3 min on device; reveal number auditable via math sheet |
| 21–26 | Payday ritual v1 + Recovery v1 + tiny wins + notifications v1 | **Gate 3:** full cycle simulated on device (payday → spend → warning → storm → recovery → rebuild) |
| 27–30 | Statement import wiring + weekly review + polish + owner dogfood script | APK to owner; dogfood per script; §14 success metrics instrumented |

## 5. Success metrics (instrument from day one, §14)

Activation ≥70% reach reveal <3min · afford-checks ≥3/user/week (the north star) · D1 ≥45 / D7 ≥30 / D30 ≥15 · ritual completion ≥40% of payday-actives · Safe-Zone accuracy 👍 ≥80% · widget adoption ≥25% of D7 (when widget ships) · exit-interview brand words = calm/honest/mine, never cute/game.

## 6. Kill criteria (agreed before we start)

- Phase-1 gate fails twice → the reveal/mascot concept needs rework, not more engineering.
- Engine can't hit deterministic correctness on the §14 edge cases (weekend paydays, BNPL schedules, negative Safe Zone) → stop UI work until it does; a wrong number kills this product faster than no product.

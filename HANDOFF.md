# Folio — Handoff

_Last updated after the web→RN parity build + Melo AI gateway._

**Updated 2026-06-30 (evening) — commits `eb6e0a0` / `3783c9c` / `a3f81c9`** (branch
`claude/folio-rn-faithful-port`; `7147884` updated `AUDIT.md`). Sample/placeholder data purged so a
cleared/real app shows only the user's own data (demo data is now gated behind the demo regime),
Melo mood wired to the real route, plus dark-mode / scroll / start-fresh / import-date / AI-cost
fixes. 0 typecheck errors · 306 folio tests green · visible fixes screenshot-verified on-device.
See the "Updated 2026-06-30 (evening)" section below for the per-item register.

## The two halves (keep them straight)

- **`folio-v2-greenfield`** (this repo · GitHub **`Thegamerdr/Folio`**) — the **real React Native product** (Expo SDK 56, pnpm monorepo). This is what ships.
- **`folio-melo`** (GitHub **`Thegamerdr/private-money-pilot`**) — the **Lovable design / co-work bridge**. You design here in Lovable; it is **not** shipped and the app must **not** depend on it at runtime.

## Current state — branch `claude/folio-web-parity` (pushed to Thegamerdr/Folio)

Commits: `318d3be` parity → `4c0d980` green tests → `e52de55` privacy fix → `aef82f0` /improve backlog → `2fca4d5` Melo gateway.

- **Full parity with the current Lovable web design.** Foundations (kit tokens, tabs **Today/Review/Melo/More**, shared `Sheet` primitive, three new engines **Pots / Subscriptions / Cycles** via the canonical spine), 8 faithfully-ported screens, the **Today rich-home** rebuild (nudges, spend strip, recent txns, draggable money path), 4 new surfaces (**Pots / Subscriptions / Insights / Payday Ritual**), **Melo chat** + **Onboarding** sheets.
- **Verified:** typecheck clean · 441 tests green · release APK builds + **runs on `emulator-5554`** (real on-device, faithful — Start/Onboarding/keypad screencapped).
- **Melo AI** = the standalone **`services/ai-gateway`** Cloudflare Worker (OpenRouter → Gemini, key held as a Worker secret). **No Lovable dependency.**
- **Audit:** `/improve` ran; the one real issue (false "stays on this device" Melo copy + default-on share) is **fixed**. Remaining follow-ups (none critical) are in `plans/README.md`.

## On you (owner-gated)

1. **Deploy the Melo gateway** — `MELO_AI_SETUP.md`: get an OpenRouter key (+ set a spend cap), `wrangler secret put OPENROUTER_API_KEY`, `wrangler deploy`, then set the RN app's `EXPO_PUBLIC_MELO_GATEWAY_URL` + `EXPO_PUBLIC_MELO_GATEWAY_TOKEN` and rebuild. **Run a clean `pnpm install` first** (settles the new `@folio/ai-gateway` package — the lockfile was left untouched after a flaky install). _(2026-06-30: the gateway now enforces a model allow-list and the app splits AI cost — cheap `gemini-2.5-flash-lite` for chat, `gemini-2.5-flash` for vision/extraction — so this `wrangler deploy` + the OpenRouter spend cap are what carry the cost split live.)_
2. **Repo housekeeping** — `Thegamerdr/Folio` just got its first push (default branch `master`). The work is on `claude/folio-web-parity`; open a PR / merge when ready. No CI is set up yet.
3. **Keep designing in Lovable** — the project knowledge is now pinned (mobile-first, reuse the tokens, honest copy, banned vocab, design-not-backend). When you've changed screens, tell me.

## The co-work loop (design → ship)

You design in **Lovable** → it lands in **`private-money-pilot`** → I diff it against this RN app → **port the deltas** (screens, copy, layout) → rebuild + verify on the emulator → commit. The engines, tabs, Sheet primitive, and kit are all in place, so **restyles port in minutes**; a brand-new surface with a **new kind of data** needs a new RN engine (bigger — we scope those).

## Key paths

| What                                 | Where                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design kit (tokens, primitives, nav) | `apps/mobile/src/surfaces/pressureMap/kit.tsx`                                                                                                                      |
| Screens + sheets                     | `apps/mobile/src/surfaces/pressureMap/*.tsx`, `.../sheets/`                                                                                                         |
| Engines (pots/subs/cycles/ledger)    | `apps/mobile/src/local/*Adapter.ts`, `localLedger.ts`, `canonicalLedgerMutations.ts`, `packages/domain/src/index.ts`                                                |
| Container + tab model                | `apps/mobile/app/index.tsx`, kit `NAV_TABS`                                                                                                                         |
| Melo AI client → gateway             | `apps/mobile/src/local/meloAiClient.ts` → `services/ai-gateway/`                                                                                                    |
| Build the APK                        | env `JAVA_HOME`=Android Studio `jbr`, `ANDROID_HOME`=`%LOCALAPPDATA%\Android\Sdk`; `gradlew :app:assembleRelease` → `app/build/outputs/apk/release/app-release.apk` |
| Audit backlog                        | `plans/README.md` · Melo setup: `MELO_AI_SETUP.md`                                                                                                                  |

## /improve backlog (do when you want — none block shipping)

`01` dedupe `useCountUp` + honor reduced-motion on Pots · `02` reallocation sheet primes state in render · `03` buffer-pot detection by name regex → pass a flag from the model · `04` Insights chart is invisible to screen readers · `05–08` Melo chat hardening (message length cap, request timeout, response schema, unit tests). Expand any with `/improve plan <#>`.

## Updated 2026-06-30 (evening) — commits `eb6e0a0` / `3783c9c` / `a3f81c9`

Branch `claude/folio-rn-faithful-port` (`7147884` = `AUDIT.md`). **0 typecheck errors · 306 folio tests green · visible fixes screenshot-verified on `emulator-5554`.** This pass made the app honest about fabricated data and wired the pieces that were previously inert. The principle: **nothing fabricated is present 24/7** — a cleared/real app shows only the user's data, and demo/illustrative data is gated behind the demo regime (`currentBalance.source === 'sample'`).

- **RESOLVED — sample/placeholder data purge** (`eb6e0a0`, `3783c9c`, `a3f81c9`). Where the app previously **showed fabricated data on a cold/cleared open**, it now plots real route data or shows an honest empty doorway:
  - Today money-path **chart** was hardcoded SVG geometry ("salary rise +£2,180 / bill drop −£875 / 7 Jul") → now plotted from the real `route.points` daily series.
  - Today summary trio ("Coming in £2,180 / Going out £1,095") → real route totals (`RouteResult.incomingTotal` / `outgoingTotal`). `TodayWeekTiles` "7 Jul · £X" low-point tile → real route tight point.
  - Calendar agenda hardcoded "Check Klarna · 2 of 3" review + generic UK tax deadlines (Self Assessment / Payment on account), and `RECURRING_BILLS` (Octopus / Council Tax / Rent / BT) → all **gated behind the demo regime** via `deriveCalendarEvents`'s `includeSampleBills` param.
  - Reader screens (Visualizer / Review / Paste / Image), `SubCaughtSheet`, and the edit sheets fell back to sample rows / a fake "Tesco · £42 · 26 Jun" on cold open → now honest empty doorways / blank forms. `RouteDetailSheet` Octopus/Rent placeholder → empty point. Chart "breathing room · £100" → "breathing room".
- **RESOLVED — Melo mood is now wired** (`eb6e0a0`). Was a no-op. App-wide pressure is now **derived from the real route** via `derivePressure()`, gated on a real money picture so an empty/cleared app stays neutral calm; the Melo mood picker sets a global override via the new `nav.setPressure` that propagates to Today / What-if / Melo / chat.
- **RESOLVED — dark-mode invisible headline** (`eb6e0a0`). `TimelineScreen` headline + subhead had **no color** → defaulted to black → invisible on the dark canvas (light mode read fine). Bound to theme `ink` / `muted`. (A token-contrast audit can't catch a _missing_ color — only looking does.)
- **RESOLVED — content trapped below the fold** (`eb6e0a0`). Privacy / Subscriptions / PaydayRitual / Check-in / Start were fixed-height → wrapped in `ScrollView`. Privacy's "Clear to empty" was unreachable below the fold and is now scrollable.
- **RESOLVED — "Start fresh" reseeded the demo** (`eb6e0a0`). More → "Start fresh" called `resetAll` (reseeded the demo — "it all came back") → now `resetToEmpty` + a one-tap confirm.
- **RESOLVED — imported transactions stamped "today"** (`eb6e0a0`). Imported transactions now keep their **real statement date** (D2/expectation hygiene).
- **AI cost split** (`eb6e0a0`). Chat pins cheap `gemini-2.5-flash-lite`; vision (`gemini-2.5-flash`) is reserved for PDF/photo extraction; the gateway model allow-list rejects costlier models. **Owner-gated to take effect:** `wrangler deploy` + an OpenRouter spend cap (see "On you" #1 and `MELO_AI_SETUP.md`).

### Still open after this pass (owner / QA — not RN bugs)

- Exhaustive per-screen **dark-mode + cross-device visual pass** on an emulator (this pass fixed the one _invisible_ case + verified visible fixes; a full sweep is still owner/QA work).
- **iOS** — needs a Mac / EAS; unbuildable on the Windows dev box.
- The **gateway redeploy + OpenRouter spend cap** (carries the AI cost split live).

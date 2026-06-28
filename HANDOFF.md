# Folio — Handoff

_Last updated after the web→RN parity build + Melo AI gateway._

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
1. **Deploy the Melo gateway** — `MELO_AI_SETUP.md`: get an OpenRouter key (+ set a spend cap), `wrangler secret put OPENROUTER_API_KEY`, `wrangler deploy`, then set the RN app's `EXPO_PUBLIC_MELO_GATEWAY_URL` + `EXPO_PUBLIC_MELO_GATEWAY_TOKEN` and rebuild. **Run a clean `pnpm install` first** (settles the new `@folio/ai-gateway` package — the lockfile was left untouched after a flaky install).
2. **Repo housekeeping** — `Thegamerdr/Folio` just got its first push (default branch `master`). The work is on `claude/folio-web-parity`; open a PR / merge when ready. No CI is set up yet.
3. **Keep designing in Lovable** — the project knowledge is now pinned (mobile-first, reuse the tokens, honest copy, banned vocab, design-not-backend). When you've changed screens, tell me.

## The co-work loop (design → ship)
You design in **Lovable** → it lands in **`private-money-pilot`** → I diff it against this RN app → **port the deltas** (screens, copy, layout) → rebuild + verify on the emulator → commit. The engines, tabs, Sheet primitive, and kit are all in place, so **restyles port in minutes**; a brand-new surface with a **new kind of data** needs a new RN engine (bigger — we scope those).

## Key paths
| What | Where |
|---|---|
| Design kit (tokens, primitives, nav) | `apps/mobile/src/surfaces/pressureMap/kit.tsx` |
| Screens + sheets | `apps/mobile/src/surfaces/pressureMap/*.tsx`, `.../sheets/` |
| Engines (pots/subs/cycles/ledger) | `apps/mobile/src/local/*Adapter.ts`, `localLedger.ts`, `canonicalLedgerMutations.ts`, `packages/domain/src/index.ts` |
| Container + tab model | `apps/mobile/app/index.tsx`, kit `NAV_TABS` |
| Melo AI client → gateway | `apps/mobile/src/local/meloAiClient.ts` → `services/ai-gateway/` |
| Build the APK | env `JAVA_HOME`=Android Studio `jbr`, `ANDROID_HOME`=`%LOCALAPPDATA%\Android\Sdk`; `gradlew :app:assembleRelease` → `app/build/outputs/apk/release/app-release.apk` |
| Audit backlog | `plans/README.md` · Melo setup: `MELO_AI_SETUP.md` |

## /improve backlog (do when you want — none block shipping)
`01` dedupe `useCountUp` + honor reduced-motion on Pots · `02` reallocation sheet primes state in render · `03` buffer-pot detection by name regex → pass a flag from the model · `04` Insights chart is invisible to screen readers · `05–08` Melo chat hardening (message length cap, request timeout, response schema, unit tests). Expand any with `/improve plan <#>`.

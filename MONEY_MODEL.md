# MONEY MODEL — free / Plus / Pro, cost math, and the decisions behind them

## 2026-07-15 privacy and cost correction

Raw statements, statement images, typed companion prompts and financial snapshots no longer go to
an AI provider. Statement/photo extraction and Melo's financial reasoning run on-device. The old
AI-read allowance and its per-read cost assumptions below are retained as decision history, not as
the current product model.

`Live` now exists only for recurring infrastructure: optional Open Banking refresh and encrypted
backup/multi-device sync. `Full` remains the one-time local-software purchase. The displayed Live
price is a launch hypothesis until TrueLayer commercial terms, store fees, support cost and unit
economics are signed off; provider procurement must not be hidden behind a prototype price.

_Decision doc, 2026-07-06. Companion to ACCOUNTS_MODEL.md + the modes/goals/tone doctrine.
Owner asked: free users cost us money (AI reads the PDFs) — what's Plus/Pro, why would anyone pay,
and how do we make money without betraying the product. This is the plan + the open decisions._

---

## 0. The unusual problem (why normal SaaS pricing doesn't apply)

Most apps have ~zero marginal cost per free user. **We don't** — every statement read hits an AI
gateway, and Melo chat does too. So our free tier has a **per-use variable cost**. A viral free
user who re-uploads their full history every month is a pure loss. The whole model has to make the
free tier cheap-to-serve _and_ valuable enough to retain + convert — while honouring two hard lines:

- **DOCTRINE: safety is free forever** (safe zone, danger date, recovery, no-shame). Never paywalled.
- **ETHICS: no data-selling, no ads, no lead-gen to lenders** (the last is also _credit broking_ =
  regulated, and it torches the "space to think / never push products" soul). This deliberately
  rules out the revenue models most free finance apps use — see §6.

The resolution, in one line: **the thing that costs us money (AI generosity) IS the paid product.**
Free stays cheap because free doesn't get the expensive AI. That aligns cost with revenue perfectly.

---

## 1. Real cost math (measured this session, not guessed)

Reader = Gemini 2.5 Flash via the OpenRouter gateway (services/ai-gateway).

| Action                                         | Tokens (measured)                | Cost (measured/estimated)             |
| ---------------------------------------------- | -------------------------------- | ------------------------------------- |
| One-month statement (1 page, 14 rows)          | 2,424 total (1,563 in / 861 out) | **$0.0026** (measured)                |
| Full multi-year history (133 pages, 17 chunks) | ~4.3k/chunk × 17                 | **~$0.05–0.08** (est. from per-chunk) |
| Melo chat message (with snapshot)              | ~1–3k/exchange                   | **~$0.001–0.003** (est.)              |

**Free-user monthly AI cost, scenarios:**

- Light (1 monthly statement + a few chats): **~$0.01–0.02/mo**.
- Heavy (re-uploads full history + heavy chat): **~$0.10–0.50/mo**.
- The tail risk: repeated **full-history re-reads**. Transaction dedup (shipped) stops double-counting,
  but re-uploading the same PDF still re-pays the AI. **Fix: cache reads by file-hash — never read the
  same file twice** (§4). This alone caps the worst case.

At 100k free users, light-avg $0.015/mo ≈ **$1.5k/mo AI** — bounded and fine _if_ the read-cache +
free caps below hold, ungoverned it's a spike risk.

**Break-even sketch:** Plus at £4.99/mo (~$6.30) covers ~300+ light free users of AI cost on its own.
So conversion of even **1–2%** free→Plus makes the AI economics comfortably positive. The AI cost is
NOT the threat to the business; **retention + conversion** are (finance apps churn hard — see §5).

---

## 2. The tiers, line by line

### FREE — "know you're safe, and see the one thing you couldn't"

The mission tier. Must retain on its own + deliver the "oh, how did it know that" moment.

- Safe Zone number, danger date, money weather, Recovery Mode — **forever free** (doctrine).
- **One account.**
- **On-device OCR for the cheap path** + a small **AI-read allowance** (e.g. 2–3 statement reads/mo)
  so the "oh" moment is reachable free, without unbounded AI cost.
- Manual entry, paste, CSV — unlimited (near-zero cost).
- Basic Melo chat (rate-limited).
- **Basic debt visibility + the debt-free DATE** (see §3 decision — recommended free: it's
  safety-adjacent and our best acquisition story).
- The free modes (see §3 decision — recommended: enough to fit most mental models, not just 2).

### PLUS (£4.99/mo · £39.99/yr) — "the full intelligence, all your money"

The AI generosity + the compounding depth = the thing that costs us = the thing you pay for.

- **Unlimited AI statement reads** (this is the headline value AND the cost we're recovering).
- **Multi-account + credit cards + net position** (the accounts model).
- The full **leaks/insights engine** — the proactive "you always overspend the week after payday",
  overdraft-fee totals, the revelations.
- **Goals + the debt-payoff planner** (scenarios, snowball/avalanche timelines, "what if" — all
  show-don't-recommend, §legal).
- Irregular / household / the paid modes.
- Payday automation, deep reviews, saved scenarios, BNPL overlays.
- **The cosmetic catalogue** (Melo wardrobe/scenes — a genuine, ethical, non-financial revenue line).

### PRO (£8.99/mo · £69.99/yr) — "everything, forever, first"

For power users / the most committed. (Thin today; grows with open banking.)

- Everything in Plus, plus: **live open-banking sync** (when built — this is the daily-habit unlock
  AND it removes the per-statement AI cost, so Pro users are _cheaper_ to serve than heavy free users).
- Unlimited accounts, longer history retention (raise the 2,000-txn cap for Pro).
- Priority/richer Melo (better model, longer memory), export everything, household for the whole house.

**Trial:** one-cycle, no auto-renew (doctrine). **Never sell during danger/storm/recovery/fog**
(doctrine — the paywall literally runs your safe zone and tells you _not_ to subscribe this week if
you can't afford it). One subscription covers a household.

---

## 2b. PRICING STRUCTURE — one-time + metered (RECOMMENDED, owner-steered 2026-07-06)

Owner's instinct: a one-time "buy the app" fee, keep free meaningful, paywall some features. The
principle that makes it safe: **separate zero-marginal-cost software (ownable, one-time) from
per-use cost (AI reads, live sync — must stay metered/recurring because the COST recurs).** A pure
one-time fee with unlimited AI is an unbounded-cost trap; this split avoids it while giving the
"own it forever" feeling.

Three ways to hold the app:

- **FREE** — safety + fit-free modes + debt-free date + a small monthly allowance of the SAME
  ACCURATE AI reader paid users get (capped by QUANTITY, never degraded in QUALITY). On-device OCR
  is only ever an OPTIONAL OFFLINE fallback, never the thing that produces numbers people trust.
  **ACCURACY IS NEVER THE FREE/PAID LINE — QUANTITY IS.** (Owner, 2026-07-06: a free tier that gives
  wrong numbers is worse than no free tier; the mission demands free be correct.) A few accurate
  reads/mo costs cents, so cost was never a reason to degrade free.
- **FULL — one-time (~£29.99, "yours forever")** — unlocks ALL software features (multi-account,
  full leaks/insights engine, goals + payoff-planner depth, every mode, cosmetics). Zero marginal
  cost, so safe to sell once. AI reading = on-device OCR + a fair monthly allowance (e.g. 10/mo) so
  an owner is never an unbounded AI liability.
- **LIVE — optional light sub (~£2.99/mo) or consumable credit packs** — unlimited AI statement
  reads + open-banking live sync. The ONLY genuinely-recurring-cost features, so the ONLY recurring
  price. Most users never need it; power/daily users pay it happily. Open-banking aggregators charge
  per-active-connection/mo (see OPEN_BANKING_PLAN.md), so live sync is inherently recurring-cost →
  correctly a sub, not a one-time unlock.
- **Optional all-in-one:** a single recurring "Plus" (= Full + Live bundled) for people who prefer
  one sub over a one-time + add-on. Offer both doors; don't force the choice.

Why it works: **recurring price attaches ONLY to recurring cost.** Sub-haters buy Full and own it.
Free stays honest (split by cost, not crippled). The one unbounded cost (unlimited AI) sits behind
the one light recurring gate. Billing: expo-iap already supports non-consumable (Full), subscription
(Live/Plus), and consumables (credit packs) — no new plumbing.

Supersedes the flat Plus/Pro-only framing in §2 (kept there for the feature-allocation detail —
map those Plus features onto FULL, and the unlimited-AI/live items onto LIVE).

## 3. The two hard decisions (my recommendation, your call)

### Decision A — Where does debt help sit, free or paid?

The trap: the people who most need "get out of debt" are often the ones who can least afford Plus.
Paywalling it from someone drowning is morally ugly _and_ kills word-of-mouth.

- **RECOMMEND: basic debt visibility + the debt-free date are FREE** (see your total owed, watch the
  date move closer). It's safety-adjacent, it's the most motivating object in the app, and it's the
  single best acquisition/mission story you have. **The planner DEPTH is Plus** — multi-card
  optimization, scenarios, automation, "what if I put £X extra." Free = _see the way out_; Plus =
  _tools to walk it faster_. This keeps the mission honest and still gives a real reason to upgrade.
- Alternative: all debt features free (maximal mission, weaker conversion), or all paid (best
  conversion, worst ethics/word-of-mouth — not recommended).

### Decision B — Which modes are free? (audit the mental-model coverage)

Current lens config: FREE = survival + stability; the other 8 are paid. **Risk:** if a user's
_mental model_ only fits a paid mode (a debt person needs Debt mode, an irregular earner needs
Irregular mode), you're paywalling the very fit that makes the app work for them — and those are
often lower-income, exactly the people the mission is for. A free tier of only Survival+Stability may
quietly exclude your core audience on day one.

- **RECOMMEND: make the fit free, sell the depth.** Free should include enough modes to fit most
  people's mental model (at minimum: survival, stability, **debt**, **irregular** — the "I'm
  struggling / my income is lumpy / I want out of debt" realities). Plus sells the _power_ within a
  mode (deeper insights, automation, scenarios, optimizer/planning modes for people optimizing — who
  can afford to pay). "You can always find your mode for free; you pay for Melo to do more inside it."
- This needs a real audit: list the 10 modes, the mental model each serves, the likely income band,
  and set the free/paid line by _"can the person this mode is for afford Plus"_, not by feature count.

---

## 4. Cost-control levers (make free cheap-to-serve)

1. **Read-cache by file hash** — never send the same PDF to the AI twice. Kills the re-upload tail risk.
2. **On-device OCR as the free cheap path**; AI reading is the Plus premium. (Native module was a
   documented gap — this gives it a business purpose.)
3. **Free AI-read cap** (e.g. 2–3/mo) with a calm "you've used your free reads — Plus is unlimited".
4. **PII redaction before the file leaves the device** (strip name/address/account number — the model
   only needs date/merchant/amount). Cuts token cost slightly AND is the biggest privacy win (§legal).
5. **Cheaper/smaller model for pure extraction**; reserve the better model for chat/insight.
6. **Open banking (Pro)** replaces per-statement reads with structured feeds — Pro users become the
   _cheapest_ to serve, inverting the usual "power users cost most."

---

## 5. Retention & conversion (the actual threat, not AI cost)

- Finance apps die at retention (people leave, go back to spreadsheets — the research). AI cost is a
  rounding error next to churn.
- **The "oh" moment in week one is the whole game** (the revelation insight). Free MUST deliver it.
- Statement-only is a _monthly check-in_ product; **open banking is what makes it daily** and is the
  real Pro/retention unlock. Be clear-eyed: daily habit ≈ waits on open banking.
- Conversion model: even 1–2% free→Plus covers AI cost many times over; the real target is retention
  → the natural upgrade moments (hit the account limit, want unlimited reads, want the payoff planner).

## 6. Revenue reality (given the ethics)

Because no ads / no data-selling / no lead-gen-to-lenders, the honest revenue lines are narrow:

1. **Subscription (Plus/Pro)** — the core.
2. **Cosmetics** (Melo wardrobe/scenes/packs) — genuinely ethical, non-financial, already designed;
   monetizes engagement without touching the money data or pushing products.
3. **B2B2C (later)** — offered _through_ employers / unions / debt charities as a financial-wellbeing
   benefit. Mission-aligned, no consumer-facing sell, potentially the biggest line — but a later,
   sales-led motion.
   Affiliate/referral to financial products is **ruled out** (regulated credit broking + betrays the soul).
   Name this honestly: with these ethics, **subscription + cosmetics is the model**, and it works _iff_
   free-tier cost is capped (§4) and retention is real (§5).

## 7. Open questions for the owner

1. Decision A (debt help free/paid) — CONFIRMED 2026-07-06: free visibility + debt-free date; paid depth.
2. Decision B (which modes free) — CONFIRMED: fit-free/depth-paid. Still needs the mode-by-mode audit
   (which specific modes land free vs Full) — a build-time task, not a blocker.
3. Structure — CONFIRMED direction: Free / Full (one-time) / Live (metered). Remaining numbers:
   - FULL one-time price (~£29.99? higher/lower?).
   - Free monthly AI-read allowance (2? 3? 5?) — acquisition vs cost.
   - LIVE = light sub (~£2.99/mo) vs credit packs vs both.
   - Keep an all-in-one recurring "Plus" (=Full+Live) door too, or one-time+add-on only?
4. On-device OCR: build it as the free/owner cheap path (recommended — gives the unbuilt native OCR a
   business purpose + caps AI cost), or rely on the AI-read allowance alone?
5. B2B2C (employers/unions/charities) — roadmap or explicitly parked?

## 8. Status

- Written 2026-07-06 from measured session costs + the doctrine. No code. Feeds the goals/paywall
  phases (P5/P6 in ACCOUNTS_MODEL.md) and the existing lensPaywall.ts.
- **IMPLEMENTED 2026-07-10** (commits `2f25918` + `b2418f4`, branch claude/melo-mvp) — §2b is now
  the app's real shape:
  - Tier engine: `lib/lens.ts` LensTier free|full (6 fit-free lenses: Survival, Stability, Debt,
    Irregular, Reset, Low-vis; 4 Full: Growth, Optimizer, Planning, Household — the §7.2
    mode-by-mode call, made as a build decision, revisable). Legacy plus/pro flags = grandfather
    into Full, no migration.
  - Billing seam: `folio.full` one-time non-consumable + `folio.live.monthly/yearly` subs; legacy
    SKUs restore→Full. Entitlement record knows full|live (+legacy read).
  - Paywall: three doors — Full £29.99 one-time, Live £2.99/mo / £24.99/yr (PROTOTYPE numbers,
    §7.3 sign-off pending), Live-only cadence toggle, suppressed-state guard kept, one-cycle Full
    trial kept (never grants Live).
  - AI-read allowance (client-side v1): Free 3/mo · Full 10/mo · Live unlimited
    (`lib/billing/readAllowance.ts` + IntakeScreen gate). Only candidate-yielding reads count;
    repeat files served from an on-device content-hash cache for free; lens trial doesn't raise
    the allowance. Server-side metering at the gateway = the hardening step with accounts.
  - Open per §7: exact numbers (Full price, Free allowance 2-5, Live sub vs packs), bundle door,
    on-device OCR path, B2B2C.

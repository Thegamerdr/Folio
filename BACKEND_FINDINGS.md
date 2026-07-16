# Backend / Completeness Findings — Lovable prototype (`folio-melo`, `design-main`)

Source inspected: `C:\dev\folio-melo\.claude\worktrees\design-main` — `src/components/folio/screens/ScreenAccount.tsx`,
`ScreenPlans.tsx`, `ScreenPaywall.tsx`, `ScreenPrivacy.tsx`; `OPEN_BANKING_DEDUPE_RESEARCH.md`;
`SUBSCRIPTION_SIGNAL_RESEARCH.md`; `docs/PRICING.md`; full `src/` grep for supabase / auth / fetch(
/ api/ / stripe / plaid / truelayer / revolut / openbanking / payment.

## 1. What the app actually calls server-side

Only **one** real network touchpoint fires from the UI: **Melo chat**.

- `src/components/melo/MeloChat.tsx` posts to `POST /api/melo-chat` (`DefaultChatTransport({ api: "/api/melo-chat" })`).
- `src/routes/api/melo-chat.ts` is a TanStack Start server route. It reads `process.env.LOVABLE_API_KEY`,
  builds a Lovable AI Gateway provider (`src/lib/ai-gateway.server.ts`, `baseURL:
https://ai.gateway.lovable.dev/v1`, model `google/gemini-3-flash-preview`), and streams a response
  via the Vercel AI SDK (`streamText`). It also exposes four "transaction-logging tools"
  (`log_spend`, `log_income`, `log_refund`, `log_transfer`, `log_invoice`) — but each tool's `execute`
  is a **stub that only returns a confirmation string**; nothing is written to any ledger or DB. Real
  logging happens client-side in the RN app's own store, not through this endpoint.
- No statement-reader network call exists in this codebase — OCR/PDF/CSV parsing referenced in
  `ScreenAccount.tsx` ("Statements & receipts … PDF · image · paste · CSV") routes to `nav.go("intake")`,
  a client-side screen; no fetch/upload call was found for it in this grep.
- **Supabase** (`src/integrations/supabase/{client.ts,client.server.ts,auth-middleware.ts,auth-attacher.ts}`)
  is present as **infrastructure scaffolding only** — a generated client + a TanStack Start middleware
  that attaches a bearer token from `supabase.auth.getSession()` to server-fn calls. Grep found **no
  UI call site** invoking `signIn`, `signUp`, `signInWithOAuth`, `signInWithPassword`, or any
  `supabase.from(...)` query anywhere in `src`. It is wired into the request pipeline (`src/start.ts`
  registers `attachSupabaseAuth`) but nothing in the four target screens, or any screen, exercises it.
  Conclusion: Supabase is a Lovable-platform default that ships unused, not a working auth backend.
- No `stripe`, `plaid`, `truelayer`, `revolut`, or `openbanking` hits anywhere in `src` (the one
  "openbanking" grep hit is a code comment in `ScreenPaydayRitual.tsx`, not a call).
- "payment" hits are all copy strings / domain-model fields (bill/payment labels in modes, ledger,
  sheets) — no payment-processor code.

**Summary:** the only live server dependency is `ai-gateway` chat (Lovable AI Gateway + Gemini,
key server-side via `LOVABLE_API_KEY`). Everything else — statements, subs tracking, pots, plans,
paywall — runs on the local Zustand store (`src/lib/store.ts`), no round trip.

## 2. Account screen — identity/data presented

`ScreenAccount.tsx` presents a **local profile, not real auth**:

- Tier (`free`/`plus`/`pro`/`trial`) is derived purely from local store flags
  (`lens.plusUnlocked`, `lens.proUnlocked`, `lens.trialCycleId`) — no server entitlement check.
- "Sources" list: Statements & receipts (local, state = manual/empty depending on local counts),
  Bank connection (hardcoded `state: "empty"`, tapping shows a toast: _"Bank link ships with the
  mobile app … the web build is design-only"_ — an explicit, honest stub), Payday & income (local
  onboarding fields).
  and "Footprint" (subs/pots/cycles counts) are all read from the in-memory/local store.
- "Sign in" row is present but **disabled** (`muted`, no `onClick`) with hint _"save across devices —
  coming with the mobile app"_ — i.e. the screen itself documents that sign-in is not implemented yet.
- Export is a pure client-side `Blob`/`URL.createObjectURL` download of `getState()` — no server call.
- "Wipe this device" calls local `resetAll()` — no server call, nothing to reconcile with a backend.

Verdict: the Account screen shows an honest **local-only identity surface**; there is no real user
account, no server session used for anything visible, and the code is self-aware about this (toast
copy explicitly says features are stubs).

## 3. Payments — real or preview

**Entirely preview/prototype.** `ScreenPaywall.tsx` header comment states this directly: _"Prototype
pricing — real billing ships in RN,"_ and the footer copy repeats: _"Prototype pricing — real billing
ships with the app."_

- `PLUS_MONTHLY/PLUS_YEARLY/PRO_MONTHLY/PRO_YEARLY` are hardcoded constants matching `docs/PRICING.md`.
- The only "purchase" action for Plus is `startTrial()` (from `useLens()`), which flips a local flag
  (`lens.trialCycleId`) — no payment processor call, no card capture, nothing server-side.
- Pro has **no purchase path at all**: its CTA is `handleProComingSoon` (a toast: _"Melo Pro ships
  with the mobile app"_) and a `handleProNotify` that writes a `localStorage` flag
  (`folio.pro.notifyRequested`) — purely a client-side "notify me" stub, no email capture, no backend.
- `handleRestore` checks local `plusUnlocked`/`proUnlocked` flags and otherwise toasts _"No purchase
  found on this device … real restore ships with the app."_
- No Stripe/Apple/Google IAP SDK import anywhere in `src`.

Verdict: **PREVIEW.** No real purchase flow exists in this codebase; RN app is expected to carry
actual billing (App Store / Play Store IAP per the doc comments, though the mechanism itself is not
specified here — only that "real billing ships in RN").

## 4. Open Banking — research conclusion + next-phase requirement

`OPEN_BANKING_DEDUPE_RESEARCH.md` conclusion (§7, §8): this is **research, not a build authorisation**.
Open Banking itself is explicitly deferred ("stays §16 'not yet'"); the de-dupe heuristic ships first
for manual↔CSV/OCR import, reusing a provider id "if/when Open Banking is built." No provider is
chosen and no code in this repo implements bank-feed ingestion.

What "completeness" (i.e. an actual live Open Banking data path) would require, as a **next-phase
plan**, drawn from the research doc's own source comparison:

- **Provider**: a UK Open Banking / AIS aggregator — the doc studies Plaid, Tink, TrueLayer (payment-
  initiation only, not AIS) as reference implementations; none is chosen or contracted. Selection
  criteria implied by the research: exposes a stable per-transaction id for pending→posted matching
  (Plaid `pending_transaction_id`, Tink `PENDING_IDS`), supports UK banks, has sane webhook/gap
  semantics.
- **Scopes**: read-only account information (transactions, balances) — no payment-initiation scope
  needed for Folio's stated design (Folio proposes matches to the user; it does not move money).
- **Cost**: not estimated in the research doc — Plaid/Tink/TrueLayer are all metered per-connected-
  account commercial APIs; a cost model was out of scope for this research task and is unresearched.
- **Engineering work implied by the recommendation** (§7): a pure `proposeMatches(existing[],
incoming[]) -> MatchProposal[]` module (provider-id-first, fuzzy-fallback ±7d/Damerau–Levenshtein
  payee threshold), a review-before-truth "This looks like something you already added" proposal UI
  (Link · Keep both · Ignore the imported one · Edit before linking), and append-only linking so every
  match stays unlinkable — none of this exists in the current codebase; it is a specified future build.

`SUBSCRIPTION_SIGNAL_RESEARCH.md` adds a hard limit for the same eventual Open-Banking path: even with
a live bank feed, Folio can prove a **payment** recurs (with Moneyhub's stated sample thresholds:
weekly 8 / fortnightly 6 / monthly 3 / quarterly 4 / yearly 3), never that a **product** was used —
so "completeness" for subscriptions is capped at payment-fact detection, never usage/value/cancel
claims, by design (build-gate: the `RecurringSeries` type must have no usage/value/cancel field).

Verdict on Open Banking: **PHASE-LATER**, unresearched cost, no provider selected, no code exists;
treat as a distinct future initiative, not part of this MVP build.

## 5. Per-item verdict

| Item                                                         | Verdict                                                                                                     | Notes                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Melo chat (`/api/melo-chat` → Lovable AI Gateway → Gemini)   | **NEEDS-SERVICE** (already exists)                                                                          | Real, working, server-side key (`LOVABLE_API_KEY`); this is the one live backend dependency. Transaction-logging tools inside it are stubs (confirmation text only) — port the _chat UX_, not an expectation that Melo writes the ledger via this route.                     |
| Statement/receipt intake (PDF/image/paste/CSV)               | **PORT-AS-IS (local)** for the UI shell; **NEEDS-SERVICE** for actual OCR/parsing                           | No OCR/parsing call exists in this repo to inspect — the Account screen only routes to a local `intake` screen. Confirm the real parsing implementation (if any) lives in the RN app before assuming this is done.                                                           |
| Supabase auth/client scaffolding                             | **PORT AS NOTHING / DO NOT PORT**                                                                           | Present but dead — no UI ever calls it. Wiring it up for real auth in RN is a **NEEDS-SERVICE** decision to make fresh, not a port of working behavior.                                                                                                                      |
| Account screen (tier, sources, footprint, export, wipe)      | **PORT-AS-IS (local)**                                                                                      | All local-store reads; export/wipe are pure client-side. Faithfully honest UI already — port 1:1.                                                                                                                                                                            |
| Sign-in (Account screen row)                                 | **PHASE-LATER**                                                                                             | Explicitly disabled/stubbed in source; RN needs a real auth backend decision (Supabase is unused scaffolding, not a decision already made).                                                                                                                                  |
| Bank connection (Account screen row)                         | **PHASE-LATER**                                                                                             | Hardcoded empty state + explicit "ships with the mobile app" toast; this **is** the Open Banking dependency, gated behind the next-phase plan in §4.                                                                                                                         |
| Plans screen (upcoming bills/renewals)                       | **PORT-AS-IS (local)**                                                                                      | Pure derivation from local store via `deriveCalendarEvents`; no network.                                                                                                                                                                                                     |
| Paywall / pricing tiers, cadence toggle, tier compare matrix | **PORT-AS-IS (local)** for UI; **NEEDS-SERVICE** for real billing                                           | Prices/copy match `docs/PRICING.md` and are safe to port verbatim; the purchase mechanism itself (IAP, receipt validation, entitlement sync) does not exist yet and must be built fresh in RN — treat as **NEEDS-SERVICE (App Store / Play Store IAP + entitlement store)**. |
| Trial start / restore / Pro "notify me"                      | **PORT-AS-IS (local)**, with same NEEDS-SERVICE caveat as above for anything claiming to be a real purchase | These are local-flag flips and toasts; fine to port as prototype-honest UI, but must not be mistaken for working billing.                                                                                                                                                    |
| Privacy screen (export, wipe, claims list)                   | **PORT-AS-IS (local)**                                                                                      | `exportEverything()` and `resetAll()` are both local/client-side; copy is marked FROZEN and already accurate to behavior — no false claims found.                                                                                                                            |
| Open Banking (transaction import + de-dupe)                  | **PHASE-LATER**                                                                                             | No code; research-only. Needs provider selection, scope decision, and cost estimate before any build starts (see §4).                                                                                                                                                        |
| Subscription usage/decay claims                              | **N/A — permanently out of scope**                                                                          | Research concludes this is undoable honestly from banking data alone; not a gap to close, a boundary to keep enforcing (build-gate: no usage/value/cancel field, banned-phrase scan).                                                                                        |

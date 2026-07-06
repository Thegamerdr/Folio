# ACCOUNTS_MODEL.md — Full Accounts + Credit-Card-Liabilities Program Spec

Status: DESIGN DOC ONLY. No code changes in this pass. Written for a future session/agent to
execute phase by phase. Every phase below is independently shippable and independently provable
on real device data (the cached real statement is available at
`C:\Users\User\AppData\Local\Temp\claude\C--dev\2f58d8e9-4990-4ffe-9094-396bf880f59b\scratchpad\monzo-133-candidates.json`
for P1/P4 proof runs).

Worktree: `C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp` (branch `claude/melo-mvp`).
Store: `C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp\apps\mobile\src\folio\store.ts`.

---

## 0. Why this doc exists — the coherence bug that triggered it

Owner pushed on system coherence 2026-07-06 ("everything is connected — targeted or all-around?").
Diagnosis, verified against the current worktree state before writing this doc:

- **(a) Today-screen sample-numbers nudge gate.** ALREADY FIXED in this worktree. All three Today
  screens gate the "Sample numbers" chip on `!onboarding.done && !hasRealData`, where
  `hasRealData = useAppStore((st) => hasAnyUserData(st))`:
  - `apps/mobile/src/folio/screens/TodayScreen.tsx:145,541`
  - `apps/mobile/src/folio/screens/TodayModeScreen.tsx:806,1021`
  - `apps/mobile/src/folio/screens/TodayStabilityScreen.tsx:67,196`
    `hasAnyUserData` itself lives at `apps/mobile/src/folio/lib/income.ts:408-414` and is exercised by
    `apps/mobile/src/folio/lib/income.test.ts:419-490`. No further action needed here — the owner's
    diagnosis predates this fix landing, or described the symptom before this exact fix; either way,
    re-verify on device if the nag is still seen, but the code is correct as read.

- **(b) AccountScreen "Statements & receipts" row.** ALSO ALREADY FIXED. The row no longer proxies
  off `subsCount + potsCount > 0`. It now reads `hasStatementSourceData(statementImportsCount,
transactionsCount)` — `apps/mobile/src/folio/lib/accountSources.ts:15-20`, wired at
  `apps/mobile/src/folio/screens/AccountScreen.tsx:78,159,231-233,457`. `statementImportsCount` comes
  from the new `AppState.statementImports` log (`store.ts:552-561`, populated by `logStatementImport`
  at `store.ts:2169-2180`, called once per successful `addStatementAsHistory` — `store.ts:2085`).

- **(c) No document/import record existed at all.** PARTIALLY FIXED — `AppState.statementImports`
  (`store.ts:561`, type `StatementImportRecord` at `store.ts:569-578`) is a real per-import log:
  `{ id, source, rowCount, atISO }`. This is explicitly labeled in its own doc comment as **"an
  interim import-log — a stopgap ahead of the full accounts/sources model"** (`store.ts:552`). It
  proves imports happened and how many rows landed, but it does NOT know:
  - which **account** the rows landed in (there is only one implicit account — the whole ledger)
  - a **closing balance per account** (there's a single global `currentBalance` scalar, not
    per-account balances)
  - whether the statement was a **bank account or a credit card** (a card statement today would be
    merged into the same `transactions` array and the same `currentBalance`, which is wrong — see
    §2)

So (a) and (b) are done; this doc is about (c) — replacing the interim stopgap with the real,
owner-decided accounts model.

---

## 1. DECISION (owner, 2026-07-06)

Full named accounts + credit cards as real liabilities feeding the debt engine. The "Review" bottom
tab becomes the money hub: ledger + "+ Add a statement" + a documents/accounts list.

This is a genuine data-model change, not a UI reskin: today the store has exactly one implicit bank
account (the global `currentBalance` + the whole `transactions` array). The target state has N
named accounts, each owning its own balance and its own transaction slice, with credit cards treated
as liabilities that feed `debts`/`debtEngine.ts` instead of impersonating spend against the bank
balance.

---

## 2. TARGET DATA MODEL

### 2.1 `Account` entity (new)

```ts
export type AccountKind = 'bank' | 'credit-card' | 'savings' | 'cash' | 'other';

export type Account = {
  id: string;
  name: string; // user-facing label, e.g. "Monzo Current", "Amex Gold"
  kind: AccountKind;
  balanceMinor: number; // integer minor units (pence) — see §2.5 on currency precision
  isLiability: boolean; // true for 'credit-card' (and any 'other' debt-shaped account)
  institution?: string; // free-text bank/issuer name, best-effort from statement header
  currency?: string; // ISO 4217, default 'GBP' — see §6 open question
  /** ISO timestamp this account's balance was last set/confirmed by an import or manual entry. */
  balanceAsOfISO: string;
  /** ISO timestamp the account was created (for sort stability / "added N days ago" copy). */
  addedAt: string;
  /** Soft-delete flag — closed accounts stay for historical transaction integrity but drop out of
   *  every "active accounts" list/sum. Never hard-delete an account with transactions attached. */
  closed?: boolean;
};
```

Default/migration account: every existing install gets exactly one synthesized `Account` — `{ id:
'acct-main', name: 'Main', kind: 'bank', isLiability: false, balanceMinor:
round(currentBalance.amount * 100), balanceAsOfISO: currentBalance.setAt, addedAt: <schema-migration
timestamp> }` — see §3 Migration.

### 2.2 `Transaction.accountId` (extend existing type)

`Transaction` (`store.ts:292-302`) gains a required `accountId: string` field pointing at an
`Account.id`. Every existing transaction migrates to `accountId: 'acct-main'` (the synthesized
default account). Every write path that creates a `Transaction` (`addTransaction`,
`addTransactionsBatch`, `candidateToTransactionDraft`, seed data) must supply `accountId` going
forward — see §5 blast radius for every call site that needs updating.

### 2.3 `Document` / `StatementImportRecord` extension

Rename the concept (keep the field name for back-compat, extend the shape) —
`StatementImportRecord` (`store.ts:569-578`) gains:

```ts
export type StatementImportRecord = {
  id: string;
  accountId: string; // NEW — which account this import landed into
  source: 'paste' | 'pdf' | 'image' | 'csv' | 'txt' | 'manual' | 'unknown';
  filename?: string; // NEW — optional, best-effort from the file picker
  rowCount: number;
  atISO: string;
  closingBalanceMinor?: number; // NEW — the balance this import reported, if any (see §2.4)
};
```

Every pre-existing `statementImports` row migrates with `accountId: 'acct-main'`.

### 2.4 Net position, Safe Zone, and the bank/credit-card split

**This is the single most important behavior change in the whole program.** Today,
`safeZoneMath` (`lib/modes/safeZone.ts:80-115`) and every mode strategy read one scalar,
`inputs.currentBalance.amount`, as "how much money exists." Once credit cards are real accounts,
that scalar must be redefined:

- **Net position** = Σ(bank + savings + cash account balances) − Σ(credit-card balances owed).
  This is the "are we solvent" number — useful for Insights/net-worth-style surfaces, NOT for
  day-to-day spend safety.
- **Safe Zone / coming-in / going-out** must be **BANK-ONLY**: sum only `kind: 'bank'` (and
  arguably `'cash'`) account balances. A credit-card statement's spend is _borrowing_, not a bank
  outflow — it must never reduce the number that answers "can I afford this today out of my own
  money." Concretely:
  - `safeZoneMath`'s `balance` input (currently `inputs.currentBalance?.amount`) becomes "sum of
    bank-account balances," never touched by credit-card transactions.
  - Any transaction whose `accountId` points at a `kind: 'credit-card'` account must be **excluded**
    from every bank-cashflow read: `historyStats.ts` monthly spend/income series, `caughtIncome.ts`
    / `caughtBills.ts` / `caughtAnnual.ts` / `caughtDrift.ts` detectors (a card statement's "Netflix
    -£12.99" is real spending information for the debt view, but must not double-count against bank
    cashflow, since paying the card bill later is what actually leaves the bank account).
  - Practically: every reader of `state.transactions` that computes bank-side money movement must
    filter `t.accountId` to bank/cash/savings accounts, or (equivalently, cheaper) the store exposes
    a derived selector `bankTransactions(state)` that all of them call instead of `state.transactions`
    directly. Prefer the selector — one filter point, not N reimplementations.
- **Credit-card statements feed the debt engine.** A card statement's closing balance becomes that
  card `Account`'s `balanceMinor` (via `closingBalanceMinor` on the import record — §2.3), NOT
  `currentBalance`/bank balance. The debt engine (`lib/modes/debtEngine.ts`) currently reads
  `AppState.debts: Debt[]` (manually declared: name/kind/balance/apr/minPayment/dueDom — `store.ts:
104-118`) — a card `Account` needs to either (a) be reflected into a `Debt` row automatically
  (sync-on-import: find-or-create a `Debt` with `kind: 'card'` keyed by `accountId`, update its
  `balance` from the account's `balanceMinor`), or (b) `debtEngine.ts`/`strategies/debt.ts` reads
  liability accounts directly instead of/alongside `AppState.debts`. **Recommend (a)** — sync a
  `Debt` row per liability `Account` — because `apr`/`minPayment`/`dueDom` have no equivalent on
  `Account` and the amortisation math (`payoffMonths`, `summarise` — `debtEngine.ts:20-130`) needs
  them; a statement import can supply the new balance, but APR/min-payment/due-day still need the
  user to declare them once (a new liability account with no APR/min-payment yet should surface an
  "add payoff details" prompt, mirroring `strategies/debt.ts:41-58`'s existing empty-state honesty
  pattern).

### 2.5 Currency precision note

The rest of the store uses signed float pounds (`Transaction.amount`, `CurrentBalance.amount`,
`Debt.balance`, etc. — all `number` in £, not pence). `Account.balanceMinor` as specified above in
pence is a **deliberate deviation** worth flagging as an open question (§6) rather than silently
introducing a second unit convention next to 30+ existing float-pound fields. The pragmatic default
for P1: match the existing convention — `Account.balance: number` in £, consistent with
`Debt.balance` and `CurrentBalance.amount` — and drop `balanceMinor` from §2.1/§2.3 unless the owner
explicitly wants to migrate the whole store to minor units in the same pass (bigger, separate
project — do not fold into this one).

---

## 3. IMPORT FLOW CHANGE

Today `BulkStatementLanding.tsx` (and `GuidedCheckInScreen.tsx`, `OnboardingSheet.tsx`) call
`setCurrentBalance(...)` directly — a single global write with no notion of which account. Target
flow:

1. On "+ Add a statement" (new entry point on the Review-tab money hub, §4), the user picks an
   existing `Account` from a short list OR creates a new one inline (name it, pick `kind`; default
   `kind: 'bank'` unless the reader/user flags it as a card — see below).
2. Statement reading proceeds exactly as today (`statementReaderClient.ts`, chunked reads, dedup via
   `dedupeKey`/`importedTransactionId`) — no change to extraction.
3. `addStatementAsHistory` (`store.ts:2043`) gains an `accountId: string` parameter (required, no
   default — callers must resolve it from step 1 before calling). Every landed
   `Transaction` gets `accountId` stamped via `candidateToTransactionDraft` (extend that function's
   signature to accept and stamp it).
4. `closingBalance`, if the reader supplied one, sets **that account's** balance —
   `setAccountBalance(accountId, amount, asOfISO)` — never the global `setCurrentBalance`. For a
   `kind: 'credit-card'` account this also syncs/updates the paired `Debt` row's `balance` (§2.4).
5. Card-vs-bank detection: best-effort heuristic first (statement header text matching
   "credit card"/"Amex"/"Visa card" patterns, or a negative running-balance-as-debt convention some
   card statements use), but always let the user confirm/override the `kind` at account-creation
   time (step 1) rather than silently guessing wrong and mis-classifying a whole statement's spend
   as bank outflow.

`setCurrentBalance` (`store.ts:1413`) is retired in favor of `setAccountBalance(accountId, ...)`
once all four call sites (`BulkStatementLanding.tsx:134`, `GuidedCheckInScreen.tsx:209`,
`OnboardingSheet.tsx:588`, plus test call sites) migrate — see §5.

---

## 4. PHASES

Each phase is independently shippable and independently provable on real data (use the cached
Monzo statement JSON at the scratchpad path in §0 for P1 and P4 proofs — it's a real bank
statement, so it exercises the "this is obviously a bank account" path; a second synthetic/manual
card statement is needed to prove P2/P4's card path since no real card statement is cached yet).

### P1 — Accounts data model + migration + import-assigns-account + per-account balance

**Changes:**

- Add `Account` type + `AppState.accounts: Account[]` slot (store.ts, new section near `Debt`/
  `Household` — around line 118-133).
- Add `Transaction.accountId: string` (required field, `store.ts:292-302`).
- Schema migration v8→v9 (`MIGRATIONS` record, `store.ts:864-997`, pattern-matched off the existing
  v7→v8 income-sources migration at `store.ts:973-996`): synthesize `accounts: [{ id: 'acct-main',
name: 'Main', kind: 'bank', isLiability: false, balance: prior.currentBalance?.amount ?? 0,
balanceAsOfISO: prior.currentBalance?.setAt ?? <migration timestamp>, addedAt: <migration
timestamp> }]`, and backfill every existing `transactions[i].accountId = 'acct-main'` and every
  existing `statementImports[i].accountId = 'acct-main'`.
- Add `setAccountBalance(accountId, amount, source, confidence)` and `addAccount(...)` store
  actions, mirroring `setCurrentBalance`'s doc-comment contract (`store.ts:1410-1415`).
- `addStatementAsHistory` gains the required `accountId` param (§3 step 3); update its 3 call sites
  (`BulkStatementLanding.tsx`, `GuidedCheckInScreen.tsx`, `OnboardingSheet.tsx` — confirm via grep,
  see §5) to resolve/pass `'acct-main'` for now (account picker UI is P3, not P1) so imports keep
  working exactly as before while the plumbing is laid.
- `safeZoneMath` and every `ModeInputs.currentBalance` consumer switch to reading "sum of bank
  account balances" instead of the single scalar — but with only one bank account
  (`acct-main`) existing until P3, this is a **behavior-preserving refactor** in P1: sum-of-one is
  the same number. This is the right order (plumb the shape change now, prove it's inert, add
  real multi-account behavior in P3) rather than doing the visible multi-account behavior change and
  the underlying data migration in the same commit.

**Proof:** run existing store/income/storeRoute/widgetSnapshot test suites green (they all read
`currentBalance` today — updating them to read the new `accounts`-derived sum should produce
byte-identical numbers on every existing fixture, since sum-of-one-account = the old scalar).
Feed the cached Monzo statement through `addStatementAsHistory(candidates, 'acct-main',
closingBalance)` and confirm the landed transactions all carry `accountId: 'acct-main'` and the
account's balance updates from the statement's closing balance instead of the global
`currentBalance`.

### P2 — Credit-cards-as-liabilities into the debt engine + net position

**Changes:**

- Add `kind: 'credit-card'` account support: `isLiability: true`, balance represents amount owed
  (positive = owed, mirroring `Debt.balance`'s "never negative, always owed" convention —
  `store.ts:108-109`).
- Sync-on-write: whenever a `kind: 'credit-card'` account's balance changes (import or manual),
  find-or-create a paired `Debt` row (`kind: 'card'`, `id` derived from `accountId` so it's stable,
  e.g. `debt-for-${accountId}`) and update its `balance`. If no `Debt` row exists yet (brand new
  card account with no APR/min-payment declared), surface an "add payoff details" prompt rather than
  silently defaulting apr/minPayment to 0 (0% APR + £0 minimum would make `debtEngine.summarise`
  report an instant/free payoff, which is false).
- Add `netPosition(state)` selector: Σ(non-liability account balances) − Σ(liability account
  balances). This is a NEW number, distinct from Safe Zone — surfaced wherever "net worth"-style
  framing is wanted (Insights is the natural home; not in scope to wire into a specific screen in
  this phase, just make the selector exist and be tested).
- Bank-only cashflow filter (§2.4): add `bankTransactions(state)` selector (filters
  `state.transactions` to accounts where `!isLiability`), and re-point every bank-cashflow reader
  (`historyStats.ts`, `caughtIncome.ts`, `caughtBills.ts`, `caughtAnnual.ts`, `caughtDrift.ts`,
  `income.ts`'s `selectMonthlySpend`/`selectMonthlyIncome`) at it instead of raw `state.transactions`
  — see §5 for the full call-site list.

**Proof:** manually construct a test fixture with one bank account (balance £500) and one
credit-card account (balance owed £200, synced `Debt` row with APR 22.9%, min payment £25). Assert
`netPosition` = £300. Assert `safeZoneMath`'s balance input reads £500 (bank-only), not £300 and not
£700. Assert a -£50 "Netflix" transaction posted to the credit-card account does NOT appear in
`selectMonthlySpend`'s bank-side total but DOES feed into the card's balance/debt view.

### P3 — Review-tab money hub (ledger + add + documents/accounts list) + AccountScreen accounts view

**Changes:**

- Redesign the "Review" bottom tab (currently `ReviewScreen.tsx`, the intake-candidate queue
  screen — confirm current responsibilities before touching) into the money hub: the existing
  ledger/candidate-review UI, PLUS a "+ Add a statement" entry point (account picker/creator from
  §3 step 1), PLUS a documents/accounts list (surfaces `AppState.accounts` + `AppState.
statementImports`, so the user can see "Monzo Current — 3 statements imported, last balance £512
  as of 3 July" per account).
- `AccountScreen.tsx`'s existing "Statements & receipts" row (§0(b), already using the honest
  `hasStatementSourceData` signal) either stays as a summary link into the new hub, or is
  subsumed by it — decide based on how `ReviewScreen`'s existing IA reads once the hub is drafted;
  don't preserve a redundant second entry point if the hub fully replaces it.
- Wire the account picker/creator UI that P1 stubbed as "always `acct-main`" — this is where a
  user actually gets to add a second account for the first time.

**Proof:** device walk — add a bank statement to a NEW named account (not `acct-main`), confirm it
shows up correctly separated in the hub's documents list with its own balance; add a card statement
to a new credit-card account, confirm it appears in the debt view, not the bank ledger.

### P4 — Coherence + multi-account proof

**Changes:** none — this is a verification-only phase.

- Import the cached real Monzo bank statement into one account AND a second (synthetic, hand-built
  fixture is fine — no real card statement is cached) credit-card statement into a second account in
  the same test session/device walk.
- Assert: bank balance reflects only the bank statement; card account balance reflects only the
  card statement; `netPosition` = bank − card; Safe Zone number matches bank-only expectation;
  the debt view shows the card with a payoff estimate; the Today "Sample numbers" nudge stays
  correctly suppressed (§0(a)'s existing fix must not regress — `hasAnyUserData` needs to also
  consider `state.accounts` once accounts can hold data independent of `transactions`/
  `incomeSources`/`currentBalance.source` — see §5, `income.ts:408-414` needs a new OR-clause here
  eventually, flag as a P4 checklist item rather than silently missing it).

---

## 5. BLAST-RADIUS MAP

Every current reader of `currentBalance` / `transactions` that must become account-aware. Grepped
against the worktree at the time of writing (paths relative to
`C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp\apps\mobile\src\folio\`).

### Direct `currentBalance` readers/writers (34 files hit the substring; the ones that need real

logic changes, not just a mechanical rename, are marked ACTION):

- `store.ts` — ACTION. Defines `CurrentBalance`/`AppState.currentBalance` (lines 261-275, 353-355),
  `setCurrentBalance` writer (1413-1415), `SAMPLE_BALANCE`/`EMPTY_BALANCE` constants (692-708),
  every migration step that touches `currentBalance` (872-896 v1→v2, 1067 `load()`), and
  `addStatementAsHistory`'s closing-balance offer plumbing (2043-2130). This is the core rewrite.
- `store.test.ts` — ACTION (mechanical + new test blocks for `accounts`).
- `lib/income.ts:412` — ACTION. `hasAnyUserData`'s `state.currentBalance.source !== 'sample'` check
  needs an added OR-clause once `accounts` exists as an independent data source (see P4 note above).
- `lib/storeRoute.ts:96-97,149-151,184-196,249,277` — ACTION. This is THE core "spare/tightest point"
  route computation; `balance: state.currentBalance.amount - sigmaSaved` (line 196) becomes
  bank-account-sum-based. High-risk file — the whole Today path derives from this.
- `lib/modes/safeZone.ts:81,86` — ACTION (see §2.4 — the single most important change).
- `lib/modes/types.ts:84,109-115` — ACTION. `ModeInputs.currentBalance` either becomes a
  bank-sum-derived value the caller computes before building `ModeInputs`, or is renamed/
  supplemented with a `bankBalance` field so every strategy file is touched deliberately, not
  silently fed a wrong number. Recommend: keep `ModeInputs.currentBalance` as a `CurrentBalance`-
  shaped value but document clearly that its `.amount` is now "bank-only sum," computed by the
  caller (`storeRoute.ts` or a new selector) — do not change the 10 strategy files under
  `lib/modes/strategies/` themselves, since they only ever read `inputs.currentBalance.amount` and
  don't care where it came from.
- `lib/widgetSnapshot.ts:84,95,108,110` — ACTION. Home-screen widget snapshot; same bank-sum
  substitution.
- `lib/notifyState.ts` — ACTION (uses `currentBalance` for notification thresholds — confirm exact
  lines via `Grep 'currentBalance' lib/notifyState.ts` before touching; not fully enumerated in this
  pass, flagged as a required re-check).
- `lib/export.ts` / `lib/export.test.ts` — ACTION. Data-export must include per-account
  balances/kind, not just the single scalar, once accounts exist (privacy/GDPR export completeness).
- `lib/useMeloOpener.ts` — ACTION (Melo's opening line logic likely references balance/weather;
  re-check for direct `currentBalance` reads).
- `lib/lensPaywall.ts` — check only (grep hit; likely just references the type, not the value —
  confirm before assuming no action).
- `sheets/OnboardingSheet.tsx:588` — ACTION (writer: `setCurrentBalance` → becomes
  `setAccountBalance('acct-main', ...)` at P1, then real account picker at P3).
- `sheets/SafeZoneSheet.tsx`, `sheets/AffordCheckSheet.tsx`, `sheets/CalendarConnectSheet.tsx`,
  `sheets/CalendarExportSheet.tsx`, `sheets/SheetDayDetail.tsx` — check only (likely read derived
  Safe Zone/route output, not `currentBalance` directly — re-verify each before assuming inert).
- `screens/TodayScreen.tsx`, `TodayModeScreen.tsx`, `TodayStabilityScreen.tsx`,
  `TodayAfterScreen.tsx`, `GuidedCheckInScreen.tsx:209` (writer), `CalendarScreen.tsx`,
  `ReviewScreen.tsx`, `PlansScreen.tsx`, `PotsScreen.tsx`, `PaywallScreen.tsx`, `MeloScreen.tsx`,
  `AccountScreen.tsx` — mixed; `GuidedCheckInScreen.tsx:209` is a confirmed writer (ACTION, same
  pattern as OnboardingSheet); the rest mostly consume derived state (`storeRoute`/`safeZoneMath`
  output) rather than `currentBalance` directly and should go inert once the upstream selectors are
  fixed — but each needs a quick re-grep pass at P1/P2 implementation time to confirm, not just
  assumed.
- `shell/FolioShell.tsx` — check only (grep hit near `onboarding.done` logic, `FolioShell.tsx:281,
282,295` per the earlier search — likely reads `hasAnyUserData`/onboarding, not `currentBalance`
  directly; re-verify).

### Direct `transactions` readers (35 files hit the substring):

High-risk / definite ACTION (these compute bank cashflow and must switch to a bank-filtered read,
§2.4):

- `store.ts` — defines the array + every write path (`addTransaction`, `addTransactionsBatch`,
  `addStatementAsHistory`, `editTransaction` — lines 1835-2199+). ACTION: add `accountId` to the
  `Transaction` type and every constructor call.
- `lib/income.ts` (`selectMonthlySpend`/`selectMonthlyIncome`, `hasAnyUserData`) — ACTION, bank-filter.
- `lib/caughtIncome.ts`, `lib/caughtBills.ts`, `lib/caughtAnnual.ts`, `lib/caughtDrift.ts`,
  `lib/caughtSubs.ts` — ACTION, bank-filter (a card statement's merchant patterns shouldn't drive
  bank-side income/bill/drift/annual detection).
- `lib/modes/strategies/irregular.ts` (+ `.test.ts`) — ACTION. History-fed income floor
  (`historyStats.monthlyIncomeSeries`) must read bank-only transactions.
- `lib/export.ts` (+ `.test.ts`) — ACTION. Export must carry `accountId` per row and probably group
  by account.
- `lib/widgetSnapshot.ts` (+ `.test.ts`) — ACTION, bank-filter for the widget's spend/income figures.
- `lib/persist.test.ts` — mechanical update (fixtures need `accountId`).
- `lib/useMeloOpener.ts` — re-check (Melo's chat context likely summarizes recent transactions —
  should probably stay whole-picture, i.e. mention both bank and card activity in conversation, but
  MUST label which is which — don't silently blend "spent £40" without saying which account).
- `sheets/onboardingComplete.test.ts`, `sheets/EditTxnSheet.tsx`, `sheets/RouteDetailSheet.tsx` —
  `EditTxnSheet` in particular (editing a transaction) may need an account-aware display (which
  account this row belongs to) even if editing itself is account-agnostic — check.

Likely inert / display-only (consume derived output, re-check but lower priority):

- `screens/RecoveryScreen.tsx`, `screens/InsightsScreen.tsx`, `screens/VisualizerScreen.tsx`,
  `screens/TimelineScreen.tsx`, `screens/today/TodayNudges.tsx`,
  `screens/today/TodayRecentTxns.tsx`, `screens/TodayAfterScreen.tsx`, `screens/WhatIfScreen.tsx`,
  `screens/PaydayRitualScreen.tsx`, `screens/today/TodayWeekTiles.tsx`,
  `screens/today/TodaySpendStrip.tsx`, `screens/PrivacyScreen.cleanSlate.test.ts`,
  `shell/FolioShell.tsx`, `lib/caughtBillsOrdering.test.ts`, `lib/caughtOrderingExtended.test.ts` —
  `TodayRecentTxns`/`TimelineScreen`/`InsightsScreen` almost certainly want to SHOW which account a
  transaction belongs to (a small account badge/label) even where the underlying math doesn't
  change, so treat "inert" as "no math change" not "no UI change."

**Total re-check surface: ~55 unique files across the two greps (with overlap).** This is the honest
size of the blast radius — do not underscope the phase plan against it. P1 deliberately keeps this
inert by preserving sum-of-one-account math; P2/P3 are where the real re-checks land.

---

## 6. OPEN DESIGN QUESTIONS FOR THE OWNER

1. **Currency handling.** Does any account ever need a non-GBP currency (e.g. a USD savings
   account)? If yes, every cross-account sum (`netPosition`, Safe Zone bank-sum) needs an FX
   conversion step and a "as-of rate" honesty story matching the app's existing "never invent a
   number" ethos (`safeZoneMath`'s doc comment, `store.ts`'s `BalanceConfidence` pattern). If GBP-only
   for the foreseeable future, skip this entirely and hardcode the assumption with a comment,
   rather than half-building multi-currency plumbing nobody asked for.

2. **Cash account.** Is a manually-tracked "cash in wallet" account in scope for the first ship, or
   is `kind: 'cash'` a placeholder for later? If in scope, does cash count toward Safe Zone
   bank-sum (arguably yes — it's spendable money) — the spec in §2.4 assumes yes, but this needs
   explicit sign-off since it's the one non-bank `kind` that still isn't a liability.

3. **Naming accounts on import.** When a statement is imported and the reader can't confidently
   infer an institution name, what's the default account name shown to the user — "New account",
   the filename, or a forced name-entry step before the import can proceed? The spec in §3 assumes
   the user always names/confirms at step 1, but the exact UX (blocking modal vs. inline
   editable-after-the-fact label) is undecided.

4. **Existing seed debts (`DEFAULTS.debts` — `store.ts:769-790`, "Personal loan" + "Klarna sofa").**
   These are `kind: 'loan'`/`'bnpl'`, not `'card'`, and have no paired `Account`. Do they stay as
   pure `Debt` rows forever (loans/BNPL never get a bank-style `Account`, only real credit cards
   do), or does the model eventually want an `Account` for every liability type? Recommend: loans/
   BNPL stay `Debt`-only (they don't have "statements" in the same sense a card does) — only
   `kind: 'credit-card'` gets the `Account`-plus-synced-`Debt` treatment described in §2.4. Flagging
   for explicit sign-off since it's an asymmetry in the model worth the owner knowing about.

5. **Closing an account.** `Account.closed` is specified (§2.1) but no phase above wires a UI for
   it. Is "closing/archiving an account" in scope for this program, or a later follow-up? If a
   later follow-up, the `closed` field can be added to the type now (cheap) without building any UI
   for it in P1-P4.

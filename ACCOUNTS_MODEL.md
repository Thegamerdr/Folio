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

---

## 7. GOALS + TONE-GATED GUIDANCE (owner doctrine, memory `melo-modes-goals-tone-doctrine`)

Two more phases, layered on top of P1-P4, not a replacement for them. Binding doctrine repeated
here because it governs every design choice below: **modes are the product thesis and never get
simplified away; goals layer ON TOP of the active mode; Melo's tone is a user-owned dial that
controls guidance intensity; guidance is always a suggestion about the user's OWN money toward A
GOAL THEY SET — never financial advice, never a product recommendation, never regulated framing.**

### P5 — Goals as first-class store entities

**New type** (store.ts, new section near `Debt`/`Household`, same neighbourhood as the new
`Account` type from §2.1 — goals reference accounts/debts, so they belong close by):

```ts
export type GoalKind = 'debt-free' | 'buffer' | 'clear-specific-debt' | 'save-target';

export type Goal = {
  id: string;
  kind: GoalKind;
  label: string; // user-facing, e.g. "Clear the Klarna sofa", "Build a 1-month buffer"
  targetMinor?: number; // for 'buffer'/'save-target' — the number the user is aiming at
  targetDateISO?: string; // optional deadline; goals are allowed to have none
  linkedDebtId?: string; // for 'clear-specific-debt' — Debt.id (store.ts:104-118)
  linkedAccountId?: string; // for 'buffer'/'save-target' — Account.id (§2.1), the account the
  // goal is tracked against (e.g. a savings account balance)
  createdAt: string; // ISO
  achievedAt?: string; // ISO — set once, never cleared; achieved goals stay visible as a win,
  // not deleted (matches the app's no-shame/honesty posture elsewhere)
  dismissed?: boolean; // soft-hide without deleting history
};
```

`AppState.goals: Goal[]` — new top-level slot, same pattern as `AppState.debts`
(`store.ts:104-118`) and the new `AppState.accounts` (§2.1). Migration: new installs get
`goals: []`; no backfill needed since the concept doesn't exist in any prior schema version.

**Progress derivation** (pure selectors, no stored "progress" field — derive, don't duplicate,
per the store's existing derived-state discipline like `netPosition`/`bankTransactions` in §2.4):

- `kind: 'debt-free'` → progress = trend of `debtEngine.summarise()`'s total balance toward £0.
  Needs a starting snapshot (balance when the goal was created) to compute "% paid off since you
  started," not just "current balance" — store `startingBalanceMinor` at goal-creation time
  (add this field to `Goal` above; omitted from the first draft, flag before implementing) since
  the debt engine itself has no memory of "balance when the goal began."
- `kind: 'clear-specific-debt'` → same shape as `debt-free` but scoped to one `Debt.id`
  (`linkedDebtId`) instead of the whole debt total. Reads `debtEngine`'s per-debt payoff line.
- `kind: 'buffer'` → progress = `linkedAccountId`'s current balance vs `targetMinor`, where the
  linked account is expected to be a `kind: 'bank'` or `'savings'` account (§2.1). Uses the same
  bank-only balance discipline as Safe Zone (§2.4) — a buffer goal must never be satisfied by
  moving money onto a credit card.
- `kind: 'save-target'` → identical shape to `buffer` (balance vs `targetMinor`), kept as a
  separate `kind` only because the copy/framing differs ("build a cushion" vs "save toward X") —
  the math is the same selector, do not fork the implementation, only the label.

**How a goal gets set — the owner's open item, not yet decided (see §7.3 open questions
below):** two entry points are both plausible and not mutually exclusive: (a) explicit creation —
a "set a goal" affordance somewhere in the money hub (§4, P3) or Melo chat; (b) Melo-detected
offer — when a liability `Account`/`Debt` is created or first synced (P2's sync-on-import,
§2.4), Melo offers "want to make clearing this a goal?" as a one-tap accept, never auto-created
silently. Both routes converge on the same `addGoal(...)` store action; build that action once,
wire both entry points against it independently (P5 core = the action + selectors + the
Melo-detected offer since it piggybacks directly on P2's existing sync-on-import hook; the
explicit "set a goal" UI entry point can land in the same phase or slip to a fast-follow — it's
additive, not blocking).

**Where goals show:** Insights (net-worth-style framing, alongside `netPosition` from §2.4) is
the natural home for a goals list/progress view; the Today action card (P6 below) is where an
_active_ goal surfaces as a nudge-shaped suggestion when tone permits. Not in scope for P5 itself
to wire every surface — P5 ships the data model + selectors + the Melo-offer entry point;
surfacing is P6's job where it's guidance-shaped, and a fast-follow UI item where it's a plain
list view.

**Proof:** construct a fixture with one `kind: 'credit-card'` liability account (balance owed
£200) and a `clear-specific-debt` goal linked to its synced `Debt` row with
`startingBalanceMinor: 30000` (£300). Pay it down to £200 (owed) via a simulated statement
import/manual edit. Assert the goal's derived progress selector reports one-third paid off
(£100 of £300). Assert a `buffer` goal linked to a bank account with `targetMinor: 50000` (£500)
against a bank balance of £320 reports progress without ever reading the credit-card balance.

### P6 — Tone-gated guidance

**Where the tone setting actually lives today — this is the first blocker to fix, not a detail:**
`Tone` (`'calm' | 'honest' | 'dry' | 'coachy'`) is currently **local `useState` inside
`MeloChatSheet.tsx`** (`sheets/MeloChatSheet.tsx:83-84,102,112-113,285`), reset to
`DEFAULT_SETTINGS = { tone: 'calm', share: false }` (line 102) every time the sheet mounts. The
component's own comment at line 284 (`@rn-engine melo-chat-persistence — wire @folio/storage over
folio.melo.chat.v1`) already flags this as a known gap for chat transcript persistence; tone needs
the same treatment, but promoted **out of the chat sheet entirely** and into `AppState`, because
P6 requires reading it from Today/nudge surfaces that have no relationship to the chat sheet's
local state.

**Required plumbing change (blocking, do first):**

- Add `AppState.meloTone: Tone` (default `'calm'`, matching today's default) to the store, next to
  other user-preference scalars.
- Add a `setMeloTone(tone)` store action.
- `MeloChatSheet.tsx`'s settings panel (the existing `ToneButton` grid, lines 563-569, 828-875)
  reads/writes the store value instead of local `useState` — this is a small, mechanical change to
  an existing, already-built UI; no new tone-picker UI needed.
- This makes tone a **single global setting** (see open question below on per-surface tone —
  recommend global-only for the first ship; see §7.3).

**Guidance intensity mapping** — applied at every surface that has Melo "speak" (Today action
card, `TodayNudges.tsx`'s nudge array, and any future goal-progress nudge from P5):

| Tone     | Behavior                                                                                                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `calm`   | Answer-only. Shows numbers/state, no suggested action. If a nudge would normally carry a CTA suggestion, it either doesn't appear or appears as a neutral statement with no imperative verb.                                                                                   |
| `honest` | States the situation plainly, including uncomfortable numbers (matches the app's existing no-euphemism copy discipline elsewhere), but still no pushed suggestion.                                                                                                             |
| `dry`    | Same information as `honest`, terser/deadpan phrasing; still no pushed suggestion — `dry` is a voice change, not an intensity change.                                                                                                                                          |
| `coachy` | The only tone that surfaces goal-directed suggestions — pulls from the active mode's strategy (`lib/modes/strategies/*.ts`) and any active P5 `Goal`, e.g. "£40 spare — put it toward the Klarna?" (referencing the user's own linked debt/goal, never a third-party product). |

Concretely: `TodayNudges.tsx` (`screens/today/TodayNudges.tsx:146` builds the `nudges: Nudge[]`
array today with no tone awareness at all) gains a filter/gate — suggestion-shaped nudges
(anything with an action CTA that recommends WHERE to put spare money, as opposed to a pure
informational nudge like "3 statements ready to review") only push into the array when
`meloTone === 'coachy'`. Non-actionable/informational nudges (review queue, payday ritual offer,
etc.) are unaffected by tone — the gate applies specifically to money-direction suggestions, not
to the whole nudge system.

**HARD GUARDRAIL — read before writing any Melo copy in this phase:**

Every `coachy`-tier suggestion MUST be:

- about the user's OWN money (an amount they already have, e.g. "spare"/"tightest point" derived
  from `storeRoute.ts`), directed at a goal or debt THEY already declared (a P5 `Goal` or an
  existing `Debt`/liability `Account`) — never a suggestion to acquire new credit, open a new
  account, or take on new debt.
- phrased as an observation + optional action on existing money, not advice: "£40 spare — put it
  toward the Klarna?" is allowed; "you should pay off high-interest debt first" is NOT (that's
  generic financial advice, not a move on the user's specific numbers).
- free of any product name, provider, or category recommendation. Banned: refinance, remortgage,
  switch card, balance transfer, "consider a loan," "consider investing," any named or generic
  financial product the user doesn't already hold. If a suggestion would require recommending a
  product to execute it, it is out of scope for Melo — full stop, no exceptions, regardless of
  tone.
- never framed as regulated advice language: no "you should," "we recommend," "the best move is."
  Prefer question-shaped or option-shaped phrasing ("...put it toward the Klarna?") over
  imperative/prescriptive phrasing ("Pay off the Klarna now").

**Allowed vs banned examples (use these as the litmus test for any new copy in P6):**

| Allowed (coachy)                                                             | Banned                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| "£40 spare this week — toward the Klarna, or let it sit?"                    | "You should pay down the Klarna before your other debts."  |
| "Buffer goal is £180 short — want to earmark this month's spare?"            | "Consider opening a savings account for this."             |
| "Card balance ticked up £60 since last statement." (informational, any tone) | "You could save on interest by transferring this balance." |
| "£300 left to your debt-free goal at this pace."                             | "A personal loan at a lower rate could clear this faster." |

**Proof:** unit-test `TodayNudges` (or its nudge-building function) with `meloTone: 'calm'` and
assert no money-direction suggestion nudge is present even when a P5 goal + spare money both
exist; re-run with `meloTone: 'coachy'` and assert the suggestion nudge appears and its copy
matches the allowed-phrasing pattern (question-shaped, references only the user's own linked
goal/debt, no product names). Snapshot-test the banned-phrase list against a lint/grep step if
practical (grep the nudge copy strings for the banned-word list above) so a future edit can't
silently reintroduce advisory language.

### 7.3 Open questions for the owner (goals + tone)

1. **How are goals created?** Explicit user-initiated ("set a goal" UI, entry point undecided —
   money hub vs Melo chat vs both) and/or Melo-detected-and-offered (on new liability
   account/debt creation, "make this a goal?"). Recommend building both since they're additive,
   but which ships first if only one fits P5's first cut?
2. **Is tone one global setting or per-surface?** §7 P6 recommends a single `AppState.meloTone`
   applied everywhere Melo speaks (chat, Today, nudges). Is there ever a reason for the chat sheet
   itself to run "coachier" than the ambient Today nudges, or vice versa? Recommend global-only
   for the first ship — per-surface tone is speculative complexity (YAGNI) until a real use case
   shows up.
3. **Goal lifecycle copy.** When a goal is achieved (`achievedAt` set), does Melo say anything
   proactively (a one-time celebratory nudge, tone-gated the same as suggestions?), or does the
   achieved goal just sit quietly in the goals list until the user looks? Undecided — flag before
   building the achievement-detection code path in P5/P6.
4. **`startingBalanceMinor` on `Goal`.** Flagged inline in §7 P5 above — needed for
   `debt-free`/`clear-specific-debt` progress math but omitted from the first type draft. Confirm
   before implementation; cheap to add now.

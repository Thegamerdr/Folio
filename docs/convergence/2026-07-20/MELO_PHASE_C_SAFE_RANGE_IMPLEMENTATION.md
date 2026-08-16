# Melo Phase C — Trusted Safe Range implementation

Phase C converts the Phase B Trusted Core contract into a working Personal Safe Range seam without beginning Phase D.

## Scope completed

- `packages/domain/src/trustedCore.ts` now extends `TrustedSafeRangeResult` with Phase C fields:
  - status
  - truth class
  - current position
  - committed floor
  - expected range
  - tightest point
  - shortfall
  - confidence reasons
  - freshness detail
  - missing inputs
  - contradictions
  - reliance detail
  - why changed
  - next action
- `apps/mobile/src/folio/lib/trustedSafeRange.ts` is the pure Personal adapter.
- `apps/mobile/src/folio/screens/TodayScreen.tsx` now consumes the Trusted Safe Range result and exposes the required state on Today.
- Legacy Safe Zone remains operational behind a comparison adapter.

## C1 adapter boundary

The adapter is:

- pure over `(AppState, now, optional previousResult, optional restore flag)`;
- Personal-only;
- deterministic;
- free of React, React Native, store hooks and native modules;
- explicit about pounds-to-minor-unit conversion;
- fed by the existing store route, Calendar event engine and `@folio/finance-engine`.

The adapter reads:

- active workspace id and kind;
- data workspace id;
- current balance source, confidence and timestamp;
- accounts;
- onboarding payday and monthly income;
- income sources;
- subscriptions and paused/nudged state;
- manual calendar events;
- pots and pot ledger;
- debts;
- Recovery spend hold;
- What If holds;
- persisted review queue;
- transient reader candidates;
- statement imports;
- bank transactions only.

## C2 finance integration

The adapter builds a forecast input from the current AppState:

- opening amount = bank-only balance minus saved pots;
- forecast occurrences = derived Calendar events plus debt minimum payments;
- source certainty = mapped from truth class;
- transfers = detected as neutral assumptions and excluded from spend/income reliance copy;
- legacy Safe Zone comparison = deterministic compatibility snapshot with £5 material divergence threshold.

## C3 Today integration

Today now shows:

- current safety state;
- expected Safe Range;
- committed floor;
- tightest point or shortfall;
- confidence and freshness;
- why it changed;
- missing or conflicted facts;
- source summary;
- one optional next action.

The existing Today shell, route graph and surrounding cards are preserved.

## Non-goals honoured

- No full Safe Range visual redesign.
- No broad navigation change.
- No persistence rewrite.
- No Business scope expansion.
- No Phase D Decision Ledger writer.
- No deletion of legacy Safe Zone.

# Pressure and recovery journey

## Contract

Pressure detected → calm explanation → essentials identified → supported moves → preview → one confirmation → Safe Range reflected → Decision Receipt → follow-up.

## Protection order

1. housing
2. energy and essential utilities
3. food and essential transport
4. legally or practically urgent commitments
5. user-defined protected buffer
6. non-essential recurring commitments
7. flexible savings contributions
8. optional spending

## Phase E implementation

- `supportedRecoveryMoves` only returns options supported by current state.
- It can return:
  - correct missing information
  - pause optional subscriptions present in local state
  - use available pot money with consequences
  - bounded spending hold
  - add known incoming money
- It does not fabricate creditor flexibility, entitlement eligibility, future income or cancellation success.
- Existing `setSpendHold` creates a `spending-hold` receipt awaiting outcome.

## Deferred

- Full recovery bundle preview sheet.
- Regulated debt-support copy/pathway audit.

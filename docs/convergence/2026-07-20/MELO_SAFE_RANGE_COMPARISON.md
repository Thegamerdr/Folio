# Melo Safe Range comparison

## Purpose

Phase C keeps a temporary comparison between Trusted Safe Range and legacy Safe Zone so material divergences can be seen before legacy removal.

## Comparison function

`buildTrustedSafeRangeLegacyComparison(state, { now })`

Returns:

- legacy tightest minor amount;
- trusted conservative boundary minor amount;
- delta minor amount;
- material boolean;
- reason.

## Material threshold

`£5` (`500` minor units)

This is intentionally small because a spending-safety boundary should not drift silently.

## Expected divergences

Trusted Safe Range may diverge from legacy Safe Zone because it includes:

- source truth;
- freshness;
- blocked range suppression;
- debt minimum payments;
- pending review uncertainty;
- variable-bill uncertainty;
- stale-balance uncertainty;
- borrowed-pot uncertainty;
- explicit workspace boundary blocking.

## Legacy role

Legacy Safe Zone is retained only for compatibility and comparison. New confidence, freshness and truth semantics belong in `TrustedSafeRangeResult`.

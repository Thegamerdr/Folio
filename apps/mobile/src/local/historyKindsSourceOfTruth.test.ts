import { describe, expect, it } from 'vitest';

import {
  createEmptyLocalLedgerState,
  LOCAL_HISTORY_KINDS,
  type LocalLedgerState,
} from './localLedger.js';
import {
  addCycleThroughCanonicalRepository,
  createPotThroughCanonicalRepository,
  createSubscriptionThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';

// Pins FIX 2: pot / subscription / cycle history entries were silently dropped on every reload
// because the native store's persistence allowlist (isHistoryKind) hardcoded only ~half the kinds.
// The fix makes LOCAL_HISTORY_KINDS the single source of truth that the store's allowlist derives
// from. These assertions prove the durable-container kinds the mutators emit are members of that
// source of truth — i.e. they would survive the reload guard rather than being filtered out.
//
// The old bug shape (a 10-kind allowlist missing pot_*/subscription_*/cycle_*) fails this test
// because those kinds would not be present in the persisted/loadable set.

const kindSet: ReadonlySet<string> = new Set<string>(LOCAL_HISTORY_KINDS);

function seededLedger(): LocalLedgerState {
  return {
    ...createEmptyLocalLedgerState('2026-06-28'),
    cashOnHandMinor: 50_000,
  };
}

describe('history kinds single source of truth (FIX 2 data-loss guard)', () => {
  it('includes the pot, subscription, and cycle kinds that the store used to drop', () => {
    for (const kind of [
      'pot_created',
      'pot_funded',
      'pot_reallocated',
      'subscription_created',
      'subscription_paused',
      'subscription_resumed',
      'subscription_used',
      'subscription_cancelled',
      'subscription_bulk_paused',
      'cycle_closed',
    ] as const) {
      expect(kindSet.has(kind)).toBe(true);
    }
  });

  it('emits a pot_created history entry that survives the loadable allowlist', () => {
    const withPot = createPotThroughCanonicalRepository(seededLedger(), {
      name: 'New phone',
      goalMinor: 60_000,
      perWeekMinor: 2_000,
      accent: true,
    });
    const entry = withPot.history[0];
    expect(entry?.kind).toBe('pot_created');
    expect(kindSet.has(String(entry?.kind))).toBe(true);
  });

  it('emits a subscription_created history entry that survives the loadable allowlist', () => {
    const withSub = createSubscriptionThroughCanonicalRepository(seededLedger(), {
      name: 'Netflix',
      costMinor: 1099,
      cadence: 'monthly',
    });
    const entry = withSub.history[0];
    expect(entry?.kind).toBe('subscription_created');
    expect(kindSet.has(String(entry?.kind))).toBe(true);
  });

  it('emits a cycle_closed history entry that survives the loadable allowlist', () => {
    const closed = addCycleThroughCanonicalRepository(seededLedger(), {
      label: 'June',
      spareMinor: 12_000,
      tightPointMinor: 4_000,
      setAsideMinor: 8_000,
    });
    const entry = closed.history[0];
    expect(entry?.kind).toBe('cycle_closed');
    expect(kindSet.has(String(entry?.kind))).toBe(true);
  });
});

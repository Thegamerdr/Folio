import { describe, expect, it } from 'vitest';

import { createCanonicalMobileLedgerSnapshot } from './canonicalLedgerAdapter.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { createInitialLocalLedgerState } from './localLedger.js';

// Regression guard for a launch crash: the seed/example models upcoming rent and payday as
// confirmed future-dated transactions. Once the device date advanced past a seeded/imported row,
// the canonical validation used to flag it as a "future fact", the repository threw while
// rendering, and the whole app crashed on launch. A future-dated confirmed transaction is
// legitimate data and must not be a fatal validation failure.
describe('future-dated transactions do not crash the canonical repository', () => {
  // Shifting the seed forward to an as-of date far in the future puts every seeded row well past
  // today, which is exactly the condition that used to throw.
  const farFutureSeed = createInitialLocalLedgerState('2999-01-01');

  it('does not report a future-dated transaction as a validation issue', () => {
    const snapshot = createCanonicalMobileLedgerSnapshot(farFutureSeed);
    expect(snapshot.validation.issues.join(' ')).not.toContain('future fact');
  });

  it('builds the repository without throwing for future-dated rows', () => {
    expect(() => createCanonicalRepositoryForLocalLedgerState(farFutureSeed)).not.toThrow();
  });
});

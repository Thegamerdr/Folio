// AccountScreen — "Statements & receipts" source-row state (task: coherence-fix).
//
// Pure-logic coverage for `hasStatementSourceData`, the helper that replaced the old
// `subsCount + potsCount > 0` proxy (seed-data-shaped, never moved after a real import landed).
// Node-safe: no react-native runtime, no DOM — a plain `.test.ts` collected by the
// apps/**/*.test.ts runner.

import { describe, expect, it } from 'vitest';

import { hasStatementSourceData } from './accountSources';

describe('hasStatementSourceData', () => {
  it('is false when neither the import log nor the transaction ledger has anything', () => {
    expect(hasStatementSourceData(0, 0)).toBe(false);
  });

  it('is true once the statement-import log has at least one entry', () => {
    expect(hasStatementSourceData(1, 0)).toBe(true);
  });

  it('is true once real transactions exist, even with no import-log entry (back-compat fallback)', () => {
    // Covers a ledger that predates the statementImports field, or transactions added via a path
    // other than addStatementAsHistory (e.g. manual entry) — the row should still read as "added by
    // you", not "not yet".
    expect(hasStatementSourceData(0, 5)).toBe(true);
  });

  it('is true when both signals are present', () => {
    expect(hasStatementSourceData(3, 42)).toBe(true);
  });

  it('is unaffected by seed-shaped pots/subs counts — the old proxy this replaced does not apply', () => {
    // The old logic (`subsCount + potsCount > 0`) would have been true on the untouched demo seed.
    // This helper takes no pots/subs input at all, so a fresh demo install with zero real imports and
    // zero real transactions reads as "not yet" regardless of how many seed pots/subs exist.
    expect(hasStatementSourceData(0, 0)).toBe(false);
  });
});

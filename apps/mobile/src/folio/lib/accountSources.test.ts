// AccountScreen — "Statements & receipts" source-row state (task: coherence-fix).
//
// Pure-logic coverage for `hasStatementSourceData`, the helper that replaced the old
// `subsCount + potsCount > 0` proxy (seed-data-shaped, never moved after a real import landed).
// Node-safe: no react-native runtime, no DOM — a plain `.test.ts` collected by the
// apps/**/*.test.ts runner.

import { describe, expect, it } from 'vitest';

import { bankSourceHealth, hasStatementSourceData, importSourceSummary } from './accountSources';

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

describe('bankSourceHealth', () => {
  const active = {
    status: 'active' as const,
    expiresAt: '2026-11-01T00:00:00.000Z',
    lastSuccessfulRefreshAt: '2026-08-15T12:00:00.000Z',
    lastErrorCode: null,
  };

  it('separates fresh, stale and expired consent truth', () => {
    expect(bankSourceHealth(active, '2026-08-17T12:00:00.000Z').state).toBe('active');
    expect(
      bankSourceHealth(
        { ...active, lastSuccessfulRefreshAt: '2026-08-01T12:00:00.000Z' },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toMatchObject({ state: 'stale', usableForRefresh: true, needsAction: true });
    expect(
      bankSourceHealth(
        { ...active, expiresAt: '2026-08-16T12:00:00.000Z' },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toMatchObject({ state: 'reauth', usableForRefresh: false, needsAction: true });
  });

  it('does not call a disconnected or authorisation-failed source active', () => {
    expect(
      bankSourceHealth({ ...active, status: 'disconnected' }, '2026-08-17T12:00:00.000Z'),
    ).toMatchObject({ state: 'disconnected', usableForRefresh: false });
    expect(
      bankSourceHealth(
        { ...active, status: 'error', lastErrorCode: 'authorization_failed' },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toMatchObject({ state: 'reauth', usableForRefresh: false });
  });
});

describe('importSourceSummary', () => {
  it('counts only real imports, landed rows and retained source evidence', () => {
    expect(
      importSourceSummary(
        [
          { rowCount: 12, atISO: '2026-07-01T12:00:00.000Z' },
          { rowCount: 3, atISO: '2026-08-01T12:00:00.000Z' },
          {
            rowCount: 0,
            atISO: '2026-08-02T12:00:00.000Z',
            outcome: 'read-failed',
          },
          {
            rowCount: 0,
            atISO: '2026-08-03T12:00:00.000Z',
            outcome: 'already-present',
          },
        ],
        1,
      ),
    ).toEqual({
      importCount: 2,
      rowCount: 15,
      latestAt: '2026-08-01T12:00:00.000Z',
      retainedEvidenceCount: 1,
    });
  });
});

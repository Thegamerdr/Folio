import { describe, expect, it } from 'vitest';

import { getState } from '../store';
import { SHARED_WORKSPACE_STATE_KEYS, pickSharedWorkspaceState } from './sharedWorkspaceState';

describe('cross-workspace shared-state boundary', () => {
  it('allows only companion continuity and preferences to cross partitions', () => {
    expect(SHARED_WORKSPACE_STATE_KEYS).toEqual([
      'meloPrimerSeen',
      'meloPrimerBeat',
      'meloPrimerSeenAt',
      'oneMoveHistory',
      'meloMoves',
      'meloDismissLog',
      'meloMemoryThread',
      'meloForgottenMemoryIds',
      'melo',
      'chartStyle',
    ]);
  });

  it('never projects financial, source, review, filing, or account data', () => {
    const projected = pickSharedWorkspaceState(getState());
    for (const forbidden of [
      'accounts',
      'transactions',
      'currentBalance',
      'pots',
      'subs',
      'reviewQueue',
      'evidenceDocuments',
      'statementImports',
      'business',
      'stage',
      'streak',
    ]) {
      expect(projected).not.toHaveProperty(forbidden);
    }
  });
});

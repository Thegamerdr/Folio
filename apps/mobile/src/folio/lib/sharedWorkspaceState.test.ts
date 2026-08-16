import { describe, expect, it } from 'vitest';

import { getState } from '../store';
import { SHARED_WORKSPACE_STATE_KEYS, pickSharedWorkspaceState } from './sharedWorkspaceState';

describe('cross-workspace shared-state boundary', () => {
  it('allows only introduction acknowledgement and presentation preferences to cross partitions', () => {
    expect(SHARED_WORKSPACE_STATE_KEYS).toEqual([
      'meloPrimerSeen',
      'meloPrimerBeat',
      'meloPrimerSeenAt',
      'melo',
      'chartStyle',
    ]);
  });

  it('never projects nested financial companion history or ordinary workspace data', () => {
    const projected = pickSharedWorkspaceState({
      ...getState(),
      meloPrimerSeen: true,
      meloPrimerBeat: 2,
      meloPrimerSeenAt: '2026-08-16T12:00:00.000Z',
      melo: { quietMode: true, wardrobe: ['scarf'], tone: 'honest', soundEnabled: true },
      chartStyle: 'bars',
      oneMoveHistory: [{ key: 'recovery', shownAt: '2026-08-16' }],
      meloMoves: [
        {
          id: 'move-personal-money',
          createdAt: '2026-08-16T12:00:00.000Z',
          headline: 'Hold £40 today',
          kind: 'hold',
          amount: 40,
          targetId: 'personal-pot',
          status: 'accepted',
          baselinePathSpare: -25,
          baselineTightPoint: -80,
        },
      ],
      meloDismissLog: [{ kind: 'recovery', reason: 'not-now', at: '2026-08-16T12:01:00.000Z' }],
      meloMemoryThread: [
        {
          id: 'cycle-personal-july',
          at: '2026-07-31T12:00:00.000Z',
          kind: 'cadence',
          text: 'Closed July with £120 spare.',
          editable: true,
          source: 'observed',
        },
      ],
      meloForgottenMemoryIds: ['personal-forgotten-money-memory'],
    });

    expect(projected).toEqual({
      meloPrimerSeen: true,
      meloPrimerBeat: 2,
      meloPrimerSeenAt: '2026-08-16T12:00:00.000Z',
      melo: { quietMode: true, wardrobe: ['scarf'], tone: 'honest', soundEnabled: true },
      chartStyle: 'bars',
    });
    for (const forbidden of [
      'oneMoveHistory',
      'meloMoves',
      'meloDismissLog',
      'meloMemoryThread',
      'meloForgottenMemoryIds',
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

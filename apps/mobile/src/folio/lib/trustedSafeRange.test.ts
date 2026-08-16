import { beforeEach, describe, expect, it } from 'vitest';

import { createWorkspaceId } from '@folio/domain';

import {
  DEFAULT_ACCOUNT_ID,
  getState,
  resetToEmpty,
  type Account,
  type AppState,
  type CalendarEvent,
  type CurrentBalance,
  type IncomeSource,
  type Pot,
  type PotLedgerEntry,
  type ReviewItem,
  type Sub,
  type Transaction,
  type WhatIfHold,
} from '../store';
import {
  buildTrustedSafeRangeFromAppState,
  buildTrustedSafeRangeLegacyComparison,
} from './trustedSafeRange';

const NOW = '2026-07-20';
const NOW_INSTANT = '2026-07-20T10:00:00.000Z';

beforeEach(() => {
  resetToEmpty({ onboardingDone: true });
});

function account(balance: number, at = NOW_INSTANT): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    name: 'Main',
    kind: 'bank',
    isLiability: false,
    balanceMinor: balance,
    balanceAsOfISO: at,
    addedAt: at,
  };
}

function currentBalance(
  amount: number,
  source: CurrentBalance['source'] = 'user-entered',
  confidence: CurrentBalance['confidence'] = 'corrected',
  at = NOW_INSTANT,
): CurrentBalance {
  return { amount, source, confidence, setAt: at };
}

function bill(id: string, amount: number, date = '2026-07-22', note?: string): CalendarEvent {
  const event: CalendarEvent = {
    id,
    date,
    kind: amount >= 0 ? 'in' : 'out',
    title: id === 'rent' ? 'Rent' : id,
    amount,
  };
  if (note !== undefined) event.note = note;
  return event;
}

function history(): Transaction[] {
  return [
    {
      id: 'txn-may-rent',
      when: '2026-05-01T08:00:00.000Z',
      merchant: 'Rent',
      amount: -800,
      category: 'bills',
      source: 'manual',
    },
    {
      id: 'txn-jun-rent',
      when: '2026-06-01T08:00:00.000Z',
      merchant: 'Rent',
      amount: -800,
      category: 'bills',
      source: 'manual',
    },
  ];
}

function baseState(patch: Partial<AppState> = {}): AppState {
  const state = getState();
  return {
    ...state,
    schemaVersion: 16,
    onboarding: { done: true, name: 'Taylor', payday: 25, monthlyIncome: 2200 },
    currentBalance: currentBalance(2400),
    accounts: [account(2400)],
    transactions: [],
    subs: [],
    pots: [],
    potLedger: [],
    debts: [],
    incomeSources: [],
    calendarEvents: [bill('rent', -800)],
    reviewQueue: [],
    reviewQueueSpillover: [],
    readerCandidates: [],
    spendHold: null,
    whatIfHolds: [],
    ...patch,
  };
}

function findEvidenceNote(
  result: ReturnType<typeof buildTrustedSafeRangeFromAppState>,
  id: string,
) {
  return result.evidenceNotes.find((note) => note.id === id);
}

function findIssue(result: ReturnType<typeof buildTrustedSafeRangeFromAppState>, id: string) {
  return [...result.missingInputs, ...result.contradictions].find((item) => item.id === id);
}

function expectEvidence(result: ReturnType<typeof buildTrustedSafeRangeFromAppState>) {
  expect(result.calculatedAt).toBe('2026-07-20T12:00:00.000Z');
  expect(result.horizonStartISO).toBe(NOW);
  expect(result.horizonEndISO).toBe('2026-08-24');
  expect(result.sourceBreakdown.length).toBeGreaterThan(0);
  expect(result.evidenceNotes.length).toBeGreaterThan(0);
  expect(result.freshnessDetail.summary.length).toBeGreaterThan(0);
  expect(result.relianceDetail.label.length).toBeGreaterThan(0);
}

describe('Trusted Safe Range adapter — core complete states', () => {
  it('complete fresh data returns a ready deterministic range with truth, reliance, freshness and sources', () => {
    const state = baseState({ transactions: history() });
    const first = buildTrustedSafeRangeFromAppState(state, { now: NOW });
    const second = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(first).toEqual(second);
    expect(first.status).toBe('ready');
    expect(first.truthClass).toBe('user_confirmed');
    expect(first.reliance).toBe('safe_to_rely');
    expect(first).not.toHaveProperty('confidence');
    expect(first.freshness).toBe('fresh');
    expect(first.currentPosition.amount?.minorUnits).toBe(240000);
    expect(first.expectedRange.basis).toBe('exact_known_path');
    expect(first.expectedRange.min?.minorUnits).toBe(first.expectedRange.max?.minorUnits);
    expect(first.canUserRelyOnAnswer).toBe(true);
    expectEvidence(first);
  });

  it('user-entered balance is classified as user_confirmed and remains source-visible', () => {
    const result = buildTrustedSafeRangeFromAppState(baseState(), { now: NOW });

    expect(result.currentPosition.truthClass).toBe('user_confirmed');
    expect(findEvidenceNote(result, 'evidence_balance_user-entered')?.impact).toBe('supports');
    expect(result.sourceBreakdown.some((row) => row.factId === 'fact_current_balance')).toBe(true);
    expectEvidence(result);
  });

  it('statement-derived balance is observed and remains explicit in the source breakdown', () => {
    const state = baseState({
      currentBalance: currentBalance(2400, 'statement', 'statement-derived'),
      accounts: [account(2400)],
      transactions: history(),
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.currentPosition.truthClass).toBe('observed');
    expect(
      result.sourceBreakdown.find((row) => row.factId === 'fact_current_balance')?.truthClass,
    ).toBe('observed');
    expect(result.reliance).toBe('safe_to_rely');
    expect(result).not.toHaveProperty('confidence');
    expectEvidence(result);
  });

  it('sample/demo balance never becomes rely-on-able even when a number can be calculated', () => {
    const state = baseState({
      currentBalance: currentBalance(5000, 'sample', 'sample'),
      accounts: [account(5000)],
      transactions: history(),
      calendarEvents: [],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('sample_demo');
    expect(result.truthClass).toBe('sample_demo');
    expect(result.canUserRelyOnAnswer).toBe(false);
    expect(result.reliance).toBe('provisional');
    expect(result.nextAction?.id).toBe('replace_sample_data');
    expectEvidence(result);
  });
});

describe('Trusted Safe Range adapter — missing and stale data', () => {
  it('missing balance blocks the answer without inventing a range', () => {
    const state = baseState({
      currentBalance: currentBalance(0, 'user-entered', 'rough'),
      accounts: [account(0)],
      transactions: [],
      statementImports: [],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('insufficient_data');
    expect(result.truthClass).toBe('missing');
    expect(findIssue(result, 'missing_balance')?.severity).toBe('blocker');
    expect(result.canUserRelyOnAnswer).toBe(false);
    expect(result.nextAction?.id).toBe('complete_money_picture');
    expectEvidence(result);
  });

  it('missing payday blocks when income exists but no valid payday exists', () => {
    const state = baseState({
      onboarding: { done: true, name: 'Taylor', payday: 0, monthlyIncome: 2200 },
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('insufficient_data');
    expect(findIssue(result, 'missing_payday')?.severity).toBe('blocker');
    expect(findEvidenceNote(result, 'evidence_missing_payday')?.impact).toBe('blocks');
    expect(result.expectedRange.basis).toBe('unavailable');
  });

  it('missing income blocks when neither declaration nor history exists', () => {
    const state = baseState({
      onboarding: { done: true, name: 'Taylor', payday: 25, monthlyIncome: 0 },
      incomeSources: [],
      transactions: [],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('insufficient_data');
    expect(findIssue(result, 'missing_income')?.severity).toBe('blocker');
    expect(result.reliance).toBe('blocked');
  });

  it('missing material bill is recorded as caution rather than silently assuming no commitments', () => {
    const state = baseState({
      calendarEvents: [],
      subs: [],
      debts: [],
      pots: [],
      transactions: [],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('caution');
    expect(findIssue(result, 'missing_material_bill')?.severity).toBe('caution');
    expect(result.canUserRelyOnAnswer).toBe(false);
  });

  it('calculation errors become explicit blockers instead of guessed ranges', () => {
    const weeklyIncomeMissingAnchor: IncomeSource = {
      id: 'weekly_main',
      label: 'Weekly wage',
      cadence: 'weekly',
      amount: 500,
      source: 'manual',
    };
    const result = buildTrustedSafeRangeFromAppState(
      baseState({ incomeSources: [weeklyIncomeMissingAnchor] }),
      { now: NOW },
    );

    expect(result.status).toBe('insufficient_data');
    expect(findIssue(result, 'forecast_input_invalid')?.severity).toBe('blocker');
    expect(findIssue(result, 'missing_income_anchor_weekly_main')?.severity).toBe('blocker');
    expect(result.expectedRange.basis).toBe('unavailable');
    expect(result.canUserRelyOnAnswer).toBe(false);
  });

  it('stale source widens the range only from explicit daily-spend history', () => {
    const staleAt = '2026-07-01T00:00:00.000Z';
    const state = baseState({
      currentBalance: currentBalance(5000, 'user-entered', 'corrected', staleAt),
      accounts: [account(5000, staleAt)],
      transactions: history(),
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('stale');
    expect(result.freshness).toBe('stale');
    expect(result.freshnessDetail.affectedSourceIds).toContain('fact_current_balance');
    expect(result.expectedRange.basis).toBe('explicit_uncertainty');
    expect(
      result.expectedRange.uncertaintySources.some(
        (source) => source.id === 'uncertainty_stale_balance',
      ),
    ).toBe(true);
  });

  it('no daily-spend history is an explicit evidence note, not arbitrary padding', () => {
    const result = buildTrustedSafeRangeFromAppState(baseState(), { now: NOW });

    expect(findEvidenceNote(result, 'evidence_no_daily_spend_history')?.impact).toBe('limits');
    expect(
      result.expectedRange.uncertaintySources.some((source) => source.id.includes('daily_spend')),
    ).toBe(false);
  });
});

describe('Trusted Safe Range adapter — uncertainty and contradiction cases', () => {
  it('estimated variable bill widens the lower side from an explicit bill percentage source', () => {
    const state = baseState({
      calendarEvents: [bill('Energy', -120, '2026-07-23', 'Variable estimate')],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('caution');
    expect(result.expectedRange.basis).toBe('explicit_uncertainty');
    expect(
      result.expectedRange.uncertaintySources.some((source) =>
        source.id.includes('uncertainty_variable'),
      ),
    ).toBe(true);
  });

  it('contradicted balance sources block reliance and name the account mismatch', () => {
    const state = baseState({
      currentBalance: currentBalance(1000),
      accounts: [account(1500)],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('contradicted');
    expect(result.truthClass).toBe('contradicted');
    expect(findIssue(result, 'contradiction_current_balance_accounts')?.severity).toBe('blocker');
    expect(result.reliance).toBe('blocked');
  });

  it('contradicted recurring obligation blocks when duplicate subscription names carry different amounts', () => {
    const subs: Sub[] = [
      { name: 'Netflix', cost: 10, nextRenewalDaysAway: 2, lastUsedDaysAgo: 0, usesPerMonth: 2 },
      { name: 'Netflix', cost: 15, nextRenewalDaysAway: 2, lastUsedDaysAgo: 0, usesPerMonth: 2 },
    ];
    const result = buildTrustedSafeRangeFromAppState(baseState({ subs }), { now: NOW });

    expect(result.status).toBe('contradicted');
    expect(result.contradictions.some((item) => item.id.startsWith('contradiction_sub_'))).toBe(
      true,
    );
    expect(result.canUserRelyOnAnswer).toBe(false);
  });

  it('pending review candidates widen the range and route the one next action to Review', () => {
    const reviewQueue: ReviewItem[] = [
      {
        id: 'review-electric',
        source: 'pdf',
        merchant: 'Energy Co',
        amount: -95,
        date: '2026-07-21',
        addedAt: NOW_INSTANT,
      },
    ];
    const result = buildTrustedSafeRangeFromAppState(baseState({ reviewQueue }), { now: NOW });

    expect(result.status).toBe('caution');
    expect(result.expectedRange.uncertaintySources.map((source) => source.id)).toContain(
      'uncertainty_pending_review_outflows',
    );
    expect(result.nextAction?.id).toBe('review_pending_items');
    expect(result.nextAction?.route).toBe('review');
  });
});

describe('Trusted Safe Range adapter — obligations, pots, holds and shortfalls', () => {
  it('active debt minimum payments are added to the forecast drivers', () => {
    const state = baseState({
      debts: [
        {
          id: 'loan',
          name: 'Loan',
          kind: 'loan',
          balance: 2000,
          apr: 12.9,
          minPayment: 150,
          dueDom: 21,
          addedAt: NOW_INSTANT,
        },
      ],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.mainCauses.some((cause) => cause.label.includes('Loan minimum payment'))).toBe(
      true,
    );
    expect(result.sourceBreakdown.some((row) => row.factId === 'fact_debt_loan')).toBe(true);
  });

  it('pots reducing spendable cash lower the committed floor and appear as a cause', () => {
    const pots: Pot[] = [
      { id: 'holiday', name: 'Holiday', saved: 1000, goal: 1500, perWeek: 0, accent: true },
    ];
    const withoutPot = buildTrustedSafeRangeFromAppState(baseState({ pots: [] }), { now: NOW });
    const withPot = buildTrustedSafeRangeFromAppState(baseState({ pots }), { now: NOW });

    expect(withPot.knownCommittedFloor!.minorUnits).toBe(
      withoutPot.knownCommittedFloor!.minorUnits - 100000,
    );
    expect(withPot.mainCauses[0]?.label).toBe('Money already set aside in pots');
  });

  it('borrowed pot funds are carried as explicit downside uncertainty', () => {
    const potLedger: PotLedgerEntry[] = [
      {
        id: 'borrow-buffer',
        potId: 'buffer',
        at: NOW_INSTANT,
        kind: 'borrow',
        amount: 60,
        source: 'shortfall-borrow',
      },
    ];
    const result = buildTrustedSafeRangeFromAppState(baseState({ potLedger }), { now: NOW });

    expect(result.expectedRange.uncertaintySources.map((source) => source.id)).toContain(
      'uncertainty_borrowed_pot_funds',
    );
  });

  it('What If holds reduce the forecast and keep their hold source visible', () => {
    const whatIfHolds: WhatIfHold[] = [
      {
        id: 'school-shoes',
        amount: 120,
        recurrence: 'once',
        addedAt: NOW_INSTANT,
        label: 'School shoes',
      },
    ];
    const result = buildTrustedSafeRangeFromAppState(baseState({ whatIfHolds }), { now: NOW });

    expect(result.mainCauses.some((cause) => cause.label === 'School shoes')).toBe(true);
    expect(
      result.sourceBreakdown.some((row) => row.factId.includes('fact_hold_what-if-hold')),
    ).toBe(true);
  });

  it('recovery hold is included as a dated projected commitment', () => {
    const result = buildTrustedSafeRangeFromAppState(
      baseState({
        spendHold: {
          start: '2026-07-20',
          end: '2026-07-22',
          dailyCap: 40,
          setAt: NOW_INSTANT,
        },
      }),
      { now: NOW },
    );

    expect(result.mainCauses.some((cause) => cause.label.includes('Spend hold'))).toBe(true);
    expect(result.sourceBreakdown.some((row) => row.factId.includes('fact_hold_spend-hold'))).toBe(
      true,
    );
  });

  it('negative expected range returns shortfall with a positive shortfall amount', () => {
    const state = baseState({
      currentBalance: currentBalance(500),
      accounts: [account(500)],
      calendarEvents: [bill('rent', -900, '2026-07-21')],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('shortfall');
    expect(result.shortfall!.minorUnits).toBeGreaterThan(0);
    expect(result.expectedRange.min!.minorUnits).toBeLessThan(0);
  });

  it('imminent shortfall suggests Recovery as the one next action', () => {
    const state = baseState({
      currentBalance: currentBalance(300),
      accounts: [account(300)],
      calendarEvents: [bill('rent', -600, '2026-07-21')],
    });
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('shortfall');
    expect(result.tightestPoint.dateISO).toBe('2026-07-21');
    expect(result.nextAction?.id).toBe('open_recovery');
    expect(result.nextAction?.route).toBe('recovery');
  });
});

describe('Trusted Safe Range adapter — income cadence and date edge cases', () => {
  it('irregular income is represented through evidence notes and source rows', () => {
    const incomeSources: IncomeSource[] = [
      {
        id: 'weekly-wage',
        label: 'Weekly wage',
        cadence: 'weekly',
        anchorISO: '2026-07-18',
        amount: 500,
        source: 'manual',
      },
    ];
    const result = buildTrustedSafeRangeFromAppState(
      baseState({
        onboarding: { done: true, name: 'Taylor', payday: 25, monthlyIncome: 0 },
        incomeSources,
      }),
      { now: NOW },
    );

    expect(findEvidenceNote(result, 'evidence_irregular_income_cadence')?.impact).toBe('limits');
    expect(
      result.sourceBreakdown.some((row) => row.factId === 'fact_income_source_weekly-wage'),
    ).toBe(true);
  });

  it('multiple paydays are retained as multiple income sources instead of collapsed into one payday', () => {
    const incomeSources: IncomeSource[] = [
      {
        id: 'main-pay',
        label: 'Main pay',
        cadence: 'monthly',
        dayOfMonth: 25,
        amount: 1800,
        source: 'manual',
      },
      {
        id: 'side-pay',
        label: 'Side pay',
        cadence: 'weekly',
        anchorISO: '2026-07-18',
        amount: 150,
        source: 'manual',
      },
    ];
    const result = buildTrustedSafeRangeFromAppState(
      baseState({
        onboarding: { done: true, name: 'Taylor', payday: 25, monthlyIncome: 0 },
        incomeSources,
      }),
      { now: NOW },
    );

    expect(findEvidenceNote(result, 'evidence_multiple_paydays')?.impact).toBe('supports');
    expect(
      result.sourceBreakdown.filter((row) => row.factId.startsWith('fact_income_source_')),
    ).toHaveLength(2);
  });

  it('weekend payday adjustment keeps the range deterministic when payday lands on a Saturday', () => {
    const result = buildTrustedSafeRangeFromAppState(
      baseState({ onboarding: { done: true, name: 'Taylor', payday: 25, monthlyIncome: 2200 } }),
      { now: NOW },
    );

    expect(result.status).not.toBe('insufficient_data');
    expect(result.horizonStartISO).toBe('2026-07-20');
    expect(result.sourceBreakdown.some((row) => row.factId.includes('payday-2026-07-24'))).toBe(
      true,
    );
  });

  it('calendar-date overflow uses the payday clamp instead of rolling into an invalid date', () => {
    const result = buildTrustedSafeRangeFromAppState(
      baseState({
        onboarding: { done: true, name: 'Taylor', payday: 31, monthlyIncome: 2200 },
        calendarEvents: [bill('rent', -200, '2026-02-27')],
      }),
      { now: '2026-02-27' },
    );

    expect(result.horizonStartISO).toBe('2026-02-27');
    expect(result.sourceBreakdown.some((row) => row.factId.includes('payday-2026-02-27'))).toBe(
      true,
    );
    expect(result.expectedRange.min?.minorUnits).not.toBeNaN();
  });

  it('income after the tight point is named as a factor that could change the answer', () => {
    const incomeSources: IncomeSource[] = [
      {
        id: 'late-pay',
        label: 'Late pay',
        cadence: 'monthly',
        dayOfMonth: 28,
        amount: 2200,
        source: 'manual',
      },
    ];
    const result = buildTrustedSafeRangeFromAppState(
      baseState({
        currentBalance: currentBalance(1000),
        accounts: [account(1000)],
        onboarding: { done: true, name: 'Taylor', payday: 28, monthlyIncome: 0 },
        incomeSources,
        calendarEvents: [bill('rent', -900, '2026-07-21')],
      }),
      { now: NOW },
    );

    expect(result.tightestPoint.dateISO).toBe('2026-07-21');
    expect(result.wouldChangeIf).toContain('income lands after the current tight point');
  });
});

describe('Trusted Safe Range adapter — imports, transfers, migration and workspace boundaries', () => {
  it('pending refund widens the upside only from the explicit refund amount', () => {
    const result = buildTrustedSafeRangeFromAppState(
      baseState({
        calendarEvents: [
          bill('rent', -800, '2026-07-22'),
          bill('Council refund', 70, '2026-07-23', 'Pending refund'),
        ],
      }),
      { now: NOW },
    );

    expect(result.expectedRange.uncertaintySources.map((source) => source.id)).toContain(
      'uncertainty_pending_refund',
    );
    expect(result.expectedRange.max!.minorUnits).toBeGreaterThan(
      result.expectedRange.min!.minorUnits,
    );
  });

  it('transfer excluded records neutral transfer assumptions without treating them as spend', () => {
    const transactions: Transaction[] = [
      ...history(),
      {
        id: 'transfer-out',
        when: '2026-06-15T08:00:00.000Z',
        merchant: 'Transfer to savings',
        amount: -200,
        category: 'other',
        source: 'manual',
      },
      {
        id: 'transfer-in',
        when: '2026-06-15T08:05:00.000Z',
        merchant: 'Transfer from current',
        amount: 200,
        category: 'other',
        source: 'manual',
      },
    ];
    const result = buildTrustedSafeRangeFromAppState(baseState({ transactions }), { now: NOW });

    expect(result.assumptions).toContain(
      'matched transfer pairs are excluded from spend/income totals',
    );
    expect(result.sourceBreakdown.some((row) => row.factId === 'fact_current_balance')).toBe(true);
  });

  it('legacy Safe Zone migrated comparison reports a bounded temporary divergence result', () => {
    const comparison = buildTrustedSafeRangeLegacyComparison(baseState(), { now: NOW });

    expect(comparison.legacyTightestMinor).not.toBeNull();
    expect(comparison.trustedConservativeBoundaryMinor).not.toBeNull();
    expect(typeof comparison.material).toBe('boolean');
    expect(comparison.reason.length).toBeGreaterThan(0);
  });

  it('restored encrypted backup limits reliance without changing user-visible data', () => {
    const result = buildTrustedSafeRangeFromAppState(baseState(), {
      now: NOW,
      restoredFromEncryptedBackup: true,
    });

    expect(result.status).toBe('caution');
    expect(findIssue(result, 'restored_encrypted_backup')?.severity).toBe('caution');
    expect(findEvidenceNote(result, 'evidence_restored_backup')?.impact).toBe('limits');
  });

  it('old schema missing truth metadata is surfaced as a migration caution', () => {
    const result = buildTrustedSafeRangeFromAppState(baseState({ schemaVersion: 15 }), {
      now: NOW,
    });

    expect(result.status).toBe('caution');
    expect(findIssue(result, 'old_schema_missing_truth_metadata')?.severity).toBe('caution');
  });

  it('Business workspace accidentally passed is blocked by the Personal adapter boundary', () => {
    const base = baseState();
    const businessId = createWorkspaceId('workspace_business_acme');
    const state: AppState = {
      ...base,
      activeWorkspaceId: businessId,
      dataWorkspaceId: businessId,
      workspaces: [
        {
          ...base.workspaces[0]!,
          id: businessId,
          kind: 'business',
          name: 'ACME Ltd',
        },
      ],
    };
    const result = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(result.status).toBe('workspace_blocked');
    expect(result.reliance).toBe('blocked');
    expect(findIssue(result, 'personal_workspace_required')?.severity).toBe('blocker');
  });

  it('data materially changing during calculation only affects the changed snapshot, not prior results', () => {
    const state = baseState();
    const before = buildTrustedSafeRangeFromAppState(state, { now: NOW });
    const changed = {
      ...state,
      currentBalance: currentBalance(3000),
      accounts: [account(3000)],
    };
    const after = buildTrustedSafeRangeFromAppState(changed, { now: NOW });
    const beforeAgain = buildTrustedSafeRangeFromAppState(state, { now: NOW });

    expect(beforeAgain).toEqual(before);
    expect(after.currentKnownPosition!.minorUnits).not.toBe(
      before.currentKnownPosition!.minorUnits,
    );
  });

  it('empty new-user state is insufficient data and never sample-fills a trusted answer', () => {
    resetToEmpty({ onboardingDone: false });
    const result = buildTrustedSafeRangeFromAppState(getState(), { now: NOW });

    expect(result.status).toBe('insufficient_data');
    expect(result.expectedRange.basis).toBe('unavailable');
    expect(result.canUserRelyOnAnswer).toBe(false);
  });
});

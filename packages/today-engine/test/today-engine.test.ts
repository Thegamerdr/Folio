import { describe, expect, it } from 'vitest';

import { createFinancialExpectation, createTransaction } from '@folio/domain';

import {
  buildAccessibleVisualText,
  buildActualVarianceQuestion,
  buildInternalCalendarViews,
  buildMoneyTimelineProjection,
  buildPositionSummary,
  buildTimelineRows,
  buildTransactionDetailView,
  buildTransactionListView,
  planTasksAndReminders,
  rankBriefingCandidates,
  todayEngineBoundary,
} from '../src/index.js';

const syntheticBeforePaydayProjectionFixture = {
  asOf: '2026-06-20',
  nextIncomeDate: '2026-06-26',
  protectedFloorMinor: 10000,
  accounts: [
    {
      id: 'account_synthetic_current',
      label: 'Synthetic current account',
      balanceMinor: 100000,
    },
  ],
  cashflows: [
    {
      id: 'synthetic_rent',
      label: 'Synthetic rent',
      date: '2026-06-22',
      amountMinor: -73500,
      state: 'expected',
      protected: true,
    },
    {
      id: 'synthetic_utility',
      label: 'Synthetic utility',
      date: '2026-06-24',
      amountMinor: -9500,
      state: 'expected',
      protected: true,
    },
    {
      id: 'synthetic_overtime',
      label: 'Synthetic overtime',
      date: '2026-06-25',
      amountMinor: 20000,
      state: 'inferred',
    },
    {
      id: 'synthetic_salary',
      label: 'Synthetic salary',
      date: '2026-06-26',
      amountMinor: 58500,
      state: 'expected',
    },
  ],
  expected: {
    // Protected outflows are reserved exactly once via protectedFloorMinor, not
    // subtracted from the running balance again. Available = opening 100000 - floor 10000.
    availableBeforeNextIncomeMinor: 90000,
    // Both pre-payday outflows (rent, utility) are protected/reserved, so the lowest
    // pre-payday balance stays at the 100000 opening rather than dipping to 17000.
    minimumBeforeNextIncomeMinor: 100000,
    // Closing on payday is opening 100000 + salary 58500 (protected outflows not re-subtracted).
    closingOnNextIncomeDateMinor: 158500,
    excludedIds: ['synthetic_overtime'],
  },
} as const;

describe('today engine boundary', () => {
  it('declares a pure deterministic package boundary', () => {
    expect(todayEngineBoundary).toMatchObject({
      packageName: '@folio/today-engine',
      deterministic: true,
      importsNativeOrUiRuntime: false,
      importsDatabaseDriver: false,
      schedulesNotifications: false,
    });
  });
});

describe('briefing candidate ranking', () => {
  it('keeps urgent items and caps nonurgent briefing cards at three with explainable penalties', () => {
    const ranking = rankBriefingCandidates({
      asOf: '2026-06-21',
      maxNonurgentItems: 3,
      candidates: [
        {
          id: 'synthetic_variance_card',
          kind: 'variance',
          title: 'Synthetic amount changed',
          summary: 'A synthetic expected payment landed at a different amount.',
          urgency: 'urgent',
          eventDate: '2026-06-21',
          importance: 80,
          evidenceWeight: 0.9,
          reasonCodes: ['expected_actual_variance'],
          sourceIds: ['transaction_synthetic_variance_001'],
        },
        {
          id: 'synthetic_due_today_card',
          kind: 'task',
          title: 'Synthetic review due today',
          summary: 'A synthetic review task is due today.',
          dueDate: '2026-06-21',
          importance: 70,
        },
        {
          id: 'synthetic_calendar_card',
          kind: 'calendar',
          title: 'Synthetic calendar focus',
          summary: 'A synthetic calendar item is coming up.',
          dueDate: '2026-06-22',
          importance: 65,
          reasonCodes: ['calendar_focus'],
        },
        {
          id: 'synthetic_limited_evidence_card',
          kind: 'plan',
          title: 'Synthetic plan estimate',
          summary: 'A synthetic plan estimate has limited evidence.',
          dueDate: '2026-06-23',
          importance: 95,
          evidenceWeight: 0.6,
        },
        {
          id: 'synthetic_position_card',
          kind: 'position',
          title: 'Synthetic position risk',
          summary: 'A synthetic protected floor is close.',
          importance: 60,
          reasonCodes: ['position_risk'],
        },
        {
          id: 'synthetic_repeated_card',
          kind: 'reminder',
          title: 'Synthetic repeated reminder',
          summary: 'A synthetic reminder was already shown recently.',
          importance: 62,
          fatigueCount: 4,
          lastShownOn: '2026-06-21',
        },
      ],
    });

    expect(ranking.urgentCount).toBe(1);
    expect(ranking.nonurgentCount).toBe(3);
    expect(ranking.selected.map((item) => item.id)).toEqual([
      'synthetic_variance_card',
      'synthetic_due_today_card',
      'synthetic_limited_evidence_card',
      'synthetic_calendar_card',
    ]);
    expect(ranking.suppressedNonurgentIds).toEqual([
      'synthetic_position_card',
      'synthetic_repeated_card',
    ]);
    expect(ranking.selected[2]?.penalties.uncertaintyPenalty).toBeGreaterThan(0);
    expect(ranking.selected[2]?.reasonCodes).toContain('uncertainty_penalty');
    expect(ranking.selected[0]?.reasonCodes).toContain('expected_actual_variance');
  });
});

describe('position summary', () => {
  it('summarises account and planning inputs with assumptions and accessible text', () => {
    const summary = buildPositionSummary({
      asOf: '2026-06-21',
      currency: 'GBP',
      protectedFloorMinor: 20000,
      assumptions: ['Synthetic fixture assumes one workspace currency.'],
      accounts: [
        {
          id: 'synthetic_current_account',
          label: 'Synthetic current account',
          balance: { minorUnits: 100000, currency: 'GBP' },
          sourceId: 'balance_synthetic_current_001',
        },
        {
          id: 'synthetic_savings_account',
          label: 'Synthetic savings account',
          balance: { minorUnits: 50000, currency: 'GBP' },
          sourceId: 'balance_synthetic_savings_001',
        },
      ],
      cashflows: [
        {
          id: 'synthetic_actual_fee',
          label: 'Synthetic actual fee',
          date: '2026-06-21',
          amount: { minorUnits: -1200, currency: 'GBP' },
          state: 'actual',
        },
        {
          id: 'synthetic_expected_bill',
          label: 'Synthetic expected bill',
          date: '2026-06-22',
          amount: { minorUnits: -35000, currency: 'GBP' },
          state: 'expected',
          protected: true,
        },
        {
          id: 'synthetic_expected_income',
          label: 'Synthetic expected income',
          date: '2026-06-25',
          amount: { minorUnits: 80000, currency: 'GBP' },
          state: 'expected',
        },
      ],
    });

    expect(summary.openingBalanceMinor).toBe(150000);
    expect(summary.actualNetMinor).toBe(-1200);
    expect(summary.expectedNetMinor).toBe(45000);
    expect(summary.projectedClosingMinor).toBe(193800);
    expect(summary.availableMinor).toBe(173800);
    expect(summary.inputs.sourceIds).toEqual([
      'balance_synthetic_current_001',
      'balance_synthetic_savings_001',
    ]);
    expect(summary.assumptions).toContain('Synthetic fixture assumes one workspace currency.');
    expect(summary.accessibilityText).toContain('Position summary for 2026-06-21');
  });
});

describe('money timeline projection', () => {
  it('simulates before-payday availability from synthetic contract fixtures', () => {
    const fixture = syntheticBeforePaydayProjectionFixture;
    const projection = buildMoneyTimelineProjection({
      asOf: fixture.asOf,
      nextIncomeDate: fixture.nextIncomeDate,
      protectedFloorMinor: fixture.protectedFloorMinor,
      currency: 'GBP',
      accounts: fixture.accounts.map((account) => ({
        id: account.id,
        label: account.label,
        balance: { minorUnits: account.balanceMinor, currency: 'GBP' },
      })),
      cashflows: fixture.cashflows.map((cashflow) => ({
        id: cashflow.id,
        label: cashflow.label,
        date: cashflow.date,
        amount: { minorUnits: cashflow.amountMinor, currency: 'GBP' },
        state: cashflow.state,
        ...('protected' in cashflow ? { protected: cashflow.protected } : {}),
      })),
    });

    expect(projection.availableBeforeNextIncomeMinor).toBe(
      fixture.expected.availableBeforeNextIncomeMinor,
    );
    expect(projection.minimumBeforeNextIncomeMinor).toBe(
      fixture.expected.minimumBeforeNextIncomeMinor,
    );
    expect(projection.closingOnNextIncomeDateMinor).toBe(
      fixture.expected.closingOnNextIncomeDateMinor,
    );
    expect(projection.excludedIds).toEqual(fixture.expected.excludedIds);
    expect(projection.countedIds).toEqual([
      'synthetic_rent',
      'synthetic_utility',
      'synthetic_salary',
    ]);
    expect(projection.riskDetected).toBe(false);
  });

  it('uses protected outflow first on the same day so intraday risk is visible', () => {
    const projection = buildMoneyTimelineProjection({
      asOf: '2026-06-22',
      currency: 'GBP',
      // The protected rent is reserved via the floor (15000), not double-subtracted from
      // the running balance. Floor 0 would mean nothing is actually reserved for it.
      protectedFloorMinor: 15000,
      accounts: [
        {
          id: 'synthetic_current',
          label: 'Synthetic current',
          balance: { minorUnits: 10000, currency: 'GBP' },
        },
      ],
      cashflows: [
        {
          id: 'synthetic_pay',
          label: 'Synthetic pay',
          date: '2026-06-22',
          amount: { minorUnits: 20000, currency: 'GBP' },
          state: 'expected',
        },
        {
          id: 'synthetic_rent',
          label: 'Synthetic rent',
          date: '2026-06-22',
          amount: { minorUnits: -15000, currency: 'GBP' },
          state: 'expected',
          protected: true,
        },
      ],
    });

    // Protected-first ordering is unchanged: the protected outflow is still applied first.
    expect(projection.countedIds).toEqual(['synthetic_rent', 'synthetic_pay']);
    // Protected outflow is reserved, not subtracted: the low point is the 10000 opening,
    // not the old double-counted -5000.
    expect(projection.lowestMinor).toBe(10000);
    expect(projection.closingMinor).toBe(30000);
    // Risk is still visible, now for the correct reason: at the low point (10000) liquidity
    // sits below the 15000 reserved for the protected outflow.
    expect(projection.riskDetected).toBe(true);
  });

  it('does not double-count a protected outflow that the floor already reserves', () => {
    const projection = buildMoneyTimelineProjection({
      asOf: '2026-06-20',
      nextIncomeDate: '2026-06-26',
      protectedFloorMinor: 87500,
      currency: 'GBP',
      accounts: [
        {
          id: 'synthetic_current',
          label: 'Synthetic current',
          balance: { minorUnits: 120000, currency: 'GBP' },
        },
      ],
      cashflows: [
        {
          id: 'synthetic_protected_outflow',
          label: 'Synthetic protected outflow',
          date: '2026-06-22',
          amount: { minorUnits: -87500, currency: 'GBP' },
          state: 'expected',
          protected: true,
        },
        {
          id: 'synthetic_income',
          label: 'Synthetic income',
          date: '2026-06-26',
          amount: { minorUnits: 180000, currency: 'GBP' },
          state: 'expected',
        },
      ],
    });

    expect(projection.riskDetected).toBe(false);
    expect(projection.lowestMinor).toBeGreaterThanOrEqual(0);
  });
});

describe('timeline and internal calendar view models', () => {
  it('builds event-first rows that distinguish actual and expected entries', () => {
    const rows = buildTimelineRows({
      asOf: '2026-06-21',
      events: [
        {
          id: 'synthetic_expected_payment_event',
          title: 'Synthetic expected payment',
          localDate: '2026-06-21',
          localTime: '09:00:00',
          sourceKind: 'expectation',
          state: 'expected',
          amount: { minorUnits: -2500, currency: 'GBP' },
        },
        {
          id: 'synthetic_actual_payment_event',
          title: 'Synthetic actual payment',
          localDate: '2026-06-21',
          localTime: '09:00:00',
          sourceKind: 'transaction',
          state: 'actual',
          amount: { minorUnits: -2500, currency: 'GBP' },
        },
        {
          id: 'synthetic_future_task_event',
          title: 'Synthetic future task',
          localDate: '2026-06-22',
          sourceKind: 'task',
        },
      ],
    });

    expect(rows.map((row) => [row.id, row.eventState, row.timelinePosition])).toEqual([
      ['synthetic_actual_payment_event', 'actual', 'today'],
      ['synthetic_expected_payment_event', 'expected', 'today'],
      ['synthetic_future_task_event', 'expected', 'future'],
    ]);
    expect(rows[0]?.rowKind).toBe('event');
    expect(rows[1]?.accessibilityText).toContain('expected expectation');
  });

  it('builds Today, week, month and timeline models for the internal calendar', () => {
    const views = buildInternalCalendarViews({
      asOf: '2026-06-21',
      events: [
        {
          id: 'synthetic_actual_calendar_event',
          title: 'Synthetic actual calendar event',
          localDate: '2026-06-21',
          localTime: '10:00:00',
          sourceKind: 'transaction',
          state: 'actual',
          durationMinutes: 15,
        },
        {
          id: 'synthetic_expected_calendar_event',
          title: 'Synthetic expected calendar event',
          localDate: '2026-06-23',
          localTime: '11:30:00',
          sourceKind: 'calendar',
          state: 'expected',
          durationMinutes: 30,
        },
      ],
    });

    expect(views.calendarSystem).toBe('internal');
    expect(views.today.items).toHaveLength(1);
    expect(views.today.items[0]?.durationMinutes).toBe(15);
    expect(views.week.startDate).toBe('2026-06-15');
    expect(views.week.endDate).toBe('2026-06-21');
    expect(views.month.month).toBe('2026-06');
    expect(views.timeline.map((row) => row.id)).toEqual([
      'synthetic_actual_calendar_event',
      'synthetic_expected_calendar_event',
    ]);
  });
});

describe('transaction view models', () => {
  it('preserves transaction provenance, relationships and correction placeholders', () => {
    const transaction = createTransaction({
      id: 'transaction_synthetic_review_001',
      workspaceId: 'workspace_synthetic_home',
      accountId: 'account_synthetic_current',
      status: 'pending',
      amount: { minorUnits: -4250, currency: 'GBP' },
      localDate: '2026-06-21',
      sourceKind: 'csv',
      certainty: 'provider-reported',
      reviewStatus: 'needs_review',
      reference: 'SYNTHETIC-CSV-001',
      bookedAt: '2026-06-21T08:00:00Z',
      fulfils: 'expectation_synthetic_bill_001',
      transferLink: 'transfer_synthetic_pair_001',
      replacedBy: 'transaction_synthetic_review_002',
      description: 'Synthetic imported row',
      splits: [
        {
          id: 'split_synthetic_review_001',
          amount: { minorUnits: -4250, currency: 'GBP' },
          label: 'Synthetic split',
          categoryId: 'synthetic-category',
        },
      ],
    });

    const list = buildTransactionListView({
      transactions: [transaction],
      accountLabels: { account_synthetic_current: 'Synthetic current account' },
      sourceLabels: { csv: 'Synthetic CSV import' },
    });
    const detail = buildTransactionDetailView({
      transaction,
      accountLabels: { account_synthetic_current: 'Synthetic current account' },
      sourceLabels: { csv: 'Synthetic CSV import' },
    });

    expect(list.rows[0]?.provenance).toMatchObject({
      sourceKind: 'csv',
      sourceLabel: 'Synthetic CSV import',
      certainty: 'provider-reported',
      reviewStatus: 'needs_review',
      reference: 'SYNTHETIC-CSV-001',
    });
    expect(list.rows[0]?.correction).toMatchObject({
      placeholder: true,
      canCreateMutation: false,
      replacementTransactionId: 'transaction_synthetic_review_002',
      blockedReason: 'requires_transaction_write_adapter',
    });
    expect(detail.relationships).toMatchObject({
      fulfils: 'expectation_synthetic_bill_001',
      transferLink: 'transfer_synthetic_pair_001',
      replacedBy: 'transaction_synthetic_review_002',
    });
    expect(detail.splits[0]).toMatchObject({
      label: 'Synthetic split',
      amountMinor: -4250,
      categoryId: 'synthetic-category',
    });
  });
});

describe('task and reminder planning', () => {
  it('plans items and returns blocked notification scheduling metadata', () => {
    const planning = planTasksAndReminders({
      asOf: '2026-06-21',
      items: [
        {
          id: 'synthetic_overdue_task',
          kind: 'task',
          title: 'Synthetic overdue task',
          dueDate: '2026-06-20',
          dueTime: '10:00:00',
          priority: 'important',
          reminderOffsetMinutes: 60,
        },
        {
          id: 'synthetic_today_reminder',
          kind: 'reminder',
          title: 'Synthetic today reminder',
          dueDate: '2026-06-21',
          dueTime: '08:30:00',
          priority: 'normal',
          reminderOffsetMinutes: 30,
        },
        {
          id: 'synthetic_completed_task',
          kind: 'task',
          title: 'Synthetic completed task',
          dueDate: '2026-06-22',
          completed: true,
          reminderOffsetMinutes: 45,
        },
      ],
    });

    expect(planning.items.map((item) => [item.id, item.state])).toEqual([
      ['synthetic_overdue_task', 'overdue'],
      ['synthetic_today_reminder', 'today'],
      ['synthetic_completed_task', 'completed'],
    ]);
    expect(planning.notificationScheduling).toMatchObject({
      status: 'blocked',
      blockedBy: ['vault_or_runtime_integration', 'native_notification_adapter'],
      scheduleMutationsCreated: false,
    });
    expect(
      planning.notificationScheduling.requestedSchedules.map((request) => request.localDateTime),
    ).toEqual(['2026-06-20T09:00:00', '2026-06-21T08:00:00']);
  });
});

describe('actual variance questions and accessible visual text', () => {
  it('builds a bounded question when an actual transaction differs from an expectation', () => {
    const expected = createFinancialExpectation({
      id: 'expectation_synthetic_subscription_001',
      workspaceId: 'workspace_synthetic_home',
      localDate: '2026-06-21',
      amount: { minorUnits: -12000, currency: 'GBP' },
      reference: 'SYNTHETIC-SUBSCRIPTION',
    });
    const actual = createTransaction({
      id: 'transaction_synthetic_subscription_001',
      workspaceId: 'workspace_synthetic_home',
      accountId: 'account_synthetic_current',
      status: 'posted',
      amount: { minorUnits: -12350, currency: 'GBP' },
      localDate: '2026-06-21',
      sourceKind: 'manual',
      certainty: 'confirmed',
      fulfils: 'expectation_synthetic_subscription_001',
      description: 'Synthetic subscription actual',
    });

    const question = buildActualVarianceQuestion({ actual, expected });

    expect(question).toMatchObject({
      questionType: 'recurring_amount_variance',
      needsQuestion: true,
      expectedMinor: -12000,
      actualMinor: -12350,
    });
    expect(question.variance.minorUnits).toBe(-350);
    expect(question.answerOptions.map((option) => option.id)).toEqual([
      'accept_actual_once',
      'update_future_expectation',
      'mark_expected_paid_elsewhere',
      'needs_more_review',
    ]);
    expect(question.accessibilityText).toContain('Expected GBP -120.00; actual GBP -123.50');
  });

  it('creates text equivalents for visual-only values', () => {
    expect(
      buildAccessibleVisualText({
        label: 'Synthetic progress ring',
        valueText: '72 percent',
        trend: 'up',
        reviewState: 'confirmed',
        risk: 'low',
      }),
    ).toEqual({
      visualText:
        'Synthetic progress ring: 72 percent, trend up, review state confirmed, risk low.',
      accessibilityText:
        'Synthetic progress ring: 72 percent, trend up, review state confirmed, risk low.',
    });
  });
});

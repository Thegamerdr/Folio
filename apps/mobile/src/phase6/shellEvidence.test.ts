import { describe, expect, it } from 'vitest';

import {
  buildPhase6ShellEvidence,
  buildTransactionDetail,
  defaultPhase6ShellEvidence,
  formatMoney,
  phase6SyntheticCalendarItems,
  phase6SyntheticEvents,
  phase6SyntheticPosition,
  phase6SyntheticTasks,
  phase6SyntheticTransactions,
  searchPhase6Rows,
} from './shellEvidence';

describe('phase 6 shell evidence adapter', () => {
  it('exposes UI-ready gate metadata without native or screen ownership claims', () => {
    expect(defaultPhase6ShellEvidence.gate).toMatchObject({
      phase: 'phase6',
      slice: 'mobile-shell-evidence-adapter',
      owns: ['apps/mobile/src/phase6/**'],
      uiReady: true,
      screenIntegratedByThisSlice: false,
      nativeDependencies: false,
      realData: false,
      deviceNotificationIntegration: false,
      externalCalendarIntegration: false,
      fileOrCaptureIntegration: false,
      dashboardGridAssumption: false,
    });
    expect(defaultPhase6ShellEvidence.gate.evidenceAreas).toEqual([
      'today_briefing',
      'position_summary',
      'event_first_timeline',
      'transaction_metadata',
      'internal_calendar',
      'tasks_reminders',
      'notification_policy_copy',
      'variance_question',
      'search_rows',
      'accessible_visuals',
    ]);
  });

  it('keeps default fixtures synthetic-labelled and free of capture/storage claims', () => {
    const encoded = JSON.stringify(defaultPhase6ShellEvidence);
    const captureClaim = ['O', 'C', 'R'].join('');
    const protectedStoreClaim = ['v', 'a', 'u', 'l', 't'].join('');

    expect(encoded).toContain('Synthetic sample');
    expect(encoded).not.toContain(captureClaim);
    expect(encoded.toLowerCase()).not.toContain(protectedStoreClaim);
    expect(
      defaultPhase6ShellEvidence.timeline.every((row) => row.sourceLabel === 'Synthetic sample'),
    ).toBe(true);
    expect(
      defaultPhase6ShellEvidence.transactions.rows.every(
        (row) => row.sourceLabel === 'Synthetic sample',
      ),
    ).toBe(true);
  });

  it('builds a concise Today briefing without a dashboard-grid dependency', () => {
    const today = defaultPhase6ShellEvidence.today;

    expect(today.presentation).toBe('briefing_list');
    expect(today.dashboardGridRequired).toBe(false);
    expect(today.items).toHaveLength(3);
    expect(today.items.map((item) => item.title)).toEqual([
      'Rent comes before income',
      'Income expected this week',
      'Review rent sequence',
    ]);
    expect(today.screenReaderSummary).toContain('Today, 2026-06-21');
  });

  it('summarises position with signed money and chart text equivalents', () => {
    const position = defaultPhase6ShellEvidence.position;

    expect(position.availableNowLabel).toBe('GBP 720.00');
    expect(position.beforeIncomeLabel).toBe('-GBP 100.00');
    expect(position.afterIncomeLabel).toBe('GBP 1,750.00');
    expect(position.textEquivalent).toContain('Position chart.');
    expect(position.dataPoints.map((point) => point.statusLabel)).toEqual([
      'known',
      'derived',
      'expected',
    ]);
  });

  it('orders timeline rows by event date and distinguishes actual from expected items', () => {
    const timeline = defaultPhase6ShellEvidence.timeline;

    expect(timeline.map((row) => row.id)).toEqual([
      'synthetic_event_grocer_actual',
      'synthetic_event_today_review',
      'synthetic_event_rent_expected',
      'synthetic_event_income_expected',
      'synthetic_event_rent_variance',
    ]);
    expect(timeline[0]?.statusLabel).toBe('Actual');
    expect(timeline[2]?.statusLabel).toBe('Expected');
    expect(timeline[2]?.accessibilityLabel).toContain('Expected outgoing remains separate');
  });

  it('creates transaction list rows and detail metadata for screen routing', () => {
    const transactions = defaultPhase6ShellEvidence.transactions;
    const firstDetail = transactions.details[0];

    expect(transactions.rows).toHaveLength(2);
    expect(transactions.rows[0]).toMatchObject({
      id: 'synthetic_transaction_grocer',
      amountLabel: '-GBP 32.10',
      statusLabel: 'Actual transaction',
      sourceLabel: 'Synthetic sample',
    });
    expect(firstDetail?.metadataRows.map((row) => row.label)).toEqual([
      'Source',
      'Record type',
      'Posted',
      'Account',
      'Category',
      'Timeline link',
      'Note',
    ]);
    expect(firstDetail?.accessibilityLabel).toContain(
      'Timeline link: synthetic_event_grocer_actual',
    );
  });

  it('keeps internal calendar views complete and explicitly internal-only', () => {
    const views = defaultPhase6ShellEvidence.calendarViews;

    expect(views.map((view) => view.id)).toEqual(['today', 'week', 'month', 'timeline']);
    expect(views.every((view) => view.internalOnly)).toBe(true);
    expect(views.find((view) => view.id === 'today')?.rows).toHaveLength(1);
    expect(views.find((view) => view.id === 'month')?.rows).toHaveLength(4);
    expect(views.map((view) => view.copy).join(' ')).toContain('not connected by this shell');
  });

  it('models task and reminder rows without scheduling claims', () => {
    const taskSummary = defaultPhase6ShellEvidence.tasks;

    expect(taskSummary.openCountLabel).toBe('2 open');
    expect(taskSummary.rows.map((row) => row.reminderLabel)).toEqual([
      'In-app reminder',
      'In-app reminder',
      'Device alert copy available later',
    ]);
    expect(taskSummary.screenReaderSummary).toContain('In-app reminder only in this shell.');
    expect(taskSummary.screenReaderSummary).toContain('not connected by this shell');
  });

  it('provides notification policy copy with privacy-safe defaults', () => {
    const policy = defaultPhase6ShellEvidence.notificationPolicy;
    const safeCopy = [
      policy.defaultStateLabel,
      policy.permissionCopy,
      policy.lockScreenCopy,
      policy.inAppFallbackCopy,
      policy.dedupeCopy,
      ...policy.rows.flatMap((row) => [
        row.title,
        row.defaultLabel,
        row.limitLabel,
        row.exampleLabel,
      ]),
    ].join(' ');

    expect(policy.defaultStateLabel).toBe('Quiet by default');
    expect(policy.lockScreenCopy).toContain('hidden or generic');
    expect(policy.rows.find((row) => row.key === 'marketing')?.defaultLabel).toBe('Off by default');
    for (const forbidden of policy.forbiddenExamples) {
      expect(safeCopy).not.toContain(forbidden);
    }
  });

  it('builds a bounded variance question that proposes instead of directly writing', () => {
    const question = defaultPhase6ShellEvidence.varianceQuestion;

    expect(question.prompt).toBe(
      'Synthetic rent was GBP 30.00 higher than expected. What changed?',
    );
    expect(question.options.map((option) => option.id)).toEqual([
      'one_off_charge',
      'new_regular_amount',
      'service_fee',
      'not_sure',
    ]);
    expect(question.noDirectWriteCopy).toBe(
      'This creates a proposal for the linked rent expectation only.',
    );
  });

  it('returns accessible search rows across shell surfaces', () => {
    const allRows = searchPhase6Rows('');
    const rentRows = searchPhase6Rows('rent');

    expect(allRows).toHaveLength(defaultPhase6ShellEvidence.searchRows.length);
    expect(rentRows.length).toBeGreaterThan(0);
    expect(rentRows.every((row) => row.sourceLabel === 'Synthetic sample')).toBe(true);
    expect(rentRows.some((row) => row.destination.routeKey === 'timeline')).toBe(true);
    expect(rentRows.every((row) => row.accessibilityLabel.length > 0)).toBe(true);
  });

  it('exposes accessible visual proof with text alternatives and non-colour cues', () => {
    const proof = defaultPhase6ShellEvidence.accessibleVisuals;

    expect(proof.dashboardGridRequired).toBe(false);
    expect(proof.visuals).toHaveLength(2);
    expect(proof.visuals.every((visual) => visual.requiresMotion === false)).toBe(true);
    expect(proof.visuals[0]?.textEquivalent).toContain('Cash-flow chart.');
    expect(proof.visuals[0]?.dataRows.map((row) => row.label)).toEqual([
      'Available now',
      'Before income',
      'After income',
    ]);
    expect(proof.proofRows.map((row) => row.state)).toEqual(['ready', 'ready', 'ready', 'ready']);
  });

  it('can rebuild the complete projection from caller-provided synthetic fixtures', () => {
    const rebuilt = buildPhase6ShellEvidence({
      asOf: '2026-06-21',
      position: phase6SyntheticPosition,
      events: phase6SyntheticEvents,
      transactions: phase6SyntheticTransactions,
      calendarItems: phase6SyntheticCalendarItems,
      tasks: phase6SyntheticTasks,
      source: {
        kind: 'synthetic',
        label: 'Synthetic sample',
        description: 'Test fixture source.',
      },
    });

    expect(rebuilt.today.items[0]?.source.label).toBe('Synthetic sample');
    expect(rebuilt.searchRows).toHaveLength(defaultPhase6ShellEvidence.searchRows.length);
    expect(rebuilt.accessibleVisuals.visuals[1]?.textEquivalent).toBe(
      'Task progress chart. 1 of 3 synthetic tasks complete.',
    );
  });

  it('formats money and transaction detail helpers consistently', () => {
    expect(formatMoney(-3000, 'gbp')).toBe('-GBP 30.00');
    expect(buildTransactionDetail(phase6SyntheticTransactions[1]!).metadataRows[1]).toEqual({
      label: 'Record type',
      value: 'Pending review metadata',
    });
  });
});

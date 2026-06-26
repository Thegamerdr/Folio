import { validateMeloRenderableOutput } from '@folio/melo-policy';
import { describe, expect, it } from 'vitest';

import {
  createQuickEstimateThroughCanonicalRepository,
  recordRecoverySpendThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildLocalCalendarModel } from './localCalendarAdapter.js';
import { buildLocalRouteSummary, type LocalLedgerState } from './localLedger.js';
import { buildCompactMeloNote } from './localMeloPolicyAdapter.js';
import { buildLocalRecoverySpendScenarioPreview } from './localScenarioAdapter.js';
import { buildLocalTimelineModel } from './localTimelineAdapter.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';

const unsafeMeloCopy =
  /\b(?:guaranteed|score|streak|shame|investment advice|financial advice|best decision|best choice|failed|failure)\b|\byou should\b/iu;

describe('Recovery and Calendar Melo completion model', () => {
  it('keeps Calendar compact Melo notes policy-gated before display', () => {
    const calendarNote = buildCompactMeloNote({
      control: 'Tap a day, inspect sources, or add a reviewed commitment.',
      matters: 'Selected days show route impact before any new save.',
      noticed: '-£84.53 2026-07-01 is the tightest route point.',
    });

    expect(calendarNote.text).toContain('Melo noticed:');
    expect(calendarNote.text).toContain('Why it matters:');
    expect(calendarNote.text).toContain('Your control:');
    expect(validateMeloRenderableOutput(calendarNote.text).renderable).toBe(true);
    expect(calendarNote.text).not.toMatch(unsafeMeloCopy);

    const fallbackNote = buildCompactMeloNote({
      control: 'You should make the best decision now.',
      fallback: {
        control: 'Inspect sources before changing records.',
        matters: 'Calendar rows stay linked to records.',
        noticed: 'Melo checked the local route.',
      },
      matters: 'This is guaranteed to fix the month.',
      noticed: 'Melo has a financial advice answer.',
    });

    expect(fallbackNote.text).toBe(
      [
        'Melo noticed: Melo checked the local route.',
        'Why it matters: Calendar rows stay linked to records.',
        'Your control: Inspect sources before changing records.',
      ].join('\n'),
    );
    expect(fallbackNote.text).not.toMatch(unsafeMeloCopy);
  });

  it('keeps preview-only recovery separate until accepted recovery creates evidence', () => {
    const manual = recoveryStartingLedger();
    const routeBefore = buildLocalRouteSummary(manual);
    const preview = buildLocalRecoverySpendScenarioPreview(manual, routeBefore, {
      amountMinor: 12_500,
      label: 'Tyre',
    });
    const beforeAccept = createCanonicalRepositoryForLocalLedgerState(manual).snapshot();
    const accepted = recordRecoverySpendThroughCanonicalRepository(manual, {
      amountText: '125.00',
      kind: 'spend',
      title: 'Tyre',
    });
    const afterAccept = createCanonicalRepositoryForLocalLedgerState(accepted).snapshot();
    const routeAfter = buildLocalRouteSummary(accepted);
    const today = buildLocalTodayModel(accepted, routeAfter);
    const timeline = buildLocalTimelineModel(accepted);
    const calendar = buildLocalCalendarModel(accepted, routeAfter);
    const decision = afterAccept.collections.decisions.find(
      (record) => record.kind === 'accept-scenario',
    );
    const auditEntry = afterAccept.collections.auditLog.find(
      (record) => record.action === 'recovery_recorded',
    );

    expect(preview.writesImmediately).toBe(false);
    expect(beforeAccept.collections.decisions).toEqual([]);
    expect(beforeAccept.collections.auditLog).not.toContainEqual(
      expect.objectContaining({ action: 'recovery_recorded' }),
    );
    expect(beforeAccept.collections.scenarios).toEqual([]);
    expect(afterAccept.collections.transactions).toContainEqual(
      expect.objectContaining({ description: 'Tyre' }),
    );
    expect(afterAccept.collections.scenarios).toContainEqual(
      expect.objectContaining({
        status: 'accepted',
        title: expect.stringContaining('Tyre recorded from recovery preview'),
      }),
    );
    expect(decision).toMatchObject({
      kind: 'accept-scenario',
      summary: expect.stringContaining('Tyre recorded from recovery preview'),
    });
    expect(auditEntry).toMatchObject({
      action: 'recovery_recorded',
      actor: 'user',
    });
    expect(afterAccept.collections.planImpacts).toContainEqual(
      expect.objectContaining({
        changedRecordIds: expect.arrayContaining([String(decision?.id), String(auditEntry?.id)]),
        needsReview: true,
      }),
    );
    expect(today.whatChanged.items).toContainEqual(
      expect.objectContaining({
        category: 'plan',
        summary: expect.stringContaining('accepted recovery scenario'),
      }),
    );
    expect(timeline.events).toContainEqual(
      expect.objectContaining({
        kind: 'decision-record',
        title: 'accept scenario',
      }),
    );
    expect(timeline.events).toContainEqual(
      expect.objectContaining({
        detail: expect.stringContaining('recovery recorded'),
        kind: 'audit-change',
        title: 'recovery recorded',
      }),
    );
    expect(calendar.agenda).toContainEqual(
      expect.objectContaining({
        detail: 'Recovery follow-up',
        kind: 'recovery',
      }),
    );
  });
});

function recoveryStartingLedger(): LocalLedgerState {
  return createQuickEstimateThroughCanonicalRepository('2026-06-22', {
    billAmountText: '875.00',
    billDate: '2026-07-01',
    billTitle: 'Rent',
    cashNowText: '1190.47',
    incomeAmountText: '1840.00',
    incomeDate: '2026-06-27',
    incomeTitle: 'Payday',
  });
}

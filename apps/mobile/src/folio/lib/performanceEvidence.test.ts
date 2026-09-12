import { describe, expect, it } from 'vitest';
import { estimateScaleBenchmark } from '../../../../../packages/storage/src/scale';
import { calculateFinancialPlan, type FinancialDebt } from '../../../../../packages/finance-engine/src/financialPlan';
import { buildDecisionHistoryRows } from './reviewHistory';
import { buildTimelineRows } from './timelineEvents';
import { selectDebtTrackingPresentation } from './debtTrackingPresentation';
import type { Debt, TimelineEvent, Transaction } from '../store';

/**
 * Local measurement only. This deliberately reports elapsed time and invariant
 * counts without defining a performance budget. It exercises the same plan and
 * debt selectors used by the native screens with deterministic small cases.
 */
const CASE_SIZES = [1, 4, 8] as const;
const NOW = new Date('2026-09-12T12:00:00Z');

function debt(index: number): FinancialDebt {
  return {
    id: `perf-debt-${index}`,
    name: `Synthetic debt ${index}`,
    balanceMinor: (100 + index) * 100,
    aprBps: 0,
    minimumPaymentMinor: 1_000,
    dueDate: `2026-09-${String((index % 20) + 1).padStart(2, '0')}`,
    dueDayOfMonth: (index % 20) + 1,
  };
}

describe('local performance evidence harness', () => {
  it('reports deterministic multi-account and debt-plan measurements', () => {
    const measurements = CASE_SIZES.map((size) => {
      const debts = Array.from({ length: size }, (_, index) => debt(index));
      const startedAt = performance.now();
      const accounts = Object.fromEntries(
        Array.from({ length: size }, (_, index) => [`account-${index}`, (2_000 + index * 17) * 100]),
      );
      const plan = calculateFinancialPlan({
        asOf: '2026-09-12',
        accounts,
        debts,
        bufferMinor: 0,
        nextIncomeDate: '2026-09-25',
        horizonEndDate: '2026-10-31',
      });
      const elapsedMs = performance.now() - startedAt;
      expect(plan.currentBalanceMinor).toBe(Object.values(accounts).reduce((sum, amount) => sum + amount, 0));
      expect(plan.events.filter((event) => event.source === 'debt-minimum').length).toBeGreaterThanOrEqual(size);

      return {
        accounts: size,
        debts: size,
        planEvents: plan.events.length,
        pendingObligations: plan.pendingObligations.length,
        selectorElapsedMs: Number(elapsedMs.toFixed(3)),
      };
    });

    const historyMeasurements = [10, 100, 1_000].map((size) => {
      const transactions: Transaction[] = Array.from({ length: size }, (_, index) => ({
        id: `perf-payment-${index}`,
        merchant: `Synthetic debt payment ${index}`,
        when: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
        amount: -10,
        category: 'bills',
        source: 'manual',
        accountId: `account-${index % 4}`,
        financialAction: {
          kind: 'debt-payment',
          debtId: `perf-debt-${index % 8}`,
          principalAppliedMinor: 1_000,
        },
      }));
      const events: TimelineEvent[] = Array.from({ length: Math.floor(size / 10) }, (_, index) => ({
        id: `perf-debt-event-${index}`,
        at: `2026-02-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
        kind: index % 2 === 0 ? 'debt-removed' : 'debt-restored',
        subject: `Synthetic debt ${index}`,
      }));
      const trackedDebts: Debt[] = Array.from({ length: 8 }, (_, index) => ({
        id: `perf-debt-${index}`,
        name: `Synthetic debt ${index}`,
        kind: 'card',
        balance: 100 + index,
        apr: 0,
        minPayment: 10,
        dueDom: (index % 20) + 1,
        addedAt: '2026-09-01',
      }));
      const input: Parameters<typeof buildTimelineRows>[0] = { transactions, edits: [], events };
      const trackingInput: Parameters<typeof selectDebtTrackingPresentation>[0] = {
        debts: trackedDebts,
        transactions,
        timelineEvents: events,
      };
      buildTimelineRows(input);
      buildDecisionHistoryRows(input);
      selectDebtTrackingPresentation(trackingInput);
      const samplesMs: number[] = [];
      for (let sample = 0; sample < 5; sample += 1) {
        const startedAt = performance.now();
        const timeline = buildTimelineRows(input);
        const decisions = buildDecisionHistoryRows(input);
        const tracking = selectDebtTrackingPresentation(trackingInput);
        samplesMs.push(Number((performance.now() - startedAt).toFixed(3)));
        expect(timeline).toHaveLength(size + events.length);
        expect(decisions).toHaveLength(size + events.length);
        expect(tracking.active).toHaveLength(trackedDebts.length);
      }
      const sorted = [...samplesMs].sort((left, right) => left - right);
      return {
        historyRecords: size,
        debtEvents: events.length,
        timelineRows: size + events.length,
        decisionRows: size + events.length,
        activeDebts: trackedDebts.length,
        rawSamplesMs: samplesMs,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        rangeMs: [sorted[0], sorted.at(-1)],
      };
    });

    const scaleEstimates = CASE_SIZES.map((size) => estimateScaleBenchmark({
      workspaceCount: 1,
      accountCount: size,
      transactionCount: size * 10,
      eventCount: size * 5,
      documentCount: 0,
      searchIndexEntryCount: size,
      backgroundJobCount: 0,
      forecastDayCount: 35,
    }));
    console.log(JSON.stringify({ harness: 'local-performance-evidence-v2', measurements, historyMeasurements, scaleEstimates }));
  });
});

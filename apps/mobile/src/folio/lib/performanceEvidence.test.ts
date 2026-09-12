import { describe, expect, it } from 'vitest';
import { estimateScaleBenchmark } from '../../../../../packages/storage/src/scale';
import { calculateFinancialPlan, type FinancialDebt } from '../../../../../packages/finance-engine/src/financialPlan';

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
      const plan = calculateFinancialPlan({
        asOf: '2026-09-12',
        accounts: Object.fromEntries(Array.from({ length: size }, (_, index) => [`account-${index}`, 2_000 * 100])),
        debts,
        bufferMinor: 0,
        nextIncomeDate: '2026-09-25',
        horizonEndDate: '2026-10-31',
      });
      const elapsedMs = performance.now() - startedAt;
      const estimate = estimateScaleBenchmark({
        workspaceCount: 1,
        accountCount: size,
        transactionCount: size * 10,
        eventCount: size * 5,
        documentCount: 0,
        searchIndexEntryCount: size,
        backgroundJobCount: 0,
        forecastDayCount: 35,
      });

      expect(plan.events.filter((event) => event.source === 'debt-minimum').length).toBeGreaterThanOrEqual(size);

      return {
        accounts: size,
        debts: size,
        planEvents: plan.events.length,
        pendingObligations: plan.pendingObligations.length,
        selectorElapsedMs: Number(elapsedMs.toFixed(3)),
        estimatedRows: estimate.estimatedRows,
        estimatedTodayQueryMs: estimate.estimatedTodayQueryMs,
        estimatedSearchQueryMs: estimate.estimatedSearchQueryMs,
        estimateRisk: estimate.risk,
      };
    });

    console.log(JSON.stringify({ harness: 'local-performance-evidence-v1', measurements }));
  });
});

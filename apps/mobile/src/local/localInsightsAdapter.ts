import type { CycleRecord } from '@folio/domain';

import { formatMinorAmount, type LocalLedgerState } from './localLedger.js';
import { buildLocalPotsModel } from './localPotsAdapter.js';

// The four headline numbers the Insights screen leads with. Each carries the raw minor figure plus a
// pre-formatted label so the screen renders without re-deriving money formatting.
export type LocalInsightsKpis = Readonly<{
  savedAcrossCyclesMinor: number;
  savedAcrossCycles: string;
  inPotsNowMinor: number;
  inPotsNow: string;
  avgTightPointMinor: number;
  avgTightPoint: string;
  avgSetAsideMinor: number;
  avgSetAside: string;
}>;

// One point on the tight-point trend line. The series is ordered oldest -> newest so a chart can
// read it left to right.
export type LocalInsightsTrendPoint = Readonly<{
  label: string;
  tightPointMinor: number;
  tightPoint: string;
}>;

export type LocalInsightsModel = Readonly<{
  sourceLabel: string;
  kpis: LocalInsightsKpis;
  // Up to the last 6 closed cycles' tight points, newest last.
  trend: readonly LocalInsightsTrendPoint[];
  cycleCount: number;
  accessibilitySummary: string;
}>;

const TREND_MAX_POINTS = 6;

export function buildLocalInsightsModel(
  ledger: LocalLedgerState,
  options: Readonly<{ privateExampleMode?: boolean }> = {},
): LocalInsightsModel {
  // Cycles are prepended newest-first on LocalLedgerState; Insights reads them oldest-first.
  const cyclesOldestFirst = [...ledger.cycles].reverse();
  const cycleCount = cyclesOldestFirst.length;

  const savedAcrossCyclesMinor = cyclesOldestFirst.reduce(
    (total, cycle) => total + cycle.setAside.minorUnits,
    0,
  );
  const inPotsNowMinor = buildLocalPotsModel(ledger, options).sumSavedMinor;
  const avgTightPointMinor = averageMinor(
    cyclesOldestFirst.map((cycle) => cycle.tightPoint.minorUnits),
  );
  const avgSetAsideMinor = averageMinor(cyclesOldestFirst.map((cycle) => cycle.setAside.minorUnits));

  const trend = cyclesOldestFirst.slice(-TREND_MAX_POINTS).map(createTrendPoint);

  return {
    sourceLabel: options.privateExampleMode ? 'Private example' : 'Local personal workspace',
    kpis: {
      savedAcrossCyclesMinor,
      savedAcrossCycles: formatMinorAmount(savedAcrossCyclesMinor),
      inPotsNowMinor,
      inPotsNow: formatMinorAmount(inPotsNowMinor),
      avgTightPointMinor,
      avgTightPoint: formatMinorAmount(avgTightPointMinor),
      avgSetAsideMinor,
      avgSetAside: formatMinorAmount(avgSetAsideMinor),
    },
    trend,
    cycleCount,
    accessibilitySummary: `${cycleCount} closed cycle${
      cycleCount === 1 ? '' : 's'
    }, ${formatMinorAmount(savedAcrossCyclesMinor)} set aside across them.`,
  };
}

function createTrendPoint(cycle: CycleRecord): LocalInsightsTrendPoint {
  return {
    label: cycle.label,
    tightPointMinor: cycle.tightPoint.minorUnits,
    tightPoint: formatMinorAmount(cycle.tightPoint.minorUnits),
  };
}

// Whole-penny mean. Empty input averages to 0 so KPIs read cleanly before any cycle is closed.
function averageMinor(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

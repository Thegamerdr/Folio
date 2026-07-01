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
// read it left to right. `provisional` marks the still-open current cycle: a live projection rather
// than a closed-cycle fact, so the screen can frame it honestly ("this cycle so far", not history).
export type LocalInsightsTrendPoint = Readonly<{
  label: string;
  tightPointMinor: number;
  tightPoint: string;
  provisional?: boolean;
}>;

export type LocalInsightsModel = Readonly<{
  sourceLabel: string;
  kpis: LocalInsightsKpis;
  // Up to the last 6 closed cycles' tight points, newest last. Before any cycle is closed this
  // carries a single PROVISIONAL point seeded from the live route (the current cycle's projected
  // lowest balance) so a brand-new user sees their real low point rather than an empty chart.
  trend: readonly LocalInsightsTrendPoint[];
  // How many cycles the user has actually CLOSED — stays honest (0 before the first payday ritual),
  // even when the trend shows a provisional current-cycle point.
  cycleCount: number;
  // True when the trend leads with the still-open current cycle (no closed history yet). Lets the
  // screen label the figures as "this cycle so far" instead of implying settled history.
  hasOnlyCurrentCycle: boolean;
  accessibilitySummary: string;
}>;

// The live current cycle, threaded from the container so Insights can show real data before the
// first payday ritual closes anything. `tightestBalanceMinor` is the route's projected lowest
// balance (signed: negative = a dip below zero); we read its magnitude to match closed cycles, which
// store tightPoint as Math.abs(...). `label` is the current month (e.g. "June").
export type LocalInsightsCurrentCycle = Readonly<{
  label: string;
  tightestBalanceMinor: number;
}>;

const TREND_MAX_POINTS = 6;

export function buildLocalInsightsModel(
  ledger: LocalLedgerState,
  options: Readonly<{
    privateExampleMode?: boolean;
    currentCycle?: LocalInsightsCurrentCycle;
  }> = {},
): LocalInsightsModel {
  // Cycles are prepended newest-first on LocalLedgerState; Insights reads them oldest-first.
  const cyclesOldestFirst = [...ledger.cycles].reverse();
  const cycleCount = cyclesOldestFirst.length;

  const savedAcrossCyclesMinor = cyclesOldestFirst.reduce(
    (total, cycle) => total + cycle.setAside.minorUnits,
    0,
  );
  const inPotsNowMinor = buildLocalPotsModel(ledger, options).sumSavedMinor;

  // The current cycle's projected lowest, as a non-negative magnitude (closed cycles store tightPoint
  // the same way). Only present once the container threads the live route in. This is a real, live
  // figure — never fabricated — so we surface it as the provisional first data point.
  const currentTightPointMinor =
    options.currentCycle !== undefined
      ? Math.abs(options.currentCycle.tightestBalanceMinor)
      : undefined;
  const hasOnlyCurrentCycle = cycleCount === 0 && currentTightPointMinor !== undefined;

  // KPIs average over closed cycles. Before any cycle closes, seed the "average low balance" from the
  // live current-cycle low so a new user sees their real projected dip, not £0. Set-aside still has no
  // honest history-free analogue, so it stays 0 until a cycle is actually closed.
  const avgTightPointMinor = hasOnlyCurrentCycle
    ? (currentTightPointMinor as number)
    : averageMinor(cyclesOldestFirst.map((cycle) => cycle.tightPoint.minorUnits));
  const avgSetAsideMinor = averageMinor(
    cyclesOldestFirst.map((cycle) => cycle.setAside.minorUnits),
  );

  const trend = buildTrend(cyclesOldestFirst, options.currentCycle, currentTightPointMinor);

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
    hasOnlyCurrentCycle,
    accessibilitySummary: hasOnlyCurrentCycle
      ? `No cycles closed yet. This cycle's projected low is ${formatMinorAmount(
          currentTightPointMinor as number,
        )}.`
      : `${cycleCount} closed cycle${
          cycleCount === 1 ? '' : 's'
        }, ${formatMinorAmount(savedAcrossCyclesMinor)} set aside across them.`,
  };
}

// Closed history leads. The current cycle only appears as a trailing PROVISIONAL point while no
// cycle is closed yet — once real cycles exist they carry the trend on their own (a still-open cycle
// is never a closed fact, so we don't append it to settled history and double-count it).
function buildTrend(
  cyclesOldestFirst: readonly CycleRecord[],
  currentCycle: LocalInsightsCurrentCycle | undefined,
  currentTightPointMinor: number | undefined,
): readonly LocalInsightsTrendPoint[] {
  if (cyclesOldestFirst.length > 0) {
    return cyclesOldestFirst.slice(-TREND_MAX_POINTS).map(createTrendPoint);
  }
  if (currentCycle === undefined || currentTightPointMinor === undefined) {
    return [];
  }
  return [
    {
      label: currentCycle.label,
      tightPointMinor: currentTightPointMinor,
      tightPoint: formatMinorAmount(currentTightPointMinor),
      provisional: true,
    },
  ];
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

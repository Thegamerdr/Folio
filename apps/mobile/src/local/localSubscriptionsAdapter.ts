import type { Subscription, SubscriptionCadence } from '@folio/domain';

import { formatMinorAmount, isQuietSubscription, type LocalLedgerState } from './localLedger.js';

// Months per cadence period, for normalizing a per-cadence cost to a per-month figure. Weekly uses
// 52 weeks / 12 months so a £10/week sub reads as ~£43.33/mo (not £10/mo); yearly divides by 12.
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

// Old snapshots predate the cadence field. Default missing cadence to 'monthly' so existing data
// still reads (cost is then taken at face value, the historical behaviour).
function cadenceOf(subscription: Subscription): SubscriptionCadence {
  return subscription.cadence ?? 'monthly';
}

// Normalize a per-cadence cost to integer-minor pence per month. Round explicitly to whole pence so
// the money path never carries a float.
function monthlyMinorFor(cadence: SubscriptionCadence, costMinor: number): number {
  if (cadence === 'weekly') return Math.round((costMinor * WEEKS_PER_YEAR) / MONTHS_PER_YEAR);
  if (cadence === 'yearly') return Math.round(costMinor / MONTHS_PER_YEAR);
  return costMinor;
}

// A coarse "are you getting your money's worth?" signal, derived purely from usage:
//  - 'yes'   you use it regularly
//  - 'maybe' you use it occasionally
//  - 'no'    it has gone quiet
export type LocalSubscriptionPulse = 'yes' | 'maybe' | 'no';

export type LocalSubscriptionRow = Readonly<{
  id: string;
  name: string;
  // The amount charged each cadence period, formatted (e.g. "£10.00" for £10/week). The row can show
  // this alongside its cadence ("£10 / week"). Totals and value comparisons use monthlyMinor instead.
  cost: string;
  costMinor: number;
  cadence: SubscriptionCadence;
  // The cost normalized to whole pence per month, so a weekly/yearly sub sums and compares fairly.
  monthlyMinor: number;
  nextRenewalDaysAway: number;
  lastUsedDaysAgo: number;
  usesPerMonth: number;
  paused: boolean;
  // Pence per use this month. Lower is better value. With zero uses there is no value at all, so the
  // score is the worst possible (Number.POSITIVE_INFINITY) and the screen can sort it to the top.
  valueScore: number;
  valueScoreLabel: string;
  pulse: LocalSubscriptionPulse;
  quiet: boolean;
}>;

export type LocalSubscriptionsModel = Readonly<{
  sourceLabel: string;
  rows: readonly LocalSubscriptionRow[];
  // Monthly cost of every active (not paused) subscription — the recurring drain figure.
  monthlyTotalMinor: number;
  monthlyTotal: string;
  // How much monthly cost is currently held back because subscriptions are paused.
  savedFromPausesMinor: number;
  savedFromPauses: string;
  activeCount: number;
  pausedCount: number;
  quietActiveCount: number;
  accessibilitySummary: string;
}>;

const PULSE_REGULAR_MIN_USES_PER_MONTH = 4;
const PULSE_OCCASIONAL_MIN_USES_PER_MONTH = 1;

export function buildLocalSubscriptionsModel(
  ledger: LocalLedgerState,
  options: Readonly<{ privateExampleMode?: boolean }> = {},
): LocalSubscriptionsModel {
  const rows = ledger.subscriptions.map(createSubscriptionRow);
  // Totals are the recurring MONTHLY drain, so they sum the per-month-normalized figure — never the
  // raw per-cadence cost (which would treat £10/week and £10/month as identical).
  const monthlyTotalMinor = rows
    .filter((row) => !row.paused)
    .reduce((total, row) => total + row.monthlyMinor, 0);
  const savedFromPausesMinor = rows
    .filter((row) => row.paused)
    .reduce((total, row) => total + row.monthlyMinor, 0);
  const activeCount = rows.filter((row) => !row.paused).length;
  const pausedCount = rows.length - activeCount;
  const quietActiveCount = rows.filter((row) => !row.paused && row.quiet).length;

  return {
    sourceLabel: options.privateExampleMode ? 'Private example' : 'Local personal workspace',
    rows,
    monthlyTotalMinor,
    monthlyTotal: formatMinorAmount(monthlyTotalMinor),
    savedFromPausesMinor,
    savedFromPauses: formatMinorAmount(savedFromPausesMinor),
    activeCount,
    pausedCount,
    quietActiveCount,
    accessibilitySummary: `${activeCount} active subscription${
      activeCount === 1 ? '' : 's'
    } costing ${formatMinorAmount(monthlyTotalMinor)} a month, ${quietActiveCount} quiet.`,
  };
}

function createSubscriptionRow(subscription: Subscription): LocalSubscriptionRow {
  const costMinor = subscription.cost.minorUnits;
  const cadence = cadenceOf(subscription);
  const monthlyMinor = monthlyMinorFor(cadence, costMinor);
  // Value-per-use is judged on the monthly cost, so weekly/yearly subs are compared on the same basis.
  const valueScore =
    subscription.usesPerMonth <= 0
      ? Number.POSITIVE_INFINITY
      : monthlyMinor / subscription.usesPerMonth;

  return {
    id: String(subscription.id),
    name: subscription.name,
    cost: formatMinorAmount(costMinor),
    costMinor,
    cadence,
    monthlyMinor,
    nextRenewalDaysAway: subscription.nextRenewalDaysAway,
    lastUsedDaysAgo: subscription.lastUsedDaysAgo,
    usesPerMonth: subscription.usesPerMonth,
    paused: subscription.paused,
    valueScore,
    valueScoreLabel: valueScoreLabel(valueScore),
    pulse: pulseFromUsage(subscription.usesPerMonth),
    quiet: isQuietSubscription(subscription),
  };
}

function pulseFromUsage(usesPerMonth: number): LocalSubscriptionPulse {
  if (usesPerMonth >= PULSE_REGULAR_MIN_USES_PER_MONTH) return 'yes';
  if (usesPerMonth >= PULSE_OCCASIONAL_MIN_USES_PER_MONTH) return 'maybe';
  return 'no';
}

function valueScoreLabel(valueScore: number): string {
  if (!Number.isFinite(valueScore)) return 'Not used this month';
  return `${formatMinorAmount(Math.round(valueScore))} per use`;
}

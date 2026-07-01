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
//  - 'yes'     you use it regularly
//  - 'maybe'   you use it occasionally
//  - 'no'      it has gone quiet (we have logged use before, and it has since fallen silent)
//  - 'unknown' we have never logged a use, so we genuinely don't know yet — this is NOT "quiet"
export type LocalSubscriptionPulse = 'yes' | 'maybe' | 'no' | 'unknown';

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
  // Whether the user has ever logged a use for this subscription. A just-added subscription, or one
  // they have simply never tapped "used" on, is UNtracked: we have no usage signal, so we cannot
  // honestly call it good or bad value. Only tracked subscriptions carry a meaningful value verdict.
  tracked: boolean;
  // Pence per use this month — an internal usage ratio, NOT a rendered trust/value verdict (the
  // shipping subscriptions surface shows payment facts only). Only meaningful when `tracked` is true.
  // A tracked subscription that has fallen to zero uses takes the worst possible ratio
  // (Number.POSITIVE_INFINITY); an UNtracked subscription is deliberately given a neutral 0 so it can
  // never pose as worst value purely for lacking data — the screen reads its `tracked: false` and
  // shows honest "not tracked yet" copy instead of a value verdict. Retained for the model/tests.
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
  const tracked = isTracked(subscription);
  // The usage ratio is computed on the monthly cost, so weekly/yearly subs are compared on the same
  // basis. We only compute it for subscriptions we have usage signal for. An untracked subscription
  // gets a neutral 0, so it never sorts to the top purely for lacking data; a tracked subscription
  // with zero uses takes the worst possible ratio. This is an internal field, never a rendered verdict.
  const valueScore = !tracked
    ? 0
    : subscription.usesPerMonth <= 0
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
    tracked,
    valueScore,
    valueScoreLabel: valueScoreLabel(tracked, valueScore),
    pulse: tracked ? pulseFromUsage(subscription.usesPerMonth) : 'unknown',
    // A subscription we have never tracked is unknown, not "quiet" — it must not be swept up by the
    // value/pulse system or the bulk "pause the quiet ones" move. Only tracked subscriptions can be quiet.
    quiet: tracked && isQuietSubscription(subscription),
  };
}

// "Tracked" means the user has given us at least one usage signal for this subscription: either they
// have logged a use this month (usesPerMonth > 0) or there is a recorded last-used point in its
// history (lastUsedDaysAgo > 0). A just-added subscription — and any subscription the user has simply
// never tapped "used" on — sits at usesPerMonth 0 / lastUsedDaysAgo 0: we have no signal, so we treat
// its value as unknown rather than pretending it is the worst.
function isTracked(subscription: Subscription): boolean {
  return subscription.usesPerMonth > 0 || subscription.lastUsedDaysAgo > 0;
}

function pulseFromUsage(usesPerMonth: number): LocalSubscriptionPulse {
  if (usesPerMonth >= PULSE_REGULAR_MIN_USES_PER_MONTH) return 'yes';
  if (usesPerMonth >= PULSE_OCCASIONAL_MIN_USES_PER_MONTH) return 'maybe';
  return 'no';
}

function valueScoreLabel(tracked: boolean, valueScore: number): string {
  if (!tracked) return 'Not tracked yet';
  if (!Number.isFinite(valueScore)) return 'Not used this month';
  return `${formatMinorAmount(Math.round(valueScore))} per use`;
}

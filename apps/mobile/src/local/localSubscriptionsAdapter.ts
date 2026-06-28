import type { Subscription } from '@folio/domain';

import { formatMinorAmount, isQuietSubscription, type LocalLedgerState } from './localLedger.js';

// A coarse "are you getting your money's worth?" signal, derived purely from usage:
//  - 'yes'   you use it regularly
//  - 'maybe' you use it occasionally
//  - 'no'    it has gone quiet
export type LocalSubscriptionPulse = 'yes' | 'maybe' | 'no';

export type LocalSubscriptionRow = Readonly<{
  id: string;
  name: string;
  cost: string;
  costMinor: number;
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
  const monthlyTotalMinor = rows
    .filter((row) => !row.paused)
    .reduce((total, row) => total + row.costMinor, 0);
  const savedFromPausesMinor = rows
    .filter((row) => row.paused)
    .reduce((total, row) => total + row.costMinor, 0);
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
  const valueScore =
    subscription.usesPerMonth <= 0 ? Number.POSITIVE_INFINITY : costMinor / subscription.usesPerMonth;

  return {
    id: String(subscription.id),
    name: subscription.name,
    cost: formatMinorAmount(costMinor),
    costMinor,
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

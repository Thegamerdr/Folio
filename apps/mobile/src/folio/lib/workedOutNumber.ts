import type { BusinessRunway } from '@folio/business-workspace';
import { addDaysToLocalDate, createLocalDate, type TrustedSafeRangeResult } from '@folio/domain';

import type { ScreenId } from '../types';

export type WorkedNumberLine = Readonly<{
  label: string;
  value: string;
  detail?: string;
  tone?: 'normal' | 'positive' | 'caution';
}>;

export type WorkedNumberCorrection = Readonly<{
  label: string;
  route: ScreenId;
  detail: string;
}>;

export type WorkedNumberBreakdown = Readonly<{
  eyebrow: string;
  title: string;
  answer: string;
  answerDetail: string;
  equation: string;
  window: string;
  inputs: readonly WorkedNumberLine[];
  assumptions: readonly string[];
  sources: readonly string[];
  freshness: string;
  limits: readonly string[];
  corrections: readonly WorkedNumberCorrection[];
}>;

export function formatWorkedMoney(minor: number | null): string {
  if (minor === null || !Number.isFinite(minor)) return 'Unavailable';
  const absolute = Math.abs(minor) / 100;
  const rendered = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: Number.isInteger(absolute) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(absolute);
  return minor < 0 ? `−${rendered}` : rendered;
}

function moneyMinor(value: { minorUnits: number } | null): number | null {
  return value?.minorUnits ?? null;
}

function rangeLabel(result: TrustedSafeRangeResult): string {
  const min = moneyMinor(result.expectedRange.min);
  const max = moneyMinor(result.expectedRange.max);
  if (min === null || max === null) return 'Unavailable';
  return min === max
    ? formatWorkedMoney(min)
    : `${formatWorkedMoney(min)} to ${formatWorkedMoney(max)}`;
}

function formatWindowDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : iso;
}

export function buildSafeRangeBreakdown(result: TrustedSafeRangeResult): WorkedNumberBreakdown {
  const current = moneyMinor(result.currentKnownPosition);
  const floor = moneyMinor(result.knownCommittedFloor);
  const movement = current !== null && floor !== null ? floor - current : null;
  const min = moneyMinor(result.expectedSafeMin);
  const max = moneyMinor(result.expectedSafeMax);
  const conservative = moneyMinor(result.conservativeBoundary);
  const uncertaintyLines = result.expectedRange.uncertaintySources.map((source) => ({
    label: source.label,
    value: formatWorkedMoney(source.amount.minorUnits),
    detail:
      source.direction === 'widens_down'
        ? 'Can lower the safe edge'
        : source.direction === 'widens_up'
          ? 'Can raise the upper edge'
          : 'Can widen both edges',
  }));
  const explicitAssumptions = result.assumptions.length
    ? result.assumptions
    : ['No additional assumptions are recorded for this calculation.'];
  const basis =
    result.expectedRange.basis === 'exact_known_path'
      ? 'The expected range follows the exact known path; no uncertainty band was added.'
      : result.expectedRange.basis === 'explicit_uncertainty'
        ? 'The range includes the uncertainty items listed above.'
        : 'The range is withheld because the known inputs are not sufficient.';
  const blockers = [...result.contradictions, ...result.missingInputs].map((item) => item.label);

  return {
    eyebrow: 'Worked-out number',
    title: 'Trusted Safe Range',
    answer: rangeLabel(result),
    answerDetail: result.relianceDetail.label,
    equation:
      current !== null && movement !== null && floor !== null
        ? `${formatWorkedMoney(current)} ${movement < 0 ? '−' : '+'} ${formatWorkedMoney(
            Math.abs(movement),
          )} = ${formatWorkedMoney(floor)} known floor`
        : 'The known floor cannot be calculated until the missing source is corrected.',
    window: `${formatWindowDate(result.horizonStartISO)} to ${formatWindowDate(
      result.horizonEndISO,
    )}`,
    inputs: [
      {
        label: 'Current known position',
        value: formatWorkedMoney(current),
        detail: result.currentPosition.label,
      },
      {
        label: 'Net confirmed movement',
        value: formatWorkedMoney(movement),
        detail: 'Confirmed money in and out across the window',
        tone: movement !== null && movement < 0 ? 'caution' : 'normal',
      },
      {
        label: 'Known committed floor',
        value: formatWorkedMoney(floor),
        detail: result.committedFloor.label,
      },
      {
        label: 'Expected lower edge',
        value: formatWorkedMoney(min),
        detail: 'After explicit uncertainty',
      },
      {
        label: 'Expected upper edge',
        value: formatWorkedMoney(max),
        detail: 'After explicit uncertainty',
      },
      {
        label: 'Conservative boundary used',
        value: formatWorkedMoney(conservative),
        detail: 'The cautious edge Melo should rely on',
      },
      ...uncertaintyLines,
    ],
    assumptions: [...explicitAssumptions, basis],
    sources: result.sourceBreakdown.map(
      (source) =>
        `${source.label} · ${source.truthClass.replaceAll('_', ' ')} · ${source.freshness}`,
    ),
    freshness: `${result.freshnessDetail.summary} Calculated ${new Date(
      result.calculatedAt,
    ).toLocaleString('en-GB')}.`,
    limits: blockers.length ? blockers : ['No material missing or conflicting inputs were found.'],
    corrections: [
      {
        label: 'Correct account balances',
        route: 'money-sources',
        detail: 'Add, edit, hide or restore the account feeding the starting position.',
      },
      {
        label: 'Correct dates and commitments',
        route: 'calendar',
        detail: 'Change the timing of money due in or out.',
      },
      {
        label: 'Review imported evidence',
        route: 'review',
        detail: 'Confirm or correct statement-derived money facts.',
      },
    ],
  };
}

export function buildBusinessRunwayBreakdown(
  runway: BusinessRunway,
  nowISO: string,
  sourceCounts: Readonly<{ accounts: number; invoices: number; obligations: number }>,
): WorkedNumberBreakdown {
  const netMovement = runway.incoming30Minor - runway.outgoing30Minor;
  const projectedCash = runway.cashMinor + netMovement;
  const endISO = addDaysToLocalDate(createLocalDate(nowISO.slice(0, 10)), 29);
  const dailyBurnEquation = Math.max(
    0,
    Math.round((runway.outgoing30Minor - runway.incoming30Minor) / 30),
  );
  const answer =
    runway.daysLeft === null
      ? 'No net cash burn'
      : runway.daysLeft === 1
        ? '1 day'
        : `${runway.daysLeft} days`;

  return {
    eyebrow: 'Worked-out number',
    title: 'Business cash runway',
    answer,
    answerDetail: runway.runsOutOn
      ? `Cash reaches zero around ${formatWindowDate(runway.runsOutOn)} on the current 30-day burn.`
      : "Confirmed incoming is covering the current 30-day outgoing, so a run-out date isn't shown.",
    equation: `${formatWorkedMoney(runway.cashMinor)} + ${formatWorkedMoney(
      runway.incoming30Minor,
    )} − ${formatWorkedMoney(runway.outgoing30Minor)} = ${formatWorkedMoney(
      projectedCash,
    )} after 30 days`,
    window: `${formatWindowDate(nowISO)} to ${formatWindowDate(endISO)} for burn; the path extends to 90 days`,
    inputs: [
      { label: 'Open cash accounts', value: formatWorkedMoney(runway.cashMinor) },
      {
        label: 'Outstanding invoices due in 30 days',
        value: formatWorkedMoney(runway.incoming30Minor),
        tone: 'positive',
      },
      {
        label: 'Recurring obligations due in 30 days',
        value: formatWorkedMoney(runway.outgoing30Minor),
        tone: 'caution',
      },
      {
        label: 'Net 30-day movement',
        value: formatWorkedMoney(netMovement),
        tone: netMovement < 0 ? 'caution' : 'positive',
      },
      { label: 'Projected cash after 30 days', value: formatWorkedMoney(projectedCash) },
      {
        label: 'Average daily net burn',
        value: formatWorkedMoney(runway.dailyBurnMinor),
        detail: `${formatWorkedMoney(runway.outgoing30Minor)} − ${formatWorkedMoney(
          runway.incoming30Minor,
        )}, divided by 30 = ${formatWorkedMoney(dailyBurnEquation)}`,
      },
    ],
    assumptions: [
      'Only open, non-liability accounts contribute to starting cash.',
      'Outstanding invoices are counted on their due date; paid, void and credited amounts are excluded.',
      'A recurring draft invoice contributes 70% of its outstanding amount until it is issued.',
      'Recurring obligations are expanded from their saved amount, cadence and next due date.',
      'Days left is whole starting cash divided by average daily net burn, rounded down.',
    ],
    sources: [
      `${sourceCounts.accounts} account${sourceCounts.accounts === 1 ? '' : 's'}`,
      `${sourceCounts.invoices} invoice${sourceCounts.invoices === 1 ? '' : 's'}`,
      `${sourceCounts.obligations} recurring obligation${
        sourceCounts.obligations === 1 ? '' : 's'
      }`,
    ],
    freshness: `Recalculated from the current business workspace records when this sheet opened (${new Date(
      `${nowISO.slice(0, 10)}T12:00:00.000Z`,
    ).toLocaleDateString('en-GB')}).`,
    limits: [
      'Unexpected card spending, tax changes and invoices not yet recorded are not guessed.',
      'The 30-day average is a planning aid; the 90-day path still uses each recorded due date.',
    ],
    corrections: [
      {
        label: 'Correct cash accounts',
        route: 'account',
        detail: 'Update, close or restore the account feeding starting cash.',
      },
      {
        label: 'Correct money due in',
        route: 'business-invoices',
        detail: 'Change invoice amount, status or due date.',
      },
      {
        label: 'Correct money due out',
        route: 'business-obligations',
        detail: 'Change obligation amount, cadence or next due date.',
      },
    ],
  };
}

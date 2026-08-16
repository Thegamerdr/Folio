import {
  businessDeadlines,
  calculateSelfAssessmentSummary,
  calculateVatBoxes,
  corporationTaxMinor,
  outstandingInvoiceMinor,
  type BusinessOperationsState,
} from '@folio/business-workspace';

import { calculateBusinessSetAsideCoverage, type BusinessStageInput } from './stage';

const DAY_MS = 86_400_000;
const REBIRTH_WINDOW_MS = 6 * 60 * 60 * 1000;

export type BusinessMeloSignals = {
  stageInput: BusinessStageInput;
  runwayDays: number | null;
  overdueInvoiceCount: number;
};

export function deriveBusinessMeloSignals(input: {
  business: BusinessOperationsState;
  runwayDays: number | null;
  quietMode: boolean;
  cleanStreakWeeks: number;
  now: Date;
}): BusinessMeloSignals {
  const { business, now } = input;
  const today = localDateKey(now);
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  const outstanding = business.invoices.filter((invoice) => outstandingInvoiceMinor(invoice) > 0);
  const overdue = outstanding.filter((invoice) => invoice.dueOn < today);
  const overdueThirtyDays = overdue.filter(
    (invoice) => Math.floor((todayMs - dateKeyMs(invoice.dueOn)) / DAY_MS) >= 30,
  );

  const vatDueNext =
    business.vatReturns
      .filter((item) => !item.filedExternallyOn)
      .sort((left, right) => left.dueOn.localeCompare(right.dueOn))
      .map((item) => Math.max(0, calculateVatBoxes(item).box5Minor))[0] ?? 0;
  const corpTaxDueNext =
    business.entity?.kind === 'ltd' ? corporationTaxMinor(business.ytdProfitMinor) : 0;
  const saDueNext =
    business.entity?.kind === 'sole-trader'
      ? calculateSelfAssessmentSummary(business, business.entity).amountDueMinor
      : 0;
  const setAsideCoverage = calculateBusinessSetAsideCoverage({
    vatPotBalance: business.vatPotMinor,
    corpTaxPotBalance: business.ctPotMinor,
    saPotBalance: business.saPotMinor,
    vatDueNext,
    corpTaxDueNext,
    saDueNext,
  });

  const statutoryDates = statutoryFilingDates(business, now);
  const nextDeadlineDaysAway =
    statutoryDates.length === 0
      ? null
      : Math.min(...statutoryDates.map((date) => Math.round((dateKeyMs(date) - todayMs) / DAY_MS)));
  const latestBeatAt = latestSignatureBeatAt(business, now);
  const hoursSinceFilingOrPaid =
    latestBeatAt === null ? null : (now.getTime() - latestBeatAt) / (60 * 60 * 1000);

  return {
    stageInput: {
      quietMode: input.quietMode,
      runwayDays: input.runwayDays,
      overdueInvoiceCount: overdue.length,
      overdueInvoice30DayCount: overdueThirtyDays.length,
      nextDeadlineDaysAway,
      setAsideCoverage,
      cleanStreakWeeks: input.cleanStreakWeeks,
      hoursSinceFilingOrPaid,
    },
    runwayDays: input.runwayDays,
    overdueInvoiceCount: overdue.length,
  };
}

function statutoryFilingDates(state: BusinessOperationsState, now: Date): string[] {
  const dates = businessDeadlines(state, { now, withinDays: 3_650 })
    .filter(
      (item) =>
        item.kind === 'vat' ||
        item.kind === 'self-assessment' ||
        item.kind === 'confirmation-statement',
    )
    .map((item) => item.date);

  if (state.entity?.kind === 'ltd') {
    const period = `Year ending ${state.entity.yearEnd}`;
    const ct600Submitted = state.filings.some(
      (item) =>
        item.kind === 'corporation-tax' &&
        item.period === period &&
        item.status === 'submitted-external',
    );
    if (!ct600Submitted) dates.push(addUtcYears(state.entity.yearEnd, 1));
  }

  if (state.entity?.kind === 'sole-trader') {
    dates.push(...mtdItsaDates(now));
  }

  // PAYE RTI is intentionally absent until the Business model persists an
  // actual payday/submission deadline. A generic obligation or month-end is
  // not silently treated as a statutory RTI filing.
  return dates.filter(isDateKey);
}

function latestSignatureBeatAt(state: BusinessOperationsState, now: Date): number | null {
  const candidates = [
    ...state.filings
      .map((item) => item.submittedExternallyAt)
      .filter((value): value is string => typeof value === 'string'),
    ...state.memory.filter((item) => item.kind === 'invoice-paid').map((item) => item.at),
  ]
    .map((value) => Date.parse(value))
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value <= now.getTime() &&
        now.getTime() - value <= REBIRTH_WINDOW_MS,
    );
  return candidates.length === 0 ? null : Math.max(...candidates);
}

/**
 * MTD ITSA quarterly update deadlines current from 16 July 2026.
 * Source: https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates
 */
function mtdItsaDates(now: Date): string[] {
  const dates: string[] = [];
  const year = now.getUTCFullYear();
  const today = Date.parse(`${localDateKey(now)}T00:00:00.000Z`);
  for (const candidateYear of [year, year + 1]) {
    for (const [month, day] of [
      [8, 7],
      [11, 7],
      [2, 7],
      [5, 7],
    ] as const) {
      dates.push(new Date(Date.UTC(candidateYear, month - 1, day)).toISOString().slice(0, 10));
    }
  }
  return dates
    .filter((date) => dateKeyMs(date) >= today)
    .sort()
    .slice(0, 4);
}

function addUtcYears(value: string, years: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function localDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateKeyMs(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dateKeyMs(value));
}

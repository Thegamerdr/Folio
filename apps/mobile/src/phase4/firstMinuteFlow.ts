import {
  bottomNavDestinations,
  buildQuickStartProjection,
  firstLaunchDataPaths,
  phase4TaskStatuses,
  syntheticPreviewTimeline,
  type BottomNavDestinationId,
  type FirstLaunchDataPathId,
  type QuickStartProjection,
  type SyntheticPreviewEventKind,
} from '@folio/first-minute';

export type DataPathId = FirstLaunchDataPathId;

export type NavigationDestinationId = BottomNavDestinationId;

export type QuickStartInput = Readonly<{
  availableNow: string;
  nextIncomeAmount: string;
  nextIncomeDate: string;
  outgoingAmount: string;
  outgoingDate: string;
  outgoingLabel: string;
}>;

export type QuickStartResult = Readonly<{
  projection: QuickStartProjection | null;
  availableNowMinor: number;
  nextIncomeMinor: number;
  outgoingMinor: number;
  beforeIncomeMinor: number;
  afterIncomeMinor: number;
  isOutgoingBeforeIncome: boolean;
  warnings: readonly string[];
}>;

export type SyntheticDemoEvent = Readonly<{
  label: string;
  amountMinor: number;
  timing: string;
  kind: 'fact' | 'expected' | 'hypothetical' | 'result';
}>;

export const defaultQuickStartInput: QuickStartInput = {
  availableNow: '720.00',
  nextIncomeAmount: '1850.00',
  nextIncomeDate: '2026-06-28',
  outgoingAmount: '820.00',
  outgoingDate: '2026-06-25',
  outgoingLabel: 'Rent',
};

export const dataPathChoices = firstLaunchDataPaths.map((choice) => ({
  id: choice.id,
  title: choice.label,
  body: choice.valuePromise,
  status:
    choice.id === 'import_statement'
      ? 'No permission upfront'
      : choice.id === 'quick_start_three_facts'
        ? 'Incomplete but useful'
        : 'Clearly labelled demo',
}));

export const navigationDestinations = bottomNavDestinations.map((destination) => ({
  id: destination.id,
  label: destination.label,
  status:
    destination.id === 'today'
      ? 'briefing'
      : destination.id === 'timeline'
        ? 'events'
        : destination.id === 'money'
          ? 'records'
          : destination.id === 'plans'
            ? 'optional'
            : 'planner',
}));

export const syntheticDemoEvents: readonly SyntheticDemoEvent[] =
  syntheticPreviewTimeline.events.map((event) => ({
    label: event.label,
    amountMinor: event.amount.minorUnits,
    timing: event.date.slice(5),
    kind: mapSyntheticEventKind(event.kind),
  }));

export const syntheticDemoAfterHypotheticalMinor =
  syntheticPreviewTimeline.result.afterHypotheticalMinor;

export const phase4ProofRows = phase4TaskStatuses.map((task) => ({
  label: `${task.id} ${task.area}`,
  value:
    task.state === 'blocked_by_native_key'
      ? (task.nativeKeyRequirement?.summary ?? task.acceptance)
      : task.acceptance,
  state: task.state,
}));

export function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [majorPart = '0', minorPart = ''] = normalized.split('.');
  const sign = majorPart.startsWith('-') ? -1 : 1;
  const absoluteMajor = Math.abs(Number.parseInt(majorPart, 10));
  const paddedMinor = (minorPart + '00').slice(0, 2);
  return sign * (absoluteMajor * 100 + Number.parseInt(paddedMinor, 10));
}

export function evaluateQuickStart(input: QuickStartInput): QuickStartResult {
  const availableNowMinor = parseMoneyInput(input.availableNow);
  const nextIncomeMinor = parseMoneyInput(input.nextIncomeAmount);
  const outgoingMinor = parseMoneyInput(input.outgoingAmount);
  const warnings: string[] = [];

  if (availableNowMinor === null) {
    warnings.push('Available now must be a pounds-and-pence amount.');
  }
  if (nextIncomeMinor === null) {
    warnings.push('Next income must be a pounds-and-pence amount.');
  }
  if (outgoingMinor === null) {
    warnings.push('Outgoing must be a pounds-and-pence amount.');
  }
  if (!isIsoDate(input.nextIncomeDate)) {
    warnings.push('Next income date must use YYYY-MM-DD.');
  }
  if (!isIsoDate(input.outgoingDate)) {
    warnings.push('Outgoing date must use YYYY-MM-DD.');
  }
  if (input.outgoingLabel.trim().length === 0) {
    warnings.push('Outgoing needs a short label.');
  }

  if (warnings.length > 0) {
    return {
      afterIncomeMinor: 0,
      availableNowMinor: availableNowMinor ?? 0,
      beforeIncomeMinor: 0,
      isOutgoingBeforeIncome: false,
      nextIncomeMinor: nextIncomeMinor ?? 0,
      outgoingMinor: outgoingMinor ?? 0,
      projection: null,
      warnings,
    };
  }

  const projection = buildQuickStartProjection({
    asOf: '2026-06-20',
    availableNow: { minorUnits: availableNowMinor ?? 0, currency: 'GBP' },
    nextIncome: {
      amount: { minorUnits: nextIncomeMinor ?? 0, currency: 'GBP' },
      date: input.nextIncomeDate,
      label: 'Next income',
    },
    nextImportantOutgoing: {
      amount: { minorUnits: -Math.abs(outgoingMinor ?? 0), currency: 'GBP' },
      date: input.outgoingDate,
      label: input.outgoingLabel.trim(),
    },
  });

  return {
    afterIncomeMinor: projection.balanceOnIncomeDateMinor,
    availableNowMinor: projection.availableNow.minorUnits,
    beforeIncomeMinor: projection.balanceBeforeIncomeMinor,
    isOutgoingBeforeIncome: projection.nextImportantOutgoing.date <= projection.nextIncome.date,
    nextIncomeMinor: projection.nextIncome.amount.minorUnits,
    outgoingMinor: Math.abs(projection.nextImportantOutgoing.amount.minorUnits),
    projection,
    warnings,
  };
}

export function formatGbAmount(minorUnits: number): string {
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  const major = Math.floor(absolute / 100);
  const minor = String(absolute % 100).padStart(2, '0');
  return `${sign}GBP ${major.toLocaleString('en-GB')}.${minor}`;
}

function mapSyntheticEventKind(kind: SyntheticPreviewEventKind): SyntheticDemoEvent['kind'] {
  switch (kind) {
    case 'available_now':
      return 'fact';
    case 'hypothetical_outgoing':
      return 'hypothetical';
    case 'income':
    case 'important_outgoing':
      return 'expected';
    case 'result':
      return 'result';
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

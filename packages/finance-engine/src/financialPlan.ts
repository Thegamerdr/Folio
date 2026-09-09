import { createLocalDate, type LocalDate } from '@folio/domain';

/** A dated, signed cash movement. Positive values are money in. */
export type FinancialCashflow = Readonly<{
  id: string;
  date: string;
  amountMinor: number;
  label?: string;
  /** Actual posted/corrected movements are facts; omitted values are expectations. */
  kind?: 'actual' | 'income' | 'commitment' | 'living' | 'other';
  protected?: boolean;
}>;

/** A known outflow which must be protected before optional debt repayment. */
export type FinancialCommitment = Readonly<{
  id: string;
  date: string;
  amountMinor: number;
  label: string;
  /** Free text category; the engine never requires a predefined category. */
  category?: string;
  priority?: 'housing' | 'utility' | 'living' | 'work' | 'legal' | 'arrears' | 'other';
  movable?: boolean;
}>;

/** A dated essential allowance. Callers expand recurring allowances into actual dates. */
export type FinancialLivingCost = Readonly<{
  id: string;
  date: string;
  amountMinor: number;
  label: string;
  movable?: boolean;
}>;

export type FinancialDebt = Readonly<{
  id: string;
  name: string;
  balanceMinor: number;
  /** APR in basis points. null/undefined means unknown, never an implied 0%. */
  aprBps?: number | null;
  /** APR after a promotional period. Missing means the post-promo rate is unknown. */
  postPromoAprBps?: number | null;
  minimumPaymentMinor: number;
  dueDate?: string;
  arrears?: boolean;
  promoUntil?: string;
}>;

export type FinancialPlanInput = Readonly<{
  asOf: string;
  accounts: Readonly<Record<string, number | Readonly<{ minor: number }>>>;
  /** Posted/corrected movements, including unexpected spending, refunds and bonuses. */
  cashflows?: readonly FinancialCashflow[];
  /** Expected income events. Use actual dates; no weekly/monthly cadence is assumed. */
  income?: readonly FinancialCashflow[];
  commitments?: readonly FinancialCommitment[];
  livingCosts?: readonly FinancialLivingCost[];
  debts?: readonly FinancialDebt[];
  /** Explicit user choice; hybrid is a transparent default when no choice is supplied. */
  strategy?: DebtStrategy;
  selectedDebtId?: string;
  bufferMinor?: number;
  nextIncomeDate?: string;
  horizonEndDate?: string;
  /** Explicit recurring extra debt amount. Omitted means no extra payment is projected. */
  extraDebtPaymentMinor?: number;
  currency?: string;
}>;

export type DebtStrategy =
  | 'avalanche'
  | 'snowball'
  | 'cash-flow'
  | 'priority'
  | 'promo'
  | 'hybrid'
  | 'user-selected';

export type FinancialTimelinePoint = Readonly<{
  date: LocalDate;
  eventIds: readonly string[];
  netChangeMinor: number;
  closingMinor: number;
  protectedOutflowMinor: number;
}>;

export type ShortfallCause = Readonly<{
  eventId: string;
  label: string;
  amountMinor: number;
  date: LocalDate;
  movable: boolean;
}>;

export type DebtCascadeEvent = Readonly<{
  debtId: string;
  period: number;
  releasedMinimumMinor: number;
}>;

export type DebtProjection = Readonly<{
  strategy: DebtStrategy;
  order: readonly string[];
  startingPrincipalMinor: number;
  minimumPaymentMinor: number;
  extraMonthlyMinor: number;
  payoffDate: LocalDate | null;
  payoffMonths: number | null;
  totalInterestMinor: number | null;
  interestKnown: boolean;
  unknownAprDebtIds: readonly string[];
  stalled: boolean;
  cascade: readonly DebtCascadeEvent[];
  rows: readonly Readonly<{
    period: number;
    dueDate: LocalDate;
    openingPrincipalMinor: number;
    interestMinor: number | null;
    paymentMinor: number;
    closingPrincipalMinor: number;
  }>[];
}>;

export type DebtRecommendation = Readonly<{
  strategy: DebtStrategy;
  targetDebtId: string | null;
  extraPaymentMinor: number;
  reason: string;
  order: readonly string[];
  unknownAprDebtIds: readonly string[];
}>;

export type FinancialPlanResult = Readonly<{
  asOf: LocalDate;
  currency: string;
  nextIncomeDate: LocalDate | null;
  horizonEndDate: LocalDate;
  currentBalanceMinor: number;
  protectedBeforeIncomeMinor: number;
  debtMinimumMinor: number;
  livingCostMinor: number;
  /** Signed: negative means the plan is short even before optional spending. */
  safeToSpendMinor: number;
  availableForExtraMinor: number;
  shortfallMinor: number;
  shortfallDate: LocalDate | null;
  shortfallCauses: readonly ShortfallCause[];
  lowestProjectedMinor: number;
  timeline: readonly FinancialTimelinePoint[];
  debtRecommendation: DebtRecommendation;
  debtProjection: DebtProjection | null;
}>;

export type AffordabilityResult = Readonly<{
  amountMinor: number;
  date: LocalDate;
  affordable: boolean;
  safeToSpendBeforeMinor: number;
  safeToSpendAfterMinor: number;
  shortfallMinor: number;
  shortfallDate: LocalDate | null;
}>;

type PlanEvent = Readonly<{
  id: string;
  date: LocalDate;
  amountMinor: number;
  label: string;
  protectedOutflowMinor: number;
  movable: boolean;
  source: 'actual' | 'income' | 'commitment' | 'living' | 'debt-minimum';
}>;

type WorkingDebt = { -readonly [Key in keyof FinancialDebt]: FinancialDebt[Key] };

const DAY_MS = 86_400_000;

function assertMinor(value: number, label: string, allowNegative = false): void {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    throw new Error(`${label} must be a ${allowNegative ? '' : 'non-negative '}safe integer.`);
  }
}

function dateValue(date: string): LocalDate {
  return createLocalDate(date.slice(0, 10));
}

function addDays(date: LocalDate, count: number): LocalDate {
  const timestamp = new Date(`${date}T00:00:00Z`).getTime() + count * DAY_MS;
  return createLocalDate(new Date(timestamp).toISOString().slice(0, 10));
}

function addMonths(date: LocalDate, count: number): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + count;
  const day = Number(date.slice(8, 10));
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return createLocalDate(
    `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(
      Math.min(day, daysInTargetMonth),
    ).padStart(2, '0')}`,
  );
}

function normalizeAccount(value: number | Readonly<{ minor: number }>): number {
  const amount = typeof value === 'number' ? value : value.minor;
  assertMinor(amount, 'Account balance', true);
  return amount;
}

function sumAccounts(accounts: FinancialPlanInput['accounts']): number {
  const total = Object.values(accounts).reduce<number>(
    (sum, account) => sum + normalizeAccount(account),
    0,
  );
  assertMinor(total, 'Current balance', true);
  return total;
}

function validateEvents(input: FinancialPlanInput): void {
  const ids = new Set<string>();
  const check = (id: string, date: string, amount: number, label: string) => {
    if (ids.has(id)) throw new Error(`Duplicate financial event id: ${id}`);
    ids.add(id);
    dateValue(date);
    assertMinor(amount, `${label} amount`);
  };
  for (const event of input.cashflows ?? [])
    check(event.id, event.date, Math.abs(event.amountMinor), 'Cashflow');
  for (const event of input.income ?? []) check(event.id, event.date, event.amountMinor, 'Income');
  for (const item of input.commitments ?? [])
    check(item.id, item.date, item.amountMinor, 'Commitment');
  for (const item of input.livingCosts ?? [])
    check(item.id, item.date, item.amountMinor, 'Living cost');
  for (const debt of input.debts ?? []) {
    assertMinor(debt.balanceMinor, `Debt ${debt.id} balance`);
    assertMinor(debt.minimumPaymentMinor, `Debt ${debt.id} minimum`);
    if (debt.aprBps !== undefined && debt.aprBps !== null)
      assertMinor(debt.aprBps, `Debt ${debt.id} APR`);
    if (debt.postPromoAprBps !== undefined && debt.postPromoAprBps !== null)
      assertMinor(debt.postPromoAprBps, `Debt ${debt.id} post-promo APR`);
    if (debt.dueDate !== undefined) dateValue(debt.dueDate);
    if (debt.promoUntil !== undefined) dateValue(debt.promoUntil);
  }
}

function nextIncome(input: FinancialPlanInput, asOf: LocalDate): LocalDate | null {
  if (input.nextIncomeDate !== undefined) {
    const explicit = dateValue(input.nextIncomeDate);
    return explicit > asOf ? explicit : null;
  }
  const candidate = [...(input.income ?? [])]
    .filter((event) => event.amountMinor > 0 && dateValue(event.date) > asOf)
    .sort((left, right) => dateValue(left.date).localeCompare(dateValue(right.date)))[0];
  return candidate === undefined ? null : dateValue(candidate.date);
}

function horizonEnd(input: FinancialPlanInput, asOf: LocalDate, next: LocalDate | null): LocalDate {
  if (input.horizonEndDate !== undefined) return dateValue(input.horizonEndDate);
  if (next !== null) return next;
  const dates = [
    ...(input.cashflows ?? []).map((event) => dateValue(event.date)),
    ...(input.income ?? []).map((event) => dateValue(event.date)),
    ...(input.commitments ?? []).map((event) => dateValue(event.date)),
    ...(input.livingCosts ?? []).map((event) => dateValue(event.date)),
  ];
  const last = dates.sort().at(-1);
  return last !== undefined && last > asOf ? last : asOf;
}

function makeEvents(input: FinancialPlanInput, asOf: LocalDate, end: LocalDate): PlanEvent[] {
  const events: PlanEvent[] = [];
  const append = (event: PlanEvent) => {
    if (event.date > end) return;
    // Current balances already include past cash movements. Unpaid obligations, however, remain
    // due and must be reserved today so an overdue bill cannot disappear from the plan.
    if (event.date < asOf) {
      if (event.source === 'actual' || event.source === 'income') return;
      events.push({ ...event, date: asOf });
      return;
    }
    events.push(event);
  };
  for (const event of input.cashflows ?? []) {
    const amount = event.amountMinor;
    assertMinor(amount, `Cashflow ${event.id} amount`, true);
    append({
      id: event.id,
      date: dateValue(event.date),
      amountMinor: amount,
      label: event.label ?? 'Cash movement',
      protectedOutflowMinor: event.protected === true && amount < 0 ? -amount : 0,
      movable: event.protected !== true,
      source: 'actual',
    });
  }
  for (const event of input.income ?? []) {
    append({
      id: event.id,
      date: dateValue(event.date),
      amountMinor: Math.abs(event.amountMinor),
      label: event.label ?? 'Income',
      protectedOutflowMinor: 0,
      movable: false,
      source: 'income',
    });
  }
  for (const item of input.commitments ?? []) {
    append({
      id: item.id,
      date: dateValue(item.date),
      amountMinor: -item.amountMinor,
      label: item.label,
      protectedOutflowMinor: item.amountMinor,
      movable: item.movable === true,
      source: 'commitment',
    });
  }
  for (const item of input.livingCosts ?? []) {
    append({
      id: item.id,
      date: dateValue(item.date),
      amountMinor: -item.amountMinor,
      label: item.label,
      protectedOutflowMinor: item.amountMinor,
      movable: item.movable === true,
      source: 'living',
    });
  }
  for (const debt of input.debts ?? []) {
    if (debt.balanceMinor <= 0 || debt.dueDate === undefined || debt.minimumPaymentMinor <= 0)
      continue;
    const paymentMinor = Math.min(debt.minimumPaymentMinor, debt.balanceMinor);
    const debtLabel = `${debt.name} minimum payment`;
    const alreadyCalendarBooked = (date: LocalDate): boolean =>
      (input.commitments ?? []).some((item) => {
        const label = item.label.toLocaleLowerCase();
        return (
          dateValue(item.date) === date &&
          item.amountMinor === paymentMinor &&
          (label === debt.name.toLocaleLowerCase() || label.includes(debt.name.toLocaleLowerCase()))
        );
      });
    let due = dateValue(debt.dueDate);
    // Keep one overdue obligation at today, then continue the real monthly due-date anchor. This
    // prevents an overdue minimum disappearing while avoiding a pile of synthetic past payments.
    if (due < asOf) {
      if (!alreadyCalendarBooked(asOf))
        append({
          id: `debt-minimum:${debt.id}:overdue`,
          date: asOf,
          amountMinor: -paymentMinor,
          label: debtLabel,
          protectedOutflowMinor: paymentMinor,
          movable: false,
          source: 'debt-minimum',
        });
      due = addMonths(due, 1);
      while (due < asOf) due = addMonths(due, 1);
    }
    let occurrence = 0;
    while (due <= end) {
      if (!alreadyCalendarBooked(due))
        append({
          id: `debt-minimum:${debt.id}:${due}`,
          date: due,
          amountMinor: -paymentMinor,
          label: debtLabel,
          protectedOutflowMinor: paymentMinor,
          movable: false,
          source: 'debt-minimum',
        });
      occurrence += 1;
      due = addMonths(due, 1);
      if (occurrence > 600) break;
    }
  }
  return events.sort(
    (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
}

function strategyOrder(
  debts: readonly FinancialDebt[],
  strategy: DebtStrategy,
  selectedDebtId?: string,
): FinancialDebt[] {
  const copy = [...debts].filter((debt) => debt.balanceMinor > 0);
  const priority = (debt: FinancialDebt): number => (debt.arrears ? 0 : 1);
  const knownApr = (debt: FinancialDebt): number => debt.aprBps ?? -1;
  copy.sort((left, right) => {
    if (strategy === 'user-selected' && selectedDebtId !== undefined) {
      if (left.id === selectedDebtId) return -1;
      if (right.id === selectedDebtId) return 1;
    }
    if (strategy === 'priority')
      return priority(left) - priority(right) || left.id.localeCompare(right.id);
    if (strategy === 'promo') {
      const leftDate = left.promoUntil ?? '9999-12-31';
      const rightDate = right.promoUntil ?? '9999-12-31';
      return (
        priority(left) - priority(right) ||
        leftDate.localeCompare(rightDate) ||
        left.id.localeCompare(right.id)
      );
    }
    if (strategy === 'snowball')
      return (
        priority(left) - priority(right) ||
        left.balanceMinor - right.balanceMinor ||
        left.id.localeCompare(right.id)
      );
    if (strategy === 'cash-flow') {
      const leftRatio = left.balanceMinor > 0 ? left.minimumPaymentMinor / left.balanceMinor : 0;
      const rightRatio =
        right.balanceMinor > 0 ? right.minimumPaymentMinor / right.balanceMinor : 0;
      return (
        priority(left) - priority(right) ||
        rightRatio - leftRatio ||
        left.id.localeCompare(right.id)
      );
    }
    if (strategy === 'avalanche')
      return (
        priority(left) - priority(right) ||
        knownApr(right) - knownApr(left) ||
        left.balanceMinor - right.balanceMinor ||
        left.id.localeCompare(right.id)
      );
    // Hybrid protects arrears first, then gives known APR priority and uses cash-flow relief as tie-breaker.
    const leftRatio = left.balanceMinor > 0 ? left.minimumPaymentMinor / left.balanceMinor : 0;
    const rightRatio = right.balanceMinor > 0 ? right.minimumPaymentMinor / right.balanceMinor : 0;
    return (
      priority(left) - priority(right) ||
      knownApr(right) - knownApr(left) ||
      rightRatio - leftRatio ||
      left.id.localeCompare(right.id)
    );
  });
  return copy;
}

export function projectFinancialDebts(
  input: Readonly<{
    debts: readonly FinancialDebt[];
    strategy: DebtStrategy;
    startDate: string;
    extraMonthlyMinor?: number;
    selectedDebtId?: string;
    maxMonths?: number;
  }>,
): DebtProjection {
  const startDate = dateValue(input.startDate);
  const maxMonths = input.maxMonths ?? 600;
  if (!Number.isSafeInteger(maxMonths) || maxMonths < 1 || maxMonths > 600)
    throw new Error('Debt projection maxMonths must be between 1 and 600.');
  const extra = input.extraMonthlyMinor ?? 0;
  assertMinor(extra, 'Debt extra payment');
  const debts: WorkingDebt[] = input.debts
    .filter((debt) => debt.balanceMinor > 0)
    .map((debt) => ({ ...debt, balanceMinor: Number(debt.balanceMinor) }));
  const order = strategyOrder(debts, input.strategy, input.selectedDebtId) as WorkingDebt[];
  const unknownAprDebtIds = debts
    .filter(
      (debt) =>
        debt.aprBps == null || (debt.promoUntil !== undefined && debt.postPromoAprBps == null),
    )
    .map((debt) => debt.id);
  const minimumPaymentMinor = debts.reduce((sum, debt) => sum + debt.minimumPaymentMinor, 0);
  const startingPrincipalMinor = debts.reduce((sum, debt) => sum + debt.balanceMinor, 0);
  const interestKnown = unknownAprDebtIds.length === 0;
  const dueDateFor = (debt: FinancialDebt, period: number): LocalDate => {
    let anchor = debt.dueDate === undefined ? startDate : dateValue(debt.dueDate);
    // A past due date means the next real occurrence, keeping its original day-of-month anchor.
    while (anchor < startDate) anchor = addMonths(anchor, 1);
    return addMonths(anchor, period - 1);
  };
  if (startingPrincipalMinor === 0)
    return {
      strategy: input.strategy,
      order: [],
      startingPrincipalMinor: 0,
      minimumPaymentMinor: 0,
      extraMonthlyMinor: extra,
      payoffDate: interestKnown ? startDate : null,
      payoffMonths: interestKnown ? 0 : null,
      totalInterestMinor: interestKnown ? 0 : null,
      interestKnown,
      unknownAprDebtIds,
      stalled: !interestKnown,
      cascade: [],
      rows: [],
    };
  if (minimumPaymentMinor + extra === 0)
    return {
      strategy: input.strategy,
      order: order.map((debt) => debt.id),
      startingPrincipalMinor,
      minimumPaymentMinor,
      extraMonthlyMinor: extra,
      payoffDate: null,
      payoffMonths: null,
      totalInterestMinor: interestKnown ? 0 : null,
      interestKnown,
      unknownAprDebtIds,
      stalled: true,
      cascade: [],
      rows: [],
    };
  const cascade: DebtCascadeEvent[] = [];
  const rows: DebtProjection['rows'][number][] = [];
  let totalInterestMinor = 0;
  for (let period = 1; period <= maxMonths; period += 1) {
    const opening = debts.reduce((sum, debt) => sum + debt.balanceMinor, 0);
    let interest: number | null = 0;
    let knownInterest = 0;
    for (const debt of debts) {
      if (debt.balanceMinor <= 0) continue;
      const dueDate = dueDateFor(debt, period);
      const inPromo = debt.promoUntil !== undefined && dueDate <= dateValue(debt.promoUntil);
      const rate = inPromo
        ? debt.aprBps
        : debt.promoUntil === undefined
          ? debt.aprBps
          : debt.postPromoAprBps;
      if (rate === undefined || rate === null) {
        interest = null;
        continue;
      }
      const charged = Math.round((debt.balanceMinor * rate) / 120_000);
      debt.balanceMinor += charged;
      knownInterest += charged;
      totalInterestMinor += charged;
    }
    let payment = 0;
    for (const debt of debts) {
      if (debt.balanceMinor <= 0) continue;
      const paid = Math.min(debt.minimumPaymentMinor, debt.balanceMinor);
      debt.balanceMinor -= paid;
      payment += paid;
      if (debt.balanceMinor === 0 && paid > 0)
        cascade.push({ debtId: debt.id, period, releasedMinimumMinor: debt.minimumPaymentMinor });
    }
    let remaining = Math.max(0, minimumPaymentMinor + extra - payment);
    for (const debt of order) {
      if (remaining <= 0) break;
      if (debt.balanceMinor <= 0) continue;
      const paid = Math.min(remaining, debt.balanceMinor);
      debt.balanceMinor -= paid;
      remaining -= paid;
      payment += paid;
      if (
        debt.balanceMinor === 0 &&
        paid > 0 &&
        !cascade.some((event) => event.debtId === debt.id && event.period === period)
      ) {
        cascade.push({ debtId: debt.id, period, releasedMinimumMinor: debt.minimumPaymentMinor });
      }
    }
    const closing = debts.reduce((sum, debt) => sum + debt.balanceMinor, 0);
    interest = interestKnown ? knownInterest : null;
    const cycleDueDate =
      debts
        .map((debt) => dueDateFor(debt, period))
        .sort()
        .at(-1) ?? startDate;
    rows.push({
      period,
      // Portfolio rows close after the last debt due in this cycle; each debt's interest still
      // uses its own actual due date above, so a card due on the 28th is never modelled on the 12th.
      dueDate: cycleDueDate,
      openingPrincipalMinor: opening,
      interestMinor: interest,
      paymentMinor: payment,
      closingPrincipalMinor: closing,
    });
    if (closing === 0)
      return {
        strategy: input.strategy,
        order: order.map((debt) => debt.id),
        startingPrincipalMinor,
        minimumPaymentMinor,
        extraMonthlyMinor: extra,
        payoffDate: interestKnown ? rows.at(-1)!.dueDate : null,
        payoffMonths: interestKnown ? period : null,
        totalInterestMinor: interestKnown ? totalInterestMinor : null,
        interestKnown,
        unknownAprDebtIds,
        stalled: !interestKnown,
        cascade,
        rows,
      };
  }
  return {
    strategy: input.strategy,
    order: order.map((debt) => debt.id),
    startingPrincipalMinor,
    minimumPaymentMinor,
    extraMonthlyMinor: extra,
    payoffDate: null,
    payoffMonths: null,
    totalInterestMinor: interestKnown ? totalInterestMinor : null,
    interestKnown,
    unknownAprDebtIds,
    stalled: true,
    cascade,
    rows,
  };
}

function calculatePlan(
  input: FinancialPlanInput,
  extraOutflow?: Readonly<{ id: string; date: string; amountMinor: number }>,
): FinancialPlanResult {
  const asOf = dateValue(input.asOf);
  validateEvents(input);
  const next = nextIncome(input, asOf);
  let end = horizonEnd(input, asOf, next);
  if (end < asOf) throw new Error('Forecast horizon must be on or after asOf.');
  const currentBalanceMinor = sumAccounts(input.accounts);
  const bufferMinor = input.bufferMinor ?? 0;
  assertMinor(bufferMinor, 'Protected buffer');
  let events = makeEvents(input, asOf, end);
  let scenarioBoundary: LocalDate | null = next;
  if (extraOutflow !== undefined) {
    assertMinor(extraOutflow.amountMinor, 'Scenario outflow');
    const scenarioDate = dateValue(extraOutflow.date);
    if (scenarioDate < asOf) throw new Error('Scenario date must be on or after asOf.');
    if (scenarioDate > end) {
      end = scenarioDate;
      // Re-materialise the base schedule after extending the horizon. Otherwise an affordability
      // check dated beyond the default window would see the scenario but silently lose later bills.
      events = makeEvents(input, asOf, end);
    }
    // The normal plan answers "before the next reliable income". An affordability scenario
    // dated on/after that income must include its own outflow in the evaluated path; otherwise
    // the payment can be silently omitted and reported affordable. Once the scenario crosses
    // the income boundary, evaluate the complete materialised horizon (including later bills).
    if (next === null || scenarioDate >= next) scenarioBoundary = null;
    if (scenarioDate >= asOf && scenarioDate <= end) {
      // The scenario can extend a plan beyond its default horizon. Its own event is sufficient for
      // the date, while the base events were already materialised against the original horizon.
      events.push({
        id: extraOutflow.id,
        date: scenarioDate,
        amountMinor: -extraOutflow.amountMinor,
        label: 'Proposed spending',
        protectedOutflowMinor: 0,
        movable: true,
        source: 'actual',
      });
    }
    events.sort(
      (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
    );
  }
  const grouped = new Map<string, PlanEvent[]>();
  for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
  let closing = currentBalanceMinor;
  let lowest = closing;
  let safeLowest = closing;
  let lowestDate = asOf;
  let safeLowestDate = asOf;
  let firstShortfallDate: LocalDate | null = closing < bufferMinor ? asOf : null;
  const timeline: FinancialTimelinePoint[] = [];
  const causes: ShortfallCause[] = [];
  let protectedBeforeIncomeMinor = 0;
  let debtMinimumMinor = 0;
  let livingCostMinor = 0;
  for (const [date, dayEvents] of [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    let net = 0;
    let protectedOutflow = 0;
    for (const event of dayEvents) {
      closing += event.amountMinor;
      net += event.amountMinor;
      protectedOutflow += event.protectedOutflowMinor;
      if (next === null || date < next) protectedBeforeIncomeMinor += event.protectedOutflowMinor;
      if (event.source === 'debt-minimum' && (next === null || date < next))
        debtMinimumMinor += event.protectedOutflowMinor;
      if (event.source === 'living' && (next === null || date < next))
        livingCostMinor += event.protectedOutflowMinor;
    }
    if (closing < lowest) {
      lowest = closing;
      lowestDate = dateValue(date);
    }
    if (scenarioBoundary === null || date < scenarioBoundary) {
      if (closing < safeLowest) {
        safeLowest = closing;
        safeLowestDate = dateValue(date);
      }
      if (firstShortfallDate === null && closing < bufferMinor)
        firstShortfallDate = dateValue(date);
    }
    timeline.push({
      date: dateValue(date),
      eventIds: dayEvents.map((event) => event.id),
      netChangeMinor: net,
      closingMinor: closing,
      protectedOutflowMinor: protectedOutflow,
    });
  }
  const safeToSpendMinor = safeLowest - bufferMinor;
  const shortfallMinor = Math.max(0, -safeToSpendMinor);
  if (shortfallMinor > 0) {
    const tightEvents = events.filter(
      (event) => event.date === safeLowestDate && event.amountMinor < 0,
    );
    for (const event of tightEvents)
      causes.push({
        eventId: event.id,
        label: event.label,
        amountMinor: -event.amountMinor,
        date: event.date,
        movable: event.movable,
      });
  }
  const debts = input.debts ?? [];
  const strategy = input.strategy ?? 'hybrid';
  const debtOrder = strategyOrder(debts, strategy, input.selectedDebtId);
  const unknownAprDebtIds = debts
    .filter(
      (debt) =>
        debt.aprBps == null || (debt.promoUntil !== undefined && debt.postPromoAprBps == null),
    )
    .map((debt) => debt.id);
  const target = debtOrder[0]?.id ?? null;
  const reason =
    unknownAprDebtIds.length > 0
      ? `Prioritised ${target ? debtOrder[0]!.name : 'no debt'} while keeping APR unknown for ${unknownAprDebtIds.length} debt${unknownAprDebtIds.length === 1 ? '' : 's'}; interest and payoff estimates remain unmodelled for those debts.`
      : target === null
        ? 'No outstanding debts are recorded.'
        : strategy === 'avalanche'
          ? `${debtOrder[0]!.name} has the highest known APR.`
          : strategy === 'snowball'
            ? `${debtOrder[0]!.name} has the smallest balance.`
            : strategy === 'cash-flow'
              ? `${debtOrder[0]!.name} can release cash flow fastest.`
              : strategy === 'priority'
                ? debtOrder[0]!.arrears
                  ? `${debtOrder[0]!.name} is the recorded arrears priority.`
                  : `${debtOrder[0]!.name} is the deterministic target; no arrears flag is recorded.`
                : strategy === 'promo'
                  ? `${debtOrder[0]!.name} has the earliest recorded promotional expiry.`
                  : strategy === 'user-selected'
                    ? input.selectedDebtId !== undefined && target === input.selectedDebtId
                      ? `You selected ${debtOrder[0]!.name} as the repayment target.`
                      : `${debtOrder[0]!.name} is the deterministic target because the selected debt is unavailable.`
                    : `${debtOrder[0]!.name} balances priority, interest and cash-flow relief.`;
  const requestedExtra = input.extraDebtPaymentMinor ?? 0;
  assertMinor(requestedExtra, 'Requested extra debt payment');
  const safeExtra = Math.min(requestedExtra, Math.max(0, safeToSpendMinor));
  const targetDebtBalanceMinor = debtOrder[0]?.balanceMinor ?? 0;
  const debtProjection =
    debts.length > 0
      ? projectFinancialDebts({
          debts,
          strategy,
          startDate: asOf,
          extraMonthlyMinor: safeExtra,
          ...(input.selectedDebtId === undefined ? {} : { selectedDebtId: input.selectedDebtId }),
        })
      : null;
  return {
    asOf,
    currency: input.currency ?? 'GBP',
    nextIncomeDate: next,
    horizonEndDate: end,
    currentBalanceMinor,
    protectedBeforeIncomeMinor,
    debtMinimumMinor,
    livingCostMinor,
    safeToSpendMinor,
    availableForExtraMinor: Math.max(0, safeToSpendMinor),
    shortfallMinor,
    shortfallDate: shortfallMinor > 0 ? firstShortfallDate : null,
    shortfallCauses: causes,
    lowestProjectedMinor: lowest,
    timeline,
    debtRecommendation: {
      strategy,
      targetDebtId: target,
      extraPaymentMinor: Math.min(
        targetDebtBalanceMinor,
        input.extraDebtPaymentMinor === undefined ? Math.max(0, safeToSpendMinor) : safeExtra,
      ),
      reason,
      order: debtOrder.map((debt) => debt.id),
      unknownAprDebtIds,
    },
    debtProjection,
  };
}

export function calculateFinancialPlan(input: FinancialPlanInput): FinancialPlanResult {
  return calculatePlan(input);
}

export function simulateFinancialAffordability(
  input: FinancialPlanInput,
  amountMinor: number,
  date?: string,
): AffordabilityResult {
  assertMinor(amountMinor, 'Affordability amount');
  const base = calculatePlan(input);
  const when = dateValue(date ?? input.asOf);
  const scenario = calculatePlan(input, { id: '__affordability__', date: when, amountMinor });
  return {
    amountMinor,
    date: when,
    affordable: scenario.safeToSpendMinor >= 0,
    safeToSpendBeforeMinor: base.safeToSpendMinor,
    safeToSpendAfterMinor: scenario.safeToSpendMinor,
    shortfallMinor: scenario.shortfallMinor,
    shortfallDate: scenario.shortfallDate,
  };
}

import {
  calculateFinancialPlan,
  projectFinancialDebts,
  simulateFinancialAffordability,
  type FinancialPlanInput,
  type DebtProjection,
  type DebtStrategy,
} from '@folio/finance-engine';

export type StrategyChoice = 'avalanche' | 'snowball' | 'cash-flow';
export type StrategyScenario = Readonly<{
  strategy: StrategyChoice;
  amountMinor: number;
  cadence: 'once' | 'monthly';
  bufferMinor: number | null;
  debtId: string | null;
}>;
export type StrategySource = Readonly<{
  workspaceId: string;
  input: FinancialPlanInput;
  unknowns: readonly string[];
  caution: string | null;
  provenance: Readonly<{ balance: string; balanceUpdatedAt: string; asOf: string }>;
  plans: readonly Readonly<{
    name: string;
    targetMinor: number;
    savedMinor: number;
    byDate: string;
  }>[];
  pots: readonly Readonly<{ name: string; savedMinor: number; targetMinor: number }>[];
}>;

export const STRATEGY_TOOLS = [
  'get_current_position',
  'get_debts',
  'get_upcoming_obligations',
  'get_income_schedule',
  'get_safe_to_spend',
  'simulate_extra_debt_payment',
  'compare_debt_strategies',
  'simulate_monthly_contribution',
  'simulate_buffer',
  'get_debt_free_forecast',
  'get_shortfall',
  'get_plan_effects',
] as const;
export type StrategyTool = (typeof STRATEGY_TOOLS)[number];
export type StrategyFact = Readonly<{ id: string; text: string }>;
export type StrategyToolResult = Readonly<{
  status: 'ok' | 'unknown' | 'unavailable';
  tool: StrategyTool;
  facts: readonly StrategyFact[];
  scenario: StrategyScenario;
  targetDebtId: string | null;
  affordable: boolean | null;
  payoffDate: string | null;
}>;

const money = (minor: number): string =>
  `${minor < 0 ? '−' : ''}£${(Math.abs(minor) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const names: Record<StrategyChoice, string> = {
  avalanche: 'Highest APR first',
  snowball: 'Smallest balance first',
  'cash-flow': 'Cash-flow first',
};

function projection(
  source: StrategySource,
  scenario: StrategyScenario,
  strategy: DebtStrategy,
): DebtProjection {
  return projectFinancialDebts({
    debts: source.input.debts ?? [],
    strategy,
    startDate: source.input.asOf,
    ...(scenario.debtId ? { selectedDebtId: scenario.debtId } : {}),
    ...(scenario.cadence === 'monthly'
      ? { extraMonthlyMinor: scenario.amountMinor }
      : { oneOffExtraMinor: scenario.amountMinor }),
  });
}

function forecastText(label: string, value: DebtProjection): string {
  if (!value.interestKnown)
    return `${label}: a reliable debt-free date and interest total are unknown because an APR or post-promotion APR is missing.`;
  if (value.stalled || value.payoffDate === null || value.totalInterestMinor === null)
    return `${label}: the engine cannot establish a debt-free date within its projection horizon for these payments.`;
  return `${label}: projected debt-free date ${value.payoffDate}, with ${money(value.totalInterestMinor)} modelled interest. This assumes the recorded rates and minimums continue; it is a projection, not a guarantee.`;
}

/** Pure tool boundary: no store, persistence, network, mutation API or model arithmetic. */
export function runStrategyTool(
  source: StrategySource,
  tool: StrategyTool,
  scenario: StrategyScenario,
): StrategyToolResult {
  const facts: StrategyFact[] = [];
  const add = (text: string) => facts.push({ id: `f${facts.length}`, text });
  const result = (
    status: StrategyToolResult['status'],
    extra: Partial<StrategyToolResult> = {},
  ): StrategyToolResult => ({
    status,
    tool,
    facts,
    scenario,
    targetDebtId: null,
    affordable: null,
    payoffDate: null,
    ...extra,
  });
  try {
    if (
      !Number.isSafeInteger(scenario.amountMinor) ||
      scenario.amountMinor < 0 ||
      (scenario.bufferMinor !== null &&
        (!Number.isSafeInteger(scenario.bufferMinor) || scenario.bufferMinor < 0))
    )
      throw new Error('Invalid scenario amount');
    if (source.unknowns.length) {
      add(
        `I need ${source.unknowns.join(', ')} before I can calculate this safely. Please add or confirm those details in Melo, then try again.`,
      );
      return result('unknown');
    }
    const input: FinancialPlanInput = {
      ...source.input,
      ...(scenario.bufferMinor === null ? {} : { bufferMinor: scenario.bufferMinor }),
    };
    const plan = calculateFinancialPlan(input);
    const debts = (input.debts ?? []).filter((debt) => debt.balanceMinor > 0);
    if (source.caution) add(source.caution);
    if (
      tool === 'get_current_position' ||
      tool === 'get_safe_to_spend' ||
      tool === 'simulate_buffer' ||
      tool === 'get_shortfall'
    ) {
      add(
        `Recorded cash is ${money(plan.currentBalanceMinor)}. After recorded bills, minimums, essentials and a ${money(input.bufferMinor ?? 0)} buffer, the engine shows ${money(plan.safeToSpendMinor)} until ${plan.nextIncomeDate ?? 'the end of the forecast (next income unknown)'}.`,
      );
      if (plan.shortfallMinor > 0)
        add(
          `The modelled shortfall is ${money(plan.shortfallMinor)}${plan.shortfallDate ? ` on ${plan.shortfallDate}` : ''}. Extra debt payments would add pressure.`,
        );
      if (tool !== 'simulate_buffer' && scenario.amountMinor === 0) return result('ok');
    }
    if (tool === 'get_income_schedule') {
      const income = (input.income ?? []).filter((item) => item.date > input.asOf).slice(0, 5);
      add(
        income.length
          ? income
              .map(
                (item) =>
                  `${item.label ?? 'Expected income'}: ${money(item.amountMinor)} on ${item.date}.`,
              )
              .join(' ')
          : 'The next income amount and date are unknown. Add a dated income schedule before relying on a payday forecast.',
      );
      return result(income.length ? 'ok' : 'unknown');
    }
    if (tool === 'get_upcoming_obligations') {
      add(
        plan.pendingObligations.length
          ? plan.pendingObligations
              .slice(0, 12)
              .map((item) => `${item.label}: ${money(item.amountMinor)}, due ${item.date}.`)
              .join(' ')
          : 'There are no recorded outstanding bills or minimums before next income.',
      );
      add(
        `The engine also protects ${money(plan.livingCostMinor)} for essential living before income.`,
      );
      return result('ok');
    }
    if (tool === 'get_plan_effects') {
      add(
        source.plans.length
          ? source.plans
              .map(
                (item) =>
                  `${item.name}: ${money(item.savedMinor)} saved towards ${money(item.targetMinor)}, target ${item.byDate}.`,
              )
              .join(' ')
          : 'No active savings plan is recorded.',
      );
      add(
        source.pots.length
          ? source.pots
              .map(
                (item) =>
                  `${item.name}: ${money(item.savedMinor)} in the pot towards ${money(item.targetMinor)}.`,
              )
              .join(' ')
          : 'No savings pots are recorded.',
      );
      add(
        'A debt scenario does not withdraw from pots or change plan contributions. A revised savings completion date is not available from this debt calculation.',
      );
      return result('ok');
    }
    if (!debts.length) {
      add(
        'No outstanding debts are recorded. Add the debt balances, APRs, minimums and due dates in Debts so I can compare repayment options.',
      );
      return result('unknown');
    }
    if (tool === 'get_debts') {
      add(
        debts
          .map(
            (debt) =>
              `${debt.name}: ${money(debt.balanceMinor)}, APR ${debt.aprBps == null ? 'unknown' : `${debt.aprBps / 100}%`}, minimum ${money(debt.minimumPaymentMinor)}, due ${debt.dueDate ?? 'unknown'}${debt.arrears ? ', arrears recorded' : ''}${debt.promoUntil ? `, promotion until ${debt.promoUntil}` : ''}.`,
          )
          .join(' '),
      );
      return result('ok');
    }
    if (scenario.debtId && !debts.some((debt) => debt.id === scenario.debtId)) {
      add(
        'The debt selected earlier is no longer outstanding in the current workspace. Choose the debt again.',
      );
      return result('unknown');
    }
    if (debts.some((debt) => !debt.dueDate || debt.minimumPaymentMinor <= 0)) {
      add(
        'A debt minimum or due date is missing. Confirm it before relying on repayment or affordability projections.',
      );
      return result('unknown');
    }
    const requested = projection(
      source,
      scenario,
      scenario.debtId ? 'user-selected' : scenario.strategy,
    );
    const targetDebtId = requested.order[0] ?? null;
    const target = debts.find((debt) => debt.id === targetDebtId);
    if (tool === 'compare_debt_strategies') {
      for (const strategy of ['avalanche', 'snowball', 'cash-flow'] as const)
        add(
          forecastText(
            names[strategy],
            projection(source, { ...scenario, debtId: null }, strategy),
          ),
        );
      add(
        'Highest APR first prioritises interest cost; smallest balance first prioritises closing a debt; cash-flow first prioritises releasing minimum payments. The dates above show the modelled trade-off for the same extra amount. None is a guaranteed best option.',
      );
    } else {
      const baseline = projection(
        source,
        { ...scenario, amountMinor: 0 },
        scenario.debtId ? 'user-selected' : scenario.strategy,
      );
      add(forecastText('Without this extra payment', baseline));
      if (scenario.amountMinor > 0) add(forecastText('With this extra payment', requested));
    }
    if (scenario.amountMinor > 0) {
      add(
        `This scenario adds ${money(scenario.amountMinor)} ${scenario.cadence === 'monthly' ? 'each month' : 'once, today'}${target && requested.interestKnown ? `, starting with ${target.name}` : ''}, while protecting a ${money(input.bufferMinor ?? 0)} buffer. The buffer is a scenario preference until you confirm a change.`,
      );
      // Do not label a recurring projection affordable using only its first payment.
      const monthly = scenario.cadence === 'monthly';
      const affordability = monthly
        ? null
        : simulateFinancialAffordability(input, scenario.amountMinor, input.asOf);
      const affordable =
        source.caution || !plan.nextIncomeDate || monthly
          ? null
          : (affordability?.affordable ?? null);
      if (monthly)
        add(
          'The debt-free projection assumes this extra payment repeats monthly. Full recurring cash affordability is not established by a one-off check; each payment still needs review against the current plan.',
        );
      else if (affordability)
        add(
          `After this one-off payment, the engine shows ${money(affordability.safeToSpendAfterMinor)} after recorded bills, minimums, essentials and the selected buffer before next income. ${affordable === true ? 'It fits the recorded plan.' : affordable === false ? `It does not fit; the modelled shortfall is ${money(affordability.shortfallMinor)}.` : 'I cannot call it affordable until the missing or unreviewed context is resolved.'}`,
        );
      return result(requested.interestKnown ? 'ok' : 'unknown', {
        targetDebtId,
        affordable,
        payoffDate: requested.payoffDate,
      });
    }
    return result(requested.interestKnown ? 'ok' : 'unknown', {
      targetDebtId,
      payoffDate: requested.payoffDate,
    });
  } catch {
    facts.length = 0;
    add(
      'The calculation is unavailable right now. I have not estimated a result or changed anything. Please try again.',
    );
    return result('unavailable');
  }
}

/** Only this bounded projection, never FinancialPlanInput or AppState, enters the model. */
export function compactStrategyContext(source: StrategySource) {
  const plan = source.unknowns.length ? null : calculateFinancialPlan(source.input);
  return {
    provenance: source.provenance,
    unknowns: source.unknowns,
    caution: source.caution,
    currentBalanceMinor: plan?.currentBalanceMinor ?? null,
    safeToSpendMinor: plan?.safeToSpendMinor ?? null,
    protectedBufferMinor: source.input.bufferMinor ?? null,
    essentialLivingBeforeIncomeMinor: plan?.livingCostMinor ?? null,
    nextIncomeDate: plan?.nextIncomeDate ?? null,
    income: (source.input.income ?? [])
      .filter((item) => item.date > source.input.asOf)
      .slice(0, 3)
      .map(({ date, amountMinor }) => ({ date, amountMinor })),
    obligations:
      plan?.pendingObligations
        .slice(0, 8)
        .map(({ label, date, amountMinor }) => ({
          label: label.slice(0, 60),
          date,
          amountMinor,
        })) ?? [],
    debtCount: source.input.debts?.length ?? 0,
    debts: (source.input.debts ?? [])
      .slice(0, 10)
      .map(({ name, balanceMinor, aprBps, minimumPaymentMinor, dueDate, arrears, promoUntil }) => ({
        name: name.slice(0, 60),
        balanceMinor,
        aprBps: aprBps ?? null,
        minimumPaymentMinor,
        dueDate: dueDate ?? null,
        arrears: arrears ?? null,
        promoUntil: promoUntil ?? null,
      })),
    plans: source.plans.slice(0, 3).map((item) => ({ ...item, name: item.name.slice(0, 60) })),
    pots: source.pots.slice(0, 3).map((item) => ({ ...item, name: item.name.slice(0, 60) })),
    detailListsTruncated:
      (source.input.debts?.length ?? 0) > 10 ||
      (plan?.pendingObligations.length ?? 0) > 8 ||
      source.plans.length > 3 ||
      source.pots.length > 3,
    shortfallMinor: plan?.shortfallMinor ?? null,
    forecastThrough: plan?.horizonEndDate ?? null,
    debtFreeForecast: plan?.debtProjection?.payoffDate ?? null,
    selectedStrategy: source.input.strategy ?? null,
  };
}

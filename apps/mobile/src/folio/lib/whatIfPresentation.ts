import { calculateFinancialPlan } from '@folio/finance-engine';
import type { AppState, WhatIfHold } from '../store';
import { toFinancialPlanInput } from './financialPlan';

/** Preview uses exactly the saved-hold contract; moving payday remains a separate, unsaved test. */
export function buildWhatIfPresentation(
  state: AppState,
  now: Date,
  amount: number,
  recurrence: WhatIfHold['recurrence'],
  paydayShift = 0,
) {
  const hold: WhatIfHold = {
    id: 'preview-only',
    amount: Math.max(0, Math.round(amount)),
    recurrence,
    addedAt: now.toISOString(),
  };
  const input = toFinancialPlanInput(
    {
      ...state,
      whatIfHolds:
        hold.amount > 0
          ? [hold, ...(state.whatIfHolds ?? [])].slice(0, 24)
          : (state.whatIfHolds ?? []),
    },
    { now },
  );
  const savedHold = calculateFinancialPlan(input);
  if (paydayShift === 0) return { preview: savedHold, savedHold };
  const income = (input.income ?? []).map((event) =>
    event.date > input.asOf
      ? {
          ...event,
          date: new Date(Date.parse(`${event.date}T00:00:00Z`) + paydayShift * 86_400_000)
            .toISOString()
            .slice(0, 10),
        }
      : event,
  );
  const nextIncomeDate = income
    .map((event) => event.date)
    .filter((date) => date > input.asOf)
    .sort()[0];
  const shifted = { ...input, income };
  delete shifted.nextIncomeDate;
  return {
    preview: calculateFinancialPlan({ ...shifted, ...(nextIncomeDate ? { nextIncomeDate } : {}) }),
    savedHold,
  };
}

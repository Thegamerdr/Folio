import type { FinancialPlanResult } from '@folio/finance-engine';
import { formatMoney, type selectFinancialPresentation } from '../financialPresentation';

/** Copy uses the existing financial presentation gates; it never invents a safer result. */
export function meloAnchorContext(
  plan: FinancialPlanResult | null,
  presentation: ReturnType<typeof selectFinancialPresentation>,
) {
  if (!presentation.complete || !plan?.nextIncomeDate)
    return {
      sentence: 'Your plan still needs some numbers and dates.',
      label: 'Complete my setup',
      destination: 'onboarding',
    } as const;
  if (plan.safeToSpendMinor < 0)
    return {
      sentence: `${formatMoney(-plan.safeToSpendMinor / 100)} is missing after recorded costs and buffer.`,
      label: 'Open Recovery',
      destination: 'recovery',
    } as const;
  if (presentation.overdueCount > 0)
    return {
      sentence: `${presentation.overdueCount} overdue ${presentation.overdueCount === 1 ? 'commitment still needs' : 'commitments still need'} checking.`,
      label: 'Review unpaid commitments',
      destination: 'subs',
    } as const;
  if (!presentation.canReassure)
    return {
      sentence: 'Some figures or forecast changes still need checking.',
      label: 'Review my money picture',
      destination: 'melo',
    } as const;
  return {
    sentence: `${formatMoney(plan.safeToSpendMinor / 100)} is left after recorded costs and buffer.`,
    label: 'Ask Melo',
    destination: 'melo',
  } as const;
}

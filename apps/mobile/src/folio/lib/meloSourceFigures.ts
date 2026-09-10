import type { AppState } from '../store';
import { purgeSeedIfReal } from '../store';
import { requireWorkspaceData } from './workspaceRoot';
import { buildFinancialPlanFromState } from './financialPlan';
import {
  selectFinancialPresentation,
  formatFinancialDate,
  formatMoney,
} from './financialPresentation';

/** Local display only. Names and identifiers never enter the aggregate AI contract. */
export function buildMeloSourceFigures(state: AppState, now = new Date()) {
  const local = purgeSeedIfReal(requireWorkspaceData(state, state.activeWorkspaceId));
  const plan = buildFinancialPlanFromState(local, { now });
  const presentation = selectFinancialPresentation(local, plan);
  return {
    plan,
    presentation,
    rows: plan.pendingObligations.map((item) => ({
      id: item.id,
      label: item.label,
      detail: `${item.date < plan.asOf ? 'Overdue · ' : ''}${formatFinancialDate(item.date)}`,
      amount: formatMoney(item.amountMinor / 100, true),
      destination: item.source === 'debt-minimum' ? ('debts' as const) : ('calendar' as const),
    })),
  };
}

export function meloChatStarters(kind: 'personal' | 'business'): readonly string[] {
  return kind === 'business'
    ? [
        'Explain my business cash position',
        'What needs my review?',
        'Show my business accounts',
        'How has the last 30 days gone?',
      ]
    : [
        'Why is my tight point so low?',
        'Can I afford £40 on Friday?',
        'Help me review a regular charge',
        "How's the month going?",
      ];
}

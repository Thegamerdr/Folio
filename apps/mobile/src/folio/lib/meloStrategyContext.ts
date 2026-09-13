import type { StrategySource } from '../../local/meloStrategyTools';
import { purgeSeedIfReal, type AppState } from '../store';
import { requireWorkspaceData } from './workspaceRoot';
import { toFinancialPlanInput } from './financialPlan';
import { selectFinancialPresentation } from './financialPresentation';
import { calculateFinancialPlan } from '@folio/finance-engine';

/** Read at send time. The model receives compactStrategyContext, never this store snapshot. */
export function buildMeloStrategySource(state: AppState, now = new Date()): StrategySource | null {
  const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
  if (workspace?.kind !== 'personal') return null;
  const local = purgeSeedIfReal(requireWorkspaceData(state, state.activeWorkspaceId));
  const input = toFinancialPlanInput(local, { now });
  const plan = calculateFinancialPlan(input);
  const presentation = selectFinancialPresentation(local, plan);
  const unknowns = [...presentation.needs];
  if (!plan.nextIncomeDate && !unknowns.includes('payday and income'))
    unknowns.push('next income date');
  return {
    workspaceId: state.activeWorkspaceId,
    input,
    unknowns,
    caution:
      presentation.overdueCount ||
      presentation.pendingReview ||
      presentation.forecastAssumptionCount
        ? presentation.message
        : null,
    provenance: {
      balance: local.currentBalance.source,
      balanceUpdatedAt: local.currentBalance.setAt,
      asOf: input.asOf,
    },
    plans: (local.plans ?? [])
      .filter((item) => item.target > 0)
      .map((item) => ({
        name: item.name,
        targetMinor: Math.round(item.target * 100),
        savedMinor: Math.round(item.saved * 100),
        byDate: item.byDate,
      })),
    pots: local.pots
      .filter((item) => item.goal > 0)
      .map((item) => ({
        name: item.name,
        targetMinor: Math.round(item.goal * 100),
        savedMinor: Math.round(item.saved * 100),
      })),
  };
}

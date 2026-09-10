import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { formatMoney, selectFinancialPresentation } from './financialPresentation';

export type RecoveryAction =
  | Readonly<{ kind: 'pause-sub'; name: string }>
  | Readonly<{ kind: 'move-bill'; name: string; days: number }>
  | Readonly<{ kind: 'hold-spend'; dailyCap: number; days: number }>;

type RecoverySnapshot = Readonly<{
  cashMinor: number;
  safeMinor: number;
  gapMinor: number;
}>;

/** Ephemeral navigation context, captured around the committed action; never inferred from history. */
export type RecoveryReceipt = Readonly<{
  workspaceId: AppState['activeWorkspaceId'];
  at: string;
  action: RecoveryAction;
  before: RecoverySnapshot;
  after: RecoverySnapshot;
}>;

function snapshot(plan: FinancialPlanResult): RecoverySnapshot {
  return {
    cashMinor: plan.currentBalanceMinor,
    safeMinor: plan.safeToSpendMinor,
    gapMinor: Math.max(0, -plan.safeToSpendMinor),
  };
}

export function buildRecoveryReceipt(
  before: AppState,
  after: AppState,
  action: RecoveryAction,
  now: Date,
): RecoveryReceipt {
  return {
    workspaceId: after.activeWorkspaceId,
    at: now.toISOString(),
    action: { ...action },
    before: snapshot(buildFinancialPlanFromState(before, { now })),
    after: snapshot(buildFinancialPlanFromState(after, { now })),
  };
}

export function describeRecoveryAction(action: RecoveryAction) {
  switch (action.kind) {
    case 'pause-sub':
      return {
        title: `Paused the next ${action.name} charge in the forecast`,
        detail:
          'This changes your Melo forecast. Confirm the pause with the provider; Melo has not stopped their payments. Overdue charges remain reserved.',
      };
    case 'move-bill':
      return {
        title: `Moved ${action.name} ${action.days} days later in the forecast`,
        detail:
          'This changes your Melo forecast. Confirm the new date and any fees with the provider; Melo has not rescheduled their payment.',
      };
    case 'hold-spend':
      return {
        title: `Set a ${action.days}-day spending hold at ${formatMoney(action.dailyCap)} a day`,
        detail:
          'The hold is a spending reminder. It does not add cash or cancel any recorded costs.',
      };
  }
}

/** Current numbers always come from the same live plan as Today. Receipt rows describe the saved
 * action separately, so a later edit cannot silently turn into a different before/after result. */
export function selectAfterChangePresentation(
  state: AppState,
  plan: FinancialPlanResult,
  context?: RecoveryReceipt,
) {
  const receipt = context?.workspaceId === state.activeWorkspaceId ? context : undefined;
  const presentation = selectFinancialPresentation(state, plan);
  const gapMinor = Math.max(0, -plan.safeToSpendMinor);
  const action = receipt ? describeRecoveryAction(receipt.action) : null;
  const changedSinceReceipt = Boolean(
    receipt &&
    (receipt.after.cashMinor !== plan.currentBalanceMinor ||
      receipt.after.safeMinor !== plan.safeToSpendMinor ||
      receipt.at.slice(0, 10) !== plan.asOf),
  );
  // A forecast-only provider change is never evidence that the provider confirmed it.
  const canReassure =
    presentation.canReassure && (!receipt || receipt.action.kind === 'hold-spend');
  return {
    receipt,
    presentation,
    canReassure,
    gapMinor,
    amount: presentation.complete ? Math.abs(plan.safeToSpendMinor) / 100 : null,
    amountLabel: gapMinor > 0 ? 'gap remaining' : 'after recorded costs',
    headline: !presentation.complete
      ? 'Your numbers still need checking.'
      : gapMinor > 0
        ? 'A gap still needs attention.'
        : !presentation.canReassure
          ? presentation.label
          : receipt
            ? 'Forecast updated.'
            : 'Your current plan.',
    changeTitle: action?.title ?? 'Your current financial picture',
    changeDetail:
      action?.detail ??
      'This is your current plan. A before-and-after comparison is not available for this visit.',
    message: !presentation.complete
      ? presentation.message
      : gapMinor > 0
        ? `${formatMoney(gapMinor / 100)} is still needed after recorded bills, essentials and buffer.${presentation.overdueCount || presentation.pendingReview || !plan.nextIncomeDate ? ` ${presentation.message}` : ''}`
        : receipt && receipt.action.kind !== 'hold-spend'
          ? `Check the change with the provider before relying on this forecast. ${presentation.message}`
          : presentation.message,
    changedSinceReceipt,
    rows: receipt
      ? [
          {
            label: 'Tracked cash',
            before: receipt.before.cashMinor / 100,
            after: receipt.after.cashMinor / 100,
          },
          {
            label: 'After recorded costs',
            before: receipt.before.safeMinor / 100,
            after: receipt.after.safeMinor / 100,
          },
          {
            label: 'Gap',
            before: receipt.before.gapMinor / 100,
            after: receipt.after.gapMinor / 100,
          },
        ]
      : [],
  };
}

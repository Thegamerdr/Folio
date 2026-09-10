import type { AppState } from '../store';
import { selectFinancialPresentation } from './financialPresentation';

const SOURCE_LABEL: Record<string, string> = {
  'user-entered': 'you set this',
  statement: 'from your last statement',
  'pdf-derived': 'from a statement you added',
  'ocr-derived': 'from a photo you added',
  corrected: 'you corrected this',
  sample: 'sample data',
};

/** Reset keeps the onboarding doorway preference; it does not confirm the default zero balance. */
export function selectBalanceSourceLabel(state: AppState): string {
  if (!selectFinancialPresentation(state, null).balanceKnown) return 'not set yet';
  const isBusiness =
    state.workspaces.find((item) => item.id === state.activeWorkspaceId)?.kind === 'business';
  if (isBusiness && state.currentBalance.source === 'sample') return 'not set yet';
  return SOURCE_LABEL[state.currentBalance.source] ?? 'source not recorded';
}

/**
 * @rn-lib       modeToolPrefs
 * @purpose      Per-mode tool routing hints for Melo. The full tool
 *               registry stays the same across every mode — this map
 *               only re-orders which tool Melo should reach for first
 *               when the user asks something ambiguous like
 *               "help me save more".
 * @notes        RN port of folio-melo (design-main) `src/lib/modes/toolPrefs.ts`,
 *               kept verbatim. Fed into the system prompt as a preferred
 *               tool order. Never restricts access; strictly a nudge.
 */
import type { MoneyMode } from './types';

export type MeloTool =
  | 'log_spend'
  | 'log_income'
  | 'log_refund'
  | 'log_transfer'
  | 'pauseSub'
  | 'cancelSub'
  | 'addToPot'
  | 'borrowFromPot'
  | 'startWhatIf'
  | 'openRitual'
  | 'openRecovery';

/** Priority list per mode — earlier entries are preferred when Melo has
 *  a choice between tools. Anything not listed stays available. */
export const MODE_TOOL_PRIORITY: Record<MoneyMode, MeloTool[]> = {
  survival: ['pauseSub', 'openRecovery', 'log_spend', 'borrowFromPot', 'startWhatIf'],
  stability: ['log_spend', 'addToPot', 'startWhatIf', 'pauseSub'],
  growth: ['addToPot', 'startWhatIf', 'log_income', 'cancelSub'],
  debt: ['log_transfer', 'cancelSub', 'addToPot', 'pauseSub'],
  irregular: ['log_income', 'addToPot', 'startWhatIf', 'pauseSub'],
  household: ['log_spend', 'log_transfer', 'pauseSub'],
  planning: ['addToPot', 'startWhatIf', 'log_income'],
  optimizer: ['cancelSub', 'pauseSub', 'log_transfer', 'addToPot'],
  reset: ['pauseSub', 'cancelSub', 'openRecovery', 'log_spend'],
  lowVis: ['log_income', 'log_spend', 'openRitual'],
};

/** Rendered as a single line into the Melo system prompt. */
export function toolPriorityDirective(mode: MoneyMode): string {
  const order = MODE_TOOL_PRIORITY[mode];
  if (!order?.length) return '';
  return `Preferred tool order for this mode: ${order.join(' → ')}. Only pick outside this list when the user's request clearly calls for it.`;
}

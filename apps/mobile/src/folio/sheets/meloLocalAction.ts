import type {
  MeloLocalAiAction,
  MeloLocalAiActionKind,
  MeloLocalIntent,
} from '@folio/ai-contracts';

import type { ScreenId, SheetId } from '../types';

export type MeloLocalActionDestination =
  | Readonly<{ kind: 'screen'; screen: ScreenId }>
  | Readonly<{ kind: 'sheet'; sheet: Exclude<SheetId, null> }>
  | Readonly<{ kind: 'external'; url: string }>
  | Readonly<{ kind: 'prompt'; prompt: string }>;

function normalizeActionLabel(value: string): string {
  return value
    .toLocaleLowerCase('en-GB')
    .replace(/\b(?:the|my|your)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Keep the transcript concise when a deterministic action and a follow-up chip say the same thing. */
export function filterMeloFollowUpChips(
  actions: readonly Pick<MeloLocalAiAction, 'label'>[],
  chips: readonly string[],
): readonly string[] {
  const actionLabels = new Set(actions.map((action) => normalizeActionLabel(action.label)));
  const seen = new Set<string>();
  const availableSlots = Math.max(0, 3 - actions.length);
  return chips
    .filter((chip) => {
      const normalized = normalizeActionLabel(chip);
      if (actionLabels.has(normalized) || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, availableSlots);
}

/** Pure navigation resolver for deterministic companion actions. */
export function resolveMeloLocalAction(
  action: MeloLocalAiActionKind,
  intent: MeloLocalIntent,
): MeloLocalActionDestination {
  switch (action) {
    case 'open_what_if':
      return { kind: 'screen', screen: 'whatif' };
    case 'review_imports':
      return { kind: 'screen', screen: 'review' };
    case 'build_recovery_route':
      return { kind: 'screen', screen: 'recovery' };
    case 'open_payday_ritual':
      return { kind: 'screen', screen: 'ritual' };
    case 'open_subscriptions':
      return { kind: 'screen', screen: 'subs' };
    case 'open_goals':
      return { kind: 'screen', screen: 'pots' };
    case 'open_calendar':
      return { kind: 'screen', screen: 'calendar' };
    case 'open_timeline':
      return { kind: 'screen', screen: 'timeline' };
    case 'open_account':
      return { kind: 'screen', screen: 'account' };
    case 'open_free_debt_help':
      return {
        kind: 'external',
        url: 'https://www.moneyhelper.org.uk/en/money-troubles/dealing-with-debt/debt-advice-locator',
      };
    case 'open_uk_emergency_help':
      return {
        kind: 'external',
        url: 'https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers',
      };
    case 'explain_sources':
      if (intent === 'review_subscriptions' || intent === 'review_recurring') {
        return { kind: 'screen', screen: 'subs' };
      }
      if (intent === 'review_import') return { kind: 'screen', screen: 'review' };
      return { kind: 'sheet', sheet: 'safe-zone' };
    case 'ask_clarifying_question':
      return { kind: 'prompt', prompt: 'What can I ask you?' };
  }
}

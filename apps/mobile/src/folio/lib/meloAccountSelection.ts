import { purgeSeedIfReal, type AccountKind, type AppState } from '../store';
import { isAccountSelectable } from './accountPolicy';
import { requireWorkspaceData } from './workspaceRoot';

export type MeloAccountChoice = Readonly<{
  accountId: string;
  label: string;
}>;

export type MeloAccountSelection =
  | Readonly<{ state: 'not-requested' }>
  | Readonly<{
      state: 'selected';
      accountId: string;
      label: string;
    }>
  | Readonly<{
      state: 'needs-selection';
      choices: readonly MeloAccountChoice[];
    }>;

const KIND_PATTERNS: Readonly<Record<AccountKind, RegExp>> = {
  bank: /\b(?:bank|current)\s+account\b/i,
  savings: /\b(?:savings?|saving)\s+account\b/i,
  cash: /\bcash\s+account\b/i,
  'credit-card': /\bcredit[- ]?card(?:\s+account)?\b/i,
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function accountChoices(state: AppState): readonly MeloAccountChoice[] {
  return (purgeSeedIfReal(state).accounts ?? [])
    .filter(isAccountSelectable)
    .map((account) => ({ accountId: account.id, label: account.name }));
}

/**
 * Resolve an account only when the user explicitly asks for one. The returned identifier stays in
 * local typed context and is never added to the aggregate AI snapshot.
 */
export function resolveMeloAccountSelection(
  state: AppState,
  prompt: string,
  currentAccountId?: string | null,
  workspaceId = state.activeWorkspaceId,
): MeloAccountSelection {
  const localState = purgeSeedIfReal(requireWorkspaceData(state, workspaceId));
  const accounts = (localState.accounts ?? []).filter(isAccountSelectable);
  const choices = accountChoices(localState);
  if (accounts.length === 0) return { state: 'not-requested' };

  const normalized = normalize(prompt);
  const selectionLanguage =
    /\b(?:use|using|select|choose|from|account balance|balance (?:of|in|on)|which account)\b/i.test(
      normalized,
    );
  const refersToCurrent = /\b(?:this|that|same|selected) account\b/i.test(normalized);
  if (refersToCurrent && currentAccountId) {
    const current = accounts.find((account) => account.id === currentAccountId);
    if (current) return { state: 'selected', accountId: current.id, label: current.name };
  }

  if (/\b(?:another|different) account\b/i.test(normalized)) {
    return {
      state: 'needs-selection',
      choices: choices.filter((choice) => choice.accountId !== currentAccountId),
    };
  }

  const ordinal = normalized.match(/\baccount\s+(\d{1,2})\b/);
  if (selectionLanguage && ordinal?.[1]) {
    const selected = accounts[Number(ordinal[1]) - 1];
    if (selected) return { state: 'selected', accountId: selected.id, label: selected.name };
  }

  if (selectionLanguage) {
    const nameMatches = accounts.filter((account) => {
      const name = normalize(account.name);
      return name.length > 1 && normalized.includes(name);
    });
    if (nameMatches.length === 1) {
      const selected = nameMatches[0]!;
      return { state: 'selected', accountId: selected.id, label: selected.name };
    }

    const kindMatches = accounts.filter((account) => KIND_PATTERNS[account.kind].test(normalized));
    if (kindMatches.length === 1) {
      const selected = kindMatches[0]!;
      return { state: 'selected', accountId: selected.id, label: selected.name };
    }
    if (nameMatches.length > 1 || kindMatches.length > 1) {
      const matches = nameMatches.length > 1 ? nameMatches : kindMatches;
      return {
        state: 'needs-selection',
        choices: matches.map((account) => ({ accountId: account.id, label: account.name })),
      };
    }
  }

  const needsSpecificAccount =
    /\b(?:account balance|balance (?:of|in|on)|which account)\b/i.test(normalized) ||
    (/\b(?:use|using|select|choose|from)\b/i.test(normalized) && /\baccount\b/i.test(normalized));
  if (!needsSpecificAccount) return { state: 'not-requested' };
  if (accounts.length === 1) {
    const selected = accounts[0]!;
    return { state: 'selected', accountId: selected.id, label: selected.name };
  }
  return { state: 'needs-selection', choices };
}

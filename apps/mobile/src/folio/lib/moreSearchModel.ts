import type { ScreenId, SheetId } from '@/folio/types';

export type MoreSearchTarget =
  | { kind: 'screen'; screen: ScreenId }
  | { kind: 'sheet'; sheet: SheetId };

export type MoreSearchResult = Readonly<{
  id: string;
  label: string;
  meta: string;
  target: MoreSearchTarget;
}>;

export type MoreSearchData = Readonly<{
  pots: readonly string[];
  subscriptions: readonly string[];
  debts: readonly string[];
}>;

const DESTINATIONS: readonly MoreSearchResult[] = [
  {
    id: 'debts',
    label: 'Debts',
    meta: 'tracked balances and repayments',
    target: { kind: 'screen', screen: 'debts' },
  },
  {
    id: 'account',
    label: 'Account and plan',
    meta: 'identity and access',
    target: { kind: 'screen', screen: 'account' },
  },
  {
    id: 'settings',
    label: 'Settings in More',
    meta: 'notifications, reminders and accessibility',
    target: { kind: 'screen', screen: 'more' },
  },
  {
    id: 'timeline',
    label: 'Timeline',
    meta: 'transaction history and changes',
    target: { kind: 'screen', screen: 'timeline' },
  },
  {
    id: 'today',
    label: 'Today',
    meta: 'your current money picture',
    target: { kind: 'screen', screen: 'today' },
  },
  {
    id: 'plan',
    label: 'Plan',
    meta: 'what is coming before payday',
    target: { kind: 'screen', screen: 'plan' },
  },
  {
    id: 'calendar',
    label: 'Calendar',
    meta: 'dates and commitments',
    target: { kind: 'screen', screen: 'calendar' },
  },
  {
    id: 'review',
    label: 'Review',
    meta: 'items waiting for your decision',
    target: { kind: 'screen', screen: 'review' },
  },
  {
    id: 'pots',
    label: 'Pots',
    meta: 'money held back on purpose',
    target: { kind: 'screen', screen: 'pots' },
  },
  {
    id: 'subs',
    label: 'Subscriptions',
    meta: 'recurring charges',
    target: { kind: 'screen', screen: 'subs' },
  },
  {
    id: 'connections',
    label: 'Money sources',
    meta: 'manual, file and available connections',
    target: { kind: 'screen', screen: 'connections' },
  },
  {
    id: 'privacy',
    label: 'Data and privacy',
    meta: 'backup, export and deletion',
    target: { kind: 'screen', screen: 'privacy' },
  },
];

const ACTIONS: readonly MoreSearchResult[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    meta: 'light, dark or device theme',
    target: { kind: 'sheet', sheet: 'appearance' },
  },
  {
    id: 'add-bill',
    label: 'Add a bill',
    meta: 'a recurring payment',
    target: { kind: 'screen', screen: 'add-bill' },
  },
  {
    id: 'add-debt',
    label: 'Add a debt',
    meta: 'balance, rate and payoff',
    target: { kind: 'sheet', sheet: 'declare-debt' },
  },
  {
    id: 'add-event',
    label: 'Add a date',
    meta: 'a one-off in or out',
    target: { kind: 'sheet', sheet: 'add-event' },
  },
  {
    id: 'income',
    label: 'Payday and income',
    meta: 'change when money lands',
    target: { kind: 'sheet', sheet: 'onboarding' },
  },
];

export function buildMoreSearchResults(query: string, data: MoreSearchData): MoreSearchResult[] {
  const records: MoreSearchResult[] = [
    ...data.pots.map((name, index) => ({
      id: `pot-${index}-${name}`,
      label: name,
      meta: 'Pot · held money',
      target: { kind: 'screen' as const, screen: 'pots' as const },
    })),
    ...data.subscriptions.map((name, index) => ({
      id: `sub-${index}-${name}`,
      label: name,
      meta: 'Subscription · recurring charge',
      target: { kind: 'screen' as const, screen: 'subs' as const },
    })),
    ...data.debts.map((name, index) => ({
      id: `debt-${index}-${name}`,
      label: name,
      meta: 'Debt · tracked commitment',
      target: { kind: 'screen' as const, screen: 'debts' as const },
    })),
  ];
  const all = [...ACTIONS, ...records, ...DESTINATIONS];
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return all;
  return all.filter((result) =>
    `${result.label} ${result.meta}`.toLocaleLowerCase().includes(needle),
  );
}

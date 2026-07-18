export type DismissReason =
  | 'not-now'
  | 'wrong-amount'
  | 'wrong-pot'
  | 'another-plan'
  | 'just-no';

export type DismissChoice = Readonly<{
  id: DismissReason;
  label: string;
}>;

export const DISMISS_CHOICES: readonly DismissChoice[] = [
  { id: 'not-now', label: 'Not the right time' },
  { id: 'wrong-amount', label: 'Wrong amount' },
  { id: 'wrong-pot', label: 'Wrong pot' },
  { id: 'another-plan', label: "I've got another plan" },
  { id: 'just-no', label: 'Just — no' },
];

export type DismissRecord = Readonly<{
  kind: string;
  reason: DismissReason | null;
  at: string;
  amount?: number;
  potId?: string;
}>;

export function dampenDaysFor(reason: DismissReason | null): number {
  switch (reason) {
    case 'not-now':
      return 3;
    case 'wrong-amount':
    case 'wrong-pot':
      return 1;
    case 'another-plan':
      return 14;
    case 'just-no':
      return 30;
    default:
      return 14;
  }
}

export function isDampened(
  kind: string,
  log: readonly DismissRecord[],
  now = new Date(),
): boolean {
  const recent = [...log]
    .filter((record) => record.kind === kind)
    .sort((left, right) => right.at.localeCompare(left.at))[0];
  if (!recent) return false;
  const dismissedAt = Date.parse(recent.at);
  if (!Number.isFinite(dismissedAt)) return false;
  return (now.getTime() - dismissedAt) / 86_400_000 < dampenDaysFor(recent.reason);
}

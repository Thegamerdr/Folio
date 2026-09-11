import { parseManualMoney } from './manualMoney';

/** Validate the visible draft without replacing an invalid day with its last valid value. */
export function parseDayOfMonth(raw: string): number | undefined {
  if (!/^\d{1,2}$/.test(raw.trim())) return undefined;
  const value = Number(raw.trim());
  return value >= 1 && value <= 31 ? value : undefined;
}

/** A vertical scroll must not capture or change a horizontal amount slider. */
export function isHorizontalSliderGesture(dx: number, dy: number): boolean {
  return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function applyMoneyKey(raw: string, key: string): string {
  if (key === '←') return raw.slice(0, -1) || '0';
  if (key === '.') return raw.includes('.') ? raw : `${raw || '0'}.`;
  if (!/^\d$/.test(key) || (raw.includes('.') && (raw.split('.')[1]?.length ?? 0) >= 2)) return raw;
  return (raw === '0' ? key : raw + key).slice(0, 12);
}

export type DebtDraft = {
  name: string;
  balance: string;
  apr: string;
  minimum: string;
  dueDay: string;
  editing: boolean;
};
export type DebtDraftField = Exclude<keyof DebtDraft, 'editing'>;

/** Keep each error attached to the field that needs attention, even when it is offscreen. */
export function debtDraftProblem(
  input: DebtDraft,
): { field: DebtDraftField; message: string } | null {
  if (!input.name.trim()) return { field: 'name', message: 'Add a name for this debt.' };
  if (parseManualMoney(input.balance, { allowZero: input.editing }) === undefined)
    return {
      field: 'balance',
      message: input.editing
        ? 'Enter a balance of £0 or more.'
        : 'Enter the outstanding balance, above £0.',
    };
  if (parseManualMoney(input.minimum, { allowZero: input.editing }) === undefined)
    return {
      field: 'minimum',
      message: input.editing
        ? 'Enter a minimum payment of £0 or more.'
        : 'Enter the monthly minimum payment, above £0.',
    };
  if (parseDayOfMonth(input.dueDay) === undefined)
    return { field: 'dueDay', message: 'Enter a day from 1 to 31.' };
  if (input.apr.trim() && parseManualMoney(input.apr, { allowZero: true }) === undefined)
    return {
      field: 'apr',
      message: 'Enter an annual interest rate of 0% or more, or leave it blank if unknown.',
    };
  return null;
}

export function debtDraftIssue(input: DebtDraft): string | null {
  return debtDraftProblem(input)?.message ?? null;
}

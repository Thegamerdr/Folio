// UK bill presets shared by onboarding and settings (rough amounts, editable in place).

import type { MeloBill } from './meloStore';

export const BILL_PRESETS: readonly Omit<MeloBill, 'id'>[] = [
  { name: 'Rent', amountPence: 85_000, dueDay: 1, kind: 'bill' },
  { name: 'Council tax', amountPence: 14_200, dueDay: 1, kind: 'bill' },
  { name: 'Energy', amountPence: 9_500, dueDay: 15, kind: 'bill' },
  { name: 'Water', amountPence: 3_800, dueDay: 8, kind: 'bill' },
  { name: 'Phone', amountPence: 2_400, dueDay: 20, kind: 'bill' },
  { name: 'Broadband', amountPence: 3_000, dueDay: 12, kind: 'bill' },
  { name: 'Subscriptions', amountPence: 2_700, dueDay: 15, kind: 'bill' },
  { name: 'Car', amountPence: 12_000, dueDay: 25, kind: 'bill' },
  { name: 'Debt payment', amountPence: 6_000, dueDay: 28, kind: 'debt' },
];

export function billId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export function parsePoundsText(text: string): number {
  const digits = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(digits) && digits > 0 ? digits * 100 : 0;
}

/** Balance fields accept overdrafts: "-230" is a real Tuesday for a lot of people (§13 risk 10). */
export function parseSignedPoundsText(text: string): number | null {
  const cleaned = text.replace(/[^0-9-]/g, '');
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) ? value * 100 : null;
}

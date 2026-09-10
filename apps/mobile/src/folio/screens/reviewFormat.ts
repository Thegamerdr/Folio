import { formatFinancialDate } from '../lib/financialPresentation';

export function formatGBPExact(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}£${Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEditableAmount(value: number): string {
  return Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
/** Format only display dates; keep the parser and editable date value untouched. */
export function formatReviewDate(value: string | null | undefined): string {
  const date = value?.trim();
  if (!date) return 'Date not provided';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    return 'Date needs review';
  return formatFinancialDate(date);
}

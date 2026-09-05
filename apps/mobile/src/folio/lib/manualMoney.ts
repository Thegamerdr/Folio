export type ManualMoneyOptions = Readonly<{ allowZero?: boolean; allowNegative?: boolean }>;

/** Parse the complete GBP entry, not a numeric prefix or a silently stripped correction. */
export function parseManualMoney(input: string, options: ManualMoneyOptions = {}): number | undefined {
  const text = input.trim().replace(/^£\s*/, '');
  const sign = options.allowNegative ? '-?' : '';
  const pattern = new RegExp(`^${sign}(?:\\d+|\\d{1,3}(?:,\\d{3})+)(?:\\.\\d{1,2})?$`);
  if (!pattern.test(text)) return undefined;
  const value = Number(text.replace(/,/g, ''));
  if ((!options.allowZero && value === 0) || !Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) return undefined;
  return value;
}

/** Parse the complete GBP entry, not a numeric prefix or a silently stripped correction. */
export function parseManualMoney(input: string): number | undefined {
  const text = input.trim().replace(/^£\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return undefined;
  const value = Number(text.replace(/,/g, ''));
  if (!(value > 0) || !Number.isSafeInteger(Math.round(value * 100))) return undefined;
  return value;
}

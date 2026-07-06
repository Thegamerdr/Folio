// Money formatting for the pressure-map kit.
//
// Pure, dependency-free (no react-native imports) so it can be unit-tested directly instead of via
// source-grep. Extracted out of `kit.tsx` so the live surface no longer needs a runtime import from
// the legacy `local/localLedger` stack (see CONSOLIDATION.md — kit.tsx was the sole live consumer).
// Behavior is pinned 1:1 with the original `localLedger.ts` implementation.

/**
 * Formats a signed minor-unit (pence) amount as GBP, e.g. "-£42" / "£1,200.50".
 *
 * - Negative sign goes before the currency symbol: "-£42", not "£-42".
 * - Whole-pound amounts omit the pence part: "£1,200", not "£1,200.00".
 * - Thousands separators follow `en-GB` grouping.
 * - Pence is always 2 digits, zero-padded: "£1.05", not "£1.5".
 */
export function formatMinorAmount(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  const pounds = Math.floor(absolute / 100);
  const pence = absolute % 100;
  const formattedPounds = pounds.toLocaleString('en-GB');
  const currency = '£';
  return pence === 0
    ? `${sign}${currency}${formattedPounds}`
    : `${sign}${currency}${formattedPounds}.${String(pence).padStart(2, '0')}`;
}

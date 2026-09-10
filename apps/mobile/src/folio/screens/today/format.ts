// Today formatters — the RN mirror of the two web design formatters this screen used
// (formatGBP from the web kit, formatDayProse from the web lib/calendar-events), scoped to the
// Today wave. Ported byte-faithfully so the rendered figures and date prose read identically.
//
// The RN design system (@/folio/theme) exposes `money`/`magnitude` which format MINOR units; the
// web Today formatted whole pounds with these two helpers, so the Today wave keeps them here rather
// than reaching for the minor-unit formatters (which would re-scale the values).

/** Whole-pound display with a Unicode minus on negatives, e.g. "£1,240" / "−£86". Byte-faithful to
 *  the web kit's formatGBP. */
export { formatMoney as formatGBP } from '@/folio/lib/financialPresentation';

/** "Tuesday 8" for inline prose. Byte-faithful to the web lib/calendar-events formatDayProse.
 *  Parses at local midnight so the weekday agrees with the ISO day (no UTC drift). */
export function formatDayProse(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Grouped-thousands whole-pound figure, no symbol, no sign — the web used
 *  `Math.round(n).toLocaleString("en-GB")` inline for the hero number and the balance line. */
export function groupedPounds(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}

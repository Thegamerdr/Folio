/**
 * Presentation bridge for Stability's canonical protected plan.
 *
 * The route uses pounds at the screen boundary while the finance engine keeps integer pence.
 * Round once at this boundary, retain pence in the hero, and derive all accompanying copy from
 * the same value so the number and its claims cannot disagree.
 */
export type StabilityCanonicalPresentation = {
  amount: number;
  headline: string;
  formula: string;
  verdict: string;
  negative: boolean;
};

function formatPence(minor: number): string {
  return (minor / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Returns null during the Stability mount gate, preserving its existing sample fallback. */
export function presentStabilityCanonicalPlan(
  safeToSpend: number | undefined,
  bufferAmount: number,
): StabilityCanonicalPresentation | null {
  if (safeToSpend === undefined) return null;

  const safeToSpendMinor = Math.round(safeToSpend * 100);
  const shortfallMinor = Math.max(0, -safeToSpendMinor);
  const negative = shortfallMinor > 0;
  return {
    amount: Math.max(0, safeToSpendMinor) / 100,
    headline: `£${formatPence(Math.max(0, safeToSpendMinor))}`,
    formula: negative
      ? `safe to spend until payday · £${formatPence(shortfallMinor)} projected shortfall before payday`
      : `safe to spend until payday · buffer £${bufferAmount} protected`,
    verdict: negative
      ? `£${formatPence(shortfallMinor)} projected shortfall before payday.`
      : 'Known commitments covered until payday.',
    negative,
  };
}

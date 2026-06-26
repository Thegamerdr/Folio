// Pure route geometry helpers — no React Native imports, so they are unit-testable
// under vitest (importing the .tsx surface would drag in react-native's Flow source).

import type { LocalRouteSummary } from '../../local/localLedger';

/**
 * Whether the route carries enough real movement to draw an honest path. With no
 * second point and no events there is nothing to claim, so the path stays empty
 * instead of inventing a shape — the picture never fakes meaning.
 */
export function routeHasMeaningfulPath(route: LocalRouteSummary): boolean {
  const balances = route.points.map((p) => p.balanceMinor);
  const maxV = Math.max(...balances, 0);
  const minV = Math.min(...balances, 0);
  return route.points.length >= 2 && maxV !== minV && route.points.some((p) => p.deltaMinor !== 0);
}

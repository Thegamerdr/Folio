/**
 * AccountScreen source-row selectors (task: coherence-fix).
 *
 * Pure, deterministic, Node-safe: no react-native import here, so this module (and its test) can be
 * collected by the plain Node vitest runner — the same reason `income.ts`'s selectors live outside
 * any screen file. Kept tiny and single-purpose; grows only if more Account source-row logic needs
 * the same treatment.
 */

/** Whether the "Statements & receipts" source row should read as "added by you". Reflects a REAL
 *  import: `statementImportsCount` (the honest, dedicated signal from `AppState.statementImports`)
 *  or `transactionsCount` (a back-compat fallback for ledgers that predate the import-log field, or
 *  transactions added by any other path). Replaces the old `subsCount + potsCount > 0` proxy, which
 *  was seed-data-shaped and never moved after an actual statement landed. */
export function hasStatementSourceData(
  statementImportsCount: number,
  transactionsCount: number,
): boolean {
  return statementImportsCount > 0 || transactionsCount > 0;
}

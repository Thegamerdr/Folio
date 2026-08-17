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

export type BankSourceState = 'active' | 'pending' | 'stale' | 'reauth' | 'error' | 'disconnected';

export type BankConnectionSource = Readonly<{
  status: 'pending_redirect' | 'pending_sync' | 'active' | 'error' | 'disconnected';
  expiresAt: string | null;
  lastSuccessfulRefreshAt: string | null;
  lastErrorCode: string | null;
}>;

export type BankSourceHealth = Readonly<{
  state: BankSourceState;
  needsAction: boolean;
  usableForRefresh: boolean;
  summary: string;
}>;

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1_000;

function instant(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts the provider-neutral runtime connection into the exact owner-facing source state.
 * Expired/error/stale sources remain visible but never masquerade as a fresh connection.
 */
export function bankSourceHealth(
  connection: BankConnectionSource,
  nowIso: string,
): BankSourceHealth {
  const now = instant(nowIso);
  if (now === null) throw new Error(`bankSourceHealth: invalid nowIso "${nowIso}"`);

  if (connection.status === 'disconnected') {
    return {
      state: 'disconnected',
      needsAction: false,
      usableForRefresh: false,
      summary: 'Future Melo refreshes stopped',
    };
  }
  if (connection.status === 'pending_redirect' || connection.status === 'pending_sync') {
    return {
      state: 'pending',
      needsAction: true,
      usableForRefresh: connection.status === 'pending_sync',
      summary:
        connection.status === 'pending_redirect'
          ? 'Waiting for bank authorisation'
          : 'Bank returned · first check needed',
    };
  }
  const expiry = instant(connection.expiresAt);
  const errorNeedsAuthorisation =
    connection.lastErrorCode !== null &&
    /authori[sz]|consent|expired|token|access_denied/iu.test(connection.lastErrorCode);
  if (connection.status === 'error') {
    return {
      state: errorNeedsAuthorisation ? 'reauth' : 'error',
      needsAction: true,
      usableForRefresh: !errorNeedsAuthorisation,
      summary: errorNeedsAuthorisation ? 'Bank permission needs renewing' : 'Last check failed',
    };
  }
  if (expiry !== null && expiry <= now) {
    return {
      state: 'reauth',
      needsAction: true,
      usableForRefresh: false,
      summary: 'Bank permission has expired',
    };
  }
  const refreshedAt = instant(connection.lastSuccessfulRefreshAt);
  if (refreshedAt === null) {
    return {
      state: 'pending',
      needsAction: true,
      usableForRefresh: true,
      summary: 'Connected · first check needed',
    };
  }
  if (now - refreshedAt > STALE_AFTER_MS) {
    return {
      state: 'stale',
      needsAction: true,
      usableForRefresh: true,
      summary: 'Bank information is over 7 days old',
    };
  }
  return {
    state: 'active',
    needsAction: false,
    usableForRefresh: true,
    summary: 'Connected · read-only',
  };
}

export type ImportSourceSummary = Readonly<{
  importCount: number;
  rowCount: number;
  latestAt: string | null;
  retainedEvidenceCount: number;
}>;

/** Honest aggregate for the Money Sources screen; never infers imports from unrelated app data. */
export function importSourceSummary(
  imports: readonly Readonly<{ rowCount: number; atISO: string }>[],
  retainedEvidenceCount: number,
): ImportSourceSummary {
  const latest = imports
    .map((item) => item.atISO)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()
    .at(-1);
  return {
    importCount: imports.length,
    rowCount: imports.reduce((total, item) => total + Math.max(0, Math.trunc(item.rowCount)), 0),
    latestAt: latest ?? null,
    retainedEvidenceCount: Math.max(0, Math.trunc(retainedEvidenceCount)),
  };
}

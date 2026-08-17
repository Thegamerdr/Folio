import { buildLocalRouteSummary, type LocalLedgerState } from './localLedger.js';

import { createWorkspaceId, type WorkspaceId } from '@folio/domain';

export const localLedgerWorkspaceId = createWorkspaceId('workspace_personal_local');
export const localLedgerSchemaVersion = 'folio-mobile-local-ledger-v1';

/** Validate an explicit local-ledger owner; physical provisioning is handled by native storage. */
export function requireLocalLedgerWorkspaceId(workspaceId: WorkspaceId): WorkspaceId {
  return createWorkspaceId(String(workspaceId));
}

export type LocalLedgerVaultTable = Readonly<{
  name: string;
  rowCount: number;
  rows: readonly Readonly<Record<string, unknown>>[];
  checksum: string;
}>;

export type LocalLedgerVaultEnvelope = Readonly<{
  format: 'folio.mobile_local_vault';
  formatVersion: 1;
  exportedAt: string;
  schemaVersion: typeof localLedgerSchemaVersion;
  dataVersion: string;
  tables: readonly LocalLedgerVaultTable[];
}>;

export type LocalLedgerVaultValidation = Readonly<{
  valid: boolean;
  issues: readonly string[];
}>;

export type LocalLedgerVaultSummary = Readonly<{
  dataVersion: string;
  exportedAt: string;
  transactionRows: number;
  importDraftRows: number;
  rejectedImportRows: number;
  documentStageRows: number;
  historyRows: number;
  searchRows: number;
  validation: LocalLedgerVaultValidation;
}>;

export function createLocalLedgerDataVersion(state: LocalLedgerState): string {
  return createStableLocalHash({
    asOfDate: state.asOfDate,
    cashOnHandMinor: state.cashOnHandMinor,
    transactions: state.transactions.map((transaction) => ({
      id: transaction.id,
      title: transaction.title,
      amountMinor: transaction.amountMinor,
      date: transaction.date,
      source: transaction.source,
      status: transaction.status,
      protected: transaction.protected,
      provenanceHash: transaction.provenanceHash ?? null,
      lifecycleStatus: transaction.lifecycleStatus ?? 'posted',
      lifecycleReason: transaction.lifecycleReason ?? null,
      lifecycleChangedAt: transaction.lifecycleChangedAt ?? null,
      moneyMovementKind: transaction.moneyMovementKind ?? null,
      transferLinkId: transaction.transferLinkId ?? null,
      refundOfId: transaction.refundOfId ?? null,
      reversalOfId: transaction.reversalOfId ?? null,
      duplicateOfId: transaction.duplicateOfId ?? null,
      replacesId: transaction.replacesId ?? null,
      replacedById: transaction.replacedById ?? null,
      manuallyCorrectedAt: transaction.manuallyCorrectedAt ?? null,
      providerUpdatedAt: transaction.providerUpdatedAt ?? null,
      splits: transaction.splits ?? null,
    })),
    importDrafts: state.importDrafts.map((draft) => ({
      rowId: draft.rowId,
      interpretation: draft.interpretation,
      amountMinor: draft.amountMinor,
      authorityState: draft.authorityState,
      reviewState: draft.reviewState,
      userConfirmationState: draft.userConfirmationState,
      parserIssues: draft.parserIssues,
      status: draft.status,
      provenanceHash: draft.provenanceHash,
    })),
    rejectedImports: state.rejectedImports.map((rejected) => ({
      rowId: rejected.rowId,
      interpretation: rejected.interpretation,
      amountMinor: rejected.amountMinor,
      provenanceHash: rejected.provenanceHash,
      rejectedAt: rejected.rejectedAt,
      rejectionReason: rejected.rejectionReason,
      status: rejected.status,
      restoreCount: rejected.restoreCount,
    })),
    documentStages: state.documentStages.map((stage) => ({
      id: stage.id,
      filename: stage.filename,
      mediaType: stage.mediaType,
      byteSize: stage.byteSize,
      storageState: stage.storageState,
      textDigest: stage.textDigest,
    })),
    historyHead: state.history.slice(0, 8).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
    })),
  });
}

export function createLocalLedgerPortableVault(
  state: LocalLedgerState,
  exportedAt = new Date('2026-06-21T12:00:00.000Z'),
  workspaceId: WorkspaceId = localLedgerWorkspaceId,
): LocalLedgerVaultEnvelope {
  const checkedWorkspaceId = requireLocalLedgerWorkspaceId(workspaceId);
  const route = buildLocalRouteSummary(state);
  const dataVersion = createLocalLedgerDataVersion(state);

  return {
    format: 'folio.mobile_local_vault',
    formatVersion: 1,
    exportedAt: exportedAt.toISOString(),
    schemaVersion: localLedgerSchemaVersion,
    dataVersion,
    tables: [
      createLocalVaultTable('workspaces', [
        {
          id: checkedWorkspaceId,
          name:
            String(checkedWorkspaceId) === String(localLedgerWorkspaceId) ? 'Personal' : 'Business',
          currency: state.currency,
          as_of_date: state.asOfDate,
          cash_on_hand_minor: state.cashOnHandMinor,
        },
      ]),
      createLocalVaultTable(
        'transactions',
        state.transactions.map((transaction) => ({
          workspace_id: checkedWorkspaceId,
          id: transaction.id,
          title: transaction.title,
          amount_minor: transaction.amountMinor,
          posted_date: transaction.date,
          source: transaction.source,
          status: transaction.status,
          protected_in_route: transaction.protected,
          original: transaction.original ?? null,
          provenance_hash: transaction.provenanceHash ?? null,
          splits_json: JSON.stringify(transaction.splits ?? []),
        })),
      ),
      createLocalVaultTable(
        'import_drafts',
        state.importDrafts.map((draft) => ({
          workspace_id: checkedWorkspaceId,
          row_id: draft.rowId,
          transaction_id: draft.transactionId,
          original: draft.original,
          interpretation: draft.interpretation,
          amount_minor: draft.amountMinor,
          posted_date: draft.date,
          authority_state: draft.authorityState,
          review_state: draft.reviewState,
          user_confirmation_state: draft.userConfirmationState,
          parser_issues_json: JSON.stringify(draft.parserIssues),
          status: draft.status,
          provenance_hash: draft.provenanceHash,
          search_text: draft.searchText,
          reasons_json: JSON.stringify(draft.reasons),
        })),
      ),
      createLocalVaultTable(
        'rejected_imports',
        state.rejectedImports.map((rejected) => ({
          workspace_id: checkedWorkspaceId,
          row_id: rejected.rowId,
          transaction_id: rejected.transactionId,
          original: rejected.original,
          interpretation: rejected.interpretation,
          amount_minor: rejected.amountMinor,
          posted_date: rejected.date,
          authority_state: rejected.authorityState,
          review_state: rejected.reviewState,
          user_confirmation_state: rejected.userConfirmationState,
          parser_issues_json: JSON.stringify(rejected.parserIssues),
          status: rejected.status,
          provenance_hash: rejected.provenanceHash,
          search_text: rejected.searchText,
          reasons_json: JSON.stringify(rejected.reasons),
          rejected_at: rejected.rejectedAt,
          rejection_reason: rejected.rejectionReason,
          restore_count: rejected.restoreCount,
          non_financial: true,
        })),
      ),
      createLocalVaultTable(
        'document_stages',
        state.documentStages.map((stage) => ({
          workspace_id: checkedWorkspaceId,
          id: stage.id,
          filename: stage.filename,
          media_type: stage.mediaType,
          byte_size: stage.byteSize,
          staged_at: stage.stagedAt,
          storage_state: stage.storageState,
          text_digest: stage.textDigest,
        })),
      ),
      createLocalVaultTable('forecast_snapshots', [
        {
          workspace_id: checkedWorkspaceId,
          kind: 'today',
          data_version: dataVersion,
          available_now_minor: route.availableNowMinor,
          tightest_day: route.tightestDay,
          tightest_balance_minor: route.tightestBalanceMinor,
          confirmed_transaction_count: route.confirmedTransactionCount,
          pending_review_count: route.pendingReviewCount,
          route_point_count: route.points.length,
          protected_items_json: JSON.stringify(route.protectedItems),
        },
      ]),
      createLocalVaultTable('search_index', [
        ...state.transactions.map((transaction) => ({
          workspace_id: checkedWorkspaceId,
          entity_type: 'transaction',
          entity_id: transaction.id,
          title: transaction.title,
          body: transaction.original ?? '',
          tags: `${transaction.source} ${transaction.status}`,
        })),
        ...state.importDrafts.map((draft) => ({
          workspace_id: checkedWorkspaceId,
          entity_type: 'import_draft',
          entity_id: draft.rowId,
          title: draft.interpretation,
          body: draft.original,
          tags: `${draft.authorityState} ${draft.reviewState} ${draft.status}`,
        })),
        ...state.rejectedImports.map((rejected) => ({
          workspace_id: checkedWorkspaceId,
          entity_type: 'rejected_import',
          entity_id: rejected.rowId,
          title: rejected.interpretation,
          body: rejected.original,
          tags: `evidence history ${rejected.status} ${rejected.rejectionReason}`,
        })),
        ...state.documentStages.map((stage) => ({
          workspace_id: checkedWorkspaceId,
          entity_type: 'document_stage',
          entity_id: stage.id,
          title: stage.filename,
          body: stage.textDigest,
          tags: `${stage.mediaType} ${stage.storageState}`,
        })),
      ]),
      createLocalVaultTable(
        'audit_log',
        state.history.map((entry) => ({
          workspace_id: checkedWorkspaceId,
          id: entry.id,
          command_type: entry.kind,
          actor_kind: entry.kind === 'import_suggested' ? 'local_melo' : 'user',
          label: entry.label,
          created_at: entry.createdAt,
        })),
      ),
    ],
  };
}

export function validateLocalLedgerVault(
  input: LocalLedgerVaultEnvelope,
  expectedWorkspaceId?: WorkspaceId,
): LocalLedgerVaultValidation {
  const issues: string[] = [];
  if (input.format !== 'folio.mobile_local_vault') {
    issues.push('Local vault format is not supported.');
  }
  if (input.formatVersion !== 1) {
    issues.push('Local vault format version must be 1.');
  }
  if (input.schemaVersion !== localLedgerSchemaVersion) {
    issues.push('Local vault schema version is not supported.');
  }
  if (!input.dataVersion.startsWith('local-hash:')) {
    issues.push('Local vault data version is missing.');
  }
  if (Number.isNaN(Date.parse(input.exportedAt))) {
    issues.push('Local vault exportedAt must be an ISO date string.');
  }
  const workspaceRows = input.tables.find((table) => table.name === 'workspaces')?.rows ?? [];
  const rawWorkspaceId = workspaceRows.length === 1 ? workspaceRows[0]?.['id'] : undefined;
  let vaultWorkspaceId: WorkspaceId | undefined;
  if (typeof rawWorkspaceId !== 'string') {
    issues.push('Local vault must contain exactly one valid workspace row.');
  } else {
    try {
      vaultWorkspaceId = requireLocalLedgerWorkspaceId(createWorkspaceId(rawWorkspaceId));
    } catch {
      issues.push('Local vault workspace ID is invalid.');
    }
  }
  if (
    expectedWorkspaceId !== undefined &&
    vaultWorkspaceId !== undefined &&
    String(vaultWorkspaceId) !== String(requireLocalLedgerWorkspaceId(expectedWorkspaceId))
  ) {
    issues.push('Local vault belongs to a different workspace.');
  }
  for (const table of input.tables) {
    if (table.rowCount !== table.rows.length) {
      issues.push(`Local vault table ${table.name} rowCount is inconsistent.`);
    }
    if (!table.checksum.startsWith('local-hash:')) {
      issues.push(`Local vault table ${table.name} checksum is missing.`);
    }
    for (const row of table.rows) {
      if (
        row.workspace_id !== undefined &&
        (vaultWorkspaceId === undefined || String(row.workspace_id) !== String(vaultWorkspaceId))
      ) {
        issues.push(`Local vault table ${table.name} has a row outside the local workspace.`);
        break;
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function summariseLocalLedgerVault(
  state: LocalLedgerState,
  workspaceId: WorkspaceId = localLedgerWorkspaceId,
): LocalLedgerVaultSummary {
  const vault = createLocalLedgerPortableVault(state, undefined, workspaceId);
  const tableRows = new Map(vault.tables.map((table) => [table.name, table.rowCount]));

  return {
    dataVersion: vault.dataVersion,
    exportedAt: vault.exportedAt,
    transactionRows: tableRows.get('transactions') ?? 0,
    importDraftRows: tableRows.get('import_drafts') ?? 0,
    rejectedImportRows: tableRows.get('rejected_imports') ?? 0,
    documentStageRows: tableRows.get('document_stages') ?? 0,
    historyRows: tableRows.get('audit_log') ?? 0,
    searchRows: tableRows.get('search_index') ?? 0,
    validation: validateLocalLedgerVault(vault, workspaceId),
  };
}

function createLocalVaultTable(
  name: string,
  rows: readonly Readonly<Record<string, unknown>>[],
): LocalLedgerVaultTable {
  return {
    name,
    rowCount: rows.length,
    rows,
    checksum: createStableLocalHash({ name, rows }),
  };
}

function createStableLocalHash(input: unknown): string {
  const source = stableStringify(input);
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `local-hash:${hash.toString(16).padStart(8, '0')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

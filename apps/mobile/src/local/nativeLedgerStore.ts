import { open } from '@op-engineering/op-sqlite';
import { Platform } from 'react-native';
import { migrateCanonicalSnapshotToSqliteRepository } from '@folio/storage';

import type {
  LocalDocumentStage,
  LocalHistoryEntry,
  LocalImportDraft,
  LocalImportRejectionReason,
  LocalImportSummary,
  LocalLedgerState,
  LocalLedgerTransaction,
  LocalRejectedImportEvidence,
} from './localLedger';
import { createCanonicalMobileLedgerSnapshot } from './canonicalLedgerAdapter';
import { createCanonicalRepositoryForMobileSnapshot } from './canonicalLedgerRepository';
import { createLocalLedgerDataVersion, localLedgerWorkspaceId } from './localLedgerVault';
import {
  getLastLocalDatabaseKeyState,
  resolveLocalLedgerEncryptionKey,
} from './nativeLocalSecurity';
import { OpSqliteDatabaseDriver } from './nativeSqliteDriver';

const databaseName = 'folio_local_ledger.sqlite';
const snapshotId = 'current';

type SnapshotRow = Readonly<{
  json?: unknown;
}>;

type MetadataRow = Readonly<{
  as_of_date?: unknown;
  cash_on_hand_minor?: unknown;
  currency?: unknown;
  import_issue_count?: unknown;
  last_import_summary_json?: unknown;
}>;

type TransactionRow = Readonly<{
  id?: unknown;
  title?: unknown;
  amount_minor?: unknown;
  posted_date?: unknown;
  source?: unknown;
  status?: unknown;
  protected_in_route?: unknown;
  original?: unknown;
  provenance_hash?: unknown;
}>;

type ImportDraftRow = Readonly<{
  row_id?: unknown;
  transaction_id?: unknown;
  original?: unknown;
  interpretation?: unknown;
  amount_minor?: unknown;
  posted_date?: unknown;
  authority_state?: unknown;
  review_state?: unknown;
  user_confirmation_state?: unknown;
  parser_issues_json?: unknown;
  status?: unknown;
  provenance_hash?: unknown;
  search_text?: unknown;
  reasons_json?: unknown;
}>;

type RejectedImportRow = Readonly<{
  row_id?: unknown;
  transaction_id?: unknown;
  original?: unknown;
  interpretation?: unknown;
  amount_minor?: unknown;
  posted_date?: unknown;
  authority_state?: unknown;
  parser_issues_json?: unknown;
  status?: unknown;
  provenance_hash?: unknown;
  search_text?: unknown;
  reasons_json?: unknown;
  rejected_at?: unknown;
  rejection_reason?: unknown;
  restore_count?: unknown;
}>;

type HistoryRow = Readonly<{
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  created_at?: unknown;
}>;

type DocumentStageRow = Readonly<{
  id?: unknown;
  filename?: unknown;
  media_type?: unknown;
  byte_size?: unknown;
  staged_at?: unknown;
  storage_state?: unknown;
  text_digest?: unknown;
}>;

export async function loadLocalLedgerState(): Promise<LocalLedgerState | null> {
  if (Platform.OS === 'web') return null;

  const encryptionKey = await resolveLocalLedgerEncryptionKey();
  if (getLastLocalDatabaseKeyState() === 'secure_store_unavailable_fallback') return null;
  return loadLocalLedgerStateWithKey(encryptionKey);
}

export async function saveLocalLedgerState(state: LocalLedgerState): Promise<void> {
  if (Platform.OS === 'web') return;

  const encryptionKey = await resolveLocalLedgerEncryptionKey();
  if (getLastLocalDatabaseKeyState() === 'secure_store_unavailable_fallback') {
    throw new Error('Device key storage is unavailable. Local records are memory-only.');
  }
  await saveLocalLedgerStateWithKey(state, encryptionKey);
}

// Unconditionally wipe every local-ledger table so the app can recover from an unusable saved
// picture (the "Start fresh" path on the error boundary). Deletes ignore the workspace id so a
// row stored under any workspace, version or seed is cleared.
const localLedgerTableNames = [
  'canonical_mobile_ledger_snapshot',
  'local_ledger_document_stages',
  'local_ledger_history',
  'local_ledger_import_drafts',
  'local_ledger_metadata',
  'local_ledger_rejected_imports',
  'local_ledger_search_index',
  'local_ledger_snapshot',
  'local_ledger_transactions',
] as const;

export async function clearLocalLedgerStorage(): Promise<void> {
  if (Platform.OS === 'web') return;

  const encryptionKey = await resolveLocalLedgerEncryptionKey();
  if (getLastLocalDatabaseKeyState() === 'secure_store_unavailable_fallback') return;

  const db = open({ name: databaseName, encryptionKey });
  try {
    for (const table of localLedgerTableNames) {
      try {
        await db.execute(`DELETE FROM ${table}`);
      } catch {
        // The table may not exist yet on a fresh install; ignore and continue.
      }
    }
  } finally {
    db.close();
  }
}

async function loadLocalLedgerStateWithKey(
  encryptionKey: string,
): Promise<LocalLedgerState | null> {
  const db = open({
    name: databaseName,
    encryptionKey,
  });

  try {
    await ensureSnapshotTable(db);
    await ensureCanonicalSnapshotTable(db);
    await ensureLocalLedgerTables(db);
    const normalized = await loadNormalizedLedgerState(db);
    if (normalized !== null) {
      await migrateLoadedLocalLedgerStateToCanonicalSqlite(db, normalized);
      return normalized;
    }

    const result = await db.execute('SELECT json FROM local_ledger_snapshot WHERE id = ?', [
      snapshotId,
    ]);
    const row = result.rows[0] as SnapshotRow | undefined;
    if (typeof row?.json !== 'string') return null;
    const parsed = JSON.parse(row.json);
    if (!isLocalLedgerState(parsed)) return null;
    const snapshotState = normalizeLocalLedgerState(parsed);
    await migrateLoadedLocalLedgerStateToCanonicalSqlite(db, snapshotState);
    return snapshotState;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

async function saveLocalLedgerStateWithKey(
  state: LocalLedgerState,
  encryptionKey: string,
): Promise<void> {
  const db = open({
    name: databaseName,
    encryptionKey,
  });

  try {
    await ensureSnapshotTable(db);
    await ensureCanonicalSnapshotTable(db);
    await ensureLocalLedgerTables(db);
    const driver = new OpSqliteDatabaseDriver(db);
    await driver.transaction(async (transactionDriver) => {
      const canonicalSnapshot = createCanonicalMobileLedgerSnapshot(state);
      if (!canonicalSnapshot.validation.valid) {
        throw new Error(
          `Canonical local ledger validation failed: ${canonicalSnapshot.validation.issues.join(' ')}`,
        );
      }
      await migrateCanonicalSnapshotToSqliteRepository(
        transactionDriver,
        createCanonicalRepositoryForMobileSnapshot(canonicalSnapshot).snapshot(),
      );
      await db.execute(
        `
          INSERT OR REPLACE INTO local_ledger_snapshot (id, json, updated_at)
          VALUES (?, ?, ?)
        `,
        [snapshotId, JSON.stringify(state), new Date().toISOString()],
      );
      await db.execute(
        `
          INSERT OR REPLACE INTO canonical_mobile_ledger_snapshot (
            id, schema, data_version, json, updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          snapshotId,
          canonicalSnapshot.schema,
          canonicalSnapshot.dataVersion,
          JSON.stringify(canonicalSnapshot),
          new Date().toISOString(),
        ],
      );
      await saveNormalizedLedgerState(db, state);
    });
  } finally {
    db.close();
  }
}

async function migrateLoadedLocalLedgerStateToCanonicalSqlite(
  db: ReturnType<typeof open>,
  state: LocalLedgerState,
): Promise<void> {
  const canonicalSnapshot = createCanonicalMobileLedgerSnapshot(state);
  if (!canonicalSnapshot.validation.valid) {
    throw new Error(
      `Canonical local ledger validation failed: ${canonicalSnapshot.validation.issues.join(' ')}`,
    );
  }
  await migrateCanonicalSnapshotToSqliteRepository(
    new OpSqliteDatabaseDriver(db),
    createCanonicalRepositoryForMobileSnapshot(canonicalSnapshot).snapshot(),
  );
}

async function ensureSnapshotTable(db: ReturnType<typeof open>): Promise<void> {
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_snapshot (
        id TEXT PRIMARY KEY NOT NULL,
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `,
  );
}

async function ensureCanonicalSnapshotTable(db: ReturnType<typeof open>): Promise<void> {
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS canonical_mobile_ledger_snapshot (
        id TEXT PRIMARY KEY NOT NULL,
        schema TEXT NOT NULL,
        data_version TEXT NOT NULL,
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `,
  );
}

async function ensureLocalLedgerTables(db: ReturnType<typeof open>): Promise<void> {
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_metadata (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        as_of_date TEXT NOT NULL,
        cash_on_hand_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        import_issue_count INTEGER NOT NULL,
        last_import_summary_json TEXT,
        data_version TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `,
  );
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_transactions (
        workspace_id TEXT NOT NULL,
        id TEXT PRIMARY KEY NOT NULL,
        sort_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        posted_date TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        protected_in_route INTEGER NOT NULL,
        original TEXT,
        provenance_hash TEXT
      )
    `,
  );
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_import_drafts (
        workspace_id TEXT NOT NULL,
        row_id TEXT PRIMARY KEY NOT NULL,
        sort_order INTEGER NOT NULL,
        transaction_id TEXT NOT NULL,
        original TEXT NOT NULL,
        interpretation TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        posted_date TEXT NOT NULL,
        authority_state TEXT NOT NULL,
        review_state TEXT NOT NULL,
        user_confirmation_state TEXT NOT NULL,
        parser_issues_json TEXT NOT NULL,
        status TEXT NOT NULL,
        provenance_hash TEXT NOT NULL,
        search_text TEXT NOT NULL,
        reasons_json TEXT NOT NULL
      )
    `,
  );
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_rejected_imports (
        workspace_id TEXT NOT NULL,
        row_id TEXT PRIMARY KEY NOT NULL,
        sort_order INTEGER NOT NULL,
        transaction_id TEXT NOT NULL,
        original TEXT NOT NULL,
        interpretation TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        posted_date TEXT NOT NULL,
        authority_state TEXT NOT NULL,
        parser_issues_json TEXT NOT NULL,
        status TEXT NOT NULL,
        provenance_hash TEXT NOT NULL,
        search_text TEXT NOT NULL,
        reasons_json TEXT NOT NULL,
        rejected_at TEXT NOT NULL,
        rejection_reason TEXT NOT NULL,
        restore_count INTEGER NOT NULL
      )
    `,
  );
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_history (
        workspace_id TEXT NOT NULL,
        id TEXT PRIMARY KEY NOT NULL,
        sort_order INTEGER NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `,
  );
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_document_stages (
        workspace_id TEXT NOT NULL,
        id TEXT PRIMARY KEY NOT NULL,
        sort_order INTEGER NOT NULL,
        filename TEXT NOT NULL,
        media_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        staged_at TEXT NOT NULL,
        storage_state TEXT NOT NULL,
        text_digest TEXT NOT NULL
      )
    `,
  );
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS local_ledger_search_index (
        workspace_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tags TEXT NOT NULL,
        PRIMARY KEY (workspace_id, entity_type, entity_id)
      )
    `,
  );
}

async function loadNormalizedLedgerState(
  db: ReturnType<typeof open>,
): Promise<LocalLedgerState | null> {
  const metadataResult = await db.execute(
    `
      SELECT as_of_date, cash_on_hand_minor, currency, import_issue_count, last_import_summary_json
      FROM local_ledger_metadata
      WHERE id = ?
    `,
    [snapshotId],
  );
  const metadata = metadataResult.rows[0] as MetadataRow | undefined;
  if (metadata === undefined) return null;
  if (
    typeof metadata.as_of_date !== 'string' ||
    typeof metadata.cash_on_hand_minor !== 'number' ||
    metadata.currency !== 'GBP' ||
    typeof metadata.import_issue_count !== 'number'
  ) {
    return null;
  }

  const transactions = await db.execute(
    `
      SELECT id, title, amount_minor, posted_date, source, status, protected_in_route, original, provenance_hash
      FROM local_ledger_transactions
      WHERE workspace_id = ?
      ORDER BY sort_order
    `,
    [localLedgerWorkspaceId],
  );
  const drafts = await db.execute(
    `
      SELECT row_id, transaction_id, original, interpretation, amount_minor, posted_date, authority_state, review_state, user_confirmation_state, parser_issues_json, status, provenance_hash, search_text, reasons_json
      FROM local_ledger_import_drafts
      WHERE workspace_id = ?
      ORDER BY sort_order
    `,
    [localLedgerWorkspaceId],
  );
  const rejectedImports = await db.execute(
    `
      SELECT row_id, transaction_id, original, interpretation, amount_minor, posted_date,
        authority_state, parser_issues_json, status, provenance_hash, search_text, reasons_json,
        rejected_at, rejection_reason, restore_count
      FROM local_ledger_rejected_imports
      WHERE workspace_id = ?
      ORDER BY sort_order
    `,
    [localLedgerWorkspaceId],
  );
  const history = await db.execute(
    `
      SELECT id, kind, label, created_at
      FROM local_ledger_history
      WHERE workspace_id = ?
      ORDER BY sort_order
    `,
    [localLedgerWorkspaceId],
  );
  const documentStages = await db.execute(
    `
      SELECT id, filename, media_type, byte_size, staged_at, storage_state, text_digest
      FROM local_ledger_document_stages
      WHERE workspace_id = ?
      ORDER BY sort_order
    `,
    [localLedgerWorkspaceId],
  );

  const lastImportSummary =
    typeof metadata.last_import_summary_json === 'string'
      ? parseImportSummary(metadata.last_import_summary_json)
      : undefined;
  // Pots, subscriptions and cycles are durable containers/history that the normalized relational
  // tables do not model. They round-trip through the full JSON snapshot blob written on every save,
  // so we recover them from there (defaulting to []), keeping the SQLite schema untouched.
  const durableContainers = await loadDurableContainersFromSnapshot(db);
  const state: LocalLedgerState = {
    asOfDate: metadata.as_of_date,
    cashOnHandMinor: metadata.cash_on_hand_minor,
    currency: 'GBP',
    importIssueCount: metadata.import_issue_count,
    transactions: transactions.rows.map(rowToTransaction).filter(isPresent),
    importDrafts: drafts.rows.map(rowToImportDraft).filter(isPresent),
    rejectedImports: rejectedImports.rows.map(rowToRejectedImport).filter(isPresent),
    documentStages: documentStages.rows.map(rowToDocumentStage).filter(isPresent),
    history: history.rows.map(rowToHistoryEntry).filter(isPresent),
    pots: durableContainers.pots,
    subscriptions: durableContainers.subscriptions,
    cycles: durableContainers.cycles,
    ...(lastImportSummary === undefined ? {} : { lastImportSummary }),
  };

  return isLocalLedgerState(state) ? state : null;
}

type DurableContainers = Readonly<{
  pots: LocalLedgerState['pots'];
  subscriptions: LocalLedgerState['subscriptions'];
  cycles: LocalLedgerState['cycles'];
}>;

async function loadDurableContainersFromSnapshot(
  db: ReturnType<typeof open>,
): Promise<DurableContainers> {
  const empty: DurableContainers = { pots: [], subscriptions: [], cycles: [] };
  try {
    const result = await db.execute('SELECT json FROM local_ledger_snapshot WHERE id = ?', [
      snapshotId,
    ]);
    const row = result.rows[0] as SnapshotRow | undefined;
    if (typeof row?.json !== 'string') return empty;
    const parsed: unknown = JSON.parse(row.json);
    if (!isRecord(parsed)) return empty;
    return {
      pots: Array.isArray(parsed.pots) ? (parsed.pots as LocalLedgerState['pots']) : [],
      subscriptions: Array.isArray(parsed.subscriptions)
        ? (parsed.subscriptions as LocalLedgerState['subscriptions'])
        : [],
      cycles: Array.isArray(parsed.cycles) ? (parsed.cycles as LocalLedgerState['cycles']) : [],
    };
  } catch {
    return empty;
  }
}

async function saveNormalizedLedgerState(
  db: ReturnType<typeof open>,
  state: LocalLedgerState,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute('DELETE FROM local_ledger_transactions WHERE workspace_id = ?', [
    localLedgerWorkspaceId,
  ]);
  await db.execute('DELETE FROM local_ledger_import_drafts WHERE workspace_id = ?', [
    localLedgerWorkspaceId,
  ]);
  await db.execute('DELETE FROM local_ledger_rejected_imports WHERE workspace_id = ?', [
    localLedgerWorkspaceId,
  ]);
  await db.execute('DELETE FROM local_ledger_history WHERE workspace_id = ?', [
    localLedgerWorkspaceId,
  ]);
  await db.execute('DELETE FROM local_ledger_document_stages WHERE workspace_id = ?', [
    localLedgerWorkspaceId,
  ]);
  await db.execute('DELETE FROM local_ledger_search_index WHERE workspace_id = ?', [
    localLedgerWorkspaceId,
  ]);
  await db.execute(
    `
      INSERT OR REPLACE INTO local_ledger_metadata (
        id, workspace_id, as_of_date, cash_on_hand_minor, currency, import_issue_count,
        last_import_summary_json, data_version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      snapshotId,
      localLedgerWorkspaceId,
      state.asOfDate,
      state.cashOnHandMinor,
      state.currency,
      state.importIssueCount,
      state.lastImportSummary === undefined ? null : JSON.stringify(state.lastImportSummary),
      createLocalLedgerDataVersion(state),
      now,
    ],
  );

  for (const [index, transaction] of state.transactions.entries()) {
    await db.execute(
      `
        INSERT INTO local_ledger_transactions (
          workspace_id, id, sort_order, title, amount_minor, posted_date, source, status,
          protected_in_route, original, provenance_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        transaction.id,
        index,
        transaction.title,
        transaction.amountMinor,
        transaction.date,
        transaction.source,
        transaction.status,
        transaction.protected ? 1 : 0,
        transaction.original ?? null,
        transaction.provenanceHash ?? null,
      ],
    );
    await db.execute(
      `
        INSERT INTO local_ledger_search_index (
          workspace_id, entity_type, entity_id, title, body, tags
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        'transaction',
        transaction.id,
        transaction.title,
        transaction.original ?? '',
        `${transaction.source} ${transaction.status}`,
      ],
    );
  }

  for (const [index, draft] of state.importDrafts.entries()) {
    await db.execute(
      `
        INSERT INTO local_ledger_import_drafts (
          workspace_id, row_id, sort_order, transaction_id, original, interpretation,
          amount_minor, posted_date, authority_state, review_state, user_confirmation_state,
          parser_issues_json, status, provenance_hash, search_text, reasons_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        draft.rowId,
        index,
        draft.transactionId,
        draft.original,
        draft.interpretation,
        draft.amountMinor,
        draft.date,
        draft.authorityState,
        draft.reviewState,
        draft.userConfirmationState,
        JSON.stringify(draft.parserIssues),
        draft.status,
        draft.provenanceHash,
        draft.searchText,
        JSON.stringify(draft.reasons),
      ],
    );
    await db.execute(
      `
        INSERT INTO local_ledger_search_index (
          workspace_id, entity_type, entity_id, title, body, tags
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        'import_draft',
        draft.rowId,
        draft.interpretation,
        draft.original,
        `${draft.authorityState} ${draft.reviewState} ${draft.status}`,
      ],
    );
  }

  for (const [index, rejected] of state.rejectedImports.entries()) {
    await db.execute(
      `
        INSERT INTO local_ledger_rejected_imports (
          workspace_id, row_id, sort_order, transaction_id, original, interpretation,
          amount_minor, posted_date, authority_state, parser_issues_json, status, provenance_hash,
          search_text, reasons_json, rejected_at, rejection_reason, restore_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        rejected.rowId,
        index,
        rejected.transactionId,
        rejected.original,
        rejected.interpretation,
        rejected.amountMinor,
        rejected.date,
        rejected.authorityState,
        JSON.stringify(rejected.parserIssues),
        rejected.status,
        rejected.provenanceHash,
        rejected.searchText,
        JSON.stringify(rejected.reasons),
        rejected.rejectedAt,
        rejected.rejectionReason,
        rejected.restoreCount,
      ],
    );
    await db.execute(
      `
        INSERT INTO local_ledger_search_index (
          workspace_id, entity_type, entity_id, title, body, tags
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        'rejected_import',
        rejected.rowId,
        rejected.interpretation,
        rejected.original,
        `evidence history ${rejected.status} ${rejected.rejectionReason}`,
      ],
    );
  }

  for (const [index, entry] of state.history.entries()) {
    await db.execute(
      `
        INSERT INTO local_ledger_history (
          workspace_id, id, sort_order, kind, label, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [localLedgerWorkspaceId, entry.id, index, entry.kind, entry.label, entry.createdAt],
    );
  }

  for (const [index, stage] of state.documentStages.entries()) {
    await db.execute(
      `
        INSERT INTO local_ledger_document_stages (
          workspace_id, id, sort_order, filename, media_type, byte_size, staged_at,
          storage_state, text_digest
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        stage.id,
        index,
        stage.filename,
        stage.mediaType,
        stage.byteSize,
        stage.stagedAt,
        stage.storageState,
        stage.textDigest,
      ],
    );
    await db.execute(
      `
        INSERT INTO local_ledger_search_index (
          workspace_id, entity_type, entity_id, title, body, tags
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        localLedgerWorkspaceId,
        'document_stage',
        stage.id,
        stage.filename,
        stage.textDigest,
        `${stage.mediaType} ${stage.storageState}`,
      ],
    );
  }
}

function rowToTransaction(row: Record<string, unknown>): LocalLedgerTransaction | null {
  const candidate = row as TransactionRow;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.amount_minor !== 'number' ||
    typeof candidate.posted_date !== 'string' ||
    !isTransactionSource(candidate.source) ||
    !isTransactionStatus(candidate.status)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    title: candidate.title,
    amountMinor: candidate.amount_minor,
    date: candidate.posted_date,
    source: candidate.source,
    status: candidate.status,
    protected: candidate.protected_in_route === 1,
    ...(typeof candidate.original === 'string' ? { original: candidate.original } : {}),
    ...(typeof candidate.provenance_hash === 'string'
      ? { provenanceHash: candidate.provenance_hash }
      : {}),
  };
}

function rowToImportDraft(row: Record<string, unknown>): LocalImportDraft | null {
  const candidate = row as ImportDraftRow;
  if (
    typeof candidate.row_id !== 'string' ||
    typeof candidate.transaction_id !== 'string' ||
    typeof candidate.original !== 'string' ||
    typeof candidate.interpretation !== 'string' ||
    typeof candidate.amount_minor !== 'number' ||
    typeof candidate.posted_date !== 'string' ||
    !isDraftAuthorityState(candidate.authority_state) ||
    !isDraftReviewState(candidate.review_state) ||
    !isDraftUserConfirmationState(candidate.user_confirmation_state) ||
    typeof candidate.parser_issues_json !== 'string' ||
    !isDraftStatus(candidate.status) ||
    typeof candidate.provenance_hash !== 'string' ||
    typeof candidate.search_text !== 'string' ||
    typeof candidate.reasons_json !== 'string'
  ) {
    return null;
  }

  return {
    rowId: candidate.row_id,
    transactionId: candidate.transaction_id,
    original: candidate.original,
    interpretation: candidate.interpretation,
    amountMinor: candidate.amount_minor,
    date: candidate.posted_date,
    authorityState: candidate.authority_state,
    reviewState: candidate.review_state,
    userConfirmationState: candidate.user_confirmation_state,
    parserIssues: parseStringArray(candidate.parser_issues_json),
    status: candidate.status,
    provenanceHash: candidate.provenance_hash,
    searchText: candidate.search_text,
    reasons: parseStringArray(candidate.reasons_json),
  };
}

function rowToRejectedImport(row: Record<string, unknown>): LocalRejectedImportEvidence | null {
  const candidate = row as RejectedImportRow;
  if (
    typeof candidate.row_id !== 'string' ||
    typeof candidate.transaction_id !== 'string' ||
    typeof candidate.original !== 'string' ||
    typeof candidate.interpretation !== 'string' ||
    typeof candidate.amount_minor !== 'number' ||
    typeof candidate.posted_date !== 'string' ||
    !isDraftAuthorityState(candidate.authority_state) ||
    typeof candidate.parser_issues_json !== 'string' ||
    !isRejectedImportStatus(candidate.status) ||
    typeof candidate.provenance_hash !== 'string' ||
    typeof candidate.search_text !== 'string' ||
    typeof candidate.reasons_json !== 'string' ||
    typeof candidate.rejected_at !== 'string' ||
    !isImportRejectionReason(candidate.rejection_reason) ||
    typeof candidate.restore_count !== 'number'
  ) {
    return null;
  }

  return {
    rowId: candidate.row_id,
    transactionId: candidate.transaction_id,
    original: candidate.original,
    interpretation: candidate.interpretation,
    amountMinor: candidate.amount_minor,
    date: candidate.posted_date,
    authorityState: candidate.authority_state,
    reviewState: 'dismissed',
    userConfirmationState: 'rejected',
    parserIssues: parseStringArray(candidate.parser_issues_json),
    status: candidate.status,
    provenanceHash: candidate.provenance_hash,
    searchText: candidate.search_text,
    reasons: parseStringArray(candidate.reasons_json),
    rejectedAt: candidate.rejected_at,
    rejectionReason: candidate.rejection_reason,
    restoreCount: Math.max(0, Math.round(candidate.restore_count)),
  };
}

function rowToHistoryEntry(row: Record<string, unknown>): LocalHistoryEntry | null {
  const candidate = row as HistoryRow;
  if (
    typeof candidate.id !== 'string' ||
    !isHistoryKind(candidate.kind) ||
    typeof candidate.label !== 'string' ||
    typeof candidate.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    kind: candidate.kind,
    label: candidate.label,
    createdAt: candidate.created_at,
  };
}

function rowToDocumentStage(row: Record<string, unknown>): LocalDocumentStage | null {
  const candidate = row as DocumentStageRow;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.filename !== 'string' ||
    typeof candidate.media_type !== 'string' ||
    typeof candidate.byte_size !== 'number' ||
    typeof candidate.staged_at !== 'string' ||
    !isDocumentStorageState(candidate.storage_state) ||
    typeof candidate.text_digest !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    filename: candidate.filename,
    mediaType: candidate.media_type,
    byteSize: candidate.byte_size,
    stagedAt: candidate.staged_at,
    storageState: candidate.storage_state,
    textDigest: candidate.text_digest,
  };
}

function parseImportSummary(value: string): LocalImportSummary | undefined {
  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) return undefined;
    if (
      typeof parsed.parsedRows !== 'number' ||
      typeof parsed.readyForAcceptance !== 'number' ||
      typeof parsed.needsUserReview !== 'number' ||
      typeof parsed.parseIssues !== 'number' ||
      typeof parsed.parserName !== 'string'
    ) {
      return undefined;
    }
    return {
      parsedRows: parsed.parsedRows,
      readyForAcceptance: parsed.readyForAcceptance,
      needsUserReview: parsed.needsUserReview,
      parseIssues: parsed.parseIssues,
      parserName: parsed.parserName,
      skippedRows: typeof parsed.skippedRows === 'number' ? Math.max(0, parsed.skippedRows) : 0,
    };
  } catch {
    return undefined;
  }
}

function parseStringArray(value: string): readonly string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function isTransactionSource(value: unknown): value is LocalLedgerTransaction['source'] {
  return value === 'seed' || value === 'manual' || value === 'import';
}

function isTransactionStatus(value: unknown): value is LocalLedgerTransaction['status'] {
  return value === 'confirmed' || value === 'needs_review';
}

function isDraftAuthorityState(value: unknown): value is LocalImportDraft['authorityState'] {
  return (
    value === 'imported-claim' ||
    value === 'estimated' ||
    value === 'inferred' ||
    value === 'user-confirmed'
  );
}

function isDraftReviewState(value: unknown): value is LocalImportDraft['reviewState'] {
  return value === 'ready-for-user-confirmation' || value === 'needs-review';
}

function isDraftUserConfirmationState(
  value: unknown,
): value is LocalImportDraft['userConfirmationState'] {
  return value === 'not-requested' || value === 'requested' || value === 'confirmed';
}

function isDraftStatus(value: unknown): value is LocalImportDraft['status'] {
  return value === 'Ready to confirm' || value === 'Needs review';
}

function isRejectedImportStatus(value: unknown): value is LocalRejectedImportEvidence['status'] {
  return value === 'Rejected' || value === 'Excluded';
}

function isImportRejectionReason(value: unknown): value is LocalImportRejectionReason {
  return (
    value === 'duplicate' ||
    value === 'wrong-workspace' ||
    value === 'transfer-internal' ||
    value === 'irrelevant-document' ||
    value === 'parser-error' ||
    value === 'not-mine' ||
    value === 'other'
  );
}

function isHistoryKind(value: unknown): value is LocalHistoryEntry['kind'] {
  return (
    value === 'manual_added' ||
    value === 'recovery_recorded' ||
    value === 'planner_added' ||
    value === 'import_staged' ||
    value === 'import_confirmed' ||
    value === 'import_dismissed' ||
    value === 'import_edited' ||
    value === 'import_restored' ||
    value === 'import_suggested' ||
    value === 'document_staged'
  );
}

function isDocumentStorageState(value: unknown): value is LocalDocumentStage['storageState'] {
  return value === 'copied_to_app_cache' || value === 'pasted_text';
}

function isLocalLedgerState(value: unknown): value is LocalLedgerState {
  if (!isRecord(value)) return false;
  return (
    value.currency === 'GBP' &&
    typeof value.asOfDate === 'string' &&
    typeof value.cashOnHandMinor === 'number' &&
    Array.isArray(value.transactions) &&
    Array.isArray(value.importDrafts) &&
    (value.rejectedImports === undefined || Array.isArray(value.rejectedImports)) &&
    (value.documentStages === undefined || Array.isArray(value.documentStages)) &&
    // Durable containers/history are optional on disk for backward compatibility — older saved
    // pictures predate them, so absent is fine; normalizeLocalLedgerState defaults them to [].
    (value.pots === undefined || Array.isArray(value.pots)) &&
    (value.subscriptions === undefined || Array.isArray(value.subscriptions)) &&
    (value.cycles === undefined || Array.isArray(value.cycles)) &&
    Array.isArray(value.history)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeLocalLedgerState(state: LocalLedgerState): LocalLedgerState {
  return {
    ...state,
    documentStages: Array.isArray(state.documentStages) ? state.documentStages : [],
    rejectedImports: Array.isArray(state.rejectedImports) ? state.rejectedImports : [],
    pots: Array.isArray(state.pots) ? state.pots : [],
    subscriptions: Array.isArray(state.subscriptions) ? state.subscriptions : [],
    cycles: Array.isArray(state.cycles) ? state.cycles : [],
  };
}

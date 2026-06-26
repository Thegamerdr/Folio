export type StatementPathChoiceId =
  | 'statement_file'
  | 'statement_photo_later'
  | 'manual_three_fact_fallback';

export type StatementPathAvailability = 'ready' | 'blocked_by_native' | 'fallback';

export type StatementPathChoice = Readonly<{
  id: StatementPathChoiceId;
  title: string;
  summary: string;
  availability: StatementPathAvailability;
  requiresNativeCapability: boolean;
  safeCopy: string;
}>;

export type StatementFileKind = 'csv' | 'tsv' | 'txt' | 'ofx' | 'qif' | 'pdf' | 'image' | 'unknown';

export type StatementFileSelection = Readonly<{
  uri: string;
  name: string;
  kind: StatementFileKind;
  sizeBytes?: number;
  encrypted?: boolean;
  providedByNativePicker?: boolean;
}>;

export type StatementCopyBlockerKind =
  | 'encrypted_file'
  | 'no_file_selected'
  | 'unsupported_statement_type';

export type StatementCopyBlocker = Readonly<{
  kind: StatementCopyBlockerKind;
  title: string;
  safeCopy: string;
}>;

export type StatementCopyPlan =
  | Readonly<{
      state: 'ready_to_stage';
      sourceName: string;
      statementKind: Extract<StatementFileKind, 'csv' | 'tsv' | 'txt'>;
      safeCopy: string;
    }>
  | Readonly<{
      state: 'blocked';
      sourceName: string;
      blocker: StatementCopyBlocker;
    }>;

export type ImportReviewSeverity = 'info' | 'needs_review' | 'blocked';

export type ImportReviewIssueCode =
  | 'source_needs_review'
  | 'possible_duplicate'
  | 'missing_date'
  | 'missing_description'
  | 'missing_amount'
  | 'unsupported_currency'
  | 'encrypted_source'
  | 'native_blocked';

export type ImportReviewIssue = Readonly<{
  code: ImportReviewIssueCode;
  severity: ImportReviewSeverity;
  message: string;
}>;

export type ImportStagingProposal = Readonly<{
  id: string;
  postedOn?: string;
  description?: string;
  amountMinor?: number;
  currency?: string;
  accountLabel?: string;
  sourceQuality?: 'source-clear' | 'needs-review' | 'unsupported';
  duplicateOfId?: string;
  issues?: readonly ImportReviewIssue[];
}>;

export type ImportReviewRowState = 'ready' | 'needs_review' | 'blocked';

export type ImportReviewRow = Readonly<{
  id: string;
  title: string;
  amountLabel: string;
  dateLabel: string;
  accountLabel: string;
  state: ImportReviewRowState;
  badges: readonly string[];
  screenReaderSummary: string;
  largeTextSummary: string;
}>;

export type ImportReviewTotals = Readonly<{
  totalRows: number;
  readyRows: number;
  needsReviewRows: number;
  blockedRows: number;
}>;

export type Phase5GateMetadata = Readonly<{
  phase: 'phase5';
  slice: 'mobile-import-review-adapter';
  owns: readonly string[];
  screenIntegration: true;
  nativeDependencies: boolean;
  filePicker: boolean;
  realPermissions: boolean;
  importEngineContract: readonly string[];
}>;

export type Phase5ProofRow = Readonly<{
  label: string;
  value: string;
  state: 'implemented' | 'blocked';
}>;

export type ImportReviewShellState = Readonly<{
  statementPathChoices: readonly StatementPathChoice[];
  copyPlan: StatementCopyPlan;
  rows: readonly ImportReviewRow[];
  totals: ImportReviewTotals;
  gate: Phase5GateMetadata;
}>;

export const phase5GateMetadata: Phase5GateMetadata = {
  phase: 'phase5',
  slice: 'mobile-import-review-adapter',
  owns: ['apps/mobile/app/index.tsx', 'apps/mobile/src/phase5/**'],
  screenIntegration: true,
  nativeDependencies: true,
  filePicker: true,
  realPermissions: true,
  importEngineContract: [
    'accepts statement source metadata from the Android system document picker',
    'accepts reviewable transaction proposals from @folio/import-engine for CSV-like text files',
    'never writes accepted rows directly to storage',
  ],
};

export const phase5SampleReviewProposals: readonly ImportStagingProposal[] = [
  {
    id: 'sample_import_ready',
    postedOn: '2026-06-18',
    description: 'Coffee shop',
    amountMinor: -425,
    currency: 'GBP',
    accountLabel: 'Current account',
    sourceQuality: 'source-clear',
  },
  {
    id: 'sample_import_duplicate',
    postedOn: '2026-06-18',
    description: 'Card payment coffee shop',
    amountMinor: -425,
    currency: 'GBP',
    accountLabel: 'Current account',
    sourceQuality: 'needs-review',
    duplicateOfId: 'transaction_existing_coffee',
  },
  {
    id: 'sample_import_blocked',
    description: '',
    currency: 'GBP',
    accountLabel: 'Current account',
    sourceQuality: 'unsupported',
  },
];

export const phase5ProofRows: readonly Phase5ProofRow[] = [
  {
    label: 'Review shell',
    value: 'integrated in Expo screen with review-gated commit',
    state: 'implemented',
  },
  {
    label: 'CSV/TXT picker',
    value: 'Android system picker connected with paste fallback',
    state: 'implemented',
  },
  {
    label: 'Real commit',
    value: 'implemented for local reviewed rows; package storage vault repository still blocked',
    state: 'implemented',
  },
];

export const statementPathChoices: readonly StatementPathChoice[] = [
  {
    id: 'statement_file',
    title: 'Choose a CSV/TXT statement',
    summary: 'CSV-like text files are staged for review before any transaction is saved.',
    availability: 'ready',
    requiresNativeCapability: true,
    safeCopy: 'Uses the Android system picker; no broad storage permission is requested.',
  },
  {
    id: 'statement_photo_later',
    title: 'PDF, scan or photo later',
    summary: 'PDF, image and OCR import need native document extraction before staging.',
    availability: 'blocked_by_native',
    requiresNativeCapability: true,
    safeCopy: 'Camera, PDF extraction and OCR are not requested in this APK.',
  },
  {
    id: 'manual_three_fact_fallback',
    title: 'Use quick start instead',
    summary: 'Continue with available now, next income and next important outgoing.',
    availability: 'fallback',
    requiresNativeCapability: false,
    safeCopy: 'No file permission needed.',
  },
];

export function buildStatementCopyPlan(
  selection: StatementFileSelection | null,
): StatementCopyPlan {
  if (selection === null || selection.providedByNativePicker !== true) {
    return {
      state: 'blocked',
      sourceName: selection?.name ?? 'No file selected',
      blocker: {
        kind: 'no_file_selected',
        title: 'No statement selected',
        safeCopy: 'Choose a CSV/TXT file or paste text to stage rows for review.',
      },
    };
  }

  if (selection.encrypted === true) {
    return {
      state: 'blocked',
      sourceName: selection.name,
      blocker: {
        kind: 'encrypted_file',
        title: 'Encrypted statement needs the bank export',
        safeCopy:
          'This file is password protected. Export an unlocked statement from your bank and try again.',
      },
    };
  }

  if (!isStageableStatementKind(selection.kind)) {
    return {
      state: 'blocked',
      sourceName: selection.name,
      blocker: {
        kind: 'unsupported_statement_type',
        title: 'Statement type not supported yet',
        safeCopy:
          'Use a CSV, TSV or plain text statement in this APK. PDF, image and OCR import come later.',
      },
    };
  }

  return {
    state: 'ready_to_stage',
    sourceName: selection.name,
    statementKind: selection.kind,
    safeCopy: 'Statement text can be copied into encrypted local staging before review.',
  };
}

export function buildImportReviewShellState(input: {
  selection: StatementFileSelection | null;
  proposals: readonly ImportStagingProposal[];
}): ImportReviewShellState {
  const copyPlan = buildStatementCopyPlan(input.selection);
  const sourceIssues: readonly ImportReviewIssue[] =
    copyPlan.state === 'blocked'
      ? [
          {
            code:
              copyPlan.blocker.kind === 'encrypted_file' ? 'encrypted_source' : 'native_blocked',
            severity: 'blocked',
            message: copyPlan.blocker.safeCopy,
          },
        ]
      : [];
  const rows = input.proposals.map((proposal) =>
    buildImportReviewRow({
      ...proposal,
      issues: [...sourceIssues, ...(proposal.issues ?? [])],
    }),
  );

  return {
    statementPathChoices,
    copyPlan,
    rows,
    totals: summarizeRows(rows),
    gate: phase5GateMetadata,
  };
}

export function buildImportReviewRow(proposal: ImportStagingProposal): ImportReviewRow {
  const issues = inferProposalIssues(proposal);
  const state = resolveRowState(issues);
  const title = readableDescription(proposal.description);
  const amountLabel =
    proposal.amountMinor === undefined || proposal.currency === undefined
      ? 'Amount missing'
      : formatMoney(proposal.amountMinor, proposal.currency);
  const dateLabel = proposal.postedOn ?? 'Date missing';
  const accountLabel = proposal.accountLabel ?? 'Account to confirm';
  const badges = buildBadges(proposal, issues);
  const reviewText = renderRowState(state);

  return {
    id: proposal.id,
    title,
    amountLabel,
    dateLabel,
    accountLabel,
    state,
    badges,
    screenReaderSummary: [
      title,
      amountLabel,
      `on ${dateLabel}`,
      accountLabel,
      reviewText,
      ...issues.map((issue) => issue.message),
    ].join('. '),
    largeTextSummary: `${dateLabel} | ${amountLabel} | ${title} | ${reviewText}`,
  };
}

export function summarizeRows(rows: readonly ImportReviewRow[]): ImportReviewTotals {
  return rows.reduce(
    (totals, row) => ({
      totalRows: totals.totalRows + 1,
      readyRows: totals.readyRows + (row.state === 'ready' ? 1 : 0),
      needsReviewRows: totals.needsReviewRows + (row.state === 'needs_review' ? 1 : 0),
      blockedRows: totals.blockedRows + (row.state === 'blocked' ? 1 : 0),
    }),
    { totalRows: 0, readyRows: 0, needsReviewRows: 0, blockedRows: 0 },
  );
}

export function formatMoney(minorUnits: number, currency: string): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  const major = Math.floor(absolute / 100);
  const minor = String(absolute % 100).padStart(2, '0');
  return `${sign}${normalizedCurrency} ${major.toLocaleString('en-GB')}.${minor}`;
}

function inferProposalIssues(proposal: ImportStagingProposal): readonly ImportReviewIssue[] {
  const issues: ImportReviewIssue[] = [...(proposal.issues ?? [])];

  if (proposal.postedOn === undefined) {
    issues.push({
      code: 'missing_date',
      severity: 'blocked',
      message: 'No date — add one before this counts.',
    });
  }
  if (proposal.description === undefined || proposal.description.trim().length === 0) {
    issues.push({
      code: 'missing_description',
      severity: 'needs_review',
      message: 'No description — name it so you recognise it.',
    });
  }
  if (proposal.amountMinor === undefined) {
    issues.push({
      code: 'missing_amount',
      severity: 'blocked',
      message: 'No amount — add it before this counts.',
    });
  }
  if (proposal.currency !== undefined && !/^[A-Z]{3}$/i.test(proposal.currency.trim())) {
    issues.push({
      code: 'unsupported_currency',
      severity: 'blocked',
      message: 'Currency needs a three-letter code.',
    });
  }
  if (proposal.sourceQuality === 'needs-review' || proposal.sourceQuality === 'unsupported') {
    issues.push({
      code: 'source_needs_review',
      severity: 'needs_review',
      message: 'Worth a quick look before adding.',
    });
  }
  if (proposal.duplicateOfId !== undefined) {
    issues.push({
      code: 'possible_duplicate',
      severity: 'needs_review',
      message: 'Might be a duplicate of one you already have.',
    });
  }

  return issues;
}

function renderRowState(state: ImportReviewRowState): string {
  switch (state) {
    case 'ready':
      return 'ready to add';
    case 'needs_review':
      return 'worth a look';
    case 'blocked':
      return 'needs a fix';
  }
}

function resolveRowState(issues: readonly ImportReviewIssue[]): ImportReviewRowState {
  if (issues.some((issue) => issue.severity === 'blocked')) {
    return 'blocked';
  }
  if (issues.some((issue) => issue.severity === 'needs_review')) {
    return 'needs_review';
  }
  return 'ready';
}

function buildBadges(
  proposal: ImportStagingProposal,
  issues: readonly ImportReviewIssue[],
): readonly string[] {
  const badges: string[] = [];
  if (proposal.sourceQuality === 'source-clear') {
    badges.push('Looks clear');
  }
  for (const issue of issues) {
    if (!badges.includes(issue.message)) {
      badges.push(issue.message);
    }
  }
  return badges;
}

function readableDescription(description: string | undefined): string {
  const trimmed = description?.trim();
  return trimmed === undefined || trimmed.length === 0 ? 'Description missing' : trimmed;
}

function isStageableStatementKind(
  kind: StatementFileKind,
): kind is Extract<StatementFileKind, 'csv' | 'tsv' | 'txt'> {
  return kind === 'csv' || kind === 'tsv' || kind === 'txt';
}

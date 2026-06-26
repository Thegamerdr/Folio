import {
  createCurrencyCode,
  createLocalDate,
  type AuthorityState,
  type CurrencyCode,
  type LocalDate,
  type Money,
  type TransactionReviewStatus,
  type TransactionSourceKind,
  type UserConfirmationState,
} from '@folio/domain';

export const importEngineBoundary = {
  packageName: '@folio/import-engine',
  writesDirectlyToStorage: false,
  outputsReviewableProposals: true,
  importsNativeOrUiRuntime: false,
  importsDatabaseDriver: false,
  importsV1Runtime: false,
  phase5BlockedCapabilities: [
    {
      capability: 'encrypted-file-staging',
      owner: 'vault/native-storage',
      reason: 'Requires encrypted app storage and command commit path outside the pure engine.',
    },
    {
      capability: 'pdf-image-ocr',
      owner: 'native/ocr-adapter',
      reason: 'Requires on-device OCR or document capture runtime; this package only accepts text.',
    },
    {
      capability: 'review-ui',
      owner: 'apps/mobile',
      reason: 'Review queues are emitted as metadata and proposals, not rendered here.',
    },
  ],
} as const;

export const importEngineVersion = 'phase5-pure-1';

export type SupportedImportFormat = 'csv' | 'text' | 'ofx' | 'qfx' | 'qif';
export type ImportSourceKind = Extract<TransactionSourceKind, 'csv' | 'text' | 'ofx' | 'qif'>;
export type ImportEvidenceLevel = 'high' | 'medium' | 'low';
export type ImportReviewReason =
  | 'formula_like_text'
  | 'ambiguous_date'
  | 'ambiguous_amount'
  | 'missing_required_field'
  | 'qif_limitation'
  | 'possible_duplicate'
  | 'possible_transfer'
  | 'balance_mismatch'
  | 'uncategorised'
  | 'untrusted_parser_input';

export type ParserDescriptor = Readonly<{
  name: string;
  version: string;
  sourceKind: ImportSourceKind;
  limitations: readonly string[];
}>;

export type ImportJobDescriptor = Readonly<{
  importJobId: string;
  sourceFileId: string;
  accountId: string;
  currency: string | CurrencyCode;
  accountExternalId?: string | undefined;
}>;

export type ImportFieldEvidence = Readonly<{
  date: ImportEvidenceLevel;
  amount: ImportEvidenceLevel;
  description: ImportEvidenceLevel;
  identity: ImportEvidenceLevel;
  balance: ImportEvidenceLevel;
}>;

export type ImportProvenance = Readonly<{
  importJobId: string;
  sourceFileId: string;
  sourceKind: ImportSourceKind;
  sourceRowRef: string;
  parser: ParserDescriptor;
  rawRowHash: string;
  original: Readonly<Record<string, string>>;
  parsedAt: string;
  corrections: readonly ImportCorrection[];
}>;

export type ImportCorrection = Readonly<{
  correctedAt: string;
  field: keyof CanonicalImportNormalized;
  previous: string;
  next: string;
  actor: 'user' | 'melo' | 'system';
}>;

export type ImportReviewState = Readonly<{
  status: TransactionReviewStatus;
  authorityState: Extract<AuthorityState, 'imported-claim' | 'inferred' | 'estimated'>;
  userConfirmationState: UserConfirmationState;
  reasons: readonly ImportReviewReason[];
  evidenceLevel: ImportEvidenceLevel;
  notes: readonly string[];
}>;

export type CanonicalImportRaw = Readonly<{
  dateText?: string | undefined;
  postedDateText?: string | undefined;
  amountText?: string | undefined;
  debitText?: string | undefined;
  creditText?: string | undefined;
  currencyText?: string | undefined;
  descriptionText?: string | undefined;
  counterpartyText?: string | undefined;
  referenceText?: string | undefined;
  runningBalanceText?: string | undefined;
  providerTransactionId?: string | undefined;
}>;

export type CanonicalImportNormalized = Readonly<{
  accountId: string;
  accountExternalId?: string;
  postedDate: LocalDate;
  amount: Money;
  description: string;
  sourceCurrency: CurrencyCode;
  counterparty?: string;
  reference?: string;
  runningBalance?: Money;
  providerTransactionId?: string;
  categoryProposal?: CategoryProposal;
}>;

export type CanonicalImportRow = Readonly<{
  canonicalRowId: string;
  stableTransactionId: string;
  sourceKind: ImportSourceKind;
  sourceRowRef: string;
  raw: CanonicalImportRaw;
  normalized: CanonicalImportNormalized;
  provenance: ImportProvenance;
  fieldEvidence: ImportFieldEvidence;
  reviewState: ImportReviewState;
  duplicateFingerprint: DuplicateFingerprint;
  warnings: readonly ImportReviewReason[];
}>;

export type DuplicateFingerprint = Readonly<{
  provider?: string;
  row: string;
  semantic: string;
}>;

export type ImportParseIssue = Readonly<{
  sourceRowRef: string;
  code: ImportReviewReason | 'unsupported_format' | 'malformed_row';
  message: string;
}>;

export type ImportParseResult = Readonly<{
  format: SupportedImportFormat;
  parser: ParserDescriptor;
  rows: readonly CanonicalImportRow[];
  issues: readonly ImportParseIssue[];
  reconciliation?: BalanceReconciliationResult;
  metadata: Readonly<{
    importJobId: string;
    sourceFileId: string;
    accountId: string;
    accountExternalId?: string;
    rowCount: number;
    parserWarnings: readonly string[];
    blockedCapabilities: typeof importEngineBoundary.phase5BlockedCapabilities;
  }>;
}>;

export type CsvColumnMapping = Readonly<{
  date?: string | undefined;
  postedDate?: string | undefined;
  amount?: string | undefined;
  debit?: string | undefined;
  credit?: string | undefined;
  currency?: string | undefined;
  description?: string | undefined;
  counterparty?: string | undefined;
  reference?: string | undefined;
  runningBalance?: string | undefined;
  providerTransactionId?: string | undefined;
}>;

export type DateOrder = 'ymd' | 'dmy' | 'mdy';

export type CsvImportOptions = ImportJobDescriptor &
  Readonly<{
    text: string;
    mapping?: CsvColumnMapping | undefined;
    dateOrder?: DateOrder | undefined;
    hasHeader?: boolean | undefined;
    parsedAt?: string | undefined;
    delimiter?: ',' | ';' | '\t' | undefined;
  }>;

export type TextImportOptions = ImportJobDescriptor &
  Readonly<{
    text: string;
    dateOrder?: DateOrder | undefined;
    parsedAt?: string | undefined;
  }>;

export type OfxImportOptions = ImportJobDescriptor &
  Readonly<{
    text: string;
    sourceKind?: Extract<ImportSourceKind, 'ofx'> | undefined;
    parsedAt?: string | undefined;
  }>;

export type QifImportOptions = ImportJobDescriptor &
  Readonly<{
    text: string;
    dateOrder?: Exclude<DateOrder, 'ymd'> | undefined;
    parsedAt?: string | undefined;
  }>;

export type GenericImportOptions = ImportJobDescriptor &
  Readonly<{
    filename?: string | undefined;
    text: string;
    format?: SupportedImportFormat | undefined;
    parsedAt?: string | undefined;
    dateOrder?: DateOrder | undefined;
    mapping?: CsvColumnMapping | undefined;
  }>;

export type BalanceReconciliationState =
  | 'exact_match'
  | 'explained_mismatch'
  | 'unresolved_mismatch';

export type BalanceReconciliationResult = Readonly<{
  state: BalanceReconciliationState;
  openingBalance?: Money;
  importedMovementTotal: Money;
  expectedClosingBalance?: Money;
  suppliedClosingBalance?: Money;
  difference?: Money;
  explanations: readonly string[];
}>;

export type DuplicateCandidate = Readonly<{
  rowIds: readonly string[];
  reason: 'provider_id' | 'source_row' | 'semantic_match' | 'pending_to_posted_candidate';
  evidenceLevel: ImportEvidenceLevel;
}>;

export type TransferCandidate = Readonly<{
  debitRowId: string;
  creditRowId: string;
  amount: Money;
  evidenceLevel: ImportEvidenceLevel;
  reason: string;
}>;

export type CategorySource =
  | 'user_rule'
  | 'known_counterparty'
  | 'bundled_rule'
  | 'on_device_classifier_blocked'
  | 'cloud_model_blocked'
  | 'unresolved';

export type CategoryProposal = Readonly<{
  categoryId: string;
  source: CategorySource;
  evidenceLevel: ImportEvidenceLevel;
  reason: string;
  requiresReview: boolean;
}>;

export type CategorisationRule = Readonly<{
  categoryId: string;
  pattern: string | RegExp;
  counterparty?: string;
  minAmountMinorUnits?: number;
  maxAmountMinorUnits?: number;
}>;

export type CategorisationOptions = Readonly<{
  userRules?: readonly CategorisationRule[];
  knownCounterparties?: Readonly<Record<string, string>>;
  allowOnDeviceClassifier?: boolean;
  allowCloudModel?: boolean;
}>;

export type SearchIndexEntry = Readonly<{
  id: string;
  rowId: string;
  text: string;
  tokens: readonly string[];
  provenanceHash: string;
}>;

export type ImportQuestionIntent =
  | 'resolve_duplicate'
  | 'confirm_transfer'
  | 'explain_balance_mismatch'
  | 'confirm_category'
  | 'repair_required_field';

export type ImportQuestionSlot = Readonly<{
  name: string;
  value: string;
}>;

export type ImportReviewQuestion = Readonly<{
  id: string;
  intent: ImportQuestionIntent;
  priority: number;
  prompt: string;
  rowIds: readonly string[];
  slots: readonly ImportQuestionSlot[];
  answerOptions: readonly string[];
  materialEffect: string;
}>;

export type ImportQuestionPlan = Readonly<{
  cap: number;
  questions: readonly ImportReviewQuestion[];
  deferredIssueCount: number;
  reviewQueueReason: string;
}>;

export type ImportReviewDecisionState =
  | 'ready_for_user_confirmation'
  | 'needs_user_review'
  | 'blocked_by_parse_issue';

export type ImportReviewRowSummary = Readonly<{
  rowId: string;
  stableTransactionId: string;
  sourceRowRef: string;
  postedDate: LocalDate;
  description: string;
  amountMinor: number;
  currency: CurrencyCode;
  reviewStatus: TransactionReviewStatus;
  decisionState: ImportReviewDecisionState;
  reasons: readonly ImportReviewReason[];
  questionIds: readonly string[];
  provenanceHash: string;
  searchText: string;
}>;

export type ImportCommitPreviewRow = Readonly<{
  transactionId: string;
  title: string;
  searchText: string;
  sourceRowId: string;
  provenanceHash: string;
  tags: readonly string[];
}>;

export type ImportReviewPacket = Readonly<{
  importJobId: string;
  sourceFileId: string;
  format: SupportedImportFormat;
  parser: ParserDescriptor;
  rows: readonly ImportReviewRowSummary[];
  questions: ImportQuestionPlan;
  duplicates: readonly DuplicateCandidate[];
  transfers: readonly TransferCandidate[];
  reconciliation?: BalanceReconciliationResult;
  cashflow: Readonly<{ income: Money; spending: Money; transferMovement: Money }>;
  searchIndex: readonly SearchIndexEntry[];
  commitPreview: Readonly<{
    acceptedRows: readonly ImportCommitPreviewRow[];
    deferredRowIds: readonly string[];
    caveat: 'preview_only_requires_review_command';
  }>;
  counts: Readonly<{
    parsedRows: number;
    readyForAcceptance: number;
    needsUserReview: number;
    parseIssues: number;
    duplicateCandidateGroups: number;
    transferCandidatePairs: number;
  }>;
}>;

export type ImportMeaningKind =
  | 'income_event'
  | 'recurring_commitment'
  | 'spending_transaction'
  | 'refund'
  | 'transfer'
  | 'duplicate_warning'
  | 'unclear_merchant';

export type ImportMeaningState =
  | 'confirmed'
  | 'possible_review_only'
  | 'transaction_only'
  | 'warning_review_only';

export type ImportMeaningProposal = Readonly<{
  id: string;
  kind: ImportMeaningKind;
  label: string;
  rowIds: readonly string[];
  state: ImportMeaningState;
  createsEvent: boolean;
  affectsTodayOnlyAfterAcceptance: boolean;
  explanation: string;
  reviewRequired: boolean;
}>;

export type ImportMeaningIndex = Readonly<{
  meanings: readonly ImportMeaningProposal[];
  counts: Readonly<{
    confirmedEvents: number;
    possibleReviewOnly: number;
    transactionOnly: number;
    warnings: number;
  }>;
}>;

const parserVersion = '1.0.0';
const csvParser: ParserDescriptor = {
  name: '@folio/import-engine/csv',
  version: parserVersion,
  sourceKind: 'csv',
  limitations: [
    'Column mapping is deterministic and evidence-classified; ambiguous exports require review.',
    'Locale-specific date and amount conventions are parsed only from supplied options or clear headers.',
  ],
};
const textParser: ParserDescriptor = {
  name: '@folio/import-engine/text',
  version: parserVersion,
  sourceKind: 'text',
  limitations: [
    'Plain pasted statement text is parsed line by line and always remains reviewable.',
    'The parser expects a date, description and amount on each transaction line.',
    'Opening and closing balance lines are used only for reconciliation warnings.',
  ],
};
const ofxParser: ParserDescriptor = {
  name: '@folio/import-engine/ofx',
  version: parserVersion,
  sourceKind: 'ofx',
  limitations: [
    'OFX/QFX parser covers bank statement transaction lists and balance fields, not investments.',
    'Transactions without FITID receive deterministic fallback IDs from account, date, amount and text.',
  ],
};
const qifParser: ParserDescriptor = {
  name: '@folio/import-engine/qif',
  version: parserVersion,
  sourceKind: 'qif',
  limitations: [
    'QIF does not carry a reliable currency per transaction; the import currency is applied.',
    'QIF dates are locale-ambiguous and use the supplied date order.',
    'Investment actions, split lines and classes are preserved only as review metadata in this slice.',
  ],
};

const bundledRules: readonly CategorisationRule[] = [
  {
    categoryId: 'category_groceries',
    pattern: /\b(grocery|supermarket|tesco|sainsbury|aldi|lidl)\b/i,
  },
  {
    categoryId: 'category_transport',
    pattern: /\b(train|rail|uber|lyft|fuel|parking|transport)\b/i,
  },
  {
    categoryId: 'category_income',
    pattern: /\b(payroll|salary|wages|employer)\b/i,
    minAmountMinorUnits: 1,
  },
  { categoryId: 'category_housing', pattern: /\b(rent|mortgage|landlord)\b/i },
  { categoryId: 'category_transfer', pattern: /\b(transfer|xfer|internal)\b/i },
];

export function parseImportFile(options: GenericImportOptions): ImportParseResult {
  const format = options.format ?? detectImportFormat(options.text, options.filename);
  if (format === 'csv') {
    return parseCsvImport({
      ...baseImportOptions(options),
      text: options.text,
      dateOrder: options.dateOrder,
      mapping: options.mapping,
      parsedAt: options.parsedAt,
    });
  }
  if (format === 'text') {
    return parseTextImport({
      ...baseImportOptions(options),
      text: options.text,
      dateOrder: options.dateOrder,
      parsedAt: options.parsedAt,
    });
  }
  if (format === 'ofx' || format === 'qfx') {
    return parseOfxImport({
      ...baseImportOptions(options),
      text: options.text,
      parsedAt: options.parsedAt,
    });
  }
  return parseQifImport({
    ...baseImportOptions(options),
    text: options.text,
    dateOrder: options.dateOrder === 'mdy' ? 'mdy' : 'dmy',
    parsedAt: options.parsedAt,
  });
}

export function detectImportFormat(text: string, filename = ''): SupportedImportFormat {
  const lowerName = filename.toLowerCase();
  const trimmed = text.trimStart().toLowerCase();
  if (lowerName.endsWith('.ofx') || lowerName.endsWith('.qfx') || trimmed.includes('<ofx>')) {
    return lowerName.endsWith('.qfx') ? 'qfx' : 'ofx';
  }
  if (lowerName.endsWith('.qif') || trimmed.startsWith('!type:')) return 'qif';
  if (lowerName.endsWith('.txt') && !looksLikeDelimitedText(text)) return 'text';
  if (looksLikePlainStatementText(text) && !looksLikeDelimitedText(text)) return 'text';
  return 'csv';
}

export function parseCsvImport(options: CsvImportOptions): ImportParseResult {
  const parsedAt = options.parsedAt ?? deterministicParsedAt(options.importJobId);
  const currency = createCurrencyCode(options.currency);
  const delimiter = options.delimiter ?? detectCsvDelimiter(options.text);
  const table = parseCsvTable(options.text, delimiter);
  const hasHeader = options.hasHeader ?? true;
  const headers = hasHeader
    ? (table[0] ?? []).map(normalizeHeader)
    : createPositionalHeaders(table[0] ?? []);
  const mapping = options.mapping ?? inferCsvMapping(headers);
  const rows = hasHeader ? table.slice(1) : table;
  const builtRows: CanonicalImportRow[] = [];
  const issues: ImportParseIssue[] = [];

  rows.forEach((cells, index) => {
    if (cells.every((cell) => cell.trim().length === 0)) return;
    const sourceRowRef = `csv:${index + (hasHeader ? 2 : 1)}`;
    const object = rowObject(headers, cells);
    const raw = rawFromCsvObject(object, mapping);
    const warnings = formulaWarnings(raw);

    try {
      const normalized = normalizeCanonicalRaw({
        accountId: options.accountId,
        accountExternalId: options.accountExternalId,
        currency,
        raw,
        dateOrder: options.dateOrder ?? 'ymd',
      });
      const fieldEvidence = fieldEvidenceFromRaw(raw, warnings);
      const row = buildCanonicalRow({
        sourceKind: 'csv',
        sourceRowRef,
        raw,
        normalized,
        parser: csvParser,
        descriptor: options,
        parsedAt,
        original: object,
        fieldEvidence,
        warnings,
      });
      builtRows.push(row);
    } catch (error) {
      issues.push({
        sourceRowRef,
        code: 'malformed_row',
        message: error instanceof Error ? error.message : 'CSV row could not be normalised.',
      });
    }
  });

  return withDerivedMetadata({
    format: 'csv',
    parser: csvParser,
    rows: builtRows,
    issues,
    descriptor: options,
    parserWarnings: [],
  });
}

export function parseCsvTable(text: string, delimiter: ',' | ';' | '\t' = ','): string[][] {
  const normalized = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char ?? '';
    }
  }

  row.push(cell);
  if (row.length > 1 || row[0]?.trim() !== '') rows.push(row);
  return rows;
}

export function parseTextImport(options: TextImportOptions): ImportParseResult {
  const parsedAt = options.parsedAt ?? deterministicParsedAt(options.importJobId);
  const currency = createCurrencyCode(options.currency);
  const rows: CanonicalImportRow[] = [];
  const issues: ImportParseIssue[] = [];
  let openingBalance: Money | undefined;
  let closingBalance: Money | undefined;

  plainStatementLines(options.text).forEach((line, index) => {
    const sourceRowRef = `text:${index + 1}`;
    const balance = parseStatementBalanceLine(line, currency);
    if (balance?.kind === 'opening') {
      openingBalance = balance.balance;
      return;
    }
    if (balance?.kind === 'closing') {
      closingBalance = balance.balance;
      return;
    }

    const parsed = parseStatementTransactionLine(line);
    if (parsed === undefined) {
      issues.push({
        sourceRowRef,
        code: 'malformed_row',
        message:
          'Plain text line could not be staged because it does not expose date, description and amount.',
      });
      return;
    }

    const raw = compactRaw({
      dateText: parsed.dateText,
      amountText: parsed.amountText,
      descriptionText: parsed.descriptionText,
      runningBalanceText: parsed.runningBalanceText,
    });
    const warnings = formulaWarnings(raw);
    try {
      const normalized = normalizeCanonicalRaw({
        accountId: options.accountId,
        accountExternalId: options.accountExternalId,
        currency,
        raw,
        dateOrder: options.dateOrder ?? 'ymd',
      });
      const row = buildCanonicalRow({
        sourceKind: 'text',
        sourceRowRef,
        raw,
        normalized,
        parser: textParser,
        descriptor: options,
        parsedAt,
        original: { line },
        fieldEvidence: fieldEvidenceFromRaw(raw, warnings),
        warnings: uniqueValues([...warnings, 'untrusted_parser_input']),
      });
      rows.push(row);
    } catch (error) {
      issues.push({
        sourceRowRef,
        code: 'malformed_row',
        message:
          error instanceof Error
            ? error.message
            : 'Plain text statement row could not be normalised.',
      });
    }
  });

  return withDerivedMetadata({
    format: 'text',
    parser: textParser,
    rows,
    issues,
    descriptor: options,
    parserWarnings: ['Plain text import is line-based and remains review-first.'],
    reconciliation: reconcileImportedBalances({ rows, openingBalance, closingBalance }),
  });
}

export function parseOfxImport(options: OfxImportOptions): ImportParseResult {
  const parsedAt = options.parsedAt ?? deterministicParsedAt(options.importJobId);
  const currency = readFirstTag(options.text, 'CURDEF') ?? String(options.currency);
  const sourceCurrency = createCurrencyCode(currency);
  const accountExternalId = readFirstTag(options.text, 'ACCTID') ?? options.accountExternalId;
  const transactionBlocks = readBlocks(options.text, 'STMTTRN');
  const rows: CanonicalImportRow[] = [];
  const issues: ImportParseIssue[] = [];

  transactionBlocks.forEach((block, index) => {
    const sourceRowRef = `ofx:${index + 1}`;
    const raw: CanonicalImportRaw = compactRaw({
      dateText: readFirstTag(block, 'DTPOSTED') ?? readFirstTag(block, 'DTUSER'),
      amountText: readFirstTag(block, 'TRNAMT'),
      descriptionText: joinNonEmpty(
        [readFirstTag(block, 'NAME'), readFirstTag(block, 'MEMO')],
        ' ',
      ),
      referenceText: readFirstTag(block, 'CHECKNUM') ?? readFirstTag(block, 'REFNUM'),
      providerTransactionId: readFirstTag(block, 'FITID'),
    });
    const original = tagsToRecord(block, [
      'TRNTYPE',
      'DTPOSTED',
      'DTUSER',
      'TRNAMT',
      'FITID',
      'NAME',
      'MEMO',
      'CHECKNUM',
      'REFNUM',
    ]);

    try {
      const normalized = normalizeCanonicalRaw({
        accountId: options.accountId,
        accountExternalId,
        currency: sourceCurrency,
        raw,
        dateOrder: 'ymd',
      });
      const row = buildCanonicalRow({
        sourceKind: 'ofx',
        sourceRowRef,
        raw,
        normalized,
        parser: ofxParser,
        descriptor: { ...options, accountExternalId },
        parsedAt,
        original,
        fieldEvidence: fieldEvidenceFromRaw(raw, []),
        warnings: [],
      });
      rows.push(row);
    } catch (error) {
      issues.push({
        sourceRowRef,
        code: 'malformed_row',
        message:
          error instanceof Error ? error.message : 'OFX transaction could not be normalised.',
      });
    }
  });

  const suppliedClosing = readBalance(options.text, 'LEDGERBAL', sourceCurrency);
  return withDerivedMetadata({
    format: 'ofx',
    parser: ofxParser,
    rows,
    issues,
    descriptor: { ...options, currency: sourceCurrency, accountExternalId },
    parserWarnings: transactionBlocks.length === 0 ? ['No STMTTRN blocks found.'] : [],
    reconciliation: reconcileImportedBalances({ rows, closingBalance: suppliedClosing }),
  });
}

export function parseQifImport(options: QifImportOptions): ImportParseResult {
  const parsedAt = options.parsedAt ?? deterministicParsedAt(options.importJobId);
  const currency = createCurrencyCode(options.currency);
  const records = parseQifRecords(options.text);
  const rows: CanonicalImportRow[] = [];
  const issues: ImportParseIssue[] = [];

  records.forEach((record, index) => {
    const sourceRowRef = `qif:${index + 1}`;
    const unsupported = record.entries.filter(
      (entry) => entry.code === 'S' || entry.code === '$' || entry.code === 'E',
    );
    const raw = compactRaw({
      dateText: firstQif(record, 'D'),
      amountText: firstQif(record, 'T') ?? firstQif(record, 'U'),
      descriptionText: firstQif(record, 'P') ?? firstQif(record, 'M'),
      referenceText: firstQif(record, 'N'),
    });
    const original = Object.fromEntries(
      record.entries.map((entry, entryIndex) => [`${entry.code}${entryIndex}`, entry.value]),
    );
    const warnings: ImportReviewReason[] = ['qif_limitation'];
    if (unsupported.length > 0) warnings.push('untrusted_parser_input');

    try {
      const normalized = normalizeCanonicalRaw({
        accountId: options.accountId,
        accountExternalId: options.accountExternalId,
        currency,
        raw,
        dateOrder: options.dateOrder ?? 'dmy',
      });
      const fieldEvidence = fieldEvidenceFromRaw(raw, warnings);
      const row = buildCanonicalRow({
        sourceKind: 'qif',
        sourceRowRef,
        raw,
        normalized,
        parser: qifParser,
        descriptor: options,
        parsedAt,
        original,
        fieldEvidence,
        warnings,
      });
      rows.push(row);
    } catch (error) {
      issues.push({
        sourceRowRef,
        code: 'malformed_row',
        message:
          error instanceof Error ? error.message : 'QIF transaction could not be normalised.',
      });
    }
  });

  return withDerivedMetadata({
    format: 'qif',
    parser: qifParser,
    rows,
    issues,
    descriptor: options,
    parserWarnings: qifParser.limitations,
  });
}

export function fingerprintImportRow(row: CanonicalImportRow): DuplicateFingerprint {
  const provider =
    row.normalized.providerTransactionId === undefined
      ? undefined
      : stableHash(['provider', row.normalized.accountId, row.normalized.providerTransactionId]);
  const rowFingerprint = stableHash([
    'source-row',
    row.provenance.sourceFileId,
    row.provenance.sourceRowRef,
    row.provenance.rawRowHash,
  ]);
  const semantic = stableHash([
    'semantic',
    row.normalized.accountId,
    row.normalized.postedDate,
    row.normalized.amount.currency,
    String(row.normalized.amount.minorUnits),
    normalizeDescription(row.normalized.description),
    row.normalized.runningBalance?.minorUnits === undefined
      ? ''
      : String(row.normalized.runningBalance.minorUnits),
  ]);
  const result: { provider?: string; row: string; semantic: string } = {
    row: rowFingerprint,
    semantic,
  };
  if (provider !== undefined) result.provider = provider;
  return result;
}

export function findDuplicateCandidates(
  rows: readonly CanonicalImportRow[],
): readonly DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  candidates.push(...groupsByFingerprint(rows, 'provider', 'provider_id', 'high'));
  candidates.push(...groupsByFingerprint(rows, 'row', 'source_row', 'high'));
  candidates.push(...groupsByFingerprint(rows, 'semantic', 'semantic_match', 'medium'));

  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = rows[leftIndex];
      const right = rows[rightIndex];
      if (left === undefined || right === undefined) continue;
      if (isPendingPostedCandidate(left, right)) {
        candidates.push({
          rowIds: [left.canonicalRowId, right.canonicalRowId],
          reason: 'pending_to_posted_candidate',
          evidenceLevel: 'medium',
        });
      }
    }
  }

  return uniqueCandidates(candidates);
}

export function findTransferCandidates(
  rows: readonly CanonicalImportRow[],
  dateToleranceDays = 2,
): readonly TransferCandidate[] {
  const candidates: TransferCandidate[] = [];
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = rows[leftIndex];
      const right = rows[rightIndex];
      if (left === undefined || right === undefined) continue;
      const leftAmount = left.normalized.amount;
      const rightAmount = right.normalized.amount;
      if (
        left.normalized.accountId === right.normalized.accountId ||
        leftAmount.currency !== rightAmount.currency ||
        leftAmount.minorUnits + rightAmount.minorUnits !== 0 ||
        Math.abs(daysBetween(left.normalized.postedDate, right.normalized.postedDate)) >
          dateToleranceDays
      ) {
        continue;
      }
      const transferText = `${left.normalized.description} ${right.normalized.description}`;
      const evidenceLevel: ImportEvidenceLevel =
        /\b(transfer|xfer|internal|savings|card payment)\b/i.test(transferText) ? 'high' : 'medium';
      const debit = leftAmount.minorUnits < 0 ? left : right;
      const credit = leftAmount.minorUnits > 0 ? left : right;
      candidates.push({
        debitRowId: debit.canonicalRowId,
        creditRowId: credit.canonicalRowId,
        amount: { minorUnits: Math.abs(leftAmount.minorUnits), currency: leftAmount.currency },
        evidenceLevel,
        reason: 'Equal and opposite movements across accounts within date tolerance.',
      });
    }
  }
  return candidates;
}

export function reconcileImportedBalances(input: {
  rows: readonly CanonicalImportRow[];
  openingBalance?: Money | undefined;
  closingBalance?: Money | undefined;
  explainedAdjustments?: readonly Money[] | undefined;
}): BalanceReconciliationResult {
  const currency =
    input.openingBalance?.currency ??
    input.closingBalance?.currency ??
    input.rows[0]?.normalized.amount.currency ??
    createCurrencyCode('GBP');
  const movementTotal = sumMoney(
    input.rows.map((row) => row.normalized.amount),
    currency,
  );
  const adjustments = input.explainedAdjustments ?? [];
  const adjustmentTotal = sumMoney(adjustments, currency);
  const opening = input.openingBalance;
  const closing = input.closingBalance;

  if (opening === undefined || closing === undefined) {
    return {
      state: 'unresolved_mismatch',
      importedMovementTotal: movementTotal,
      explanations: ['Opening and closing balances were not both supplied by the source.'],
      ...(opening === undefined ? {} : { openingBalance: opening }),
      ...(closing === undefined ? {} : { suppliedClosingBalance: closing }),
    };
  }

  assertCurrency(movementTotal, opening.currency);
  assertCurrency(movementTotal, closing.currency);
  const expectedClosing = addMoney(addMoney(opening, movementTotal), adjustmentTotal);
  const difference = subtractMoney(closing, expectedClosing);
  if (difference.minorUnits === 0) {
    return {
      state: 'exact_match',
      openingBalance: opening,
      importedMovementTotal: movementTotal,
      expectedClosingBalance: expectedClosing,
      suppliedClosingBalance: closing,
      difference,
      explanations: [],
    };
  }
  return {
    state: adjustments.length > 0 ? 'explained_mismatch' : 'unresolved_mismatch',
    openingBalance: opening,
    importedMovementTotal: movementTotal,
    expectedClosingBalance: expectedClosing,
    suppliedClosingBalance: closing,
    difference,
    explanations:
      adjustments.length > 0
        ? ['Difference remains after applying explicit adjustments.']
        : ['Source balances do not equal opening balance plus imported movements.'],
  };
}

export function categoriseImportRow(
  row: CanonicalImportRow,
  options: CategorisationOptions = {},
): CategoryProposal {
  const rules = options.userRules ?? [];
  for (const rule of rules) {
    if (matchesCategorisationRule(row, rule)) {
      return {
        categoryId: rule.categoryId,
        source: 'user_rule',
        evidenceLevel: 'high',
        reason: 'Matched a user-created import rule.',
        requiresReview: false,
      };
    }
  }

  const counterparty = normalizeDescription(
    row.normalized.counterparty ?? row.normalized.description,
  );
  const knownCounterparties = options.knownCounterparties ?? {};
  for (const [known, categoryId] of Object.entries(knownCounterparties)) {
    if (counterparty.includes(normalizeDescription(known))) {
      return {
        categoryId,
        source: 'known_counterparty',
        evidenceLevel: 'high',
        reason: 'Matched a known counterparty mapping.',
        requiresReview: false,
      };
    }
  }

  for (const rule of bundledRules) {
    if (matchesCategorisationRule(row, rule)) {
      return {
        categoryId: rule.categoryId,
        source: 'bundled_rule',
        evidenceLevel: 'medium',
        reason: 'Matched a deterministic bundled rule.',
        requiresReview: true,
      };
    }
  }

  if (options.allowOnDeviceClassifier) {
    return {
      categoryId: 'category_unresolved',
      source: 'on_device_classifier_blocked',
      evidenceLevel: 'low',
      reason: 'On-device classifier is a later adapter and is blocked in the pure slice.',
      requiresReview: true,
    };
  }

  if (options.allowCloudModel) {
    return {
      categoryId: 'category_unresolved',
      source: 'cloud_model_blocked',
      evidenceLevel: 'low',
      reason: 'Cloud model classification is optional and blocked in the pure slice.',
      requiresReview: true,
    };
  }

  return {
    categoryId: 'category_unresolved',
    source: 'unresolved',
    evidenceLevel: 'low',
    reason: 'No deterministic category rule matched.',
    requiresReview: true,
  };
}

export function applyCategorisation(
  rows: readonly CanonicalImportRow[],
  options: CategorisationOptions = {},
): readonly CanonicalImportRow[] {
  return rows.map((row) => {
    const categoryProposal = categoriseImportRow(row, options);
    return {
      ...row,
      normalized: {
        ...row.normalized,
        categoryProposal,
      },
      reviewState: buildReviewState(row.warnings, row.fieldEvidence, categoryProposal),
    };
  });
}

export function buildSearchIndexEntries(
  rows: readonly CanonicalImportRow[],
): readonly SearchIndexEntry[] {
  return rows.map((row) => {
    const text = [
      row.normalized.postedDate,
      row.normalized.description,
      row.normalized.counterparty ?? '',
      row.normalized.reference ?? '',
      row.normalized.amount.currency,
      String(row.normalized.amount.minorUnits),
    ]
      .filter((part) => part.length > 0)
      .join(' ');
    const tokens = Array.from(new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])).sort();
    return {
      id: `search_${stableHash([row.canonicalRowId, text])}`,
      rowId: row.canonicalRowId,
      text,
      tokens,
      provenanceHash: row.provenance.rawRowHash,
    };
  });
}

export function buildBoundedImportQuestionPlan(input: {
  rows: readonly CanonicalImportRow[];
  duplicates?: readonly DuplicateCandidate[] | undefined;
  transfers?: readonly TransferCandidate[] | undefined;
  reconciliation?: BalanceReconciliationResult | undefined;
  maxQuestions?: number | undefined;
}): ImportQuestionPlan {
  const cap = Math.max(0, Math.floor(input.maxQuestions ?? 3));
  const duplicates = input.duplicates ?? findDuplicateCandidates(input.rows);
  const transfers = input.transfers ?? findTransferCandidates(input.rows);
  const candidates: ImportReviewQuestion[] = [];

  duplicates
    .filter((candidate) => candidate.evidenceLevel !== 'low')
    .forEach((candidate, index) => {
      candidates.push({
        id: `import_question_${stableHash(['duplicate', ...candidate.rowIds])}`,
        intent: 'resolve_duplicate',
        priority: index + (candidate.evidenceLevel === 'high' ? 10 : 20),
        prompt: 'These rows may be the same transaction. Merge them, keep both, or review later?',
        rowIds: candidate.rowIds,
        slots: [
          { name: 'candidateReason', value: candidate.reason },
          { name: 'evidenceLevel', value: candidate.evidenceLevel },
        ],
        answerOptions: ['Merge rows', 'Keep both', 'Review later'],
        materialEffect: 'Prevents duplicate imported transactions from inflating balances.',
      });
    });

  transfers.forEach((candidate, index) => {
    candidates.push({
      id: `import_question_${stableHash([
        'transfer',
        candidate.debitRowId,
        candidate.creditRowId,
      ])}`,
      intent: 'confirm_transfer',
      priority: 100 + index + (candidate.evidenceLevel === 'high' ? 0 : 20),
      prompt: 'This looks like a transfer between accounts. Link both sides?',
      rowIds: [candidate.debitRowId, candidate.creditRowId],
      slots: [
        { name: 'amountMinorUnits', value: String(candidate.amount.minorUnits) },
        { name: 'currency', value: candidate.amount.currency },
        { name: 'evidenceLevel', value: candidate.evidenceLevel },
      ],
      answerOptions: ['Link transfer', 'Not a transfer', 'Review later'],
      materialEffect: 'Keeps transfer movement out of income and spending totals.',
    });
  });

  if (input.reconciliation?.state === 'unresolved_mismatch') {
    candidates.push({
      id: `import_question_${stableHash([
        'balance',
        input.reconciliation.difference?.currency ?? '',
        String(input.reconciliation.difference?.minorUnits ?? 0),
      ])}`,
      intent: 'explain_balance_mismatch',
      priority: 200,
      prompt:
        'The imported movements do not match the source balance. Explain or continue with a warning?',
      rowIds: [],
      slots: [
        {
          name: 'differenceMinorUnits',
          value: String(input.reconciliation.difference?.minorUnits ?? 0),
        },
        { name: 'currency', value: input.reconciliation.difference?.currency ?? 'unknown' },
      ],
      answerOptions: ['Add explanation', 'Continue with warning', 'Review later'],
      materialEffect: 'Stops the import being labelled fully reconciled when balances differ.',
    });
  }

  input.rows.forEach((row, index) => {
    if (row.reviewState.reasons.includes('uncategorised')) {
      candidates.push({
        id: `import_question_${stableHash(['category', row.canonicalRowId])}`,
        intent: 'confirm_category',
        priority: 300 + index,
        prompt: 'Confirm the category for this imported transaction?',
        rowIds: [row.canonicalRowId],
        slots: [
          { name: 'description', value: row.normalized.description },
          { name: 'amountMinorUnits', value: String(row.normalized.amount.minorUnits) },
          { name: 'currency', value: row.normalized.amount.currency },
        ],
        answerOptions: ['Use suggestion', 'Choose category', 'Review later'],
        materialEffect: 'Improves current summaries without rewriting source history.',
      });
    }
    if (row.reviewState.reasons.includes('missing_required_field')) {
      candidates.push({
        id: `import_question_${stableHash(['required-field', row.canonicalRowId])}`,
        intent: 'repair_required_field',
        priority: 400 + index,
        prompt: 'This row is missing required data. Fix it now or leave it in review?',
        rowIds: [row.canonicalRowId],
        slots: [
          { name: 'sourceRowRef', value: row.sourceRowRef },
          { name: 'description', value: row.normalized.description },
        ],
        answerOptions: ['Fix row', 'Leave in review'],
        materialEffect: 'Prevents a malformed row from being committed as a fact.',
      });
    }
  });

  const unique = uniqueQuestions(candidates).sort((left, right) => left.priority - right.priority);
  return {
    cap,
    questions: unique.slice(0, cap),
    deferredIssueCount: Math.max(0, unique.length - cap),
    reviewQueueReason:
      unique.length <= cap
        ? 'All material import questions fit inside the conversation cap.'
        : 'Remaining import questions move to the review queue.',
  };
}

export function buildImportReviewPacket(input: {
  parseResult: ImportParseResult;
  categorisation?: CategorisationOptions | undefined;
  maxQuestions?: number | undefined;
  confirmedTransferRows?: readonly Pick<TransferCandidate, 'debitRowId' | 'creditRowId'>[];
}): ImportReviewPacket {
  const rows = applyCategorisation(input.parseResult.rows, input.categorisation);
  const duplicates = findDuplicateCandidates(rows);
  const transfers = findTransferCandidates(rows);
  const questions = buildBoundedImportQuestionPlan({
    rows,
    duplicates,
    transfers,
    reconciliation: input.parseResult.reconciliation,
    maxQuestions: input.maxQuestions,
  });
  const searchIndex = buildSearchIndexEntries(rows);
  const cashflowInput: {
    rows: readonly CanonicalImportRow[];
    confirmedTransfers?: readonly Pick<TransferCandidate, 'debitRowId' | 'creditRowId'>[];
  } = { rows };
  if (input.confirmedTransferRows !== undefined) {
    cashflowInput.confirmedTransfers = input.confirmedTransferRows;
  }
  const cashflow = summariseCashflow(cashflowInput);
  const rowQuestionIds = questionIdsByRow(questions.questions);
  const duplicateRowIds = new Set(duplicates.flatMap((candidate) => candidate.rowIds));
  const transferRowIds = new Set(
    transfers.flatMap((candidate) => [candidate.debitRowId, candidate.creditRowId]),
  );
  const reconciliationNeedsReview =
    input.parseResult.reconciliation?.state === 'unresolved_mismatch';
  const summaries = rows.map((row) => {
    const reasons = uniqueValues([
      ...row.reviewState.reasons,
      ...(duplicateRowIds.has(row.canonicalRowId) ? ['possible_duplicate' as const] : []),
      ...(transferRowIds.has(row.canonicalRowId) ? ['possible_transfer' as const] : []),
      ...(reconciliationNeedsReview ? ['balance_mismatch' as const] : []),
    ]);
    const decisionState: ImportReviewDecisionState =
      reasons.length === 0 &&
      row.reviewState.status !== 'needs_review' &&
      row.reviewState.status !== 'rejected'
        ? 'ready_for_user_confirmation'
        : 'needs_user_review';
    const search = searchIndex.find((entry) => entry.rowId === row.canonicalRowId);
    return {
      rowId: row.canonicalRowId,
      stableTransactionId: row.stableTransactionId,
      sourceRowRef: row.sourceRowRef,
      postedDate: row.normalized.postedDate,
      description: row.normalized.description,
      amountMinor: row.normalized.amount.minorUnits,
      currency: row.normalized.amount.currency,
      reviewStatus: row.reviewState.status,
      decisionState,
      reasons,
      questionIds: rowQuestionIds.get(row.canonicalRowId) ?? [],
      provenanceHash: row.provenance.rawRowHash,
      searchText: search?.text ?? '',
    };
  });
  const acceptedRows = summaries
    .filter((row) => row.decisionState === 'ready_for_user_confirmation')
    .map((row) => ({
      transactionId: row.stableTransactionId,
      title: row.description,
      searchText: row.searchText,
      sourceRowId: row.sourceRowRef,
      provenanceHash: row.provenanceHash,
      tags: [input.parseResult.format, input.parseResult.metadata.importJobId],
    }));
  const deferredRowIds = summaries
    .filter((row) => row.decisionState !== 'ready_for_user_confirmation')
    .map((row) => row.rowId);

  return {
    importJobId: input.parseResult.metadata.importJobId,
    sourceFileId: input.parseResult.metadata.sourceFileId,
    format: input.parseResult.format,
    parser: input.parseResult.parser,
    rows: summaries,
    questions,
    duplicates,
    transfers,
    ...(input.parseResult.reconciliation === undefined
      ? {}
      : { reconciliation: input.parseResult.reconciliation }),
    cashflow,
    searchIndex,
    commitPreview: {
      acceptedRows,
      deferredRowIds,
      caveat: 'preview_only_requires_review_command',
    },
    counts: {
      parsedRows: rows.length,
      readyForAcceptance: acceptedRows.length,
      needsUserReview: deferredRowIds.length,
      parseIssues: input.parseResult.issues.length,
      duplicateCandidateGroups: duplicates.length,
      transferCandidatePairs: transfers.length,
    },
  };
}

export function summariseCashflow(input: {
  rows: readonly CanonicalImportRow[];
  confirmedTransfers?: readonly Pick<TransferCandidate, 'debitRowId' | 'creditRowId'>[];
}): Readonly<{ income: Money; spending: Money; transferMovement: Money }> {
  const currency = input.rows[0]?.normalized.amount.currency ?? createCurrencyCode('GBP');
  const transferRowIds = new Set(
    (input.confirmedTransfers ?? []).flatMap((transfer) => [
      transfer.debitRowId,
      transfer.creditRowId,
    ]),
  );
  const incomeRows: Money[] = [];
  const spendingRows: Money[] = [];
  const transferRows: Money[] = [];
  for (const row of input.rows) {
    if (transferRowIds.has(row.canonicalRowId)) {
      transferRows.push(row.normalized.amount);
    } else if (row.normalized.amount.minorUnits > 0) {
      incomeRows.push(row.normalized.amount);
    } else {
      spendingRows.push(row.normalized.amount);
    }
  }
  return {
    income: sumMoney(incomeRows, currency),
    spending: sumMoney(spendingRows, currency),
    transferMovement: sumMoney(transferRows, currency),
  };
}

export function buildImportMeaningIndex(input: {
  packet: ImportReviewPacket;
  confirmedMeaningRowIds?: readonly string[] | undefined;
  confirmedTransferRows?: readonly Pick<TransferCandidate, 'debitRowId' | 'creditRowId'>[];
}): ImportMeaningIndex {
  const confirmedRows = new Set(input.confirmedMeaningRowIds ?? []);
  const duplicateRows = new Set(input.packet.duplicates.flatMap((candidate) => candidate.rowIds));
  const transferRows = new Set(
    input.packet.transfers.flatMap((candidate) => [candidate.debitRowId, candidate.creditRowId]),
  );
  const confirmedTransferRows = new Set(
    (input.confirmedTransferRows ?? []).flatMap((candidate) => [
      candidate.debitRowId,
      candidate.creditRowId,
    ]),
  );
  const meanings: ImportMeaningProposal[] = [];

  for (const duplicate of input.packet.duplicates) {
    meanings.push({
      id: `meaning_${stableHash(['duplicate', ...duplicate.rowIds])}`,
      kind: 'duplicate_warning',
      label: 'Possible duplicate',
      rowIds: duplicate.rowIds,
      state: 'warning_review_only',
      createsEvent: false,
      affectsTodayOnlyAfterAcceptance: false,
      explanation: `Rows are similar by ${duplicate.reason}; review before counting either row.`,
      reviewRequired: true,
    });
  }

  for (const transfer of input.packet.transfers) {
    const rowIds = [transfer.debitRowId, transfer.creditRowId];
    const confirmed = rowIds.every((rowId) => confirmedTransferRows.has(rowId));
    meanings.push({
      id: `meaning_${stableHash(['transfer', ...rowIds])}`,
      kind: 'transfer',
      label: confirmed ? 'Confirmed transfer' : 'Possible transfer',
      rowIds,
      state: confirmed ? 'confirmed' : 'possible_review_only',
      createsEvent: confirmed,
      affectsTodayOnlyAfterAcceptance: false,
      explanation: confirmed
        ? 'User confirmed both sides are one linked movement, so it is not income or spending.'
        : 'Equal and opposite rows look like a transfer; keep review-only until confirmed.',
      reviewRequired: !confirmed,
    });
  }

  for (const row of input.packet.rows) {
    if (duplicateRows.has(row.rowId) || transferRows.has(row.rowId)) continue;
    meanings.push(meaningForRow(row, confirmedRows.has(row.rowId)));
  }

  return {
    meanings,
    counts: {
      confirmedEvents: meanings.filter((meaning) => meaning.state === 'confirmed').length,
      possibleReviewOnly: meanings.filter((meaning) => meaning.state === 'possible_review_only')
        .length,
      transactionOnly: meanings.filter((meaning) => meaning.state === 'transaction_only').length,
      warnings: meanings.filter((meaning) => meaning.state === 'warning_review_only').length,
    },
  };
}

export function sanitizeSpreadsheetText(value: string): string {
  const trimmedLeft = value.replace(/^\uFEFF/, '');
  return /^[\s]*[=+\-@\t\r]/.test(trimmedLeft) ? `'${value}` : value;
}

export function stableHash(parts: readonly string[]): string {
  const text = parts.join('\u001f');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function baseImportOptions(options: GenericImportOptions): ImportJobDescriptor {
  return {
    importJobId: options.importJobId,
    sourceFileId: options.sourceFileId,
    accountId: options.accountId,
    currency: createCurrencyCode(options.currency),
    ...(options.accountExternalId === undefined
      ? {}
      : { accountExternalId: options.accountExternalId }),
  };
}

function withDerivedMetadata(input: {
  format: SupportedImportFormat;
  parser: ParserDescriptor;
  rows: readonly CanonicalImportRow[];
  issues: readonly ImportParseIssue[];
  descriptor: ImportJobDescriptor;
  parserWarnings: readonly string[];
  reconciliation?: BalanceReconciliationResult;
}): ImportParseResult {
  const duplicates = findDuplicateCandidates(input.rows);
  const transfers = findTransferCandidates(input.rows);
  const duplicateRows = new Set(duplicates.flatMap((candidate) => candidate.rowIds));
  const transferRows = new Set(
    transfers.flatMap((candidate) => [candidate.debitRowId, candidate.creditRowId]),
  );
  const rows = input.rows.map((row) => {
    const extraWarnings: ImportReviewReason[] = [];
    if (duplicateRows.has(row.canonicalRowId)) extraWarnings.push('possible_duplicate');
    if (transferRows.has(row.canonicalRowId)) extraWarnings.push('possible_transfer');
    if (extraWarnings.length === 0) return row;
    const warnings = uniqueValues([...row.warnings, ...extraWarnings]);
    return {
      ...row,
      warnings,
      reviewState: buildReviewState(warnings, row.fieldEvidence, row.normalized.categoryProposal),
    };
  });
  return {
    format: input.format,
    parser: input.parser,
    rows,
    issues: input.issues,
    ...(input.reconciliation === undefined ? {} : { reconciliation: input.reconciliation }),
    metadata: {
      importJobId: input.descriptor.importJobId,
      sourceFileId: input.descriptor.sourceFileId,
      accountId: input.descriptor.accountId,
      ...(input.descriptor.accountExternalId === undefined
        ? {}
        : { accountExternalId: input.descriptor.accountExternalId }),
      rowCount: rows.length,
      parserWarnings: input.parserWarnings,
      blockedCapabilities: importEngineBoundary.phase5BlockedCapabilities,
    },
  };
}

function buildCanonicalRow(input: {
  sourceKind: ImportSourceKind;
  sourceRowRef: string;
  raw: CanonicalImportRaw;
  normalized: CanonicalImportNormalized;
  parser: ParserDescriptor;
  descriptor: ImportJobDescriptor;
  parsedAt: string;
  original: Readonly<Record<string, string>>;
  fieldEvidence: ImportFieldEvidence;
  warnings: readonly ImportReviewReason[];
}): CanonicalImportRow {
  const rawRowHash = stableHash(
    Object.entries(input.original).map(([key, value]) => `${key}=${value}`),
  );
  const canonicalRowId = `importrow_${stableHash([
    input.descriptor.importJobId,
    input.descriptor.sourceFileId,
    input.sourceRowRef,
    rawRowHash,
  ])}`;
  const stableTransactionId = `transaction_import_${stableHash([
    input.normalized.accountId,
    input.normalized.providerTransactionId ?? '',
    input.normalized.postedDate,
    String(input.normalized.amount.minorUnits),
    input.normalized.description,
    input.sourceRowRef,
  ])}`;
  const provenance: ImportProvenance = {
    importJobId: input.descriptor.importJobId,
    sourceFileId: input.descriptor.sourceFileId,
    sourceKind: input.sourceKind,
    sourceRowRef: input.sourceRowRef,
    parser: input.parser,
    rawRowHash,
    original: input.original,
    parsedAt: input.parsedAt,
    corrections: [],
  };
  const rowWithoutFingerprint = {
    canonicalRowId,
    stableTransactionId,
    sourceKind: input.sourceKind,
    sourceRowRef: input.sourceRowRef,
    raw: input.raw,
    normalized: input.normalized,
    provenance,
    fieldEvidence: input.fieldEvidence,
    reviewState: buildReviewState(
      input.warnings,
      input.fieldEvidence,
      input.normalized.categoryProposal,
    ),
    duplicateFingerprint: { row: '', semantic: '' },
    warnings: input.warnings,
  };
  return {
    ...rowWithoutFingerprint,
    duplicateFingerprint: fingerprintImportRow(rowWithoutFingerprint),
  };
}

function normalizeCanonicalRaw(input: {
  accountId: string;
  accountExternalId?: string | undefined;
  currency: CurrencyCode;
  raw: CanonicalImportRaw;
  dateOrder: DateOrder;
}): CanonicalImportNormalized {
  const dateText = input.raw.postedDateText ?? input.raw.dateText;
  if (dateText === undefined) throw new Error('Import row is missing a date.');
  const amount = parseImportAmount(input.raw, input.currency);
  const descriptionText = input.raw.descriptionText ?? input.raw.counterpartyText;
  if (descriptionText === undefined || descriptionText.trim().length === 0) {
    throw new Error('Import row is missing a description.');
  }
  const normalized: {
    accountId: string;
    accountExternalId?: string;
    postedDate: LocalDate;
    amount: Money;
    description: string;
    sourceCurrency: CurrencyCode;
    counterparty?: string;
    reference?: string;
    runningBalance?: Money;
    providerTransactionId?: string;
  } = {
    accountId: input.accountId,
    ...(input.accountExternalId === undefined
      ? {}
      : { accountExternalId: input.accountExternalId }),
    postedDate: parseImportDate(dateText, input.dateOrder),
    amount,
    description: cleanImportedText(descriptionText),
    sourceCurrency: input.currency,
  };
  if (input.raw.counterpartyText !== undefined) {
    normalized.counterparty = cleanImportedText(input.raw.counterpartyText);
  }
  if (input.raw.referenceText !== undefined) {
    normalized.reference = cleanImportedText(input.raw.referenceText);
  }
  if (input.raw.runningBalanceText !== undefined) {
    normalized.runningBalance = parseMoneyText(input.raw.runningBalanceText, input.currency);
  }
  if (input.raw.providerTransactionId !== undefined) {
    normalized.providerTransactionId = cleanImportedText(input.raw.providerTransactionId);
  }
  return normalized;
}

function parseImportAmount(raw: CanonicalImportRaw, currency: CurrencyCode): Money {
  if (raw.amountText !== undefined && raw.amountText.trim() !== '') {
    return parseMoneyText(raw.amountText, currency);
  }
  const debit =
    raw.debitText === undefined || raw.debitText.trim() === ''
      ? undefined
      : parseMoneyText(raw.debitText, currency);
  const credit =
    raw.creditText === undefined || raw.creditText.trim() === ''
      ? undefined
      : parseMoneyText(raw.creditText, currency);
  if (
    debit !== undefined &&
    credit !== undefined &&
    debit.minorUnits !== 0 &&
    credit.minorUnits !== 0
  ) {
    throw new Error('Import row has both debit and credit values.');
  }
  if (debit !== undefined && debit.minorUnits !== 0) {
    return { minorUnits: -Math.abs(debit.minorUnits), currency };
  }
  if (credit !== undefined) {
    return { minorUnits: Math.abs(credit.minorUnits), currency };
  }
  throw new Error('Import row is missing an amount.');
}

function parseMoneyText(value: string, currency: CurrencyCode): Money {
  const source = value.trim();
  if (source.length === 0) throw new Error('Money value is empty.');
  const negativeByParentheses = /^\(.*\)$/.test(source);
  const hasExplicitNegative = /-/.test(source);
  const digits = source
    .replace(/[A-Z]{3}/gi, '')
    .replace(/[\u00a3$\u20ac]/g, '')
    .replace(/[(),\s]/g, '')
    .replace(/^\+/, '');
  const normalized = digits.replace(/-/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money value: ${value}`);
  }
  const [majorText = '0', minorText = ''] = normalized.split('.');
  const minor = Number(majorText) * 100 + Number(minorText.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error(`Unsafe money value: ${value}`);
  return {
    minorUnits: negativeByParentheses || hasExplicitNegative ? -minor : minor,
    currency,
  };
}

function parseImportDate(value: string, dateOrder: DateOrder): LocalDate {
  const trimmed = value.trim();
  const ofxMatch = /^(\d{4})(\d{2})(\d{2})/.exec(trimmed);
  if (ofxMatch !== null) {
    return createLocalDate(`${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return createLocalDate(trimmed);
  const parts = trimmed.split(/[/. -]/).filter(Boolean);
  if (parts.length !== 3) throw new Error(`Invalid date value: ${value}`);
  const first = parts[0];
  const second = parts[1];
  const third = parts[2];
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error(`Invalid date value: ${value}`);
  }
  if (dateOrder === 'ymd') {
    return createLocalDate(`${padYear(first)}-${pad2(second)}-${pad2(third)}`);
  }
  if (dateOrder === 'dmy') {
    return createLocalDate(`${padYear(third)}-${pad2(second)}-${pad2(first)}`);
  }
  return createLocalDate(`${padYear(third)}-${pad2(first)}-${pad2(second)}`);
}

function pad2(value: string): string {
  return value.padStart(2, '0');
}

function padYear(value: string): string {
  if (value.length === 2) {
    const year = Number(value);
    return String(year >= 70 ? 1900 + year : 2000 + year);
  }
  return value.padStart(4, '0');
}

function inferCsvMapping(headers: readonly string[]): CsvColumnMapping {
  return {
    date: findHeader(headers, ['date', 'transaction date']),
    postedDate: findHeader(headers, ['posted date', 'posting date', 'booked date']),
    amount: findHeader(headers, ['amount', 'transaction amount', 'value']),
    debit: findHeader(headers, ['debit', 'withdrawal', 'paid out', 'out']),
    credit: findHeader(headers, ['credit', 'deposit', 'paid in', 'in']),
    currency: findHeader(headers, ['currency', 'ccy']),
    description: findHeader(headers, ['description', 'narrative', 'memo', 'name', 'payee']),
    counterparty: findHeader(headers, ['counterparty', 'merchant', 'payee']),
    reference: findHeader(headers, ['reference', 'ref', 'check number', 'cheque number']),
    runningBalance: findHeader(headers, ['balance', 'running balance']),
    providerTransactionId: findHeader(headers, ['transaction id', 'fitid', 'id']),
  };
}

function rawFromCsvObject(
  object: Readonly<Record<string, string>>,
  mapping: CsvColumnMapping,
): CanonicalImportRaw {
  return compactRaw({
    dateText: readMapped(object, mapping.date),
    postedDateText: readMapped(object, mapping.postedDate),
    amountText: readMapped(object, mapping.amount),
    debitText: readMapped(object, mapping.debit),
    creditText: readMapped(object, mapping.credit),
    currencyText: readMapped(object, mapping.currency),
    descriptionText: readMapped(object, mapping.description),
    counterpartyText: readMapped(object, mapping.counterparty),
    referenceText: readMapped(object, mapping.reference),
    runningBalanceText: readMapped(object, mapping.runningBalance),
    providerTransactionId: readMapped(object, mapping.providerTransactionId),
  });
}

function readMapped(
  object: Readonly<Record<string, string>>,
  key: string | undefined,
): string | undefined {
  if (key === undefined) return undefined;
  const normalized = normalizeHeader(key);
  return object[normalized];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeader(headers: readonly string[], names: readonly string[]): string | undefined {
  return headers.find((header) => names.includes(header));
}

function rowObject(headers: readonly string[], cells: readonly string[]): Record<string, string> {
  const object: Record<string, string> = {};
  headers.forEach((header, index) => {
    object[header] = cells[index] ?? '';
  });
  return object;
}

function createPositionalHeaders(row: readonly string[]): string[] {
  return row.map((_, index) => `column ${index + 1}`);
}

function looksLikeDelimitedText(text: string): boolean {
  const firstMeaningfulLine =
    stripBom(text)
      .split(/\r?\n/u)
      .find((line) => line.trim().length > 0) ?? '';
  return [',', ';', '\t'].some((delimiter) => firstMeaningfulLine.includes(delimiter));
}

function looksLikePlainStatementText(text: string): boolean {
  return plainStatementLines(text).some(
    (line) => parseStatementTransactionLine(line) !== undefined,
  );
}

function plainStatementLines(text: string): string[] {
  return stripBom(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseStatementTransactionLine(line: string):
  | Readonly<{
      amountText: string;
      dateText: string;
      descriptionText: string;
      runningBalanceText?: string;
    }>
  | undefined {
  const source = line.replace(/\s+/g, ' ').trim();
  const datePattern = String.raw`(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})`;
  const moneyPattern = String.raw`[+-]?(?:GBP\s*)?(?:£\s*)?\(?\d[\d,]*(?:\.\d{2})?\)?`;
  const match = new RegExp(
    String.raw`^${datePattern}\s+(.+?)\s+(${moneyPattern})(?:\s+(${moneyPattern}))?\s*$`,
    'i',
  ).exec(source);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return undefined;
  }
  const description = match[2].trim();
  if (/^(opening|closing)\s+balance$/i.test(description)) return undefined;
  const parsed = {
    dateText: match[1],
    descriptionText: description,
    amountText: normaliseTextMoney(match[3]),
  };
  return match[4] === undefined
    ? parsed
    : { ...parsed, runningBalanceText: normaliseTextMoney(match[4]) };
}

function parseStatementBalanceLine(
  line: string,
  currency: CurrencyCode,
):
  | Readonly<{
      balance: Money;
      kind: 'opening' | 'closing';
    }>
  | undefined {
  const source = line.replace(/\s+/g, ' ').trim();
  const moneyPattern = String.raw`([+-]?(?:GBP\s*)?(?:£\s*)?\(?\d[\d,]*(?:\.\d{2})?\)?)`;
  const match = new RegExp(String.raw`^(opening|closing)\s+balance\s+${moneyPattern}$`, 'i').exec(
    source,
  );
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  return {
    kind: match[1].toLowerCase() === 'opening' ? 'opening' : 'closing',
    balance: parseMoneyText(normaliseTextMoney(match[2]), currency),
  };
}

function normaliseTextMoney(value: string): string {
  return value.replace(/^GBP\s*/i, '').replace(/\s+/g, '');
}

function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  const candidates: readonly (',' | ';' | '\t')[] = [',', ';', '\t'];
  return (
    candidates
      .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
      .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ','
  );
}

function formulaWarnings(raw: CanonicalImportRaw): ImportReviewReason[] {
  const values = Object.values(raw);
  return values.some((value) => value !== undefined && sanitizeSpreadsheetText(value) !== value)
    ? ['formula_like_text']
    : [];
}

function cleanImportedText(value: string): string {
  return sanitizeSpreadsheetText(value).trim().replace(/\s+/g, ' ');
}

function fieldEvidenceFromRaw(
  raw: CanonicalImportRaw,
  warnings: readonly ImportReviewReason[],
): ImportFieldEvidence {
  const hasWarning = warnings.length > 0;
  const dateEvidenceLevel =
    raw.dateText !== undefined && isAmbiguousNumericDate(raw.dateText)
      ? 'medium'
      : hasWarning
        ? 'medium'
        : 'high';
  return {
    date: dateEvidenceLevel,
    amount:
      raw.amountText === undefined && (raw.debitText === undefined || raw.creditText === undefined)
        ? 'medium'
        : 'high',
    description: hasWarning ? 'medium' : 'high',
    identity: raw.providerTransactionId === undefined ? 'medium' : 'high',
    balance: raw.runningBalanceText === undefined ? 'low' : 'high',
  };
}

function isAmbiguousNumericDate(value: string): boolean {
  const parts = value
    .trim()
    .split(/[/. -]/)
    .filter(Boolean);
  if (parts.length !== 3) return false;
  const first = Number(parts[0]);
  const second = Number(parts[1]);
  return first <= 12 && second <= 12;
}

function buildReviewState(
  warnings: readonly ImportReviewReason[],
  fieldEvidence: ImportFieldEvidence,
  categoryProposal?: CategoryProposal,
): ImportReviewState {
  const reasons = uniqueValues([
    ...warnings,
    ...(categoryProposal?.requiresReview === true ? ['uncategorised' as const] : []),
  ]);
  const levelValues = Object.values(fieldEvidence);
  const reviewEvidenceLevel: ImportEvidenceLevel =
    levelValues.includes('low') || reasons.length > 0
      ? 'low'
      : levelValues.includes('medium')
        ? 'medium'
        : 'high';
  return {
    status: reasons.length === 0 && reviewEvidenceLevel === 'high' ? 'proposed' : 'needs_review',
    authorityState: reasons.length === 0 ? 'imported-claim' : 'estimated',
    userConfirmationState: reasons.length === 0 ? 'not-requested' : 'requested',
    reasons,
    evidenceLevel: reviewEvidenceLevel,
    notes: reasons.map(reviewReasonNote),
  };
}

function reviewReasonNote(reason: ImportReviewReason): string {
  const notes: Record<ImportReviewReason, string> = {
    formula_like_text: 'A source field begins with spreadsheet formula syntax and was escaped.',
    ambiguous_date: 'The source date could be read in more than one locale.',
    ambiguous_amount: 'The source amount convention needs confirmation.',
    missing_required_field: 'A required date, amount or description field is missing.',
    qif_limitation: 'QIF is a legacy best-effort format with limited metadata.',
    possible_duplicate: 'This row may already be represented by another imported row.',
    possible_transfer: 'This row may be one side of an internal transfer.',
    balance_mismatch: 'Imported movements do not fully reconcile to supplied balances.',
    uncategorised: 'No confirmed deterministic category is available.',
    untrusted_parser_input: 'The source used fields outside this pure parser slice.',
  };
  return notes[reason];
}

function readFirstTag(text: string, tag: string): string | undefined {
  const escaped = escapeRegExp(tag);
  const closed = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i').exec(text);
  if (closed?.[1] !== undefined) return decodeEntities(closed[1].trim());
  const sgml = new RegExp(`<${escaped}[^>]*>([^<\\r\\n]+)`, 'i').exec(text);
  return sgml?.[1] === undefined ? undefined : decodeEntities(sgml[1].trim());
}

function readBlocks(text: string, tag: string): string[] {
  const blocks: string[] = [];
  const escaped = escapeRegExp(tag);
  const closed = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'gi');
  for (const match of text.matchAll(closed)) {
    if (match[1] !== undefined) blocks.push(match[1]);
  }
  if (blocks.length > 0) return blocks;

  const start = new RegExp(`<${escaped}[^>]*>`, 'gi');
  const matches = Array.from(text.matchAll(start));
  matches.forEach((match, index) => {
    const begin = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    blocks.push(text.slice(begin, end));
  });
  return blocks;
}

function tagsToRecord(text: string, tags: readonly string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const tag of tags) {
    const value = readFirstTag(text, tag);
    if (value !== undefined) record[tag.toLowerCase()] = value;
  }
  return record;
}

function readBalance(text: string, tag: string, currency: CurrencyCode): Money | undefined {
  const block = readBlocks(text, tag)[0];
  const amount = block === undefined ? undefined : readFirstTag(block, 'BALAMT');
  return amount === undefined ? undefined : parseMoneyText(amount, currency);
}

function parseQifRecords(
  text: string,
): readonly { entries: readonly { code: string; value: string }[] }[] {
  const records: { entries: { code: string; value: string }[] }[] = [];
  let current: { code: string; value: string }[] = [];
  for (const rawLine of stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    if (line.length === 0 || line.startsWith('!')) continue;
    if (line === '^') {
      if (current.length > 0) records.push({ entries: current });
      current = [];
      continue;
    }
    current.push({ code: line.slice(0, 1), value: line.slice(1).trim() });
  }
  if (current.length > 0) records.push({ entries: current });
  return records;
}

function firstQif(
  record: { entries: readonly { code: string; value: string }[] },
  code: string,
): string | undefined {
  return record.entries.find((entry) => entry.code === code)?.value;
}

function groupsByFingerprint(
  rows: readonly CanonicalImportRow[],
  key: keyof DuplicateFingerprint,
  reason: DuplicateCandidate['reason'],
  evidenceLevel: ImportEvidenceLevel,
): DuplicateCandidate[] {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const value = row.duplicateFingerprint[key];
    if (value === undefined || value === '') continue;
    groups.set(value, [...(groups.get(value) ?? []), row.canonicalRowId]);
  }
  return Array.from(groups.values())
    .filter((rowIds) => rowIds.length > 1)
    .map((rowIds) => ({ rowIds, reason, evidenceLevel }));
}

function uniqueCandidates(candidates: readonly DuplicateCandidate[]): DuplicateCandidate[] {
  const seen = new Set<string>();
  const unique: DuplicateCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.reason}:${[...candidate.rowIds].sort().join('|')}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }
  return unique;
}

function uniqueQuestions(questions: readonly ImportReviewQuestion[]): ImportReviewQuestion[] {
  const seen = new Set<string>();
  const unique: ImportReviewQuestion[] = [];
  for (const question of questions) {
    if (!seen.has(question.id)) {
      seen.add(question.id);
      unique.push(question);
    }
  }
  return unique;
}

function questionIdsByRow(
  questions: readonly ImportReviewQuestion[],
): ReadonlyMap<string, readonly string[]> {
  const byRow = new Map<string, string[]>();
  for (const question of questions) {
    for (const rowId of question.rowIds) {
      byRow.set(rowId, [...(byRow.get(rowId) ?? []), question.id]);
    }
  }
  return byRow;
}

function isPendingPostedCandidate(left: CanonicalImportRow, right: CanonicalImportRow): boolean {
  return (
    left.normalized.accountId === right.normalized.accountId &&
    left.normalized.amount.currency === right.normalized.amount.currency &&
    left.normalized.amount.minorUnits === right.normalized.amount.minorUnits &&
    Math.abs(daysBetween(left.normalized.postedDate, right.normalized.postedDate)) <= 5 &&
    descriptionSimilarity(left.normalized.description, right.normalized.description) >= 0.5 &&
    left.duplicateFingerprint.provider !== right.duplicateFingerprint.provider
  );
}

function descriptionSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeDescription(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalizeDescription(right).split(' ').filter(Boolean));
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / union.size;
}

function normalizeDescription(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function meaningForRow(
  row: ImportReviewRowSummary,
  userConfirmedMeaning: boolean,
): ImportMeaningProposal {
  const normalized = normalizeDescription(row.description);
  const base = {
    id: `meaning_${stableHash([row.rowId, row.description, String(row.amountMinor)])}`,
    rowIds: [row.rowId],
    affectsTodayOnlyAfterAcceptance: true,
  };
  if (row.amountMinor > 0 && /\b(salary|payroll|wages|employer|income)\b/i.test(normalized)) {
    return {
      ...base,
      kind: 'income_event',
      label: userConfirmedMeaning ? 'Confirmed income' : 'Possible income',
      state: userConfirmedMeaning ? 'confirmed' : 'possible_review_only',
      createsEvent: userConfirmedMeaning,
      explanation: userConfirmedMeaning
        ? 'User confirmed this row is income, so the meaning is explainable.'
        : 'The wording looks like income; keep it possible until reviewed.',
      reviewRequired: !userConfirmedMeaning,
    };
  }
  if (row.amountMinor < 0 && /\b(rent|mortgage|landlord)\b/i.test(normalized)) {
    return {
      ...base,
      kind: 'recurring_commitment',
      label: userConfirmedMeaning ? 'Confirmed bill' : 'Possible bill',
      state: userConfirmedMeaning ? 'confirmed' : 'possible_review_only',
      createsEvent: userConfirmedMeaning,
      explanation: userConfirmedMeaning
        ? 'User confirmed this row is a bill or commitment.'
        : 'The wording looks like a recurring bill; keep it possible until reviewed.',
      reviewRequired: !userConfirmedMeaning,
    };
  }
  if (row.amountMinor > 0 && /\b(refund|reversal|returned|chargeback)\b/i.test(normalized)) {
    return {
      ...base,
      kind: 'refund',
      label: userConfirmedMeaning ? 'Confirmed refund' : 'Possible refund',
      state: userConfirmedMeaning ? 'confirmed' : 'possible_review_only',
      createsEvent: userConfirmedMeaning,
      explanation: userConfirmedMeaning
        ? 'User confirmed this row is a refund or correction.'
        : 'The wording looks like a refund; link or leave for review.',
      reviewRequired: !userConfirmedMeaning,
    };
  }
  if (/\b(card payment|unknown|unclear|merchant|pos)\b/i.test(normalized)) {
    return {
      ...base,
      kind: 'unclear_merchant',
      label: 'Unclear merchant',
      state: 'possible_review_only',
      createsEvent: false,
      explanation: 'The source wording is not clear enough to create a meaning.',
      reviewRequired: true,
    };
  }
  return {
    ...base,
    kind: 'spending_transaction',
    label: row.amountMinor < 0 ? 'Spending transaction' : 'Money movement',
    state: 'transaction_only',
    createsEvent: false,
    explanation: 'This can be reviewed as a transaction without creating a separate event.',
    reviewRequired: row.decisionState !== 'ready_for_user_confirmation',
  };
}

function matchesCategorisationRule(row: CanonicalImportRow, rule: CategorisationRule): boolean {
  const text = `${row.normalized.description} ${row.normalized.counterparty ?? ''}`;
  const patternMatches =
    typeof rule.pattern === 'string'
      ? normalizeDescription(text).includes(normalizeDescription(rule.pattern))
      : rule.pattern.test(text);
  if (!patternMatches) return false;
  if (
    rule.counterparty !== undefined &&
    !normalizeDescription(text).includes(normalizeDescription(rule.counterparty))
  ) {
    return false;
  }
  if (
    rule.minAmountMinorUnits !== undefined &&
    row.normalized.amount.minorUnits < rule.minAmountMinorUnits
  ) {
    return false;
  }
  if (
    rule.maxAmountMinorUnits !== undefined &&
    row.normalized.amount.minorUnits > rule.maxAmountMinorUnits
  ) {
    return false;
  }
  return true;
}

function sumMoney(values: readonly Money[], currency: CurrencyCode): Money {
  return values.reduce((total, value) => addMoney(total, value), { minorUnits: 0, currency });
}

function addMoney(left: Money, right: Money): Money {
  assertCurrency(left, right.currency);
  const minorUnits = left.minorUnits + right.minorUnits;
  if (!Number.isSafeInteger(minorUnits)) throw new Error('Money total overflow.');
  return { minorUnits, currency: left.currency };
}

function subtractMoney(left: Money, right: Money): Money {
  assertCurrency(left, right.currency);
  const minorUnits = left.minorUnits - right.minorUnits;
  if (!Number.isSafeInteger(minorUnits)) throw new Error('Money total overflow.');
  return { minorUnits, currency: left.currency };
}

function assertCurrency(value: Money, currency: CurrencyCode): void {
  if (value.currency !== currency) {
    throw new Error(`Currency mismatch: ${value.currency} cannot be combined with ${currency}.`);
  }
}

function daysBetween(left: LocalDate, right: LocalDate): number {
  const leftTime = Date.parse(`${left}T00:00:00.000Z`);
  const rightTime = Date.parse(`${right}T00:00:00.000Z`);
  return Math.round((leftTime - rightTime) / 86_400_000);
}

function compactRaw(input: {
  dateText?: string | undefined;
  postedDateText?: string | undefined;
  amountText?: string | undefined;
  debitText?: string | undefined;
  creditText?: string | undefined;
  currencyText?: string | undefined;
  descriptionText?: string | undefined;
  counterpartyText?: string | undefined;
  referenceText?: string | undefined;
  runningBalanceText?: string | undefined;
  providerTransactionId?: string | undefined;
}): CanonicalImportRaw {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value.trim().length > 0),
  ) as CanonicalImportRaw;
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deterministicParsedAt(importJobId: string): string {
  const day = (parseInt(stableHash([importJobId]).slice(0, 2), 36) % 28) + 1;
  return `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`;
}

function joinNonEmpty(
  values: readonly (string | undefined)[],
  separator: string,
): string | undefined {
  const joined = values
    .filter((value): value is string => value !== undefined && value.trim().length > 0)
    .join(separator);
  return joined.length === 0 ? undefined : joined;
}

function uniqueValues<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

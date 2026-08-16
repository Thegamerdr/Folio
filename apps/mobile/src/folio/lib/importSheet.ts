// IMPORT-SHEET engine — the spreadsheet-returner migration wedge.
//
// ENGINES.md §6 "Import from a Sheet" (the migration wedge) + §0
// "Candidate item contract". The Sheets-returner audience arrives with months
// of rows they don't want to re-key; this engine turns CSV / TSV / pasted
// spreadsheet rows into *candidates* for the Review screen. It NEVER auto-counts
// — every produced item is a `CandidateMoneyItem`, reviewed before it becomes a
// posted fact (the review-before-truth rule, POSITIONING.md).
//
// Honesty contract (ENGINES.md §0): bad or missing columns surface explicit
// `issues` (human fix prompts), NOT silent guesses. An unparseable amount is
// reported and skipped, never coerced to 0. A missing amount/merchant column is
// reported and yields zero candidates rather than fabricating data.
//
// HARD RULES (per the build task):
//   • Pure, deterministic module. NO react-native imports, NO UI, NO file or
//     network I/O. It takes a string in and returns strings / objects out. A
//     thin native wrapper does the actual file read/write later.
//   • Lives in apps/mobile/src/folio/lib/. Colocated vitest test.
//   • exactOptionalPropertyTypes + noUncheckedIndexedAccess are ON — every
//     index access is guarded; optional fields are omitted, never set to
//     `undefined` explicitly.
//
// De-dupe against existing items is intentionally OUT OF SCOPE here: per
// OPEN_BANKING_DEDUPE_RESEARCH.md §7 it is a *separate* pure module
// (`proposeMatches`) that runs on the candidate list AFTER this parse. This
// engine only produces the candidates; it must not merge or drop look-alikes.

// ---------------------------------------------------------------------------
// §0 Candidate item contract — the normalised shape Review receives.
// This is the sheet-import subset of the full §0 union (pdf/image/manual are
// produced by their own readers). `source` is narrowed to this engine's inputs.
// ---------------------------------------------------------------------------

// The §0 candidate-source union. `csv` / `paste` are produced by THIS sheet engine.
// `pdf` / `photo` are produced by the on-device statement/photo reader — a statement file read by
// bundled OCR (pdf) or a photographed/screenshotted statement (photo). All four land in the SAME Review
// screen as candidates; the source only labels where a row came from.
export type CandidateSource = 'csv' | 'paste' | 'pdf' | 'photo';

export type CandidateKind =
  | 'income'
  | 'spend'
  | 'bill'
  | 'subscription'
  | 'debt-payment'
  | 'transfer'
  | 'unknown';

export type CandidateConfidence = 'high' | 'medium' | 'low';

export type CandidateMoneyItem = {
  /** Deterministic identity for one row in its source. Re-parsing the same source must reproduce
   * this ID, while distinct row positions must remain distinct even when date, amount and merchant
   * are identical. Landing idempotency depends on this row identity; it is not a natural-key hash. */
  id: string;
  /** Encrypted original retained in this workspace's device vault, when the candidate came from a
   *  selected file/photo. Metadata only; no file bytes or picker URI enter the candidate. */
  sourceEvidenceId?: string;
  source: CandidateSource;
  kind: CandidateKind;
  merchant: string;
  /** GBP. Spend is negative, income positive. */
  amount: number;
  /** ISO date (YYYY-MM-DD) when available. */
  date?: string;
  /** Suggested category — never silently final (confirmed in Review). */
  category?: string;
  confidence: CandidateConfidence;
  /** Human explanation / source context for Review. */
  note?: string;
};

// ---------------------------------------------------------------------------
// Issues — honest fix prompts, never silent guesses (§0).
// ---------------------------------------------------------------------------

export type ColumnIssueCode =
  | 'empty-input'
  | 'missing-amount'
  | 'missing-merchant'
  | 'bad-amount'
  | 'no-rows';

export type ColumnIssue = {
  code: ColumnIssueCode;
  /** Plain-language prompt the Review/import surface can show verbatim. */
  message: string;
  /** 1-based data-row number when the issue is row-specific. */
  row?: number;
};

// ---------------------------------------------------------------------------
// Options — manual override of the auto-detected layout.
// ---------------------------------------------------------------------------

/** Zero-based column indices. Any field may be omitted; only `merchant` and
 *  `amount` are required for a usable candidate. */
export type ColumnMapping = {
  date?: number;
  merchant?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  type?: number;
  account?: number;
  category?: number;
  note?: number;
};

export type ParseSheetOptions = {
  /** Defaults to `csv`. Use `paste` for rows pasted from a spreadsheet. */
  source?: CandidateSource;
  /** Force-disable / force-enable header detection. Omit to auto-detect. */
  hasHeader?: boolean;
  /** Pin columns explicitly; overrides header-name auto-mapping. */
  columnMapping?: ColumnMapping;
};

export type ParseSheetResult = {
  candidates: CandidateMoneyItem[];
  issues: ColumnIssue[];
};

// ---------------------------------------------------------------------------
// Folio CSV template — the clean-import download (ENGINES.md §6). Arbitrary
// CSV still works via auto-detection; this is the no-friction path.
// ---------------------------------------------------------------------------

export const FOLIO_CSV_TEMPLATE: string = [
  'date,amount,merchant,category,note,kind',
  '2026-06-20,-42.00,Tesco,Groceries,weekly shop,spend',
  '2026-06-25,2180.00,Salary,Income,,income',
  '2026-06-22,-11.99,Spotify,Subscription,,subscription',
].join('\n');

// ---------------------------------------------------------------------------
// Header-name dictionaries — used by auto-mapping + header detection.
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Readonly<Record<keyof ColumnMapping, readonly string[]>> = {
  date: ['date', 'when', 'day', 'transaction date', 'txn date', 'posted'],
  merchant: ['merchant', 'description', 'desc', 'name', 'payee', 'detail', 'details', 'narrative'],
  amount: ['amount', 'value', 'sum', 'total', 'gbp', '£'],
  debit: ['debit', 'out', 'money out', 'withdrawal', 'paid out', 'debit amount'],
  credit: ['credit', 'in', 'money in', 'deposit', 'paid in', 'credit amount'],
  type: ['type', 'kind', 'direction', 'flow'],
  account: ['account', 'acct', 'source', 'bank', 'card'],
  category: ['category', 'cat', 'tag', 'bucket'],
  note: ['note', 'notes', 'memo', 'comment', 'comments', 'reference', 'ref'],
};

/** Type-column tokens that map to a candidate kind. */
const KIND_TOKENS: Readonly<Record<string, CandidateKind>> = {
  income: 'income',
  in: 'income',
  credit: 'income',
  salary: 'income',
  spend: 'spend',
  out: 'spend',
  debit: 'spend',
  expense: 'spend',
  purchase: 'spend',
  bill: 'bill',
  subscription: 'subscription',
  sub: 'subscription',
  debt: 'debt-payment',
  'debt-payment': 'debt-payment',
  transfer: 'transfer',
  unknown: 'unknown',
};

// ---------------------------------------------------------------------------
// Delimiter detection — CSV (comma) vs TSV (tab) vs pipe, by first-line count.
// ---------------------------------------------------------------------------

function detectDelimiter(firstLine: string): string {
  const counts: ReadonlyArray<readonly [string, number]> = [
    ['\t', countOutsideQuotes(firstLine, '\t')],
    [',', countOutsideQuotes(firstLine, ',')],
    [';', countOutsideQuotes(firstLine, ';')],
    ['|', countOutsideQuotes(firstLine, '|')],
  ];
  let best = counts[0]!;
  for (const entry of counts) {
    if (entry[1] > best[1]) best = entry;
  }
  // No delimiter found at all → fall back to comma so a single-column file
  // still parses (and surfaces the right missing-column issues downstream).
  return best[1] > 0 ? best[0] : ',';
}

function countOutsideQuotes(line: string, ch: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ch && !inQuotes) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Row splitter — RFC-4180-ish: honours double-quoted fields (commas/delimiters
// inside quotes are literal) and unescapes doubled quotes ("" → ").
// ---------------------------------------------------------------------------

function splitRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (line.charAt(i + 1) === '"') {
          current += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

// ---------------------------------------------------------------------------
// Amount parsing — strips currency symbols + thousands separators; reads
// accountant-style parens as negative. Returns null on anything unparseable
// (so the caller can raise a `bad-amount` issue rather than guess).
// ---------------------------------------------------------------------------

function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  let sign = 1;
  let body = trimmed;

  // Accountant parentheses → negative.
  if (body.startsWith('(') && body.endsWith(')')) {
    sign = -1;
    body = body.slice(1, -1).trim();
  }

  // A leading or trailing minus → negative (keep it, strip the glyph).
  if (body.startsWith('-') || body.endsWith('-')) {
    sign = -1;
  }
  if (body.startsWith('+')) {
    body = body.slice(1);
  }

  // Strip currency symbols, spaces, thousands separators, and sign glyphs.
  // Keep digits, a decimal point. (UK/US format; comma = thousands.)
  const cleaned = body.replace(/[£$€,\s+\-]/g, '');
  if (cleaned === '' || !/^\d*\.?\d+$/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return sign * value;
}

// ---------------------------------------------------------------------------
// Date normalisation — pass through ISO (YYYY-MM-DD); best-effort for a couple
// of common spreadsheet shapes. Returns null when not confidently a date, so we
// simply omit `date` (lowering confidence) rather than invent one.
// ---------------------------------------------------------------------------

function normaliseDate(raw: string): string | null {
  const t = raw.trim();
  if (t === '') return null;
  // ISO YYYY-MM-DD (optionally with time) — take the date part.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY (UK default for the audience).
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(t);
  if (dmy) {
    const d = dmy[1]!.padStart(2, '0');
    const m = dmy[2]!.padStart(2, '0');
    const y = dmy[3]!;
    return `${y}-${m}-${d}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Header detection — true when the first row looks like column names rather
// than data: it matches known header aliases AND its "amount-ish" cell is not
// a parseable number.
// ---------------------------------------------------------------------------

function looksLikeHeader(cells: readonly string[]): boolean {
  const lowered = cells.map((c) => c.toLowerCase().trim());
  let aliasHits = 0;
  for (const cell of lowered) {
    for (const aliases of Object.values(HEADER_ALIASES)) {
      if (aliases.includes(cell)) {
        aliasHits++;
        break;
      }
    }
  }
  // A header row should have no parseable amounts in it.
  const hasNumericCell = cells.some((c) => parseAmount(c) !== null);
  return aliasHits >= 2 && !hasNumericCell;
}

// ---------------------------------------------------------------------------
// Auto-mapping from a header row → ColumnMapping.
// ---------------------------------------------------------------------------

function mapFromHeader(headerCells: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lowered = headerCells.map((c) => c.toLowerCase().trim());
  // First-match wins per field so the leftmost matching column is chosen.
  (Object.keys(HEADER_ALIASES) as Array<keyof ColumnMapping>).forEach((field) => {
    const aliases = HEADER_ALIASES[field];
    for (let i = 0; i < lowered.length; i++) {
      if (mapping[field] !== undefined) break;
      if (aliases.includes(lowered[i]!)) {
        mapping[field] = i;
      }
    }
  });
  return mapping;
}

// ---------------------------------------------------------------------------
// Kind + confidence inference.
// ---------------------------------------------------------------------------

function inferKind(typeCell: string | undefined, amount: number): CandidateKind {
  if (typeCell !== undefined) {
    const token = typeCell.toLowerCase().trim();
    const mapped = KIND_TOKENS[token];
    if (mapped !== undefined) return mapped;
  }
  return amount >= 0 ? 'income' : 'spend';
}

/** Sign an unsigned magnitude using the type column when the raw amount had no
 *  explicit sign. Income/credit → positive, everything else → negative. */
function signByType(magnitude: number, typeCell: string | undefined): number {
  if (typeCell === undefined) return magnitude; // no hint → leave as-is (positive)
  const token = typeCell.toLowerCase().trim();
  const kind = KIND_TOKENS[token];
  if (kind === 'income') return Math.abs(magnitude);
  if (kind === undefined) return magnitude;
  return -Math.abs(magnitude);
}

function gradeConfidence(
  hasDate: boolean,
  hasExplicitSign: boolean,
  hasTypeHint: boolean,
): CandidateConfidence {
  // High = we know what it is and when: a signed amount (or a type hint) AND a date.
  if (hasDate && (hasExplicitSign || hasTypeHint)) return 'high';
  if (hasDate || hasExplicitSign || hasTypeHint) return 'medium';
  return 'low';
}

// A raw amount cell carries an explicit sign if it leads/trails with -, is in
// parens, or leads with +.
function hasExplicitSign(rawAmount: string): boolean {
  const t = rawAmount.trim();
  return (
    t.startsWith('-') ||
    t.endsWith('-') ||
    t.startsWith('+') ||
    (t.startsWith('(') && t.endsWith(')'))
  );
}

// ---------------------------------------------------------------------------
// Deterministic row identity — rowIndex keeps distinct source rows distinct even when their money
// fields match, while merchant/amount make accidental cross-parser index reuse fail safely.
// ---------------------------------------------------------------------------

function candidateId(rowIndex: number, merchant: string, amount: number): string {
  const slug = merchant
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `sheet-${rowIndex}-${slug || 'row'}-${amount}`;
}

// ---------------------------------------------------------------------------
// Cell accessor — guarded index access (noUncheckedIndexedAccess ON).
// ---------------------------------------------------------------------------

function cellAt(cells: readonly string[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  if (index < 0 || index >= cells.length) return undefined;
  const value = cells[index];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

// ---------------------------------------------------------------------------
// parseSheet — the public entry point.
// ---------------------------------------------------------------------------

export function parseSheet(text: string, opts: ParseSheetOptions = {}): ParseSheetResult {
  const source: CandidateSource = opts.source ?? 'csv';
  const issues: ColumnIssue[] = [];

  // Normalise line endings, drop blank lines.
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '');

  if (lines.length === 0) {
    return {
      candidates: [],
      issues: [
        {
          code: 'empty-input',
          message: 'Nothing to read here — paste some rows or pick a file first.',
        },
      ],
    };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const rows = lines.map((line) => splitRow(line, delimiter));

  // Decide header presence.
  const firstRow = rows[0]!;
  const autoHeader = looksLikeHeader(firstRow);
  const hasHeader = opts.hasHeader ?? autoHeader;

  // Resolve column mapping: explicit override > header-derived > positional.
  let mapping: ColumnMapping;
  if (opts.columnMapping) {
    mapping = opts.columnMapping;
  } else if (hasHeader) {
    mapping = mapFromHeader(firstRow);
  } else {
    mapping = {};
  }

  // Validate required columns up front — honest issues, no guessing.
  const hasMoneyColumns =
    mapping.amount !== undefined || mapping.debit !== undefined || mapping.credit !== undefined;
  if (!hasMoneyColumns) {
    issues.push({
      code: 'missing-amount',
      message:
        'We could not find an amount column. Tell us which column holds the money (or add an "amount" header).',
    });
  }
  if (mapping.merchant === undefined) {
    issues.push({
      code: 'missing-merchant',
      message:
        'We could not find a name column. Tell us which column holds the merchant or description (or add a "merchant" header).',
    });
  }

  // Without the two required columns we produce nothing — never fabricate rows.
  if (!hasMoneyColumns || mapping.merchant === undefined) {
    return { candidates: [], issues };
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) {
    issues.push({ code: 'no-rows', message: 'That sheet has headers but no rows under them yet.' });
    return { candidates: [], issues };
  }

  const candidates: CandidateMoneyItem[] = [];

  dataRows.forEach((cells, i) => {
    const rowNumber = i + 1; // 1-based data row (header excluded)

    const merchant = cellAt(cells, mapping.merchant);
    const rawAmount = cellAt(cells, mapping.amount);
    const rawDebit = cellAt(cells, mapping.debit);
    const rawCredit = cellAt(cells, mapping.credit);

    // A row missing both its core cells is just blank padding — skip quietly.
    if (
      merchant === undefined &&
      rawAmount === undefined &&
      rawDebit === undefined &&
      rawCredit === undefined
    )
      return;

    if (rawAmount === undefined && rawDebit === undefined && rawCredit === undefined) {
      issues.push({
        code: 'bad-amount',
        message: `Row ${rowNumber} has no amount — we left it out rather than guess.`,
        row: rowNumber,
      });
      return;
    }

    if (rawAmount === undefined && rawDebit !== undefined && rawCredit !== undefined) {
      issues.push({
        code: 'bad-amount',
        message: `Row ${rowNumber} has money in both debit and credit columns — we left it out rather than guess.`,
        row: rowNumber,
      });
      return;
    }

    const splitRaw = rawDebit ?? rawCredit;
    const parsed = parseAmount(rawAmount ?? splitRaw ?? '');
    if (parsed === null) {
      const shown = rawAmount ?? splitRaw ?? '';
      issues.push({
        code: 'bad-amount',
        message: `Row ${rowNumber}: "${shown}" did not read as money — we left it out rather than guess.`,
        row: rowNumber,
      });
      return;
    }

    if (merchant === undefined) {
      issues.push({
        code: 'missing-merchant',
        message: `Row ${rowNumber} has an amount but no name — we left it out rather than guess.`,
        row: rowNumber,
      });
      return;
    }

    const typeCell = cellAt(cells, mapping.type);
    const splitDirection = rawAmount === undefined;
    const explicitSign = splitDirection || hasExplicitSign(rawAmount);
    // Separate debit/credit columns are an explicit direction. For a single unsigned amount, an
    // explicit type column may decide the sign; otherwise the magnitude stays positive for Review.
    const amount = splitDirection
      ? rawDebit !== undefined
        ? -Math.abs(parsed)
        : Math.abs(parsed)
      : explicitSign
        ? parsed
        : signByType(parsed, typeCell);

    const dateCell = cellAt(cells, mapping.date);
    const isoDate = dateCell !== undefined ? normaliseDate(dateCell) : null;

    const categoryCell = cellAt(cells, mapping.category);
    const noteCell = cellAt(cells, mapping.note);
    const accountCell = cellAt(cells, mapping.account);

    // Fold account/source context into the human note so Review keeps it.
    const noteParts: string[] = [];
    if (noteCell !== undefined) noteParts.push(noteCell);
    if (accountCell !== undefined) noteParts.push(accountCell);
    const note = noteParts.length > 0 ? noteParts.join(' · ') : undefined;

    const kind = inferKind(typeCell, amount);
    const confidence = gradeConfidence(isoDate !== null, explicitSign, typeCell !== undefined);

    // Build with omitted-when-absent optionals (exactOptionalPropertyTypes ON):
    // never set an optional field to `undefined` explicitly.
    const candidate: CandidateMoneyItem = {
      id: candidateId(rowNumber, merchant, amount),
      source,
      kind,
      merchant,
      amount,
      confidence,
    };
    if (isoDate !== null) candidate.date = isoDate;
    if (categoryCell !== undefined) candidate.category = categoryCell;
    if (note !== undefined) candidate.note = note;

    candidates.push(candidate);
  });

  return { candidates, issues };
}

// PURE parsing core for the LLM statement / photo reader.
//
// Kept in its own module — with NO react-native / expo / file-system / network imports — so the
// model-JSON → candidates logic can be unit-tested in plain Node WITHOUT loading the client module
// (`statementReaderClient.ts`), which imports expo-file-system. `statementReaderClient.ts` re-exports
// `parseCandidatesFromModelJson` from here, so callers still get one public surface.
//
// REVIEW-BEFORE-TRUTH: every candidate produced here carries the LOWEST confidence ('low') and is a
// candidate only — never a posted fact. We never fabricate a row the model did not return.

// Relative type import: this pure module is loaded by the apps/**/*.test.ts runner, which has no `@`
// alias (mirrors store.test.ts). Type-only, so it is erased before runtime regardless.
import type {
  CandidateConfidence,
  CandidateKind,
  CandidateMoneyItem,
  CandidateSource,
} from '../folio/lib/importSheet';

/** Model-extracted candidates are tentative by definition — always the lowest confidence so the
 *  Review screen makes the user confirm each one. */
const READER_CONFIDENCE: CandidateConfidence = 'low';

/** The statement's closing balance, as the model returned it — a fact the reader surfaces
 *  ALONGSIDE the item list, never derived or guessed by this parser. `amount` is signed pounds
 *  (whatever the model reported, verbatim); `asOfISO` is the date that balance is as-of. Both are
 *  required together — a closing balance with no date (or vice versa) is not useful enough to act on
 *  honestly, so the pair is dropped rather than kept half-populated. */
export type StatementClosingBalance = { amount: number; asOfISO: string };

/** Result of parsing a model reply: the item candidates PLUS the optional closing-balance fact.
 *  `closingBalance` is `null` when the model didn't return one (or returned an unusable shape) — the
 *  caller must never fabricate a balance when this is `null`. */
export type ParsedStatementReaderResult = {
  candidates: CandidateMoneyItem[];
  closingBalance: StatementClosingBalance | null;
};

/**
 * Turn the model's JSON reply into `CandidateMoneyItem[]`.
 *
 * Contract:
 *  - Accepts the strict `{ "items": [...] }` object, optionally wrapped in ```json … ``` fences.
 *  - Each well-formed item becomes one candidate: spend stays NEGATIVE, income stays POSITIVE
 *    (the model already signs them; we never re-derive the sign), `kind` inferred from the sign,
 *    `confidence` is the lowest enum (must be reviewed), `note` is a short honest provenance line.
 *  - Malformed JSON -> []. A missing / non-array / empty `items` -> []. Individual bad items are
 *    dropped, never coerced — we never fabricate a row the model did not return.
 *  - Pure: no I/O, no react-native/expo imports — safe to unit-test in plain Node.
 *
 * Kept as the stable public entry point (existing callers unaffected) — use
 * `parseStatementReaderResult` for the closing-balance-aware result.
 */
export function parseCandidatesFromModelJson(
  raw: string,
  source: CandidateSource,
): CandidateMoneyItem[] {
  return parseStatementReaderResult(raw, source).candidates;
}

/**
 * Turn the model's JSON reply into candidates PLUS the statement's closing balance, when the model
 * supplied one. Same item contract as `parseCandidatesFromModelJson` (see its doc); additionally
 * reads the reply's OPTIONAL `closingBalance` (number) / `closingDate` ("YYYY-MM-DD") top-level
 * fields — set by the reader's extended system prompt (see statementReaderClient.ts's
 * SYSTEM_PROMPT). Never fabricates a balance: a missing, non-numeric `closingBalance`, or a missing/
 * unparseable `closingDate` yields `closingBalance: null` in the result — items are unaffected
 * either way. Pure: no I/O, no react-native/expo imports.
 */
export function parseStatementReaderResult(
  raw: string,
  source: CandidateSource,
): ParsedStatementReaderResult {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { candidates: [], closingBalance: null };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { candidates: [], closingBalance: null };
  }

  const items = (parsed as { items?: unknown }).items;
  const candidates: CandidateMoneyItem[] = [];
  if (Array.isArray(items)) {
    items.forEach((entry, index) => {
      const candidate = toCandidate(entry, source, index);
      if (candidate !== null) candidates.push(candidate);
    });
  }

  const closingBalance = toClosingBalance(parsed);
  return { candidates, closingBalance };
}

/** Validate the reply's optional top-level `closingBalance`/`closingDate` pair. Returns `null` when
 *  either is absent/unusable — see `StatementClosingBalance`'s doc for why the pair is all-or-
 *  nothing. Reuses `normaliseDate` so the date passes the exact same real-calendar-date validation
 *  every item date does. */
function toClosingBalance(parsed: object): StatementClosingBalance | null {
  const row = parsed as { closingBalance?: unknown; closingDate?: unknown };
  const amount = row.closingBalance;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const asOfISO = normaliseDate(row.closingDate);
  if (asOfISO === null) return null;
  return { amount, asOfISO };
}

/** Remove a wrapping ```json … ``` (or bare ``` … ```) fence if the model added one. */
function stripCodeFences(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const withoutOpen = trimmed.replace(/^```[a-zA-Z0-9]*\s*\n?/, '');
  const withoutClose = withoutOpen.replace(/\n?```\s*$/, '');
  return withoutClose.trim();
}

/** Validate one parsed entry into a `CandidateMoneyItem`, or null to drop it. */
function toCandidate(
  entry: unknown,
  source: CandidateSource,
  index: number,
): CandidateMoneyItem | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
  const row = entry as {
    date?: unknown;
    merchant?: unknown;
    amount?: unknown;
    category?: unknown;
  };

  const merchant = typeof row.merchant === 'string' ? row.merchant.trim() : '';
  if (merchant.length === 0) return null;

  // The model signs the amount: spend negative, income positive. Keep its sign verbatim.
  const amount = row.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) return null;

  const isoDate = normaliseDate(row.date);
  const category =
    typeof row.category === 'string' && row.category.trim().length > 0
      ? row.category.trim()
      : undefined;

  const kind: CandidateKind = amount >= 0 ? 'income' : 'spend';
  const note = source === 'photo' ? 'read from your photo' : 'read from your statement';

  // Build with omitted-when-absent optionals (exactOptionalPropertyTypes ON): never set an
  // optional field to `undefined` explicitly.
  const candidate: CandidateMoneyItem = {
    id: candidateId(source, index, merchant, amount),
    source,
    kind,
    merchant,
    amount,
    confidence: READER_CONFIDENCE,
    note,
  };
  if (isoDate !== null) candidate.date = isoDate;
  if (category !== undefined) candidate.category = category;

  return candidate;
}

/** Accept the model's date and normalise it to YYYY-MM-DD, or null when absent/unparseable (we omit
 *  `date` rather than invent one). Validates real calendar dates and rejects roll-overs. */
function normaliseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    // Reject roll-overs like 2026-02-31 → March by round-tripping.
    return toIsoDate(parsed) === trimmed ? trimmed : null;
  }
  return null;
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Stable per-row id so re-parsing the same reply yields the same ids (no Date.now / random — keeps
 *  the parser pure and the tests deterministic). */
function candidateId(
  source: CandidateSource,
  index: number,
  merchant: string,
  amount: number,
): string {
  const slug = merchant
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `reader-${source}-${index}-${slug || 'row'}-${amount}`;
}

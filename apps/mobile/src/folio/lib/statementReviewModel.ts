import type { CandidateMoneyItem } from './importSheet';

export type StatementReviewFilter =
  | 'issues'
  | 'ready'
  | 'duplicates'
  | 'transfers'
  | 'income'
  | 'bills'
  | 'debt'
  | 'aside'
  | 'already-added'
  | 'all';

export type StatementReviewStatus = 'ready' | 'issue' | 'possible-repeat' | 'already-added';

export type StatementReviewRow = Readonly<{
  candidate: CandidateMoneyItem;
  duplicate: boolean;
  status: StatementReviewStatus;
  issue:
    | 'missing-name'
    | 'missing-amount'
    | 'invalid-amount'
    | 'missing-date'
    | 'invalid-date'
    | 'low-confidence'
    | 'unknown'
    | 'transfer'
    | 'possible-duplicate'
    | 'already-added'
    | null;
}>;

export type StatementReviewCounts = Readonly<{
  total: number;
  ready: number;
  issues: number;
  duplicates: number;
  alreadyAdded: number;
  transfers: number;
  income: number;
  bills: number;
  debt: number;
  uncertain: number;
}>;

export type StatementReviewModel = Readonly<{
  rows: readonly StatementReviewRow[];
  counts: StatementReviewCounts;
  dateFrom?: string;
  dateTo?: string;
  moneyIn: number;
  moneyOut: number;
}>;

function normaliseMerchant(value: string): string {
  return value.trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');
}

function isValidISODate(value: string | undefined): boolean {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const REVIEW_KIND_LABEL: Record<CandidateMoneyItem['kind'], string> = {
  income: 'income',
  spend: 'spending',
  bill: 'bill',
  subscription: 'subscription',
  'debt-payment': 'debt payment',
  transfer: 'transfer',
  unknown: 'needs review',
};

/** Exact natural key only. It deliberately does not claim fuzzy matches are duplicates. */
export function statementReviewNaturalKey(candidate: CandidateMoneyItem): string {
  return `${candidate.date ?? 'no-date'}\u001f${candidate.amount.toFixed(2)}\u001f${normaliseMerchant(candidate.merchant)}`;
}

/**
 * Linear-time review projection for any statement size. Confidence is never upgraded: only rows
 * the parser already marked high/medium, with a known non-transfer kind and no exact within-batch
 * collision, are ready by default.
 */
export function buildStatementReviewModel(
  candidates: readonly CandidateMoneyItem[],
  options: {
    alreadyAddedIds?: ReadonlySet<string>;
    resolvedDuplicateIds?: ReadonlySet<string>;
  } = {},
): StatementReviewModel {
  const keyCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = statementReviewNaturalKey(candidate);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const rows: StatementReviewRow[] = [];
  let ready = 0;
  let issues = 0;
  let duplicates = 0;
  let alreadyAdded = 0;
  let transfers = 0;
  let income = 0;
  let bills = 0;
  let debt = 0;
  let uncertain = 0;
  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  let moneyIn = 0;
  let moneyOut = 0;

  for (const candidate of candidates) {
    const rawAmount = candidate.amount as number | null | undefined;
    const amountReadable =
      rawAmount !== null &&
      rawAmount !== undefined &&
      Number.isFinite(rawAmount) &&
      rawAmount !== 0;
    const isAlreadyAdded = options.alreadyAddedIds?.has(candidate.id) ?? false;
    const duplicate =
      !isAlreadyAdded &&
      !options.resolvedDuplicateIds?.has(candidate.id) &&
      (keyCounts.get(statementReviewNaturalKey(candidate)) ?? 0) > 1;
    let issue: StatementReviewRow['issue'] = null;
    if (isAlreadyAdded) issue = 'already-added';
    else if (duplicate) issue = 'possible-duplicate';
    else if (candidate.merchant.trim().length === 0) issue = 'missing-name';
    else if (rawAmount === null || rawAmount === undefined) issue = 'missing-amount';
    else if (!amountReadable) issue = 'invalid-amount';
    else if (candidate.date === undefined || candidate.date.trim().length === 0)
      issue = 'missing-date';
    else if (!isValidISODate(candidate.date)) issue = 'invalid-date';
    else if (candidate.kind === 'transfer') issue = 'transfer';
    else if (candidate.kind === 'unknown') issue = 'unknown';
    else if (candidate.confidence === 'low') issue = 'low-confidence';
    const status: StatementReviewStatus = isAlreadyAdded
      ? 'already-added'
      : duplicate
        ? 'possible-repeat'
        : issue === null || issue === 'transfer'
          ? 'ready'
          : 'issue';
    rows.push({ candidate, duplicate, status, issue });

    if (status === 'ready') ready += 1;
    else if (status === 'issue') issues += 1;
    if (duplicate) duplicates += 1;
    if (isAlreadyAdded) alreadyAdded += 1;
    if (candidate.kind === 'transfer') transfers += 1;
    if (candidate.kind === 'income') income += 1;
    if (candidate.kind === 'bill' || candidate.kind === 'subscription') bills += 1;
    if (candidate.kind === 'debt-payment') debt += 1;
    if (candidate.confidence === 'low' || candidate.kind === 'unknown' || !amountReadable)
      uncertain += 1;
    if (candidate.date !== undefined) {
      if (dateFrom === undefined || candidate.date < dateFrom) dateFrom = candidate.date;
      if (dateTo === undefined || candidate.date > dateTo) dateTo = candidate.date;
    }
    if (amountReadable) {
      if (candidate.amount >= 0) moneyIn += candidate.amount;
      else moneyOut += Math.abs(candidate.amount);
    }
  }

  return {
    rows,
    counts: {
      total: candidates.length,
      ready,
      issues,
      duplicates,
      alreadyAdded,
      transfers,
      income,
      bills,
      debt,
      uncertain,
    },
    ...(dateFrom !== undefined ? { dateFrom } : {}),
    ...(dateTo !== undefined ? { dateTo } : {}),
    moneyIn,
    moneyOut,
  };
}

export function filterStatementReviewRows(
  rows: readonly StatementReviewRow[],
  filter: StatementReviewFilter,
  query: string,
  asideIds: ReadonlySet<string>,
): StatementReviewRow[] {
  const needle = query.trim().toLocaleLowerCase('en-GB');
  return rows.filter((row) => {
    const { candidate } = row;
    const aside = asideIds.has(candidate.id);
    const inFilter =
      filter === 'all'
        ? !aside
        : filter === 'aside'
          ? aside
          : !aside &&
            (filter === 'issues'
              ? row.status === 'issue'
              : filter === 'ready'
                ? row.status === 'ready'
                : filter === 'duplicates'
                  ? row.status === 'possible-repeat'
                  : filter === 'already-added'
                    ? row.status === 'already-added'
                    : filter === 'transfers'
                      ? candidate.kind === 'transfer'
                      : filter === 'income'
                        ? candidate.kind === 'income'
                        : filter === 'bills'
                          ? candidate.kind === 'bill' || candidate.kind === 'subscription'
                          : candidate.kind === 'debt-payment');
    if (!inFilter) return false;
    if (needle.length === 0) return true;
    return `${candidate.merchant} ${candidate.date ?? ''} ${candidate.amount} ${
      Number.isFinite(candidate.amount) ? candidate.amount.toFixed(2) : ''
    } ${REVIEW_KIND_LABEL[candidate.kind]} ${row.status} ${row.issue ?? ''}`
      .toLocaleLowerCase('en-GB')
      .includes(needle);
  });
}

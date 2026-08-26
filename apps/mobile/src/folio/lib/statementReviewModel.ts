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
  | 'all';

export type StatementReviewStatus = 'ready' | 'issue';

export type StatementReviewRow = Readonly<{
  candidate: CandidateMoneyItem;
  duplicate: boolean;
  status: StatementReviewStatus;
  issue: 'low-confidence' | 'unknown' | 'transfer' | 'possible-duplicate' | null;
}>;

export type StatementReviewCounts = Readonly<{
  total: number;
  ready: number;
  issues: number;
  duplicates: number;
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
    const duplicate = (keyCounts.get(statementReviewNaturalKey(candidate)) ?? 0) > 1;
    let issue: StatementReviewRow['issue'] = null;
    if (duplicate) issue = 'possible-duplicate';
    else if (candidate.kind === 'transfer') issue = 'transfer';
    else if (candidate.kind === 'unknown') issue = 'unknown';
    else if (candidate.confidence === 'low') issue = 'low-confidence';
    const status: StatementReviewStatus = issue === null ? 'ready' : 'issue';
    rows.push({ candidate, duplicate, status, issue });

    if (status === 'ready') ready += 1;
    else issues += 1;
    if (duplicate) duplicates += 1;
    if (candidate.kind === 'transfer') transfers += 1;
    if (candidate.kind === 'income') income += 1;
    if (candidate.kind === 'bill' || candidate.kind === 'subscription') bills += 1;
    if (candidate.kind === 'debt-payment') debt += 1;
    if (candidate.confidence === 'low' || candidate.kind === 'unknown') uncertain += 1;
    if (candidate.date !== undefined) {
      if (dateFrom === undefined || candidate.date < dateFrom) dateFrom = candidate.date;
      if (dateTo === undefined || candidate.date > dateTo) dateTo = candidate.date;
    }
    if (candidate.amount >= 0) moneyIn += candidate.amount;
    else moneyOut += Math.abs(candidate.amount);
  }

  return {
    rows,
    counts: {
      total: candidates.length,
      ready,
      issues,
      duplicates,
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
                  ? row.duplicate
                  : filter === 'transfers'
                    ? candidate.kind === 'transfer'
                    : filter === 'income'
                      ? candidate.kind === 'income'
                      : filter === 'bills'
                        ? candidate.kind === 'bill' || candidate.kind === 'subscription'
                        : candidate.kind === 'debt-payment');
    if (!inFilter) return false;
    if (needle.length === 0) return true;
    return `${candidate.merchant} ${candidate.date ?? ''} ${candidate.amount} ${candidate.kind}`
      .toLocaleLowerCase('en-GB')
      .includes(needle);
  });
}

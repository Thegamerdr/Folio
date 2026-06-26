import type { CurrencyCode, LocalDate, WorkspaceId } from '@folio/domain';

export const searchEngineBoundary = {
  packageName: '@folio/search-engine',
  deterministic: true,
  importsDatabaseDriver: false,
  importsNativeRuntime: false,
  importsCloudOrAi: false,
  storesSourcePayloads: false,
  workspaceScoped: true,
} as const;

export type SearchEntityType =
  | 'transaction'
  | 'expectation'
  | 'account'
  | 'event'
  | 'plan'
  | 'document'
  | 'business_tax_period'
  | (string & {});

export type SearchArchiveMode = 'active' | 'archived' | 'all';
export type SearchPrivacyLevel = 'standard' | 'private' | 'sensitive';
export type SearchPrivacyMode = 'standard' | 'include_private' | 'include_sensitive' | 'all';
export type SearchSortMode = 'relevance' | 'date_asc' | 'date_desc' | 'amount_asc' | 'amount_desc';

export type SearchSourceRef = Readonly<{
  workspaceId: WorkspaceId;
  entityType: SearchEntityType;
  entityId: string;
  sourceVersion?: string;
  sourceHash?: string;
}>;

export type SearchMoneyInput = Readonly<{
  minorUnits: number;
  currency?: string | CurrencyCode;
}>;

export type SearchIndexFacetInput = Readonly<{
  merchant?: string;
  reference?: string;
  date?: string | LocalDate;
  amount?: SearchMoneyInput;
  categoryId?: string;
  categoryIds?: readonly string[];
  accountId?: string;
  accountIds?: readonly string[];
  eventType?: string;
  planId?: string;
  documentId?: string;
  businessTaxPeriod?: string;
}>;

export type SearchIndexInput = Readonly<{
  ref: SearchSourceRef;
  title: string;
  excerpt?: string;
  keywords?: readonly string[];
  archived?: boolean;
  privacy?: SearchPrivacyLevel;
  facets?: SearchIndexFacetInput;
}>;

export type SearchMoneyFacet = Readonly<{
  minorUnits: number;
  currency?: string;
}>;

export type SearchIndexedFacets = Readonly<{
  merchant?: string;
  reference?: string;
  date?: string;
  amount?: SearchMoneyFacet;
  categoryIds: readonly string[];
  accountIds: readonly string[];
  eventType?: string;
  planId?: string;
  documentId?: string;
  businessTaxPeriod?: string;
}>;

export type SearchFieldTokens = Readonly<{
  title: readonly string[];
  excerpt: readonly string[];
  keywords: readonly string[];
  merchant: readonly string[];
  reference: readonly string[];
  facets: readonly string[];
}>;

export type SearchIndexRecord = Readonly<{
  id: string;
  key: string;
  ref: SearchSourceRef;
  workspaceId: WorkspaceId;
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  excerpt?: string;
  tokens: readonly string[];
  fieldTokens: SearchFieldTokens;
  facets: SearchIndexedFacets;
  archived: boolean;
  privacy: SearchPrivacyLevel;
  sourceFingerprint: string;
}>;

export type SearchDateRangeFilter = Readonly<{
  from?: string | LocalDate;
  to?: string | LocalDate;
}>;

export type SearchAmountFilter = Readonly<{
  minorUnits?: number;
  minMinorUnits?: number;
  maxMinorUnits?: number;
  currency?: string | CurrencyCode;
  useAbsolute?: boolean;
}>;

export type SearchTypedFilters = Readonly<{
  merchant?: string;
  reference?: string;
  date?: string | LocalDate;
  dateRange?: SearchDateRangeFilter;
  amount?: SearchAmountFilter;
  categoryId?: string;
  categoryIds?: readonly string[];
  accountId?: string;
  accountIds?: readonly string[];
  entityType?: SearchEntityType;
  entityTypes?: readonly SearchEntityType[];
  eventType?: string;
  eventTypes?: readonly string[];
  planId?: string;
  planIds?: readonly string[];
  documentId?: string;
  documentIds?: readonly string[];
  businessTaxPeriod?: string;
  businessTaxPeriods?: readonly string[];
}>;

export type SearchQuery = Readonly<{
  workspaceId: WorkspaceId;
  text?: string;
  filters?: SearchTypedFilters;
  archive?: SearchArchiveMode;
  privacy?: SearchPrivacyMode;
  sort?: SearchSortMode;
  limit?: number;
}>;

export type SearchHighlightRange = Readonly<{
  start: number;
  end: number;
  term: string;
}>;

export type SearchHighlight = Readonly<{
  field: 'title' | 'excerpt' | 'merchant' | 'reference';
  text: string;
  ranges: readonly SearchHighlightRange[];
}>;

export type SearchRankingMetadata = Readonly<{
  score: number;
  matchedTokens: readonly string[];
  fieldMatches: readonly string[];
  filterMatches: readonly string[];
  archivedPenalty: number;
}>;

export type SearchResult = Readonly<{
  recordId: string;
  ref: SearchSourceRef;
  title: string;
  excerpt?: string;
  facets: SearchIndexedFacets;
  archived: boolean;
  privacy: SearchPrivacyLevel;
  sourceFingerprint: string;
  rank: number;
  score: number;
  highlights: readonly SearchHighlight[];
  ranking: SearchRankingMetadata;
}>;

export type RebuildWorkspaceResult = Readonly<{
  workspaceId: WorkspaceId;
  removed: number;
  upserted: number;
  records: readonly SearchIndexRecord[];
}>;

export type NaturalLanguageSearchOptions = Readonly<{
  workspaceId: WorkspaceId;
  defaultCurrency?: string | CurrencyCode;
  today?: string | LocalDate;
}>;

export type NaturalLanguageSearchParse = Readonly<{
  originalText: string;
  remainingText: string;
  query: SearchQuery;
  appliedPatterns: readonly string[];
  notes: readonly string[];
  editable: true;
}>;

type MutableFacets = {
  merchant?: string;
  reference?: string;
  date?: string;
  amount?: SearchMoneyFacet;
  categoryIds: string[];
  accountIds: string[];
  eventType?: string;
  planId?: string;
  documentId?: string;
  businessTaxPeriod?: string;
};

type ParsedAmount = Readonly<{
  minorUnits: number;
  currency?: string;
}>;

type ConsumedRange = Readonly<{
  start: number;
  end: number;
}>;

export function buildSearchIndexRecord(input: SearchIndexInput): SearchIndexRecord {
  assertIndexInput(input);

  const facets = normaliseFacetInput(input.facets);
  const title = collapseWhitespace(input.title);
  const excerpt = input.excerpt === undefined ? undefined : collapseWhitespace(input.excerpt);
  const keywords = uniqueSorted((input.keywords ?? []).map(collapseWhitespace).filter(isNonEmpty));
  const fieldTokens = buildFieldTokens({ title, excerpt, keywords, facets });
  const tokens = uniqueSorted(Object.values(fieldTokens).flat());
  const key = searchRecordKey(input.ref);
  const ref = normaliseSourceRef(input.ref);
  const fingerprintParts = {
    ref,
    archived: input.archived ?? false,
    privacy: input.privacy ?? 'standard',
    title,
    excerpt,
    keywords,
    facets,
  };
  const record: {
    id: string;
    key: string;
    ref: SearchSourceRef;
    workspaceId: WorkspaceId;
    entityType: SearchEntityType;
    entityId: string;
    title: string;
    excerpt?: string;
    tokens: readonly string[];
    fieldTokens: SearchFieldTokens;
    facets: SearchIndexedFacets;
    archived: boolean;
    privacy: SearchPrivacyLevel;
    sourceFingerprint: string;
  } = {
    id: `search_${stableHash({ ref })}`,
    key,
    ref,
    workspaceId: ref.workspaceId,
    entityType: ref.entityType,
    entityId: ref.entityId,
    title,
    tokens,
    fieldTokens,
    facets,
    archived: input.archived ?? false,
    privacy: input.privacy ?? 'standard',
    sourceFingerprint: `fingerprint_${stableHash(fingerprintParts)}`,
  };

  if (excerpt !== undefined) {
    record.excerpt = excerpt;
  }

  return record;
}

export function rebuildSearchIndex(
  inputs: readonly SearchIndexInput[],
): readonly SearchIndexRecord[] {
  return inputs.map(buildSearchIndexRecord).sort(compareRecordsByKey);
}

export function searchRecords(
  records: readonly SearchIndexRecord[],
  query: SearchQuery,
): readonly SearchResult[] {
  const textTokens = tokenize(query.text ?? '');
  const archiveMode = query.archive ?? 'active';
  const privacyMode = query.privacy ?? 'standard';
  const filters = query.filters ?? {};
  const candidates: SearchResult[] = [];

  for (const record of records) {
    if (record.workspaceId !== query.workspaceId) continue;
    if (!matchesArchiveMode(record, archiveMode)) continue;
    if (!matchesPrivacyMode(record, privacyMode)) continue;

    const filterEvaluation = evaluateFilters(record, filters);
    if (!filterEvaluation.matches) continue;

    const textEvaluation = evaluateTextMatch(record, textTokens);
    if (!textEvaluation.matches) continue;

    const archivedPenalty = archiveMode === 'all' && record.archived ? -0.5 : 0;
    const score =
      textEvaluation.score +
      filterEvaluation.score +
      archivedPenalty +
      (record.archived ? -0.1 : 0);
    candidates.push(
      buildSearchResult({
        record,
        rank: 0,
        score,
        matchedTokens: textEvaluation.matchedTokens,
        fieldMatches: textEvaluation.fieldMatches,
        filterMatches: filterEvaluation.filterMatches,
        archivedPenalty,
        highlightTerms: textTokens,
      }),
    );
  }

  const sorted = candidates
    .sort((left, right) => compareSearchResults(left, right, query.sort ?? 'relevance'))
    .slice(0, normaliseLimit(query.limit));

  return sorted.map((result, index) => withRank(result, index + 1));
}

export class LocalSearchIndex {
  private readonly recordsByKey = new Map<string, SearchIndexRecord>();

  constructor(records: readonly SearchIndexRecord[] = []) {
    for (const record of records) {
      this.recordsByKey.set(record.key, record);
    }
  }

  upsert(input: SearchIndexInput | SearchIndexRecord): SearchIndexRecord {
    const record = isSearchIndexRecord(input) ? input : buildSearchIndexRecord(input);
    this.recordsByKey.set(record.key, record);
    return record;
  }

  upsertAll(
    inputs: readonly (SearchIndexInput | SearchIndexRecord)[],
  ): readonly SearchIndexRecord[] {
    return inputs.map((input) => this.upsert(input));
  }

  remove(ref: SearchSourceRef): boolean {
    return this.recordsByKey.delete(searchRecordKey(ref));
  }

  clearWorkspace(workspaceId: WorkspaceId): number {
    let removed = 0;
    for (const [key, record] of this.recordsByKey.entries()) {
      if (record.workspaceId === workspaceId) {
        this.recordsByKey.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  rebuildWorkspace(
    workspaceId: WorkspaceId,
    inputs: readonly (SearchIndexInput | SearchIndexRecord)[],
  ): RebuildWorkspaceResult {
    const removed = this.clearWorkspace(workspaceId);
    const records: SearchIndexRecord[] = [];
    for (const input of inputs) {
      const record = isSearchIndexRecord(input) ? input : buildSearchIndexRecord(input);
      if (record.workspaceId !== workspaceId) {
        throw new Error('Workspace rebuild inputs must all belong to the rebuilt workspace.');
      }
      records.push(this.upsert(record));
    }

    return {
      workspaceId,
      removed,
      upserted: records.length,
      records: records.sort(compareRecordsByKey),
    };
  }

  search(query: SearchQuery): readonly SearchResult[] {
    return searchRecords(this.snapshot(), query);
  }

  snapshot(workspaceId?: WorkspaceId): readonly SearchIndexRecord[] {
    const records = Array.from(this.recordsByKey.values());
    return records
      .filter((record) => workspaceId === undefined || record.workspaceId === workspaceId)
      .sort(compareRecordsByKey);
  }
}

export function parseNaturalLanguageSearchQuery(
  input: string,
  options: NaturalLanguageSearchOptions,
): NaturalLanguageSearchParse {
  let remaining = collapseWhitespace(input);
  const filters: {
    merchant?: string;
    reference?: string;
    date?: string;
    dateRange?: SearchDateRangeFilter;
    amount?: SearchAmountFilter;
    categoryIds?: string[];
    accountIds?: string[];
    entityTypes?: SearchEntityType[];
    eventTypes?: string[];
    planIds?: string[];
    documentIds?: string[];
    businessTaxPeriods?: string[];
  } = {};
  const appliedPatterns: string[] = [];
  const notes: string[] = [];
  let archive: SearchArchiveMode | undefined;
  let privacy: SearchPrivacyMode | undefined;

  const keyed = extractKeyedFilters(remaining);
  remaining = keyed.remaining;
  for (const match of keyed.matches) {
    const value = match.value;
    switch (match.key) {
      case 'merchant':
        filters.merchant = value;
        appliedPatterns.push('merchant');
        break;
      case 'ref':
      case 'reference':
        filters.reference = value;
        appliedPatterns.push('reference');
        break;
      case 'category':
        filters.categoryIds = pushUnique(filters.categoryIds, value);
        appliedPatterns.push('category');
        break;
      case 'account':
        filters.accountIds = pushUnique(filters.accountIds, value);
        appliedPatterns.push('account');
        break;
      case 'event':
      case 'eventtype':
        filters.eventTypes = pushUnique(filters.eventTypes, value);
        appliedPatterns.push('event_type');
        break;
      case 'plan':
        filters.planIds = pushUnique(filters.planIds, value);
        appliedPatterns.push('plan');
        break;
      case 'doc':
      case 'document':
        filters.documentIds = pushUnique(filters.documentIds, value);
        appliedPatterns.push('document');
        break;
      case 'tax':
      case 'taxperiod':
        filters.businessTaxPeriods = pushUnique(filters.businessTaxPeriods, value);
        appliedPatterns.push('business_tax_period');
        break;
      case 'type':
        filters.entityTypes = pushUnique(filters.entityTypes, value as SearchEntityType);
        appliedPatterns.push('entity_type');
        break;
    }
  }

  const archiveResult = consumeArchiveMode(remaining);
  remaining = archiveResult.remaining;
  if (archiveResult.archive !== undefined) {
    archive = archiveResult.archive;
    appliedPatterns.push(`archive:${archive}`);
  }

  const privacyResult = consumePrivacyMode(remaining);
  remaining = privacyResult.remaining;
  if (privacyResult.privacy !== undefined) {
    privacy = privacyResult.privacy;
    appliedPatterns.push(`privacy:${privacy}`);
  }

  const relativeDate = consumeRelativeDate(remaining, options.today);
  remaining = relativeDate.remaining;
  if (relativeDate.date !== undefined) {
    filters.date = relativeDate.date;
    appliedPatterns.push(relativeDate.pattern);
  }
  if (relativeDate.dateRange !== undefined) {
    filters.dateRange = relativeDate.dateRange;
    appliedPatterns.push(relativeDate.pattern);
  }
  notes.push(...relativeDate.notes);

  const dateRange = consumeDateRange(remaining);
  remaining = dateRange.remaining;
  if (dateRange.date !== undefined) {
    filters.date = dateRange.date;
    appliedPatterns.push(dateRange.pattern);
  }
  if (dateRange.dateRange !== undefined) {
    filters.dateRange = dateRange.dateRange;
    appliedPatterns.push(dateRange.pattern);
  }

  const amountResult = consumeAmountFilter(remaining, options.defaultCurrency);
  remaining = amountResult.remaining;
  if (amountResult.amount !== undefined) {
    filters.amount = amountResult.amount;
    appliedPatterns.push(amountResult.pattern);
  }

  const query: {
    workspaceId: WorkspaceId;
    text?: string;
    filters?: SearchTypedFilters;
    archive?: SearchArchiveMode;
    privacy?: SearchPrivacyMode;
  } = {
    workspaceId: options.workspaceId,
  };

  const text = collapseWhitespace(remaining);
  if (text.length > 0) {
    query.text = text;
  }

  const typedFilters = compactFilters(filters);
  if (typedFilters !== undefined) {
    query.filters = typedFilters;
  }
  if (archive !== undefined) {
    query.archive = archive;
  }
  if (privacy !== undefined) {
    query.privacy = privacy;
  }

  return {
    originalText: input,
    remainingText: text,
    query,
    appliedPatterns: uniqueSorted(appliedPatterns),
    notes: uniqueSorted(notes),
    editable: true,
  };
}

export function searchRecordKey(ref: SearchSourceRef): string {
  return `${ref.workspaceId}:${ref.entityType}:${ref.entityId}`;
}

export function tokenize(input: string): readonly string[] {
  const normalised = normaliseForSearch(input);
  const matches = normalised.match(/[a-z0-9]+/g) ?? [];
  return uniqueSorted(matches);
}

function assertIndexInput(input: SearchIndexInput): void {
  if (!isNonEmpty(input.ref.entityType)) {
    throw new Error('Search index entries require an entity type.');
  }
  if (!isNonEmpty(input.ref.entityId)) {
    throw new Error('Search index entries require an entity id.');
  }
  if (!isNonEmpty(input.title)) {
    throw new Error('Search index entries require a title.');
  }
  if (input.privacy !== undefined && !isSearchPrivacyLevel(input.privacy)) {
    throw new Error(`Unsupported search privacy level: ${input.privacy}`);
  }
}

function normaliseSourceRef(ref: SearchSourceRef): SearchSourceRef {
  const normalised: {
    workspaceId: WorkspaceId;
    entityType: SearchEntityType;
    entityId: string;
    sourceVersion?: string;
    sourceHash?: string;
  } = {
    workspaceId: ref.workspaceId,
    entityType: collapseWhitespace(ref.entityType),
    entityId: collapseWhitespace(ref.entityId),
  };
  if (ref.sourceVersion !== undefined) {
    normalised.sourceVersion = collapseWhitespace(ref.sourceVersion);
  }
  if (ref.sourceHash !== undefined) {
    normalised.sourceHash = collapseWhitespace(ref.sourceHash);
  }
  return normalised;
}

function normaliseFacetInput(input: SearchIndexFacetInput | undefined): SearchIndexedFacets {
  const mutable: MutableFacets = {
    categoryIds: uniqueSorted(
      [input?.categoryId, ...(input?.categoryIds ?? [])].filter(isNonEmpty).map(collapseWhitespace),
    ),
    accountIds: uniqueSorted(
      [input?.accountId, ...(input?.accountIds ?? [])].filter(isNonEmpty).map(collapseWhitespace),
    ),
  };

  if (input?.merchant !== undefined) {
    mutable.merchant = collapseWhitespace(input.merchant);
  }
  if (input?.reference !== undefined) {
    mutable.reference = collapseWhitespace(input.reference);
  }
  if (input?.date !== undefined) {
    mutable.date = normaliseLocalDate(input.date);
  }
  if (input?.amount !== undefined) {
    mutable.amount = normaliseMoneyFacet(input.amount);
  }
  if (input?.eventType !== undefined) {
    mutable.eventType = collapseWhitespace(input.eventType);
  }
  if (input?.planId !== undefined) {
    mutable.planId = collapseWhitespace(input.planId);
  }
  if (input?.documentId !== undefined) {
    mutable.documentId = collapseWhitespace(input.documentId);
  }
  if (input?.businessTaxPeriod !== undefined) {
    mutable.businessTaxPeriod = collapseWhitespace(input.businessTaxPeriod);
  }

  return mutable;
}

function normaliseMoneyFacet(input: SearchMoneyInput): SearchMoneyFacet {
  assertSafeInteger(input.minorUnits, 'Search amount minorUnits');
  const money: { minorUnits: number; currency?: string } = {
    minorUnits: input.minorUnits,
  };
  if (input.currency !== undefined) {
    money.currency = normaliseCurrency(input.currency);
  }
  return money;
}

function buildFieldTokens(input: {
  title: string;
  excerpt: string | undefined;
  keywords: readonly string[];
  facets: SearchIndexedFacets;
}): SearchFieldTokens {
  const facetText = [
    ...input.facets.categoryIds,
    ...input.facets.accountIds,
    input.facets.date,
    input.facets.amount?.currency,
    input.facets.amount === undefined ? undefined : String(input.facets.amount.minorUnits),
    input.facets.eventType,
    input.facets.planId,
    input.facets.documentId,
    input.facets.businessTaxPeriod,
  ]
    .filter(isNonEmpty)
    .join(' ');

  return {
    title: tokenize(input.title),
    excerpt: tokenize(input.excerpt ?? ''),
    keywords: tokenize(input.keywords.join(' ')),
    merchant: tokenize(input.facets.merchant ?? ''),
    reference: tokenize(input.facets.reference ?? ''),
    facets: tokenize(facetText),
  };
}

function evaluateTextMatch(
  record: SearchIndexRecord,
  queryTokens: readonly string[],
): {
  matches: boolean;
  score: number;
  matchedTokens: readonly string[];
  fieldMatches: readonly string[];
} {
  if (queryTokens.length === 0) {
    return { matches: true, score: 0, matchedTokens: [], fieldMatches: [] };
  }

  const matchedTokens: string[] = [];
  const fieldMatches: string[] = [];
  let score = 0;

  for (const token of queryTokens) {
    let tokenMatched = false;
    for (const [field, tokens] of Object.entries(record.fieldTokens)) {
      if (tokens.some((candidate) => candidate === token || candidate.startsWith(token))) {
        tokenMatched = true;
        fieldMatches.push(field);
        score += scoreForField(field);
      }
    }
    if (!tokenMatched) {
      return { matches: false, score: 0, matchedTokens: [], fieldMatches: [] };
    }
    matchedTokens.push(token);
  }

  return {
    matches: true,
    score,
    matchedTokens: uniqueSorted(matchedTokens),
    fieldMatches: uniqueSorted(fieldMatches),
  };
}

function evaluateFilters(
  record: SearchIndexRecord,
  filters: SearchTypedFilters,
): { matches: boolean; score: number; filterMatches: readonly string[] } {
  const filterMatches: string[] = [];

  if (filters.merchant !== undefined) {
    if (!containsNormalised(record.facets.merchant, filters.merchant)) return failedFilter();
    filterMatches.push('merchant');
  }
  if (filters.reference !== undefined) {
    if (!containsNormalised(record.facets.reference, filters.reference)) return failedFilter();
    filterMatches.push('reference');
  }
  if (filters.date !== undefined) {
    if (record.facets.date !== normaliseLocalDate(filters.date)) return failedFilter();
    filterMatches.push('date');
  }
  if (filters.dateRange !== undefined) {
    if (!matchesDateRange(record.facets.date, filters.dateRange)) return failedFilter();
    filterMatches.push('date_range');
  }
  if (filters.amount !== undefined) {
    if (!matchesAmount(record.facets.amount, filters.amount)) return failedFilter();
    filterMatches.push('amount');
  }

  const categoryIds = normaliseFilterValues([filters.categoryId, ...(filters.categoryIds ?? [])]);
  if (categoryIds.length > 0) {
    if (!hasAnyNormalised(record.facets.categoryIds, categoryIds)) return failedFilter();
    filterMatches.push('category');
  }

  const accountIds = normaliseFilterValues([filters.accountId, ...(filters.accountIds ?? [])]);
  if (accountIds.length > 0) {
    if (!hasAnyNormalised(record.facets.accountIds, accountIds)) return failedFilter();
    filterMatches.push('account');
  }

  const entityTypes = normaliseFilterValues([
    filters.entityType,
    ...(filters.entityTypes ?? []),
  ] as readonly string[]);
  if (entityTypes.length > 0) {
    if (!entityTypes.includes(normaliseId(record.entityType))) return failedFilter();
    filterMatches.push('entity_type');
  }

  const eventTypes = normaliseFilterValues([filters.eventType, ...(filters.eventTypes ?? [])]);
  if (eventTypes.length > 0) {
    if (!valueInNormalisedSet(record.facets.eventType, eventTypes)) return failedFilter();
    filterMatches.push('event_type');
  }

  const planIds = normaliseFilterValues([filters.planId, ...(filters.planIds ?? [])]);
  if (planIds.length > 0) {
    if (!valueInNormalisedSet(record.facets.planId, planIds)) return failedFilter();
    filterMatches.push('plan');
  }

  const documentIds = normaliseFilterValues([filters.documentId, ...(filters.documentIds ?? [])]);
  if (documentIds.length > 0) {
    if (!valueInNormalisedSet(record.facets.documentId, documentIds)) return failedFilter();
    filterMatches.push('document');
  }

  const taxPeriods = normaliseFilterValues([
    filters.businessTaxPeriod,
    ...(filters.businessTaxPeriods ?? []),
  ]);
  if (taxPeriods.length > 0) {
    if (!valueInNormalisedSet(record.facets.businessTaxPeriod, taxPeriods)) return failedFilter();
    filterMatches.push('business_tax_period');
  }

  return {
    matches: true,
    score: filterMatches.length * 0.75,
    filterMatches: uniqueSorted(filterMatches),
  };
}

function failedFilter(): { matches: false; score: 0; filterMatches: readonly string[] } {
  return { matches: false, score: 0, filterMatches: [] };
}

function buildSearchResult(input: {
  record: SearchIndexRecord;
  rank: number;
  score: number;
  matchedTokens: readonly string[];
  fieldMatches: readonly string[];
  filterMatches: readonly string[];
  archivedPenalty: number;
  highlightTerms: readonly string[];
}): SearchResult {
  const result: {
    recordId: string;
    ref: SearchSourceRef;
    title: string;
    excerpt?: string;
    facets: SearchIndexedFacets;
    archived: boolean;
    privacy: SearchPrivacyLevel;
    sourceFingerprint: string;
    rank: number;
    score: number;
    highlights: readonly SearchHighlight[];
    ranking: SearchRankingMetadata;
  } = {
    recordId: input.record.id,
    ref: input.record.ref,
    title: input.record.title,
    facets: input.record.facets,
    archived: input.record.archived,
    privacy: input.record.privacy,
    sourceFingerprint: input.record.sourceFingerprint,
    rank: input.rank,
    score: roundScore(input.score),
    highlights: buildHighlights(input.record, input.highlightTerms),
    ranking: {
      score: roundScore(input.score),
      matchedTokens: input.matchedTokens,
      fieldMatches: input.fieldMatches,
      filterMatches: input.filterMatches,
      archivedPenalty: input.archivedPenalty,
    },
  };
  if (input.record.excerpt !== undefined) {
    result.excerpt = input.record.excerpt;
  }
  return result;
}

function withRank(result: SearchResult, rank: number): SearchResult {
  const ranked: {
    recordId: string;
    ref: SearchSourceRef;
    title: string;
    excerpt?: string;
    facets: SearchIndexedFacets;
    archived: boolean;
    privacy: SearchPrivacyLevel;
    sourceFingerprint: string;
    rank: number;
    score: number;
    highlights: readonly SearchHighlight[];
    ranking: SearchRankingMetadata;
  } = {
    recordId: result.recordId,
    ref: result.ref,
    title: result.title,
    facets: result.facets,
    archived: result.archived,
    privacy: result.privacy,
    sourceFingerprint: result.sourceFingerprint,
    rank,
    score: result.score,
    highlights: result.highlights,
    ranking: result.ranking,
  };
  if (result.excerpt !== undefined) {
    ranked.excerpt = result.excerpt;
  }
  return ranked;
}

function buildHighlights(
  record: SearchIndexRecord,
  terms: readonly string[],
): readonly SearchHighlight[] {
  if (terms.length === 0) return [];

  const highlights: SearchHighlight[] = [];
  pushHighlight(highlights, 'title', record.title, terms);
  if (record.excerpt !== undefined) {
    pushHighlight(highlights, 'excerpt', record.excerpt, terms);
  }
  if (record.facets.merchant !== undefined) {
    pushHighlight(highlights, 'merchant', record.facets.merchant, terms);
  }
  if (record.facets.reference !== undefined) {
    pushHighlight(highlights, 'reference', record.facets.reference, terms);
  }
  return highlights;
}

function pushHighlight(
  highlights: SearchHighlight[],
  field: SearchHighlight['field'],
  text: string,
  terms: readonly string[],
): void {
  const ranges: SearchHighlightRange[] = [];
  const normalisedText = normaliseForSearch(text);
  for (const term of terms) {
    const normalisedTerm = normaliseForSearch(term);
    const start = normalisedText.indexOf(normalisedTerm);
    if (start >= 0) {
      ranges.push({ start, end: start + normalisedTerm.length, term: normalisedTerm });
    }
  }
  if (ranges.length > 0) {
    highlights.push({
      field,
      text,
      ranges: ranges.sort((left, right) => left.start - right.start || left.end - right.end),
    });
  }
}

function compareSearchResults(
  left: SearchResult,
  right: SearchResult,
  sort: SearchSortMode,
): number {
  switch (sort) {
    case 'date_asc':
      return (
        compareOptionalString(left.facets.date, right.facets.date, 'asc') ||
        compareStable(left, right)
      );
    case 'date_desc':
      return (
        compareOptionalString(left.facets.date, right.facets.date, 'desc') ||
        compareStable(left, right)
      );
    case 'amount_asc':
      return (
        compareOptionalNumber(
          left.facets.amount?.minorUnits,
          right.facets.amount?.minorUnits,
          'asc',
        ) || compareStable(left, right)
      );
    case 'amount_desc':
      return (
        compareOptionalNumber(
          left.facets.amount?.minorUnits,
          right.facets.amount?.minorUnits,
          'desc',
        ) || compareStable(left, right)
      );
    case 'relevance':
      return (
        right.score - left.score ||
        compareOptionalString(left.facets.date, right.facets.date, 'desc') ||
        compareStable(left, right)
      );
  }
}

function compareStable(left: SearchResult, right: SearchResult): number {
  return (
    left.title.localeCompare(right.title) ||
    left.ref.entityType.localeCompare(right.ref.entityType) ||
    left.ref.entityId.localeCompare(right.ref.entityId)
  );
}

function compareRecordsByKey(left: SearchIndexRecord, right: SearchIndexRecord): number {
  return left.key.localeCompare(right.key);
}

function matchesArchiveMode(record: SearchIndexRecord, mode: SearchArchiveMode): boolean {
  switch (mode) {
    case 'active':
      return !record.archived;
    case 'archived':
      return record.archived;
    case 'all':
      return true;
  }
}

function matchesPrivacyMode(record: SearchIndexRecord, mode: SearchPrivacyMode): boolean {
  switch (mode) {
    case 'standard':
      return record.privacy === 'standard';
    case 'include_private':
      return record.privacy === 'standard' || record.privacy === 'private';
    case 'include_sensitive':
      return record.privacy === 'standard' || record.privacy === 'sensitive';
    case 'all':
      return true;
  }
}

function matchesDateRange(date: string | undefined, range: SearchDateRangeFilter): boolean {
  if (date === undefined) return false;
  if (range.from !== undefined && date < normaliseLocalDate(range.from)) return false;
  if (range.to !== undefined && date > normaliseLocalDate(range.to)) return false;
  return true;
}

function matchesAmount(amount: SearchMoneyFacet | undefined, filter: SearchAmountFilter): boolean {
  if (amount === undefined) return false;
  if (filter.currency !== undefined && amount.currency !== normaliseCurrency(filter.currency)) {
    return false;
  }

  const amountMinor = filter.useAbsolute === true ? Math.abs(amount.minorUnits) : amount.minorUnits;
  if (filter.minMinorUnits !== undefined && amountMinor < filter.minMinorUnits) return false;
  if (filter.maxMinorUnits !== undefined && amountMinor > filter.maxMinorUnits) return false;
  if (filter.minorUnits !== undefined) {
    const expected = filter.useAbsolute === true ? Math.abs(filter.minorUnits) : filter.minorUnits;
    if (amountMinor !== expected) return false;
  }
  return true;
}

function extractKeyedFilters(input: string): {
  remaining: string;
  matches: readonly { key: string; value: string }[];
} {
  const keyedPattern =
    /(?:^|\s)(merchant|ref|reference|category|account|event|eventType|plan|document|doc|tax|taxPeriod|type):("[^"]+"|\S+)/gi;
  const ranges: ConsumedRange[] = [];
  const matches: { key: string; value: string }[] = [];

  for (const match of input.matchAll(keyedPattern)) {
    if (match.index === undefined || match[1] === undefined || match[2] === undefined) continue;
    const full = match[0];
    const leadingWhitespace = /^\s/.test(full) ? 1 : 0;
    ranges.push({ start: match.index + leadingWhitespace, end: match.index + full.length });
    matches.push({
      key: match[1].toLowerCase(),
      value: unquote(match[2]),
    });
  }

  return {
    remaining: removeRanges(input, ranges),
    matches,
  };
}

function consumeArchiveMode(input: string): { remaining: string; archive?: SearchArchiveMode } {
  const rules: readonly { pattern: RegExp; archive: SearchArchiveMode }[] = [
    { pattern: /\b(?:archived only|only archived)\b/i, archive: 'archived' },
    { pattern: /\b(?:include archived|show archived|with archived)\b/i, archive: 'all' },
    { pattern: /\b(?:active only|only active|hide archived)\b/i, archive: 'active' },
  ];

  for (const rule of rules) {
    const match = rule.pattern.exec(input);
    if (match?.index !== undefined) {
      return {
        remaining: removeRanges(input, [
          { start: match.index, end: match.index + match[0].length },
        ]),
        archive: rule.archive,
      };
    }
  }
  return { remaining: input };
}

function consumePrivacyMode(input: string): { remaining: string; privacy?: SearchPrivacyMode } {
  const rules: readonly { pattern: RegExp; privacy: SearchPrivacyMode }[] = [
    {
      pattern: /\b(?:all privacy|include all private|include sensitive and private)\b/i,
      privacy: 'all',
    },
    { pattern: /\b(?:include sensitive|show sensitive)\b/i, privacy: 'include_sensitive' },
    { pattern: /\b(?:include private|show private)\b/i, privacy: 'include_private' },
  ];

  for (const rule of rules) {
    const match = rule.pattern.exec(input);
    if (match?.index !== undefined) {
      return {
        remaining: removeRanges(input, [
          { start: match.index, end: match.index + match[0].length },
        ]),
        privacy: rule.privacy,
      };
    }
  }
  return { remaining: input };
}

function consumeRelativeDate(
  input: string,
  today: string | LocalDate | undefined,
): {
  remaining: string;
  pattern: string;
  date?: string;
  dateRange?: SearchDateRangeFilter;
  notes: readonly string[];
} {
  const relativePattern = /\b(today|yesterday|this month|last month|this year|last year)\b/i;
  const match = relativePattern.exec(input);
  if (match?.index === undefined || match[1] === undefined) {
    return { remaining: input, pattern: '', notes: [] };
  }

  if (today === undefined) {
    return {
      remaining: input,
      pattern: '',
      notes: ['relative_date_requires_today'],
    };
  }

  const anchor = parseDateParts(normaliseLocalDate(today));
  const phrase = match[1].toLowerCase();
  const consumed = [{ start: match.index, end: match.index + match[0].length }];
  switch (phrase) {
    case 'today':
      return {
        remaining: removeRanges(input, consumed),
        pattern: 'date:today',
        date: formatDateParts(anchor.year, anchor.month, anchor.day),
        notes: [],
      };
    case 'yesterday': {
      const date = addDays(formatDateParts(anchor.year, anchor.month, anchor.day), -1);
      return {
        remaining: removeRanges(input, consumed),
        pattern: 'date:yesterday',
        date,
        notes: [],
      };
    }
    case 'this month':
      return {
        remaining: removeRanges(input, consumed),
        pattern: 'date_range:this_month',
        dateRange: monthRange(anchor.year, anchor.month),
        notes: [],
      };
    case 'last month': {
      const month = anchor.month === 1 ? 12 : anchor.month - 1;
      const year = anchor.month === 1 ? anchor.year - 1 : anchor.year;
      return {
        remaining: removeRanges(input, consumed),
        pattern: 'date_range:last_month',
        dateRange: monthRange(year, month),
        notes: [],
      };
    }
    case 'this year':
      return {
        remaining: removeRanges(input, consumed),
        pattern: 'date_range:this_year',
        dateRange: { from: `${anchor.year}-01-01`, to: `${anchor.year}-12-31` },
        notes: [],
      };
    case 'last year':
      return {
        remaining: removeRanges(input, consumed),
        pattern: 'date_range:last_year',
        dateRange: { from: `${anchor.year - 1}-01-01`, to: `${anchor.year - 1}-12-31` },
        notes: [],
      };
  }

  return { remaining: input, pattern: '', notes: [] };
}

function consumeDateRange(input: string): {
  remaining: string;
  pattern: string;
  date?: string;
  dateRange?: SearchDateRangeFilter;
} {
  const rangePattern =
    /\b(?:from|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|and)\s+(\d{4}-\d{2}-\d{2})\b/i;
  const rangeMatch = rangePattern.exec(input);
  if (
    rangeMatch?.index !== undefined &&
    rangeMatch[1] !== undefined &&
    rangeMatch[2] !== undefined
  ) {
    return {
      remaining: removeRanges(input, [
        { start: rangeMatch.index, end: rangeMatch.index + rangeMatch[0].length },
      ]),
      pattern: 'date_range:absolute',
      dateRange: {
        from: normaliseLocalDate(rangeMatch[1]),
        to: normaliseLocalDate(rangeMatch[2]),
      },
    };
  }

  const afterPattern = /\b(?:after|since|from)\s+(\d{4}-\d{2}-\d{2})\b/i;
  const afterMatch = afterPattern.exec(input);
  if (afterMatch?.index !== undefined && afterMatch[1] !== undefined) {
    return {
      remaining: removeRanges(input, [
        { start: afterMatch.index, end: afterMatch.index + afterMatch[0].length },
      ]),
      pattern: 'date_range:from',
      dateRange: { from: normaliseLocalDate(afterMatch[1]) },
    };
  }

  const beforePattern = /\b(?:before|until|to)\s+(\d{4}-\d{2}-\d{2})\b/i;
  const beforeMatch = beforePattern.exec(input);
  if (beforeMatch?.index !== undefined && beforeMatch[1] !== undefined) {
    return {
      remaining: removeRanges(input, [
        { start: beforeMatch.index, end: beforeMatch.index + beforeMatch[0].length },
      ]),
      pattern: 'date_range:to',
      dateRange: { to: normaliseLocalDate(beforeMatch[1]) },
    };
  }

  const onPattern = /\bon\s+(\d{4}-\d{2}-\d{2})\b/i;
  const onMatch = onPattern.exec(input);
  if (onMatch?.index !== undefined && onMatch[1] !== undefined) {
    return {
      remaining: removeRanges(input, [
        { start: onMatch.index, end: onMatch.index + onMatch[0].length },
      ]),
      pattern: 'date:on',
      date: normaliseLocalDate(onMatch[1]),
    };
  }

  return { remaining: input, pattern: '' };
}

function consumeAmountFilter(
  input: string,
  defaultCurrency: string | CurrencyCode | undefined,
): { remaining: string; pattern: string; amount?: SearchAmountFilter } {
  const amountTextPattern =
    '((?:[A-Z]{3}\\s*)?-?\\d+(?:\\.\\d{1,2})?(?:\\s*[A-Z]{3})?|\\$\\s*-?\\d+(?:\\.\\d{1,2})?)';
  const betweenPattern = new RegExp(
    `\\bbetween\\s+${amountTextPattern}\\s+and\\s+${amountTextPattern}\\b`,
    'i',
  );
  const betweenMatch = betweenPattern.exec(input);
  if (
    betweenMatch?.index !== undefined &&
    betweenMatch[1] !== undefined &&
    betweenMatch[2] !== undefined
  ) {
    const min = parseAmountText(betweenMatch[1], defaultCurrency);
    const max = parseAmountText(betweenMatch[2], min.currency ?? defaultCurrency);
    return {
      remaining: removeRanges(input, [
        { start: betweenMatch.index, end: betweenMatch.index + betweenMatch[0].length },
      ]),
      pattern: 'amount:between',
      amount: compactAmountFilter({
        minMinorUnits: Math.min(Math.abs(min.minorUnits), Math.abs(max.minorUnits)),
        maxMinorUnits: Math.max(Math.abs(min.minorUnits), Math.abs(max.minorUnits)),
        currency: min.currency ?? max.currency,
        useAbsolute: true,
      }),
    };
  }

  const comparisonPattern = new RegExp(
    `\\b(over|more than|greater than|at least|under|less than|below|at most)\\s+${amountTextPattern}\\b`,
    'i',
  );
  const comparisonMatch = comparisonPattern.exec(input);
  if (
    comparisonMatch?.index !== undefined &&
    comparisonMatch[1] !== undefined &&
    comparisonMatch[2] !== undefined
  ) {
    const amount = parseAmountText(comparisonMatch[2], defaultCurrency);
    const comparison = comparisonMatch[1].toLowerCase();
    const filter =
      comparison === 'under' ||
      comparison === 'less than' ||
      comparison === 'below' ||
      comparison === 'at most'
        ? compactAmountFilter({
            maxMinorUnits: Math.abs(amount.minorUnits),
            currency: amount.currency,
            useAbsolute: true,
          })
        : compactAmountFilter({
            minMinorUnits: Math.abs(amount.minorUnits),
            currency: amount.currency,
            useAbsolute: true,
          });
    return {
      remaining: removeRanges(input, [
        { start: comparisonMatch.index, end: comparisonMatch.index + comparisonMatch[0].length },
      ]),
      pattern: 'amount:comparison',
      amount: filter,
    };
  }

  const exactPattern = new RegExp(`\\b(?:amount|for)\\s*(?:is|=)?\\s*${amountTextPattern}\\b`, 'i');
  const exactMatch = exactPattern.exec(input);
  if (exactMatch?.index !== undefined && exactMatch[1] !== undefined) {
    const amount = parseAmountText(exactMatch[1], defaultCurrency);
    return {
      remaining: removeRanges(input, [
        { start: exactMatch.index, end: exactMatch.index + exactMatch[0].length },
      ]),
      pattern: 'amount:exact',
      amount: compactAmountFilter({
        minorUnits: amount.minorUnits,
        currency: amount.currency,
        useAbsolute: false,
      }),
    };
  }

  return { remaining: input, pattern: '' };
}

function compactFilters(input: {
  merchant?: string;
  reference?: string;
  date?: string;
  dateRange?: SearchDateRangeFilter;
  amount?: SearchAmountFilter;
  categoryIds?: readonly string[];
  accountIds?: readonly string[];
  entityTypes?: readonly SearchEntityType[];
  eventTypes?: readonly string[];
  planIds?: readonly string[];
  documentIds?: readonly string[];
  businessTaxPeriods?: readonly string[];
}): SearchTypedFilters | undefined {
  const filters: {
    merchant?: string;
    reference?: string;
    date?: string;
    dateRange?: SearchDateRangeFilter;
    amount?: SearchAmountFilter;
    categoryIds?: readonly string[];
    accountIds?: readonly string[];
    entityTypes?: readonly SearchEntityType[];
    eventTypes?: readonly string[];
    planIds?: readonly string[];
    documentIds?: readonly string[];
    businessTaxPeriods?: readonly string[];
  } = {};

  if (input.merchant !== undefined) filters.merchant = input.merchant;
  if (input.reference !== undefined) filters.reference = input.reference;
  if (input.date !== undefined) filters.date = input.date;
  if (input.dateRange !== undefined) filters.dateRange = input.dateRange;
  if (input.amount !== undefined) filters.amount = input.amount;
  if (input.categoryIds !== undefined && input.categoryIds.length > 0) {
    filters.categoryIds = uniqueSorted(input.categoryIds);
  }
  if (input.accountIds !== undefined && input.accountIds.length > 0) {
    filters.accountIds = uniqueSorted(input.accountIds);
  }
  if (input.entityTypes !== undefined && input.entityTypes.length > 0) {
    filters.entityTypes = uniqueSorted(input.entityTypes);
  }
  if (input.eventTypes !== undefined && input.eventTypes.length > 0) {
    filters.eventTypes = uniqueSorted(input.eventTypes);
  }
  if (input.planIds !== undefined && input.planIds.length > 0) {
    filters.planIds = uniqueSorted(input.planIds);
  }
  if (input.documentIds !== undefined && input.documentIds.length > 0) {
    filters.documentIds = uniqueSorted(input.documentIds);
  }
  if (input.businessTaxPeriods !== undefined && input.businessTaxPeriods.length > 0) {
    filters.businessTaxPeriods = uniqueSorted(input.businessTaxPeriods);
  }

  return Object.keys(filters).length === 0 ? undefined : filters;
}

function compactAmountFilter(input: {
  minorUnits?: number | undefined;
  minMinorUnits?: number | undefined;
  maxMinorUnits?: number | undefined;
  currency?: string | CurrencyCode | undefined;
  useAbsolute?: boolean | undefined;
}): SearchAmountFilter {
  const filter: {
    minorUnits?: number;
    minMinorUnits?: number;
    maxMinorUnits?: number;
    currency?: string;
    useAbsolute?: boolean;
  } = {};
  if (input.minorUnits !== undefined) filter.minorUnits = input.minorUnits;
  if (input.minMinorUnits !== undefined) filter.minMinorUnits = input.minMinorUnits;
  if (input.maxMinorUnits !== undefined) filter.maxMinorUnits = input.maxMinorUnits;
  if (input.currency !== undefined) filter.currency = normaliseCurrency(input.currency);
  if (input.useAbsolute !== undefined) filter.useAbsolute = input.useAbsolute;
  return filter;
}

function parseAmountText(
  input: string,
  defaultCurrency: string | CurrencyCode | undefined,
): ParsedAmount {
  const compact = input.trim().toUpperCase().replace(/\s+/g, '');
  const dollarMatch = /^\$(-?\d+(?:\.\d{1,2})?)$/.exec(compact);
  const leadingCodeMatch = /^([A-Z]{3})(-?\d+(?:\.\d{1,2})?)$/.exec(compact);
  const trailingCodeMatch = /^(-?\d+(?:\.\d{1,2})?)([A-Z]{3})$/.exec(compact);
  const numericText =
    dollarMatch?.[1] ?? leadingCodeMatch?.[2] ?? trailingCodeMatch?.[1] ?? compact;
  const value = Number(numericText);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid search amount: ${input}`);
  }
  const amount: { minorUnits: number; currency?: string } = {
    minorUnits: Math.round(value * 100),
  };
  const currency =
    dollarMatch === null
      ? (leadingCodeMatch?.[1] ?? trailingCodeMatch?.[2] ?? defaultCurrency)
      : 'USD';
  if (currency !== undefined) {
    amount.currency = normaliseCurrency(currency);
  }
  return amount;
}

function removeRanges(input: string, ranges: readonly ConsumedRange[]): string {
  if (ranges.length === 0) return input;
  const sorted = ranges.slice().sort((left, right) => right.start - left.start);
  let output = input;
  for (const range of sorted) {
    output = `${output.slice(0, range.start)} ${output.slice(range.end)}`;
  }
  return collapseWhitespace(output);
}

function normaliseFilterValues(values: readonly (string | undefined)[]): readonly string[] {
  return uniqueSorted(values.filter(isNonEmpty).map(normaliseId));
}

function containsNormalised(value: string | undefined, expected: string): boolean {
  if (value === undefined) return false;
  return normaliseForSearch(value).includes(normaliseForSearch(expected));
}

function hasAnyNormalised(values: readonly string[], expected: readonly string[]): boolean {
  const normalisedValues = new Set(values.map(normaliseId));
  return expected.some((value) => normalisedValues.has(value));
}

function valueInNormalisedSet(value: string | undefined, expected: readonly string[]): boolean {
  if (value === undefined) return false;
  return expected.includes(normaliseId(value));
}

function scoreForField(field: string): number {
  switch (field) {
    case 'title':
      return 4;
    case 'merchant':
    case 'reference':
      return 3;
    case 'excerpt':
      return 2;
    case 'keywords':
    case 'facets':
      return 1;
    default:
      return 0;
  }
}

function normaliseCurrency(input: string | CurrencyCode): string {
  const currency = String(input).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Invalid search currency: ${input}`);
  }
  return currency;
}

function normaliseLocalDate(input: string | LocalDate): string {
  const value = String(input).trim();
  const parts = parseDateParts(value);
  return formatDateParts(parts.year, parts.month, parts.day);
}

function parseDateParts(input: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    throw new Error(`Invalid search date: ${input}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const days = daysInMonth(year, month);
  if (month < 1 || month > 12 || day < 1 || day > days) {
    throw new Error(`Invalid search date: ${input}`);
  }
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthRange(year: number, month: number): SearchDateRangeFilter {
  return {
    from: formatDateParts(year, month, 1),
    to: formatDateParts(year, month, daysInMonth(year, month)),
  };
}

function addDays(date: string, days: number): string {
  const parts = parseDateParts(date);
  const timestamp = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  return new Date(timestamp).toISOString().slice(0, 10);
}

function isSearchPrivacyLevel(value: string): value is SearchPrivacyLevel {
  return value === 'standard' || value === 'private' || value === 'sensitive';
}

function isSearchIndexRecord(
  value: SearchIndexInput | SearchIndexRecord,
): value is SearchIndexRecord {
  return 'sourceFingerprint' in value && 'key' in value && 'tokens' in value;
}

function pushUnique<T extends string>(values: readonly T[] | undefined, value: T): T[] {
  return uniqueSorted([...(values ?? []), value]) as T[];
}

function normaliseForSearch(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normaliseId(input: string): string {
  return collapseWhitespace(input).toLowerCase();
}

function collapseWhitespace(input: string): string {
  return String(input).trim().replace(/\s+/g, ' ');
}

function unquote(input: string): string {
  const trimmed = collapseWhitespace(input);
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && collapseWhitespace(value).length > 0;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(
    new Set(values.filter(isNonEmpty).map((value) => collapseWhitespace(value) as T)),
  ).sort((left, right) => left.localeCompare(right));
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }
}

function normaliseLimit(limit: number | undefined): number {
  if (limit === undefined) return 25;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Search query limit must be a positive integer.');
  }
  return Math.min(limit, 100);
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function compareOptionalString(
  left: string | undefined,
  right: string | undefined,
  direction: 'asc' | 'desc',
): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
}

function compareOptionalNumber(
  left: number | undefined,
  right: number | undefined,
  direction: 'asc' | 'desc',
): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return direction === 'asc' ? left - right : right - left;
}

function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

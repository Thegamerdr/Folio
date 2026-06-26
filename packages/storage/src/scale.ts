export type ScaleBenchmarkInput = Readonly<{
  workspaceCount: number;
  accountCount: number;
  transactionCount: number;
  eventCount: number;
  documentCount: number;
  searchIndexEntryCount: number;
  backgroundJobCount: number;
  forecastDayCount: number;
}>;

export type ScaleRisk = 'green' | 'watch' | 'over_budget';

export type ScaleBenchmarkEstimate = Readonly<{
  estimatedRows: number;
  estimatedBytes: number;
  estimatedTodayQueryMs: number;
  estimatedSearchQueryMs: number;
  risk: ScaleRisk;
  notes: readonly string[];
}>;

const BYTES_PER_ROW = {
  workspace: 512,
  account: 768,
  transaction: 1_600,
  event: 1_000,
  document: 900,
  searchIndexEntry: 1_800,
  backgroundJob: 700,
  forecastDay: 650,
} as const;

export function estimateScaleBenchmark(input: ScaleBenchmarkInput): ScaleBenchmarkEstimate {
  assertScaleInput(input);

  const estimatedRows =
    input.workspaceCount +
    input.accountCount +
    input.transactionCount +
    input.eventCount +
    input.documentCount +
    input.searchIndexEntryCount +
    input.backgroundJobCount +
    input.forecastDayCount;

  const estimatedBytes =
    input.workspaceCount * BYTES_PER_ROW.workspace +
    input.accountCount * BYTES_PER_ROW.account +
    input.transactionCount * BYTES_PER_ROW.transaction +
    input.eventCount * BYTES_PER_ROW.event +
    input.documentCount * BYTES_PER_ROW.document +
    input.searchIndexEntryCount * BYTES_PER_ROW.searchIndexEntry +
    input.backgroundJobCount * BYTES_PER_ROW.backgroundJob +
    input.forecastDayCount * BYTES_PER_ROW.forecastDay;

  const estimatedTodayQueryMs = Math.ceil(
    12 + Math.log10(Math.max(10, input.transactionCount + input.eventCount)) * 18,
  );
  const estimatedSearchQueryMs = Math.ceil(
    20 + Math.log10(Math.max(10, input.searchIndexEntryCount)) * 35,
  );
  const notes: string[] = [];

  if (input.transactionCount >= 250_000) {
    notes.push(
      '250k-row transaction endurance target reached; use pagination and covering indexes.',
    );
  }
  if (input.searchIndexEntryCount >= 100_000) {
    notes.push('Large FTS index; schedule rebuilds as resumable jobs.');
  }
  if (estimatedBytes >= 512 * 1024 * 1024) {
    notes.push(
      'Vault estimate exceeds 512 MiB; backup/export flows need progress and space checks.',
    );
  }

  const risk: ScaleRisk =
    estimatedTodayQueryMs > 300 ||
    estimatedSearchQueryMs > 300 ||
    estimatedBytes >= 1024 * 1024 * 1024
      ? 'over_budget'
      : notes.length > 0
        ? 'watch'
        : 'green';

  return {
    estimatedRows,
    estimatedBytes,
    estimatedTodayQueryMs,
    estimatedSearchQueryMs,
    risk,
    notes,
  };
}

function assertScaleInput(input: ScaleBenchmarkInput): void {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Scale benchmark ${key} must be a non-negative safe integer.`);
    }
  }
}

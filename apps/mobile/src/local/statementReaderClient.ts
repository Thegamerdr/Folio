/**
 * Compatibility boundary for the retired cloud statement reader.
 *
 * PDFs and images are handled by the native on-device extraction path. These exports remain so an
 * older call site fails closed instead of uploading a document. Neither function reads the file,
 * constructs Base64, resolves a gateway, or calls `fetch`.
 */
import type { CandidateMoneyItem } from '@/folio/lib/importSheet';

import type { StatementClosingBalance } from './statementReaderParse';

export { parseCandidatesFromModelJson, type StatementClosingBalance } from './statementReaderParse';

export type StatementReaderKind = 'pdf' | 'image';

export type StatementReaderInput = Readonly<{
  uri: string;
  mediaType: string;
  kind: StatementReaderKind;
  signal?: AbortSignal;
}>;

export type StatementReadResult =
  | Readonly<{
      kind: 'ok';
      candidates: CandidateMoneyItem[];
      closingBalance: StatementClosingBalance | null;
    }>
  | Readonly<{ kind: 'no-provider' }>
  | Readonly<{ kind: 'error'; message: string }>;

export type StatementReaderChunkProgress = Readonly<{
  chunkIndex: number;
  chunkCount: number;
  startPage: number;
  endPage: number;
  totalPages: number;
  ok: boolean;
}>;

export type StatementReaderChunkOutcome = Readonly<{
  startPage: number;
  endPage: number;
  ok: boolean;
  errorMessage?: string;
}>;

export type StatementReadChunkedResult =
  | Readonly<{
      kind: 'ok' | 'partial';
      candidates: CandidateMoneyItem[];
      coverage: StatementReaderChunkOutcome[];
      closingBalance: StatementClosingBalance | null;
    }>
  | Readonly<{ kind: 'no-provider' }>
  | Readonly<{ kind: 'error'; message: string }>;

export type StatementReaderChunkedInput = Readonly<{
  uri: string;
  mediaType: string;
  kind: 'pdf';
  signal?: AbortSignal;
  onProgress?: (progress: StatementReaderChunkProgress) => void;
}>;

/** Retained for source compatibility only; cloud size routing is no longer active. */
export const MAX_STATEMENT_BYTES = 500 * 1024;
/** Retained for source compatibility only; cloud size routing is no longer active. */
export const MAX_CHUNKED_STATEMENT_BYTES = 5 * 1024 * 1024;

export async function extractStatementCandidates(
  _input: StatementReaderInput,
): Promise<StatementReadResult> {
  return { kind: 'no-provider' };
}

export async function extractStatementCandidatesChunked(
  _input: StatementReaderChunkedInput,
): Promise<StatementReadChunkedResult> {
  return { kind: 'no-provider' };
}

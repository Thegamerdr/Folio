import { beforeEach, describe, expect, it } from 'vitest';

import {
  consumeReaderFallbackEvidenceId,
  consumeReaderFallbackReason,
  setReaderFallbackEvidenceId,
  setReaderFallbackReason,
} from './readerFallbackReason';

describe('reader fallback handoff', () => {
  beforeEach(() => {
    setReaderFallbackReason(undefined);
    setReaderFallbackEvidenceId(undefined);
  });

  it('hands the reason and encrypted source identity to the next fallback exactly once', () => {
    setReaderFallbackReason('No reliable rows.');
    setReaderFallbackEvidenceId('evidence_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    expect(consumeReaderFallbackReason()).toBe('No reliable rows.');
    expect(consumeReaderFallbackEvidenceId()).toBe('evidence_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(consumeReaderFallbackReason()).toBeUndefined();
    expect(consumeReaderFallbackEvidenceId()).toBeUndefined();
  });
});

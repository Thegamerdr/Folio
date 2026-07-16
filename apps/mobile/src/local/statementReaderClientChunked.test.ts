import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  extractStatementCandidates,
  extractStatementCandidatesChunked,
} from './statementReaderClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('statement reader privacy boundary', () => {
  it('fails closed for a PDF without reading or transmitting it', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      extractStatementCandidates({
        uri: 'file:///private/statement.pdf',
        mediaType: 'application/pdf',
        kind: 'pdf',
      }),
    ).resolves.toEqual({ kind: 'no-provider' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed for an image without reading or transmitting it', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      extractStatementCandidates({
        uri: 'file:///private/statement.jpg',
        mediaType: 'image/jpeg',
        kind: 'image',
      }),
    ).resolves.toEqual({ kind: 'no-provider' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed on the legacy chunked path and emits no progress suggesting a read occurred', async () => {
    const fetchSpy = vi.fn();
    const onProgress = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      extractStatementCandidatesChunked({
        uri: 'file:///private/long-statement.pdf',
        mediaType: 'application/pdf',
        kind: 'pdf',
        onProgress,
      }),
    ).resolves.toEqual({ kind: 'no-provider' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import appleFetch from './apple-fetch';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Apple SDK Worker transport', () => {
  it('aborts an incomplete response body at the deadline', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      signal = init?.signal ?? undefined;
      return new Response(
        new ReadableStream({
          start(controller) {
            signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
          },
        }),
      );
    });
    const pending = expect(
      appleFetch('https://api.storekit.itunes.apple.com/test'),
    ).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(12_000);
    await pending;
    expect(signal?.aborted).toBe(true);
  });

  it('supports OCSP buffer reads and rejects oversized bodies', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    expect(await (await appleFetch('https://ocsp.apple.com/test')).buffer()).toEqual(
      Buffer.from([1, 2, 3]),
    );
    request.mockResolvedValueOnce(new Response(new Uint8Array(2 * 1024 * 1024 + 1)));
    await expect(appleFetch('https://ocsp.apple.com/test')).rejects.toThrow('size limit');
  });
});

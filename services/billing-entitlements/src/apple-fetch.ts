// Narrow node-fetch compatibility adapter for Apple's server library.
// The SDK imports node-fetch internally, while Workers provides native fetch. Keeping
// the adapter local lets every SDK API and OCSP request share an abortable deadline.
const FETCH_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class Headers extends globalThis.Headers {}

export default async function fetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response & { buffer(): Promise<Buffer> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const callerSignal = init.signal;
  const abortCaller = () => controller.abort();
  callerSignal?.addEventListener('abort', abortCaller, { once: true });
  if (callerSignal?.aborted) controller.abort();
  try {
    const response = await globalThis.fetch(input, {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error('Apple transport refused an unexpected redirect.');
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (reader !== undefined) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > MAX_RESPONSE_BYTES) {
            controller.abort();
            await reader.cancel();
            throw new Error('Apple response exceeded its size limit.');
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    const body = Buffer.concat(chunks, size);
    const wrapped = new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & { buffer(): Promise<Buffer> };
    wrapped.buffer = async () => body;
    return wrapped;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortCaller);
  }
}

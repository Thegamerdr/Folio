// Anonymous install id — the `x-folio-device` header the AI gateway meters on.
//
// WHAT IT IS. A random UUID minted once per install and persisted in its own tiny file (the
// entitlements.ts single-file pattern). It identifies an INSTALL to the gateway's abuse metering
// (services/ai-gateway — per-device monthly read backstop), nothing else.
//
// WHAT IT IS NOT. Not an account, not tracking, not fingerprinting: it is random (derived from
// nothing about the user or device), never leaves the device except in gateway calls the user
// initiates, and dies with an uninstall/data-wipe. No financial data rides on it.
//
// NEVER THROWS. Any read/write trouble degrades to `null` — callers simply omit the header and
// the gateway falls back to its coarser IP-keyed backstop.

import * as FileSystem from 'expo-file-system/legacy';

const DEVICE_ID_FILENAME = 'folio.device.v1.json';

let cached: string | null | undefined;

/** The install's anonymous id, minting + persisting one on first call. `null` when the id can
 *  neither be read nor written (callers omit the gateway header). Memoized per JS session. */
export async function getDeviceId(): Promise<string | null> {
  if (cached !== undefined) return cached;
  let uri: string;
  // Even READING `documentDirectory` can throw under the Node test runner (a vi.mock factory
  // that omits the export throws on access through the module-namespace proxy) — so the very
  // first touch of the module sits inside a try. This function must NEVER throw: a caller's
  // whole read would otherwise fail over a metering header that is optional by design.
  try {
    const dir = FileSystem.documentDirectory;
    // Strict type check (not just null): a mocked module may carry `undefined` here — this
    // module must then stay fully inert (no reads, no writes), never consuming a test's queued
    // FileSystem mocks with its own calls.
    if (typeof dir !== 'string' || dir.length === 0) {
      cached = null;
      return cached;
    }
    uri = `${dir}${DEVICE_ID_FILENAME}`;
  } catch {
    cached = null;
    return cached;
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(raw) as { id?: unknown };
      if (typeof parsed.id === 'string' && parsed.id.length > 0 && parsed.id.length <= 64) {
        cached = parsed.id;
        return cached;
      }
    }
  } catch {
    // Unreadable/corrupt — fall through and mint a fresh id (worst case the metering backstop
    // sees this install as new; the product allowance lives in the app store, unaffected).
  }
  try {
    const id = randomId();
    await FileSystem.writeAsStringAsync(uri, JSON.stringify({ id }), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    cached = id;
  } catch {
    cached = null;
  }
  return cached;
}

/** UUID-shaped random id from Math.random. Deliberately NOT cryptographic — this is an anonymous
 *  metering key, not a credential (worst case a collision shares a rate-limit bucket). Avoids an
 *  expo-crypto import, which ships Flow syntax the Node test runner can't parse and would poison
 *  every module graph that reaches this file. */
function randomId(): string {
  const hex = (length: number): string =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
}

/** Test seam — clears the session memo so a test can exercise the read/mint paths. */
export function resetDeviceIdCacheForTests(): void {
  cached = undefined;
}

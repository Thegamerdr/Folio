import { describe, expect, it } from 'vitest';

import {
  archiveAbiInventory,
  assertSafeGeneratedDirectory,
  fatalAndroidMarkers,
  normalizeFingerprint,
  parseAdbDevices,
  parseApkSignerFingerprint,
  parseKeytoolFingerprint,
} from './android-release-lane.mjs';

describe('Android release lane helpers', () => {
  it('normalises and parses both Android signing-tool fingerprint formats', () => {
    const expected = '547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488';
    expect(
      normalizeFingerprint(
        '54:73:96:e1:fd:99:68:1c:2a:6d:76:8b:8b:7d:1b:44:84:b5:f4:2a:17:59:7c:ad:6c:49:52:21:26:7a:54:88',
      ),
    ).toBe(expected);
    expect(
      parseApkSignerFingerprint(
        'Signer #1 certificate SHA-256 digest: 547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488',
      ),
    ).toBe(expected);
    expect(
      parseKeytoolFingerprint(
        'SHA256: 54:73:96:E1:FD:99:68:1C:2A:6D:76:8B:8B:7D:1B:44:84:B5:F4:2A:17:59:7C:AD:6C:49:52:21:26:7A:54:88',
      ),
    ).toBe(expected);
  });

  it('selects only concrete adb device rows', () => {
    expect(
      parseAdbDevices(
        'List of devices attached\nemulator-5554 device product:sdk model:Pixel transport_id:4\nphysical offline transport_id:8\n\n',
      ),
    ).toEqual([
      {
        serial: 'emulator-5554',
        state: 'device',
        details: 'product:sdk model:Pixel transport_id:4',
      },
      { serial: 'physical', state: 'offline', details: 'transport_id:8' },
    ]);
  });

  it('reads React Native ABIs without confusing unrelated native libraries', () => {
    expect(
      archiveAbiInventory(
        [
          'lib/x86_64/libreactnative.so',
          'lib/x86_64/libsqlite.so',
          'base/lib/arm64-v8a/libreactnative.so',
          'assets/index.android.bundle',
        ].join('\n'),
      ),
    ).toEqual(['arm64-v8a', 'x86_64']);
  });

  it('flags launch-fatal markers while leaving normal lifecycle logs alone', () => {
    expect(
      fatalAndroidMarkers('ReactNativeJS: Running Melo\nActivityTaskManager: Displayed'),
    ).toEqual([]);
    expect(
      fatalAndroidMarkers(
        'AndroidRuntime: FATAL EXCEPTION: mqt_native_modules\nUnsatisfiedLinkError: libreactnative.so',
      ),
    ).toHaveLength(2);
  });

  it('allows cleanup only for descendants of the Android project root', () => {
    const root = 'C:\\dev\\melo\\apps\\mobile\\android';
    expect(assertSafeGeneratedDirectory(root, `${root}\\app\\build`)).toBe(`${root}\\app\\build`);
    expect(() => assertSafeGeneratedDirectory(root, root)).toThrow(/Refusing to remove/u);
    expect(() => assertSafeGeneratedDirectory(root, 'C:\\dev\\melo\\apps\\mobile')).toThrow(
      /Refusing to remove/u,
    );
  });
});

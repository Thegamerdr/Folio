import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { AppState } from '@/folio/store';

import { buildSupportDiagnosticBundle, type SupportDiagnosticBundle } from './supportDiagnostic';

export type { SupportDiagnosticBundle } from './supportDiagnostic';

export function prepareSupportDiagnosticBundle(
  state: AppState,
  options: Readonly<{ appLockEnabled: boolean; currentScreen: string }>,
): SupportDiagnosticBundle {
  return buildSupportDiagnosticBundle(state, {
    appLockEnabled: options.appLockEnabled,
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? 'unknown',
    buildVersion: Constants.nativeBuildVersion ?? 'unknown',
    currentScreen: options.currentScreen,
    executionEnvironment: Constants.executionEnvironment ?? 'unknown',
    isDevice: Constants.isDevice,
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
  });
}

/** Write only the already-previewed payload, share it, then remove the plaintext cache copy. */
export async function shareSupportDiagnosticBundle(bundle: SupportDiagnosticBundle): Promise<void> {
  if (!bundle.safeForExport) {
    throw new Error('Melo stopped this report because its privacy check did not pass.');
  }
  const root = FileSystem.cacheDirectory;
  if (root === null) throw new Error('Support-report storage is unavailable on this device.');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is unavailable on this device. No support report was kept.');
  }

  const directory = `${root}melo-support-${Date.now()}/`;
  const uri = `${directory}melo-support-report.json`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  try {
    await FileSystem.writeAsStringAsync(uri, bundle.jsonText, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(uri, {
      dialogTitle: 'Share Melo support report',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  } finally {
    await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined);
  }
}

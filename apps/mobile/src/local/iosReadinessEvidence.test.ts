import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const checklistPath = fileURLToPath(
  new URL(
    '../../evidence/recovery-replay-melo-ios-readiness-2026-06-23/ios-readiness/IOS_EVIDENCE_CHECKLIST_2026-06-23.md',
    import.meta.url,
  ).href,
);
const checklistSource = readFileSync(checklistPath, 'utf8');
const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const appConfigPath = fileURLToPath(new URL('../../app.config.ts', import.meta.url).href);
const appConfigSource = readFileSync(appConfigPath, 'utf8');
const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url).href);
const packageSource = readFileSync(packagePath, 'utf8');
const documentImportPath = fileURLToPath(
  new URL('./nativeDocumentImport.ts', import.meta.url).href,
);
const documentImportSource = readFileSync(documentImportPath, 'utf8');
const dataExportPath = fileURLToPath(new URL('./nativeDataExport.ts', import.meta.url).href);
const dataExportSource = readFileSync(dataExportPath, 'utf8');
const mobileShellPath = fileURLToPath(new URL('../surfaces/mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');

describe('iOS readiness evidence boundary', () => {
  it('keeps the iOS checklist explicit that runtime proof was not collected on Windows', () => {
    const requiredChecklistItems = [
      'iOS runtime evidence not collected on this host',
      'Windows',
      'requires macOS with Xcode',
      'Safe area rendering on iPhone with notch / Dynamic Island',
      'Bottom inset and bottom navigation comfort on iPhone',
      'Large text / Dynamic Type layout',
      'VoiceOver traversal order and labels',
      'Document picker return path',
      'Export behavior and share-sheet / Files discoverability',
      'Local persistence after force quit and app restart',
      'Clear local records behavior after restart',
      'Reduced motion behavior in modals',
      'iOS behavior is not proven',
    ];

    for (const item of requiredChecklistItems) {
      expect(checklistSource).toContain(item);
    }
  });

  it('backs static iOS readiness notes with current source hooks', () => {
    expect(appConfigSource).toContain("platforms: ['ios', 'android']");
    expect(appConfigSource).toContain("bundleIdentifier: 'com.folio.v2.greenfield'");
    expect(appRouteSource).toContain("from 'react-native-safe-area-context'");
    expect(appRouteSource).toContain('<SafeAreaView style={styles.safeArea}>');
    expect(appRouteSource).toContain('contentInsetAdjustmentBehavior="automatic"');
    expect(appRouteSource).toContain('keyboardShouldPersistTaps="handled"');
    expect(packageSource).toContain('"native:smoke:ios": "expo run:ios"');
    expect(packageSource).toContain('"expo-document-picker"');
    expect(documentImportSource).toContain('DocumentPicker.getDocumentAsync');
    expect(dataExportSource).toContain('FileSystem.documentDirectory');
    expect(mobileShellSource).toContain('AccessibilityInfo.isReduceMotionEnabled()');
    expect(mobileShellSource).toContain("animationType={reduceMotionEnabled ? 'none' : 'slide'}");
  });
});

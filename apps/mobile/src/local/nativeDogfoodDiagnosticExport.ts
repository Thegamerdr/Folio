import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  buildRedactedDogfoodDiagnosticBundle,
  type DogfoodDiagnosticBundle,
  type DogfoodDiagnosticInput,
} from './dogfoodMode';

export type DogfoodDiagnosticExportResult = Readonly<{
  bundle: DogfoodDiagnosticBundle;
  jsonByteSize: number;
  jsonFilename: string;
  jsonUri: string;
  markdownByteSize: number;
  markdownFilename: string;
  markdownUri: string;
}>;

export async function writeDogfoodDiagnosticBundle(
  input: Omit<DogfoodDiagnosticInput, 'appVersion' | 'buildVersion' | 'runtime'>,
): Promise<DogfoodDiagnosticExportResult> {
  if (FileSystem.documentDirectory === null) {
    throw new Error('Local diagnostic storage is unavailable on this device.');
  }

  const bundle = buildRedactedDogfoodDiagnosticBundle({
    ...input,
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? 'unknown',
    buildVersion: Constants.nativeBuildVersion ?? 'unknown',
    runtime: {
      appOwnership: Constants.appOwnership ?? 'unknown',
      executionEnvironment: Constants.executionEnvironment ?? 'unknown',
      isDevice: Constants.isDevice,
      os: Platform.OS,
      osVersion: String(Platform.Version),
    },
  });
  const stem = `folio-dogfood-diagnostic-${input.state.asOfDate}`;
  const jsonFilename = `${stem}.json`;
  const markdownFilename = `${stem}.md`;
  const jsonText = JSON.stringify(bundle.redacted, null, 2);
  const jsonUri = `${FileSystem.documentDirectory}${jsonFilename}`;
  const markdownUri = `${FileSystem.documentDirectory}${markdownFilename}`;

  await FileSystem.writeAsStringAsync(jsonUri, jsonText, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.writeAsStringAsync(markdownUri, bundle.markdown, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    bundle,
    jsonByteSize: jsonText.length,
    jsonFilename,
    jsonUri,
    markdownByteSize: bundle.markdown.length,
    markdownFilename,
    markdownUri,
  };
}

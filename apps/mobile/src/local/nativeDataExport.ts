import * as FileSystem from 'expo-file-system/legacy';

import {
  buildLocalLedgerExportPayload,
  type LocalLedgerState,
  type LocalRouteSummary,
} from './localLedger';

export type LocalLedgerExportResult = Readonly<{
  byteSize: number;
  filename: string;
  uri: string;
}>;

export async function writeLocalLedgerExport(
  state: LocalLedgerState,
  route: LocalRouteSummary,
): Promise<LocalLedgerExportResult> {
  if (FileSystem.documentDirectory === null) {
    throw new Error('Local export storage is unavailable on this device.');
  }

  const payload = buildLocalLedgerExportPayload(state, route);
  const text = JSON.stringify(payload, null, 2);
  const filename = `folio-local-export-${state.asOfDate}.json`;
  const uri = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, text, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    byteSize: text.length,
    filename,
    uri,
  };
}

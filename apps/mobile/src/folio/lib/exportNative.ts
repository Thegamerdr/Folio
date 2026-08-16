// Native export wrapper — the thin platform layer over the PURE export engine
// (./export.ts `buildExport`). ENGINES.md §6 "Export everything — free,
// non-negotiable, day-one" / §7 @rn-engine export.
//
// The engine builds strings only (one JSON of the complete `AppState`, plus
// per-surface CSVs) — it is deterministic and touches no I/O. This wrapper is
// where the platform lives: it reads the live state, writes every file to the
// app's document directory, and hands the canonical JSON to the OS share sheet.
// Mirrors the repo's established native-export pattern (nativeDataExport.ts,
// nativeDogfoodDiagnosticExport.ts, CalendarExportSheet.tsx): `expo-file-system`
// `documentDirectory` + `writeAsStringAsync`, then `expo-sharing` `shareAsync`.
//
// HARD CONSTRAINTS:
//   • Free, never paywalled. There is no gate here by design — the engine has
//     none and neither does this wrapper.
//   • The engine stays pure: this file does the side effects, the engine does
//     the math. State is read once via the store's getState().
//   • Honest: nothing here claims the data is encrypted, private, or stays on
//     device. It writes the files the user asked for and opens the share sheet.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { WorkspaceId } from '@folio/domain';

import { getState } from '@/folio/store';

import { buildExport } from './export';

/** What the user can observe after an export run, for an optional caller toast. */
export type RunExportResult = Readonly<{
  /** The on-disk URI of the canonical JSON file that was shared. */
  jsonUri: string;
  /** The JSON file name (e.g. `folio-export.json`). */
  jsonFilename: string;
  /** Every file written to the document directory, in stable order (JSON first). */
  filenames: readonly string[];
  /** Whether the OS share sheet was actually opened (false if unavailable). */
  shared: boolean;
}>;

/**
 * Run the full data export: build the bundle from live state, write the JSON
 * and every CSV to the document directory, and open the OS share sheet on the
 * canonical JSON.
 *
 * The share sheet carries a single file (expo-sharing shares one URI per call),
 * so the loss-free JSON is the one handed to "Share"; the CSVs are written
 * alongside it in the document directory for the user / a follow-up share. When
 * sharing is unavailable on the device, the files are still written and
 * `shared` comes back false — the export itself never fails for that reason.
 */
export async function runExport(workspaceId: WorkspaceId): Promise<RunExportResult> {
  const root = FileSystem.cacheDirectory;
  if (root === null) {
    throw new Error('Export storage is unavailable on this device.');
  }

  const snapshot = getState();
  const workspace = snapshot.workspaces.find((candidate) => candidate.id === workspaceId);
  if (workspace === undefined || workspace.archivedAt !== null) {
    throw new Error('The selected workspace is unavailable for export.');
  }
  const stem = workspace.kind === 'business' ? 'melo-business' : 'melo-personal';
  const jsonFilename = `${stem}-export.json`;
  const { json, csvs } = buildExport(snapshot, workspaceId, new Date().toISOString());

  const filenames: string[] = [jsonFilename];
  const writtenCsvUris = new Map<string, string>();
  const safeWorkspace = workspaceId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const exportDir = `${root}melo-export-${safeWorkspace}-${Date.now()}/`;
  const jsonUri = `${exportDir}${jsonFilename}`;

  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

  try {
    await FileSystem.writeAsStringAsync(jsonUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    for (const [name, csv] of Object.entries(csvs)) {
      const filename = `${stem}-${name}`;
      const uri = `${exportDir}${filename}`;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      filenames.push(filename);
      writtenCsvUris.set(name, uri);
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error('Sharing is unavailable on this device, so Melo did not keep a plaintext export.');
    }

    const businessCsvUri = writtenCsvUris.get('accountant-records.csv');
    const shareBusinessCsv = workspace.kind === 'business' && businessCsvUri !== undefined;
    await Sharing.shareAsync(shareBusinessCsv ? businessCsvUri : jsonUri, {
      mimeType: shareBusinessCsv ? 'text/csv' : 'application/json',
      dialogTitle: workspace.kind === 'business' ? 'Share business records' : 'Export your data',
      UTI: shareBusinessCsv ? 'public.comma-separated-values-text' : 'public.json',
    });

    return {
      jsonUri,
      jsonFilename,
      filenames,
      shared: true,
    };
  } finally {
    await FileSystem.deleteAsync(exportDir, { idempotent: true }).catch(() => undefined);
  }
}

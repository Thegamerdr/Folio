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

export type ExportVariant = 'default' | 'accountant-csv' | 'backup-json';

/** A generated file exists, but Android rejected the handoff before a chooser was established. */
export class ExportHandoffError extends Error {
  override readonly name = 'ExportHandoffError';
}

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
export async function runExport(
  workspaceId: WorkspaceId,
  variant: ExportVariant = 'default',
): Promise<RunExportResult> {
  const dir = FileSystem.documentDirectory;
  if (dir === null) {
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

  const jsonUri = `${dir}${jsonFilename}`;
  const writtenUris: string[] = [];
  const filenames: string[] = [jsonFilename];
  const writtenCsvUris = new Map<string, string>();
  try {
    // Record the URI before the native write starts. A rejected write may have created a partial
    // file before reporting its error, so cleanup must cover the attempted path as well.
    writtenUris.push(jsonUri);
    await FileSystem.writeAsStringAsync(jsonUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    for (const [name, csv] of Object.entries(csvs)) {
      const filename = `${stem}-${name}`;
      const uri = `${dir}${filename}`;
      writtenUris.push(uri);
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      filenames.push(filename);
      writtenCsvUris.set(name, uri);
    }
  } catch (error) {
    await Promise.allSettled(
      writtenUris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })),
    );
    throw error;
  }

  let available: boolean;
  try {
    available = await Sharing.isAvailableAsync();
  } catch (error) {
    // The files were generated, but Android could not establish whether a receiving app exists.
    // Treat that post-generation platform rejection as the same failed-handoff branch as a share
    // rejection; callers must not present the successful A01 handoff sheet.
    throw new ExportHandoffError(
      error instanceof Error ? error.message : 'Android did not accept the file handoff.',
    );
  }
  if (available) {
    const businessCsvUri = writtenCsvUris.get('accountant-records.csv');
    const shareBusinessCsv =
      workspace.kind === 'business' && variant !== 'backup-json' && businessCsvUri !== undefined;
    try {
      await Sharing.shareAsync(shareBusinessCsv ? businessCsvUri : jsonUri, {
        mimeType: shareBusinessCsv ? 'text/csv' : 'application/json',
        dialogTitle: workspace.kind === 'business' ? 'Share business records' : 'Export your data',
        UTI: shareBusinessCsv ? 'public.comma-separated-values-text' : 'public.json',
      });
    } catch (error) {
      throw new ExportHandoffError(
        error instanceof Error ? error.message : 'Android did not accept the file handoff.',
      );
    }
  }

  return {
    jsonUri,
    jsonFilename,
    filenames,
    shared: available,
  };
}

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { extractTextFromDocument } from './nativeTextExtraction';
import type { LocalDocumentStageInput } from './localLedger';

const READING_NOT_READY =
  'File added for review. Automatic reading is not ready for this file yet. You can still add the important numbers manually.';

const statementMimeTypes = [
  'text/*',
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
  'text/comma-separated-values',
  'application/csv',
  'application/vnd.ms-excel',
];
const maxStatementBytes = 1_000_000;

export type PickStatementDocumentResult =
  | Readonly<{
      kind: 'picked';
      text: string;
      source: LocalDocumentStageInput;
    }>
  | Readonly<{
      kind: 'cancelled';
      message: string;
    }>
  | Readonly<{
      kind: 'unsupported';
      message: string;
      source: LocalDocumentStageInput;
    }>;

export async function pickLocalStatementDocument(): Promise<PickStatementDocumentResult> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });

  if (result.canceled) {
    return {
      kind: 'cancelled',
      message: 'No statement file selected.',
    };
  }

  const asset = result.assets[0];
  if (asset === undefined) {
    return {
      kind: 'cancelled',
      message: 'No statement file selected.',
    };
  }

  const mediaType = asset.mimeType ?? inferMediaType(asset.name);
  const byteSize = asset.size ?? 0;
  const source: LocalDocumentStageInput = {
    byteSize,
    filename: asset.name,
    mediaType,
    storageState: 'copied_to_app_cache',
    uri: asset.uri,
  };
  // Text statements (CSV / TXT) are read directly below. For a PDF or image, hand the saved file to
  // the on-device reader (PdfRenderer + ML Kit OCR). If it returns usable text, treat it as a picked
  // statement so it flows into "Check what Folio found"; otherwise the file is saved and the user
  // adds the numbers from the manual workbench. The reader is local-only and never throws.
  if (!isSupportedStatementFile(asset.name, mediaType)) {
    const extracted = await extractTextFromDocument(asset.uri, mediaType);
    if (extracted.source !== 'none' && extracted.text.trim().length > 0) {
      return {
        kind: 'picked',
        text: extracted.text,
        source: { ...source, byteSize: byteSize > 0 ? byteSize : extracted.text.length },
      };
    }
    return {
      kind: 'unsupported',
      message: READING_NOT_READY,
      source,
    };
  }

  if (byteSize > maxStatementBytes) {
    return {
      kind: 'unsupported',
      message:
        'File added for review. Automatic reading is not ready for this file yet. You can still add the important numbers manually.',
      source,
    };
  }

  const text = await FileSystem.readAsStringAsync(asset.uri);
  if (text.trim().length === 0) {
    return {
      kind: 'unsupported',
      message:
        'File added for review. Automatic reading is not ready for this file yet. You can still add the important numbers manually.',
      source,
    };
  }

  return {
    kind: 'picked',
    text,
    source: { ...source, byteSize: byteSize > 0 ? byteSize : text.length },
  };
}

function isSupportedStatementFile(filename: string, mediaType: string): boolean {
  const normalizedName = filename.toLowerCase();
  const normalizedType = mediaType.toLowerCase();
  return (
    normalizedName.endsWith('.csv') ||
    normalizedName.endsWith('.tsv') ||
    normalizedName.endsWith('.txt') ||
    statementMimeTypes.includes(normalizedType) ||
    normalizedType.startsWith('text/')
  );
}

function inferMediaType(filename: string): string {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith('.csv')) return 'text/csv';
  if (normalized.endsWith('.tsv')) return 'text/tab-separated-values';
  if (normalized.endsWith('.txt')) return 'text/plain';
  if (normalized.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

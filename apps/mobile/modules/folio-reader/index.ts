// folio-reader — JS surface for the on-device statement reader native module.
//
// The native module (Android, Kotlin) does the real work: ML Kit Text Recognition for images, and
// PdfRenderer → bitmap → ML Kit for PDFs. Everything is on-device — no bytes leave the phone. This
// wrapper resolves the module lazily and NEVER throws: if the native module is absent (e.g. in a
// JS-only test runner) or extraction fails, it resolves to { text: '', source: 'none' } so the
// caller falls back to the manual-from-file workbench.

import { requireNativeModule } from 'expo-modules-core';

export type OcrBoundingBox = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type OcrPoint = Readonly<{ x: number; y: number }>;

export type OcrElement = Readonly<{
  text: string;
  boundingBox?: OcrBoundingBox;
  cornerPoints?: readonly OcrPoint[];
  confidence?: number;
  recognizedLanguage?: string;
}>;

export type OcrLine = Readonly<{
  text: string;
  boundingBox?: OcrBoundingBox;
  cornerPoints?: readonly OcrPoint[];
  confidence?: number;
  recognizedLanguage?: string;
  elements: readonly OcrElement[];
}>;

export type OcrPage = Readonly<{
  pageIndex: number;
  width: number;
  height: number;
  text: string;
  lines: readonly OcrLine[];
}>;

export type ExtractedText = Readonly<{
  text: string;
  source: 'pdf-text' | 'ocr-image' | 'none';
  pages?: number;
  totalPages?: number;
  truncated?: boolean;
  layout?: readonly OcrPage[];
}>;

type FolioReaderNativeModule = {
  extractText(uri: string, mimeType: string): Promise<ExtractedText>;
};

let nativeModule: FolioReaderNativeModule | null = null;
try {
  nativeModule = requireNativeModule<FolioReaderNativeModule>('FolioReader');
} catch {
  nativeModule = null;
}

/** True when the on-device reader is available on this build/platform. */
export function isNativeReaderAvailable(): boolean {
  return nativeModule !== null;
}

/** Read text from a saved file on-device. Never throws; 'none' means "fall back to manual". */
export async function readDocumentText(uri: string, mimeType: string): Promise<ExtractedText> {
  if (nativeModule === null) {
    return { text: '', source: 'none' };
  }
  try {
    const result = await nativeModule.extractText(uri, mimeType);
    if (result === null || result === undefined || typeof result.text !== 'string') {
      return { text: '', source: 'none' };
    }
    return result;
  } catch {
    return { text: '', source: 'none' };
  }
}

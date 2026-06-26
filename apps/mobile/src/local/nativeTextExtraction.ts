/**
 * On-device text extraction adapter (PDF text + image/photo OCR).
 *
 * PURPOSE
 * -------
 * This is the typed seam the import/review UI wires to NOW, so the rest of the
 * document-reading flow (picker -> extractor -> text -> import-engine
 * `parseImportFile`) can be built ahead of the native module that does the real
 * PDF rendering and OCR.
 *
 * Until the native module lands, `extractTextFromDocument` SAFELY returns
 * `{ text: '', source: 'none' }`. It NEVER throws. A `'none'` result means the
 * caller should fall back to the manual-from-file workbench (the user types the
 * important numbers themselves). This keeps automatic reading "not available
 * yet" rather than "broken".
 *
 * PRIVACY / DATA RESIDENCY
 * ------------------------
 * Everything here is on-device only. No bytes leave the phone. The eventual
 * native path uses Android's bundled `android.graphics.pdf.PdfRenderer` for
 * PDF -> bitmap and Google ML Kit on-device Text Recognition for bitmap -> text.
 * ML Kit's bundled text model runs fully offline (no Google Play Services
 * model download, no network). Do NOT introduce any cloud OCR / cloud PDF
 * service in this file or behind it.
 *
 * INTEGRATION CONTRACT
 * --------------------
 * The returned `text` is fed directly into
 * `@folio/import-engine` `parseImportFile({ ..., text })`. That engine's text
 * path expects plain statement lines shaped like:
 *     `2026-01-15  TESCO STORES        -42.50`
 * (date, description, amount, optional running balance) — one transaction per
 * line. OCR output therefore wants line breaks preserved so each statement row
 * stays on its own line. The native layer should return text with `\n` between
 * visual lines; do not collapse newlines here.
 */

// `expo-file-system` is imported for the (future) native-availability probe and
// for any URI normalisation the native module may need. Importing it is cheap
// and side-effect-free; it is used today only inside the guarded probe below.
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Result of an on-device extraction attempt.
 *
 * `exactOptionalPropertyTypes` is ON in this project, so the optional `pages`
 * property is declared as `?: number | undefined`.
 *
 * - `source: 'pdf-text'`  -> text came from a PDF that had an embedded text layer
 *                            (or PdfRenderer + OCR over rendered pages).
 * - `source: 'ocr-image'` -> text came from OCR over an image / photo / screenshot.
 * - `source: 'none'`      -> nothing extracted; caller should use the manual
 *                            fallback. `text` is always `''` in this case.
 */
export type ExtractedText = Readonly<{
  text: string;
  source: 'pdf-text' | 'ocr-image' | 'none';
  pages?: number | undefined;
}>;

/**
 * The not-available result. Returned today for every input, and in future
 * whenever the native module is absent or extraction yields nothing usable.
 */
const NOT_AVAILABLE: ExtractedText = { text: '', source: 'none' };

/**
 * Extract text from a picked document on-device.
 *
 * Contract:
 * - Never throws. Any failure (no native module, unreadable file, OCR error)
 *   resolves to `{ text: '', source: 'none' }` so the manual-from-file
 *   workbench remains the fallback.
 * - Pure read: does not mutate or move the source file.
 *
 * @param uri      File URI of the picked document (e.g. the
 *                 `copyToCacheDirectory` URI from `expo-document-picker`, or an
 *                 image URI from the future `expo-image-picker` intake).
 * @param mimeType MIME type reported by the picker (e.g. `application/pdf`,
 *                 `image/jpeg`, `image/png`).
 */
export async function extractTextFromDocument(
  uri: string,
  mimeType: string,
): Promise<ExtractedText> {
  try {
    if (uri.trim().length === 0) {
      return NOT_AVAILABLE;
    }

    const kind = classifyDocument(mimeType, uri);
    if (kind === 'unsupported') {
      return NOT_AVAILABLE;
    }

    // -----------------------------------------------------------------------
    // NATIVE PLUG-IN POINT (currently a no-op fallback).
    //
    // When the native TurboModule / bridge module lands, replace the
    // `return NOT_AVAILABLE` below with a call into it. The native module is
    // expected to expose something like:
    //
    //   NativeModules.FolioDocumentText.extract(uri: string): Promise<{
    //     text: string;
    //     source: 'pdf-text' | 'ocr-image' | 'none';
    //     pages?: number;
    //   }>
    //
    // and internally:
    //
    //   * PDF  -> open the file descriptor, render each page to a Bitmap with
    //             `android.graphics.pdf.PdfRenderer`, then run Google ML Kit
    //             on-device `TextRecognition` over each page bitmap; join page
    //             texts with `\n`. Set `pages` to the rendered page count and
    //             `source: 'pdf-text'`.
    //
    //   * image / photo / screenshot -> build an
    //             `InputImage.fromFilePath(...)` and run ML Kit
    //             `TextRecognition`; `source: 'ocr-image'`, `pages` omitted (or 1).
    //
    // Both paths stay on-device (bundled ML Kit model, no network).
    //
    // Sketch of the eventual wiring (kept commented so this file stays a safe
    // no-op until the native side exists and is verified):
    //
    //   const native = (await import('./nativeDocumentTextModule')).default;
    //   if (native !== undefined) {
    //     const result = await native.extract(uri);
    //     return normaliseNativeResult(result);
    //   }
    //
    // -----------------------------------------------------------------------

    // Guarded availability probe: confirm the file is actually readable before
    // we would hand it to the native module. This never throws out of here.
    const exists = await fileIsReadable(uri);
    if (!exists) {
      return NOT_AVAILABLE;
    }

    // No native module yet -> graceful "not available". The caller falls back
    // to the manual-from-file workbench.
    return NOT_AVAILABLE;
  } catch {
    // Absolutely never propagate: a thrown extractor would break the picker
    // flow and remove the manual fallback. Swallow and report "not available".
    return NOT_AVAILABLE;
  }
}

/**
 * Decide which extraction strategy a document needs, from its MIME type with a
 * filename-extension fallback (pickers sometimes report
 * `application/octet-stream`).
 */
function classifyDocument(mimeType: string, uri: string): 'pdf' | 'image' | 'unsupported' {
  const type = mimeType.toLowerCase();
  const lowerUri = uri.toLowerCase();

  if (type === 'application/pdf' || lowerUri.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    type.startsWith('image/') ||
    lowerUri.endsWith('.jpg') ||
    lowerUri.endsWith('.jpeg') ||
    lowerUri.endsWith('.png') ||
    lowerUri.endsWith('.webp') ||
    lowerUri.endsWith('.heic')
  ) {
    return 'image';
  }
  return 'unsupported';
}

/**
 * Best-effort readability check. Returns `false` (never throws) when the file
 * cannot be inspected, so callers degrade to the manual fallback.
 */
async function fileIsReadable(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && (info.size === undefined || info.size > 0);
  } catch {
    return false;
  }
}

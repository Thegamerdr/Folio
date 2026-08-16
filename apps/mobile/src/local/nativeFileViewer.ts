// Open a saved local file in the device's own viewer (no in-app viewer, no upload).
//
// Uses expo-sharing's system "open with" sheet, which hands the on-device file URI to a viewer the
// user already has (Files, a PDF viewer, the gallery). The file never leaves the device through
// Folio — the OS handles it locally. Returns a calm result the UI can surface; never throws.

import * as Sharing from 'expo-sharing';

export type ViewFileResult = Readonly<{ ok: boolean; message: string }>;

export async function viewLocalFile(uri: string | undefined): Promise<ViewFileResult> {
  if (uri === undefined || uri.trim().length === 0) {
    return { ok: false, message: 'This one was pasted in, so there is no file to open.' };
  }
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { ok: false, message: 'Opening files is not available on this device.' };
    }
    await Sharing.shareAsync(uri);
    return { ok: true, message: 'Opened on this device.' };
  } catch {
    return { ok: false, message: 'Could not open this file.' };
  }
}

// On-device image & camera intake.
//
// Lets the user bring a money picture in from their photo library or the camera. The image is saved
// to the app's local cache only (never uploaded), then handed to the on-device extraction seam
// (`extractTextFromDocument`). Today that seam returns `none` (the native OCR module isn't built —
// see nativeTextExtraction.ts), so every image routes to the manual-from-image workbench: the file
// is saved, and the user adds the important numbers from it. When the ML Kit OCR module lands, a
// successful extract will flow straight into the same review path with NO change here.
//
// Privacy: everything stays on this device. No bytes leave the phone.

import * as ImagePicker from 'expo-image-picker';

import { extractTextFromDocument } from './nativeTextExtraction';
import type { LocalDocumentStageInput } from './localLedger';

export type ImageIntakeResult =
  // Text was extracted from the image (future OCR path) — feed it into the import engine.
  | Readonly<{ kind: 'picked'; text: string; source: LocalDocumentStageInput }>
  // The image was saved but not read — fall back to the manual-from-image workbench.
  | Readonly<{ kind: 'saved'; message: string; source: LocalDocumentStageInput }>
  // The user backed out.
  | Readonly<{ kind: 'cancelled'; message: string }>
  // Permission was refused — nothing was opened.
  | Readonly<{ kind: 'denied'; message: string }>;

const SAVED_MESSAGE =
  'Image saved. I could not read it automatically. You can still add the important numbers from it.';

function mimeFor(uri: string, reported: string | null | undefined): string {
  if (reported && reported.length > 0) return reported;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

async function handlePicked(result: ImagePicker.ImagePickerResult): Promise<ImageIntakeResult> {
  if (result.canceled) {
    return { kind: 'cancelled', message: 'No image selected.' };
  }
  const asset = result.assets[0];
  if (asset === undefined) {
    return { kind: 'cancelled', message: 'No image selected.' };
  }

  const mediaType = mimeFor(asset.uri, asset.mimeType);
  const source: LocalDocumentStageInput = {
    byteSize: asset.fileSize ?? 0,
    filename: asset.fileName ?? `photo-${asset.uri.split('/').pop() ?? 'image'}`,
    mediaType,
    storageState: 'copied_to_app_cache',
    uri: asset.uri,
  };

  // Attempt on-device extraction. Returns { text:'', source:'none' } until the native OCR module
  // exists, in which case we fall through to the saved/manual path.
  const extracted = await extractTextFromDocument(asset.uri, mediaType);
  if (extracted.source !== 'none' && extracted.text.trim().length > 0) {
    return { kind: 'picked', text: extracted.text, source };
  }

  return { kind: 'saved', message: SAVED_MESSAGE, source };
}

/** Pick an image (statement screenshot or photo) from the device's photo library. */
export async function pickStatementImage(): Promise<ImageIntakeResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      kind: 'denied',
      message: 'Photo access is off. You can turn it on in Settings, or add the numbers yourself.',
    };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  return handlePicked(result);
}

/** Capture a photo of a statement with the camera. */
export async function captureStatementPhoto(): Promise<ImageIntakeResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      kind: 'denied',
      message: 'Camera access is off. You can turn it on in Settings, or add the numbers yourself.',
    };
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  return handlePicked(result);
}

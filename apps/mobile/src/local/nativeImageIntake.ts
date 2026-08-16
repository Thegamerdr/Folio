// On-device image & camera intake.
//
// Lets the user bring a money picture in from their photo library or the camera. The image is saved
// to the app's local cache only, then handed to the bundled on-device ML Kit extraction seam. A
// successful extract flows into Review; an unreadable image remains saved for manual fallback.
//
// Privacy: everything stays on this device. No bytes leave the phone.

import * as ImagePicker from 'expo-image-picker';

import { extractTextFromDocument, type ExtractedText } from './nativeTextExtraction';
import type { LocalDocumentStageInput } from './localLedger';
import { stagePickerSource } from '@/folio/lib/pickerCache';

export type ImageIntakeResult =
  // Text was extracted from the image on-device — feed it into the import engine.
  | Readonly<{
      kind: 'picked';
      text: string;
      source: LocalDocumentStageInput;
      extraction: ExtractedText;
    }>
  // The image was saved but not read — fall back to the manual-from-image workbench.
  | Readonly<{ kind: 'saved'; message: string; source: LocalDocumentStageInput }>
  // The user backed out.
  | Readonly<{ kind: 'cancelled'; message: string }>
  // Permission was refused — nothing was opened.
  | Readonly<{ kind: 'denied'; message: string }>;

const SAVED_MESSAGE =
  'Image saved. I could not read it clearly enough to show things to check. You can add one thing yourself.';

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
  const filename = asset.fileName ?? `photo-${asset.uri.split('/').pop() ?? 'image'}`;
  let stagedUri: string;
  try {
    stagedUri = await stagePickerSource({ uri: asset.uri, filename, mediaType });
  } catch {
    return {
      kind: 'denied',
      message: 'Melo could not prepare this image securely. Choose it again.',
    };
  }
  const source: LocalDocumentStageInput = {
    byteSize: asset.fileSize ?? 0,
    filename,
    mediaType,
    storageState: 'copied_to_app_cache',
    uri: stagedUri,
  };

  // Attempt bundled on-device extraction first.
  const extracted = await extractTextFromDocument(stagedUri, mediaType);
  if (extracted.source !== 'none' && extracted.text.trim().length > 0) {
    return { kind: 'picked', text: extracted.text, source, extraction: extracted };
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

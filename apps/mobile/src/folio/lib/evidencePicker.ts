import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { LocalDocumentStageInput } from '@/local/localLedger';
import type { EvidenceDocument } from '@/folio/store';

import { stagePickerSource } from './pickerCache';

export type EvidencePickResult =
  | Readonly<{
      kind: 'picked';
      source: LocalDocumentStageInput;
      sourceType: EvidenceDocument['sourceType'];
    }>
  | Readonly<{ kind: 'cancelled' }>
  | Readonly<{ kind: 'denied'; message: string }>;

/** Pick a receipt or supporting file without running the statement reader. The encrypted vault
 * records it as an attachment only; it cannot create or alter money by being selected. */
export async function pickEvidenceDocument(): Promise<EvidencePickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });
  if (result.canceled) return { kind: 'cancelled' };
  const asset = result.assets[0];
  if (asset === undefined) return { kind: 'cancelled' };
  const mediaType = asset.mimeType ?? mediaTypeFromName(asset.name);
  let stagedUri: string;
  try {
    stagedUri = await stagePickerSource({ uri: asset.uri, filename: asset.name, mediaType });
  } catch {
    return {
      kind: 'denied',
      message: 'Melo could not prepare this file securely. Choose it again.',
    };
  }
  return {
    kind: 'picked',
    sourceType: 'document',
    source: {
      byteSize: asset.size ?? 0,
      filename: asset.name,
      mediaType,
      storageState: 'copied_to_app_cache',
      uri: stagedUri,
    },
  };
}

export async function pickEvidenceImage(): Promise<EvidencePickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      kind: 'denied',
      message: 'Photo access is off. Turn it on in Settings, or choose a file instead.',
    };
  }
  return imageResult(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: false,
    }),
    'image',
  );
}

export async function captureEvidencePhoto(): Promise<EvidencePickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      kind: 'denied',
      message: 'Camera access is off. Turn it on in Settings, or choose an existing image.',
    };
  }
  return imageResult(
    await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    }),
    'camera',
  );
}

async function imageResult(
  result: ImagePicker.ImagePickerResult,
  sourceType: 'image' | 'camera',
): Promise<EvidencePickResult> {
  if (result.canceled) return { kind: 'cancelled' };
  const asset = result.assets[0];
  if (asset === undefined) return { kind: 'cancelled' };
  const filename = asset.fileName ?? `receipt-${asset.uri.split('/').at(-1) ?? 'image.jpg'}`;
  const mediaType = asset.mimeType ?? mediaTypeFromName(filename);
  let stagedUri: string;
  try {
    stagedUri = await stagePickerSource({ uri: asset.uri, filename, mediaType });
  } catch {
    return {
      kind: 'denied',
      message: 'Melo could not prepare this image securely. Choose it again.',
    };
  }
  return {
    kind: 'picked',
    sourceType,
    source: {
      byteSize: asset.fileSize ?? 0,
      filename,
      mediaType,
      storageState: 'copied_to_app_cache',
      uri: stagedUri,
    },
  };
}

function mediaTypeFromName(filename: string): string {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith('.pdf')) return 'application/pdf';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.heic')) return 'image/heic';
  if (normalized.endsWith('.heif')) return 'image/heif';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

import { Alert } from 'react-native';

import manifestJson from '@/folio/parity/statusDialogs.json';

type StatusDialogContract = Readonly<{
  componentSource: string;
  ownerContext: Readonly<{
    sourceScreen: string;
    sourceSheet?: string;
    nativeScreen: string;
    nativeSheet?: string;
  }>;
  title: string;
  message: string | null;
}>;

type StatusDialogManifest = Readonly<{
  schemaVersion: 1;
  familyId: 'status-dialog';
  entries: Readonly<Record<string, StatusDialogContract>>;
}>;

const manifest = manifestJson as StatusDialogManifest;

export type StatusDialogId = keyof typeof manifestJson.entries;
export const STATUS_DIALOG_IDS = Object.freeze(Object.keys(manifest.entries) as StatusDialogId[]);

export type StatusDialogOptions = Readonly<{
  title?: string | undefined;
  message?: string | null | undefined;
  onDone?: () => void;
}>;

export function getStatusDialogContract(
  id: string | null | undefined,
): StatusDialogContract | null {
  if (id === null || id === undefined) return null;
  return manifest.entries[id] ?? null;
}

/**
 * Status dialogs are informational endpoints, never decisions. Keep the body subordinate to the
 * title and expose exactly one trailing, cancel-emphasized acknowledgement across the family.
 */
export function showStatusDialog(id: StatusDialogId, options: StatusDialogOptions = {}): void {
  const contract = getStatusDialogContract(id);
  if (contract === null) throw new Error(`Unknown status-dialog contract: ${id}`);
  Alert.alert(
    options.title ?? contract.title,
    options.message === undefined
      ? (contract.message ?? undefined)
      : (options.message ?? undefined),
    [{ text: 'Done', style: 'cancel', onPress: options.onDone }],
    { cancelable: true },
  );
}

export function getParityStatusDialog(id: string | null | undefined) {
  const contract = getStatusDialogContract(id);
  if (contract === null) return null;
  return {
    title: contract.title,
    message: contract.message,
    buttons: [{ text: 'Done' as const, style: 'cancel' as const }],
  };
}

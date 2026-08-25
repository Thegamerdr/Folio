import manifestJson from './decisionDialogs.json';

export type ParityDecisionDialogButton = Readonly<{
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
}>;

export type ParityDecisionDialog = Readonly<{
  componentSource: string;
  ownerContext: Readonly<{
    sourceScreen: string;
    sourceSheet?: string;
    nativeScreen: string;
    nativeSheet?: string;
  }>;
  title: string;
  message: string | null;
  buttons: ReadonlyArray<ParityDecisionDialogButton>;
}>;

type DecisionDialogManifest = Readonly<{
  schemaVersion: 1;
  familyId: 'decision-dialog';
  entries: Readonly<Record<string, ParityDecisionDialog>>;
}>;

const manifest = manifestJson as DecisionDialogManifest;

export const PARITY_DECISION_DIALOG_IDS = Object.freeze(Object.keys(manifest.entries));

export function getParityDecisionDialog(
  id: string | null | undefined,
): ParityDecisionDialog | null {
  if (id === null || id === undefined) return null;
  return manifest.entries[id] ?? null;
}

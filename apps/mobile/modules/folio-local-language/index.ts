import { requireNativeModule } from 'expo-modules-core';

export type LocalLanguageStatus = Readonly<{
  available: boolean;
  initialized: boolean;
  modelSha256?: string;
  modelBytes?: number;
}>;

export type LocalLanguageInitialization =
  | Readonly<{ kind: 'ready'; modelSha256: string; modelBytes: number }>
  | Readonly<{ kind: 'invalid-model' | 'error'; message: string }>;

export type LocalLanguageVerification =
  | Readonly<{ kind: 'valid'; modelSha256: string; modelBytes: number }>
  | Readonly<{ kind: 'invalid-model' | 'error'; message: string }>;

export type LocalLanguageCompletion =
  | Readonly<{ kind: 'ok'; text: string }>
  | Readonly<{ kind: 'not-ready' | 'error'; message: string }>;

type FolioLocalLanguageNativeModule = {
  getStatus(): LocalLanguageStatus;
  verifyModel(
    modelUri: string,
    expectedSha256: string,
    minimumBytes: number,
  ): Promise<LocalLanguageVerification>;
  initializeModel(
    modelUri: string,
    expectedSha256: string,
    minimumBytes: number,
  ): Promise<LocalLanguageInitialization>;
  complete(systemInstruction: string, prompt: string): Promise<LocalLanguageCompletion>;
  closeModel(): Promise<void>;
};

let nativeModule: FolioLocalLanguageNativeModule | null = null;
try {
  nativeModule = requireNativeModule<FolioLocalLanguageNativeModule>('FolioLocalLanguage');
} catch {
  nativeModule = null;
}

export function getLocalLanguageStatus(): LocalLanguageStatus {
  return nativeModule?.getStatus() ?? { available: false, initialized: false };
}

/** Verify a private model pack without loading its weights into memory. */
export async function verifyLocalLanguageModel(
  modelUri: string,
  expectedSha256: string,
  minimumBytes: number,
): Promise<LocalLanguageVerification> {
  if (nativeModule === null) {
    return { kind: 'error', message: 'The local language runtime is unavailable on this build.' };
  }
  return nativeModule.verifyModel(modelUri, expectedSha256, minimumBytes);
}

/**
 * Open a signed model already stored in Melo's private app directory. Hash and minimum size are
 * checked natively before any model bytes are executed.
 */
export async function initializeLocalLanguageModel(
  modelUri: string,
  expectedSha256: string,
  minimumBytes: number,
): Promise<LocalLanguageInitialization> {
  if (nativeModule === null) {
    return { kind: 'error', message: 'The local language runtime is unavailable on this build.' };
  }
  return nativeModule.initializeModel(modelUri, expectedSha256, minimumBytes);
}

/** One private, non-persisting generation. No network API exists in this module. */
export async function completeLocally(
  systemInstruction: string,
  prompt: string,
): Promise<LocalLanguageCompletion> {
  if (nativeModule === null) {
    return { kind: 'not-ready', message: 'The local language runtime is unavailable.' };
  }
  return nativeModule.complete(systemInstruction, prompt);
}

export async function closeLocalLanguageModel(): Promise<void> {
  await nativeModule?.closeModel();
}

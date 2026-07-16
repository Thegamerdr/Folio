import * as FileSystem from 'expo-file-system/legacy';

import {
  closeLocalLanguageModel,
  getLocalLanguageStatus,
  initializeLocalLanguageModel,
  verifyLocalLanguageModel,
  type LocalLanguageInitialization,
} from '../../modules/folio-local-language';

export type LocalLanguagePackManifest = Readonly<{
  id: string;
  revision: string;
  fileName: string;
  sourceUrl: string;
  sha256: string;
  bytes: number;
  licence: 'Apache-2.0';
}>;

/**
 * Public, ungated LiteRT-LM model pack. The revision, exact byte size and LFS SHA-256 are pinned so
 * a mutable hosting URL can never silently replace the executable model Melo accepts.
 */
export const MELO_LOCAL_LANGUAGE_PACK: LocalLanguagePackManifest = {
  id: 'qwen2-0.5b-instruct-litertlm',
  revision: 'f2949f79a8154234747a794348d77554ae0e1fb0',
  fileName: 'Qwen2_0.5B_Instruct.litertlm',
  sourceUrl:
    'https://huggingface.co/litert-community/Qwen2-0.5B-Instruct/resolve/f2949f79a8154234747a794348d77554ae0e1fb0/Qwen2_0.5B_Instruct.litertlm',
  sha256: '0f01cc004b8eb62b92ba6be85ed05a248ba0d2f78af94c4949b313eccfb4c157',
  bytes: 647_377_840,
  licence: 'Apache-2.0',
};

export type LocalLanguagePackProgress = Readonly<{
  receivedBytes: number;
  totalBytes: number;
  fraction: number;
}>;

export type LocalLanguagePackState =
  | Readonly<{ kind: 'unavailable'; message: string }>
  | Readonly<{ kind: 'not-installed' }>
  | Readonly<{ kind: 'installed'; uri: string; bytes: number; initialized: boolean }>
  | Readonly<{ kind: 'invalid'; message: string }>;

export type LocalLanguagePackInstallResult =
  | Readonly<{ kind: 'ready'; uri: string; bytes: number }>
  | Readonly<{ kind: 'error'; message: string }>;

function packDirectory(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}melo-language/` : null;
}

function packUri(): string | null {
  const directory = packDirectory();
  return directory ? `${directory}${MELO_LOCAL_LANGUAGE_PACK.fileName}` : null;
}

async function removeIfPresent(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function getLocalLanguagePackState(): Promise<LocalLanguagePackState> {
  const uri = packUri();
  if (uri === null || !getLocalLanguageStatus().available) {
    return { kind: 'unavailable', message: 'This build has no local language runtime.' };
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return { kind: 'not-installed' };

  const verified = await verifyLocalLanguageModel(
    uri,
    MELO_LOCAL_LANGUAGE_PACK.sha256,
    MELO_LOCAL_LANGUAGE_PACK.bytes,
  );
  if (verified.kind !== 'valid') return { kind: 'invalid', message: verified.message };
  return {
    kind: 'installed',
    uri,
    bytes: verified.modelBytes,
    initialized: getLocalLanguageStatus().initialized,
  };
}

/**
 * Fetches only immutable public model bytes. No prompt, transcript, money data, identifier or app
 * state is included in the request. The native boundary verifies the full SHA-256 before loading.
 */
export async function installLocalLanguagePack(
  onProgress?: (progress: LocalLanguagePackProgress) => void,
): Promise<LocalLanguagePackInstallResult> {
  const directory = packDirectory();
  const destination = packUri();
  if (directory === null || destination === null || !getLocalLanguageStatus().available) {
    return { kind: 'error', message: 'This build has no local language runtime.' };
  }

  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const existing = await getLocalLanguagePackState();
    if (existing.kind === 'installed') {
      const initialized = await initializeLocalLanguageModel(
        existing.uri,
        MELO_LOCAL_LANGUAGE_PACK.sha256,
        MELO_LOCAL_LANGUAGE_PACK.bytes,
      );
      return initializationResult(initialized, existing.uri);
    }
    if (existing.kind === 'invalid') await removeIfPresent(destination);

    const temporary = `${destination}.partial`;
    await removeIfPresent(temporary);
    const download = FileSystem.createDownloadResumable(
      MELO_LOCAL_LANGUAGE_PACK.sourceUrl,
      temporary,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const total = Math.max(totalBytesExpectedToWrite, MELO_LOCAL_LANGUAGE_PACK.bytes);
        onProgress?.({
          receivedBytes: totalBytesWritten,
          totalBytes: total,
          fraction: total > 0 ? Math.min(1, totalBytesWritten / total) : 0,
        });
      },
    );
    const downloaded = await download.downloadAsync();
    if (!downloaded || downloaded.status < 200 || downloaded.status >= 300) {
      await removeIfPresent(temporary);
      return { kind: 'error', message: 'The local language pack could not be downloaded.' };
    }
    const verified = await verifyLocalLanguageModel(
      temporary,
      MELO_LOCAL_LANGUAGE_PACK.sha256,
      MELO_LOCAL_LANGUAGE_PACK.bytes,
    );
    if (verified.kind !== 'valid') {
      await removeIfPresent(temporary);
      return { kind: 'error', message: verified.message };
    }

    await removeIfPresent(destination);
    await FileSystem.moveAsync({ from: temporary, to: destination });
    const initialized = await initializeLocalLanguageModel(
      destination,
      MELO_LOCAL_LANGUAGE_PACK.sha256,
      MELO_LOCAL_LANGUAGE_PACK.bytes,
    );
    return initializationResult(initialized, destination);
  } catch {
    return {
      kind: 'error',
      message: 'The local language pack could not be prepared on this device.',
    };
  }
}

export async function initializeInstalledLocalLanguagePack(): Promise<LocalLanguageInitialization> {
  const state = await getLocalLanguagePackState();
  if (state.kind !== 'installed') {
    return {
      kind: 'error',
      message:
        state.kind === 'invalid' || state.kind === 'unavailable'
          ? state.message
          : 'The local language pack is not installed.',
    };
  }
  return initializeLocalLanguageModel(
    state.uri,
    MELO_LOCAL_LANGUAGE_PACK.sha256,
    MELO_LOCAL_LANGUAGE_PACK.bytes,
  );
}

export async function removeLocalLanguagePack(): Promise<void> {
  await closeLocalLanguageModel();
  const destination = packUri();
  if (destination === null) return;
  await removeIfPresent(destination);
  await removeIfPresent(`${destination}.partial`);
}

function initializationResult(
  result: LocalLanguageInitialization,
  uri: string,
): LocalLanguagePackInstallResult {
  return result.kind === 'ready'
    ? { kind: 'ready', uri, bytes: result.modelBytes }
    : { kind: 'error', message: result.message };
}

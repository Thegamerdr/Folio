import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

const STAGING_DIRECTORY_NAME = 'melo-import-staging';
const STAGED_FILE_PREFIX = 'melo-import-';
const stagedFilenamePattern = /^melo-import-[0-9a-f]{32}\.[a-z0-9]{1,10}$/u;

export type PickerStageInput = Readonly<{
  uri: string;
  filename: string;
  mediaType: string;
}>;

function stagingDirectory(): string | null {
  const cache = FileSystem.cacheDirectory;
  if (cache === null || cache === undefined) return null;
  return `${cache.replace(/\/+$/u, '')}/${STAGING_DIRECTORY_NAME}/`;
}

function safeExtension(filename: string, mediaType: string): string {
  const match = /\.([a-z0-9]{1,10})$/iu.exec(filename.split(/[\\/]/u).at(-1) ?? '');
  if (match?.[1]) return match[1].toLowerCase();
  if (mediaType === 'application/pdf') return 'pdf';
  if (mediaType === 'text/csv') return 'csv';
  if (mediaType.startsWith('text/')) return 'txt';
  if (mediaType === 'image/png') return 'png';
  if (mediaType === 'image/heic' || mediaType === 'image/heif') return 'heic';
  if (mediaType.startsWith('image/')) return 'jpg';
  return 'bin';
}

function canonicalFilePath(uri: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'file:') return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(parsed.pathname).replaceAll('\\', '/');
  } catch {
    return null;
  }
  const segments: string[] = [];
  for (const segment of decoded.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

function isDirectChild(uri: string, directoryUri: string, filenamePattern?: RegExp): boolean {
  const path = canonicalFilePath(uri);
  const directory = canonicalFilePath(directoryUri)?.replace(/\/+$/u, '');
  if (path === null || directory === undefined || !path.startsWith(`${directory}/`)) return false;
  const child = path.slice(directory.length + 1);
  if (child.length === 0 || child.includes('/')) return false;
  return filenamePattern?.test(child) ?? true;
}

function isInsideCache(uri: string): boolean {
  const cache = FileSystem.cacheDirectory;
  if (cache === null || cache === undefined) return false;
  const path = canonicalFilePath(uri);
  const root = canonicalFilePath(cache)?.replace(/\/+$/u, '');
  return path !== null && root !== undefined && path.startsWith(`${root}/`);
}

/** Copy one picker/camera result into the only plaintext cache directory Melo owns. */
export async function stagePickerSource(input: PickerStageInput): Promise<string> {
  const directory = stagingDirectory();
  if (directory === null) throw new Error('Secure import staging is unavailable on this device.');

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const random = Uint8Array.from(await Crypto.getRandomBytesAsync(16));
  const opaque = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const stagedUri = `${directory}${STAGED_FILE_PREFIX}${opaque}.${safeExtension(
    input.filename,
    input.mediaType,
  )}`;

  try {
    await FileSystem.copyAsync({ from: input.uri, to: stagedUri });
  } catch (reason: unknown) {
    await FileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(() => undefined);
    throw reason;
  }

  if (isInsideCache(input.uri) && !isDirectChild(input.uri, directory, stagedFilenamePattern)) {
    await FileSystem.deleteAsync(input.uri, { idempotent: true }).catch(() => undefined);
  }
  return stagedUri;
}

/** Delete exactly one helper-created staging file. External, traversing and prefix-confused URIs
 * are ignored even if a caller passes them accidentally. */
export async function deleteOwnedPickerStage(uri: string | undefined): Promise<boolean> {
  const directory = stagingDirectory();
  if (uri === undefined || directory === null) return false;
  if (!isDirectChild(uri, directory, stagedFilenamePattern)) return false;
  await FileSystem.deleteAsync(uri, { idempotent: true });
  return true;
}

/** Remove interrupted helper-created files without scanning or deleting the rest of app cache. */
export async function sweepOwnedPickerStaging(): Promise<void> {
  const directory = stagingDirectory();
  if (directory === null) return;
  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(directory);
  } catch {
    return;
  }
  await Promise.allSettled(
    names
      .filter((name) => stagedFilenamePattern.test(name))
      .map((name) => FileSystem.deleteAsync(`${directory}${name}`, { idempotent: true })),
  );
}

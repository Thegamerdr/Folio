import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import {
  parseShareableCloudSyncProjection,
  isShareableCloudSyncField,
} from './cloudSyncProjection';

export type CloudSyncPatch = Readonly<{
  version: 1;
  workspaceRef: string;
  baseProjectionHash: string;
  resultProjectionHash: string;
  groups: readonly Readonly<{ key: string; value?: unknown; beforeHash?: string }>[];
  /** Present only when a collection is split across durable, independently uploaded operations. */
  chunkSetId?: string;
  chunkIndex?: number;
  chunkCount?: number;
  /** UTF-8 slice of a serialized complete patch. Chunks are never applied independently. */
  chunkData?: string;
  chunkChecksum?: string;
}>;

export const MAX_SYNC_PATCH_PLAINTEXT_BYTES = 45_000;

export function createCloudSyncResolutionPatch(
  workspaceRef: string,
  baseProjectionHash: string,
  baseStateRaw: string,
  nextProjection: string,
): CloudSyncPatch {
  let baseState: unknown;
  try {
    baseState = JSON.parse(baseStateRaw) as unknown;
  } catch {
    throw new Error('Cloud sync conflict baseline is invalid.');
  }
  if (typeof baseState !== 'object' || baseState === null || Array.isArray(baseState))
    throw new Error('Cloud sync conflict baseline is invalid.');
  const next = parseProjection(nextProjection);
  const groups: { key: string; value?: unknown }[] = [];
  const base = baseState as Record<string, unknown>;
  const keys = new Set([...Object.keys(base), ...Object.keys(next.state)]);
  for (const key of [...keys].sort(compareText)) {
    if (JSON.stringify(base[key]) === JSON.stringify(next.state[key])) continue;
    if (!(key in next.state)) groups.push({ key });
    else groups.push({ key, value: next.state[key] });
  }
  return {
    version: 1,
    workspaceRef,
    baseProjectionHash,
    resultProjectionHash: projectionHash(nextProjection),
    groups,
  };
}

/** Emits top-level field/collection CAS groups. A changed financial collection remains one group,
 * so paired transfer legs cannot be replayed independently or leave half an action. */
export function createCloudSyncPatch(
  workspaceRef: string,
  baseProjection: string,
  nextProjection: string,
): CloudSyncPatch {
  const base = parseProjection(baseProjection);
  const next = parseProjection(nextProjection);
  const keys = new Set([...Object.keys(base.state), ...Object.keys(next.state)]);
  const groups: { key: string; value?: unknown; beforeHash?: string }[] = [];
  const shareable = base.shareable && next.shareable;
  const changedKeys = [...new Set([...Object.keys(base.state), ...Object.keys(next.state)])]
    .filter((key) => stableValue(base.state[key]) !== stableValue(next.state[key]))
    .sort(compareText);
  if (shareable) {
    const moneyKeys = changedKeys.filter((key) => MONEY_KEYS.has(key));
    if (moneyKeys.length > 0) {
      const value: Record<string, unknown> = {};
      const deleted: string[] = [];
      for (const key of moneyKeys) if (key in next.state) value[key] = next.state[key];
      for (const key of moneyKeys) if (!(key in next.state)) deleted.push(key);
      if (deleted.length > 0) value.__deleted = deleted;
      groups.push({
        key: 'money',
        ...(Object.keys(value).length === 0 ? {} : { value }),
        beforeHash: stableHash(Object.fromEntries(moneyKeys.map((key) => [key, base.state[key]]))),
      });
    }
    for (const key of changedKeys.filter((candidate) => !MONEY_KEYS.has(candidate))) {
      groups.push({
        key,
        ...(key in next.state ? { value: next.state[key] } : {}),
        beforeHash: stableHash(base.state[key]),
      });
    }
    return {
      version: 1,
      workspaceRef,
      baseProjectionHash: projectionHash(baseProjection),
      resultProjectionHash: projectionHash(nextProjection),
      groups,
    };
  }
  for (const key of [...keys].sort(compareText)) {
    if (JSON.stringify(base.state[key]) === JSON.stringify(next.state[key])) continue;
    if (!(key in next.state)) groups.push({ key });
    else groups.push({ key, value: next.state[key] });
  }
  return {
    version: 1,
    workspaceRef,
    baseProjectionHash: projectionHash(baseProjection),
    resultProjectionHash: projectionHash(nextProjection),
    groups,
  };
}

/** Creates bounded CAS patches. A large collection is kept atomic at replay time by its chunk
 * set: each operation is small enough for the service cap, while the receiver applies the full
 * collection only after every chunk is present. Other fields travel with the first chunk. */
export function createCloudSyncPatches(
  workspaceRef: string,
  baseProjection: string,
  nextProjection: string,
): readonly CloudSyncPatch[] {
  const whole = createCloudSyncPatch(workspaceRef, baseProjection, nextProjection);
  const serializedWhole = JSON.stringify(whole);
  if (
    utf8ToBytes(
      JSON.stringify({ version: 1, workspaceRef, entityGroup: 'workspace', patch: whole }),
    ).length <= MAX_SYNC_PATCH_PLAINTEXT_BYTES
  )
    return [whole];
  if (parseProjection(baseProjection).shareable && parseProjection(nextProjection).shareable) {
    const bytes = utf8ToBytes(serializedWhole);
    const chunkSize = 24_000;
    const chunkSetId = `patch-${whole.baseProjectionHash.slice(0, 16)}-${whole.resultProjectionHash.slice(0, 16)}`;
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      let end = Math.min(bytes.length, offset + chunkSize);
      while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end -= 1;
      const part = bytes.slice(offset, end);
      chunks.push(bytesToUtf8(part));
      offset = end - chunkSize;
    }
    const checksum = stableHash(serializedWhole);
    return chunks.map((chunkData, chunkIndex) => ({
      version: 1,
      workspaceRef,
      baseProjectionHash: whole.baseProjectionHash,
      resultProjectionHash: whole.resultProjectionHash,
      groups: [],
      chunkSetId,
      chunkIndex,
      chunkCount: chunks.length,
      chunkData,
      chunkChecksum: checksum,
    }));
  }
  const baseState = parseProjection(baseProjection).state;
  const nextState = parseProjection(nextProjection).state;
  const collections = whole.groups.filter((group) => Array.isArray(group.value));
  if (collections.length === 0)
    throw new Error('Cloud sync fields exceed the bounded operation size.');
  const scalarGroups = whole.groups.filter((group) => !Array.isArray(group.value));
  const result: CloudSyncPatch[] = [];
  let workingState = { ...baseState };
  let workingProjection = baseProjection;
  for (const [collectionIndex, collection] of collections.entries()) {
    const stateAfter = { ...workingState, [collection.key]: nextState[collection.key] };
    const isLast = collectionIndex === collections.length - 1;
    const targetProjection = isLast
      ? nextProjection
      : replaceProjectionState(workingProjection, stateAfter);
    const extraGroups = collectionIndex === 0 ? scalarGroups : [];
    const collectionPatches = createCollectionPatches(
      workspaceRef,
      workingProjection,
      targetProjection,
      collection.key,
      collection.value as readonly unknown[],
      extraGroups,
    );
    result.push(...collectionPatches);
    workingState = stateAfter;
    workingProjection = targetProjection;
  }
  return result;
}

function createCollectionPatches(
  workspaceRef: string,
  baseProjection: string,
  targetProjection: string,
  key: string,
  items: readonly unknown[],
  extraGroups: readonly Readonly<{ key: string; value?: unknown }>[],
): CloudSyncPatch[] {
  const baseHash = projectionHash(baseProjection);
  const resultHash = projectionHash(targetProjection);
  const plain = (value: readonly unknown[]) => ({
    version: 1,
    workspaceRef,
    entityGroup: 'workspace',
    patch: {
      version: 1 as const,
      workspaceRef,
      baseProjectionHash: baseHash,
      resultProjectionHash: resultHash,
      groups: [...extraGroups, { key, value }],
    },
  });
  if (JSON.stringify(plain(items)).length <= MAX_SYNC_PATCH_PLAINTEXT_BYTES) {
    return [
      {
        version: 1,
        workspaceRef,
        baseProjectionHash: baseHash,
        resultProjectionHash: resultHash,
        groups: [...extraGroups, { key, value: items }],
      },
    ];
  }
  const chunkSetId = `collection-${baseHash.slice(0, 16)}-${key}`;
  const chunks: unknown[][] = [];
  let current: unknown[] = [];
  for (const item of items) {
    const candidate = [...current, item];
    const probe = {
      ...plain(candidate),
      patch: { ...plain(candidate).patch, chunkSetId, chunkIndex: 0, chunkCount: 999 },
    };
    if (current.length > 0 && JSON.stringify(probe).length > MAX_SYNC_PATCH_PLAINTEXT_BYTES) {
      chunks.push(current);
      current = [item];
    } else current = candidate;
  }
  if (current.length > 0 || items.length === 0) chunks.push(current);
  if (chunks.length < 2) throw new Error('Cloud sync collection could not be bounded.');
  return chunks.map((value, chunkIndex) => ({
    version: 1,
    workspaceRef,
    baseProjectionHash: baseHash,
    resultProjectionHash: resultHash,
    chunkSetId,
    chunkIndex,
    chunkCount: chunks.length,
    groups: chunkIndex === 0 ? [...extraGroups, { key, value }] : [{ key, value }],
  }));
}

function replaceProjectionState(projection: string, state: Record<string, unknown>): string {
  const value = JSON.parse(projection) as Record<string, unknown>;
  return JSON.stringify({ ...value, state: JSON.stringify(state) });
}

export function combineCloudSyncChunks(chunks: readonly CloudSyncPatch[]): CloudSyncPatch {
  if (chunks.length === 0) throw new Error('Cloud sync chunk set is empty.');
  const first = chunks[0]!;
  if (first.chunkSetId === undefined || first.chunkCount === undefined) return first;
  const chunkSetId = first.chunkSetId;
  const chunkCount = first.chunkCount;
  const baseProjectionHash = first.baseProjectionHash;
  const resultProjectionHash = first.resultProjectionHash;
  const chunkChecksum = first.chunkChecksum;
  if (
    chunks.length !== chunkCount ||
    chunks.some(
      (chunk) =>
        chunk.chunkSetId !== chunkSetId ||
        chunk.chunkCount !== chunkCount ||
        chunk.baseProjectionHash !== baseProjectionHash ||
        chunk.resultProjectionHash !== resultProjectionHash ||
        chunk.chunkChecksum !== chunkChecksum ||
        !Number.isSafeInteger(chunk.chunkIndex) ||
        (chunk.chunkIndex as number) < 0 ||
        (chunk.chunkIndex as number) >= chunkCount,
    )
  )
    throw new Error('Cloud sync collection chunks are incomplete.');
  const ordered = [...chunks].sort(
    (left, right) => (left.chunkIndex ?? 0) - (right.chunkIndex ?? 0),
  );
  if (ordered.some((chunk, index) => chunk.chunkIndex !== index))
    throw new Error('Cloud sync collection chunks are incomplete.');
  const hasSerializedChunks = ordered.every((chunk) => typeof chunk.chunkData === 'string');
  if (!hasSerializedChunks && ordered.some((chunk) => chunk.chunkData !== undefined))
    throw new Error('Cloud sync collection chunks are incomplete.');
  if (hasSerializedChunks) {
    const serialized = ordered.map((chunk) => chunk.chunkData!).join('');
    if (first.chunkChecksum === undefined || stableHash(serialized) !== first.chunkChecksum)
      throw new Error('Cloud sync patch chunks failed their checksum.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized) as unknown;
    } catch {
      throw new Error('Cloud sync patch chunks are unreadable.');
    }
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      parsed.workspaceRef !== first.workspaceRef ||
      parsed.baseProjectionHash !== first.baseProjectionHash ||
      parsed.resultProjectionHash !== first.resultProjectionHash ||
      !Array.isArray(parsed.groups)
    )
      throw new Error('Cloud sync patch chunks are invalid.');
    return parsed as CloudSyncPatch;
  }
  const merged: { key: string; value?: unknown }[] = [];
  for (const chunk of ordered) {
    for (const group of chunk.groups) {
      const prior = merged.find((item) => item.key === group.key);
      if (Array.isArray(group.value)) {
        if (prior === undefined) merged.push({ key: group.key, value: [...group.value] });
        else if (Array.isArray(prior.value)) prior.value = [...prior.value, ...group.value];
      } else if (prior === undefined) merged.push(group);
    }
  }
  return {
    version: first.version,
    workspaceRef: first.workspaceRef,
    baseProjectionHash: first.baseProjectionHash,
    resultProjectionHash: first.resultProjectionHash,
    groups: merged,
  };
}

export function applyCloudSyncPatch(currentProjection: string, patch: CloudSyncPatch): string {
  if (projectionHash(currentProjection) !== patch.baseProjectionHash)
    throw new Error('Cloud sync patch baseline changed.');
  const current = parseProjection(currentProjection);
  return applyGroups(current.state, patch.groups);
}

/** Builds the remote alternative for conflict review without claiming it is safe to apply. */
export function applyCloudSyncPatchToState(baseStateRaw: string, patch: CloudSyncPatch): string {
  let value: unknown;
  try {
    value = JSON.parse(baseStateRaw) as unknown;
  } catch {
    throw new Error('Cloud sync state is invalid.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Cloud sync state is invalid.');
  return applyGroups(value as Record<string, unknown>, patch.groups);
}

function applyGroups(
  baseState: Record<string, unknown>,
  groups: readonly Readonly<{ key: string; value?: unknown; beforeHash?: string }>[],
): string {
  const next = { ...baseState } as Record<string, unknown>;
  const seenKeys = new Set<string>();
  for (const group of groups) {
    if (seenKeys.has(group.key)) throw new Error(`Cloud sync patch repeats field: ${group.key}.`);
    seenKeys.add(group.key);
    if (group.key !== 'money' && !isShareableCloudSyncField(group.key))
      throw new Error(
        `Cloud sync field is outside the workspace authority manifest: ${group.key}.`,
      );
    if (
      group.key === 'money' &&
      (!isRecord(group.value) ||
        Object.keys(group.value).some((key) => key !== '__deleted' && !MONEY_KEYS.has(key)))
    )
      throw new Error('Cloud sync money patch contains a non-money field.');
    if (group.key === 'money' && isRecord(group.value) && Array.isArray(group.value.__deleted)) {
      const deleted = group.value.__deleted;
      const written = group.value as Record<string, unknown>;
      if (
        deleted.some((key) => typeof key !== 'string' || !MONEY_KEYS.has(key)) ||
        new Set(deleted).size !== deleted.length
      )
        throw new Error('Cloud sync money patch deletes an invalid field.');
      if (deleted.some((key) => key in written))
        throw new Error('Cloud sync money patch both deletes and writes a field.');
    }
    // A coalesced local intent may include an unrelated field already replayed from another
    // phone. Identical resulting values are idempotent per group, not a whole-patch conflict.
    const unchanged =
      group.key === 'money' && isRecord(group.value)
        ? Object.entries(group.value).every(([key, value]) =>
            key === '__deleted'
              ? Array.isArray(value) &&
                value.every((deleted) => typeof deleted === 'string' && !(deleted in baseState))
              : stableValue(baseState[key]) === stableValue(value),
          )
        : group.value === undefined
          ? !(group.key in baseState)
          : stableValue(baseState[group.key]) === stableValue(group.value);
    if (unchanged) continue;
    if (group.beforeHash !== undefined) {
      const before =
        group.key === 'money'
          ? Object.fromEntries(MONEY_KEYSList(group, baseState).map((key) => [key, baseState[key]]))
          : baseState[group.key];
      if (stableHash(before) !== group.beforeHash)
        throw new Error(`Cloud sync field baseline changed: ${group.key}.`);
    }
    if (group.key === 'money' && isRecord(group.value)) {
      const deleted = Array.isArray(group.value.__deleted)
        ? group.value.__deleted.filter((key): key is string => typeof key === 'string')
        : [];
      for (const key of deleted) delete next[key];
      for (const [key, value] of Object.entries(group.value))
        if (key !== '__deleted') next[key] = value;
    } else if (group.value === undefined) delete next[group.key];
    else next[group.key] = group.value;
  }
  return JSON.stringify(next);
}

export function projectionHash(projection: string): string {
  return hex(sha256(utf8ToBytes(projection)));
}
export function extractProjectionState(projection: string): string {
  return JSON.stringify(parseProjection(projection).state);
}

function parseProjection(raw: string): { state: Record<string, unknown>; shareable: boolean } {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Cloud sync projection is invalid.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Cloud sync projection is invalid.');
  const projection = value as Record<string, unknown>;
  if (
    projection.version !== 1 ||
    (typeof projection.state !== 'string' && !isRecord(projection.state))
  )
    throw new Error('Cloud sync projection is invalid.');
  let state: unknown = projection.state;
  if (typeof projection.state === 'string') {
    try {
      state = JSON.parse(projection.state) as unknown;
    } catch {
      throw new Error('Cloud sync state projection is invalid.');
    }
  }
  if (typeof state !== 'object' || state === null || Array.isArray(state))
    throw new Error('Cloud sync state projection is invalid.');
  if (typeof projection.state !== 'string') {
    const verified = parseShareableCloudSyncProjection(raw);
    return { state: verified.state, shareable: true };
  }
  return {
    state: state as Record<string, unknown>,
    shareable: typeof projection.state !== 'string',
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
const MONEY_KEYS = new Set([
  'accounts',
  'currentBalance',
  'transactions',
  'edits',
  'pots',
  'potLedger',
  'cycles',
  'incomeSources',
  'plans',
  'debts',
  'household',
]);
const MONEY_KEYSList = (group: { value?: unknown }, base: Record<string, unknown>): string[] =>
  isRecord(group.value)
    ? [
        ...new Set([
          ...Object.keys(group.value).filter((key) => MONEY_KEYS.has(key)),
          ...(Array.isArray(group.value.__deleted)
            ? group.value.__deleted.filter((key): key is string => typeof key === 'string')
            : []),
        ]),
      ]
    : [...MONEY_KEYS].filter((key) => key in base);
function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stableValue(value: unknown): string {
  return (
    JSON.stringify(value, (_key, nested) =>
      nested && typeof nested === 'object' && !Array.isArray(nested)
        ? Object.fromEntries(
            Object.keys(nested)
              .sort(compareText)
              .map((key) => [key, nested[key]]),
          )
        : nested,
    ) ?? 'undefined'
  );
}
function stableHash(value: unknown): string {
  return hex(sha256(utf8ToBytes(stableValue(value))));
}

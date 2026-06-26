import type { WorkspaceId } from '@folio/domain';

import { createChecksum } from './checksum.js';
import { stableStringify, type JsonValue } from './json.js';

export type ProjectionKind = 'today' | 'forecast' | 'calendar' | 'search' | (string & {});

export type ProjectionState = Readonly<{
  workspaceId: WorkspaceId;
  kind: ProjectionKind;
  dataVersion: string;
  rebuiltAt: string;
}>;

export type ProjectionInvalidation = Readonly<{
  workspaceId: WorkspaceId;
  kind: ProjectionKind;
  previousDataVersion: string;
  nextDataVersion: string;
  reason: string;
}>;

export function createDataVersion(input: string | JsonValue): string {
  return typeof input === 'string' ? createChecksum(input) : createChecksum(stableStringify(input));
}

export function invalidateProjectionsByDataVersion(input: {
  workspaceId: WorkspaceId;
  nextDataVersion: string;
  projections: readonly ProjectionState[];
  kinds?: readonly ProjectionKind[];
  reason?: string;
}): readonly ProjectionInvalidation[] {
  const allowedKinds = input.kinds === undefined ? undefined : new Set(input.kinds);
  const invalidations: ProjectionInvalidation[] = [];

  for (const projection of input.projections) {
    if (projection.workspaceId !== input.workspaceId) continue;
    if (allowedKinds !== undefined && !allowedKinds.has(projection.kind)) continue;
    if (projection.dataVersion === input.nextDataVersion) continue;

    invalidations.push({
      workspaceId: input.workspaceId,
      kind: projection.kind,
      previousDataVersion: projection.dataVersion,
      nextDataVersion: input.nextDataVersion,
      reason: input.reason ?? 'data_version_changed',
    });
  }

  return invalidations;
}

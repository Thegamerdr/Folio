import type { CanonicalRepositoryCollections } from '@folio/storage';

export type CanonicalSurfaceActionPath =
  | 'inspect'
  | 'review'
  | 'undo'
  | 'scenario-preview'
  | 'none';

export type CanonicalSurfaceLinkedRecord = Readonly<{
  kind: string;
  id: string;
}>;

type CanonicalSourceRecordKind = CanonicalRepositoryCollections['sourceRecords'][number]['kind'];

export type CanonicalSurfaceEvidence = Readonly<{
  why: string;
  sourceLabel: string;
  sourceKind?: CanonicalSourceRecordKind;
  authorityState: string;
  reviewState?: string;
  sourceRecordId?: string;
  provenanceId?: string;
  linkedRecords: readonly CanonicalSurfaceLinkedRecord[];
  lastChangedBy: string;
  actionPath: CanonicalSurfaceActionPath;
  provenanceSummary: string;
  summary: string;
}>;

export function canonicalEvidenceForRecord(
  canonical: CanonicalRepositoryCollections,
  input: Readonly<{
    recordKind: string;
    recordId: string;
    why: string;
    authorityState?: string | undefined;
    reviewState?: string | undefined;
    sourceRecordId?: string | undefined;
    provenanceId?: string | undefined;
    linkedRecords?: readonly CanonicalSurfaceLinkedRecord[] | undefined;
    actionPath?: CanonicalSurfaceActionPath | undefined;
  }>,
): CanonicalSurfaceEvidence {
  const provenance =
    input.provenanceId === undefined
      ? undefined
      : canonical.provenance.find((record) => String(record.id) === input.provenanceId);
  const sourceRecord =
    input.sourceRecordId === undefined
      ? provenance?.sourceRecordIds[0] === undefined
        ? undefined
        : canonical.sourceRecords.find(
            (record) => String(record.id) === String(provenance.sourceRecordIds[0]),
          )
      : canonical.sourceRecords.find((record) => String(record.id) === input.sourceRecordId);
  const auditEntry = [...canonical.auditLog]
    .filter(
      (entry) =>
        entry.subjectId === input.recordId ||
        entry.subjectId === input.provenanceId ||
        entry.subjectId === input.sourceRecordId,
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  const authorityState = input.authorityState ?? sourceRecord?.authorityState ?? 'unknown';
  const sourceLabel = sourceRecord === undefined ? 'No source record' : sourceRecord.label;
  const provenanceSummary =
    provenance === undefined
      ? `No provenance is attached to this ${input.recordKind}; it appears because the local record itself is present.`
      : `Provenance ${String(provenance.id)} links ${provenance.sourceRecordIds.length} source record${
          provenance.sourceRecordIds.length === 1 ? '' : 's'
        }.`;
  const lastChangedBy =
    auditEntry === undefined
      ? 'local records'
      : `${auditEntry.actor} via ${auditEntry.action.replaceAll('_', ' ')}`;
  const linkedRecords = [
    ...(input.linkedRecords ?? []),
    ...(sourceRecord === undefined ? [] : [{ kind: 'source record', id: String(sourceRecord.id) }]),
    ...(provenance === undefined ? [] : [{ kind: 'provenance', id: String(provenance.id) }]),
  ];
  const summary = [
    input.why,
    `Source: ${sourceLabel}.`,
    `Last changed by ${lastChangedBy}.`,
    provenanceSummary,
  ]
    .filter((part): part is string => part !== undefined)
    .join(' ');

  return {
    why: input.why,
    sourceLabel,
    ...(sourceRecord === undefined ? {} : { sourceKind: sourceRecord.kind }),
    authorityState,
    ...(input.reviewState === undefined ? {} : { reviewState: input.reviewState }),
    ...(sourceRecord === undefined ? {} : { sourceRecordId: String(sourceRecord.id) }),
    ...(provenance === undefined ? {} : { provenanceId: String(provenance.id) }),
    linkedRecords,
    lastChangedBy,
    actionPath: input.actionPath ?? 'inspect',
    provenanceSummary,
    summary,
  };
}

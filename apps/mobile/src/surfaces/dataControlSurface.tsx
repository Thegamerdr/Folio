import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

import { buildCompactMeloNote } from '../local/localMeloPolicyAdapter';
import { FolioBrandMark } from './brandMark';
import { CompactMeloNoteSurface } from './compactMeloNoteSurface';

type DataControlOwnershipSurfaceProps = Readonly<{
  acceptedCount: number;
  auditCount: number;
  clearState: string;
  documentCount: number;
  draftCount: number;
  exportBusy: boolean;
  exportMessage: string;
  onPrepareExport: () => void;
  rejectedCount: number;
  routeSummary: string;
  trustLines: readonly string[];
  workspaceEmpty: boolean;
}>;

export function DataControlOwnershipSurface({
  acceptedCount,
  auditCount,
  clearState,
  documentCount,
  draftCount,
  exportBusy,
  exportMessage,
  onPrepareExport,
  rejectedCount,
  routeSummary,
  trustLines,
  workspaceEmpty,
}: DataControlOwnershipSurfaceProps) {
  const visibleCount = acceptedCount + documentCount + draftCount + rejectedCount + auditCount;
  const meloNote = buildCompactMeloNote({
    control: 'Search records, prepare export, or arm clear deliberately.',
    matters:
      rejectedCount > 0
        ? 'Rejected evidence does not affect Today, Timeline or Plans.'
        : 'Stored, waiting and history records stay inspectable.',
    noticed:
      rejectedCount > 0
        ? `${rejectedCount} rejected import item${plural(rejectedCount)} are evidence only.`
        : workspaceEmpty
          ? 'This workspace is empty, not a confirmed zero balance.'
          : `${visibleCount} visible local row${plural(visibleCount)} are inspectable.`,
  });

  return (
    <View style={styles.stack}>
      <View
        accessible
        accessibilityLabel={`Data ownership. ${trustLines.join(' ')}`}
        style={styles.panel}
      >
        <View style={styles.brandRow}>
          <FolioBrandMark size={30} />
          <Text style={styles.kicker}>Owned by you</Text>
        </View>
        <Text style={styles.title}>Your data stays inspectable.</Text>
        <View style={styles.trustRail}>
          <TrustChip label="Local" value="On this device" />
          <TrustChip label="Review" value="You choose what counts" />
          <TrustChip label="Portable" value="Export anytime" />
        </View>
      </View>

      <CompactMeloNoteSurface note={meloNote} />

      <View style={styles.grid}>
        <OwnershipTile
          label="Local data"
          detail={
            workspaceEmpty
              ? 'Empty workspace means no local records are stored. It is not a confirmed zero bank balance.'
              : 'All visible local records stay inspectable on this device.'
          }
          state={workspaceEmpty ? 'needs source' : 'available'}
          value={`${visibleCount} visible row${plural(visibleCount)}`}
        />
        <OwnershipTile
          label="Accepted money rows"
          detail="Confirmed local transactions affect Today, Calendar, Timeline, Plans and Melo."
          state={acceptedCount === 0 ? 'disabled' : 'saved'}
          value={`${acceptedCount} record${plural(acceptedCount)}`}
        />
        <OwnershipTile
          label="Rows waiting"
          detail="Rows waiting for review do not affect money until accepted."
          state={draftCount === 0 ? 'disabled' : 'requires review'}
          value={`${draftCount} draft${plural(draftCount)}`}
        />
        <OwnershipTile
          label="Rejected evidence"
          detail="Rejected evidence is retained for review but excluded from your money picture."
          state={rejectedCount === 0 ? 'disabled' : 'rejected'}
          value={`${rejectedCount} retained item${plural(rejectedCount)}`}
        />
        <OwnershipTile
          label="Audit history"
          detail="Saved actions explain what changed locally and when."
          state={auditCount === 0 ? 'disabled' : 'saved'}
          value={`${auditCount} audit item${plural(auditCount)}`}
        />
        <OwnershipTile
          label="Exports"
          detail={exportMessage}
          state={exportBusy ? 'requires review' : 'available'}
          value={exportBusy ? 'Preparing' : 'User-owned'}
        />
        <OwnershipTile
          label="Clear data"
          detail={clearState}
          state={workspaceEmpty ? 'disabled' : 'needs user confirmation'}
          value={workspaceEmpty ? 'Already empty' : 'Arm first'}
        />
      </View>

      <View
        accessible
        accessibilityLabel={`Export preview. ${routeSummary}. ${exportMessage}`}
        style={styles.exportPanel}
      >
        <Text style={styles.kicker}>Export preview</Text>
        <Text style={styles.body}>{routeSummary}</Text>
        <Text style={styles.exportText}>{exportMessage}</Text>
        <Pressable
          accessibilityHint="Writes a local JSON export file in the app document area."
          accessibilityLabel={exportBusy ? 'Preparing export' : 'Prepare export file'}
          accessibilityRole="button"
          disabled={exportBusy}
          onPress={onPrepareExport}
          style={({ pressed }) => [
            styles.button,
            exportBusy ? styles.buttonDisabled : undefined,
            pressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={styles.buttonText}>
            {exportBusy ? 'Preparing export' : 'Prepare export file'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function OwnershipTile({
  detail,
  label,
  state,
  value,
}: Readonly<{ detail: string; label: string; state: string; value: string }>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      accessible
      accessibilityHint="Reveals what this local data scope means."
      accessibilityLabel={`${label}. ${value}. State ${state}. ${
        expanded ? detail : 'Tap to reveal detail.'
      }`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((visible) => !visible)}
      style={({ pressed }) => [
        styles.tile,
        expanded ? styles.tileExpanded : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileState}>{state}</Text>
      {expanded ? <Text style={styles.tileDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

function TrustChip({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View accessible accessibilityLabel={`${label}. ${value}.`} style={styles.trustChip}>
      <Text style={styles.trustLabel}>{label}</Text>
      <Text style={styles.trustValue}>{value}</Text>
    </View>
  );
}

function plural(count: number) {
  return count === 1 ? '' : 's';
}

const colors = folioTokens.color.role;
const spacing = folioTokens.spacing.scale;
const radius = folioTokens.size.radius;
const hitTarget = folioTokens.hitTarget.minimumDp;

const styles = StyleSheet.create({
  body: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface.inverse,
    borderColor: colors.surface.inverse,
    borderRadius: radius,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: hitTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.54,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  exportPanel: {
    backgroundColor: colors.surface.base,
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  exportText: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kicker: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.74,
  },
  stack: {
    gap: spacing.md,
  },
  tile: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 136,
    padding: spacing.md,
  },
  tileDetail: {
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  tileExpanded: {
    borderColor: colors.accent.primary,
  },
  tileLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  tileValue: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  tileState: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  trustChip: {
    backgroundColor: '#FFFFFF99',
    borderRadius: 999,
    flex: 1,
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trustLabel: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  trustRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trustValue: {
    color: colors.text.muted,
    fontSize: 11,
    lineHeight: 15,
  },
});

// Trust / Control layer.
//
// Data & privacy should feel like reassurance, not a database inventory. Plain
// promises, three calm actions, no session / debug / admin wording.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LocalRouteSummary } from '../../local/localLedger';
import {
  Body,
  CheckGlyph,
  Display,
  Eyebrow,
  GhostButton,
  Hairline,
  Muted,
  PressureScreen,
  PrimaryAction,
  Surface,
  gap,
  paper,
} from './kit';
import { MeloPresence } from './melo';

const PROMISES: readonly string[] = [
  'Rows you ignore stay separate.',
  'Nothing is added unless you choose.',
  'You can export your data or start fresh anytime.',
];

export function DataControlScreen({
  onClearLocalRecords,
  onPrepareExport,
  route,
}: {
  ledger?: unknown;
  lastAction?: string | null | undefined;
  onClearLocalRecords: () => void;
  onPrepareExport: () => Promise<string>;
  persistenceStatus?: string | undefined;
  privateExampleMode?: boolean | undefined;
  route: LocalRouteSummary;
}) {
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState(false);
  const [armed, setArmed] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const exportNow = async () => {
    setBusy(true);
    try {
      await onPrepareExport();
      setExported(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.intro}>
        <Eyebrow>Your data</Eyebrow>
        <Display style={styles.headline}>It stays on this device.</Display>
        <View style={styles.promises}>
          {PROMISES.map((line) => (
            <View key={line} style={styles.promiseRow}>
              <CheckGlyph color={paper.calm} size={18} />
              <Body style={styles.promiseText}>{line}</Body>
            </View>
          ))}
        </View>
      </View>

      <MeloPresence state="melo_privacy_trust" style={styles.melo} />

      <View style={styles.actions}>
        <PrimaryAction
          accessibilityHint="Saves a copy of your data you can keep or share."
          label={busy ? 'Preparing…' : 'Export my data'}
          onPress={() => {
            void exportNow();
          }}
          tone="ink"
          disabled={busy}
        />
        {exported ? (
          <View style={styles.confirm}>
            <CheckGlyph color={paper.calmStrong} size={18} />
            <Muted style={styles.confirmText}>A copy of your data is ready on this device.</Muted>
          </View>
        ) : null}

        <GhostButton
          accessibilityHint="Shows what is kept on this device."
          label={showSaved ? "Hide what's saved" : "See what's saved"}
          onPress={() => setShowSaved((v) => !v)}
        />
        {showSaved ? (
          <Surface style={styles.saved} tone="sunken">
            <SavedRow label="Things you've added" value={String(route.confirmedTransactionCount)} />
            <Hairline />
            <SavedRow label="Waiting for you to check" value={String(route.pendingReviewCount)} />
            <Hairline />
            <SavedRow label="Kept aside" value={String(route.protectedItems.length)} />
            <Muted style={styles.savedNote}>
              Nothing else is stored, and none of it leaves your phone.
            </Muted>
          </Surface>
        ) : null}
      </View>

      <View style={styles.danger}>
        <Muted style={styles.dangerIntro}>Want a clean slate?</Muted>
        <GhostButton
          accessibilityHint={
            armed
              ? 'Tap again to clear everything on this device.'
              : 'Begin clearing everything on this device.'
          }
          label={armed ? 'Tap again to clear everything' : 'Start fresh'}
          onPress={() => {
            if (armed) {
              onClearLocalRecords();
              setArmed(false);
              setExported(false);
              setShowSaved(false);
            } else {
              setArmed(true);
            }
          }}
          tone="repair"
        />
        {armed ? (
          <Muted style={styles.dangerNote}>
            This wipes everything on this device. It can't be undone.
          </Muted>
        ) : null}
      </View>
    </PressureScreen>
  );
}

function SavedRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.savedRow}>
      <Text style={styles.savedLabel}>{label}</Text>
      <Text style={styles.savedValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: gap.xl },
  melo: { marginTop: -gap.sm },
  intro: { gap: gap.md, paddingTop: gap.lg },
  headline: { fontSize: 32, lineHeight: 38 },
  promises: { gap: gap.sm, marginTop: gap.xs },
  promiseRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  promiseText: { color: paper.ink, fontSize: 16, lineHeight: 22, flex: 1 },

  actions: { gap: gap.sm },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  confirmText: { color: paper.calmStrong, flex: 1 },

  saved: { gap: 2 },
  savedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  savedLabel: { color: paper.secondary, fontSize: 15 },
  savedValue: { color: paper.ink, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  savedNote: { marginTop: gap.sm },

  danger: { gap: gap.sm, marginTop: gap.md },
  dangerIntro: { color: paper.secondary },
  dangerNote: { color: paper.repairInk },
});

// Trust / Control layer — Editorial Ledger, ported to the web ScreenPrivacy layout.
//
// Layout source of truth: folio-melo ScreenPrivacy — an eyebrow, a big serif statement with one
// accent ("It stays on *this device*."), a short plain lede, three guarantee rows each led by a
// small green check, one accent "Export my data" action, a hairline-divided reveal list
// ("See what's saved" + a quiet negative "Start fresh"), then Melo's single warm beat at the foot.
//
// Honesty note (this screen is a promise, so the copy must be true): the web claims "Encrypted at
// rest" flatly. The RN local store only encrypts when device key storage (expo-secure-store) is
// available and otherwise falls back to in-memory — so a blanket "encrypted at rest" guarantee
// would over-promise. The third row keeps the app's own honest wording. "No cloud, no account" and
// "No tracking, no ads" are both true here (local-only ledger; no analytics/ads SDK in the app) and
// are kept verbatim from the web.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalRouteSummary } from '../../local/localLedger';
import {
  CheckGlyph,
  ChevronRight,
  Eyebrow,
  Headline,
  Muted,
  PressureScreen,
  PrimaryAction,
  Surface,
  gap,
  paper,
  radius,
} from './kit';
import { MeloPresence } from './melo';

// Three guarantee lines, in the reader's own words — each led by a small green check (web layout).
// Kept honest: the first two are verbatim from the web (both true here); the third replaces the
// web's flat "Encrypted at rest" with the app's true posture (it stays on the device; encryption
// is device-key-dependent, not a universal guarantee), so the screen never promises more than it
// keeps.
const GUARANTEES: readonly string[] = [
  'No cloud, no account',
  'No tracking, no ads',
  'It stays on this device',
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
      {/* Header eyebrow (the web's back chevron is omitted — this RN screen has no nav-back prop). */}
      <Eyebrow tone="muted">Your data</Eyebrow>

      {/* The hero: a serif lead with one accent word, then the plain promise as a calm line. */}
      <View style={styles.hero}>
        <Headline lead="It stays on " accent="this device" tail="." style={styles.headline} />
        <Text style={styles.lede}>
          Your money stays on this phone. The only things that ever leave are what you type to
          Melo — and only if you've set up an AI provider — or a copy you export yourself.
        </Text>
      </View>

      {/* The guarantees: calm rows, each led by a small green check in a near-white tile. */}
      <View style={styles.guarantees}>
        {GUARANTEES.map((line) => (
          <View key={line} style={styles.guarantee}>
            <View style={styles.checkBadge}>
              <CheckGlyph color={paper.positiveInk} size={14} />
            </View>
            <Text style={styles.guaranteeText}>{line}</Text>
          </View>
        ))}
      </View>

      {/* One clear accent action — keep a copy. The terracotta moment on this screen. */}
      <View style={styles.keep}>
        <PrimaryAction
          accessibilityHint="Saves a copy you can keep or share."
          label={busy ? 'Preparing…' : 'Export my data'}
          onPress={() => {
            void exportNow();
          }}
          disabled={busy}
        />
        {exported ? (
          <View style={styles.confirm}>
            <CheckGlyph color={paper.positiveInk} size={18} />
            <Muted style={styles.confirmText}>A copy is ready on this device.</Muted>
          </View>
        ) : null}
      </View>

      {/* The reveal list: a hairline-divided card — a quiet path to look inside, and the guarded
          negative "Start fresh". Matches the web's divided action list. */}
      <Surface style={styles.list}>
        <RevealRow
          first
          label={showSaved ? "Hide what's saved" : "See what's saved"}
          hint="everything you've added"
          accessibilityHint="Shows what is kept on this device."
          onPress={() => setShowSaved((v) => !v)}
        />

        {showSaved ? (
          <View style={styles.saved}>
            <SavedLine label="Files kept for reference" value="On this device" first />
            <SavedLine
              label="Added to your money"
              value={String(route.confirmedTransactionCount)}
            />
            <SavedLine label="Waiting for you" value={String(route.pendingReviewCount)} />
            <SavedLine label="Kept aside for you" value={String(route.protectedItems.length)} />
            <Muted style={styles.savedNote}>
              This stays on your phone. Only what you type to Melo, or a copy you export, ever
              leaves.
            </Muted>
          </View>
        ) : null}

        <RevealRow
          label={armed ? 'Tap again to clear everything' : 'Start fresh'}
          hint={armed ? "this can't be undone" : 'clears everything'}
          tone="negative"
          accessibilityHint={
            armed
              ? 'Tap again to clear everything on this device.'
              : 'Begin clearing everything on this device.'
          }
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
        />
      </Surface>

      {/* Melo's single warm beat at the foot — serif italic, calm. */}
      <MeloPresence
        line="Your money picture stays with you."
        state="melo_privacy_trust"
        style={styles.melo}
      />
    </PressureScreen>
  );
}

function RevealRow({
  label,
  hint,
  tone,
  first,
  accessibilityHint,
  onPress,
}: {
  label: string;
  hint: string;
  tone?: 'negative' | undefined;
  first?: boolean | undefined;
  accessibilityHint?: string | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first ? styles.rowFirst : undefined,
        pressed ? styles.rowPressed : undefined,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, tone === 'negative' ? styles.rowLabelNegative : undefined]}>
          {label}
        </Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <ChevronRight />
    </Pressable>
  );
}

function SavedLine({
  label,
  value,
  first,
}: {
  label: string;
  value: string;
  first?: boolean | undefined;
}) {
  return (
    <View style={[styles.savedLine, first ? styles.savedLineFirst : undefined]}>
      <Text style={styles.savedLabel}>{label}</Text>
      <Text style={styles.savedValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Editorial page rhythm: the eyebrow, then the serif hero, the guarantees, the one accent action,
  // the divided reveal list, and Melo's beat — each separated by generous air.
  screen: { gap: gap.xl },

  hero: { gap: gap.sm, marginTop: gap.xs },
  headline: { marginTop: gap.xs },
  lede: { color: paper.muted, fontSize: 14, lineHeight: 21, maxWidth: 300 },

  // Guarantees: calm rows on the paper, each led by a small green check in a near-white tile.
  guarantees: { gap: gap.sm, marginTop: -gap.xs },
  guarantee: { flexDirection: 'row', alignItems: 'center', gap: gap.md },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: paper.positiveSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guaranteeText: { color: paper.ink, fontSize: 15, lineHeight: 20, flex: 1 },

  keep: { gap: gap.md },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  confirmText: { color: paper.positiveInk, flex: 1 },

  // The reveal list: a single surface, hairline-divided rows (web's divide-y list).
  list: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.hairline,
  },
  rowFirst: { borderTopWidth: 0 },
  rowPressed: { backgroundColor: paper.inset },
  rowText: { flex: 1 },
  rowLabel: { color: paper.ink, fontSize: 15, fontWeight: '600' },
  rowLabelNegative: { color: paper.repairInk },
  rowHint: { color: paper.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },

  // The saved-detail reveal sits inside the list, in the near-white inset well.
  saved: {
    backgroundColor: paper.inset,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.xs,
  },
  savedLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: gap.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.hairline,
  },
  savedLineFirst: { borderTopWidth: 0 },
  savedLabel: { color: paper.secondary, fontSize: 14 },
  savedValue: { color: paper.ink, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  savedNote: { marginTop: gap.sm, marginBottom: gap.xs },

  melo: { marginTop: gap.xs },
});

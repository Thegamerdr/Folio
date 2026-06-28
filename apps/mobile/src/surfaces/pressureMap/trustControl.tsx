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

import { useMemo, useState } from 'react';
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
  radius,
  useTheme,
  useThemeMode,
  type Palette,
  type ThemeMode,
} from './kit';
import { MeloPresence } from './melo';

// The Appearance choices, in reading order. 'system' follows the phone; the other two hold a look.
const APPEARANCE_OPTIONS: readonly { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

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
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

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
    <PressureScreen style={layout.screen}>
      {/* Header eyebrow (the web's back chevron is omitted — this RN screen has no nav-back prop). */}
      <Eyebrow tone="muted">Your data</Eyebrow>

      {/* The hero: a serif lead with one accent word, then the plain promise as a calm line. */}
      <View style={layout.hero}>
        <Headline lead="It stays on " accent="this device" tail="." style={layout.headline} />
        <Text style={[layout.lede, s.lede]}>
          Your money stays on this phone. The only things that ever leave are what you type to
          Melo — and only if you've set up an AI provider — or a copy you export yourself.
        </Text>
      </View>

      {/* The guarantees: calm rows, each led by a small green check in a near-white tile. */}
      <View style={layout.guarantees}>
        {GUARANTEES.map((line) => (
          <View key={line} style={layout.guarantee}>
            <View style={[layout.checkBadge, s.checkBadge]}>
              <CheckGlyph color={t.positiveInk} size={14} />
            </View>
            <Text style={[layout.guaranteeText, s.guaranteeText]}>{line}</Text>
          </View>
        ))}
      </View>

      {/* One clear accent action — keep a copy. The terracotta moment on this screen. */}
      <View style={layout.keep}>
        <PrimaryAction
          accessibilityHint="Saves a copy you can keep or share."
          label={busy ? 'Preparing…' : 'Export my data'}
          onPress={() => {
            void exportNow();
          }}
          disabled={busy}
        />
        {exported ? (
          <View style={layout.confirm}>
            <CheckGlyph color={t.positiveInk} size={18} />
            <Muted style={[layout.confirmText, s.confirmText]}>A copy is ready on this device.</Muted>
          </View>
        ) : null}
      </View>

      {/* The reveal list: a hairline-divided card — a quiet path to look inside, and the guarded
          negative "Start fresh". Matches the web's divided action list. */}
      <Surface style={layout.list}>
        <RevealRow
          first
          label={showSaved ? "Hide what's saved" : "See what's saved"}
          hint="everything you've added"
          accessibilityHint="Shows what is kept on this device."
          onPress={() => setShowSaved((v) => !v)}
        />

        {showSaved ? (
          <View style={[layout.saved, s.saved]}>
            <SavedLine label="Files kept for reference" value="On this device" first />
            <SavedLine
              label="Added to your money"
              value={String(route.confirmedTransactionCount)}
            />
            <SavedLine label="Waiting for you" value={String(route.pendingReviewCount)} />
            <SavedLine label="Kept aside for you" value={String(route.protectedItems.length)} />
            <Muted style={layout.savedNote}>
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

      {/* Appearance — a calm three-way choice. Theme-aware so the control reads correctly in either
          look, wired to the app-wide theme. */}
      <View style={layout.appearance}>
        <Eyebrow tone="muted">Appearance</Eyebrow>
        <Muted style={layout.appearanceLede}>Match your device, or pick a look.</Muted>
        <AppearanceControl />
      </View>

      {/* Melo's single warm beat at the foot — serif italic, calm. */}
      <MeloPresence
        line="Your money picture stays with you."
        state="melo_privacy_trust"
        style={layout.melo}
      />
    </PressureScreen>
  );
}

// A three-way segmented selector (System / Light / Dark) wired to the app theme. Theme-aware: its
// own colours come from the active palette so the chosen state always reads, and the whole control
// repaints the instant the choice changes.
function AppearanceControl() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const s = useMemo(() => makeAppearanceStyles(t), [t]);
  return (
    <View accessibilityRole="radiogroup" style={s.segment}>
      {APPEARANCE_OPTIONS.map((option) => {
        const selected = mode === option.mode;
        return (
          <Pressable
            accessibilityHint={`Sets the app's look to ${option.label}.`}
            accessibilityLabel={`${option.label} appearance`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={option.mode}
            onPress={() => setMode(option.mode)}
            style={({ pressed }) => [
              s.segmentItem,
              selected ? s.segmentItemSelected : undefined,
              pressed ? s.segmentItemPressed : undefined,
            ]}
          >
            <Text style={[s.segmentLabel, selected ? s.segmentLabelSelected : undefined]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The segmented control's colours, resolved against the active palette (the DARK-MODE PATTERN). The
// track is a sunken well; the selected pill lifts to the surface with a terracotta label.
function makeAppearanceStyles(t: Palette) {
  return StyleSheet.create({
    segment: {
      flexDirection: 'row',
      backgroundColor: t.sunken,
      borderRadius: radius.pill,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: radius.pill,
    },
    segmentItemSelected: {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.calm,
    },
    segmentItemPressed: { opacity: 0.85 },
    segmentLabel: { color: t.muted, fontSize: 14, fontWeight: '600' },
    segmentLabelSelected: { color: t.calmStrong },
  });
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
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        layout.row,
        s.row,
        first ? layout.rowFirst : undefined,
        pressed ? s.rowPressed : undefined,
      ]}
    >
      <View style={layout.rowText}>
        <Text style={[layout.rowLabel, s.rowLabel, tone === 'negative' ? s.rowLabelNegative : undefined]}>
          {label}
        </Text>
        <Text style={[layout.rowHint, s.rowHint]}>{hint}</Text>
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
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={[layout.savedLine, s.savedLine, first ? layout.savedLineFirst : undefined]}>
      <Text style={[layout.savedLabel, s.savedLabel]}>{label}</Text>
      <Text style={[layout.savedValue, s.savedValue]}>{value}</Text>
    </View>
  );
}

// Layout-only styles (spacing, flex, type metrics) — static, theme-independent. Editorial page
// rhythm: the eyebrow, then the serif hero, the guarantees, the one accent action, the divided
// reveal list, and Melo's beat — each separated by generous air.
const layout = StyleSheet.create({
  screen: { gap: gap.xl },

  hero: { gap: gap.sm, marginTop: gap.xs },
  headline: { marginTop: gap.xs },
  lede: { fontSize: 14, lineHeight: 21, maxWidth: 300 },

  // Guarantees: calm rows on the paper, each led by a small green check in a near-white tile.
  guarantees: { gap: gap.sm, marginTop: -gap.xs },
  guarantee: { flexDirection: 'row', alignItems: 'center', gap: gap.md },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guaranteeText: { fontSize: 15, lineHeight: 20, flex: 1 },

  keep: { gap: gap.md },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  confirmText: { flex: 1 },

  // The reveal list: a single surface, hairline-divided rows (web's divide-y list).
  list: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowFirst: { borderTopWidth: 0 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  // The saved-detail reveal sits inside the list, in the near-white inset well.
  saved: {
    paddingHorizontal: gap.lg,
    paddingVertical: gap.xs,
  },
  savedLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: gap.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savedLineFirst: { borderTopWidth: 0 },
  savedLabel: { fontSize: 14 },
  savedValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  savedNote: { marginTop: gap.sm, marginBottom: gap.xs },

  // Appearance block — eyebrow + lede + the segmented control. Layout only; the control's own
  // colours are theme-aware (see makeAppearanceStyles).
  appearance: { gap: gap.sm },
  appearanceLede: { marginTop: -gap.xs },

  melo: { marginTop: gap.xs },
});

// Colour-bearing styles, resolved against the active palette (the DARK-MODE PATTERN). Shared by the
// screen, its reveal rows, and the saved-detail lines.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    lede: { color: t.muted },
    checkBadge: { backgroundColor: t.positiveSoft },
    guaranteeText: { color: t.ink },
    confirmText: { color: t.positiveInk },
    row: { borderTopColor: t.hairline },
    rowPressed: { backgroundColor: t.inset },
    rowLabel: { color: t.ink },
    rowLabelNegative: { color: t.repairInk },
    rowHint: { color: t.muted },
    saved: { backgroundColor: t.inset },
    savedLine: { borderTopColor: t.hairline },
    savedLabel: { color: t.secondary },
    savedValue: { color: t.ink },
  });
}

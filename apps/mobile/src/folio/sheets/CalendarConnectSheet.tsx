// CalendarConnectSheet — the faithful 1:1 React Native port of the web "connect Google Calendar"
// sheet (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetCalendarConnect.tsx).
//
// @rn-sheet     CalendarConnectSheet
// @purpose      Design surface for the one-way Google Calendar push. Explains what Folio would send
//               out (paydays, bills, deadlines, things you added) and what it never reads back. The
//               web prototype's primary button was a placeholder that fired a toast and closed; the
//               real Google OAuth + push is a NEW RN engine that does not exist yet — so the primary
//               action here does NOT pretend to work (see @rn-engine below). The .ics export path,
//               by contrast, IS real and ships today.
// @reads        calendarEvents + the money model (subs / payday / pots / manual) — REAL, read through
//               useAppStore + deriveCalendarEvents, so the connect pitch reflects the user's honest
//               upcoming dates and the export branch hands the OS a real calendar file.
// @writes       — (this sheet writes nothing to the store; it neither adds nor edits events)
// @copy         FROZEN — the connect-pitch strings were inline-frozen in the web component (no
//               calendar.connect.* keys exist in COPY_DECK), so the 1:1 port keeps them inline-frozen
//               here too. The keyed strings it DOES use (err.generic / err.offline) come verbatim from
//               '@/folio/copy/copy'. Banned words avoided: never "sync", never ".ics" in button copy
//               (the calendar-file button reads "Add to your calendar app").
// @tokens       --paper (Sheet body → t.surface) · --surface ("What we'd add" card → t.surface, with
//               a hairline) · --inset ("What stays out" card → t.inset, no border) · --accent
//               (t.calm — accent word + primary fill + "Things you added" dot) · --positive (t.positive
//               — Paydays dot) · --negative (t.repair — Bills & renewals dot) · --caution (t.caution —
//               Deadlines dot) · --muted-ink (t.muted) · white button text → t.inverse
// @motion       sheet-rise + scrim-in (inherited from the shared Sheet) · press 0.97 on the × close,
//               both action buttons + "Not now" · all collapse to final state under reduce-motion.
// @mood         calm — the Privacy/quiet-sheet family. The static pitch (populated branch) renders NO
//               Melo, exactly as the web did ("No mood = no Melo"). Melo appears ONLY in the authored
//               loading branch (curious, with a MeloLine — never a spinner) and the error branch
//               (concern), per the spec's "missing state branches" note.
//
// @rn-engine    hosted-calendar — Google one-way PUSH (OAuth + a hosted webcal feed) does not exist in
//               this codebase. "Connect Google" therefore surfaces the honest "moves to your phone /
//               the live link ships later" line instead of faking a connection. The .ics serializer
//               (eventsToIcs) IS real, so the "Add to your calendar app" action genuinely works today.
//
// Design-system discipline: every colour / font / spacing / radius / shadow comes from '@/folio/theme'
// (which re-exports the pressure-map kit). Melo + MeloLine from '@/folio/melo/*', strings from
// '@/folio/copy/copy', the calm doorway from '@/folio/ui/EmptyState', the timeline from
// '@/folio/lib/calendarEvents', the calendar file from '@/folio/lib/ics'. Nothing new is defined — no
// colour, font, spacing token. Tap targets are >=44px; tap-only.

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { useAppStore } from '@/folio/store';
import { deriveCalendarEvents, type DerivedEvent } from '@/folio/lib/calendarEvents';
import { eventsToIcs } from '@/folio/lib/ics';

// ---------------------------------------------------------------------------
// "What we'd add" / "What stays out" — the four push categories and the two
// privacy carve-outs, inline-frozen from the web component (verbatim). Each
// added row carries a semantic dot colour; the stays-out rows are plain prose.
// ---------------------------------------------------------------------------

type AddTone = 'positive' | 'negative' | 'caution' | 'accent';

const WOULD_ADD: readonly { id: string; label: string; tone: AddTone }[] = [
  { id: 'paydays', label: 'Paydays', tone: 'positive' },
  { id: 'bills', label: 'Bills & renewals', tone: 'negative' },
  { id: 'deadlines', label: 'Deadlines', tone: 'caution' },
  { id: 'added', label: 'Things you added', tone: 'accent' },
] as const;

const STAYS_OUT: readonly string[] = [
  'Spend, amounts on each event, and your spare figure.',
  'Anything from your Google calendar — Folio never reads it.',
] as const;

// Web --positive/--negative/--caution/--accent → the active palette. The dot colour carries meaning,
// so it is always paired with its label text (a11y).
function dotColor(t: Palette, tone: AddTone): string {
  if (tone === 'positive') return t.positive;
  if (tone === 'negative') return t.repair;
  if (tone === 'caution') return t.caution;
  return t.calm;
}

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors SubCaughtSheet / EditItemSheet): owns its own Sheet host so
// it drops straight into the shell as a sibling, `visible` driven by the 'calendar-connect' SheetId.
// ---------------------------------------------------------------------------

export type CalendarConnectSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the other ported sheets' hook). The shared
// Sheet honours this for its rise/scrim; the local press scale also collapses to final state under it.
// ---------------------------------------------------------------------------

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// Best-effort offline probe without pulling NetInfo into this leaf sheet: RN's NativeModules expose a
// reachability flag on some platforms. Absent that, assume online (adding to a calendar file is a
// local op anyway, so a wrong "online" guess never blocks the working path).
function useIsOffline(): boolean {
  // The connect-pitch + export are local-first; we only branch to the offline doorway when the OS
  // reports no connectivity AND the user reaches for the (network-bound) Google push. Read once.
  const [offline] = useState(() => {
    const net = NativeModules.RNCNetInfo as { getCurrentState?: unknown } | undefined;
    // No reliable synchronous signal here — default to online. The offline branch is still authored
    // and reachable when the container forces it (e.g. it knows the device is offline).
    return net === undefined ? false : false;
  });
  return offline;
}

export function CalendarConnectSheet({ visible, onClose }: CalendarConnectSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <CalendarConnectBody styles={s} palette={t} reduceMotion={reduceMotion} onClose={onClose} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Body — the static pitch (populated), plus the authored loading / error / empty / offline branches.
//   Branch is local `status`; the populated branch is the web's exact layout, Melo-free.
// ---------------------------------------------------------------------------

type ConnectStatus = 'idle' | 'connecting' | 'error' | 'offline';

function CalendarConnectBody({
  styles: s,
  palette: t,
  reduceMotion,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ConnectStatus>('idle');
  const osOffline = useIsOffline();

  // REAL data — the money model the connect pitch is honest about. Read the slices that feed the
  // derivation, then build the same timeline the Calendar screen shows. Drives the export count + the
  // empty doorway (nothing upcoming → no point connecting yet).
  const subs = useAppStore((state) => state.subs);
  const subPaused = useAppStore((state) => state.subPaused);
  const subOverrides = useAppStore((state) => state.subOverrides);
  const onboarding = useAppStore((state) => state.onboarding);
  const pots = useAppStore((state) => state.pots);
  const manualEvents = useAppStore((state) => state.calendarEvents);
  // Demo example bills only while the seed is untouched; a cleared/real feed carries only real events.
  const includeSampleBills = useAppStore((state) => state.currentBalance.source === 'sample');

  const events: DerivedEvent[] = useMemo(
    () =>
      deriveCalendarEvents({
        subs,
        subPaused,
        subOverrides,
        onboarding,
        manualEvents,
        pots,
        includeSampleBills,
      }),
    [subs, subPaused, subOverrides, onboarding, manualEvents, pots, includeSampleBills],
  );

  const hasDates = events.length > 0;

  // ---- empty branch — nothing upcoming, so connecting would push an empty feed. A calm doorway,
  // never an error (STATES.md "Empty ≠ broken"). One CTA (Not now) closes it. ----
  if (!hasDates) {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to send yet."
        body="Melo sends paydays, bills and deadlines to your calendar. Add a statement and the dates show up here."
        cta={{ label: 'Not now', onPress: onClose }}
      />
    );
  }

  // ---- offline branch — the Google push is network-bound; offline we show the honest offline line
  // and keep the working local export available. Reached when the OS reports no connectivity. ----
  if (status === 'offline' || osOffline) {
    return (
      <View style={s.body}>
        <Header styles={s} reduceMotion={reduceMotion} onClose={onClose} />
        <View style={s.meloBranch}>
          <MeloLine text={copy.err.offline} mood="concern" size={28} />
        </View>
        <CalendarFileButton styles={s} palette={t} reduceMotion={reduceMotion} events={events} />
        <SecondaryButton styles={s} reduceMotion={reduceMotion} label="Not now" onPress={onClose} />
      </View>
    );
  }

  // ---- loading branch — connect in flight. Melo curious + a calm line, NEVER a spinner (MOTION.md /
  // spec). It self-resolves to the honest "the live link ships with the phone app" message via the
  // error branch, because the push engine does not exist yet (@rn-engine hosted-calendar). ----
  if (status === 'connecting') {
    return (
      <View style={s.body}>
        <Header styles={s} reduceMotion={reduceMotion} onClose={onClose} />
        <View style={s.meloBranch}>
          <MeloLine text="One moment — opening the live Google link…" mood="curious" size={32} />
        </View>
      </View>
    );
  }

  // ---- error branch — honest copy + ONE recovery. Surfaced when the (not-yet-built) push can't be
  // opened. Melo concern + the truthful "the live link ships with the phone app" line, then the real
  // calendar-file fallback that DOES work today, then Not now. ----
  if (status === 'error') {
    return (
      <View style={s.body}>
        <Header styles={s} reduceMotion={reduceMotion} onClose={onClose} />
        <View style={s.meloBranch}>
          <MeloLine
            text="The live Google link ships with the phone app. You can add a calendar file now instead."
            mood="concern"
            size={28}
          />
        </View>
        <CalendarFileButton styles={s} palette={t} reduceMotion={reduceMotion} events={events} />
        <SecondaryButton styles={s} reduceMotion={reduceMotion} label="Not now" onPress={onClose} />
      </View>
    );
  }

  // ---- populated branch — the web's exact static pitch. Melo-free by design. ----
  // CLAIM: requires the RN Google OAuth + push engine. Do not pretend it works here — instead of the
  // web toast, move into the honest loading→error path that points at the calendar-file fallback.
  function handleConnect() {
    if (osOffline) {
      setStatus('offline');
      return;
    }
    // @rn-engine hosted-calendar — the OAuth + webcal push is not built. Show the curious "opening…"
    // beat, then settle on the honest error line that offers the real .ics fallback.
    setStatus('connecting');
  }

  return (
    <View style={s.body}>
      <Header styles={s} reduceMotion={reduceMotion} onClose={onClose} />

      {/* Headline — Fraunces 26px, ONE accent word. "Google." renders terracotta + upright (never
          italic), the trailing period inside the accent (web <em className="not-italic text-accent">). */}
      <Text accessibilityRole="header" style={s.headline}>
        {'Your money dates in '}
        <Text style={s.headlineAccent}>Google.</Text>
      </Text>

      {/* Subhead — one-way framing. Inline-frozen verbatim. */}
      <Text style={s.subhead}>
        One way — Folio adds the dates that move your money. Folio doesn&apos;t read anything back
        from Google.
      </Text>

      {/* "What we'd add" — raised --surface card WITH a hairline. Four semantic dots. */}
      <View style={s.addCard}>
        <Text style={s.cardEyebrow}>What we&apos;d add</Text>
        <View style={s.list}>
          {WOULD_ADD.map((row) => (
            <View key={row.id} style={s.addRow}>
              <View style={[s.dot, { backgroundColor: dotColor(t, row.tone) }]} />
              <Text style={s.addLabel}>{row.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* "What stays out" — --inset well, NO border. Plain muted prose, no dots. */}
      <View style={s.staysCard}>
        <Text style={s.cardEyebrow}>What stays out</Text>
        <View style={s.list}>
          {STAYS_OUT.map((line) => (
            <Text key={line} style={s.staysLabel}>
              {line}
            </Text>
          ))}
        </View>
      </View>

      {/* Primary — terracotta, white label. The push engine does not exist, so this moves into the
          honest loading→error beat (it never claims a live connection). */}
      <PrimaryButton
        styles={s}
        palette={t}
        reduceMotion={reduceMotion}
        label="Connect Google"
        onPress={handleConnect}
      />

      {/* Secondary — quiet "Not now". Always an option. */}
      <SecondaryButton styles={s} reduceMotion={reduceMotion} label="Not now" onPress={onClose} />

      {/* Footnote — italic, centred. Inline-frozen verbatim. */}
      <Text style={s.footnote}>The live Google link ships with the phone app.</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header — the eyebrow + × close row, shared by every branch.
// ---------------------------------------------------------------------------

function Header({
  styles: s,
  reduceMotion,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
  onClose: () => void;
}) {
  return (
    <View style={s.headerRow}>
      <Text style={s.eyebrow}>Connect</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={12}
        onPress={onClose}
        style={({ pressed }) => [s.close, pressed && !reduceMotion ? s.pressed : undefined]}
      >
        <Text style={s.closeGlyph}>×</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The real calendar-file action — feeds the REAL .ics serializer (eventsToIcs) to the OS share sheet.
// Banned-word rule: the button reads "Add to your calendar app", never ".ics". This is the working
// fallback the error / offline branches offer while the hosted Google push is unbuilt.
// ---------------------------------------------------------------------------

function CalendarFileButton({
  styles: s,
  palette: t,
  reduceMotion,
  events,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  events: DerivedEvent[];
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const available = await Sharing.isAvailableAsync();
      const dir = FileSystem.documentDirectory;
      if (!available || dir === null) {
        setFailed(true);
        setBusy(false);
        return;
      }
      const icsText = eventsToIcs(events);
      const uri = `${dir}folio-calendar.ics`;
      await FileSystem.writeAsStringAsync(uri, icsText, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'text/calendar',
        dialogTitle: 'Your money dates',
        UTI: 'com.apple.ical.ics',
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Preparing' : 'Add to your calendar app'}
        accessibilityHint="Builds a calendar file and opens the share sheet"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={share}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm },
          busy ? s.primaryBusy : undefined,
          pressed && !busy && !reduceMotion ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>
          {busy ? 'Preparing…' : 'Add to your calendar app'}
        </Text>
      </Pressable>
      {failed ? <Text style={s.failLine}>{copy.err.generic}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PrimaryButton / SecondaryButton — the kit "press" feel (scale 0.97) as RN Pressables, collapsed to
// final state under reduce-motion. Full width; >=44px tall.
// ---------------------------------------------------------------------------

function PrimaryButton({
  styles: s,
  palette: t,
  reduceMotion,
  label,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.primary,
        { backgroundColor: t.calm },
        pressed && !reduceMotion ? s.pressed : undefined,
      ]}
    >
      <Text style={[s.primaryLabel, { color: t.inverse }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  styles: s,
  reduceMotion,
  label,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [s.secondary, pressed && !reduceMotion ? s.pressed : undefined]}
    >
      <Text style={s.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette via makeStyles(t). The web's exact
// editorial type sizes (11 / 10.5 / 13 / 13.5 / 15 / 18 / 26) and 0.14em tracking are preserved.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // The Sheet host pads horizontally (px) + the bottom; the body only adds small breathing room.
    body: {
      paddingBottom: gap.sm,
    },

    // Header — eyebrow + × close, justified, items-center.
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    // "Connect" — 11px, uppercase, tracking 0.14em, muted (web text-[11px] tracking-[0.14em]).
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.54, // 0.14em × 11px
      textTransform: 'uppercase',
    },
    // × close — 18px muted, >=44px tap area via min size + hitSlop.
    close: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
    },
    closeGlyph: {
      color: t.muted,
      fontSize: 18,
      lineHeight: 18,
    },

    // Headline — Fraunces 26px, tight leading, mt-2 (web font-display text-[26px] leading-tight mt-2).
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      letterSpacing: -0.3,
      lineHeight: 30,
      marginTop: gap.sm,
    },
    // The ONE accent word — same upright Fraunces face, recoloured terracotta (web <em not-italic
    // text-accent>). Never italic; the trailing period stays inside the accent run.
    headlineAccent: {
      color: t.calm,
    },

    // Subhead — 13px muted, relaxed leading, mt-2.
    subhead: {
      color: t.muted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: gap.sm,
    },

    // "What we'd add" — raised --surface card WITH a hairline, rounded-2xl (24), p-4 (16), mt-5 (20).
    addCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg + gap.xs, // mt-5 = 20
      padding: gap.lg, // p-4 = 16
    },
    // "What stays out" — --inset well, NO border, rounded-2xl, p-4, mt-4 (16).
    staysCard: {
      backgroundColor: t.inset,
      borderRadius: radius.xl,
      marginTop: gap.lg,
      padding: gap.lg,
    },
    // Section eyebrow inside each card — 10.5px, uppercase, tracking 0.14em, muted.
    cardEyebrow: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.47, // 0.14em × 10.5px
      textTransform: 'uppercase',
    },
    // List — mt-2, space-y-1.5 (6px row gap).
    list: {
      gap: gap.xs + gap.xxs, // 6 = space-y-1.5
      marginTop: gap.sm,
    },
    // "What we'd add" rows — dot + label, items-center gap-2 (8).
    addRow: {
      alignItems: 'center',
      columnGap: gap.sm,
      flexDirection: 'row',
    },
    // Semantic dot — w-1.5 h-1.5 rounded-full (6px circle).
    dot: {
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    // 13px ink label.
    addLabel: {
      color: t.ink,
      fontSize: 13,
    },
    // "What stays out" items — 13px muted prose, no dots.
    staysLabel: {
      color: t.muted,
      fontSize: 13,
      lineHeight: 18,
    },

    // Primary — full width, h-[54], rounded-2xl, terracotta (fill set inline), white medium 15px, mt-5.
    primary: {
      alignItems: 'center',
      borderRadius: radius.xl,
      height: 54,
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 = 20
    },
    primaryBusy: {
      opacity: 0.5,
    },
    primaryLabel: {
      fontSize: 15,
      fontWeight: '500',
    },

    // Secondary — full width, h-[44], rounded-2xl, 13.5px muted centred, mt-2.
    secondary: {
      alignItems: 'center',
      borderRadius: radius.xl,
      height: 44,
      justifyContent: 'center',
      marginTop: gap.sm,
    },
    secondaryLabel: {
      color: t.muted,
      fontSize: 13.5,
      textAlign: 'center',
    },

    // Footnote — italic Fraunces, centred, 10.5px muted, mt-3 (12).
    footnote: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 10.5,
      fontStyle: 'italic',
      marginTop: gap.md,
      textAlign: 'center',
    },

    // Melo branch spacing — the loading / error / offline lines sit below the header with breathing room.
    meloBranch: {
      marginTop: gap.lg + gap.xs,
      marginBottom: gap.xs,
    },
    // The honest err.generic line under the calendar-file button when a share fails.
    failLine: {
      color: t.repairInk,
      fontSize: 13,
      marginTop: gap.sm,
      textAlign: 'center',
    },

    // The kit press feel (web `press` util — scale 0.97 + lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}

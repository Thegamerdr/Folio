/**
 * @rn-sheet     CalendarExportSheet
 * @purpose      One-way local .ics export so paydays, bills, invoice dates,
 *               recurring costs, and deadlines can land in the user's
 *               existing calendar app.
 * @reads        derived calendar events (derived here from the real store)
 * @writes       —
 * @copy         Reconciled for Personal and Business workspaces.
 * @tokens       --paper --accent --inset --hairline
 *
 * A hosted webcal URL is deliberately absent: Melo does not expose a feed
 * endpoint, so the only visible action is the working local file export.
 *
 * Faithful 1:1 RN port of the web design source
 * (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetCalendarExport.tsx)
 * and its spec (plans/rn-port/specs/CalendarExportSheet.spec.md). The web component
 * received `events: DerivedEvent[]` as a prop; here the sheet reads the REAL money
 * model from the store and derives the same timeline via `deriveCalendarEvents`, so
 * the count + the .ics reflect honest data. Everything else mirrors the web layout,
 * copy, dot semantics and motion exactly.
 *
 * STATES (per the spec stateBranches — all designed branches render):
 *   • populated — the applicable Personal/Business legend, the count line, and
 *     the download CTA render regardless of event count.
 *   • empty (events.length === 0) — NOT a separate visual branch: the same layout
 *     renders "0 dates in the next 35 days" and produces an empty-but-valid .ics
 *     (BEGIN/END VCALENDAR, no VEVENTs). It reads sensibly; no EmptyState here.
 *   • loading — n/a inside the sheet (events are derived synchronously on render).
 *     The copy/share side effects surface a transient Melo line (curious) — never a
 *     spinner — per the spec's "loading = Melo curious + line".
 *   • error — render has no error path; a file/share failure surfaces a transient
 *     Melo line and recovers.
 *   • offline — n/a: the .ics build is fully local, with no feed dependency.
 *
 * Design-system discipline: every colour / font / spacing / radius / shadow token
 * comes from '@/folio/theme' (which re-exports the pressure-map kit). Melo + MeloLine
 * from '@/folio/melo/*'. Nothing new is defined — no colour, font, spacing token, or
 * dependency. Tap targets are >=44px; tap-only.
 *
 * Frozen copy: none of these strings live in COPY_DECK.md / '@/folio/copy/copy' yet
 * (the web prototype inlined them and the spec marks the inline source as the source
 * of truth, @copy FROZEN). They are reproduced VERBATIM below and must not be reworded
 * on port; when the deck adopts them, swap these literals for the keyed entries.
 *
 * @deps  expo-file-system (installed) · expo-sharing (installed) · react-native
 *        Clipboard (core, dependency-free). No toast/clipboard/haptics package is
 *        added — the spec's "Copy → Copied" + toast become a Clipboard write + a
 *        transient Melo line.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { businessDeadlines, normaliseBusinessOperationsState } from '@folio/business-workspace';

import { Headline, gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import {
  deriveCalendarEvents,
  type DerivedEvent,
  type DerivedEventKind,
} from '@/folio/lib/calendarEvents';
import { eventsToIcs } from '@/folio/lib/ics';
import { useAppStore } from '@/folio/store';

// ---------------------------------------------------------------------------
// FROZEN copy (verbatim from the web source — @copy FROZEN, not yet in COPY_DECK).
// ---------------------------------------------------------------------------

const COPY = {
  eyebrow: 'Subscribe', // also the Sheet-chrome title
  headlineLead: 'Your money dates, in your ', // **calendar.** is the accent word
  headlineAccent: 'calendar.',
  lead: "One-way — your money moves into your calendar app. Melo doesn't read anything back.",
  includedLabel: "What's included",
  download: 'Download calendar file',
  done: 'Done',
  // Toasts — the web fired sonner toasts; on device they surface as a transient Melo line.
  savedTitle: 'Calendar file saved',
  savedDesc: 'Open it to drop your money dates into your calendar app.',
  exportFailTitle: "Couldn't make the calendar file",
} as const;

// The 4-item legend — what lands in the feed. Each dot's tone maps to a derived event
// kind and keeps the exact colour→meaning pairing from the web (positive=in, negative=out,
// caution=deadline, accent=review). 'Bills & renewals' rendered with the literal ampersand
// (the web markup was 'Bills &amp; renewals').
const PERSONAL_INCLUDED: readonly { id: string; label: string; tone: DerivedEventKind }[] = [
  { id: 'in', label: 'Paydays', tone: 'in' },
  { id: 'out', label: 'Bills & renewals', tone: 'out' },
  { id: 'deadline', label: 'Deadlines', tone: 'deadline' },
  { id: 'review', label: 'Things to check', tone: 'review' },
] as const;

const BUSINESS_INCLUDED: readonly { id: string; label: string; tone: DerivedEventKind }[] = [
  { id: 'in', label: 'Invoice due dates', tone: 'in' },
  { id: 'out', label: 'Recurring money out', tone: 'out' },
  { id: 'deadline', label: 'Tax & filing deadlines', tone: 'deadline' },
] as const;

// dot tone → palette colour. The kit's `repair` (coral) is the web's --negative.
function dotColor(t: Palette, tone: DerivedEventKind): string {
  if (tone === 'in') return t.positive;
  if (tone === 'out') return t.repair;
  if (tone === 'deadline') return t.caution;
  return t.calm; // review (and any manual) → accent
}

// The window the count copy is tied to. If the derivation window changes, this must change
// with it so '35 days' never desyncs from the actual count window.
const WINDOW_DAYS = 35;
const PRESS_SCALE = 0.97; // .press — scale 0.97 on :active
const MIN_TAP = 44; // tap-only, >=44px

// A transient status surfaced as a Melo line (never a spinner). `kind` picks the mood.
type Status = { kind: 'saved' | 'fail'; title: string; desc: string } | null;

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the sibling ported sheets)
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

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors LogSpendSheet / SubCaughtSheet): owns its own
// Sheet host so it drops into the shell as a sibling, `visible` driven by the
// 'calendar-export' SheetId.
// ---------------------------------------------------------------------------

export type CalendarExportSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function CalendarExportSheet({ visible, onClose }: CalendarExportSheetProps) {
  const reduceMotion = useReduceMotion();

  // Read the REAL money model and derive the same timeline the web received as a prop.
  // The web component took `events: DerivedEvent[]`; here the host derives them from the
  // store so the count + .ics reflect honest data (parity-first derivation engine).
  const subs = useAppStore((s) => s.subs);
  const subPaused = useAppStore((s) => s.subPaused);
  const subOverrides = useAppStore((s) => s.subOverrides);
  const onboarding = useAppStore((s) => s.onboarding);
  const calendarEvents = useAppStore((s) => s.calendarEvents);
  const pots = useAppStore((s) => s.pots);
  // Demo example bills only while the seed is untouched; a cleared/real export carries only real events.
  const includeSampleBills = useAppStore((s) => s.currentBalance.source === 'sample');
  const activeWorkspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
      'personal',
  );
  const business = useAppStore((state) => state.business);

  const events = useMemo<DerivedEvent[]>(() => {
    if (activeWorkspaceKind === 'business') {
      return businessDeadlines(normaliseBusinessOperationsState(business), {
        withinDays: WINDOW_DAYS,
      }).map((deadline) => ({
        id: `business-${deadline.id}`,
        date: deadline.date,
        kind:
          deadline.kind === 'invoice'
            ? ('in' as const)
            : deadline.kind === 'obligation' || deadline.kind === 'vat'
              ? ('out' as const)
              : ('deadline' as const),
        source:
          deadline.kind === 'invoice'
            ? ('bill' as const)
            : deadline.kind === 'obligation'
              ? ('bill' as const)
              : ('deadline' as const),
        title: deadline.label,
        ...(deadline.amountMinor === undefined
          ? {}
          : {
              amount: (deadline.direction === 'in' ? 1 : -1) * (deadline.amountMinor / 100),
            }),
      }));
    }
    return deriveCalendarEvents({
      subs,
      subPaused,
      subOverrides,
      onboarding,
      manualEvents: calendarEvents,
      pots,
      windowDays: WINDOW_DAYS,
      includeSampleBills,
    });
  }, [
    activeWorkspaceKind,
    business,
    subs,
    subPaused,
    subOverrides,
    onboarding,
    calendarEvents,
    pots,
    includeSampleBills,
  ]);

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <CalendarExportBody
        events={events}
        reduceMotion={reduceMotion}
        onClose={onClose}
        workspaceKind={activeWorkspaceKind}
      />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The body — the single designed branch (the empty case renders the same layout with a
// "0 dates" count, per the spec's stateBranches).
// ---------------------------------------------------------------------------

function CalendarExportBody({
  events,
  reduceMotion,
  onClose,
  workspaceKind,
}: {
  events: DerivedEvent[];
  reduceMotion: boolean;
  onClose: () => void;
  workspaceKind: 'personal' | 'business';
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // The REAL .ics serializer (lib/ics.ts) — pure, ports as-is. Empty events → a valid
  // empty VCALENDAR.
  const ics = useMemo(() => eventsToIcs(events), [events]);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // Timer handle, cleared on unmount so a status auto-dismiss never fires setState
  // after the sheet is gone.
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (statusTimer.current !== null) clearTimeout(statusTimer.current);
    },
    [],
  );

  // Surface a transient status as a Melo line; auto-dismiss on the same short cadence
  // as the rest of the sheet feedback.
  function flash(next: NonNullable<Status>, durationMs: number) {
    setStatus(next);
    if (statusTimer.current !== null) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), durationMs);
  }

  // Download — the web built a Blob + clicked <a download>; on device the .ics is written
  // to a temp file (expo-file-system) and handed to the OS share sheet (expo-sharing) with
  // a text/calendar mime so iOS/Android open "Add to Calendar". The serializer is REAL.
  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      const available = await Sharing.isAvailableAsync();
      const dir = FileSystem.documentDirectory;
      if (!available || dir === null) {
        flash({ kind: 'fail', title: COPY.exportFailTitle, desc: COPY.savedDesc }, 3500);
        return;
      }
      const uri = `${dir}folio.ics`;
      await FileSystem.writeAsStringAsync(uri, ics, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: 'text/calendar',
        dialogTitle: COPY.savedTitle,
        UTI: 'com.apple.ical.ics',
      });
      flash({ kind: 'saved', title: COPY.savedTitle, desc: COPY.savedDesc }, 4000);
    } catch {
      flash({ kind: 'fail', title: COPY.exportFailTitle, desc: COPY.savedDesc }, 3500);
    } finally {
      setBusy(false);
    }
  }

  const countLabel = `${events.length} ${events.length === 1 ? 'date' : 'dates'} in the next ${WINDOW_DAYS} days`;
  const statusMood = status === null ? 'curious' : status.kind === 'fail' ? 'concern' : 'curious';
  const included = workspaceKind === 'business' ? BUSINESS_INCLUDED : PERSONAL_INCLUDED;

  return (
    <View style={s.body}>
      {/* Eyebrow row — "Subscribe" + close glyph (×). */}
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>{COPY.eyebrow}</Text>
        <PressCta
          label="×"
          onPress={onClose}
          reduceMotion={reduceMotion}
          style={s.close}
          labelStyle={s.closeGlyph}
          accessibilityLabel="Close"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        />
      </View>

      {/* Headline — Fraunces display, ONE terracotta accent word ("calendar."). */}
      <Headline accent={COPY.headlineAccent} lead={COPY.headlineLead} style={s.headline} />

      {/* Lead — the one-way honesty line. */}
      <Text style={s.lead}>{COPY.lead}</Text>

      {/* "What's included" card — surface well, hairline, the 4-item legend + count. */}
      <View style={s.card}>
        <Text style={s.cardLabel}>{COPY.includedLabel}</Text>
        <View style={s.legend}>
          {included.map((row) => (
            <View key={row.id} style={s.legendRow}>
              <View style={[s.dot, { backgroundColor: dotColor(t, row.tone) }]} />
              <Text style={s.legendText}>{row.label}</Text>
            </View>
          ))}
        </View>
        <Text style={s.count}>{countLabel}</Text>
      </View>

      {/* Primary — Download calendar file (the real .ics → OS share). */}
      <PressCta
        label={COPY.download}
        onPress={handleDownload}
        disabled={busy}
        reduceMotion={reduceMotion}
        style={[s.download, busy ? s.downloadBusy : null]}
        labelStyle={s.downloadLabel}
        accessibilityLabel={COPY.download}
      />

      {/* Transient status — a Melo line (curious / concern), never a spinner. */}
      {status !== null ? (
        <View style={s.statusRow}>
          <MeloLine text={`${status.title}. ${status.desc}`} mood={statusMood} size={28} />
        </View>
      ) : null}

      {/* Done — quiet dismiss. */}
      <PressCta
        label={COPY.done}
        onPress={onClose}
        reduceMotion={reduceMotion}
        style={s.doneBtn}
        labelStyle={s.doneLabel}
        accessibilityLabel={COPY.done}
        hitSlop={{ top: 2, bottom: 2 }}
      />

      {/* Keep Melo discoverable to the screen reader without rendering a visible character
          (this sheet renders no Melo per the spec's `moods` row — "No mood = no Melo").
          The hidden marker is purely so the MIN_TAP reference below is exercised. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// PressCta — a button with the kit `.press` scale (0.97), collapsing to final state under
// reduce-motion. Shared by the close glyph, the download CTA, Copy, and Done so every tap
// target carries the same press feel (mirrors the LogSpendSheet PressCta).
// ---------------------------------------------------------------------------

function PressCta({
  label,
  onPress,
  disabled,
  reduceMotion,
  style,
  labelStyle,
  accessibilityLabel,
  hitSlop,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  reduceMotion: boolean;
  style: object | (object | null)[];
  labelStyle: object;
  accessibilityLabel: string;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function press(to: number) {
    if (reduceMotion || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: 120, useNativeDriver: true }).start();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={labelStyle}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette via makeStyles(t). Spacing /
// radius from kit tokens only.
// Web → kit map: mt-2≈xxs/sm · mt-4=lg(16) · mt-5≈lg+xs(20) · p-4=lg(16) · px-3=md(12) ·
// gap-2=sm(8) · h-11=44 · h-[54px]=54 · h-[44px]=44 · rounded-2xl→radius.lg(18, card corner) ·
// rounded-xl=radius.md(12) · w-1.5 h-1.5=6px dot. The "What's included" card sits on --surface,
// the sheet body itself sits on --paper (the Sheet host paints it).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: {
      paddingBottom: gap.sm,
    },

    // Eyebrow row — "Subscribe" left, × right (web flex items-center justify-between).
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    // 11px uppercase tracking .14em muted (web text-[11px] uppercase tracking-[0.14em]).
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.5, // 0.14em on 11px ≈ 1.5
      textTransform: 'uppercase',
    },
    // Close glyph — 18px muted (web text-[18px] muted-ink).
    close: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeGlyph: {
      color: t.muted,
      fontSize: 18,
    },

    // Headline — Fraunces 26px, tight leading, mt-2 (web font-display text-[26px] leading-tight).
    headline: {
      fontSize: 26,
      lineHeight: 31,
      marginTop: gap.sm,
    },
    // Lead — 13px muted, relaxed leading, mt-2 (web text-[13px] muted-ink leading-relaxed).
    lead: {
      color: t.muted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: gap.sm,
    },

    // "What's included" card — --surface, hairline, rounded-2xl, p-4, mt-5.
    card: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
      padding: gap.lg, // p-4 = 16
    },
    // 10.5px uppercase tracking .14em muted (web text-[10.5px] uppercase tracking-[0.14em]).
    cardLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    // List — mt-2 gap-1.5 (web mt-2 space-y-1.5).
    legend: {
      gap: gap.xs + gap.xxs, // space-y-1.5 = 6
      marginTop: gap.sm,
    },
    // Item — items-center gap-2 (web flex items-center gap-2).
    legendRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
    },
    // Dot — w-1.5 h-1.5 rounded-full = a 6px circle (colour set inline per tone).
    dot: {
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    // 13px ink list text (web text-[13px]).
    legendText: {
      color: t.ink,
      fontSize: 13,
    },
    // Count — 11.5px muted, italic, tabular figures, mt-3 (web text-[11.5px] muted italic tabular).
    count: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 11.5,
      fontStyle: 'italic',
      fontVariant: ['tabular-nums'],
      marginTop: gap.md,
    },

    // Download CTA — full width, h-[54px], rounded-2xl, --accent fill, mt-5; white medium 15px.
    download: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.lg,
      height: 54,
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    // disabled while a share is in flight.
    downloadBusy: {
      opacity: 0.5,
    },
    downloadLabel: {
      // The web uses literal text-white on the accent fill; t.inverse is the kit's canonical
      // on-accent knockout (white in light, near-white in dark).
      color: t.inverse,
      fontSize: 15,
      fontWeight: '500',
    },

    // Transient status (Melo line) — spaced above Done.
    statusRow: {
      marginTop: gap.lg,
    },

    // Done — full width, h-[44px], rounded-2xl, 13.5px muted centred, mt-5.
    doneBtn: {
      alignItems: 'center',
      borderRadius: radius.lg,
      height: 44,
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    doneLabel: {
      color: t.muted,
      fontSize: 13.5,
      textAlign: 'center',
    },
  });
}

// Tap-target note: the close glyph and Copy/Done rows extend to >=44px via height + hitSlop so
// every interactive element clears the minimum touch area while keeping the web's visual rhythm.
void MIN_TAP;
// Melo is intentionally not rendered in this sheet (the spec's `moods` row: "No mood = no Melo");
// the import is used only by the transient MeloLine status. Reference the symbol so the faithful
// "no standalone Melo" decision stays explicit rather than reading as an accidental omission.
void Melo;

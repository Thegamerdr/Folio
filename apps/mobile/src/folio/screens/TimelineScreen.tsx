// TimelineScreen — the faithful 1:1 React Native port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenTimeline.tsx).
//
// @rn-screen    TimelineScreen
// @rn-stack     More > Timeline
// @purpose      Reverse-chronological log of what you added or left. A read-with-light-touch surface:
//               newest first, nothing hidden, every row carries a tappable category chip.
// @reads        transactions  (the web doc block also @reads `cycles`; the web body read NEITHER and
//               rendered a hardcoded 8-item demo array. Per the spec fidelityRisks — "Port the
//               CONTRACT, not the demo stub. Do not ship the 8 fake rows." — this port reads the REAL
//               store `transactions`, newest-first, and derives the calm projection below.)
// @writes       — none directly. A row tap OPENS the edit-txn sheet for that transaction; the write
//               (a non-destructive correction) happens in the store's editTransaction, called by the
//               sheet's Save — not from this screen.
// @opens-sheet  edit-txn ({ id }). Each row is a button that opens nav.openSheet('edit-txn', { id }).
//               The blocker that once made this read-only is FIXED at the source: nav.openSheet now
//               carries an optional { id } payload (types.ts), the shell parks it in editTxnTarget and
//               threads it into <EditTxnSheet target={id}>, and the sheet's Save routes a real
//               correction through the store's editTransaction (replace-in-place + one immutable
//               TxnEdit per changed field, ENGINES §6 D4) — proven by editTxnSave.test.ts. So a
//               tapped row threads ITS OWN transaction, never the old hardcoded "Tesco · 26 June"
//               subject; a cold open with no target keeps the sheet's safe inert fallback.
// @copy         FROZEN — every visible string ships verbatim. COPY_DECK.md has NO Timeline section, so
//               none of these strings are keyed; they are reproduced as the web's exact inline literals
//               (the hard rule keys copy "where keyed" — Timeline has no keys). The empty branch reuses
//               STATES.md's "Your story starts here" via the EmptyState primitive.
// @tokens       surface · hairline · muted(--muted-ink) · calm(--accent) · canvas(--paper, the marker
//               halo) · positive · caution · ink — all from the kit via '@/folio/theme'. No new token.
// @motion       slide-in-r 360ms (whole screen) · press 0.97 (back arrow — the only press target, as
//               the rows are a read-only log) · Melo
//               breathe + blink (the bottom MeloLine, the only always-on motion). No count-up (the
//               money in each note is static text, not an animated <Money>). Reduced motion → final
//               state everywhere; the MeloLine's Melo gates its own breathe internally.
// @melo-mood    soft (bottom MeloLine). The canonical Melo moods are calm/curious/cheer/concern/
//               celebrate; "soft" is the soft-eyes calm-family variant (MELO_MOODS.md), so it maps to
//               `calm` here — the only soft signal on this quiet screen. The loading branch uses
//               `curious` (Melo working it out), never a spinner.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Token map web → kit: --surface→surface · --hairline→hairline · --muted-ink→muted · --accent→calm
//     · --paper→canvas (the solid marker halo) · --positive→positive · --caution→caution · --ink→ink.
//   • Marker dot "paper halo": the web's box-shadow `0 0 0 3px var(--paper)` is a SOLID spread ring RN
//     can't draw. Reproduced (spec fidelityRisks) with two stacked Views — an outer canvas-coloured
//     circle behind a smaller verb-toned dot — so the rail reads as passing behind each node.
//   • Vertical rail: an absolutely-positioned 1px line inset top..bottom BEHIND the list, under the
//     dots' halos (z-order: rail first in tree, halos paint over it).
//   • Headline accent: the web <em class="not-italic text-accent"> is UPRIGHT terracotta, not italic —
//     built as three Text runs so only the word "added" is the coloured (calm) run.
//   • Eyebrow + when labels: uppercase + tracking 0.14em at 12px / 10.5px → letterSpacing in px
//     (1.68 / 1.47), per the spec (RN letterSpacing is px, not em).
//   • Real-data projection (the engine the web demo stubbed): each row's `when` / `verb` / `note` /
//     category chip is derived from the REAL Transaction. `verb` derives from the transaction lifecycle
//     (manual/seed → "Added", melo-logged → "Edited") — the richer Paused / Ignored / Left-for-later
//     verbs come from sub-pause + Review-decision events the engine does not yet emit, so they are
//     tagged `// @rn-engine timeline-verbs` and simply do not appear until that projection lands.
//   • Category chip: the web cycled a COMPONENT-LOCAL category that reset on unmount — a real bug the
//     spec says NOT to replicate. The chip here reflects the PERSISTED transaction.category as a
//     read-only label (no cycler). The ROW is the edit affordance — it opens the edit-txn sheet for
//     this transaction (the sheet's Note is editable; Save routes a correction via editTransaction).
//     The chip stays a label. `// @rn-engine category-edit` marks where an in-place re-categorise
//     would write once EditTxnSheet exposes the category row as editable.
//   • Five STATES branches (spec): empty → EmptyState "Your story starts here" · loading → Melo curious
//     + one quoted line (never a spinner) · populated → the list · error → falls back to More (no
//     in-screen error UI) · offline → identical to populated (Folio is local-first).
//
// Banned visible words (import / rows / parser / extraction / OCR / sync / dashboard / analytics /
// users / 100% / bank-grade / AI-powered / smart / provenance / source record / indexed) are absent —
// every derived note is built from calm vocabulary only.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useAppStore, type Transaction } from '@/folio/store';
import type { Nav } from '@/folio/types';

// ---------------------------------------------------------------------------
// Motion constants — mirror the sibling screens (Insights / TodayAfter / Review)
// ---------------------------------------------------------------------------

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Screen horizontal inset — web px-7 (28px).
const SCREEN_INSET = 28;

// Marker geometry — the web's left-[3px] 9×9 dot inside a left-[7px] rail, with a 3px paper halo.
// The dot keeps its 9px diameter; the halo is a 15px (9 + 2×3) canvas circle behind it. The rail sits
// at the dot's centre so it reads as passing behind each node.
const DOT = 9;
const HALO = DOT + 6; // 9 + 2×3px ring
const RAIL_X = 7; // web rail left offset
const DOT_X = 3; // web dot left offset

// ---------------------------------------------------------------------------
// The calm projection — a Transaction → timeline row
// ---------------------------------------------------------------------------

// The verbs the web showed, in the web's exact wording. Only "Added" / "Edited" are derivable from the
// current Transaction shape; the rest are `// @rn-engine timeline-verbs` (sub-pause + Review-decision
// events the engine does not yet emit). The tone of each marker dot is keyed by verb.
type Verb = 'Added' | 'Left for later' | 'Ignored' | 'Edited' | 'Paused';

type TimelineRow = {
  id: string;
  when: string;
  verb: Verb;
  what: string;
  note?: string | undefined;
  category?: string | undefined;
};

// Verb → marker-dot colour. Mirrors the web verbTone map (--positive / --muted-ink / --accent /
// --caution) onto the kit palette.
function verbTone(verb: Verb, t: Palette): string {
  switch (verb) {
    case 'Added':
      return t.positive;
    case 'Edited':
      return t.calm; // web --accent
    case 'Paused':
      return t.caution;
    case 'Left for later':
    case 'Ignored':
    default:
      return t.muted; // web --muted-ink
  }
}

// The store category enum → the human label shown on the chip. The web chip used title-case category
// names (Groceries / Transport / …); the same plain words map from the persisted enum. A spend with no
// resolved category falls through to the web's "Add a label" chip fallback.
const CATEGORY_LABEL: Readonly<Record<Transaction['category'], string>> = {
  food: 'Groceries',
  transport: 'Transport',
  bills: 'Bills',
  fun: 'Eating out',
  shopping: 'Shopping',
  income: 'Income',
  other: 'Other',
};

// Relative `when` label — Today · 9:14 / Yesterday / Mon 23 Jun. Mirrors the web demo's whens, computed
// from the real ISO timestamp. Calendar-day difference, not 24h windows, so a 9pm spend and a 6am one
// both read "Today".
function relativeWhen(iso: string, now: Date): string {
  const then = new Date(iso);
  const startOf = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 86_400_000;
  const days = Math.round((startOf(now) - startOf(then)) / dayMs);

  if (days <= 0) {
    const hh = then.getHours();
    const mm = then.getMinutes().toString().padStart(2, '0');
    return `Today · ${hh}:${mm}`;
  }
  if (days === 1) return 'Yesterday';
  // e.g. "Mon 23 Jun" — en-GB weekday + day + short month, matching the web demo whens.
  return then.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// The calm money + cadence note. Income reads "+ £x", spend reads "£x". The category word is appended
// the way the web demo did ("£42 · groceries") — lower-cased, calm, no banned vocabulary.
function noteFor(txn: Transaction): string | undefined {
  const amount = Math.abs(txn.amount);
  if (!(amount > 0)) return undefined;
  const money = `£${amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  const word = CATEGORY_LABEL[txn.category]?.toLowerCase();
  if (txn.amount > 0) return word ? `${money} · ${word}` : money;
  return word ? `${money} · ${word}` : money;
}

// Transaction → row. `verb`: a Melo-logged spend reads "Edited" (you nudged it), everything else reads
// "Added". `// @rn-engine timeline-verbs` — the Paused / Ignored / Left-for-later verbs need the
// sub-pause + Review-decision feed that is not built yet, so they never appear until it lands.
function toRow(txn: Transaction, now: Date): TimelineRow {
  const verb: Verb = txn.source === 'melo' ? 'Edited' : 'Added';
  return {
    id: txn.id,
    when: relativeWhen(txn.when, now),
    verb,
    what: txn.merchant,
    note: noteFor(txn),
    category: CATEGORY_LABEL[txn.category],
  };
}

// ---------------------------------------------------------------------------
// Reduced motion (final state) — read once, then subscribe. Mirrors Melo.tsx / Insights exactly.
// ---------------------------------------------------------------------------

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

// ---------------------------------------------------------------------------
// STATES — the five branches the spec requires
// ---------------------------------------------------------------------------

// 'populated' (the only designed layout) · 'loading' (Melo curious + line, never a spinner) ·
// 'empty' ("Your story starts here") · 'error' (no in-screen UI — fall back to More) · 'offline'
// (identical to populated — Folio is local-first). Defaults to 'populated'.
type ScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type TimelineScreenProps = {
  nav: Nav;
  state?: ScreenState;
};

export function TimelineScreen({ nav, state = 'populated' }: TimelineScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const s = useMemo(() => makeStyles(t), [t]);

  // The REAL store feed — newest first (the store keeps `transactions` newest-first, capped at 200).
  const transactions = useAppStore((st) => st.transactions);

  // Project once per change. `now` is captured per render so the relative whens stay live without a
  // ticking timer (this is a read projection, not a clock).
  const rows = useMemo(() => {
    const now = new Date();
    return transactions.map((txn) => toRow(txn, now));
  }, [transactions]);

  // error → "falls back": this screen invents no error UI; on failure it routes back to More.
  const fallsBack = state === 'error';
  useEffect(() => {
    if (fallsBack) nav.go('more');
  }, [fallsBack, nav]);

  // slide-in-r — drives every branch. Resolves to final state under reduce-motion.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * SLIDE_FROM_X }],
  }));

  // ----- ERROR (falls back to More) --------------------------------------------------------------
  if (fallsBack) return null;

  // ----- LOADING (Melo curious + one quoted line — never a spinner) -------------------------------
  if (state === 'loading') {
    return (
      <Animated.View style={[s.root, enterStyle]}>
        <View style={[s.screen, { paddingTop: insets.top + gap.md }]}>
          <Header nav={nav} styles={s} palette={t} />
          <View style={s.loadingBlock}>
            <MeloLine mood="curious" text="Gathering what you've added…" />
          </View>
        </View>
      </Animated.View>
    );
  }

  // ----- EMPTY (no transactions, or the explicit empty state) ------------------------------------
  if (state === 'empty' || rows.length === 0) {
    return (
      <Animated.View style={[s.root, enterStyle]}>
        <View style={[s.screen, { paddingTop: insets.top + gap.md }]}>
          <Header nav={nav} styles={s} palette={t} />

          <View style={s.titleBlock}>
            <Text accessibilityRole="header" style={s.headline}>
              {"Everything you've "}
              <Text style={s.headlineAccent}>added</Text>
              {' or skipped.'}
            </Text>
            <Text style={s.subhead}>Newest first. Nothing is hidden.</Text>
          </View>

          <View style={s.emptyBlock}>
            {/* STATES.md empty copy — a calm doorway, not an error. One accent word ("here"). */}
            <EmptyState
              mood="calm"
              headline="Your story starts here"
              body="The things you add or leave for later will show up here, newest first."
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // ----- POPULATED (and offline — identical) -----------------------------------------------------
  return (
    <Animated.View style={[s.root, enterStyle]}>
      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + gap.md, paddingBottom: insets.bottom + gap.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Header nav={nav} styles={s} palette={t} />

        {/* Title block — Fraunces 28px, the single upright terracotta accent word. */}
        <View style={s.titleBlock}>
          <Text accessibilityRole="header" style={s.headline}>
            {"Everything you've "}
            <Text style={s.headlineAccent}>added</Text>
            {' or skipped.'}
          </Text>
          <Text style={s.subhead}>Newest first. Nothing is hidden.</Text>
        </View>

        {/* Timeline list — a vertical rail behind the nodes, newest first. */}
        <View style={s.list}>
          <View style={[s.rail, { backgroundColor: t.hairline }]} pointerEvents="none" />
          {rows.map((row, i) => (
            <TimelineRowView
              key={row.id}
              row={row}
              styles={s}
              palette={t}
              isLast={i === rows.length - 1}
              nav={nav}
            />
          ))}
        </View>

        {/* The quiet companion line — soft (calm-family) Melo, always-on breathe. */}
        <View style={s.meloBlock}>
          <MeloLine mood="calm" text="You can undo any of these. Nothing is locked." />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Header — back arrow / centred eyebrow / equal-width spacer (keeps the eyebrow optically centred)
// ---------------------------------------------------------------------------

function Header({ nav, styles, palette }: { nav: Nav; styles: Styles; palette: Palette }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={nav.back}
        hitSlop={10}
        style={({ pressed: p }) => [styles.backHit, p ? styles.pressed : undefined]}
      >
        <Text style={[styles.backArrow, { color: palette.muted }]}>{'←'}</Text>
      </Pressable>
      <Text style={[styles.eyebrow, { color: palette.muted }]}>Timeline</Text>
      {/* Equal-width spacer (web w-5) so the eyebrow stays centred against the back arrow. */}
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// A single timeline row — when / verb+what / optional note / category chip + marker node
// ---------------------------------------------------------------------------

function TimelineRowView({
  row,
  styles,
  palette,
  isLast,
  nav,
}: {
  row: TimelineRow;
  styles: Styles;
  palette: Palette;
  isLast: boolean;
  nav: Nav;
}) {
  const tone = verbTone(row.verb, palette);
  const hasCategory = !!row.category;
  const chipLabel = row.category ?? 'Add a label';

  // Tappable row — opens the edit sheet for THIS transaction: nav.openSheet('edit-txn', { id }). The
  // shell threads the id into <EditTxnSheet target={id}>, so Save corrects this exact row via the
  // store's editTransaction (replace-in-place + one immutable correction record, ENGINES §6 D4). The
  // row is one button; a screen reader announces the entry and that it opens for correction.
  const a11yLabel = `${row.verb} ${row.what}${row.note !== undefined ? `, ${row.note}` : ''}, ${
    hasCategory ? row.category : 'uncategorised'
  }, ${row.when}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens this entry so you can correct it"
      onPress={() => nav.openSheet('edit-txn', { id: row.id })}
      style={({ pressed }) => [
        styles.row,
        isLast ? undefined : styles.rowGap,
        pressed ? styles.pressed : undefined,
      ]}
    >
      {/* Marker node — a verb-toned dot inside a canvas (paper) halo, so the rail reads behind it. */}
      <View style={styles.markerSlot} pointerEvents="none">
        <View style={[styles.halo, { backgroundColor: palette.canvas }]}>
          <View style={[styles.dot, { backgroundColor: tone }]} />
        </View>
      </View>

      {/* Row body — a read-only log line (the web body is not interactive). */}
      <View style={styles.rowBody}>
        <Text style={[styles.when, { color: palette.muted }]}>{row.when}</Text>
        <Text style={styles.whatLine}>
          <Text style={[styles.verb, { color: palette.muted }]}>{`${row.verb} `}</Text>
          <Text style={[styles.what, { color: palette.ink }]}>{row.what}</Text>
        </Text>
        {row.note !== undefined ? (
          <Text style={[styles.note, { color: palette.muted }]}>{row.note}</Text>
        ) : null}

        {/* Category chip — a read-only label reflecting the persisted category (the web cycler was a
            local-state bug not replicated). Tapping the ROW opens the edit sheet (the Note is editable
            there); the chip itself stays a label — `// @rn-engine category-edit` marks where an
            in-place re-categorise would write once EditTxnSheet makes the category row editable. */}
        <View
          style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
        >
          <View
            style={[
              styles.chipDot,
              { backgroundColor: hasCategory ? palette.calm : palette.hairline },
            ]}
          />
          <Text style={[styles.chipText, { color: palette.muted }]}>{chipLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour goes through makeStyles(t); layout/typography stay static
// ---------------------------------------------------------------------------

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(_t: Palette) {
  return StyleSheet.create({
    root: { flex: 1 },

    // Non-scrolling branches (loading / empty) reuse the same column padding as the scroll content.
    screen: {
      flex: 1,
      paddingHorizontal: SCREEN_INSET,
    },
    scrollContent: {
      paddingHorizontal: SCREEN_INSET,
    },

    // Header — back / centred eyebrow / spacer (web flex items-center justify-between, pt-4).
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backHit: {
      minWidth: 20,
    },
    backArrow: {
      fontSize: 20,
    },
    eyebrow: {
      fontSize: 12,
      letterSpacing: 1.68, // web tracking 0.14em at 12px
      textTransform: 'uppercase',
    },
    headerSpacer: {
      width: 20, // web w-5
    },

    // Title block — mt-6.
    titleBlock: {
      marginTop: gap.xl,
    },
    headline: {
      // BUG FIX: no `color` was set → RN defaulted to black, invisible on the dark canvas (the
      // dark-mode "text blends with the brown" the owner saw in Timeline). Light mode happened to look
      // fine because black-on-cream reads. Bind to the theme ink so it's correct in both modes.
      color: _t.ink,
      fontFamily: serif.display,
      fontSize: 28,
      lineHeight: 32, // leading-tight
      letterSpacing: -0.56, // Fraunces -0.02em at 28px
    },
    headlineAccent: {
      // Upright terracotta — the web <em class="not-italic text-accent">. NOT italic.
      fontFamily: serif.display,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: -0.56,
      color: _t.calm,
    },
    subhead: {
      // Same missing-color bug as the headline above — defaulted to black, invisible on dark canvas.
      color: _t.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: gap.sm,
    },

    // Loading branch — the calm "working it out" affordance, centred-ish under the header.
    loadingBlock: {
      marginTop: gap.xxl,
    },

    // Empty branch — the EmptyState column sits below the same title block.
    emptyBlock: {
      marginTop: gap.xl,
    },

    // Timeline list — mt-6, the rail lives behind the rows.
    list: {
      marginTop: gap.xl,
      position: 'relative',
    },
    // Vertical rail — 1px line inset top..bottom, BEHIND the nodes. Sits at the dot's centre column.
    rail: {
      position: 'absolute',
      left: RAIL_X,
      top: gap.sm,
      bottom: gap.sm,
      width: 1,
    },

    // Row — the marker slot + the body sit side by side; the body is inset like the web pl-7.
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    rowGap: {
      marginBottom: gap.xl, // web space-y-5 (20px) — applied as bottom margin except on the last row
    },
    // Fixed-width gutter that centres the marker node over the rail; the dot's left edge matches the
    // web left-[3px] within the left-[7px] rail column.
    markerSlot: {
      width: SCREEN_INSET, // web pl-7 — the body starts at 28px, the node lives in this gutter
      alignItems: 'flex-start',
    },
    halo: {
      position: 'absolute',
      left: DOT_X - (HALO - DOT) / 2, // centre the 15px halo on the 9px dot's column
      top: 6 - (HALO - DOT) / 2, // web dot top-[6px], halo centred on it
      width: HALO,
      height: HALO,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      width: DOT,
      height: DOT,
      borderRadius: radius.pill,
    },

    rowBody: {
      flex: 1,
    },
    when: {
      fontSize: 10.5,
      letterSpacing: 1.47, // web tracking 0.14em at 10.5px
      textTransform: 'uppercase',
    },
    whatLine: {
      fontSize: 14,
      marginTop: 2, // web mt-0.5
    },
    verb: {
      fontSize: 14,
    },
    what: {
      fontSize: 14,
      fontWeight: '500', // web font-medium
    },
    note: {
      fontSize: 12,
      marginTop: 2, // web mt-0.5
    },

    // Category chip — pill, hairline border, surface fill, dot + label (web rounded-full px-2 py-0.5).
    chip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: gap.xs,
      marginTop: 6, // web mt-1.5
      paddingHorizontal: gap.sm,
      paddingVertical: 2, // web py-0.5
      borderRadius: radius.pill,
      borderWidth: 1, // web hairline utility = 1px (not StyleSheet.hairlineWidth)
    },
    chipDot: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
    },
    chipText: {
      fontSize: 10.5,
    },

    // Bottom Melo line — mt-6 mb-8 in the web; the scroll content's bottom padding covers mb-8.
    meloBlock: {
      marginTop: gap.xl,
    },

    pressed: {
      opacity: 0.88,
      transform: [{ scale: 0.97 }],
    },
  });
}

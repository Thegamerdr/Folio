// RouteDetailSheet — the faithful 1:1 React Native port of the web money-path point sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetRouteDetail.tsx).
//
// @rn-sheet     RouteDetailSheet
// @purpose      Detail for a point on the money path — what's left after a bill day, what's counted,
//               what's waiting. Opened when a point on the path-to-payday (Today / Visualizer) is
//               tapped. Read-only; its one action bridges the user to that day on the Calendar.
// @reads        pressure (mood line + the "Left after this" figure) + the tapped point (its date,
//               bills, pots). The web Nav carried `pressure`; RN's Nav does not, so `pressure`
//               arrives as a prop (the shell already threads a pressure default to its screens).
// @writes       calendarFocusDate (via setCalendarFocusDate) — the ephemeral Route→Calendar bridge
//               ScreenCalendar consumes-once-and-clears. No money-data mutation (the web @writes was
//               "—"); the design's preview-then-commit rule means this read-only sheet never silently
//               mutates the path.
// @copy         FROZEN — verbatim from the web source. These strings are not yet in COPY_DECK, so the
//               literals live here as the frozen source ('@/folio/copy/copy' carries only the £ glyph
//               this sheet needs); per the COPY_DECK rule "if a string isn't here it doesn't ship",
//               RN must promote eyebrow / headline / labels / Melo line / CTA keys before shipping.
// @tokens       --paper (→ surface, the sheet body, via Sheet) · --surface (→ surface, the inner
//               detail card — paper-on-paper is intentional) · --accent (→ calm, pot dot + primary
//               CTA) · --positive (→ positive, available via Money tone) · --hairline (→ hairline,
//               card border + pots divider) · --negative (→ repair, bill dot + counted/pots Money) ·
//               --muted-ink (→ muted, eyebrow / labels / close / secondary CTA / dates) · --ink (→ ink)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on the ×, primary CTA, and
//               secondary CTA · Melo idle breathe + blink + mood-pulse (always-on, internal to Melo).
//               Money is STATIC here — NO count-up (MOTION.md: money never slides, and this sheet
//               doesn't animate figures). Everything collapses to its final state under reduce-motion.
// @moods        Melo mood = canonical 5 only. Pressure maps DIRECTLY to a mood (the web `pressureMood`
//               aliases 'soft'/'alert' are dropped per RN_PORT + the kit): safe / calm / soft → calm,
//               pressured / overspent → concern. concern is never alarming (no red / no shake).
//
// @rn-engine money-path — WIRED. The tapped point (which day, its real "left after this" balance, the
//   bills landing on it) now comes from the real route. `useRoute(now)` (the shared store→money-path
//   bridge, @/folio/lib/storeRoute) computes the curve once per day today→payday; the tapped ISO is
//   located in `route.points`, and that sample's `y` IS the "Left after this" balance (no synthetic
//   pressureLow). The day's bills are derived from the SAME store slices the route consumes (subs
//   renewing that ISO + transactions landing that ISO), using the exact date math routeFromStore uses,
//   so the list never drifts from the curve. Pressure (and therefore the Melo mood) is DERIVED from
//   that balance via the band thresholds, instead of being taken as a fixed prop. The `point` prop
//   still overrides everything when an explicit RoutePoint is passed (and `pressure` still seeds the
//   mount-gate frame + the no-tapped-date fallback), so callers that supply a point stay faithful.
//
// Faithful 1:1 RN port. The web source renders ONE happy-path branch (populated) plus the activePots
// conditional. STATES.md covers SCREENS, not sheets, but the spec asks every state to be addressed:
//   • populated — eyebrow + headline + detail card (Left-after / Bills-counted summary, bills list,
//                 optional pots block) + Melo line + two CTAs. The web's only branch.
//   • activePots conditional — the "Pots · saved each Friday" divider + per-pot rows render only when
//                 there ARE active pots; bills-only card otherwise.
//   • empty — a point with no bills AND no active pots: a calm "nothing counted on this day" doorway
//             (EmptyState, Melo calm), never an error. Empty ≠ broken.
//   • loading — Melo CURIOUS + the quiet line, never a spinner (MOTION/STATES: Folio doesn't spin).
//   • error / offline — N/A; this is a synchronous local read with no fetch (offline == populated).
//
// Design-system discipline: every colour / font / spacing / radius token comes from '@/folio/theme'
// (which re-exports the pressure-map kit). Nothing new is defined — no colour, font, spacing, or
// dependency. The web '×' close glyph is drawn inline with react-native-svg (no icon font ships).
// Money is rendered through a small <Money> matching the web kit's size + tone maps (Fraunces +
// tabular figures); the U+2212 '−' minus glyph from the web literals is preserved verbatim (never
// ASCII '-'). This sheet OWNS its Sheet host (visible / onClose), mounted as a sibling in the shell,
// mirroring AddEventSheet / EditItemSheet / LogSpendSheet.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import {
  bankAnalyticsTransactions,
  setCalendarFocusDate,
  useAppStore,
  type AppState,
  type Pot,
  type PotCadence,
} from '@/folio/store';
import { ROUTE_MOUNT_SENTINEL, useRoute } from '@/folio/lib/storeRoute';
import { type Nav, type Pressure } from '@/folio/types';
import { Melo, type MeloMood } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import type { MoneyMode } from '@/folio/lib/modes/types';

// ---------------------------------------------------------------------------
// Mode-tinted framing for the low-point moment (web `ROUTE_DETAIL_COPY`,
// lib/modes/action.ts sibling table inlined in the web sheet itself). Same
// numbers, different meaning per mode — Growth reads the dip as "pace
// continues", Debt as "repayment day", Optimizer as "the leak day", etc.
// Kept verbatim; only the synthetic "1 Jul" date literal is replaced with the
// REAL tapped point's dateLabel (RN already derives that from the route).
// ---------------------------------------------------------------------------

type RouteDetailCopy = { eyebrowLabel: string; title: string; melo: string };

const ROUTE_DETAIL_COPY: Record<MoneyMode, RouteDetailCopy> = {
  survival: {
    eyebrowLabel: "What's happening",
    title: 'Set aside for bills',
    melo: 'The lowest balance comes just after the bills go out.',
  },
  stability: {
    eyebrowLabel: 'Bill day',
    title: 'The dip · buffer holds',
    melo: 'The shape dips here, then recovers. Nothing to steer.',
  },
  growth: {
    eyebrowLabel: 'Bill day',
    title: 'Pace continues past this',
    melo: 'The bills clear and the save resumes on Friday.',
  },
  debt: {
    eyebrowLabel: 'Repayment day',
    title: "The plan's payment lands",
    melo: 'This is the payment that keeps the run alive.',
  },
  optimizer: {
    eyebrowLabel: 'Leak day',
    title: 'Where the subs go out',
    melo: 'Two of these you rarely open. Worth a trim next cycle.',
  },
  reset: {
    eyebrowLabel: 'The tight day',
    title: 'One thing to hold',
    melo: 'Just this day to get through. Then we breathe.',
  },
  irregular: {
    eyebrowLabel: 'Bill day',
    title: 'The runway dips here',
    melo: 'This week of runway is the one to protect.',
  },
  household: {
    eyebrowLabel: 'Shared bills',
    title: 'Your share of the day',
    melo: 'Your half lands here. The household stays square.',
  },
  planning: {
    eyebrowLabel: 'Bill day',
    title: 'The goal date holds',
    melo: "Even after this, the goal date doesn't move.",
  },
  lowVis: {
    eyebrowLabel: 'Around this day',
    title: "Something's going out",
    melo: "There's a dip near here. The picture will sharpen next cycle.",
  },
};

// ---------------------------------------------------------------------------
// Pressure tables — verbatim from the web source (components/folio/types.ts).
//
// `pressureLow` is the per-band low-point figure. It now serves two roles: (1) the pre-engine
// fallback for "Left after this" on the single mount-gate frame / when there's no real route yet,
// and (2) the BAND THRESHOLDS used to derive a `Pressure` from the real "left after this" balance
// (each entry is that band's representative low point, safest→tightest). `pressureMood` maps a
// pressure to the CANONICAL Melo mood (the web's 'soft'/'alert' aliases are dropped —
// pressured/overspent → concern), per the spec's @moods rule.
// ---------------------------------------------------------------------------

const pressureLow: Record<Pressure, number> = {
  safe: 612,
  calm: 325,
  soft: 184,
  pressured: 42,
  overspent: -86,
};

// Band order, safest → tightest. A real "left after this" balance is bucketed by the pressureLow
// boundaries above: at/above a band's figure (and below the next-safer one) puts you in that band.
// This keeps the mood honest to the real curve without inventing a new threshold token.
const PRESSURE_BANDS: readonly Pressure[] = ['safe', 'calm', 'soft', 'pressured', 'overspent'];

/** Derive the route pressure band from a real "left after this" balance, using the `pressureLow`
 *  figures as band floors (safest band whose floor the balance still clears wins). A balance below
 *  every floor falls through to the tightest band ('overspent'). */
function pressureForBalance(balance: number): Pressure {
  for (const band of PRESSURE_BANDS) {
    if (balance >= pressureLow[band]) return band;
  }
  return 'overspent';
}

// Pressure → canonical Melo mood. safe / calm / soft sit calm; pressured / overspent move to concern
// (breathe-slow + worry-bead, never red / shake). No 'soft'/'alert' aliases reach RN.
const pressureMood: Record<Pressure, MeloMood> = {
  safe: 'calm',
  calm: 'calm',
  soft: 'calm',
  pressured: 'concern',
  overspent: 'concern',
};

// The frozen Melo line for this point (web literal). Quotes are added by <MeloLine> (its own rule:
// one thought per line, double-quoted), so the raw thought is passed without surrounding quotes.
const MELO_LINE = 'The lowest balance comes just after the bills go out.';

// ---------------------------------------------------------------------------
// Store → tapped-point derivation. The money-path engine returns one `{ date, y }` sample per day
// (it carries no per-day event breakdown), so the sheet pairs the route's per-day BALANCE with the
// per-day EVENTS read straight from the store — using the EXACT date math `routeFromStore` uses to
// place those events on the curve, so the list and the "Left after this" figure never disagree.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A Date → local-calendar ISO day "YYYY-MM-DD" (same local-parts convention as storeRoute). */
function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** A Date shifted by whole days on the local clock (mirrors storeRoute's `addDays`). */
function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * DAY_MS);
}

/** An ISO "YYYY-MM-DD" → the short "1 Jul" label the eyebrow + rows use. Parsed at local midnight to
 *  match the rest of the surface (no timezone-offset day slip). */
function shortLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()] ?? ''}`.trim();
}

/** The bills landing on `iso` — active (non-paused) subs whose nudged renewal falls on that day, plus
 *  any logged spend dated that day. Sign + filters mirror `routeFromStore` exactly: paused subs are
 *  skipped, the stored day-nudge (`subOverrides`) is applied, and a transaction is a bill only when it
 *  is spend (stored `amount < 0`, surfaced as a positive magnitude). Income/refunds are not bills. */
function billsForIso(state: AppState, now: Date, iso: string): RouteBill[] {
  const subBills: RouteBill[] = state.subs
    .filter((s) => !state.subPaused[s.name])
    .map((s) => {
      const when = addDays(now, s.nextRenewalDaysAway + (state.subOverrides[s.name] ?? 0));
      return { name: s.name, date: toIsoDay(when), amount: s.cost };
    })
    .filter((b) => b.date === iso)
    .map((b) => ({ name: b.name, date: shortLabel(b.date), amount: b.amount }));

  const spendBills: RouteBill[] = bankAnalyticsTransactions(state)
    .filter((tx) => tx.amount < 0 && toIsoDay(new Date(tx.when)) === iso)
    .map((tx) => ({ name: tx.merchant, date: shortLabel(iso), amount: -tx.amount }));

  return [...subBills, ...spendBills];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** One bill landing on / near the tapped point. `amount` is the magnitude (positive £); the '−£'
 *  minus glyph is added at render so it matches the web literals and the formatter. */
export type RouteBill = {
  name: string;
  /** Short day label, e.g. "1 Jul". */
  date: string;
  amount: number;
};

/** The tapped point on the money path. @rn-engine money-path supplies this; until then the sheet
 *  falls back to the web PLACEHOLDER_POINT so the design state still renders. */
export type RoutePoint = {
  /** ISO YYYY-MM-DD — the day this point stands for (bridged to the Calendar). */
  iso: string;
  /** Short label shown in the eyebrow, e.g. "1 Jul". */
  dateLabel: string;
  /** The bills counted at / around this point. */
  bills: RouteBill[];
};

export type RouteDetailSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The shell's nav — `nav.go('calendar')` bridges to the Calendar after the sheet closes. */
  nav: Nav;
  /** The tapped point. When supplied (a caller that already knows which day was tapped) it wins; its
   *  "Left after this" balance is read from the real route sample at `point.iso`. When omitted, the
   *  sheet anchors on the real route's tight point (the lowest-balance day) and derives the day's
   *  bills from the store — so the populated branch is live, not a placeholder. */
  point?: RoutePoint | undefined;
  /** Seed pressure for the single mount-gate frame + the no-route fallback. On a normal open the
   *  band is DERIVED from the real "Left after this" balance (and that derived band drives the Melo
   *  mood); this prop only colours the pre-engine frame. The web read this off `nav.pressure`; RN's
   *  Nav has no pressure, so the shell threads it as a prop (defaults to calm). */
  pressure?: Pressure | undefined;
  /** When true, render the quiet loading state (Melo curious + the line) instead of the point. Never
   *  a spinner. Defaults to false — the local read is synchronous, so this is only for a future
   *  engine that resolves the point asynchronously. */
  loading?: boolean | undefined;
};

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed; mirrors AddEventSheet / Melo)
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
// Pot cadence wording — derive the per-pot + section label from pot.cadence.
//
// The web hardcoded "Friday" and "saved each Friday". RN derives the real wording: per ENGINES §6 D5 a
// new pot defaults to `after-payday`, and an unmigrated (cadence-less) pot is treated as `after-payday`
// too — matching deriveCalendarEvents, which resolves a missing cadence as { kind: 'after-payday' }.
// No "Friday" is hardcoded anywhere a pot top-up is labelled or scheduled.
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Per-pot cadence label, e.g. "After payday" / "Tuesday" / "12th". A cadence-less (unmigrated) pot
 *  defaults to "After payday" — matching deriveCalendarEvents, which resolves a missing cadence as
 *  { kind: 'after-payday' } (ENGINES §6 D5). No hardcoded "Friday" anywhere a top-up is scheduled. */
function cadenceLabel(cadence: PotCadence | undefined): string {
  if (!cadence) return 'After payday'; // matches the engine's `cadence ?? { kind: 'after-payday' }`
  switch (cadence.kind) {
    case 'after-payday':
      return 'After payday';
    case 'weekly':
      return WEEKDAY_LABELS[cadence.weekday] ?? 'After payday';
    case 'monthly':
      return ordinal(cadence.dayOfMonth);
    case 'custom':
      return 'Custom';
  }
}

/** The pots-section header suffix. When every active pot shares one cadence, name it ("saved each
 *  Friday"); when they differ, stay general ("set aside"). Replaces the web's blanket "each Friday". */
function potsSectionSuffix(pots: Pot[]): string {
  if (pots.length === 0) return 'set aside';
  const first = cadenceLabel(pots[0]?.cadence);
  const allSame = pots.every((p) => cadenceLabel(p.cadence) === first);
  if (!allSame) return 'set aside';
  if (first === 'After payday') return 'saved after payday';
  if (first === 'Custom') return 'set aside';
  // Weekday or day-of-month → "saved each Friday" / "saved each 12th".
  return `saved each ${first}`;
}

// ---------------------------------------------------------------------------
// Money formatting — the web `formatGBP` (kit.tsx), verbatim. Keeps the U+2212 minus glyph and the
// en-GB whole-pound grouping so there's no formatting drift with the web source.
// ---------------------------------------------------------------------------

function formatGBP(n: number): string {
  const sign = n < 0 ? '−' : ''; // U+2212, not ASCII '-'
  return `${sign}${copy.global.currency.symbol}${Math.abs(n).toLocaleString('en-GB', {
    maximumFractionDigits: 0,
  })}`;
}

// ---------------------------------------------------------------------------
// RouteDetailSheet — owns its Sheet host.
// ---------------------------------------------------------------------------

export function RouteDetailSheet({
  visible,
  onClose,
  nav,
  point,
  pressure = 'calm',
  loading = false,
}: RouteDetailSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <RouteDetailBody
        styles={s}
        palette={t}
        onClose={onClose}
        nav={nav}
        point={point}
        pressure={pressure}
        loading={loading}
      />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Body — picks the state branch (loading → empty → populated).
// ---------------------------------------------------------------------------

// A stable sentinel "now" for the single render before the mount-gate opens. `useRoute` can't be
// called conditionally, so it runs against this until `now` is set; that frame's route is discarded
// (`route = null`) and the sheet keeps the per-pressure sample. Module-level so its identity never
// churns the hook's memo. Mirrors TodayScreen's mount-gate pattern.
const EPOCH = ROUTE_MOUNT_SENTINEL;

function RouteDetailBody({
  styles: s,
  palette: t,
  onClose,
  nav,
  point,
  pressure,
  loading,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
  nav: Nav;
  point: RoutePoint | undefined;
  pressure: Pressure;
  loading: boolean;
}) {
  // --- Hooks first (rules-of-hooks): all unconditional, before any state-branch early return. ---

  // Active pots = those that contribute (perWeek > 0), matching the web predicate. The spec flags
  // that with the real cadence model perWeek may be 0 for non-weekly pots; that is the money-path
  // engine's call, so the read-only sheet keeps the web predicate to stay faithful.
  const pots = useAppStore((store) => store.pots);
  const activePots = useMemo(() => pots.filter((p) => p.perWeek > 0), [pots]);

  // Mode-tinted framing (BREAKS-PARITY fix) — same low-point moment, different meaning per Money
  // Mode. Falls back to survival's copy for an unrecognised mode (matches the web's `?? ROUTE_DETAIL_COPY.survival`).
  const moneyMode = useAppStore((store) => store.moneyMode ?? 'survival');
  const modeCopy = ROUTE_DETAIL_COPY[moneyMode] ?? ROUTE_DETAIL_COPY.survival;

  // The full state — read once so the per-day bills derive from the SAME slices the route consumes.
  const state = useAppStore((store) => store);

  // Mount-gate: defer `new Date()` so the route has an honest "today" and the first frame doesn't read
  // the clock during render (mirrors TodayScreen). Until it opens, the route is discarded.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // @rn-engine money-path — the real curve. `useRoute` maps the live store onto `computeRoute`; it
  // can't be called conditionally, so it always runs against `now ?? EPOCH` and we discard the
  // pre-mount frame. The tapped point's day → its `{ date, y }` sample lives in `route.points`.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  // Resolve the tapped point + its real "left after this" balance + the band derived from it.
  //   • An explicit `point` prop always wins (engine/caller-supplied) — faithful for those callers.
  //     Its balance comes from the route sample at that ISO when available, else the pressure sample.
  //   • With no `point`, anchor on the route's real tight point (the lowest-balance day this sheet is
  //     about); the day's bills come from the store at that ISO. Its `y` IS "left after this".
  //   • Before the mount-gate opens (no route), fall back to the web placeholder + pressureLow sample
  //     for that one frame, so a normal open never flashes a different figure.
  const resolved = useMemo(() => {
    const sampleAt = (iso: string): number | undefined =>
      route?.points.find((p) => p.date === iso)?.y;

    if (point) {
      const balance = sampleAt(point.iso) ?? pressureLow[pressure];
      return { point, leftAfter: balance, band: pressureForBalance(balance) };
    }
    if (route && now) {
      const iso = route.tightPoint.date;
      const balance = sampleAt(iso) ?? route.tightPoint.amount;
      const derivedPoint: RoutePoint = {
        iso,
        dateLabel: shortLabel(iso),
        bills: billsForIso(state, now, iso),
      };
      return { point: derivedPoint, leftAfter: balance, band: pressureForBalance(balance) };
    }
    // Pre-engine frame (route not yet resolved): a neutral EMPTY point — NEVER the fake Octopus /
    // Council Tax / Rent bills. The real route + its real bills replace this on the very next frame.
    return {
      point: { iso: '', dateLabel: '', bills: [] } as RoutePoint,
      leftAfter: pressureLow[pressure],
      band: pressure,
    };
  }, [point, route, now, state, pressure]);

  // --- State branches (after all hooks). ---

  // LOADING — Melo curious + the quiet line, never a spinner.
  if (loading) {
    return (
      <View style={s.loadingColumn}>
        <Melo mood="curious" grounded size={28} />
        <Text style={s.loadingLine}>{`“${MELO_LINE}”`}</Text>
      </View>
    );
  }

  // EMPTY — a point with no bills AND no active pots. A calm doorway, not an error (Empty ≠ broken).
  if (resolved.point.bills.length === 0 && activePots.length === 0) {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing counted on this day."
        body="No bills or set-asides land here. The path just keeps on its way."
      />
    );
  }

  return (
    <PopulatedDetail
      styles={s}
      palette={t}
      onClose={onClose}
      nav={nav}
      point={resolved.point}
      leftAfter={resolved.leftAfter}
      pressure={resolved.band}
      activePots={activePots}
      modeCopy={modeCopy}
    />
  );
}

// ---------------------------------------------------------------------------
// Populated — the web's happy path. Detail card + Melo line + two CTAs.
// ---------------------------------------------------------------------------

function PopulatedDetail({
  styles: s,
  palette: t,
  onClose,
  nav,
  point,
  leftAfter,
  pressure,
  activePots,
  modeCopy,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
  nav: Nav;
  point: RoutePoint;
  /** The real "left after this" balance — the route sample's `y` at the tapped day. */
  leftAfter: number;
  /** The band DERIVED from `leftAfter` (drives the Melo mood). */
  pressure: Pressure;
  activePots: Pot[];
  /** Mode-tinted eyebrow/title/Melo line for this low-point moment (BREAKS-PARITY fix). */
  modeCopy: RouteDetailCopy;
}) {
  const billsTotal = point.bills.reduce((sum, b) => sum + b.amount, 0);
  const potsTotal = activePots.reduce((sum, p) => sum + p.perWeek, 0);
  const mood = pressureMood[pressure];
  const potsSuffix = potsSectionSuffix(activePots);

  // See this day on the calendar — set the ephemeral focus bridge, close the sheet, then navigate.
  // Order matches the web seeCalendar(): setCalendarFocusDate → onClose → nav.go('calendar').
  function seeOnCalendar() {
    setCalendarFocusDate(point.iso);
    onClose();
    nav.go('calendar');
  }

  return (
    <View>
      {/* Header — eyebrow + close glyph, space-between. Eyebrow label is mode-tinted
          (BREAKS-PARITY fix); the date suffix stays the real tapped-point label. */}
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>{`${modeCopy.eyebrowLabel} · ${point.dateLabel}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [pressed ? s.pressed : undefined]}
        >
          <CloseGlyph color={t.muted} />
        </Pressable>
      </View>

      {/* Headline — NO accent word here (unlike most Folio headlines). Mode-tinted title
          (BREAKS-PARITY fix) — same low-point moment, different meaning per Money Mode. */}
      <Text accessibilityRole="header" style={s.headline}>
        {modeCopy.title}
      </Text>

      {/* Detail card — sits on --surface inside the paper sheet (paper-on-paper, intentional). */}
      <View style={s.card}>
        {/* Summary row — Left after this / Bills counted. */}
        <View style={s.summaryRow}>
          <View>
            <Text style={s.label}>Left after this</Text>
            <Money value={formatGBP(leftAfter)} size="lg" palette={t} />
          </View>
          <View style={s.summaryRight}>
            <Text style={s.label}>Bills counted</Text>
            <Money
              value={`−${copy.global.currency.symbol}${billsTotal.toFixed(0)}`}
              size="md"
              tone="negative"
              palette={t}
            />
          </View>
        </View>

        {/* Bills list. */}
        <View style={s.list}>
          {point.bills.map((b) => (
            <View key={b.name} style={s.lineRow}>
              <View style={s.lineLeft}>
                <View style={[s.dot, { backgroundColor: t.repair }]} />
                <Text style={s.lineName}>{b.name}</Text>
                <Text style={s.lineDate}>{b.date}</Text>
              </View>
              <Money
                value={`−${copy.global.currency.symbol}${b.amount.toFixed(2)}`}
                size="sm"
                palette={t}
              />
            </View>
          ))}
        </View>

        {/* Pots — only when there are contributing pots. Top-bordered divider + per-pot rows. */}
        {activePots.length > 0 ? (
          <>
            <View style={s.potsHeader}>
              <Text style={s.label}>{`Pots · ${potsSuffix}`}</Text>
              <Money
                value={`−${copy.global.currency.symbol}${potsTotal.toFixed(0)}/wk`}
                size="sm"
                tone="negative"
                palette={t}
              />
            </View>
            <View style={s.potsList}>
              {activePots.map((p) => (
                <View key={p.id} style={s.lineRow}>
                  <View style={s.lineLeft}>
                    <View style={[s.dot, { backgroundColor: t.calm }]} />
                    <Text style={s.lineName}>{p.name}</Text>
                    <Text style={s.lineDate}>{cadenceLabel(p.cadence)}</Text>
                  </View>
                  <Money
                    value={`−${copy.global.currency.symbol}${p.perWeek.toFixed(0)}`}
                    size="sm"
                    palette={t}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>

      {/* Melo line — the companion beside one quoted thought (Fraunces italic). Mode-tinted
          (BREAKS-PARITY fix). */}
      <View style={s.meloRow}>
        <MeloLine text={modeCopy.melo} mood={mood} size={28} />
      </View>

      {/* Primary CTA — bridge to the Calendar. Terracotta, h-54, 2xl radius. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See this day on the calendar"
        onPress={seeOnCalendar}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm },
          pressed ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.accentInk }]}>See this day on the calendar</Text>
      </Pressable>

      {/* Secondary CTA — Close. The always-available refusal (one CTA per state + refusal). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={({ pressed }) => [s.secondary, pressed ? s.pressed : undefined]}
      >
        <Text style={[s.secondaryLabel, { color: t.muted }]}>Close</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Money — the web kit's <Money>, ported. Fraunces + tabular figures; size + tone maps mirrored.
// Static (no count-up): money never slides on this sheet. The web ink/positive/negative/muted/accent
// tones map to the RN palette: ink → ink, positive → positive, negative → repair (coral, data),
// muted → muted, accent → calm.
// ---------------------------------------------------------------------------

const MONEY_SIZE: Record<NonNullable<MoneyProps['size']>, number> = {
  sm: 15,
  md: 20,
  lg: 28,
  xl: 44,
};

type MoneyProps = {
  value: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | undefined;
  tone?: 'ink' | 'positive' | 'negative' | 'muted' | 'accent' | undefined;
  palette: Palette;
};

function moneyColor(t: Palette, tone: NonNullable<MoneyProps['tone']>): string {
  switch (tone) {
    case 'positive':
      return t.positive;
    case 'negative':
      return t.repair;
    case 'muted':
      return t.muted;
    case 'accent':
      return t.calm;
    case 'ink':
    default:
      return t.ink;
  }
}

function Money({ value, size = 'lg', tone = 'ink', palette: t }: MoneyProps) {
  const fontSize = MONEY_SIZE[size];
  return (
    <Text
      style={{
        color: moneyColor(t, tone),
        fontFamily: serif.medium,
        fontSize,
        fontVariant: ['tabular-nums'],
      }}
    >
      {value}
    </Text>
  );
}

// Close glyph — the web '×', drawn inline. 18×18 user space (matches AddEventSheet's CloseGlyph).
function CloseGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M4 4 L14 14 M14 4 L4 14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette (the kit makeStyles pattern).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Header row — eyebrow + close, space-between.
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    // 11px uppercase tracked eyebrow (web text-[11px] tracking-[0.14em] muted).
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    // Display headline — Fraunces 26, leading-tight, mt-2. No accent word.
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      letterSpacing: -0.3,
      lineHeight: 30,
      marginTop: gap.sm,
    },

    // Detail card — --surface on the paper sheet, hairline border, 2xl radius, p-5, mt-5.
    card: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.xl - gap.xs, // 20
      padding: gap.xl - gap.xs, // 20 (web p-5)
    },

    // Summary row — Left after / Bills counted, baseline-aligned, space-between.
    summaryRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryRight: {
      alignItems: 'flex-end',
    },

    // 11px uppercase tracked label (web tracking-[0.12em] muted).
    label: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.3,
      marginBottom: gap.xxs,
      textTransform: 'uppercase',
    },

    // Bills list — web mt-5 + space-y-3.
    list: {
      gap: gap.md,
      marginTop: gap.xl - gap.xs, // 20
    },
    // A single bill / pot row — name + date on the left, money on the right.
    lineRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    lineLeft: {
      alignItems: 'center',
      columnGap: gap.sm + gap.xxs, // ~10 (web gap-2.5)
      flexDirection: 'row',
      flexShrink: 1,
    },
    // 6px coloured dot (web w-1.5 h-1.5 rounded-full).
    dot: {
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    // The bill / pot name — 13px ink.
    lineName: {
      color: t.ink,
      fontSize: 13,
    },
    // The small date / cadence — 11.5px muted.
    lineDate: {
      color: t.muted,
      fontSize: 11.5,
    },

    // Pots header — top-bordered divider, baseline-aligned, space-between, mt-5 pt-4.
    potsHeader: {
      alignItems: 'flex-end',
      borderTopColor: t.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: gap.xl - gap.xs, // 20
      paddingTop: gap.lg, // 16 (web pt-4)
    },
    // Pots list — web mt-3 + space-y-3.
    potsList: {
      gap: gap.md,
      marginTop: gap.md,
    },

    // Melo line — web mt-5; <MeloLine> owns its own row layout + Fraunces-italic line.
    meloRow: {
      marginTop: gap.xl - gap.xs, // 20
    },

    // Primary CTA — full width, h-54, 2xl radius, terracotta, mt-5.
    primary: {
      alignItems: 'center',
      borderRadius: radius.xxl,
      height: 54,
      justifyContent: 'center',
      marginTop: gap.xl - gap.xs, // 20
    },
    primaryLabel: {
      fontSize: 15,
      fontWeight: '500',
    },

    // Secondary CTA — full width, h-48, 2xl radius, muted text, mt-2.
    secondary: {
      alignItems: 'center',
      borderRadius: radius.xxl,
      height: 48,
      justifyContent: 'center',
      marginTop: gap.sm,
    },
    secondaryLabel: {
      fontSize: 14,
    },

    // LOADING — Melo curious + the quiet line, centred. Never a spinner.
    loadingColumn: {
      alignItems: 'center',
      gap: gap.md,
      paddingVertical: gap.xxl,
    },
    loadingLine: {
      color: t.secondary,
      fontFamily: serif.displayItalic,
      fontSize: 13.5,
      lineHeight: 18,
      paddingHorizontal: gap.xl,
      textAlign: 'center',
    },

    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}

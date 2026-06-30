/**
 * @rn-screen    SubscriptionsScreen
 * @rn-stack     MainTabs > Subs
 * @purpose      Subscription pulse — pause / cancel / used-today / ask-Melo per item.
 * @reads        subs, subPaused (+ the money-path route slices via useRoute/routeFromStore:
 *               currentBalance, onboarding, subOverrides, transactions, pots) for the tight-day lift
 * @writes       togglePaused, removeSub, markSubUsed
 * @opens-sheet  melo-chat
 * @copy         FROZEN — "still earns its place" voice.
 * @tokens       --surface --hairline --accent --positive --muted-ink
 * @motion       press · slide-in-r · subtle pulse on the "used today" tick
 *
 * Faithful 1:1 RN port of the web screen
 * (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenSubscriptions.tsx).
 * It answers one question: of everything that recurs, what still earns its place? The recurring
 * drain is the hero (a count-up monthly total, with what pauses have already saved beneath it); a
 * single quiet "pause the quiet ones" move; three sort chips reorder the list (worst value first
 * by default); each row carries a usage pulse dot + a value-score subtitle + per-row actions.
 *
 * Data is REAL — read from the store via useAppStore, written through the real mutators
 * (togglePaused / pauseMany / markSubUsed / removeSub / setSubs). The voice is FROZEN and every
 * visible string is verbatim from the design source / COPY_DECK.
 *
 * ENGINE NOTE (per the port rule "render the design state + tag // @rn-engine <name>"):
 * the web screen reads a live tight-day spare to show what pausing BUYS — "Your low point: £a → £b
 * (day)" lines and the lift inside the toasts. RN reaches the same low-point figure through the
 * shared store→money-path bridge (`@/folio/lib/storeRoute`): `useRoute(now)` gives the live route
 * (its `tightPoint` is the lowest projected balance + the day it lands on), and the pure
 * `routeFromStore(stateCopy, now)` re-routes a HYPOTHETICAL copy of the state with a sub (or the
 * quiet set) paused — never mutating the live store — so the lift is a real route DELTA. The clock
 * is mount-gated exactly as TodayScreen does (module-level `EPOCH` + a `now` state; `route` is null
 * for the one pre-mount frame), which doubles as the web's hydration guard: while `now === null`
 * the lift lines/lift-bearing toasts stay suppressed and only the engine-free feedback shows.
 * Everything that never needed the engine — the monthly/yearly totals, the savings-from-pauses
 * figure, the quiet-move £/mo + £/yr saving, the per-row pulse/score, and the plain pause/cancel
 * feedback — renders fully and faithfully throughout. The catalog/pulse/actions render is unchanged.
 *
 * FEEDBACK SURFACE: pause / pause-the-quiet-ones / cancel all surface as the EPHEMERAL Tier-1 undo
 * snackbar (useUndo / showUndo) — the RN equal of the web's sonner toast — never a blocking
 * Alert.alert. Pausing is reversible, so each pause toast's Undo resumes; cancel is kept safe by the
 * undo window itself (one-tap restore of the sub + its paused state), not by a confirm gate, exactly
 * as the design removes immediately and offers Undo.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  type AppState,
  type Sub as StoreSub,
  getState,
  markSubUsed,
  pauseMany,
  removeSub,
  setSubs,
  togglePaused,
  useAppStore,
} from '@/folio/store';
import {
  elevation,
  gap,
  type Palette,
  radius,
  serif,
  useCountUp,
  useTheme,
} from '@/folio/theme';
import { routeFromStore, useRoute } from '@/folio/lib/storeRoute';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useUndo } from '@/folio/ui/useUndo';
import { copy } from '@/folio/copy/copy';
import type { Nav } from '@/folio/types';

// "Tuesday 8" inline prose for the tight-day date — byte-faithful to the web's
// formatDayProse (lib/calendar-events). Parses at local midnight so the weekday agrees with the ISO
// day (no UTC drift), matching TodayScreen's formatter. Kept local so the date prose reads
// identically without coupling Subs to the Today wave's format module.
function formatDayProse(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${d.getDate()}`;
}

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be
// called conditionally, so it runs against this until `now` is set; the result is discarded
// (`route === null`) that frame. Module-level so its identity never churns the hook's memo —
// exactly the pattern TodayScreen uses.
const EPOCH = new Date(0);

// The web's tight-day spare is rounded and floored at zero (computeSpareAndTightest →
// Math.max(0, Math.round(...))). The money-path engine's `tightPoint.amount` is the same low-point
// balance; mirror the web's clamp so the figure and the "£a → £b" delta read identically.
function tightSpare(amount: number): number {
  return Math.max(0, Math.round(amount));
}

// The three orderings the web offers. "value" (worst value first) is the default, because the whole
// screen is built to surface what no longer earns its keep.
type SortKey = 'value' | 'cost' | 'next';

const SORTS: readonly { key: SortKey; label: string }[] = [
  { key: 'value', label: 'Worst value' },
  { key: 'cost', label: 'Cost' },
  { key: 'next', label: 'Next charge' },
];

// The monthly total counts up to its target via the shared useCountUp — the web's
// useCountUp(monthly, 600): easeOutCubic over 600ms, snapping to the value under reduced motion.
const COUNT_UP_MS = 600;

// Pulse derived from real usage signal — byte-for-byte the web's pulseOf().
type Pulse = 'yes' | 'maybe' | 'no';
function pulseOf(s: StoreSub): Pulse {
  if (s.usesPerMonth >= 8 || s.lastUsedDaysAgo <= 3) return 'yes';
  if (s.usesPerMonth === 0 || s.lastUsedDaysAgo > 21) return 'no';
  return 'maybe';
}

// value = pence per use. Higher is worse. Zero uses → Infinity sentinel (worst value floats up).
function valueScore(s: StoreSub): number {
  return s.usesPerMonth === 0 ? Infinity : (s.cost * 100) / s.usesPerMonth;
}

// Pulse dot colour. yes = the calm green; maybe = caution gold DATA mark (t.caution, never the text
// gold); no = a muted ink at reduced strength (the web's negative @ 70% opacity → a faint repair
// coral). Mirrors the web's positive / caution / negative-at-70%.
function pulseColor(t: Palette, p: Pulse): string {
  if (p === 'yes') return t.positive;
  if (p === 'maybe') return t.caution;
  return t.repair;
}

function pulseLabel(p: Pulse): string {
  if (p === 'yes') return 'Used recently';
  if (p === 'maybe') return 'Not sure';
  return 'Quiet a while';
}

// "{p}p per use · {n}/mo", or "no uses this month" when it has fallen silent — verbatim web format.
function formatScore(s: StoreSub): string {
  if (s.usesPerMonth === 0) return 'no uses this month';
  const p = Math.round(valueScore(s));
  return `${p}p per use · ${s.usesPerMonth}/mo`;
}

// next "today"/"tomorrow"/"in {n}d"/date — verbatim web formatNext.
function formatNext(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 14) return `in ${days}d`;
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Two-decimal pound figure with a leading £ — money always reads as money (tabular, £ literal,
// never "12.3K"). The web wrote `£${n.toFixed(2)}`; this is the same, kept local so every £ figure
// on the screen goes through one formatter.
function pounds(n: number): string {
  return `£${n.toFixed(2)}`;
}

function poundsWhole(n: number): string {
  return `£${n.toFixed(0)}`;
}

export function SubscriptionsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { showUndo } = useUndo();

  const subs = useAppStore((st) => st.subs);
  const paused = useAppStore((st) => st.subPaused);

  const [sort, setSort] = useState<SortKey>('value');

  const sorted = useMemo(() => {
    const arr = [...subs];
    if (sort === 'value') arr.sort((a, b) => valueScore(b) - valueScore(a));
    if (sort === 'cost') arr.sort((a, b) => b.cost - a.cost);
    if (sort === 'next') arr.sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway);
    return arr;
  }, [sort, subs]);

  // Monthly drain (active subscriptions only), and what pauses have already saved.
  const monthly = subs.reduce((acc, x) => acc + (paused[x.name] ? 0 : x.cost), 0);
  const monthlyDisplay = useCountUp(monthly, COUNT_UP_MS);
  const totalIfNoPause = subs.reduce((acc, x) => acc + x.cost, 0);
  const monthlySaved = totalIfNoPause - monthly;

  // "Quiet 3" recommendation: subs the user clearly isn't getting value from.
  const quietOnes = useMemo(
    () => subs.filter((x) => pulseOf(x) === 'no' || valueScore(x) > 200),
    [subs],
  );
  const quietSave = quietOnes.reduce((acc, x) => acc + x.cost, 0);
  const quietPaused = quietOnes.length > 0 && quietOnes.every((q) => paused[q.name]);
  const showQuietMove = quietOnes.length > 0 && !quietPaused;

  // ---- @rn-engine money-path-tight-day -------------------------------------------------------
  // The web reads a live tight-day spare here to render "Your low point: £a → £b (day)" and the
  // lift inside the pause toasts. RN reaches the same low-point figure through the shared
  // store→money-path bridge: `useRoute(now)` returns the live route whose `tightPoint` IS the
  // lowest projected balance + the day it lands on. The clock is mount-gated exactly as TodayScreen
  // does (EPOCH sentinel + a `now` state); before the gate opens `route === null`, which doubles as
  // the web's `now === null` hydration guard — the lift lines/lift-bearing toasts stay suppressed
  // for that one frame and only the engine-free feedback shows.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  // Live tight-day spare + its day. `null` until the mount-gate opens — exactly the web's
  // pre-hydration state, where the lift lines stay off until `now` is set.
  const tightWith = route
    ? { spare: tightSpare(route.tightPoint.amount), date: route.tightPoint.date }
    : null;

  // Re-route a HYPOTHETICAL COPY of the state with the given subs paused — never mutating the live
  // store. `routeFromStore` is pure ((state, now) → RouteResult), so an overlaid `subPaused` map
  // yields the low point the user WOULD see if they paused those subs. The lift is the real route
  // delta (after − before), the RN equivalent of the web's deriveCalendarEvents re-run.
  const tightIfPaused = (names: readonly string[]): { spare: number; date: string } | null => {
    if (!now) return null;
    const live = getState();
    const hypotheticalPaused: AppState['subPaused'] = { ...live.subPaused };
    for (const name of names) hypotheticalPaused[name] = true;
    const hypothetical: AppState = { ...live, subPaused: hypotheticalPaused };
    const result = routeFromStore(hypothetical, now);
    return { spare: tightSpare(result.tightPoint.amount), date: result.tightPoint.date };
  };

  // What pausing all the quiet ones BUYS — computed up front so the banner can show the lift line
  // and the press handler can show the matching toast. `null` while gated or when nothing is quiet.
  const tightIfQuietPaused = useMemo(
    () => (quietOnes.length > 0 ? tightIfPaused(quietOnes.map((q) => q.name)) : null),
    // Recompute when the gate opens or the inputs the route depends on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, quietOnes, subs, paused],
  );
  const quietLift = tightIfQuietPaused && tightWith ? tightIfQuietPaused.spare - tightWith.spare : 0;
  // -------------------------------------------------------------------------------------------

  const pauseQuietOnes = () => {
    // Measure the lift BEFORE the store write, then pause. The design surfaces the outcome as an
    // EPHEMERAL toast — sonner in the web, the Tier-1 undo snackbar here — never a blocking confirm.
    // Pausing is a reversible Tier-1 action ("pause sub" in undoPolicy), so the snackbar's Undo
    // genuinely resumes the set; capture the names so the restore reverses exactly this pause.
    const names = quietOnes.map((q) => q.name);
    const before = tightWith?.spare;
    const after = tightIfQuietPaused?.spare ?? before;
    pauseMany(names, true);
    if (typeof before === 'number' && typeof after === 'number' && after > before) {
      // The web's "Your low point goes from £a to £b" + room-around-{day} description, folded into
      // the single snackbar line (the toast carries one label, not a title/body pair).
      const room = tightIfQuietPaused?.date
        ? `more room around ${formatDayProse(tightIfQuietPaused.date)}`
        : 'more room before payday';
      showUndo(`Low point £${before} → £${after} · ${room}`, () => pauseMany(names, false));
    }
  };

  const onPauseResume = (sub: StoreSub) => {
    const isPaused = !!paused[sub.name];
    if (isPaused) {
      togglePaused(sub.name);
      return;
    }
    // Pausing — measure the tight-day lift THIS one sub buys, off a hypothetical copy, before the
    // store write. The design surfaces the outcome as an EPHEMERAL toast (sonner in the web, the
    // Tier-1 undo snackbar here), never a blocking Alert. Pausing is a reversible Tier-1 action, so
    // the snackbar's Undo resumes this sub. If the low point lifts on a known day, show the lift line
    // ("£X back on {day} · Your low point: £a → £b"); otherwise the plain "£X back this month"
    // acknowledgement the web also shows. While the mount-gate is closed (`tightWith === null`) only
    // the plain path runs.
    const before = tightWith?.spare;
    const lift = tightIfPaused([sub.name]);
    togglePaused(sub.name);
    const resume = () => togglePaused(sub.name, false);
    if (typeof before === 'number' && lift && lift.spare > before) {
      showUndo(
        `${pounds(sub.cost)} back on ${formatDayProse(lift.date)} · low point £${before} → £${lift.spare}`,
        resume,
      );
    } else {
      showUndo(`Paused ${sub.name} · ${pounds(sub.cost)} back this month`, resume);
    }
  };

  const onCancel = (sub: StoreSub) => {
    // Cancel is safe via the UNDO window, not a confirm gate — exactly the design (the web removes
    // the sub immediately and raises a sonner toast with an inline Undo, no "are you sure?"). Snapshot
    // BEFORE delete so the undo restores both the sub and its paused state — capture order matters
    // (read getState() before removeSub). The Tier-1 snackbar (6s) then carries the verbatim
    // "Cancelled {name}" line and the one-tap restore.
    const prevSubs = getState().subs;
    const prevPaused = !!getState().subPaused[sub.name];
    removeSub(sub.name);
    showUndo(`Cancelled ${sub.name}`, () => {
      setSubs(prevSubs);
      if (prevPaused) togglePaused(sub.name, true);
    });
  };

  const onAskMelo = (sub: StoreSub) => {
    nav.openMelo({
      prefill: `Talk me out of ${sub.name} (${pounds(sub.cost)}/mo, ${sub.usesPerMonth} uses last month).`,
    });
  };

  // EMPTY BRANCH — the calm doorway. No top Melo on the populated screen; here EmptyState owns it.
  if (subs.length === 0) {
    return (
      <View style={layout.screen}>
        <Header nav={nav} t={t} s={s} />

        <View style={layout.head}>
          <Text style={s.kicker}>Recurring spend</Text>
          <Text style={s.headline}>
            What still <Text style={s.headlineAccent}>earns</Text> its place?
          </Text>
        </View>

        <View style={layout.emptyWrap}>
          <EmptyState
            mood="calm"
            headline={copy.subs.empty.head.replace(/\*\*/g, '')}
            body="Add a streaming service, gym, or anything that comes out every month. You'll see what still earns its place."
            cta={{ label: copy.subs.empty.cta, onPress: () => nav.go('add-debt') }}
          />
        </View>
      </View>
    );
  }

  // POPULATED BRANCH.
  return (
    <View style={layout.screen}>
      <Header nav={nav} t={t} s={s} />

      <View style={layout.head}>
        <Text style={s.kicker}>Recurring spend</Text>
        <Text style={s.headline}>
          What still <Text style={s.headlineAccent}>earns</Text> its place?
        </Text>
      </View>

      {/* TOTAL CARD — the monthly drain is the hero; "−£X from pauses" sits beneath in calm green;
          the yearly figure is the quiet right-hand counterweight. */}
      <View style={s.totals}>
        <View style={layout.totalsLeft}>
          <Text style={s.totalsLabel}>Every month</Text>
          <Text style={s.totalsValue}>{pounds(monthlyDisplay)}</Text>
          {monthlySaved > 0 ? (
            <Text style={s.totalsSaved}>−{pounds(monthlySaved)} from pauses</Text>
          ) : null}
        </View>
        <View style={layout.totalsRight}>
          <Text style={s.totalsLabel}>Per year</Text>
          <Text style={s.totalsYear}>{poundsWhole(monthly * 12)}</Text>
        </View>
      </View>

      {/* QUIET-MOVE CTA — one accent-soft banner with a forward arrow, only when there are quiet,
          still-active subs. The £/mo + £/yr saving is engine-free and shows now; the "Your low
          point: £a → £b (day)" lift line is gated behind the tight-day engine. */}
      {showQuietMove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Pauses every subscription that has gone quiet."
          onPress={pauseQuietOnes}
          style={({ pressed: isPressed }) => [s.quietBanner, isPressed ? layout.pressed : undefined]}
        >
          <View style={layout.flex1}>
            <Text style={s.quietEyebrow}>A quiet move</Text>
            <Text style={s.quietBody}>
              Pause the {quietOnes.length} quiet {quietOnes.length === 1 ? 'one' : 'ones'} → save{' '}
              {pounds(quietSave)}/mo, {poundsWhole(quietSave * 12)}/yr
            </Text>
            {/* @rn-engine money-path-tight-day — the real route DELTA: "Your low point: £a → £b
                ({day})", shown once the mount-gate has opened (route !== null) and pausing the quiet
                ones actually lifts the low point on a known day. Verbatim web copy. */}
            {quietLift > 0 && tightWith && tightIfQuietPaused?.date ? (
              <Text style={s.quietLift}>
                Your low point: £{tightWith.spare} → £{tightIfQuietPaused.spare} (
                {formatDayProse(tightIfQuietPaused.date)})
              </Text>
            ) : null}
          </View>
          <Text style={s.quietArrow}>→</Text>
        </Pressable>
      ) : null}

      {/* SORT CHIPS — Worst value (default) · Cost · Next charge. A pill row matching the web's
          ink-fill-on-selected / inset-on-rest. */}
      <View style={layout.sortRow}>
        {SORTS.map((option) => {
          const selected = sort === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSort(option.key)}
              style={({ pressed: isPressed }) => [
                s.sortChip,
                selected ? s.sortChipOn : undefined,
                isPressed ? layout.pressed : undefined,
              ]}
            >
              <Text style={[s.sortChipLabel, selected ? s.sortChipLabelOn : undefined]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* LIST — one surface card, hairline-divided rows (first row carries no top rule). */}
      <View style={s.list}>
        {sorted.map((sub, index) => (
          <SubscriptionRow
            key={sub.name}
            sub={sub}
            first={index === 0}
            paused={!!paused[sub.name]}
            t={t}
            s={s}
            onPauseResume={() => onPauseResume(sub)}
            onUsedToday={() => markSubUsed(sub.name)}
            onAskMelo={() => onAskMelo(sub)}
            onCancel={() => onCancel(sub)}
          />
        ))}
      </View>

      {/* Footer line — web mood "soft" is not one of the RN Melo's five canonical moods
          (calm|curious|cheer|concern|celebrate); map it to calm (MeloLine's default), the
          quiet rest pose, per the spec's fidelity note. */}
      <View style={layout.footer}>
        <MeloLine
          mood="calm"
          text="Pausing for a month is a small experiment. You can always resume."
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header — back chevron · centred uppercase title · symmetric spacer.
// ---------------------------------------------------------------------------

function Header({
  nav,
  t,
  s,
}: {
  nav: Nav;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={layout.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={nav.back}
        style={({ pressed: isPressed }) => [layout.backHit, isPressed ? layout.pressed : undefined]}
      >
        <Text style={[s.backGlyph, { color: t.muted }]}>←</Text>
      </Pressable>
      <Text style={s.headerTitle}>{copy.subs.title}</Text>
      <View style={layout.headerSpacer} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row — pulse dot + name (+ trial badge) + pulse/score subtitle + cost/next, then the action row.
// ---------------------------------------------------------------------------

function SubscriptionRow({
  sub,
  first,
  paused,
  t,
  s,
  onPauseResume,
  onUsedToday,
  onAskMelo,
  onCancel,
}: {
  sub: StoreSub;
  first: boolean;
  paused: boolean;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  onPauseResume: () => void;
  onUsedToday: () => void;
  onAskMelo: () => void;
  onCancel: () => void;
}) {
  const p = pulseOf(sub);
  const hasTrial = typeof sub.trialEndsInDays === 'number';

  return (
    <View style={[s.row, first ? layout.rowFirst : undefined, paused ? layout.rowPaused : undefined]}>
      <View style={layout.rowHead}>
        <View style={[layout.pulseDot, { backgroundColor: pulseColor(t, p) }]} />
        <View style={layout.rowText}>
          <View style={layout.nameLine}>
            <Text style={s.rowName} numberOfLines={1}>
              {sub.name}
            </Text>
            {hasTrial && !paused ? (
              <View
                style={s.trialBadge}
                accessibilityLabel="Free trial about to convert into a paying charge"
              >
                <Text style={s.trialBadgeText}>
                  Trial ends {sub.trialEndsInDays === 0 ? 'today' : `in ${sub.trialEndsInDays}d`}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={s.rowMeta} numberOfLines={1}>
            {pulseLabel(p)} · {formatScore(sub)}
          </Text>
        </View>
        <View style={layout.rowAmountCol}>
          <Text style={s.rowCost}>{pounds(sub.cost)}</Text>
          <Text style={s.rowNext}>next {formatNext(sub.nextRenewalDaysAway)}</Text>
        </View>
      </View>

      <View style={layout.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onPauseResume}
          style={({ pressed: isPressed }) => [s.pausePill, isPressed ? layout.pressed : undefined]}
        >
          <Text style={s.pausePillLabel}>{paused ? 'Resume' : 'Pause for a month'}</Text>
        </Pressable>

        {!paused ? (
          <ActionLink
            label="Used today"
            color={t.positiveInk}
            onPress={onUsedToday}
            accessibilityHint="Marks this subscription as used today."
          />
        ) : null}

        <ActionLink
          label="Ask Melo"
          color={t.muted}
          onPress={onAskMelo}
          accessibilityHint={`Asks Melo about ${sub.name}.`}
        />

        <View style={layout.actionsSpacer} />

        <ActionLink
          label="Cancel"
          color={t.repairInk}
          onPress={onCancel}
          accessibilityHint={`Cancels ${sub.name}.`}
        />
      </View>
    </View>
  );
}

// A flat, text-only action (Used today / Ask Melo / Cancel) — no fill, only coloured text, matching
// the web's borderless h-8 pills. A >=44px tap area is guaranteed via vertical padding + hitSlop.
function ActionLink({
  label,
  color,
  onPress,
  accessibilityHint,
}: {
  label: string;
  color: string;
  onPress: () => void;
  accessibilityHint?: string | undefined;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed: isPressed }) => [layout.actionLink, isPressed ? layout.pressed : undefined]}
    >
      <Text style={[layout.actionLinkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles — layout-only (static) vs colour-bearing (makeStyles(t)), per the kit's DARK-MODE PATTERN.
// ---------------------------------------------------------------------------

const layout = StyleSheet.create({
  screen: {
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: gap.lg,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backHit: { minWidth: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerSpacer: { width: 44 },

  head: { gap: 4, marginTop: 4 },
  emptyWrap: { marginTop: 8 },

  totalsLeft: { flex: 1 },
  totalsRight: { alignItems: 'flex-end' },

  flex1: { flex: 1 },

  sortRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  rowFirst: { borderTopWidth: 0 },
  rowPaused: { opacity: 0.55 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  rowText: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowAmountCol: { alignItems: 'flex-end' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  actionsSpacer: { flex: 1 },
  actionLink: { paddingVertical: 11, justifyContent: 'center' },
  actionLinkText: { fontSize: 12, fontWeight: '600' },

  footer: { marginTop: 8, marginBottom: 32 },

  pressed: { opacity: 0.7 },
});

function makeStyles(t: Palette) {
  return StyleSheet.create({
    backGlyph: { fontSize: 20, fontWeight: '500' },
    headerTitle: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.68,
      textTransform: 'uppercase',
    },

    // Italic serif kicker — web font-display italic, 13px, muted ink.
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    // Headline — Fraunces display, the accent word recoloured terracotta (upright, never italic).
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 28,
      lineHeight: 29,
      letterSpacing: -0.3,
    },
    headlineAccent: { color: t.calm },

    // Totals card — a raised paper surface, baseline-aligned left vs right.
    totals: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: 20,
      padding: 20,
      marginTop: 4,
      ...elevation.card,
    },
    totalsLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.32,
      textTransform: 'uppercase',
    },
    totalsValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 34,
      lineHeight: 36,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    totalsSaved: {
      color: t.positiveInk,
      fontSize: 11.5,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    totalsYear: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 15,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },

    // Quiet-move banner — accent-soft fill + a whisper-thin terracotta ring (web accent/30) and a
    // trailing arrow. The low-alpha terracotta rgba reads on the calmSoft ground in both modes.
    quietBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.calmSoft,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: 'rgba(224, 99, 58, 0.3)',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    quietEyebrow: {
      color: t.calmStrong,
      fontSize: 11.5,
      fontWeight: '700',
      letterSpacing: 1.38,
      textTransform: 'uppercase',
    },
    quietBody: {
      color: t.ink,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    quietArrow: { color: t.calm, fontSize: 18 },
    // Tight-day lift line — the web's text-[11.5px] mt-1 text-[var(--positive)] tabular. Uses the
    // text-grade positive (positiveInk) the screen already uses for positive prose (totalsSaved /
    // "Used today"), per the kit's dark-mode pattern.
    quietLift: {
      color: t.positiveInk,
      fontSize: 11.5,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },

    // Sort chips — ink fill + paper label when selected; inset fill + muted label at rest.
    sortChip: {
      height: 28,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: t.inset,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortChipOn: { backgroundColor: t.ink },
    sortChipLabel: { color: t.muted, fontSize: 11 },
    sortChipLabelOn: { color: t.inverse },

    list: {
      backgroundColor: t.surface,
      borderRadius: 20,
      overflow: 'hidden',
      ...elevation.card,
    },
    row: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
    },
    rowName: { color: t.ink, fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
    rowMeta: {
      color: t.muted,
      fontSize: 11.5,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    rowCost: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
    },
    rowNext: {
      color: t.muted,
      fontSize: 10.5,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },

    // Trial badge — the single highest-regret flag. Caution-gold wash (web caution/15), gold text.
    trialBadge: {
      backgroundColor: 'rgba(217, 164, 65, 0.15)',
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    trialBadgeText: {
      color: t.warmInk,
      fontSize: 9.5,
      letterSpacing: 1.14,
      textTransform: 'uppercase',
      fontVariant: ['tabular-nums'],
    },

    // Pause/Resume — a compact inset pill (web h-8 px-3 rounded-full bg-[var(--inset)]).
    pausePill: {
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      height: 32,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pausePillLabel: { color: t.ink, fontSize: 12, fontWeight: '600' },
  });
}

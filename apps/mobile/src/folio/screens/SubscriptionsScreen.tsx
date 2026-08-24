/**
 * @rn-screen    SubscriptionsScreen
 * @rn-stack     MainTabs > Subs
 * @purpose      Subscription pulse — pause / cancel / used-today / ask-Melo per item.
 * @reads        subs, subPaused (+ the money-path route slices via useRoute/routeFromStore:
 *               currentBalance, onboarding, subOverrides, transactions, pots) for the tight-day lift
 * @writes       togglePaused, removeSub, markSubUsed
 * @opens-sheet  melo-chat
 * @copy         Honest payment-facts voice — no usage/value/cancel claims (SUBSCRIPTION_SIGNAL_RESEARCH §5).
 * @tokens       --surface --hairline --accent --positive --muted-ink
 * @motion       press · slide-in-r · subtle pulse on the "used today" tick
 *
 * Faithful 1:1 RN port of the web screen
 * (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenSubscriptions.tsx).
 * It shows everything that recurs — the upcoming charges and what pausing buys before your low point.
 * The recurring drain is the hero (a count-up monthly total, with what pauses have already saved
 * beneath it); a single PAYMENT-TIMING "pause what renews before your low point" move; two sort chips
 * reorder the list (next charge by default, then cost); each row carries a calm marker dot + a
 * payment-fact subtitle ("Repeats monthly" / "Paused") + per-row actions. NO usage / value / cancel
 * CLAIM is made — banking or seed data proves a charge recurs, not that a product was used
 * (SUBSCRIPTION_SIGNAL_RESEARCH §2/§5); the "Cancel" button stays (a user action), but Folio never
 * tells the user something is unused, wasted, or should be cancelled.
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
 * figure, the due-before-low-point move's £/mo + £/yr, the per-row marker + payment-fact subtitle, and
 * the plain pause/cancel feedback — renders fully throughout. The catalog/marker/actions render holds.
 *
 * FEEDBACK SURFACE: pause / pause-the-quiet-ones / cancel all surface as the EPHEMERAL Tier-1 undo
 * snackbar (useUndo / showUndo) — the RN equal of the web's sonner toast — never a blocking
 * Alert.alert. Pausing is reversible, so each pause toast's Undo resumes; cancel is kept safe by the
 * undo window itself (one-tap restore of the sub + its paused state), not by a confirm gate, exactly
 * as the design removes immediately and offers Undo.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  type AppState,
  type Sub as StoreSub,
  getState,
  getMonthlyCancelSavings,
  markSubUsed,
  pauseMany,
  removeSub,
  restoreSub,
  revokeTinyWin,
  setPartial,
  setSubs,
  togglePaused,
  useAppStore,
} from '@/folio/store';
import { elevation, gap, type Palette, radius, serif, useCountUp, useTheme } from '@/folio/theme';
import { routeFromStore, useRoute } from '@/folio/lib/storeRoute';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { MeloReaction } from '@/folio/ui/MeloReaction';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { useUndo } from '@/folio/ui/useUndo';
import { copy } from '@/folio/copy/copy';
import type { Nav } from '@/folio/types';
import { triggerFeedback } from '@/folio/lib/feedback';
import {
  subscriptionAnnualCost,
  subscriptionConfidence,
  subscriptionStatusLine,
} from '@/folio/screens/commitmentHelpers';

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

// The orderings offered. NO "worst value" sort — that ranks by a usage/value judgement banking or seed
// data cannot make (SUBSCRIPTION_SIGNAL_RESEARCH §5). The honest orderings are payment facts: by next
// charge (the default — what's coming first) and by cost.
type SortKey = 'next' | 'cost';

const SORTS: readonly { key: SortKey; label: string }[] = [
  { key: 'next', label: 'Next charge' },
  { key: 'cost', label: 'Cost' },
];

// The monthly total counts up to its target via the shared useCountUp — the web's
// useCountUp(monthly, 600): easeOutCubic over 600ms, snapping to the value under reduced motion.
const COUNT_UP_MS = 600;

// Marker dot colour — a calm, NON-usage marker. Banking/seed data can't prove a product was used, so
// the dot never encodes a "good/bad value" verdict (SUBSCRIPTION_SIGNAL_RESEARCH §5). It flags only a
// payment fact: a free trial about to convert (the one high-regret moment) reads caution; everything
// else is a neutral calm dot.
function dotColor(t: Palette, sub: StoreSub): string {
  return typeof sub.trialEndsInDays === 'number' ? t.caution : t.calm;
}

// next "today"/"tomorrow"/"in {n}d"/date — verbatim web formatNext.
function formatNext(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 14) return `in ${days}d`;
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatArchiveDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
  const cancelledSubs = useAppStore((st) => st.cancelledSubs ?? []);

  const [sort, setSort] = useState<SortKey>('next');

  const sorted = useMemo(() => {
    const arr = [...subs];
    if (sort === 'cost') arr.sort((a, b) => b.cost - a.cost);
    else arr.sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway);
    return arr;
  }, [sort, subs]);

  // Monthly drain (active subscriptions only), and what pauses have already saved.
  const monthly = subs.reduce((acc, x) => acc + (paused[x.name] ? 0 : x.cost), 0);
  const monthlyDisplay = useCountUp(monthly, COUNT_UP_MS);
  const totalIfNoPause = subs.reduce((acc, x) => acc + x.cost, 0);
  const monthlySaved = totalIfNoPause - monthly;
  const cancelledMonthlySaved = getMonthlyCancelSavings(cancelledSubs);

  // The "pause what renews before your low point" move is a PAYMENT-TIMING set (when a charge lands),
  // not a usage/"quiet" verdict — it is computed below (dueBeforeTight) once the route's tight day is
  // known, so it can read the projected low point honestly.

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

  // Active subs that renew ON OR BEFORE the projected low point — a PAYMENT-TIMING set (when a charge
  // lands), never a usage verdict. Pausing these is what genuinely buys room before the squeeze, and
  // the copy can stay honest about WHY. Empty until the mount-gate opens (tightWith === null).
  const dueBeforeTight = useMemo<StoreSub[]>(() => {
    if (!tightWith) return [];
    const tightMs = new Date(`${tightWith.date}T00:00:00`).getTime();
    const base = (now ?? EPOCH).getTime();
    const daysToTight = Math.round((tightMs - base) / 86_400_000);
    return subs.filter((x) => !paused[x.name] && x.nextRenewalDaysAway <= daysToTight);
  }, [subs, paused, tightWith, now]);
  const dueSave = dueBeforeTight.reduce((acc, x) => acc + x.cost, 0);
  const showDueMove = dueBeforeTight.length > 0;

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
  const tightIfDuePaused = useMemo(
    () => (dueBeforeTight.length > 0 ? tightIfPaused(dueBeforeTight.map((q) => q.name)) : null),
    // Recompute when the gate opens or the inputs the route depends on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, dueBeforeTight, subs, paused],
  );
  const dueLift = tightIfDuePaused && tightWith ? tightIfDuePaused.spare - tightWith.spare : 0;
  // -------------------------------------------------------------------------------------------

  const pauseDueOnes = () => {
    // Measure the lift BEFORE the store write, then pause. The outcome surfaces as an EPHEMERAL Tier-1
    // undo snackbar (never a blocking confirm). Pausing is a reversible Tier-1 action ("pause sub" in
    // undoPolicy), so the snackbar's Undo genuinely resumes the set; capture the names so the restore
    // reverses exactly this pause.
    const names = dueBeforeTight.map((q) => q.name);
    const before = tightWith?.spare;
    const after = tightIfDuePaused?.spare ?? before;
    pauseMany(names, true);
    if (typeof before === 'number' && typeof after === 'number' && after > before) {
      // "Your low point goes from £a to £b" + room-around-{day}, folded into the single snackbar line
      // (the toast carries one label, not a title/body pair). Payment-timing framing only.
      const room = tightIfDuePaused?.date
        ? `more room around ${formatDayProse(tightIfDuePaused.date)}`
        : 'more room before payday';
      showUndo(`Low point £${before} → £${after} · ${room}`, () => pauseMany(names, false));
    }
  };

  const onPauseResume = (sub: StoreSub) => {
    const isPaused = !!paused[sub.name];
    if (isPaused) {
      // Resume is the same reversible Tier-1 state change as pause. Keep the monthly effect
      // inspectable and give the user the same 30-second escape hatch instead of silently flipping
      // the row with no feedback.
      const beforeMonthly = monthly;
      togglePaused(sub.name, false);
      showUndo(
        `Resumed ${sub.name} · recurring total ${pounds(beforeMonthly)} → ${pounds(beforeMonthly + sub.cost)}`,
        () => togglePaused(sub.name, true),
      );
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
    // (read getState() before removeSub). The Tier-1 snackbar (30s) then carries the verbatim
    // "Cancelled {name}" line and the one-tap restore.
    const prevSubs = getState().subs;
    const prevPaused = !!getState().subPaused[sub.name];
    const prevCancelled = getState().cancelledSubs ?? [];
    const cancellationWin = removeSub(sub.name);
    void triggerFeedback('subscription-cancelled');
    showUndo(`Cancelled ${sub.name}`, () => {
      setSubs(prevSubs);
      setPartial({ cancelledSubs: prevCancelled });
      if (cancellationWin) revokeTinyWin(cancellationWin.kind);
      if (prevPaused) togglePaused(sub.name, true);
    });
  };

  const onAskMelo = (sub: StoreSub) => {
    nav.openMelo({
      prefill: `Tell me about ${sub.name} (${pounds(sub.cost)}/mo, renews in ${sub.nextRenewalDaysAway}d).`,
    });
  };

  // EMPTY BRANCH — the calm doorway. No top Melo on the populated screen; here EmptyState owns it.
  if (subs.length === 0 && cancelledSubs.length === 0) {
    return (
      <ScrollView
        style={layout.scrollFlex}
        contentContainerStyle={layout.screen}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          onBack={nav.back}
          eyebrow={copy.subs.title}
          arrow="text"
          spacerWidth={44}
          backHitAlign="flex-start"
          eyebrowTracking={1.68}
        />

        <View style={layout.head}>
          <Text style={s.kicker}>Recurring spend</Text>
          <Text style={s.headline}>
            Everything that <Text style={s.headlineAccent}>repeats</Text>.
          </Text>
        </View>

        <View style={layout.emptyWrap}>
          <EmptyState
            mood="calm"
            headline={copy.subs.empty.head.replace(/\*\*/g, '')}
            body="Add a streaming service, gym, or anything that comes out every month. You'll see everything that repeats and what's coming."
            cta={{ label: copy.subs.empty.cta, onPress: () => nav.go('add-bill') }}
          />
        </View>
      </ScrollView>
    );
  }

  // POPULATED BRANCH.
  return (
    <ScrollView
      style={layout.scrollFlex}
      contentContainerStyle={layout.screen}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        onBack={nav.back}
        eyebrow={copy.subs.title}
        arrow="text"
        spacerWidth={44}
        backHitAlign="flex-start"
        eyebrowTracking={1.68}
      />

      <View style={layout.head}>
        <Text style={s.kicker}>Recurring spend</Text>
        <Text style={s.headline}>
          Everything that <Text style={s.headlineAccent}>repeats</Text>.
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
      {showDueMove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Pauses the subscriptions that renew before your low point."
          onPress={pauseDueOnes}
          style={({ pressed: isPressed }) => [
            s.quietBanner,
            isPressed ? layout.pressed : undefined,
          ]}
        >
          <View style={layout.flex1}>
            <Text style={s.quietEyebrow}>Before your low point</Text>
            <Text style={s.quietBody}>
              Pause the {dueBeforeTight.length} that{' '}
              {dueBeforeTight.length === 1 ? 'renews' : 'renew'} before then → {pounds(dueSave)}/mo,{' '}
              {poundsWhole(dueSave * 12)}/yr back
            </Text>
            {/* @rn-engine money-path-tight-day — the real route DELTA: "Your low point: £a → £b
                ({day})", shown once the mount-gate has opened (route !== null) and pausing these
                actually lifts the low point on a known day. */}
            {dueLift > 0 && tightWith && tightIfDuePaused?.date ? (
              <Text style={s.quietLift}>
                Your low point: £{tightWith.spare} → £{tightIfDuePaused.spare} (
                {formatDayProse(tightIfDuePaused.date)})
              </Text>
            ) : null}
          </View>
          <Text style={s.quietArrow}>→</Text>
        </Pressable>
      ) : null}

      {/* SORT CHIPS — Next charge (default) · Cost. A pill row matching the web's
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

      {cancelledSubs.length > 0 ? (
        <View style={layout.cancelledSection}>
          <View style={layout.cancelledHeader}>
            <Text style={s.cancelledEyebrow}>Cancelled</Text>
            <Text style={s.cancelledSaved}>−{pounds(cancelledMonthlySaved)}/mo saved</Text>
          </View>
          <View style={s.cancelledList}>
            {cancelledSubs.map((subscription, index) => (
              <View
                key={subscription.name}
                style={[
                  layout.cancelledRow,
                  index > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }
                    : undefined,
                ]}
              >
                <View style={layout.cancelledCopy}>
                  <Text style={s.cancelledName} numberOfLines={1}>
                    {subscription.name}
                  </Text>
                  <Text style={s.cancelledMeta}>
                    {pounds(subscription.monthlyAmount)}/mo · since{' '}
                    {formatArchiveDate(subscription.cancelledAt)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Restore ${subscription.name}`}
                  onPress={() => restoreSub(subscription.name)}
                  style={({ pressed: isPressed }) => [
                    s.restoreButton,
                    isPressed ? layout.pressed : undefined,
                  ]}
                >
                  <Text style={s.restoreButtonLabel}>Restore</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={s.cancelledSummary}>
            Still saving {pounds(cancelledMonthlySaved)}/mo since you cancelled{' '}
            {cancelledSubs.length} {cancelledSubs.length === 1 ? 'subscription' : 'subscriptions'}.
          </Text>
        </View>
      ) : null}

      {/* Footer line — web mood "soft" is not one of the RN Melo's five canonical moods
          (calm|curious|cheer|concern|celebrate); map it to calm (MeloLine's default), the
          quiet rest pose, per the spec's fidelity note. */}
      <View style={layout.footer}>
        <MeloLine
          mood="calm"
          text="Pausing for a month is a small experiment. You can always resume."
        />
      </View>
    </ScrollView>
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
  const hasTrial = typeof sub.trialEndsInDays === 'number';
  const annualCost = subscriptionAnnualCost(sub);
  const confidence = subscriptionConfidence(sub);

  return (
    <View
      style={[s.row, first ? layout.rowFirst : undefined, paused ? layout.rowPaused : undefined]}
    >
      <View style={layout.rowHead}>
        <View style={[layout.pulseDot, { backgroundColor: dotColor(t, sub) }]} />
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
            {subscriptionStatusLine(sub, paused)} · confidence {confidence}
          </Text>
          {paused && (sub.pauseReason || sub.pausedUntil) ? (
            <Text style={s.pauseDetail} numberOfLines={2}>
              {sub.pauseReason ? `paused because ${sub.pauseReason}` : 'paused for one cycle'}
              {sub.pausedUntil ? ` · resumes ${formatArchiveDate(sub.pausedUntil)}` : ''}
            </Text>
          ) : null}
        </View>
        <View style={layout.rowAmountCol}>
          <Text style={s.rowCost}>{pounds(sub.cost)}</Text>
          <Text style={s.rowAnnual}>{pounds(annualCost)}/yr</Text>
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

      {/* MELO_EMOTIONAL_ENGINE.md § 3 — inline reaction (RN port of the web ScreenSubscriptions). */}
      <MeloReaction
        channel="subs-inline"
        anchor="under-row"
        matchKey={sub.name}
        style={layout.reaction}
      />
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
      style={({ pressed: isPressed }) => [
        layout.actionLink,
        isPressed ? layout.pressed : undefined,
      ]}
    >
      <Text style={[layout.actionLinkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles — layout-only (static) vs colour-bearing (makeStyles(t)), per the kit's DARK-MODE PATTERN.
// ---------------------------------------------------------------------------

const layout = StyleSheet.create({
  // The screen scrolls as one column — a long subs list overflowed the fixed viewport and the lower
  // rows + footer were unreachable. The ScrollView fills the screen (scrollFlex); the content grows to
  // at least a full viewport (flexGrow) so a short/empty list still fills, then scrolls when long.
  scrollFlex: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: gap.lg,
    flexGrow: 1,
  },

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
  // The inline Melo reaction — web mt-2.
  reaction: { marginTop: 8 },
  actionLink: { paddingVertical: 11, justifyContent: 'center' },
  actionLinkText: { fontSize: 12, fontWeight: '600' },

  footer: { marginTop: 8, marginBottom: 32 },
  cancelledSection: { marginTop: gap.sm },
  cancelledHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
    paddingHorizontal: gap.xxs,
  },
  cancelledRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.md,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  cancelledCopy: { flex: 1, minWidth: 0 },

  pressed: { opacity: 0.7 },
});

function makeStyles(t: Palette) {
  return StyleSheet.create({
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
    pauseDetail: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 3,
    },
    rowCost: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
    },
    rowAnnual: {
      color: t.muted,
      fontSize: 10,
      marginTop: 1,
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
    cancelledEyebrow: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    cancelledSaved: {
      color: t.positiveInk,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    cancelledList: {
      backgroundColor: t.surface,
      borderRadius: radius.xl,
      overflow: 'hidden',
      ...elevation.card,
    },
    cancelledName: { color: t.ink, fontSize: 13.5 },
    cancelledMeta: {
      color: t.muted,
      fontSize: 10.5,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    restoreButton: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: gap.md,
    },
    restoreButtonLabel: { color: t.ink, fontSize: 11.5, fontWeight: '600' },
    cancelledSummary: {
      color: t.positiveInk,
      fontFamily: serif.displayItalic,
      fontSize: 12,
      lineHeight: 17,
      marginTop: gap.sm,
      paddingHorizontal: gap.xs,
    },
  });
}

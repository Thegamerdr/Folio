// FolioShell — the self-contained nav state machine for the faithful RN port of the web folio.
//
// This is the RN mirror of the web shell at folio-melo/src/routes/index.tsx (the screen-router
// switch + sheet host). The web index also carries a showcase chrome (hero, chapter rail, ⌘K
// palette) that is explicitly web-only and NOT ported; what ports is the navigation core: a
// screen-router keyed by ScreenId, the bottom nav, and a single-sheet host keyed by SheetId.
//
// Every screen here is a PLACEHOLDER for now — a calm PressureScreen carrying only the screen's
// title through the editorial Headline. They get replaced wave by wave. No fabricated data, no
// scaffolding text. The shell composes the existing pressure-map kit (BottomNav / Sheet /
// PressureScreen / Headline) so there is zero styling drift; it introduces no new tokens.
//
// ThemeProvider is mounted once at the app root (app/_layout.tsx) — the shell never remounts it.

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  BottomNav,
  Body,
  Headline,
  Muted,
  PressureScreen,
  PrimaryAction,
} from '@/surfaces/pressureMap/kit';
import type { ProductScreen } from '@/surfaces/mobileShell';
import { Sheet } from '@/surfaces/pressureMap/Sheet';

import { StartScreen } from '@/folio/screens/StartScreen';
import { TodayScreen } from '@/folio/screens/TodayScreen';
import { IntakeScreen } from '@/folio/screens/IntakeScreen';
import { AddEntryScreen } from '@/folio/screens/AddEntryScreen';
import { VisualizerScreen } from '@/folio/screens/VisualizerScreen';
import { ReviewScreen } from '@/folio/screens/ReviewScreen';
import { PdfSuccessScreen } from '@/folio/screens/PdfSuccessScreen';
import { PdfFallbackScreen } from '@/folio/screens/PdfFallbackScreen';
import { ImageSuccessScreen } from '@/folio/screens/ImageSuccessScreen';
import { ImageFallbackScreen } from '@/folio/screens/ImageFallbackScreen';
import { PasteSuccessScreen } from '@/folio/screens/PasteSuccessScreen';
import { PotsScreen } from '@/folio/screens/PotsScreen';
import { SubscriptionsScreen } from '@/folio/screens/SubscriptionsScreen';
import { InsightsScreen } from '@/folio/screens/InsightsScreen';
import { PaydayRitualScreen } from '@/folio/screens/PaydayRitualScreen';
import { CalendarScreen } from '@/folio/screens/CalendarScreen';
import { WhatIfScreen } from '@/folio/screens/WhatIfScreen';
import { ShortfallScreen } from '@/folio/screens/ShortfallScreen';
import { RecoveryScreen } from '@/folio/screens/RecoveryScreen';
import { TodayAfterScreen } from '@/folio/screens/TodayAfterScreen';
import { MoreScreen } from '@/folio/screens/MoreScreen';
import { PrivacyScreen } from '@/folio/screens/PrivacyScreen';
import { TimelineScreen } from '@/folio/screens/TimelineScreen';
import { PlansScreen } from '@/folio/screens/PlansScreen';
import { GuidedCheckInScreen } from '@/folio/screens/GuidedCheckInScreen';
import { MeloScreen } from '@/folio/screens/MeloScreen';
import { PaywallScreen } from '@/folio/screens/PaywallScreen';
import { AccountScreen } from '@/folio/screens/AccountScreen';
import { OnboardingSheet } from '@/folio/sheets/OnboardingSheet';
import { EditItemSheet } from '@/folio/sheets/EditItemSheet';
import { EditTxnSheet } from '@/folio/sheets/EditTxnSheet';
import { LogSpendSheet } from '@/folio/sheets/LogSpendSheet';
import { SubCaughtSheet } from '@/folio/sheets/SubCaughtSheet';
import { AddEventSheet } from '@/folio/sheets/AddEventSheet';
import { CalendarExportSheet } from '@/folio/sheets/CalendarExportSheet';
import { CalendarConnectSheet } from '@/folio/sheets/CalendarConnectSheet';
import { SheetDayDetail } from '@/folio/sheets/SheetDayDetail';
import { RouteDetailSheet } from '@/folio/sheets/RouteDetailSheet';
import { MeloChatSheet } from '@/folio/sheets/MeloChatSheet';
import { ShareSheet } from '@/folio/sheets/ShareSheet';
import { UndoProvider } from '@/folio/ui/useUndo';
import { useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { derivePressure } from '@/folio/screens/today/pressure';
import type { MeloIntent, Nav, Pressure, ScreenId, SheetId, SheetPayload } from '@/folio/types';

// The shell's landing pressure. The web showcase let a design tool flip Melo through her five moods
// (web-only chrome, not ported); the real web app derives pressure from state and defaults to `calm`
// (folio-melo index: `search.p ?? "calm"`). Until the pressure engine is ported wave-by-wave, the
// shell threads this calm default into Today, faithful to the web's default landing mood.
const DEFAULT_PRESSURE: Pressure = 'calm';

// A stable sentinel "now" for the one render before the shell's pressure mount-gate opens (mirrors
// TodayScreen's EPOCH). `useRoute` can't be called conditionally, so it runs against this until the
// real clock is set; that frame's result is discarded and the shell shows DEFAULT_PRESSURE.
const PRESSURE_EPOCH = new Date(0);

// How long after first reaching Today before the onboarding sheet is offered — byte-faithful to the
// web index (setTimeout 600ms before setSheet('onboarding')).
const ONBOARDING_OFFER_DELAY_MS = 600;

// ---------------------------------------------------------------------------
// Screen titles — the visible copy for each placeholder. These are the web nav labels, ported
// verbatim, screened so no banned product vocabulary appears in any visible string.
// ---------------------------------------------------------------------------

const SCREEN_TITLE: Readonly<Record<ScreenId, string>> = {
  start: 'Start',
  guided: 'Check-in',
  intake: 'Add',
  'pdf-success': 'Statement read',
  'pdf-fallback': 'Statement saved',
  'image-success': 'Photo read',
  'image-fallback': 'Photo saved',
  'paste-success': 'Pasted',
  visualizer: 'Check',
  review: 'Review',
  today: 'Today',
  'today-mode': 'Today',
  'today-stability': 'Today',
  'today-after': 'After',
  whatif: 'What if',
  plans: 'Plans',
  calendar: 'Calendar',
  timeline: 'Timeline',
  'add-bill': 'Add a bill',
  'add-debt': 'Add a debt',
  recovery: 'Recovery',
  subs: 'Subscriptions',
  pots: 'Pots',
  ritual: 'Payday ritual',
  insights: 'Insights',
  shortfall: 'Shortfall',
  more: 'More',
  privacy: 'Privacy',
  melo: 'Melo',
  paywall: 'Folio plans',
  account: 'Account',
};

// ---------------------------------------------------------------------------
// Tab <-> screen bridge. The kit's BottomNav speaks the pressure-map ProductScreen ids
// (today / import / melo / more — the Review tab carries the id `import`). The shell navigates by
// web ScreenId (where the same screen is `review`). These two functions are the only place the two
// vocabularies meet, so the kit stays untouched and the web nav semantics are preserved.
// ---------------------------------------------------------------------------

// The screens that nest under the More tab — every leaf reachable from the More hub. Faithful to
// the web TabBar's `moreSubtree` (TabBar.tsx): each of these lights the More tab. The RN union also
// carries `shortfall` (a More-reachable leaf in this port), so it is included here too.
const MORE_SUBTREE: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'more',
  'timeline',
  'calendar',
  'plans',
  'paywall',
  'whatif',
  'recovery',
  'privacy',
  'add-bill',
  'add-debt',
  'subs',
  'pots',
  'ritual',
  'insights',
  'shortfall',
  'account',
]);

// Which bottom-tab lights up for a given screen. Faithful to the web TabBar's active-state map:
// Today lights for `today` + `today-after`; the Review tab (kit id `import`) lights for `visualizer`
// + `review`; Melo for `melo`; the whole More subtree lights the More tab. Anything else falls back
// to Today (the home anchor).
function activeTabForScreen(screen: ScreenId): ProductScreen {
  if (screen === 'today' || screen === 'today-after') return 'today';
  if (screen === 'visualizer' || screen === 'review') return 'import';
  if (screen === 'melo') return 'melo';
  if (MORE_SUBTREE.has(screen)) return 'more';
  return 'today';
}

// The screen a bottom-tab press navigates to. Faithful to the web TabBar, whose "Review" tab has
// id `visualizer` and navigates to `visualizer` (the multi-candidate check), NOT the single-candidate
// `review` screen. The kit's Review tab carries the id `import`, so `import` -> `visualizer`.
function screenForTab(tab: ProductScreen): ScreenId {
  if (tab === 'import') return 'visualizer';
  if (tab === 'melo') return 'melo';
  if (tab === 'more') return 'more';
  return 'today';
}

// ---------------------------------------------------------------------------
// Reduced-motion preference (final state). Read once from the OS so the Sheet appears at rest
// instead of sliding when the user has asked for reduced motion. No animation of our own here.
// ---------------------------------------------------------------------------

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value: boolean) => setReduced(value),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function FolioShell() {
  // In-memory nav state — the doorway is `start`, but the home tab is `today`. The web index lands
  // on `start`; here the shell opens on `today` so the bottom nav has a lit home from the first
  // frame (Start is reachable but is not a tab). One screen, one optional sheet.
  const [screen, setScreen] = useState<ScreenId>('today');
  const [sheet, setSheet] = useState<SheetId>(null);
  // Carried into the melo-chat sheet when a flow opens Melo with a prefill/seed (web intent.*).
  const [meloIntent, setMeloIntent] = useState<MeloIntent | undefined>(undefined);
  // Carried into the edit-txn sheet when a flow opens it with a real subject — the posted
  // transaction id the user chose to correct. Mirrors the meloIntent slot exactly: set when
  // openSheet('edit-txn', { id }) is called, cleared whenever a sheet closes or a navigation
  // supersedes it. `undefined` = no target (cold open) → the sheet keeps its safe inert fallback.
  const [editTxnTarget, setEditTxnTarget] = useState<string | undefined>(undefined);
  // Carried into the day-detail sheet when a Month cell / "+N" chip / Week day header opens it with
  // a real subject — the ISO day the tap resolved. Mirrors the editTxnTarget slot exactly: set when
  // openSheet('day-detail', { date }) is called, cleared whenever a sheet closes or a navigation
  // supersedes it.
  const [dayDetailDate, setDayDetailDate] = useState<string | undefined>(undefined);
  const reduceMotion = useReducedMotion();

  // Back-history stack — a faithful port of the web shell's `historyRef` (HeroPhone.tsx): `go` pushes
  // the destination, `back` pops to the previous screen. The shell opens on `today` (not the web's
  // `start`), so the stack is seeded with `today` and `back` falls back to `today` when it empties.
  // A ref (not state) so pushing/popping the trail never itself triggers a re-render — the screen
  // state drives rendering; this only records where the user came from.
  const historyRef = useRef<ScreenId[]>(['today']);

  // The onboarding gate reads the live store flag (faithful to the web index, which reads
  // `useAppStore((s) => s.onboarding.done)`). A returning, set-up user is never offered onboarding.
  const onboardingDone = useAppStore((st) => st.onboarding.done);

  // App-wide money-pressure — the mood/tone the WHOLE app reads. DERIVED from the real route (the
  // tightest projected spare → a band), replacing the old hardcoded 'calm' so Today / What-if / Melo
  // reflect the user's actual money instead of a fixed pretend-calm. The Melo mood picker sets an
  // OVERRIDE via nav.setPressure that wins until cleared (null → back to derived). Mount-gated like the
  // screens: for the single pre-clock frame `pressureNow === null`, the shell shows DEFAULT_PRESSURE.
  const [pressureNow, setPressureNow] = useState<Date | null>(null);
  useEffect(() => setPressureNow(new Date()), []);
  const pressureRoute = useRoute(pressureNow ?? PRESSURE_EPOCH);
  // Only let the REAL route drive the band when the app holds a real CURRENT money picture — a balance
  // the user actually set (amount > 0) or some logged activity. A past cycle alone or the £0 default
  // is NOT enough: an empty/just-cleared app must stay neutral calm, never fret "the middle of next
  // week is the squeeze" over an unconfigured £0. (Verified on-device: gating on hasAnyUserData still
  // alarmed because a leftover cycle counted; this current-picture gate fixes it.)
  const hasMoneyPicture = useAppStore(
    (st) => st.transactions.length > 0 || st.currentBalance.amount > 0,
  );
  const derivedPressure: Pressure =
    pressureNow && hasMoneyPicture
      ? derivePressure(Math.round(pressureRoute.tightPoint.amount))
      : DEFAULT_PRESSURE;
  const [pressureOverride, setPressureOverride] = useState<Pressure | null>(null);
  const activePressure: Pressure = pressureOverride ?? derivedPressure;

  // Opening a screen closes any open sheet (a navigation supersedes a transient sheet) — faithful
  // to the web setScreen, which clears the sheet before navigating. Each navigation also pushes the
  // destination onto the back-history trail (web nav.go pushes to historyRef before setScreen).
  const go = useCallback((next: ScreenId) => {
    historyRef.current.push(next);
    setSheet(null);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
    setScreen(next);
  }, []);

  const back = useCallback(() => {
    // Pop the current screen off the trail and return to the previous one — a faithful port of the
    // web nav.back (historyRef.pop() then setScreen to the new top). When the trail empties, fall
    // back to the home anchor, Today. Back also closes any open sheet and clears a pending intent,
    // matching go's "a navigation supersedes a transient sheet" contract.
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1] ?? 'today';
    setSheet(null);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
    setScreen(prev);
  }, []);

  // Open a sheet, carrying the optional payload for sheets that need a real subject. 'edit-txn'
  // reads `payload.id` (the posted transaction the user chose to correct), parked in the
  // editTxnTarget slot and threaded into <EditTxnSheet target={...}>. 'day-detail' reads
  // `payload.date` (the ISO day a Month cell / "+N" chip / Week day header resolved), parked in the
  // dayDetailDate slot and threaded into <SheetDayDetail date={...}>. Any other sheet ignores the
  // payload and both slots are cleared, so opening a different sheet never carries a stale target.
  const openSheet = useCallback((next: SheetId, payload?: SheetPayload) => {
    setEditTxnTarget(next === 'edit-txn' ? payload?.id : undefined);
    setDayDetailDate(next === 'day-detail' ? payload?.date : undefined);
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
  }, []);

  // Open the Melo companion CHAT sheet, carrying any prefill/seed the flow provided (web intent).
  // The Melo mood SCREEN is a separate surface reached via go('melo'); openMelo is the chat — the
  // surface wired to the live gateway (sendMeloChat). Every "Ask Melo" CTA lands here.
  const openMelo = useCallback((opts?: MeloIntent) => {
    setMeloIntent(opts);
    setSheet('melo-chat');
  }, []);

  // The single Nav contract handed to every ported screen (RN mirror of the web Nav). Memoised so a
  // child holding it as a dep doesn't churn; its members are themselves stable callbacks.
  const nav = useMemo<Nav>(
    () => ({ go, back, openSheet, openMelo, setPressure: setPressureOverride }),
    [go, back, openSheet, openMelo],
  );

  // Onboarding gate — byte-faithful to the web index: the first time the user reaches Today while
  // onboarding is not done, offer the onboarding sheet once, after a short settle delay. `offered`
  // latches so it never re-fires; the timeout is cleaned up on unmount / dep change.
  const offeredOnboarding = useRef(false);
  useEffect(() => {
    if (screen === 'today' && !onboardingDone && !offeredOnboarding.current) {
      offeredOnboarding.current = true;
      const id = setTimeout(() => setSheet('onboarding'), ONBOARDING_OFFER_DELAY_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [screen, onboardingDone]);

  // The bottom-tab press maps the kit's ProductScreen id back to a web ScreenId, then navigates.
  const onTabChange = useCallback(
    (tab: ProductScreen) => {
      go(screenForTab(tab));
    },
    [go],
  );

  const activeTab = useMemo(() => activeTabForScreen(screen), [screen]);

  return (
    // The undo provider wraps the whole shell so every screen can raise a Tier-1 undo window
    // (ENGINES §6) via useUndo(); its snackbar host renders above the screen + bottom nav.
    <UndoProvider>
      {/* Every screen renders inside the error boundary so one screen throwing renders a calm
          fallback instead of taking down the whole shell (faithful to the web HeroPhone, which wraps
          its screen switch in ScreenErrorBoundary). `screenLabel` resets the boundary when the screen
          changes (a fresh navigation clears a prior crash); onReset returns to Today. */}
      <ScreenErrorBoundary screenLabel={screen} onReset={() => go('today')}>
        <ScreenView screen={screen} nav={nav} pressure={activePressure} />
      </ScreenErrorBoundary>
      <BottomNav active={activeTab} onChange={onTabChange} />
      {/* Generic single-sheet host — every sheet that does NOT own its own Sheet. The self-hosting
          sheets (onboarding, edit-item, edit-txn, log-spend, sub-caught, add-event, calendar-export,
          calendar-connect, route-detail, melo-chat, share, day-detail) each wrap the kit Sheet
          internally and are mounted as sibling hosts below, so they are excluded here (via
          SELF_HOSTING_SHEETS) to avoid double-nesting. With these wired, every SheetId now resolves
          to a real component. */}
      {sheet !== null && !SELF_HOSTING_SHEETS.has(sheet) && (
        <Sheet visible onClose={closeSheet} reduceMotion={reduceMotion}>
          <SheetView sheet={sheet} />
        </Sheet>
      )}
      {/* Self-hosting sheet hosts — each renders the kit Sheet internally, so it is its own host
          (never nested inside the generic one) and is visible only while it is the active sheet. */}
      {sheet === 'onboarding' && <OnboardingSheet visible onClose={closeSheet} />}
      {sheet === 'edit-item' && <EditItemSheet visible onClose={closeSheet} />}
      {/* Edit-txn — the posted-transaction correction sheet. The shell threads the parked target id
          (the row the opener chose) so Save corrects THAT transaction via the store; with no target
          (cold open) the sheet keeps its safe inert fallback and edits nothing. */}
      {sheet === 'edit-txn' && <EditTxnSheet visible onClose={closeSheet} target={editTxnTarget} />}
      {sheet === 'log-spend' && <LogSpendSheet visible onClose={closeSheet} />}
      {sheet === 'sub-caught' && <SubCaughtSheet visible onClose={closeSheet} />}
      {sheet === 'add-event' && <AddEventSheet visible onClose={closeSheet} />}
      {sheet === 'calendar-export' && <CalendarExportSheet visible onClose={closeSheet} />}
      {sheet === 'calendar-connect' && <CalendarConnectSheet visible onClose={closeSheet} />}
      {/* Route-detail — the money-path point sheet. Owns its own kit Sheet, so it is a sibling host;
          it needs the shell's nav (its CTA bridges to the Calendar) and the shell's pressure default
          (the "Left after this" figure + Melo mood, threaded the same way as the screens). The tapped
          `point` is the money-path engine's job (@rn-engine), so it falls back to its own placeholder. */}
      {sheet === 'route-detail' && (
        <RouteDetailSheet visible onClose={closeSheet} nav={nav} pressure={activePressure} />
      )}
      {/* Melo-chat — the companion sheet. Self-hosting like RouteDetailSheet: it needs the shell's nav
          (its replies bridge to screens) and the shell's pressure default (the RN Nav contract carries
          no `.pressure`, so the shell threads it alongside). The shell threads the openMelo intent
          (prefill/seed) so an "Ask Melo" CTA opens the chat with its draft. */}
      {sheet === 'melo-chat' && (
        <MeloChatSheet
          visible
          onClose={closeSheet}
          nav={nav}
          pressure={activePressure}
          intent={meloIntent}
        />
      )}
      {/* Share — the share sheet. Self-hosting; needs only visible / onClose. */}
      {sheet === 'share' && <ShareSheet visible onClose={closeSheet} />}
      {/* Day-detail — the Calendar's full-detail day drill-in (Month cell / "+N" chip / Week day
          header). The shell threads the parked ISO day; a cold open (no payload, e.g. reached via
          the generic nav rather than a Calendar tap) falls back to today so the sheet always shows a
          meaningful day rather than an inert state. */}
      {sheet === 'day-detail' && (
        <SheetDayDetail
          visible
          onClose={closeSheet}
          nav={nav}
          date={dayDetailDate ?? todayIsoForDayDetail()}
        />
      )}
    </UndoProvider>
  );
}

// Local-date YYYY-MM-DD fallback for a cold-opened day-detail sheet (no payload threaded). Scoped to
// the shell so it never collides with a screen/sheet's own todayIso() helper.
function todayIsoForDayDetail(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// The SheetIds whose components own their own kit Sheet (visible / onClose). They are mounted as
// sibling hosts and so must be kept OUT of the generic single-sheet host above.
const SELF_HOSTING_SHEETS: ReadonlySet<NonNullable<SheetId>> = new Set([
  'onboarding',
  'edit-item',
  'edit-txn',
  'log-spend',
  'sub-caught',
  'add-event',
  'calendar-export',
  'calendar-connect',
  'route-detail',
  'melo-chat',
  'share',
  'day-detail',
]);

// ---------------------------------------------------------------------------
// Screen host — the real ported screens for the wired ScreenIds, and a calm PressureScreen
// placeholder (carrying only the screen title) for every screen not yet ported. Replaced wave by
// wave; the placeholder fallback still covers the whole ScreenId space.
// ---------------------------------------------------------------------------

function ScreenView({ screen, nav, pressure }: { screen: ScreenId; nav: Nav; pressure: Pressure }) {
  // Wave 1 — the real ported screens.
  if (screen === 'start') return <StartScreen nav={nav} />;
  if (screen === 'today') return <TodayScreen nav={nav} pressure={pressure} />;

  // Wave 2 — the intake / reader-state / review surfaces.
  if (screen === 'intake') return <IntakeScreen nav={nav} />;
  if (screen === 'pdf-success') return <PdfSuccessScreen nav={nav} />;
  if (screen === 'pdf-fallback') return <PdfFallbackScreen nav={nav} />;
  if (screen === 'image-success') return <ImageSuccessScreen nav={nav} />;
  if (screen === 'image-fallback') return <ImageFallbackScreen nav={nav} />;
  if (screen === 'paste-success') return <PasteSuccessScreen nav={nav} />;
  if (screen === 'visualizer') return <VisualizerScreen nav={nav} />;
  if (screen === 'review') return <ReviewScreen nav={nav} />;
  // AddEntryScreen is reused for both kinds via the `kind` prop (bill | debt).
  if (screen === 'add-bill') return <AddEntryScreen nav={nav} kind="bill" />;
  if (screen === 'add-debt') return <AddEntryScreen nav={nav} kind="debt" />;

  // Wave 3 — the set-aside / recurring / retrospective / close-the-cycle surfaces. Pots threads the
  // shell's pressure default (mirrors TodayScreen — the Nav contract carries no pressure).
  if (screen === 'pots') return <PotsScreen nav={nav} pressure={pressure} />;
  if (screen === 'subs') return <SubscriptionsScreen nav={nav} />;
  if (screen === 'insights') return <InsightsScreen nav={nav} />;
  if (screen === 'ritual') return <PaydayRitualScreen nav={nav} />;

  // Wave 4a — the time view of the money: three planner views over one derived timeline. Opens the
  // add-event / calendar-export / calendar-connect sheets (all hosted as siblings above).
  if (screen === 'calendar') return <CalendarScreen nav={nav} />;

  // Wave 4b — the spend-preview / shortfall / recovery / after-a-change surfaces. WhatIf threads the
  // shell's pressure default (mirrors Today / Pots — the Nav contract carries no pressure); the route
  // re-draw (TodayAfter), the gap + moves (Shortfall), and the corrective bundle (Recovery) all render
  // the design state off the not-yet-built money-path engine (@rn-engine money-path). TodayAfter +
  // Recovery open the route-detail / melo-chat sheets hosted above.
  if (screen === 'whatif') return <WhatIfScreen nav={nav} pressure={pressure} />;
  if (screen === 'shortfall') return <ShortfallScreen nav={nav} />;
  if (screen === 'recovery') return <RecoveryScreen nav={nav} />;
  if (screen === 'today-after') return <TodayAfterScreen nav={nav} />;

  // Wave 5 — the hub / data-trust / time-of-record / commitments / rough-number / companion surfaces,
  // completing the full UI. `more` is the hub, `privacy` the data-trust page, `timeline` the
  // what-you-added view, `plans` the what's-coming list, `guided` the rough-number check-in, and
  // `melo` the standalone companion (threaded the shell's pressure default — the Nav contract carries
  // no pressure, mirroring Today / Pots / WhatIf / MeloChat).
  if (screen === 'more') return <MoreScreen nav={nav} />;
  if (screen === 'privacy') return <PrivacyScreen nav={nav} />;
  if (screen === 'timeline') return <TimelineScreen nav={nav} />;
  if (screen === 'plans') return <PlansScreen nav={nav} />;
  if (screen === 'guided') return <GuidedCheckInScreen nav={nav} />;
  if (screen === 'melo') return <MeloScreen nav={nav} pressure={pressure} />;

  // Batch 5 — Melo + chat + paywall + account. Paywall and Account read only real store data (no
  // fabricated lens/billing engine — see each screen's FIDELITY DECISIONS header).
  if (screen === 'paywall') return <PaywallScreen nav={nav} />;
  if (screen === 'account') return <AccountScreen nav={nav} />;

  // Every other screen is still a placeholder — a calm title through the editorial Headline.
  const title = SCREEN_TITLE[screen];
  return (
    <PressureScreen>
      <Headline accent={title} />
    </PressureScreen>
  );
}

// ---------------------------------------------------------------------------
// Screen error boundary — the RN port of the web ScreenErrorBoundary (folio-melo shell). One screen
// throwing renders a calm, on-brand fallback inside the same paper canvas instead of crashing the
// whole shell. React has no functional error boundary, so this is a small class component — the only
// class in the shell, kept minimal. The fallback is built from existing kit primitives (no new
// tokens, no fabricated Melo glyph the kit does not export): a PressureScreen, an editorial Headline
// whose accent word is the design's "tripped.", a calm reassurance line, and a "Try again" action.
//
// `screenLabel` doubles as a reset key: when the user navigates to a different screen the boundary
// clears any captured error (mirrors the web wrapper's `key={screen}` remount), so a fresh screen is
// never hidden behind a stale crash.
// ---------------------------------------------------------------------------

type ScreenErrorBoundaryProps = {
  children: ReactNode;
  screenLabel: ScreenId;
  onReset: () => void;
};
type ScreenErrorBoundaryState = { error: Error | null; forLabel: ScreenId };

class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  override state: ScreenErrorBoundaryState = { error: null, forLabel: this.props.screenLabel };

  static getDerivedStateFromError(error: Error): Partial<ScreenErrorBoundaryState> {
    return { error };
  }

  // A navigation to a different screen clears a prior crash (the web wrapper remounts on `key`).
  static getDerivedStateFromProps(
    props: ScreenErrorBoundaryProps,
    state: ScreenErrorBoundaryState,
  ): Partial<ScreenErrorBoundaryState> | null {
    if (props.screenLabel !== state.forLabel) {
      return { error: null, forLabel: props.screenLabel };
    }
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Quiet by design — the shell is not wired to a logger. Surface enough to debug in dev.
    // eslint-disable-next-line no-console
    console.error('Screen crashed:', this.props.screenLabel, error, info);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset();
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <PressureScreen centered>
          <Muted style={errorStyles.eyebrow}>A small slip</Muted>
          <Headline accent="This screen tripped." style={errorStyles.headline} />
          <Body style={errorStyles.body}>
            Nothing was lost. The rest of Folio is still here — try the screen again, or head back
            to Today.
          </Body>
          <View style={errorStyles.action}>
            <PrimaryAction label="Try again" onPress={this.handleReset} />
          </View>
        </PressureScreen>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  eyebrow: { marginBottom: 8 },
  headline: { marginBottom: 12 },
  body: { marginBottom: 24 },
  action: { alignSelf: 'stretch' },
});

// ---------------------------------------------------------------------------
// Placeholder sheet body — a title for the active sheet. `null` renders nothing (the host is
// closed). Replaced wave by wave alongside the screens.
// ---------------------------------------------------------------------------

const SHEET_TITLE: Readonly<Record<NonNullable<SheetId>, string>> = {
  'route-detail': 'This day',
  'edit-txn': 'Edit',
  'edit-item': 'Edit',
  'melo-chat': 'Melo',
  share: 'Share',
  onboarding: 'Welcome',
  'log-spend': 'Log a spend',
  'log-invoice': 'Log an invoice',
  'log-payment': 'Log a payment',
  'add-plan': 'Add a plan',
  'household-setup': 'Household',
  'sub-caught': 'A recurring charge',
  'add-event': 'Add to your calendar',
  'calendar-export': 'Export your calendar',
  'calendar-connect': 'Connect your calendar',
  'safe-zone': 'Your Safe Zone',
  shelf: '24-Hour Shelf',
  'afford-check': 'Before you spend',
  'lens-picker': 'Choose a lens',
  'chart-style': 'Path style',
  'hidden-review': 'Hidden',
  'day-detail': 'This day',
};

function SheetView({ sheet }: { sheet: SheetId }) {
  if (sheet === null) return null;
  return (
    <>
      <Headline accent={SHEET_TITLE[sheet]} />
      <Body>Coming soon.</Body>
    </>
  );
}

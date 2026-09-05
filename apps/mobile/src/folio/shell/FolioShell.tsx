// FolioShell — the self-contained nav state machine for the faithful RN port of the web folio.
//
// This is the RN mirror of the web shell at folio-melo/src/routes/index.tsx (the screen-router
// switch + sheet host). The web index also carries a showcase chrome (hero, chapter rail, ⌘K
// palette) that is explicitly web-only and NOT ported; what ports is the navigation core: a
// screen-router keyed by ScreenId, the bottom nav, and a single-sheet host keyed by SheetId.
//
// The wave-by-wave placeholder rollout this header originally described is DONE: every ScreenId
// (`ScreenView` below) and every SheetId (`SELF_HOSTING_SHEETS` below) now resolves to a real,
// ported component. The calm PressureScreen-title placeholder (`ScreenView`'s final fallback) and
// the generic single-sheet host's `SheetView` (also below) are kept only as an exhaustive fallback
// for the whole ScreenId/SheetId space — neither is reachable with the current unions, so neither
// renders in practice. No fabricated data, no scaffolding text. The shell composes the existing
// pressure-map kit (BottomNav / Sheet / PressureScreen / Headline) so there is zero styling drift;
// it introduces no new tokens.
//
// ThemeProvider is mounted once at the app root (app/_layout.tsx) — the shell never remounts it.

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  AccessibilityInfo,
  Alert,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// Matches errorReporting.ts's own import — that module only inits Sentry, it exposes no
// captureException helper, so componentDidCatch below imports the SDK directly.
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useBillingLifecycle } from '@/folio/lib/billing/billingLifecycle';

import {
  BottomNav,
  Body,
  Headline,
  Muted,
  PressureScreen,
  PrimaryAction,
  serif,
  useTheme,
} from '@/surfaces/pressureMap/kit';
import {
  getSurfaceRepaintEpoch,
  subscribeSurfaceRepaint,
} from '@/surfaces/pressureMap/sheetRepaint';
import type { ProductScreen } from '@/surfaces/pressureMap/productScreen';
import { Sheet, SheetPortalProvider } from '@/surfaces/pressureMap/Sheet';

import { StartScreen } from '@/folio/screens/StartScreen';
import { TodayScreen } from '@/folio/screens/TodayScreen';
import { TodayModeScreen } from '@/folio/screens/TodayModeScreen';
import { TodayStabilityScreen } from '@/folio/screens/TodayStabilityScreen';
import { BusinessTodayScreen } from '@/folio/screens/BusinessTodayScreen';
import { BusinessMoreScreen } from '@/folio/screens/BusinessMoreScreen';
import { BusinessMeloScreen } from '@/folio/screens/BusinessMeloScreen';
import { BusinessMoneyScreen } from '@/folio/screens/BusinessMoneyScreen';
import { BusinessReviewScreen } from '@/folio/screens/BusinessReviewScreen';
import { BusinessEntitySetupScreen } from '@/folio/screens/BusinessEntitySetupScreen';
import { BusinessOperationsScreen } from '@/folio/screens/BusinessOperationsScreen';
import {
  BusinessCalendarScreen,
  BusinessPlansScreen,
} from '@/folio/screens/business/BusinessPlanningScreens';
import { IntakeScreen } from '@/folio/screens/IntakeScreen';
import { AddEntryScreen } from '@/folio/screens/AddEntryScreen';
import { ReviewScreen } from '@/folio/screens/ReviewScreen';
import { ReviewHubScreen } from '@/folio/screens/ReviewHubScreen';
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
import { MoreSearchScreen } from '@/folio/screens/MoreSearchScreen';
import { PrivacyScreen } from '@/folio/screens/PrivacyScreen';
import { TimelineScreen } from '@/folio/screens/TimelineScreen';
import { PlansScreen } from '@/folio/screens/PlansScreen';
import { PlanScreen } from '@/folio/screens/PlanScreen';
import { DebtsScreen } from '@/folio/screens/DebtsScreen';
import { GuidedCheckInScreen } from '@/folio/screens/GuidedCheckInScreen';
import { MeloScreen } from '@/folio/screens/MeloScreen';
import { PaywallScreen } from '@/folio/screens/PaywallScreen';
import { AccountScreen } from '@/folio/screens/AccountScreen';
import { ConnectionsScreen } from '@/folio/screens/ConnectionsScreen';
import { OnboardingSheet } from '@/folio/sheets/OnboardingSheet';
import { AppearanceSheet } from '@/folio/sheets/AppearanceSheet';
import { EditTxnSheet } from '@/folio/sheets/EditTxnSheet';
import { LogSpendSheet } from '@/folio/sheets/LogSpendSheet';
import { SubCaughtSheet } from '@/folio/sheets/SubCaughtSheet';
import { IncomeCaughtSheet } from '@/folio/sheets/IncomeCaughtSheet';
import { AddEventSheet } from '@/folio/sheets/AddEventSheet';
import { CalendarExportSheet } from '@/folio/sheets/CalendarExportSheet';
import { CalendarConnectSheet } from '@/folio/sheets/CalendarConnectSheet';
import { SheetDayDetail } from '@/folio/sheets/SheetDayDetail';
import { RouteDetailSheet } from '@/folio/sheets/RouteDetailSheet';
import { MeloChatSheet } from '@/folio/sheets/MeloChatSheet';
import { ShareSheet } from '@/folio/sheets/ShareSheet';
import { AffordCheckSheet } from '@/folio/sheets/AffordCheckSheet';
import { ShelfSheet } from '@/folio/sheets/ShelfSheet';
import { ChartStyleSheet } from '@/folio/sheets/ChartStyleSheet';
import { HiddenReviewSheet } from '@/folio/sheets/HiddenReviewSheet';
import { LogInvoiceSheet } from '@/folio/sheets/LogInvoiceSheet';
import { LensPickerSheet } from '@/folio/sheets/LensPickerSheet';
import { SafeZoneSheet } from '@/folio/sheets/SafeZoneSheet';
import { AddPlanSheet } from '@/folio/sheets/AddPlanSheet';
import { AddDebtSheet } from '@/folio/sheets/AddDebtSheet';
import { LogPaymentSheet } from '@/folio/sheets/LogPaymentSheet';
import { HouseholdSetupSheet } from '@/folio/sheets/HouseholdSetupSheet';
import { WorkspaceSheet } from '@/folio/sheets/WorkspaceSheet';
import { BillCaughtSheet } from '@/folio/sheets/BillCaughtSheet';
import { DriftCaughtSheet } from '@/folio/sheets/DriftCaughtSheet';
import { AnnualCaughtSheet } from '@/folio/sheets/AnnualCaughtSheet';
import { UndoProvider } from '@/folio/ui/useUndo';
import { ToastHost } from '@/folio/ui/Toast';
import { UndoToast } from '@/folio/ui/UndoToast';
import { AppLockGate } from '@/folio/ui/AppLockGate';
import { RootErrorFallback } from '@/folio/ui/RootErrorFallback';
import { ShellMeloCompanion } from '@/folio/ui/ShellMeloCompanion';
import { reanchorSubRenewals, useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { endLensTrialIfExpired, useLens } from '@/folio/lib/lens';
import {
  getHydrationOutcome,
  requestPersistenceRetry,
  type HydrationOutcome,
} from '@/folio/lib/persist';
import {
  getPersistenceRuntimeState,
  subscribePersistenceRuntime,
} from '@/folio/lib/persistenceRuntime';
import { derivePressure } from '@/folio/screens/today/pressure';
import { triggerFeedback } from '@/folio/lib/feedback';
import type { MeloIntent, Nav, Pressure, ScreenId, SheetId, SheetPayload } from '@/folio/types';
import {
  getParityHarnessConfig,
  getParityRuntimeControl,
  startParityRuntimeControl,
  subscribeParityRuntimeControl,
} from '@/folio/parity/parityHarness';
import { getParityDecisionDialog } from '@/folio/parity/decisionDialogs';
import { getParityStatusDialog } from '@/folio/ui/statusDialogs';

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
  'review-item': 'Check this',
  today: 'Today',
  'today-mode': 'Today',
  'today-stability': 'Today',
  'today-after': 'After',
  whatif: 'What if',
  plan: 'Plan',
  debts: 'Debts',
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
  search: 'Search Melo',
  privacy: 'Privacy',
  melo: 'Melo',
  paywall: 'Melo plans',
  account: 'Account',
  connections: 'Money sources',
  'business-entity-setup': 'Business type',
  'business-runway': 'Cash runway',
  'business-clients': 'Clients',
  'business-invoices': 'Invoices',
  'business-obligations': 'Recurring money out',
  'business-vat': 'VAT',
  'business-corp-tax': 'Corporation Tax',
  'business-payroll': 'Payroll',
  'business-dividends': 'Dividends',
  'business-dla': "Director's loan",
  'business-companies-house': 'Companies House',
  'business-filings': 'Filings',
  'business-filing-vat': 'VAT working copy',
  'business-filing-sa': 'Self-Assessment working copy',
  'business-filing-ct': 'CT600 working copy',
  'business-filing-cs': 'CS01 working copy',
  'business-filing-accounts': 'Accounts working copy',
  'business-filing-payroll': 'Payroll working copy',
  'business-insights': 'Business insights',
  'business-deductions': 'Business deductions',
};

// ---------------------------------------------------------------------------
// Tab <-> screen bridge. The kit's BottomNav speaks the pressure-map ProductScreen ids
// (today / plans / import / more — the Review tab carries the id `import`). The shell navigates by
// web ScreenId (where the same screen is `review`). These two functions are the only place the two
// vocabularies meet, so the kit stays untouched and the web nav semantics are preserved.
// ---------------------------------------------------------------------------

// The screens that nest under the More tab — every leaf reachable from the More hub. Faithful to
// the web TabBar's `moreSubtree` (TabBar.tsx): each of these lights the More tab. The RN union also
// carries `shortfall` (a More-reachable leaf in this port), so it is included here too.
//
// `timeline` is deliberately NOT in this set even though the More hub still links to it (MoreScreen's
// "Timeline" row) — it is now the Review tab's persistent destination (see activeTabForScreen below),
// so reaching it via More correctly lights the Review tab, not More. `activeTabForScreen` resolves
// `timeline` explicitly before ever consulting this set, so this omission is load-bearing, not an
// oversight.
const MORE_SUBTREE: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'more',
  'search',
  'melo',
  'paywall',
  'privacy',
  'insights',
  'account',
  'connections',
  'business-entity-setup',
  'business-runway',
  'business-clients',
  'business-invoices',
  'business-obligations',
  'business-vat',
  'business-corp-tax',
  'business-payroll',
  'business-dividends',
  'business-dla',
  'business-companies-house',
  'business-filings',
  'business-filing-vat',
  'business-filing-sa',
  'business-filing-ct',
  'business-filing-cs',
  'business-filing-accounts',
  'business-filing-payroll',
  'business-insights',
  'business-deductions',
]);

const PLAN_SUBTREE: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'plan',
  'debts',
  'plans',
  'calendar',
  'subs',
  'pots',
  'add-bill',
  'add-debt',
  'whatif',
  'recovery',
  'ritual',
  'shortfall',
]);

// Which bottom-tab lights up for a given screen. Faithful to the web TabBar's active-state map, with
// one deliberate RN deviation: Today lights for `today` + `today-after`; the Review tab (kit id
// `import`) lights for its stable hub, Timeline, the transient import preview and the one-candidate
// detail; Melo lights for `melo`; the whole More subtree lights the More tab. Anything else falls
// back to Today (the home anchor).
//
// `ReviewHubScreen` is the persistent destination: it composes pending proposals, confirmed
// activity and durable decisions without merging those authorities. The pinned `visualizer` owner
// is a Timeline-family alias, while `review-item` remains the focused candidate descendant.
function activeTabForScreen(screen: ScreenId, business: boolean): ProductScreen {
  if (screen === 'today' || screen === 'today-after') return 'today';
  if (business && PLAN_SUBTREE.has(screen)) return 'money';
  if (PLAN_SUBTREE.has(screen)) return 'plans';
  if (
    screen === 'timeline' ||
    screen === 'visualizer' ||
    screen === 'review' ||
    screen === 'review-item'
  )
    return 'import';
  if (MORE_SUBTREE.has(screen)) return 'more';
  return 'today';
}

// The screen a bottom-tab press navigates to. The kit's Review tab (id `import`) opens the stable
// Review hub; Timeline and the one-candidate review remain descendants of the same tab.
function screenForTab(tab: ProductScreen, business: boolean): ScreenId {
  if (business && tab === 'money') return 'plan';
  if (business && tab === 'import') return 'timeline';
  if (tab === 'plans') return 'plan';
  if (tab === 'import') return 'review';
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
  useBillingLifecycle();
  const t = useTheme();
  const parity = useMemo(() => getParityHarnessConfig(), []);
  const parityRuntime = useSyncExternalStore(
    subscribeParityRuntimeControl,
    getParityRuntimeControl,
    getParityRuntimeControl,
  );
  // In-memory nav state — the doorway is `start`, but the home tab is `today`. The web index lands
  // on `start`; here the shell opens on `today` so the bottom nav has a lit home from the first
  // frame (Start is reachable but is not a tab). One screen, one optional sheet.
  const [screen, setScreen] = useState<ScreenId>(parity?.screen ?? 'today');
  const [sheet, setSheet] = useState<SheetId>(parity?.sheet ?? null);
  const [workspaceSheetVisible, setWorkspaceSheetVisible] = useState(false);
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
  // Carried into the add-event sheet when a flow opens it with a deep-link prefill (web
  // intent.addEventKind / intent.addEventTitle) — e.g. a lens CTA like "Add a bill". Mirrors the
  // editTxnTarget/dayDetailDate slots exactly: set when openSheet('add-event', { addEventKind,
  // addEventTitle }) is called, cleared whenever a sheet closes or a navigation supersedes it.
  const [addEventIntent, setAddEventIntent] = useState<SheetPayload | undefined>(undefined);
  // Carried into quick spend entry only after the user explicitly chooses to turn a preview into a
  // real log. A scrub or What-if experiment never writes by itself.
  const [logSpendAmount, setLogSpendAmount] = useState<number | undefined>(undefined);
  const [navigationPaintEpoch, setNavigationPaintEpoch] = useState(0);
  const surfaceRepaintEpoch = useSyncExternalStore(
    subscribeSurfaceRepaint,
    getSurfaceRepaintEpoch,
    getSurfaceRepaintEpoch,
  );
  const reduceMotion = useReducedMotion();
  // Capture-time navigation uses the same history authority as interactive navigation, but resets
  // it to the requested surface so a batch deep link never inherits the previous capture's trail.
  const historyRef = useRef<ScreenId[]>(['today']);

  useEffect(() => startParityRuntimeControl(), []);

  useEffect(() => {
    if (parity === null || parityRuntime === null) return;
    // Capture-only diagnostics used by the bulk driver to reject stale route/sheet frames.
    // eslint-disable-next-line no-console
    console.info('[parity-shell]', JSON.stringify(parityRuntime));
    historyRef.current = [parityRuntime.screen];
    setWorkspaceSheetVisible(false);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
    setAddEventIntent(undefined);
    setLogSpendAmount(undefined);
    setScreen(parityRuntime.screen);
    setSheet(parityRuntime.sheet);
  }, [parity, parityRuntime]);

  useEffect(() => {
    if (parityRuntime === null || parityRuntime.globalSurface === 'global.boot-splash') return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [parityRuntime]);

  useEffect(() => {
    if (parity === null || parityRuntime?.dialog === null || parityRuntime === null) return;
    const dialog =
      getParityDecisionDialog(parityRuntime.dialog) ?? getParityStatusDialog(parityRuntime.dialog);
    if (dialog === null) return;
    // Alert is intentionally delayed until the requested owner screen/sheet has committed. This
    // path exists only in a capture APK, and inert handlers prevent evidence runs from mutating the
    // deterministic fixture while preserving the production Alert contract and native chrome.
    const timer = setTimeout(() => {
      Alert.alert(
        dialog.title,
        dialog.message ?? undefined,
        dialog.buttons.map((button) => ({ ...button, onPress: () => undefined })),
        { cancelable: false },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [parity, parityRuntime]);

  // More-subtree navigation keeps the same active tab. Android Fabric can therefore finish the
  // route commit while treating the visually unchanged tab strip as reusable, even when its first
  // native buffer was incomplete. Remount the static strip after the originating Pressable has
  // released and again at the end of the short native settle window. This changes no screen state
  // and creates no animated hardware layer; it only asks Fabric to paint four fresh tab children.
  useEffect(() => {
    const afterPress = setTimeout(() => setNavigationPaintEpoch((value) => value + 1), 90);
    const afterSettle = setTimeout(() => setNavigationPaintEpoch((value) => value + 1), 260);
    return () => {
      clearTimeout(afterPress);
      clearTimeout(afterSettle);
    };
  }, [screen]);

  // Back-history stack — a faithful port of the web shell's `historyRef` (HeroPhone.tsx): `go` pushes
  // the destination, `back` pops to the previous screen. The shell opens on `today` (not the web's
  // `start`), so the stack is seeded with `today` and `back` falls back to `today` when it empties.
  // A ref (not state) so pushing/popping the trail never itself triggers a re-render — the screen
  // state drives rendering; this only records where the user came from.
  // The onboarding gate reads the live store flag (faithful to the web index, which reads
  // `useAppStore((s) => s.onboarding.done)`). A returning, set-up user is never offered onboarding.
  const onboardingDone = useAppStore((st) => st.onboarding.done);
  const pendingReviewCount = useAppStore((st) => st.reviewQueue?.length ?? 0);
  const activeWorkspaceId = useAppStore((st) => st.activeWorkspaceId);
  const activeWorkspace = useAppStore((st) =>
    st.workspaces.find((workspace) => workspace.id === st.activeWorkspaceId),
  );
  const businessWorkspaceActive = activeWorkspace?.kind === 'business';
  const tinyWins = useAppStore((st) => st.tinyWins);
  const milestoneSoundsEnabled = useAppStore((st) => st.melo?.soundEnabled === true);
  const feedbackQuietMode = useAppStore((st) => st.melo?.quietMode === true);
  const newestWinId = tinyWins?.[0]?.id;
  const observedWinId = useRef(newestWinId);
  useEffect(() => {
    if (newestWinId === undefined || newestWinId === observedWinId.current) return;
    observedWinId.current = newestWinId;
    void triggerFeedback('earn-stamp', {
      soundEnabled: milestoneSoundsEnabled,
      quietMode: feedbackQuietMode,
    });
  }, [feedbackQuietMode, milestoneSoundsEnabled, newestWinId]);

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
    setWorkspaceSheetVisible(false);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
    setAddEventIntent(undefined);
    setLogSpendAmount(undefined);
    setScreen(next);
  }, []);

  const back = useCallback(() => {
    // Pop the current screen off the trail and return to the previous one — a faithful port of the
    // web nav.back (historyRef.pop() then setScreen to the new top). Back also closes any open
    // sheet and clears a pending intent, matching go's "a navigation supersedes a transient sheet"
    // contract. The 'today' seed is never popped: UI Back buttons call this directly (no depth
    // guard like the hardware handler), and popping the seed would leave the NEXT go() as a
    // length-1 stack whose hardware back exits the app from a non-root screen.
    if (historyRef.current.length > 1) historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1] ?? 'today';
    setSheet(null);
    setWorkspaceSheetVisible(false);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
    setAddEventIntent(undefined);
    setLogSpendAmount(undefined);
    setScreen(prev);
  }, []);

  // Open a sheet, carrying the optional payload for sheets that need a real subject. 'edit-txn'
  // reads `payload.id` (the posted transaction the user chose to correct), parked in the
  // editTxnTarget slot and threaded into <EditTxnSheet target={...}>. 'day-detail' reads
  // `payload.date` (the ISO day a Month cell / "+N" chip / Week day header resolved), parked in the
  // dayDetailDate slot and threaded into <SheetDayDetail date={...}>. Any other sheet ignores the
  // payload and both slots are cleared, so opening a different sheet never carries a stale target.
  const openSheet = useCallback((next: SheetId, payload?: SheetPayload) => {
    setWorkspaceSheetVisible(false);
    setEditTxnTarget(next === 'edit-txn' ? payload?.id : undefined);
    setDayDetailDate(next === 'day-detail' ? payload?.date : undefined);
    setAddEventIntent(next === 'add-event' ? payload : undefined);
    setLogSpendAmount(next === 'log-spend' ? payload?.amount : undefined);
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
    setAddEventIntent(undefined);
    setLogSpendAmount(undefined);
  }, []);

  // Open the Melo companion CHAT sheet, carrying any prefill/seed the flow provided (web intent).
  // The Melo mood SCREEN is a separate surface reached via go('melo'); openMelo is the local
  // companion sheet. Every "Ask Melo" CTA lands here.
  const openMelo = useCallback((opts?: MeloIntent) => {
    setWorkspaceSheetVisible(false);
    setMeloIntent(opts);
    setSheet('melo-chat');
  }, []);

  // The single Nav contract handed to every ported screen (RN mirror of the web Nav). Memoised so a
  // child holding it as a dep doesn't churn; its members are themselves stable callbacks.
  const nav = useMemo<Nav>(
    () => ({
      go,
      back,
      openSheet,
      openWorkspace: () => {
        closeSheet();
        setWorkspaceSheetVisible(true);
      },
      openMelo,
      setPressure: setPressureOverride,
    }),
    [go, back, openSheet, closeSheet, openMelo],
  );

  const workspaceActivated = useCallback((_workspaceId: typeof activeWorkspaceId) => {
    historyRef.current = ['today'];
    setWorkspaceSheetVisible(false);
    setSheet(null);
    setMeloIntent(undefined);
    setEditTxnTarget(undefined);
    setDayDetailDate(undefined);
    setAddEventIntent(undefined);
    setLogSpendAmount(undefined);
    setPressureOverride(null);
    setScreen('today');
  }, []);

  // Android hardware back — bridged to the shell's own nav machine, in UI-stack order: an open
  // sheet closes first, then the back-history pops, and only at the root (Today, empty trail) does
  // the event fall through to the OS so back can background the app. Without this the system back
  // exited the app from ANY depth (expo-router only ever sees one route; the shell's history lived
  // in component state the OS knew nothing about).
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (workspaceSheetVisible) {
        setWorkspaceSheetVisible(false);
        return true;
      }
      if (sheet !== null) {
        closeSheet();
        return true;
      }
      if (historyRef.current.length > 1) {
        back();
        return true;
      }
      return false; // at the root — let the OS handle it.
    });
    return () => subscription.remove();
  }, [workspaceSheetVisible, sheet, back, closeSheet]);

  // Lens-trial relock — the enforcement behind the "Auto-locks" trial copy. Checked once at mount
  // (the shell mounts only after the store hydrates, see app/index.tsx) and again every time the
  // app returns to the foreground, so a trial whose end date passed while the app was closed locks
  // on the next open rather than living forever. Date math lives in lib/lens.ts
  // (`endLensTrialIfExpired` — same end date the countdown chip displays).
  //
  // Renewal re-anchor rides the same moments: every sub's relative day count is re-derived from
  // its persisted date anchor (store.ts `reanchorSubRenewals` → lib/renewalMath.ts), so a phone
  // that stays alive across midnight stops carrying yesterday's day counts. load() covers boot.
  useEffect(() => {
    endLensTrialIfExpired();
    reanchorSubRenewals();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        endLensTrialIfExpired();
        reanchorSubRenewals();
      }
    });
    return () => subscription.remove();
  }, []);

  // Onboarding gate — byte-faithful to the web index: the first time the user reaches Today while
  // onboarding is not done, offer the onboarding sheet once, after a short settle delay. `offered`
  // latches so it never re-fires; the timeout is cleaned up on unmount / dep change.
  const offeredOnboarding = useRef(false);
  useEffect(() => {
    if (parity === null && screen === 'today' && !onboardingDone && !offeredOnboarding.current) {
      offeredOnboarding.current = true;
      const id = setTimeout(() => setSheet('onboarding'), ONBOARDING_OFFER_DELAY_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [screen, onboardingDone, parity]);

  // The bottom-tab press maps the kit's ProductScreen id back to a web ScreenId, then navigates.
  const onTabChange = useCallback(
    (tab: ProductScreen) => go(screenForTab(tab, businessWorkspaceActive)),
    [businessWorkspaceActive, go],
  );

  const activeTab = useMemo(
    () => activeTabForScreen(screen, businessWorkspaceActive),
    [businessWorkspaceActive, screen],
  );

  const captureGlobalSurface = parityRuntime?.globalSurface ?? parity?.globalSurface ?? null;
  if (captureGlobalSurface === 'global.app-lock-gate') {
    return <AppLockGate busy={false} message={null} onUnlock={() => undefined} />;
  }
  if (captureGlobalSurface === 'global.root-error-boundary') return <RootErrorFallback />;

  return (
    // The undo provider wraps the whole shell so every screen can raise a Tier-1 undo window
    // (ENGINES §6) via useUndo(); its snackbar host renders above the screen + bottom nav.
    <UndoProvider>
      <SheetPortalProvider>
        <View collapsable={false} style={[shellStyles.root, { backgroundColor: t.canvas }]}>
          {/* Data-loss visibility — when hydration recovered from the backup or found the saved blob
          unreadable, say so ONCE, visibly, instead of booting an empty app that reads as a fresh
          install (silence must never look identical to success). */}
          <HydrationNotice />
          <PersistenceSaveNotice
            forceFailed={captureGlobalSurface === 'global.persistence-save-notice'}
          />
          {/* Every screen renders inside the error boundary so one screen throwing renders a calm
          fallback instead of taking down the whole shell (faithful to the web HeroPhone, which wraps
          its screen switch in ScreenErrorBoundary). `screenLabel` resets the boundary when the screen
          changes (a fresh navigation clears a prior crash); onReset returns to Today. */}
          {/* Replace the screen and its tab bar as one opaque native frame. Keying only the React
          boundary (or the two native siblings independently) lets Fabric commit the canvas and nav
          on different frames, which can expose stale/black pixels during More-subtree navigation.
          This grouped host gives Android one complete frame to paint, without a page-wide animation. */}
          <View
            collapsable={false}
            key={`route-frame-${screen}`}
            style={[shellStyles.routeFrame, { backgroundColor: t.canvas }]}
          >
            <View
              collapsable={false}
              style={[shellStyles.screenHost, { backgroundColor: t.canvas }]}
            >
              <ScreenErrorBoundary
                key={`screen-${screen}`}
                screenLabel={screen}
                onReset={() => go('today')}
                forceError={captureGlobalSurface === 'global.screen-error-boundary'}
              >
                <ScreenView screen={screen} nav={nav} pressure={activePressure} />
              </ScreenErrorBoundary>
            </View>
            {screen !== 'review' && screen !== 'plan' ? (
              <ShellMeloCompanion screen={screen} nav={nav} />
            ) : null}
            {businessWorkspaceActive ? (
              <BusinessWorkspaceBar label="Business" onPress={() => nav.openWorkspace?.()} />
            ) : null}
            <BottomNav
              key={`bottom-nav-screen-${screen}-${navigationPaintEpoch}-${surfaceRepaintEpoch}`}
              active={activeTab}
              onChange={onTabChange}
              reviewCount={pendingReviewCount}
              variant={businessWorkspaceActive ? 'business' : 'personal'}
            />
          </View>
          {/* Generic single-sheet host — every sheet that does NOT own its own Sheet. The self-hosting
          sheets (onboarding, appearance, edit-txn, log-spend, sub-caught, add-event, calendar-export,
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
          {sheet === 'appearance' && <AppearanceSheet visible onClose={closeSheet} />}
          {/* Edit-txn — the posted-transaction correction sheet. The shell threads the parked target id
          (the row the opener chose) so Save corrects THAT transaction via the store; with no target
          (cold open) the sheet keeps its safe inert fallback and edits nothing. */}
          {sheet === 'edit-txn' && (
            <EditTxnSheet visible onClose={closeSheet} target={editTxnTarget} />
          )}
          {sheet === 'log-spend' && (
            <LogSpendSheet visible onClose={closeSheet} initialAmount={logSpendAmount} />
          )}
          {sheet === 'sub-caught' && <SubCaughtSheet visible onClose={closeSheet} />}
          {sheet === 'income-caught' && <IncomeCaughtSheet visible onClose={closeSheet} />}
          {sheet === 'bill-caught' && <BillCaughtSheet visible onClose={closeSheet} />}
          {sheet === 'drift-caught' && <DriftCaughtSheet visible onClose={closeSheet} />}
          {sheet === 'annual-caught' && <AnnualCaughtSheet visible onClose={closeSheet} />}
          {sheet === 'add-event' && (
            <AddEventSheet visible onClose={closeSheet} intent={addEventIntent} />
          )}
          {sheet === 'calendar-export' && <CalendarExportSheet visible onClose={closeSheet} />}
          {sheet === 'calendar-connect' && <CalendarConnectSheet visible onClose={closeSheet} />}
          {sheet === 'log-invoice' && <LogInvoiceSheet visible onClose={closeSheet} />}
          {sheet === 'afford-check' && <AffordCheckSheet visible onClose={closeSheet} />}
          {sheet === 'shelf' && <ShelfSheet visible onClose={closeSheet} />}
          {sheet === 'chart-style' && <ChartStyleSheet visible onClose={closeSheet} />}
          {sheet === 'hidden-review' && <HiddenReviewSheet visible onClose={closeSheet} />}
          {sheet === 'add-plan' && <AddPlanSheet visible onClose={closeSheet} />}
          {/* Declare-debt — the real Debt-lens record (kind/APR/min-payment/due-day), faithful port of the
          web's SheetAddDebt. Distinct from the ScreenId 'add-debt' (AddEntryScreen's unrelated
          recurring bill/debt-payment quick-add) — see the SheetId union's doc-comment in types.ts. */}
          {sheet === 'declare-debt' && <AddDebtSheet visible onClose={closeSheet} />}
          {sheet === 'log-payment' && <LogPaymentSheet visible onClose={closeSheet} />}
          {sheet === 'household-setup' && <HouseholdSetupSheet visible onClose={closeSheet} />}
          {/* Lens-picker and Safe-Zone need the shell's nav (paywall/Melo bridges), so they mount as
          sibling hosts like RouteDetailSheet/MeloChatSheet rather than through the generic host. */}
          {sheet === 'lens-picker' && <LensPickerSheet visible onClose={closeSheet} nav={nav} />}
          {sheet === 'safe-zone' && <SafeZoneSheet visible onClose={closeSheet} nav={nav} />}
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
          <WorkspaceSheet
            visible={workspaceSheetVisible}
            onClose={() => setWorkspaceSheetVisible(false)}
            onActivated={workspaceActivated}
          />
          {/* Generic toast host — the web-parity confirmation surface (sonner toast(title, {description})
          ported). Mounted once at the top-level overlay, alongside the undo snackbar it never
          disturbs. */}
          <ToastHost
            capture={
              captureGlobalSurface === 'global.toast'
                ? {
                    title: 'Saved calmly',
                    description: 'Your latest change is safe on this device.',
                  }
                : undefined
            }
          />
          {captureGlobalSurface === 'global.undo-toast' ? (
            <UndoToast
              label="Removed from this plan"
              onUndo={() => undefined}
              onDismiss={() => undefined}
              durationMs={30_000}
              reduceMotion
            />
          ) : null}
        </View>
      </SheetPortalProvider>
    </UndoProvider>
  );
}

function BusinessWorkspaceBar({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <View style={[businessWorkspaceStyles.bar, { backgroundColor: t.surface }]}>
      <Pressable
        accessibilityHint="Opens workspace switching and business workspace controls."
        accessibilityLabel={`Business workspace: ${label}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed: isPressed }) => [
          businessWorkspaceStyles.control,
          isPressed ? { opacity: 0.62 } : undefined,
        ]}
      >
        <View style={[businessWorkspaceStyles.dot, { backgroundColor: t.calm }]} />
        <Text numberOfLines={1} style={[businessWorkspaceStyles.label, { color: t.ink }]}>
          {label}
        </Text>
        <Text
          accessibilityElementsHidden
          style={[businessWorkspaceStyles.arrow, { color: t.calmStrong }]}
        >
          ↓
        </Text>
      </Pressable>
    </View>
  );
}

const shellStyles = StyleSheet.create({
  root: { flex: 1 },
  routeFrame: { flex: 1 },
  screenHost: { flex: 1 },
});

const businessWorkspaceStyles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  control: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
    maxWidth: 220,
    paddingHorizontal: 12,
  },
  dot: { borderRadius: 999, height: 5, marginRight: 8, width: 5 },
  label: { fontFamily: serif.displayItalic, fontSize: 12.5 },
  arrow: { fontSize: 11, fontWeight: '600', marginLeft: 8 },
});

// ---------------------------------------------------------------------------
// Hydration notice — the visible face of lib/persist.ts's do-not-destroy contract. Reads the
// hydration outcome once at mount (it is set before the shell renders — app/index.tsx awaits
// loadPersisted before flipping `ready`) and shows a calm, dismissible card for recovery/loss
// states. 'ok' / 'first-run' render nothing.
// ---------------------------------------------------------------------------

const HYDRATION_NOTICE_COPY: Partial<Record<HydrationOutcome, { title: string; body: string }>> = {
  unreadable: {
    title: 'Your saved numbers could not be read',
    body:
      'The protected storage and its recovery copies on this device could not be opened, so the ' +
      'app has started with a blank slate. Melo has not treated that unreadable data as real ' +
      'money. Check local recovery before adding new numbers.',
  },
  'recovered-backup': {
    title: 'Restored from the last good save',
    body:
      'The newest saved file could not be read, so this picture comes from the previous good ' +
      'save. The unreadable file was kept, not deleted. Anything added after that save may be ' +
      'missing — worth a quick look at your balance.',
  },
  'recovered-legacy': {
    title: 'Your local data was recovered',
    body:
      'A storage upgrade did not finish cleanly, so Melo opened the last complete local copy and ' +
      'will keep trying to save it into the new protected storage. Your newer incomplete file was ' +
      'kept for recovery. It is worth checking your latest balance and activity.',
  },
  'recovered-file': {
    title: 'Your local data was recovered',
    body:
      'Melo could not use the newest protected database generation, so it opened the verified ' +
      'encrypted rollback copy and will keep trying to repair protected storage. It is worth ' +
      'checking your latest balance and activity.',
  },
};

function HydrationNotice() {
  const t = useTheme();
  const [outcome] = useState<HydrationOutcome>(() => getHydrationOutcome());
  const [dismissed, setDismissed] = useState(false);
  const copy = HYDRATION_NOTICE_COPY[outcome];
  if (dismissed || copy === undefined) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[noticeStyles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}
    >
      <Text style={[noticeStyles.title, { color: t.ink }]}>{copy.title}</Text>
      <Text style={[noticeStyles.body, { color: t.muted }]}>{copy.body}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss this notice"
        onPress={() => setDismissed(true)}
        style={({ pressed }) => [noticeStyles.dismiss, pressed ? noticeStyles.pressed : undefined]}
      >
        <Text style={[noticeStyles.dismissLabel, { color: t.calm }]}>OK</Text>
      </Pressable>
    </View>
  );
}

function PersistenceSaveNotice({ forceFailed = false }: { forceFailed?: boolean }) {
  const t = useTheme();
  const runtime = useSyncExternalStore(
    subscribePersistenceRuntime,
    getPersistenceRuntimeState,
    getPersistenceRuntimeState,
  );
  const retrying = !forceFailed && runtime.status === 'saving' && runtime.consecutiveFailures > 0;
  if (!forceFailed && runtime.status !== 'failed' && !retrying) return null;

  const body =
    runtime.failureKind === 'storage'
      ? 'Melo could not write the latest changes. Device storage may be full. The last complete save is still intact; free some space and keep Melo open while it retries.'
      : runtime.failureKind === 'key-storage'
        ? 'Melo could not reach protected device key storage. The last complete save is still intact. Unlock the device fully, then try again.'
        : 'Melo could not write the latest changes. The last complete save is still intact, and Melo will keep trying while the app stays open.';

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[noticeStyles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}
    >
      <Text style={[noticeStyles.title, { color: t.ink }]}>
        {retrying ? 'Trying to save again' : "Changes aren't saved yet"}
      </Text>
      <Text style={[noticeStyles.body, { color: t.muted }]}>{body}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try saving again"
        disabled={retrying}
        onPress={requestPersistenceRetry}
        style={({ pressed }) => [
          noticeStyles.dismiss,
          pressed || retrying ? noticeStyles.pressed : undefined,
        ]}
      >
        <Text style={[noticeStyles.dismissLabel, { color: t.calm }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

const noticeStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  title: { fontSize: 13.5, fontWeight: '600' },
  body: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  dismiss: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 8, paddingVertical: 4 },
  dismissLabel: { fontSize: 12.5, fontWeight: '500' },
  pressed: { opacity: 0.6 },
});

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
  'appearance',
  'edit-txn',
  'log-spend',
  'sub-caught',
  'income-caught',
  'bill-caught',
  'drift-caught',
  'annual-caught',
  'add-event',
  'calendar-export',
  'calendar-connect',
  'route-detail',
  'melo-chat',
  'share',
  'day-detail',
  'log-invoice',
  'afford-check',
  'shelf',
  'hidden-review',
  'add-plan',
  'declare-debt',
  'log-payment',
  'household-setup',
  'lens-picker',
  'safe-zone',
  'chart-style',
]);

// ---------------------------------------------------------------------------
// Today mode dispatch — the single `today` ScreenId fans out to one of three screens by the active
// Money Mode (Lens), mirroring the web's HeroPhone `effectiveMode` switch: Survival keeps its own
// money-path hero (TodayScreen), Stability gets its calm Safe Zone shell (TodayStabilityScreen), and
// the other eight parked lenses share one per-lens hero shell (TodayModeScreen).
// ---------------------------------------------------------------------------

function TodayByMode({ nav, pressure }: { nav: Nav; pressure: Pressure }) {
  const moneyMode = useAppStore((st) => st.moneyMode ?? 'survival');
  const lens = useLens();
  // Enforcement half of the lens lock (the web's `effectiveMode` gate, restored): a lens the user
  // can no longer access — trial ended, never unlocked — must not keep rendering its paid hero.
  // Falling back to Survival is what makes the LensLockChip's "Survival for now" / "back to
  // Survival" copy TRUE (TodayScreen shows that chip when the STORE mode is a locked paid lens),
  // and what makes the trial relock mean anything at all.
  const effectiveMode = lens.canAccess(moneyMode) ? moneyMode : 'survival';
  if (effectiveMode === 'survival') return <TodayScreen nav={nav} pressure={pressure} />;
  if (effectiveMode === 'stability') return <TodayStabilityScreen nav={nav} />;
  return <TodayModeScreen nav={nav} />;
}

// ---------------------------------------------------------------------------
// Screen host — every ScreenId now resolves to a real ported screen below (see the header note on
// wave-by-wave completion). The calm PressureScreen placeholder (title only) at the end of this
// function is unreachable with the current ScreenId union; it is kept as an exhaustive fallback so
// a future ScreenId added without a matching branch here degrades to a title screen instead of a
// blank one, rather than as a sign more waves are pending.
// ---------------------------------------------------------------------------

function ScreenView({ screen, nav, pressure }: { screen: ScreenId; nav: Nav; pressure: Pressure }) {
  const activeWorkspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
      'personal',
  );
  if (activeWorkspaceKind === 'business') {
    if (screen === 'today') return <BusinessTodayScreen nav={nav} />;
    if (screen === 'more') return <BusinessMoreScreen nav={nav} />;
    if (screen === 'melo') return <BusinessMeloScreen nav={nav} />;
    if (screen === 'review') return <BusinessReviewScreen nav={nav} />;
    if (screen === 'timeline') return <BusinessReviewScreen initialSegment="activity" nav={nav} />;
    if (screen === 'calendar') return <BusinessCalendarScreen nav={nav} />;
    if (screen === 'plan') return <BusinessMoneyScreen nav={nav} />;
    if (screen === 'plans') return <BusinessPlansScreen nav={nav} />;
    if (screen === 'business-entity-setup') return <BusinessEntitySetupScreen nav={nav} />;
    if (screen.startsWith('business-')) {
      return <BusinessOperationsScreen nav={nav} screen={screen} />;
    }
  }
  // Wave 1 — the real ported screens.
  if (screen === 'start') return <StartScreen nav={nav} />;
  // Today dispatches on the active Money Mode (Lens) — faithful to the web's HeroPhone
  // `effectiveMode` switch (ScreenToday for survival, ScreenTodayStability for stability,
  // ScreenTodayMode's shared per-lens hero shell for the other eight). `today-mode` /
  // `today-stability` exist in the ScreenId union for parity but are not separately navigated to —
  // the single `today` screen is the one entry point, exactly like the web's single route.
  if (screen === 'today') return <TodayByMode nav={nav} pressure={pressure} />;
  if (screen === 'today-mode') return <TodayModeScreen nav={nav} />;
  if (screen === 'today-stability') return <TodayStabilityScreen nav={nav} />;

  // Wave 2 — the intake / reader-state / review surfaces.
  if (screen === 'intake') return <IntakeScreen nav={nav} />;
  if (screen === 'pdf-success') return <PdfSuccessScreen nav={nav} />;
  if (screen === 'pdf-fallback') return <PdfFallbackScreen nav={nav} />;
  if (screen === 'image-success') return <ImageSuccessScreen nav={nav} />;
  if (screen === 'image-fallback') return <ImageFallbackScreen nav={nav} />;
  if (screen === 'paste-success') return <PasteSuccessScreen nav={nav} />;
  // The pinned owner routes `visualizer` to the Timeline family's "What Melo saw" view. Keep the
  // transient reader preview behind the intake flow, but make the shipping route honor its actual
  // source owner instead of presenting an unrelated empty import state.
  if (screen === 'visualizer') return <TimelineScreen nav={nav} initialTab="saw" />;
  if (screen === 'review') return <ReviewHubScreen nav={nav} />;
  if (screen === 'review-item') return <ReviewScreen nav={nav} />;
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
  if (screen === 'search') return <MoreSearchScreen nav={nav} />;
  if (screen === 'privacy') return <PrivacyScreen nav={nav} />;
  if (screen === 'timeline') return <TimelineScreen nav={nav} />;
  if (screen === 'plan') return <PlanScreen nav={nav} />;
  if (screen === 'debts') return <DebtsScreen nav={nav} />;
  if (screen === 'plans') return <PlansScreen nav={nav} />;
  if (screen === 'guided') return <GuidedCheckInScreen nav={nav} />;
  if (screen === 'melo') return <MeloScreen nav={nav} pressure={pressure} />;

  // Batch 5 — Melo + chat + paywall + account. Paywall and Account read only real store data (no
  // fabricated lens/billing engine — see each screen's FIDELITY DECISIONS header).
  if (screen === 'paywall') return <PaywallScreen nav={nav} />;
  if (screen === 'account') return <AccountScreen nav={nav} />;
  if (screen === 'connections') return <ConnectionsScreen nav={nav} />;

  // Exhaustive fallback only — every current ScreenId is handled above, so this branch is
  // unreachable today. Kept so an un-wired future ScreenId still renders a calm title instead of
  // nothing.
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
  forceError?: boolean;
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
    // Do not print exception text, component props or component stacks: screen state can include
    // merchant names and exact money values. The Sentry beforeSend hook receives the exception and
    // removes free-text/contextual payloads before any optional upload.
    // eslint-disable-next-line no-console
    console.error('Screen error boundary captured an application failure.');
    try {
      Sentry.captureException(error);
    } catch {
      /* telemetry is best-effort — never let capture crash the fallback. */
    }
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset();
  };

  override render(): ReactNode {
    if (this.state.error || this.props.forceError === true) {
      return (
        <PressureScreen centered>
          <Muted style={errorStyles.eyebrow}>A small slip</Muted>
          <Headline accent="This screen tripped." style={errorStyles.headline} />
          <Body style={errorStyles.body}>
            Nothing was lost. The rest of Melo is still here — try the screen again, or head back to
            Today.
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
// closed). Every current SheetId is in SELF_HOSTING_SHEETS (above) and mounts its own real sheet
// component as a sibling host, so the generic host that would render this component never mounts
// today — SheetView is unreachable, kept only as an exhaustive fallback for a future SheetId added
// without a matching self-hosting entry.
// ---------------------------------------------------------------------------

const SHEET_TITLE: Readonly<Record<NonNullable<SheetId>, string>> = {
  'route-detail': 'This day',
  'edit-txn': 'Edit',
  appearance: 'Appearance',
  'melo-chat': 'Melo',
  share: 'Share',
  onboarding: 'Welcome',
  'log-spend': 'Log a spend',
  'log-invoice': 'Log an invoice',
  'log-payment': 'Log a payment',
  'add-plan': 'Add a plan',
  'declare-debt': 'Add a debt',
  'household-setup': 'Household',
  'sub-caught': 'A recurring charge',
  'income-caught': 'A recurring payment',
  'bill-caught': 'A recurring bill',
  'drift-caught': 'A number that moved',
  'annual-caught': 'Once a year',
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

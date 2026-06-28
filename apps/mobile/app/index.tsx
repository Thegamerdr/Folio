import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import {
  addDocumentNote,
  buildLocalRouteSummary,
  buildMeloSnapshotFromLocalState,
  createEmptyLocalLedgerState,
  formatMinorAmount,
  isPrivateExampleLedger,
  refreshLocalLedgerAsOfDate,
  type CreateCycleRecordInput,
  type CreatePotInput,
  type DocumentItemInput,
  type LocalDocumentStageInput,
  type LocalImportRejectionReason,
  type LocalImportDraftEditInput,
  type LocalLedgerState,
  type LocalPlannedCommitmentInput,
  type LocalRouteSummary,
  type ManualTransactionInput,
  type QuickEstimateInput,
} from '../src/local/localLedger';
import {
  acceptImportDraftThroughCanonicalRepository,
  addCycleThroughCanonicalRepository,
  addToPotThroughCanonicalRepository,
  bulkPauseQuietThroughCanonicalRepository,
  cancelSubscriptionThroughCanonicalRepository,
  createPlannedCommitmentThroughCanonicalRepository,
  createPotThroughCanonicalRepository,
  createQuickEstimateThroughCanonicalRepository,
  editImportDraftThroughCanonicalRepository,
  pauseSubscriptionThroughCanonicalRepository,
  reallocateBetweenPotsThroughCanonicalRepository,
  recordManualTransactionThroughCanonicalRepository,
  recordRecoverySpendThroughCanonicalRepository,
  recordSubscriptionUseThroughCanonicalRepository,
  rejectImportDraftThroughCanonicalRepository,
  resumeSubscriptionThroughCanonicalRepository,
  reviewMeloImportSuggestionThroughCanonicalRepository,
  addTransactionFromDocumentThroughCanonicalRepository,
  removeDocumentStageThroughCanonicalRepository,
  stageDocumentForManualReviewThroughCanonicalRepository,
  stageStatementImportThroughCanonicalRepository,
} from '../src/local/canonicalLedgerMutations';
import { buildLocalTimelineModel } from '../src/local/localTimelineAdapter';
import { buildLocalCalendarModel } from '../src/local/localCalendarAdapter';
import { buildLocalPlansModel } from '../src/local/localPlansAdapter';
import { buildLocalPotsModel } from '../src/local/localPotsAdapter';
import { buildLocalSubscriptionsModel } from '../src/local/localSubscriptionsAdapter';
import { buildLocalInsightsModel } from '../src/local/localInsightsAdapter';
import { buildLocalPurchaseScenarioPreview } from '../src/local/localScenarioAdapter';
import { summariseLocalLedgerVault } from '../src/local/localLedgerVault';
import { writeLocalLedgerExport } from '../src/local/nativeDataExport';
import { writeDogfoodDiagnosticBundle } from '../src/local/nativeDogfoodDiagnosticExport';
import { pickLocalStatementDocument } from '../src/local/nativeDocumentImport';
import {
  clearLocalLedgerStorage,
  createCanonicalRepositoryForLocalLedgerState,
  loadCanonicalLocalLedgerState,
  saveCanonicalLocalLedgerState,
} from '../src/local/canonicalLedgerStore';
import {
  buildDogfoodStatus,
  createDogfoodResetState,
  createDogfoodScenarioSeeds,
  findDogfoodScenarioSeed,
  isDogfoodScenarioState,
  prepareDogfoodScenarioState,
  type DogfoodScenarioSeed,
} from '../src/local/dogfoodMode';
import {
  inspectLocalSecurityPosture,
  unlockLocalAppGate,
  type LocalSecurityPosture,
} from '../src/local/nativeLocalSecurity';
import { FolioBrandMark } from '../src/surfaces/brandMark';
import {
  APP_LOCK_TIMEOUT_MS,
  AppLockOverlay,
  BillGuidedScreen,
  BULLETS,
  DebtGuidedScreen,
  DogfoodModeScreen,
  FirstMinuteScreen,
  GuideMeScreen,
  MAX_TEST_PURCHASE,
  MIN_TEST_PURCHASE,
  MoneyScreen,
  RecoveryScreen,
  SampleBriefingScreen,
  SourceSheet,
  TEST_PURCHASE_STEP,
  WhatIfSheet,
  buildDiscoveryRows,
  currentLocalIsoDate,
  formatByteCount,
  isMemoryOnlySaveError,
  isPrivateExampleDraftAction,
  isProductScreen,
  screenAccessibilityTitle,
  styles,
  useReducedMotionPreference,
  type ImportSurfaceMode,
  type PersistenceStatus,
  type ProductScreen,
  type Screen,
} from '../src/surfaces/mobileShell';
// New core-slice surface (premium money-pressure map). Drop-in over the same engine.
import {
  BottomNav,
  CalendarScreen,
  DataControlScreen,
  FoundItemsScreen,
  ImportReviewScreen,
  InsightsScreen,
  MeloChatSheet,
  MeloScreen,
  MoreScreen,
  OnboardingSheet,
  PaydayRitualScreen,
  PlansScreen,
  PotsScreen,
  QuickEstimateScreen,
  StartScreen,
  SubscriptionsScreen,
  TimelineScreen,
  TodayScreen,
  type InsightsNote,
  type MeloChatSettings,
  type OnboardingProfile,
} from '../src/surfaces/pressureMap';
import type { MeloMood } from '../src/surfaces/pressureMap/melo/meloStates';
// Pots returns a bare Fragment (ScreenHeader first, no outer frame), so the container wraps it in the
// shared PressureScreen column — the way sibling surfaces frame themselves.
import { PressureScreen } from '../src/surfaces/pressureMap/kit';
import {
  sendMeloChat,
  type MeloChatMessage,
  type MeloChatResult,
  type MeloToolSuggestion,
} from '../src/local/meloAiClient';
import {
  deriveDateLabel,
  deriveDaysToPayday,
  deriveLastWeekMinor,
  deriveNextCharge,
  derivePathSummary,
  deriveRangeLabel,
  deriveRecentSpends,
  deriveThisWeekMinor,
  deriveTightPoint,
  deriveWeekSpends,
} from '../src/local/localTodayPathAdapter';
import { routeHasMeaningfulPath } from '../src/surfaces/pressureMap/routeMath';
import type { TodayPathBand } from '../src/surfaces/pressureMap/todayTypes';
import { captureStatementPhoto, pickStatementImage } from '../src/local/nativeImageIntake';
import { viewLocalFile } from '../src/local/nativeFileViewer';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Developer/test tools are only ever offered in development builds, and even then
// stay hidden until the user explicitly enables developer mode in More > Settings.
// In a released (production) build `__DEV__` is false, so they cannot be reached at all.
const DEVELOPER_MODE_AVAILABLE = __DEV__;

// Keep the small top-bar chips visually compact but lift their touch area to ~48dp (Huashu/
// hit-target rule). hitSlop expands the tap zone without changing the rendered pill size.
const CHIP_HIT_SLOP = { bottom: 12, left: 6, right: 6, top: 12 };

// The new core-slice screens are full-bleed "doorway / map" surfaces that own their
// own header, so they hide the shared Personal/Local mode bar. The Local trust signal
// now lives where it belongs — in Data & privacy.
function isChromelessScreen(screen: Screen): boolean {
  return (
    screen === 'firstMinute' ||
    screen === 'start' ||
    screen === 'today' ||
    screen === 'import' ||
    screen === 'foundItems' ||
    screen === 'data' ||
    screen === 'quickEstimate' ||
    // Converted secondary surfaces carry their own header now, so they drop the old chrome bar.
    screen === 'more' ||
    screen === 'timeline' ||
    screen === 'plans' ||
    screen === 'calendar' ||
    screen === 'melo' ||
    // New Stage-4 surfaces carry their own ScreenHeader, so they too drop the old chrome bar.
    screen === 'pots' ||
    screen === 'subscriptions' ||
    screen === 'insights' ||
    screen === 'ritual'
  );
}

// Folio must never red-box or crash on launch. If a saved local picture is unusable (for example a
// row that drifted past today after the device date advanced), recover to a clean start instead of
// showing a render error. This catches any render-time failure in the screen below it.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const startFresh = useCallback(async () => {
    try {
      // Wipe every local-ledger table so the unusable saved picture cannot reload and crash again.
      await clearLocalLedgerStorage();
    } catch {
      // Even if the wipe fails we still retry; the in-memory picture starts empty.
    }
    await retry();
  }, [retry]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.appFrame, styles.errorRecoveryFrame]}>
        <FolioBrandMark size={48} />
        <Text accessibilityRole="header" style={styles.errorRecoveryTitle}>
          Let's start fresh.
        </Text>
        <Text style={styles.errorRecoveryBody}>
          We couldn't open your saved picture on this device. Nothing has been sent anywhere. You
          can start again with a clean, empty picture.
        </Text>
        <Pressable
          accessibilityHint="Clears the saved picture on this device and reopens Folio."
          accessibilityRole="button"
          onPress={() => {
            void startFresh();
          }}
          style={({ pressed }) => [
            styles.errorRecoveryButton,
            pressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={styles.errorRecoveryButtonText}>Start fresh</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function FolioHome() {
  const [screen, setScreen] = useState<Screen>('today');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sourcesVisible, setSourcesVisible] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(120);
  const [firstMinuteStep, setFirstMinuteStep] = useState(0);
  const [importSurfaceMode, setImportSurfaceMode] = useState<ImportSurfaceMode>('example_review');
  const [surpriseMoved, setSurpriseMoved] = useState(false);
  const [lastReviewAction, setLastReviewAction] = useState<string | null>(null);
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const [localLedger, setLocalLedger] = useState<LocalLedgerState>(() =>
    createEmptyLocalLedgerState(currentLocalIsoDate()),
  );
  const [ledgerHydrated, setLedgerHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('checking');
  const [shouldPersistLedger, setShouldPersistLedger] = useState(false);
  const [appLocked, setAppLocked] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState('Local app lock is ready on this device.');
  const [securityPosture, setSecurityPosture] = useState<LocalSecurityPosture | null>(null);
  const [dogfoodModeEnabled, setDogfoodModeEnabled] = useState(false);
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);
  // The active band on the Today money path (This week / Next week / To payday).
  const [todayBand, setTodayBand] = useState<TodayPathBand>('payday');
  // First-run onboarding sheet (name + payday + income + starter pots).
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  // Melo chat sheet — all state lives in the container; the sheet is presentation-only.
  const [meloChatVisible, setMeloChatVisible] = useState(false);
  const [meloMessages, setMeloMessages] = useState<readonly MeloChatMessage[]>([]);
  const [meloSending, setMeloSending] = useState(false);
  const [meloInput, setMeloInput] = useState('');
  const [meloShowSettings, setMeloShowSettings] = useState(false);
  // share defaults OFF — sending the money snapshot to an external AI provider is opt-in.
  const [meloSettings, setMeloSettings] = useState<MeloChatSettings>({ tone: 'calm', share: false });
  const [meloLastStatus, setMeloLastStatus] = useState<
    Exclude<MeloChatResult['status'], 'ok'> | undefined
  >(undefined);
  const [meloStatusMessage, setMeloStatusMessage] = useState<string | undefined>(undefined);
  const [meloSuggestions, setMeloSuggestions] = useState<readonly MeloToolSuggestion[]>([]);
  const primaryScrollRef = useRef<ScrollView | null>(null);
  const lastInactiveAtRef = useRef<number | null>(null);
  // The first-run onboarding sheet is offered once per session, on the fresh-ledger doorway.
  const onboardingOfferedRef = useRef(false);
  const reduceMotionEnabled = useReducedMotionPreference();
  const modalVisible =
    sheetVisible || sourcesVisible || appLocked || meloChatVisible || onboardingVisible;
  const screenTitle = screenAccessibilityTitle(screen);
  const localRoute = useMemo(() => buildLocalRouteSummary(localLedger), [localLedger]);
  const privateExampleMode = useMemo(() => isPrivateExampleLedger(localLedger), [localLedger]);
  const timelineModel = useMemo(
    () => buildLocalTimelineModel(localLedger, { privateExampleMode }),
    [localLedger, privateExampleMode],
  );
  const calendarModel = useMemo(
    () => buildLocalCalendarModel(localLedger, localRoute),
    [localLedger, localRoute],
  );
  const plansModel = useMemo(
    () => buildLocalPlansModel(localLedger, localRoute, { privateExampleMode }),
    [localLedger, localRoute, privateExampleMode],
  );
  const potsModel = useMemo(
    () => buildLocalPotsModel(localLedger, { privateExampleMode }),
    [localLedger, privateExampleMode],
  );
  const subscriptionsModel = useMemo(
    () => buildLocalSubscriptionsModel(localLedger, { privateExampleMode }),
    [localLedger, privateExampleMode],
  );
  const insightsModel = useMemo(
    () => buildLocalInsightsModel(localLedger, { privateExampleMode }),
    [localLedger, privateExampleMode],
  );
  const meloSnapshot = useMemo(
    () => buildMeloSnapshotFromLocalState(localLedger, localRoute),
    [localLedger, localRoute],
  );
  const vaultSummary = useMemo(() => summariseLocalLedgerVault(localLedger), [localLedger]);
  const discoveryRows = useMemo(
    () => buildDiscoveryRows(localLedger, localRoute),
    [localLedger, localRoute],
  );
  const dogfoodScenarioSeeds = useMemo(() => createDogfoodScenarioSeeds(currentLocalIsoDate()), []);
  const dogfoodStatus = useMemo(
    () => buildDogfoodStatus(localLedger, localRoute),
    [localLedger, localRoute],
  );

  // Today rich-home derivations — the new TodayScreen is presentation-only, so the container maps
  // its canonical/local data into the small surface shapes here (see localTodayPathAdapter).
  const todayWeekSpends = useMemo(
    () => deriveWeekSpends(localLedger, localLedger.asOfDate),
    [localLedger],
  );
  const todayRecentSpends = useMemo(
    () => deriveRecentSpends(localLedger, localLedger.asOfDate),
    [localLedger],
  );
  const todayPathSummary = useMemo(() => derivePathSummary(localRoute), [localRoute]);
  const todayDateLabel = useMemo(
    () => deriveDateLabel(localLedger.asOfDate),
    [localLedger.asOfDate],
  );
  const todayDaysToPayday = useMemo(
    () => deriveDaysToPayday(localRoute, localLedger.asOfDate),
    [localRoute, localLedger.asOfDate],
  );
  const todayRangeLabel = useMemo(
    () => deriveRangeLabel(localRoute, localLedger.asOfDate),
    [localRoute, localLedger.asOfDate],
  );
  const todayThisWeekMinor = useMemo(
    () => deriveThisWeekMinor(localLedger, localLedger.asOfDate),
    [localLedger],
  );
  const todayLastWeekMinor = useMemo(
    () => deriveLastWeekMinor(localLedger, localLedger.asOfDate),
    [localLedger],
  );
  const todayTightPoint = useMemo(() => deriveTightPoint(localRoute), [localRoute]);
  const todayNextCharge = useMemo(() => deriveNextCharge(subscriptionsModel), [subscriptionsModel]);
  // The hero "spare" figure is the magnitude at the tightest point (the verdict colours sign).
  const todaySpareMinor = Math.abs(localRoute.tightestBalanceMinor);

  // Insights "Notes from past you" — the engine model carries no per-cycle spare/note, so the
  // container derives them from the same closed cycles (latest first).
  const insightsNotes = useMemo<readonly InsightsNote[]>(
    () =>
      [...localLedger.cycles]
        .sort((left, right) => right.closedAt.localeCompare(left.closedAt))
        .map((cycle) => ({
          id: cycle.closedAt,
          label: cycle.label,
          spare: formatMinorAmount(cycle.spare.minorUnits),
          note: cycle.note,
        })),
    [localLedger.cycles],
  );

  // The label this cycle is recorded under in the payday ritual — the current month.
  const currentCycleLabel = useMemo(
    () => deriveCurrentMonthLabel(localLedger.asOfDate),
    [localLedger.asOfDate],
  );

  // Melo's avatar mood, derived from the route pressure (same source the Melo companion uses).
  const meloMood = useMemo<MeloMood>(() => meloMoodForRoute(localRoute), [localRoute]);

  const purchaseScenario = useMemo(
    () => buildLocalPurchaseScenarioPreview(localLedger, localRoute, purchaseAmount),
    [localLedger, localRoute, purchaseAmount],
  );

  const finishFirstMinute = useCallback(() => {
    setScreen('today');
  }, []);

  const openSampleBriefing = useCallback(() => {
    setLastReviewAction('Sample briefing opened. Nothing was saved.');
    setScreen('sampleBriefing');
  }, []);

  const openImportReview = useCallback(() => {
    setImportSurfaceMode('example_review');
    setLastReviewAction(null);
    setScreen('import');
  }, []);

  const openUserStatementImport = useCallback(() => {
    setImportSurfaceMode('user_statement');
    setLastReviewAction(null);
    setScreen('import');
  }, []);

  const userOwnedLedgerBase = useCallback(
    () =>
      isPrivateExampleLedger(localLedger)
        ? createEmptyLocalLedgerState(currentLocalIsoDate())
        : localLedger,
    [localLedger],
  );

  const commitLocalLedger = useCallback(
    (
      nextLedger: LocalLedgerState,
      fallbackMessage: string,
      options: Readonly<{ persist?: boolean }> = {},
    ) => {
      const message = nextLedger.history[0]?.label ?? fallbackMessage;
      const shouldPersist = options.persist ?? true;
      setShouldPersistLedger(shouldPersist);
      if (!shouldPersist) {
        setPersistenceStatus('memory_only');
      }
      setLocalLedger(nextLedger);
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
    },
    [],
  );

  const handleAddManualTransaction = useCallback(
    (input: ManualTransactionInput) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          recordManualTransactionThroughCanonicalRepository(ledgerBase, input),
          'Local transaction added. Route rebuilt.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not add that transaction.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleAddPlannedCommitment = useCallback(
    (input: LocalPlannedCommitmentInput) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          createPlannedCommitmentThroughCanonicalRepository(ledgerBase, input),
          'Planned commitment added. Route rebuilt.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not add that commitment.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  // Pots -------------------------------------------------------------------------------------

  const handleCreatePot = useCallback(
    (input: CreatePotInput) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          createPotThroughCanonicalRepository(ledgerBase, input),
          'Pot created locally.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create that pot.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleAddToPot = useCallback(
    (potId: string, amountMinor: number) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          addToPotThroughCanonicalRepository(ledgerBase, potId, amountMinor),
          'Money added to pot locally.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not add to that pot.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleReallocateBetweenPots = useCallback(
    (fromPotId: string, toPotId: string, amountMinor: number) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          reallocateBetweenPotsThroughCanonicalRepository(
            ledgerBase,
            fromPotId,
            toPotId,
            amountMinor,
          ),
          'Money moved between pots locally.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not move that money.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  // Subscriptions ----------------------------------------------------------------------------

  const handlePauseSubscription = useCallback(
    (subscriptionId: string) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          pauseSubscriptionThroughCanonicalRepository(ledgerBase, subscriptionId),
          'Subscription paused locally.',
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not pause that subscription.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleResumeSubscription = useCallback(
    (subscriptionId: string) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          resumeSubscriptionThroughCanonicalRepository(ledgerBase, subscriptionId),
          'Subscription resumed locally.',
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not resume that subscription.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleRecordSubscriptionUse = useCallback(
    (subscriptionId: string) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          recordSubscriptionUseThroughCanonicalRepository(ledgerBase, subscriptionId),
          'Subscription use recorded locally.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not record that use.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleCancelSubscription = useCallback(
    (subscriptionId: string) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          cancelSubscriptionThroughCanonicalRepository(ledgerBase, subscriptionId),
          'Subscription cancelled locally.',
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not cancel that subscription.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleBulkPauseQuiet = useCallback(() => {
    try {
      const ledgerBase = userOwnedLedgerBase();
      commitLocalLedger(
        bulkPauseQuietThroughCanonicalRepository(ledgerBase),
        'Quiet subscriptions paused locally.',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not pause quiet subscriptions.';
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [commitLocalLedger, userOwnedLedgerBase]);

  // Onboarding -------------------------------------------------------------------------------

  // The onboarding sheet seeds the basics on first run. There is no separate profile store in the
  // local engine, so the rough monthly income + payday day are seeded as a real income event through
  // the canonical quick-estimate path (the same path the rough-first-answer flow uses), which draws a
  // real route. The name is carried in the action label. Pots are created separately (batch below).
  const handleSeedProfile = useCallback(
    (profile: OnboardingProfile) => {
      if (profile.monthlyIncomeMinor <= 0) return;
      try {
        const asOf = currentLocalIsoDate();
        const incomeDate = nextPaydayIsoDate(asOf, profile.paydayDay);
        const incomeTitle =
          profile.name.trim().length > 0 ? `${profile.name.trim()} — pay` : 'Monthly pay';
        commitLocalLedger(
          createQuickEstimateThroughCanonicalRepository(asOf, {
            billAmountText: '',
            billDate: '',
            billTitle: '',
            cashNowText: '',
            incomeAmountText: (profile.monthlyIncomeMinor / 100).toFixed(2),
            incomeDate,
            incomeTitle,
            incomeRepeats: 'monthly',
            incomeCertainty: 'expected',
          }),
          'Saved your basics locally. Route rebuilt.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save your basics.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger],
  );

  // The onboarding sheet hands back several pot templates at once; the engine creates one pot per
  // call, so fold them over the evolving picture (each through the canonical create path) and commit
  // once. Only called when at least one pot was selected.
  const handleCreatePotsBatch = useCallback(
    (pots: readonly CreatePotInput[]) => {
      if (pots.length === 0) return;
      try {
        let next = userOwnedLedgerBase();
        for (const pot of pots) {
          next = createPotThroughCanonicalRepository(next, pot);
        }
        commitLocalLedger(next, 'Starter pots created locally.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create those pots.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  // Today: log a spend ------------------------------------------------------------------------

  // The Today LogSpend sheet hands up a POSITIVE magnitude. The canonical manual path takes a
  // magnitude + a `kind` and applies the sign itself, so a spend is just the magnitude with
  // kind:'spend' (the category is a presentation-only hint the engine does not store).
  const handleLogSpend = useCallback(
    (merchant: string, amountMinor: number, _category: string) => {
      handleAddManualTransaction({
        amountText: (Math.abs(amountMinor) / 100).toFixed(2),
        title: merchant,
        kind: 'spend',
      });
    },
    [handleAddManualTransaction],
  );

  // Melo chat ---------------------------------------------------------------------------------

  const openMeloChat = useCallback((prefill?: string) => {
    setMeloMessages((current) => (current.length === 0 ? [buildMeloOpener()] : current));
    if (prefill !== undefined) setMeloInput(prefill);
    setMeloChatVisible(true);
  }, []);

  // Send one chat turn: append the user message, call the provider-agnostic client (passing the
  // snapshot only when sharing is on, and the runtime key the owner supplies), then append the reply
  // and surface any advisory suggestions. The client never mutates state — Melo is advisory-only.
  const handleMeloSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || meloSending) return;
      const userMessage: MeloChatMessage = {
        id: `melo-user-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      const nextThread: readonly MeloChatMessage[] = [...meloMessages, userMessage];
      setMeloMessages(nextThread);
      setMeloInput('');
      setMeloSuggestions([]);
      setMeloLastStatus(undefined);
      setMeloStatusMessage(undefined);
      setMeloSending(true);

      void sendMeloChat({
        messages: nextThread,
        tone: meloSettings.tone,
        // Snapshot is sent ONLY when the user turned on sharing (meloSettings.share, default false).
        ...(meloSettings.share ? { snapshot: meloSnapshot } : {}),
        // KEYLESS: the client routes to Folio's gateway (EXPO_PUBLIC_MELO_GATEWAY_URL), which holds
        // the real provider key server-side. No key is sent from the app. With the gateway URL unset
        // the client returns a clear "Melo isn't configured yet" state (no crash).
      })
        .then((result) => {
          if (result.status === 'ok') {
            setMeloMessages((current) => [
              ...current,
              { id: `melo-reply-${Date.now()}`, role: 'assistant', text: result.reply },
            ]);
            setMeloSuggestions(result.suggestions);
          } else {
            setMeloLastStatus(result.status);
            setMeloStatusMessage(result.message);
          }
        })
        .catch((error: unknown) => {
          setMeloLastStatus('error');
          setMeloStatusMessage(
            error instanceof Error ? error.message : 'Could not reach Melo just now.',
          );
        })
        .finally(() => {
          setMeloSending(false);
        });
    },
    [meloMessages, meloSending, meloSettings.share, meloSettings.tone, meloSnapshot],
  );

  const handleMeloStartFresh = useCallback(() => {
    setMeloMessages([buildMeloOpener()]);
    setMeloSuggestions([]);
    setMeloLastStatus(undefined);
    setMeloStatusMessage(undefined);
    setMeloInput('');
  }, []);

  // Melo proposes; the user confirms here. Each accepted suggestion is validated + applied through
  // the SAME canonical mutations the screens use — Melo never touches state directly.
  const handleAcceptMeloSuggestion = useCallback(
    (suggestion: MeloToolSuggestion) => {
      applyMeloSuggestion(suggestion, {
        ledger: localLedger,
        pauseByName: (name) => {
          const match = subscriptionsModel.rows.find(
            (row) => row.name.toLowerCase() === name.toLowerCase(),
          );
          if (match) handlePauseSubscription(match.id);
        },
        moveBetweenPots: (fromName, toName, amountMinor) => {
          const from = potsModel.rows.find(
            (row) => row.name.toLowerCase() === fromName.toLowerCase(),
          );
          const to = potsModel.rows.find((row) => row.name.toLowerCase() === toName.toLowerCase());
          if (from && to) handleReallocateBetweenPots(from.id, to.id, amountMinor);
        },
        logSpend: (merchant, amountMinor, category) =>
          handleLogSpend(merchant, amountMinor, category),
      });
      setMeloSuggestions((current) => current.filter((entry) => entry.id !== suggestion.id));
    },
    [
      handleLogSpend,
      handlePauseSubscription,
      handleReallocateBetweenPots,
      localLedger,
      potsModel.rows,
      subscriptionsModel.rows,
    ],
  );

  const handleDismissMeloSuggestion = useCallback((suggestion: MeloToolSuggestion) => {
    setMeloSuggestions((current) => current.filter((entry) => entry.id !== suggestion.id));
  }, []);

  // Cycles -----------------------------------------------------------------------------------

  const handleCloseCycle = useCallback(
    (input: CreateCycleRecordInput) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          addCycleThroughCanonicalRepository(ledgerBase, input),
          'Cycle closed locally.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not close that cycle.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleRecordRecoverySpend = useCallback(
    (input: ManualTransactionInput) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        commitLocalLedger(
          recordRecoverySpendThroughCanonicalRepository(ledgerBase, input),
          'Recovery spend recorded locally. Route rebuilt.',
        );
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not record that recovery spend.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
        return false;
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handleRecoveryAccepted = useCallback(() => {
    requestAnimationFrame(() => {
      primaryScrollRef.current?.scrollTo({ animated: false, y: 0 });
    });
  }, []);

  const handleSaveQuickEstimate = useCallback(
    (input: QuickEstimateInput) => {
      try {
        commitLocalLedger(
          createQuickEstimateThroughCanonicalRepository(currentLocalIsoDate(), input),
          'Quick estimate saved locally. Route rebuilt.',
        );
        setScreen('today');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save that estimate.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger],
  );

  const handleStageStatementImport = useCallback(
    (text: string) => {
      try {
        const ledgerBase = userOwnedLedgerBase();
        const result = stageStatementImportThroughCanonicalRepository(ledgerBase, text, {
          byteSize: text.length,
          filename: 'pasted-statement.csv',
          mediaType: 'text/csv',
          storageState: 'pasted_text',
        });
        commitLocalLedger(result.state, result.message);
        if (result.state.importDrafts.length > 0) setScreen('foundItems');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not stage that statement.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  // The reader extracted some text from a file. If it parsed into found items, open the editable
  // visualizer. If it parsed into NOTHING (a real bank layout the parser cannot read yet, a receipt,
  // an unusual format) never strand the user on an empty screen: keep the file in the manual
  // workbench with an honest message so they can always add the amounts by hand. "Nothing happened"
  // must be impossible.
  const commitExtractedTextOrSaveFile = useCallback(
    (text: string, source: LocalDocumentStageInput) => {
      const base = userOwnedLedgerBase();
      const staged = stageStatementImportThroughCanonicalRepository(base, text, source);
      if (staged.state.importDrafts.length > 0) {
        commitLocalLedger(staged.state, staged.message);
        setScreen('foundItems');
        return;
      }
      const saved = stageDocumentForManualReviewThroughCanonicalRepository(base, source);
      commitLocalLedger(
        saved.state,
        'I saved your file, but could not read the amounts from it automatically. You can add them from it below.',
      );
    },
    [commitLocalLedger, userOwnedLedgerBase],
  );

  const handlePickStatementDocument = useCallback(async () => {
    try {
      const picked = await pickLocalStatementDocument();
      if (picked.kind !== 'picked') {
        if (picked.kind === 'unsupported') {
          const result = stageDocumentForManualReviewThroughCanonicalRepository(
            userOwnedLedgerBase(),
            picked.source,
          );
          commitLocalLedger(result.state, result.message);
        } else {
          setLastReviewAction(picked.message);
          AccessibilityInfo.announceForAccessibility(picked.message);
        }
        return;
      }

      commitExtractedTextOrSaveFile(picked.text, picked.source);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not stage that statement file.';
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [commitExtractedTextOrSaveFile, commitLocalLedger, userOwnedLedgerBase]);

  const handleConfirmImportDraft = useCallback(
    (rowId: string) => {
      // Tapping the dominant "Add to my money" accepts the row exactly as shown on the card —
      // the displayed interpretation is the review. A row that still needs a choice is promoted
      // to ready (with its current values) first, so the primary action is always live.
      const draft = localLedger.importDrafts.find((candidate) => candidate.rowId === rowId);
      const promoted =
        draft !== undefined && draft.reviewState !== 'ready-for-user-confirmation'
          ? editImportDraftThroughCanonicalRepository(localLedger, rowId, {
              amountText: (draft.amountMinor / 100).toFixed(2),
              date: draft.date,
              interpretation: draft.interpretation,
            })
          : localLedger;
      commitLocalLedger(
        acceptImportDraftThroughCanonicalRepository(promoted, rowId),
        'Payment confirmed locally.',
        {
          persist: !isPrivateExampleDraftAction(localLedger, rowId),
        },
      );
    },
    [commitLocalLedger, localLedger],
  );

  const handleDismissImportDraft = useCallback(
    (
      rowId: string,
      reason: LocalImportRejectionReason = 'other',
      status: 'Rejected' | 'Excluded' = 'Rejected',
    ) => {
      commitLocalLedger(
        rejectImportDraftThroughCanonicalRepository(localLedger, rowId, { reason, status }),
        'Payment dismissed locally.',
        {
          persist: !isPrivateExampleDraftAction(localLedger, rowId),
        },
      );
    },
    [commitLocalLedger, localLedger],
  );

  const handleApplyImportDraftEdit = useCallback(
    (rowId: string, input: LocalImportDraftEditInput) => {
      try {
        commitLocalLedger(
          editImportDraftThroughCanonicalRepository(localLedger, rowId, input),
          'Payment edited locally.',
          {
            persist: !isPrivateExampleDraftAction(localLedger, rowId),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not edit that payment.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, localLedger],
  );

  const handleMeloSuggestImportDraft = useCallback(
    (rowId: string) => {
      commitLocalLedger(
        reviewMeloImportSuggestionThroughCanonicalRepository(localLedger, rowId),
        'Melo suggested a label. Confirm before saving.',
        { persist: !isPrivateExampleDraftAction(localLedger, rowId) },
      );
    },
    [commitLocalLedger, localLedger],
  );

  const handleAddFromDocument = useCallback(
    (input: DocumentItemInput) => {
      try {
        commitLocalLedger(
          addTransactionFromDocumentThroughCanonicalRepository(localLedger, input),
          'Added from your file.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not add that.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, localLedger],
  );

  const handleRemoveDocument = useCallback(
    (documentId: string) => {
      commitLocalLedger(
        removeDocumentStageThroughCanonicalRepository(localLedger, documentId),
        'Source removed. Anything you added stays.',
      );
    },
    [commitLocalLedger, localLedger],
  );

  // Add every still-included found item at once, the way the editable visualizer Add button does.
  // Each row is promoted-then-accepted through the same engine path the one-row Review uses, folded
  // over the evolving picture so they all land together.
  const handleConfirmManyDrafts = useCallback(
    (rowIds: readonly string[]) => {
      let next = localLedger;
      for (const rowId of rowIds) {
        const draft = next.importDrafts.find((candidate) => candidate.rowId === rowId);
        if (draft === undefined) continue;
        const promoted =
          draft.reviewState !== 'ready-for-user-confirmation'
            ? editImportDraftThroughCanonicalRepository(next, rowId, {
                amountText: (draft.amountMinor / 100).toFixed(2),
                date: draft.date,
                interpretation: draft.interpretation,
              })
            : next;
        next = acceptImportDraftThroughCanonicalRepository(promoted, rowId);
      }
      commitLocalLedger(next, 'Added what you chose. Your path just updated.', {
        persist: !isPrivateExampleLedger(localLedger),
      });
    },
    [commitLocalLedger, localLedger],
  );

  const handleAddDocumentNote = useCallback(
    (documentId: string, note: string) => {
      commitLocalLedger(addDocumentNote(localLedger, documentId, note), 'Note added to your file.');
    },
    [commitLocalLedger, localLedger],
  );

  const handleViewFile = useCallback((file: { uri?: string }) => {
    void viewLocalFile(file.uri).then((result) => {
      setLastReviewAction(result.message);
      AccessibilityInfo.announceForAccessibility(result.message);
    });
  }, []);

  const handlePickStatementImage = useCallback(async () => {
    try {
      const picked = await pickStatementImage();
      if (picked.kind === 'picked') {
        commitExtractedTextOrSaveFile(picked.text, picked.source);
      } else if (picked.kind === 'saved') {
        const result = stageDocumentForManualReviewThroughCanonicalRepository(
          userOwnedLedgerBase(),
          picked.source,
        );
        commitLocalLedger(result.state, result.message);
      } else {
        setLastReviewAction(picked.message);
        AccessibilityInfo.announceForAccessibility(picked.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add that image.';
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [commitExtractedTextOrSaveFile, commitLocalLedger, userOwnedLedgerBase]);

  const handleCaptureStatementPhoto = useCallback(async () => {
    try {
      const picked = await captureStatementPhoto();
      if (picked.kind === 'picked') {
        commitExtractedTextOrSaveFile(picked.text, picked.source);
      } else if (picked.kind === 'saved') {
        const result = stageDocumentForManualReviewThroughCanonicalRepository(
          userOwnedLedgerBase(),
          picked.source,
        );
        commitLocalLedger(result.state, result.message);
      } else {
        setLastReviewAction(picked.message);
        AccessibilityInfo.announceForAccessibility(picked.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add that photo.';
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [commitExtractedTextOrSaveFile, commitLocalLedger, userOwnedLedgerBase]);

  const resetExample = useCallback(() => {
    setFirstMinuteStep(0);
    setSurpriseMoved(false);
    setLastReviewAction('Sample briefing opened. Nothing you saved was changed.');
    setScreen('sampleBriefing');
    AccessibilityInfo.announceForAccessibility('Sample briefing opened. Nothing was saved.');
  }, []);

  const clearLocalRecords = useCallback(() => {
    commitLocalLedger(
      createEmptyLocalLedgerState(currentLocalIsoDate()),
      'Local records cleared on this device.',
    );
    AccessibilityInfo.announceForAccessibility('Local records cleared on this device.');
  }, [commitLocalLedger]);

  const prepareDataExport = useCallback(async () => {
    try {
      const result = await writeLocalLedgerExport(localLedger, localRoute);
      const message = `Export file ready: ${result.filename} (${formatByteCount(
        result.byteSize,
      )}).`;
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
      return message;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare local export.';
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
      return message;
    }
  }, [localLedger, localRoute]);

  const openDogfoodMode = useCallback(() => {
    setDogfoodModeEnabled(true);
    setScreen('dogfood');
    setLastReviewAction('Internal test mode opened. No upload path is enabled.');
    AccessibilityInfo.announceForAccessibility('Internal test mode opened.');
  }, []);

  const resetDogfoodLocalData = useCallback(() => {
    setDogfoodModeEnabled(true);
    commitLocalLedger(
      createDogfoodResetState(currentLocalIsoDate()),
      'Internal/test reset complete. Local dogfood data is empty.',
    );
    setFirstMinuteStep(0);
    setSurpriseMoved(false);
    setScreen('dogfood');
    AccessibilityInfo.announceForAccessibility('Internal test reset complete.');
  }, [commitLocalLedger]);

  const loadDogfoodScenario = useCallback(
    (id: DogfoodScenarioSeed['id']) => {
      try {
        const scenario = findDogfoodScenarioSeed(dogfoodScenarioSeeds, id);
        setDogfoodModeEnabled(true);
        setFirstMinuteStep(0);
        setSurpriseMoved(false);
        setImportSurfaceMode(
          scenario.targetScreen === 'import' ? 'user_statement' : 'example_review',
        );

        if (scenario.sampleOnly) {
          setLastReviewAction(`Internal/test sample opened: ${scenario.title}. Nothing was saved.`);
          setScreen(scenario.targetScreen);
          AccessibilityInfo.announceForAccessibility('Fake sample opened. Nothing was saved.');
          return;
        }

        const scenarioState = prepareDogfoodScenarioState(scenario);
        commitLocalLedger(
          scenarioState,
          `Internal/test synthetic scenario loaded: ${scenario.title}.`,
        );
        setScreen(scenario.targetScreen);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not load that dogfood scenario.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [commitLocalLedger, dogfoodScenarioSeeds],
  );

  const prepareDogfoodDiagnostic = useCallback(async () => {
    try {
      const result = await writeDogfoodDiagnosticBundle({
        currentScreen: screen,
        dogfoodModeEnabled,
        lastAction: lastReviewAction,
        route: localRoute,
        state: localLedger,
      });
      const message = `Internal test file ready: ${result.jsonFilename} and ${
        result.markdownFilename
      } (${formatByteCount(result.jsonByteSize + result.markdownByteSize)}).`;
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
      return message;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not prepare the internal test file.';
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
      return message;
    }
  }, [dogfoodModeEnabled, lastReviewAction, localLedger, localRoute, screen]);

  const replayFirstMinute = useCallback(() => {
    setFirstMinuteStep(0);
    setSurpriseMoved(false);
    setScreen('firstMinute');
  }, []);

  const refreshSecurityPosture = useCallback(() => {
    inspectLocalSecurityPosture()
      .then((posture) => {
        setSecurityPosture(posture);
        AccessibilityInfo.announceForAccessibility(posture.note);
      })
      .catch(() => undefined);
  }, []);

  const lockLocalApp = useCallback(() => {
    if (securityPosture?.appLockMode !== 'device_auth') {
      const message = 'Device authentication app lock is not available on this device.';
      setUnlockMessage(message);
      AccessibilityInfo.announceForAccessibility(message);
      return;
    }

    setAppLocked(true);
    setUnlockMessage('Folio is locked on this device.');
    AccessibilityInfo.announceForAccessibility('Folio locked.');
  }, [securityPosture?.appLockMode]);

  const unlockLocalApp = useCallback(async () => {
    const result = await unlockLocalAppGate();
    setSecurityPosture(result.posture);
    setUnlockMessage(result.message);
    if (result.unlocked) {
      setAppLocked(false);
    }
    AccessibilityInfo.announceForAccessibility(result.message);
  }, []);

  const backFirstMinute = useCallback(() => {
    if (firstMinuteStep === 1 && surpriseMoved) {
      setSurpriseMoved(false);
      return true;
    }

    if (firstMinuteStep > 0) {
      setFirstMinuteStep((step) => step - 1);
      return true;
    }

    return false;
  }, [firstMinuteStep, surpriseMoved]);

  const advanceFirstMinute = useCallback(() => {
    if (firstMinuteStep === 1 && !surpriseMoved) {
      setSurpriseMoved(true);
      return;
    }

    if (firstMinuteStep >= 3) {
      finishFirstMinute();
      return;
    }

    setFirstMinuteStep((step) => step + 1);
  }, [finishFirstMinute, firstMinuteStep, surpriseMoved]);

  const handleBack = useCallback(() => {
    if (sourcesVisible) {
      setSourcesVisible(false);
      return true;
    }

    if (sheetVisible) {
      setSheetVisible(false);
      return true;
    }

    if (screen === 'firstMinute') {
      return backFirstMinute();
    }

    if (screen !== 'today') {
      setScreen('today');
      return true;
    }

    return false;
  }, [backFirstMinute, screen, sheetVisible, sourcesVisible]);

  // The four primary tabs are Today / Review (import) / Melo / More. Every other product screen is
  // reached under the More hub (or the cycle flows), so it lights the More tab.
  const primaryNavActive: ProductScreen =
    screen === 'today' || screen === 'import' || screen === 'melo' || screen === 'more'
      ? screen
      : 'more';

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);

    return () => subscription.remove();
  }, [handleBack]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(screenTitle);
  }, [screenTitle]);

  useEffect(() => {
    inspectLocalSecurityPosture()
      .then(setSecurityPosture)
      .catch(() => undefined);
  }, [ledgerHydrated]);

  useEffect(() => {
    let mounted = true;

    loadCanonicalLocalLedgerState()
      .then((savedLedger) => {
        if (!mounted) return;
        if (savedLedger !== null) {
          const refreshedLedger = refreshLocalLedgerAsOfDate(savedLedger, currentLocalIsoDate());
          if (isPrivateExampleLedger(refreshedLedger)) {
            setLocalLedger(createEmptyLocalLedgerState(currentLocalIsoDate()));
            setScreen('start');
            setShouldPersistLedger(false);
            setPersistenceStatus('memory_only');
          } else {
            // Confirm the saved ledger passes the strict canonical check before it reaches the
            // render builders. Future-dated income and bills are KEPT — the canonical projection
            // models them as expectations/commitments (not posted facts), so they no longer crash
            // the launch and a user's upcoming money survives a relaunch. Only if the ledger is
            // genuinely unusable do we fall back to an empty picture.
            try {
              createCanonicalRepositoryForLocalLedgerState(refreshedLedger);
              setLocalLedger(refreshedLedger);
              setDogfoodModeEnabled(isDogfoodScenarioState(refreshedLedger));
              setShouldPersistLedger(true);
              setPersistenceStatus('saved');
            } catch {
              setLocalLedger(createEmptyLocalLedgerState(currentLocalIsoDate()));
              setScreen('start');
              setShouldPersistLedger(false);
              setPersistenceStatus('memory_only');
            }
          }
        } else {
          setScreen('start');
          setShouldPersistLedger(false);
          setPersistenceStatus('memory_only');
        }
      })
      .catch(() => {
        if (mounted) {
          setScreen('start');
          setShouldPersistLedger(false);
          setPersistenceStatus('memory_only');
        }
      })
      .finally(() => {
        if (mounted) {
          setLedgerHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        lastInactiveAtRef.current = Date.now();
        return;
      }

      if (
        nextState === 'active' &&
        lastInactiveAtRef.current !== null &&
        securityPosture?.appLockMode === 'device_auth' &&
        Date.now() - lastInactiveAtRef.current >= APP_LOCK_TIMEOUT_MS
      ) {
        setAppLocked(true);
        setUnlockMessage('Folio locked after being away from the app.');
      }
    });

    return () => subscription.remove();
  }, [securityPosture?.appLockMode]);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ledgerHydrated || !shouldPersistLedger) return;
    setPersistenceStatus('saving');
    saveCanonicalLocalLedgerState(localLedger)
      .then(() => setPersistenceStatus('saved'))
      .catch((error) =>
        setPersistenceStatus(isMemoryOnlySaveError(error) ? 'memory_only' : 'failed'),
      );
  }, [ledgerHydrated, localLedger, shouldPersistLedger]);

  // First-run onboarding — offer the seed sheet once, on the fresh-ledger Start doorway. It is
  // skippable; nothing is recorded unless the user finishes or selects pots. A user with any real
  // confirmed records is past first run, so they never see it.
  useEffect(() => {
    if (!ledgerHydrated || onboardingOfferedRef.current) return;
    if (screen === 'start' && localRoute.confirmedTransactionCount === 0) {
      onboardingOfferedRef.current = true;
      setOnboardingVisible(true);
    }
  }, [ledgerHydrated, localRoute.confirmedTransactionCount, screen]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        accessibilityElementsHidden={modalVisible}
        importantForAccessibility={modalVisible ? 'no-hide-descendants' : 'auto'}
        style={styles.appFrame}
      >
        {!isChromelessScreen(screen) ? (
          <>
            <View style={styles.appTopBar}>
              <View style={styles.topBarIdentity}>
                <FolioBrandMark size={32} />
                <Pressable
                  accessible
                  accessibilityHint="Reveals what the current workspace chip means."
                  accessibilityLabel="Current workspace: Personal. Business workspace is separate but not available in this UI."
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showStatusDetails }}
                  onPress={() => setShowStatusDetails((visible) => !visible)}
                  hitSlop={CHIP_HIT_SLOP}
                  style={styles.contextChip}
                >
                  <Text style={styles.contextChipText}>Personal</Text>
                </Pressable>
                {developerModeEnabled ? (
                  <Pressable
                    accessible
                    accessibilityHint="Opens developer test controls."
                    accessibilityLabel="Developer mode is on. Fake scenario data may be loaded locally."
                    accessibilityRole="button"
                    onPress={() => setScreen('dogfood')}
                    hitSlop={CHIP_HIT_SLOP}
                    style={styles.contextChip}
                  >
                    <Text style={styles.contextChipText}>Dev</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessible
                accessibilityHint="Reveals local data status without implying cloud sync is available."
                accessibilityLabel={`Local mode. ${localStatusCopy(
                  persistenceStatus,
                )}. Cloud, AI and Open Banking are optional enhancements and are not required here.`}
                accessibilityRole="button"
                accessibilityState={{ expanded: showStatusDetails }}
                hitSlop={CHIP_HIT_SLOP}
                onPress={() => setShowStatusDetails((visible) => !visible)}
                style={styles.contextChip}
              >
                <Text style={styles.contextChipText}>Local</Text>
              </Pressable>
              <Pressable
                accessibilityHint="Shows imports, recovery spend preview and other controls."
                accessibilityLabel="Open more controls"
                accessibilityRole="button"
                accessibilityState={{ selected: screen === 'more' }}
                onPress={() => setScreen('more')}
                style={({ pressed }) => [styles.roundButton, pressed ? styles.pressed : undefined]}
              >
                <Text style={styles.roundButtonText}>{`${BULLETS}\u2022`}</Text>
              </Pressable>
            </View>
            {showStatusDetails ? (
              <View
                accessible
                accessibilityLabel="Status details. Personal is the current local workspace. Business remains separate and is not built in this UI. Local mode means important records work on this device without cloud sync, AI or Open Banking."
                style={styles.statusRevealPanel}
              >
                <Text style={styles.noteTitle}>Personal workspace</Text>
                <Text style={styles.noteText}>
                  Current workspace: Personal. Business data stays separate; this pass does not
                  build the Business UI.
                </Text>
                <Text style={styles.noteTitle}>Local mode</Text>
                <Text style={styles.noteText}>
                  {localStatusCopy(persistenceStatus)} Cloud, AI and Open Banking are optional
                  enhancements, not requirements for this local picture.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <ScrollView
          accessibilityLabel={`${screenTitle} screen`}
          ref={primaryScrollRef}
          style={[styles.scrollArea, screen !== 'firstMinute' ? styles.scrollWithNav : undefined]}
          contentContainerStyle={[
            styles.content,
            screen === 'firstMinute' ? styles.contentWithoutNav : undefined,
          ]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {screen === 'firstMinute' ? (
            <FirstMinuteScreen
              discoveryRows={discoveryRows}
              onAdvance={advanceFirstMinute}
              onBack={backFirstMinute}
              onFinish={finishFirstMinute}
              onOpenImportReview={openImportReview}
              onOpenSampleBriefing={openSampleBriefing}
              onOpenWhatIf={() => setSheetVisible(true)}
              onStartImportDiscovery={openUserStatementImport}
              onStartQuickEstimate={() => setScreen('quickEstimate')}
              privateExampleMode={privateExampleMode}
              route={localRoute}
              step={firstMinuteStep}
              summary={localLedger.lastImportSummary}
              surpriseMoved={surpriseMoved}
            />
          ) : null}
          {screen === 'today' ? (
            <TodayScreen
              asOfDate={localLedger.asOfDate}
              band={todayBand}
              dateLabel={todayDateLabel}
              daysToPayday={todayDaysToPayday}
              lastWeekMinor={todayLastWeekMinor}
              nextCharge={todayNextCharge}
              nudges={[]}
              pathSummary={todayPathSummary}
              rangeLabel={todayRangeLabel}
              recentSpends={todayRecentSpends}
              reduceMotion={reduceMotionEnabled}
              route={localRoute}
              spareMinor={todaySpareMinor}
              thisWeekMinor={todayThisWeekMinor}
              tightPoint={todayTightPoint}
              weekSpends={todayWeekSpends}
              onAskTightPoint={() => openMeloChat('why is my tight point so low?')}
              onAskWeekSpend={() => openMeloChat('where did this week go?')}
              onChangeBand={setTodayBand}
              onCompareWeeks={() => setScreen('insights')}
              onLogSpend={handleLogSpend}
              onOpenMelo={() => openMeloChat()}
              onOpenNextCharge={() => setScreen('subscriptions')}
              onOpenPayday={() => setScreen('ritual')}
            />
          ) : null}
          {screen === 'start' ? (
            <StartScreen
              onOpenSampleBriefing={openSampleBriefing}
              onOpenMelo={() => setScreen('melo')}
              onOpenPrivacy={() => setScreen('data')}
              onStartBillFlow={() => setScreen('billFlow')}
              onStartDebtFlow={() => setScreen('debtFlow')}
              onStartImportDiscovery={openUserStatementImport}
              onStartQuickEstimate={() => setScreen('quickEstimate')}
            />
          ) : null}
          {screen === 'timeline' ? (
            <TimelineScreen
              onBack={() => setScreen('more')}
              onOpenCalendar={() => setScreen('calendar')}
              onOpenSources={() => setSourcesVisible(true)}
              timeline={timelineModel}
            />
          ) : null}
          {screen === 'quickEstimate' ? (
            <QuickEstimateScreen onSaveEstimate={handleSaveQuickEstimate} />
          ) : null}
          {screen === 'debtFlow' ? (
            <DebtGuidedScreen
              onOpenImports={openImportReview}
              onSaveDebt={(input) => {
                handleAddPlannedCommitment(input);
                setScreen('today');
              }}
            />
          ) : null}
          {screen === 'billFlow' ? (
            <BillGuidedScreen
              onOpenImports={openImportReview}
              onSaveBill={(input) => {
                handleAddPlannedCommitment(input);
                setScreen('today');
              }}
            />
          ) : null}
          {screen === 'guideFlow' ? (
            <GuideMeScreen
              onStartDebtFlow={() => setScreen('debtFlow')}
              onStartImportDiscovery={openUserStatementImport}
              onStartQuickEstimate={() => setScreen('quickEstimate')}
            />
          ) : null}
          {screen === 'sampleBriefing' ? (
            <SampleBriefingScreen
              onAddWhatIKnow={() => setScreen('quickEstimate')}
              onDismiss={() => setScreen('start')}
              onImportStatement={openUserStatementImport}
            />
          ) : null}
          {screen === 'calendar' ? (
            <CalendarScreen
              calendar={calendarModel}
              ledger={localLedger}
              onAddCommitment={handleAddPlannedCommitment}
              onBack={() => setScreen('more')}
              onOpenImports={openImportReview}
              onOpenMoney={() => setScreen('money')}
              privateExampleMode={privateExampleMode}
              route={localRoute}
            />
          ) : null}
          {screen === 'plans' ? (
            <PlansScreen
              onAddBill={() => setScreen('billFlow')}
              onAddDebt={() => setScreen('debtFlow')}
              onBack={() => setScreen('more')}
              onOpenCalendar={() => setScreen('calendar')}
              onOpenImports={openImportReview}
              plans={plansModel}
            />
          ) : null}
          {screen === 'melo' ? (
            <MeloScreen
              ledger={localLedger}
              onBack={() => setScreen('today')}
              onOpenWhatIf={() => setSheetVisible(true)}
              onOpenImports={openImportReview}
              onOpenRecovery={() => setScreen('recovery')}
              onOpenSources={() => setSourcesVisible(true)}
              privateExampleMode={privateExampleMode}
              route={localRoute}
              snapshot={meloSnapshot}
            />
          ) : null}
          {screen === 'pots' ? (
            <PressureScreen>
              <PotsScreen
                model={potsModel}
                reduceMotion={reduceMotionEnabled}
                tightPointMinor={localRoute.tightestBalanceMinor}
                onAddToPot={handleAddToPot}
                onBack={() => setScreen('more')}
                onCreatePot={handleCreatePot}
                onReallocateBetweenPots={handleReallocateBetweenPots}
              />
            </PressureScreen>
          ) : null}
          {screen === 'subscriptions' ? (
            <SubscriptionsScreen
              subscriptions={subscriptionsModel}
              reduceMotion={reduceMotionEnabled}
              onAskMelo={(name) => openMeloChat(`talk me out of ${name}`)}
              onBack={() => setScreen('more')}
              onBulkPauseQuiet={handleBulkPauseQuiet}
              onCancel={handleCancelSubscription}
              onPause={handlePauseSubscription}
              onRecordUse={handleRecordSubscriptionUse}
              onResume={handleResumeSubscription}
            />
          ) : null}
          {screen === 'insights' ? (
            <InsightsScreen
              insights={insightsModel}
              notes={insightsNotes}
              pausedCount={subscriptionsModel.pausedCount}
              onBack={() => setScreen('more')}
              onShareCycle={() => setSourcesVisible(true)}
            />
          ) : null}
          {screen === 'ritual' ? (
            <PaydayRitualScreen
              cycleLabel={currentCycleLabel}
              insights={insightsModel}
              pots={potsModel}
              reduceMotion={reduceMotionEnabled}
              onBack={() => setScreen('today')}
              onCloseCycle={handleCloseCycle}
              onFinished={() => {
                setScreen('today');
                setSourcesVisible(true);
              }}
            />
          ) : null}
          {screen === 'money' ? (
            <MoneyScreen
              amount={purchaseAmount}
              scenario={purchaseScenario}
              onAddManualTransaction={handleAddManualTransaction}
              onDecrease={() =>
                setPurchaseAmount((amount) =>
                  Math.max(MIN_TEST_PURCHASE, amount - TEST_PURCHASE_STEP),
                )
              }
              onIncrease={() =>
                setPurchaseAmount((amount) =>
                  Math.min(MAX_TEST_PURCHASE, amount + TEST_PURCHASE_STEP),
                )
              }
              privateExampleMode={privateExampleMode}
              route={localRoute}
            />
          ) : null}
          {screen === 'data' ? (
            <DataControlScreen
              ledger={localLedger}
              lastAction={lastReviewAction}
              onClearLocalRecords={clearLocalRecords}
              onPrepareExport={prepareDataExport}
              persistenceStatus={persistenceStatus}
              privateExampleMode={privateExampleMode}
              route={localRoute}
            />
          ) : null}
          {screen === 'dogfood' && developerModeEnabled ? (
            <DogfoodModeScreen
              lastAction={lastReviewAction}
              onExportDiagnostic={prepareDogfoodDiagnostic}
              onLoadScenario={loadDogfoodScenario}
              onOpenData={() => setScreen('data')}
              onResetLocalData={resetDogfoodLocalData}
              scenarios={dogfoodScenarioSeeds}
              status={dogfoodStatus}
            />
          ) : null}
          {screen === 'import' ? (
            <ImportReviewScreen
              discoveryRows={discoveryRows}
              documentStages={localLedger.documentStages}
              drafts={localLedger.importDrafts}
              importSurfaceMode={importSurfaceMode}
              lastAction={lastReviewAction}
              onApplyDraftEdit={handleApplyImportDraftEdit}
              onConfirmDraft={handleConfirmImportDraft}
              onDismissDraft={handleDismissImportDraft}
              onAddFromDocument={handleAddFromDocument}
              onAddNote={handleAddDocumentNote}
              onViewFile={handleViewFile}
              onCapturePhoto={handleCaptureStatementPhoto}
              onOpenFoundItems={() => setScreen('foundItems')}
              onPickImage={handlePickStatementImage}
              onMeloSuggestDraft={handleMeloSuggestImportDraft}
              onPickDocument={handlePickStatementDocument}
              onRemoveDocument={handleRemoveDocument}
              onStartManualFromFile={() => setScreen('quickEstimate')}
              onStageImport={handleStageStatementImport}
              summary={localLedger.lastImportSummary}
              privateExampleMode={privateExampleMode}
            />
          ) : null}
          {screen === 'foundItems' ? (
            <FoundItemsScreen
              drafts={localLedger.importDrafts}
              onApplyDraftEdit={handleApplyImportDraftEdit}
              onConfirmMany={(rowIds) => {
                handleConfirmManyDrafts(rowIds);
                setScreen('today');
              }}
              onDismissDraft={handleDismissImportDraft}
              onReviewItem={() => setScreen('import')}
              onLeaveForLater={() => setScreen('today')}
            />
          ) : null}
          {screen === 'recovery' ? (
            <RecoveryScreen
              ledger={localLedger}
              plans={plansModel}
              route={localRoute}
              onRecoveryAccepted={handleRecoveryAccepted}
              onRecordRecoverySpend={handleRecordRecoverySpend}
              onReturnToday={() => setScreen('today')}
            />
          ) : null}
          {screen === 'more' ? (
            <MoreScreen
              developerModeAvailable={DEVELOPER_MODE_AVAILABLE}
              developerModeEnabled={developerModeEnabled}
              onLockApp={lockLocalApp}
              onOpenCalendar={() => setScreen('calendar')}
              onOpenData={() => setScreen('data')}
              onOpenDogfood={openDogfoodMode}
              onOpenImport={openImportReview}
              onOpenInsights={() => setScreen('insights')}
              onOpenPlans={() => setScreen('plans')}
              onOpenPots={() => setScreen('pots')}
              onOpenRecovery={() => setScreen('recovery')}
              onOpenRitual={() => setScreen('ritual')}
              onOpenSubscriptions={() => setScreen('subscriptions')}
              onOpenTimeline={() => setScreen('timeline')}
              onOpenWhatIf={() => setScreen('money')}
              onReplayFirstMinute={replayFirstMinute}
              onRefreshSecurity={refreshSecurityPosture}
              onResetSample={resetExample}
              onShareCycle={() => setSourcesVisible(true)}
              onToggleDeveloperMode={() => setDeveloperModeEnabled((value) => !value)}
              persistenceStatus={persistenceStatus}
              privateExampleMode={privateExampleMode}
              securityPosture={securityPosture}
              vaultSummary={vaultSummary}
            />
          ) : null}
        </ScrollView>

        {/* The Start route is the single pre-onboarding doorway — the bottom tab bar is
            chrome that dilutes it, so hide the nav there. (firstMinute isn't a product
            screen, so it already shows no nav.) Every other product screen keeps the nav. */}
        {isProductScreen(screen) && screen !== 'start' ? (
          <BottomNav active={primaryNavActive} onChange={setScreen} />
        ) : null}
      </View>

      <WhatIfSheet
        amount={purchaseAmount}
        scenario={purchaseScenario}
        reduceMotionEnabled={reduceMotionEnabled}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onDecrease={() =>
          setPurchaseAmount((amount) => Math.max(MIN_TEST_PURCHASE, amount - TEST_PURCHASE_STEP))
        }
        onIncrease={() =>
          setPurchaseAmount((amount) => Math.min(MAX_TEST_PURCHASE, amount + TEST_PURCHASE_STEP))
        }
        onOpenMoney={() => setScreen('money')}
      />
      <SourceSheet
        ledger={localLedger}
        reduceMotionEnabled={reduceMotionEnabled}
        route={localRoute}
        visible={sourcesVisible}
        onClose={() => setSourcesVisible(false)}
      />
      <MeloChatSheet
        input={meloInput}
        isSending={meloSending}
        lastResultStatus={meloLastStatus}
        messages={meloMessages}
        mood={meloMood}
        pendingSuggestions={meloSuggestions}
        reduceMotion={reduceMotionEnabled}
        settings={meloSettings}
        showSettings={meloShowSettings}
        snapshot={meloSnapshot}
        statusMessage={meloStatusMessage}
        visible={meloChatVisible}
        onAcceptSuggestion={handleAcceptMeloSuggestion}
        onChangeInput={setMeloInput}
        onChangeTone={(tone) => setMeloSettings((current) => ({ ...current, tone }))}
        onClose={() => setMeloChatVisible(false)}
        onDismissSuggestion={handleDismissMeloSuggestion}
        onSend={handleMeloSend}
        onStartFresh={handleMeloStartFresh}
        onToggleSettings={() => setMeloShowSettings((visible) => !visible)}
        onToggleShare={(next) => setMeloSettings((current) => ({ ...current, share: next }))}
      />
      <OnboardingSheet
        reduceMotion={reduceMotionEnabled}
        visible={onboardingVisible}
        onClose={() => setOnboardingVisible(false)}
        onCreatePots={handleCreatePotsBatch}
        onSeedProfile={handleSeedProfile}
      />
      <AppLockOverlay
        message={unlockMessage}
        onUnlock={unlockLocalApp}
        posture={securityPosture}
        visible={appLocked}
      />
    </SafeAreaView>
  );
}

function localStatusCopy(status: PersistenceStatus): string {
  if (status === 'saved') return 'Saved on this device';
  if (status === 'saving') return 'Saving on this device';
  if (status === 'failed') return 'Device save failed; your latest changes are memory-only';
  if (status === 'memory_only') return 'Your latest changes are memory-only on this device';
  return 'Checking device storage';
}

// Melo's avatar mood, read from the route pressure — the same mapping the Melo companion screen uses
// (calm when there is room, soft-concern when tight, attentive at the squeeze, soft-concern when
// short). An empty/eventless route sits calm rather than guessing a pressure.
function meloMoodForRoute(route: LocalRouteSummary): MeloMood {
  if (!routeHasMeaningfulPath(route)) return 'calm';
  const tight = route.tightestBalanceMinor;
  if (tight < 0) return 'soft-concern';
  if (tight < 5000) return 'attentive'; // < £50 — the squeeze
  if (tight < 18400) return 'soft-concern'; // < £184 — tight but holds
  return 'calm';
}

// The cycle label the payday ritual records under — the current month, e.g. "June".
function deriveCurrentMonthLabel(asOfDate: string): string {
  const ms = Date.parse(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(ms)) return 'This cycle';
  return new Date(ms).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
}

// The Melo chat opener — seeded as the first assistant message when the thread is empty, faithful to
// the web SheetMeloChat autoSeed (a quiet, plain greeting that does not invent numbers).
function buildMeloOpener(): MeloChatMessage {
  return {
    id: 'melo-opener',
    role: 'assistant',
    text: "hi, i'm melo. ask me anything about your money — what's tight, what's coming, or whether something's worth it.",
  };
}

// The next occurrence of a day-of-month (1..31) on or after asOfDate, as an ISO yyyy-mm-dd. Used to
// seed an onboarding income event on the user's chosen payday. Clamps to the month's last day for
// short months (e.g. payday 31 in February lands on the 28th/29th).
function nextPaydayIsoDate(asOfDate: string, paydayDay: number): string {
  const base = new Date(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return asOfDate;
  const day = Math.min(31, Math.max(1, Math.round(paydayDay)));
  const candidate = clampDayOfMonth(base.getUTCFullYear(), base.getUTCMonth(), day);
  if (candidate >= base) return candidate.toISOString().slice(0, 10);
  // Already past this month's payday — roll to next month.
  const nextMonth = base.getUTCMonth() + 1;
  const year = base.getUTCFullYear() + Math.floor(nextMonth / 12);
  const month = nextMonth % 12;
  return clampDayOfMonth(year, month, day).toISOString().slice(0, 10);
}

function clampDayOfMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

// Apply a user-confirmed Melo suggestion through the SAME canonical mutations the screens use. The
// client only ever proposes; this is the single place a suggestion turns into an action, and every
// branch validates the args before acting. set_tight_point_goal has no engine mutation (it is a goal,
// not a posted fact), so it is intentionally a no-op here — surfaced but not applied.
function applyMeloSuggestion(
  suggestion: MeloToolSuggestion,
  handlers: Readonly<{
    ledger: LocalLedgerState;
    pauseByName: (name: string) => void;
    moveBetweenPots: (fromName: string, toName: string, amountMinor: number) => void;
    logSpend: (merchant: string, amountMinor: number, category: string) => void;
  }>,
): void {
  const { args } = suggestion;
  switch (suggestion.name) {
    case 'pause_subscription': {
      const name = stringArg(args.name);
      if (name !== undefined) handlers.pauseByName(name);
      return;
    }
    case 'move_between_pots': {
      const from = stringArg(args.from);
      const to = stringArg(args.to);
      const amountMinor = poundsArgToMinor(args.amount);
      if (from !== undefined && to !== undefined && amountMinor > 0) {
        handlers.moveBetweenPots(from, to, amountMinor);
      }
      return;
    }
    case 'log_spend': {
      const merchant = stringArg(args.merchant) ?? 'Spend';
      const amountMinor = poundsArgToMinor(args.amount);
      const category = stringArg(args.category) ?? 'other';
      if (amountMinor > 0) handlers.logSpend(merchant, amountMinor, category);
      return;
    }
    case 'set_tight_point_goal':
      // A floor goal, not a posted fact — no canonical mutation. Left as a surfaced-only suggestion.
      return;
  }
}

function stringArg(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

// Melo proposes amounts in whole pounds (the persona keeps £ with no decimals); convert to pence.
function poundsArgToMinor(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.]/g, '');
    const pounds = Number(digits);
    return Number.isFinite(pounds) ? Math.round(pounds * 100) : 0;
  }
  return 0;
}

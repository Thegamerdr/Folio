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
  buildLocalRouteSummary,
  buildMeloSnapshotFromLocalState,
  createEmptyLocalLedgerState,
  isPrivateExampleLedger,
  refreshLocalLedgerAsOfDate,
  type DocumentItemInput,
  type LocalImportRejectionReason,
  type LocalImportDraftEditInput,
  type LocalLedgerState,
  type LocalPlannedCommitmentInput,
  type ManualTransactionInput,
  type QuickEstimateInput,
} from '../src/local/localLedger';
import {
  acceptImportDraftThroughCanonicalRepository,
  createPlannedCommitmentThroughCanonicalRepository,
  createQuickEstimateThroughCanonicalRepository,
  editImportDraftThroughCanonicalRepository,
  recordManualTransactionThroughCanonicalRepository,
  recordRecoverySpendThroughCanonicalRepository,
  rejectImportDraftThroughCanonicalRepository,
  reviewMeloImportSuggestionThroughCanonicalRepository,
  addTransactionFromDocumentThroughCanonicalRepository,
  removeDocumentStageThroughCanonicalRepository,
  stageDocumentForManualReviewThroughCanonicalRepository,
  stageStatementImportThroughCanonicalRepository,
} from '../src/local/canonicalLedgerMutations';
import { buildLocalTodayModel } from '../src/local/localTodayAdapter';
import { buildLocalTimelineModel } from '../src/local/localTimelineAdapter';
import { buildLocalCalendarModel } from '../src/local/localCalendarAdapter';
import { buildLocalPlansModel } from '../src/local/localPlansAdapter';
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
  CalendarScreen,
  DebtGuidedScreen,
  DogfoodModeScreen,
  FirstMinuteScreen,
  GuideMeScreen,
  MAX_TEST_PURCHASE,
  MeloScreen,
  MIN_TEST_PURCHASE,
  MoneyScreen,
  MoreScreen,
  PlansScreen,
  RecoveryScreen,
  SampleBriefingScreen,
  SourceSheet,
  TEST_PURCHASE_STEP,
  TimelineScreen,
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
  DataControlScreen,
  ImportReviewScreen,
  QuickEstimateScreen,
  StartScreen,
  TodayScreen,
} from '../src/surfaces/pressureMap';

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
    screen === 'data' ||
    screen === 'quickEstimate'
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
  const primaryScrollRef = useRef<ScrollView | null>(null);
  const lastInactiveAtRef = useRef<number | null>(null);
  const reduceMotionEnabled = useReducedMotionPreference();
  const modalVisible = sheetVisible || sourcesVisible || appLocked;
  const screenTitle = screenAccessibilityTitle(screen);
  const localRoute = useMemo(() => buildLocalRouteSummary(localLedger), [localLedger]);
  const privateExampleMode = useMemo(() => isPrivateExampleLedger(localLedger), [localLedger]);
  const todayModel = useMemo(
    () => buildLocalTodayModel(localLedger, localRoute, { privateExampleMode }),
    [localLedger, localRoute, privateExampleMode],
  );
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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not stage that statement.';
        setLastReviewAction(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
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

      const ledgerBase = userOwnedLedgerBase();
      const result = stageStatementImportThroughCanonicalRepository(
        ledgerBase,
        picked.text,
        picked.source,
      );
      commitLocalLedger(result.state, result.message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not stage that statement file.';
      setLastReviewAction(message);
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [commitLocalLedger, userOwnedLedgerBase]);

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
        'Import row confirmed locally.',
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
        'Import row dismissed locally.',
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
          'Import row edited locally.',
          {
            persist: !isPrivateExampleDraftAction(localLedger, rowId),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not edit that row.';
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
        'File removed. Anything you added stays.',
      );
    },
    [commitLocalLedger, localLedger],
  );

  const resetExample = useCallback(() => {
    setFirstMinuteStep(0);
    setSurpriseMoved(false);
    setLastReviewAction('Sample briefing opened. Saved rows were not changed.');
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

  const primaryNavActive: ProductScreen =
    screen === 'start' || screen === 'import' || screen === 'today' || screen === 'more'
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
              onOpenMelo={() => setScreen('melo')}
              onOpenSources={() => setSourcesVisible(true)}
              onOpenWhatIf={() => setSheetVisible(true)}
              privateExampleMode={privateExampleMode}
              route={localRoute}
              today={todayModel}
            />
          ) : null}
          {screen === 'start' ? (
            <StartScreen
              onOpenSampleBriefing={openSampleBriefing}
              onStartBillFlow={() => setScreen('billFlow')}
              onStartDebtFlow={() => setScreen('debtFlow')}
              onStartImportDiscovery={openUserStatementImport}
              onStartQuickEstimate={() => setScreen('quickEstimate')}
            />
          ) : null}
          {screen === 'timeline' ? (
            <TimelineScreen
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
              onOpenImports={openImportReview}
              onOpenMoney={() => setScreen('money')}
              privateExampleMode={privateExampleMode}
              route={localRoute}
            />
          ) : null}
          {screen === 'plans' ? (
            <PlansScreen
              onOpenCalendar={() => setScreen('calendar')}
              onOpenImports={openImportReview}
              plans={plansModel}
            />
          ) : null}
          {screen === 'melo' ? (
            <MeloScreen
              ledger={localLedger}
              onOpenWhatIf={() => setSheetVisible(true)}
              onOpenImports={openImportReview}
              onOpenRecovery={() => setScreen('recovery')}
              onOpenSources={() => setSourcesVisible(true)}
              privateExampleMode={privateExampleMode}
              route={localRoute}
              snapshot={meloSnapshot}
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
              onMeloSuggestDraft={handleMeloSuggestImportDraft}
              onPickDocument={handlePickStatementDocument}
              onRemoveDocument={handleRemoveDocument}
              onStartManualFromFile={() => setScreen('quickEstimate')}
              onStageImport={handleStageStatementImport}
              summary={localLedger.lastImportSummary}
              privateExampleMode={privateExampleMode}
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
              onOpenPlans={() => setScreen('plans')}
              onOpenRecovery={() => setScreen('recovery')}
              onOpenTimeline={() => setScreen('timeline')}
              onReplayFirstMinute={replayFirstMinute}
              onRefreshSecurity={refreshSecurityPosture}
              onResetSample={resetExample}
              onToggleDeveloperMode={() => setDeveloperModeEnabled((value) => !value)}
              persistenceStatus={persistenceStatus}
              privateExampleMode={privateExampleMode}
              securityPosture={securityPosture}
              vaultSummary={vaultSummary}
            />
          ) : null}
        </ScrollView>

        {isProductScreen(screen) ? (
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
  if (status === 'failed') return 'Device save failed; current rows are memory-only';
  if (status === 'memory_only') return 'Current rows are memory-only on this device';
  return 'Checking device storage';
}

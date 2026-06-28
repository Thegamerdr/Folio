import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import {
  draftMeloLocalAiResponse,
  type MeloLocalAiActionKind,
  type MeloLocalAiDraft,
  type MeloLocalFinancialSnapshot,
} from '@folio/ai-contracts';
import { folioTokens } from '@folio/ui';

import {
  Eyebrow,
  FolioScreen,
  MoneyHero,
  PrimaryDecisionCard,
  QuietPathRow,
  Reveal,
  ReviewDecisionCard,
  ScreenHeading,
  SupportText,
  TrustPanel,
} from './northstar';

import {
  buildLocalRouteSummary,
  buildMeloLocalEvidenceRecords,
  buildMeloLocalRecordLookup,
  createEmptyLocalLedgerState,
  formatMinorAmount,
  isPrivateExampleLedger,
  searchLocalLedgerEvidenceRecords,
  type LocalImportRejectionReason,
  type LocalDocumentStage,
  type LocalImportDraftEditInput,
  type LocalImportDraft,
  type LocalImportSummary,
  type LocalLedgerState,
  type LocalPlannedCommitmentInput,
  type LocalRoutePoint,
  type LocalRouteSummary,
  type LocalSearchRecord,
  type ManualTransactionInput,
  type QuickEstimateInput,
} from '../local/localLedger';
import {
  createPlannedCommitmentThroughCanonicalRepository,
  createQuickEstimateThroughCanonicalRepository,
} from '../local/canonicalLedgerMutations';
import { type LocalTodayModel } from '../local/localTodayAdapter';
import { type LocalTimelineModel } from '../local/localTimelineAdapter';
import {
  filterLocalCalendarEventsForDate,
  summarizeLocalCalendarDay,
  type LocalCalendarModel,
} from '../local/localCalendarAdapter';
import { type LocalPlansModel } from '../local/localPlansAdapter';
import {
  buildLocalRecoverySpendScenarioPreview,
  type LocalScenarioPreview,
} from '../local/localScenarioAdapter';
import {
  buildCompactMeloNote,
  gateMeloLocalAiDraft,
  gateMeloText,
} from '../local/localMeloPolicyAdapter';
import { type LocalLedgerVaultSummary } from '../local/localLedgerVault';
import {
  firstMinuteActions,
  firstMinuteMeloBriefing,
  firstMinutePrimaryMessage,
  importEntryTrustCopy,
  importReviewActionCopy,
  sampleBriefingCards,
  sampleBriefingMelo,
} from '../local/productExperienceLoop';
import {
  guidedManualQuestions,
  lensById,
  productLenses,
  type ProductLens,
  type ProductLensId,
} from '../local/productExperienceStandard';
import {
  dogfoodModeContract,
  type DogfoodScenarioSeed,
  type DogfoodStatus,
} from '../local/dogfoodMode';
import { type LocalSecurityPosture } from '../local/nativeLocalSecurity';
import { CalendarPlannerIntro } from './calendarSurface';
import { FolioBrandMark } from './brandMark';
import { CompactMeloNoteSurface } from './compactMeloNoteSurface';
import { FirstMinuteWelcomeSurface } from './firstMinuteSurface';
import { ImportReviewDecisionGuide } from './importReviewSurface';
import { MeloBoundarySurface } from './meloSurface';
import { PlansPathSurface } from './plansSurface';
import { RecoveryPathSurface } from './recoverySurface';
import { SampleBriefingValueSurface } from './sampleBriefingSurface';
import { TimelineMeaningSurface } from './timelineSurface';

type ProductScreen =
  | 'start'
  | 'today'
  | 'timeline'
  | 'calendar'
  | 'plans'
  | 'melo'
  | 'money'
  | 'import'
  | 'recovery'
  | 'more'
  | 'dogfood'
  | 'data'
  // New pressure-map surfaces (Stage 4) — reached from More / the cycle flows, not core tabs.
  | 'pots'
  | 'subscriptions'
  | 'insights'
  | 'ritual';
type GuidedTaskScreen = 'billFlow' | 'debtFlow' | 'guideFlow';
type Screen =
  | ProductScreen
  | GuidedTaskScreen
  | 'firstMinute'
  | 'quickEstimate'
  | 'sampleBriefing'
  | 'foundItems';
type ImportSurfaceMode = 'example_review' | 'user_statement';

type EventTone = 'confirmed' | 'estimated' | 'attention';
type InteractionMode = 'preview' | 'reveal' | 'commit' | 'melo' | 'protect';
type InteractionObjectState =
  | 'accepted'
  | 'saved'
  | 'available'
  | 'disabled'
  | 'needs source'
  | 'needs user confirmation'
  | 'preview only'
  | 'rejected'
  | 'requires review';
type PersistenceStatus = 'checking' | 'memory_only' | 'saving' | 'saved' | 'failed';

type PurchaseImpact = Readonly<{
  remainingMinor: number;
  tightestPoint: string;
  tone: EventTone;
}>;

type RecoveryAcceptedConfirmation = Readonly<{
  changed: string;
  evidencePath: string;
  nextReviewDate: string;
  protectedItems: string;
}>;

type TimelineEvent = Readonly<{
  date?: string;
  day: string;
  title: string;
  detail: string;
  amount: string;
  tone: EventTone;
  kind?: string;
  kindLabel?: string;
  evidence?: Readonly<{
    actionPath: string;
    authorityState: string;
    reviewState?: string;
    sourceLabel: string;
    summary: string;
  }>;
}>;

type WeekDay = Readonly<{
  date: string;
  dayOfMonth: string;
  isToday: boolean;
  weekdayShort: string;
  weekdayLong: string;
  selected: boolean;
}>;

type DiscoveryRow = Readonly<{
  label: string;
  detail: string;
  source: string;
  tone: EventTone;
}>;

type SourceRow = Readonly<{
  source: string;
  original: string;
  interpretation: string;
  stateLabel: string;
  status: string;
  tone: EventTone;
}>;

type ImportQueueProgress = Readonly<{
  progressPercent: number;
  readRows: number;
  readyRows: number;
  resolvedRows: number;
  reviewRows: number;
  skippedRows: number;
}>;

type ChartPoint = Readonly<{
  index: number;
  point: LocalRoutePoint;
  x: number;
  y: number;
}>;

type RouteChartGeometry = Readonly<{
  crossesZero: boolean;
  maxMinor: number;
  minMinor: number;
  path: string;
  points: readonly ChartPoint[];
  shadowPath: string;
  tightestPoint: ChartPoint;
  zeroY: number;
}>;

type RouteAxisLabel = Readonly<{
  anchor: 'start' | 'middle' | 'end';
  key: string;
  label: string;
  x: number;
}>;

type InteractionStep = Readonly<{
  detail: string;
  label: string;
  mode: InteractionMode;
  state: InteractionObjectState;
}>;

const GBP = '\u00A3';
const HOME_ICON = '\u2302';
const CHEVRON = '\u203A';
const BULLETS = '\u2022\u2022';
const REVIEW_ICON = '?';
const START_ICON = '+';
const REVIEW_WAITING_REMINDER = 'Check these before they count.';

// A real, deterministic sample statement. Staging it runs the same import path as a pasted
// statement and creates real waiting payments you can review — handy for trying the flow on a
// fresh device. Not example/private mode: these behave exactly like your own.
const SAMPLE_STATEMENT_CSV = [
  'Date,Description,Amount',
  '2026-06-26,Tesco,-42.00',
  '2026-06-25,Salary,1200.00',
  '2026-06-24,Gym membership,-29.99',
].join('\n');

const importInteractionSteps: readonly InteractionStep[] = [
  {
    detail: 'These wait here first',
    label: 'Review first',
    mode: 'preview',
    state: 'requires review',
  },
  {
    detail: 'Original wording stays attached',
    label: 'Show original',
    mode: 'reveal',
    state: 'available',
  },
  {
    detail: 'Check one at a time',
    label: 'Add',
    mode: 'commit',
    state: 'needs user confirmation',
  },
];

const recoveryInteractionSteps: readonly InteractionStep[] = [
  { detail: 'Try the change first', label: 'Try first', mode: 'preview', state: 'preview only' },
  { detail: 'Protected items stay visible', label: 'Protect', mode: 'protect', state: 'available' },
  {
    detail: 'Record only after review',
    label: 'Save after review',
    mode: 'commit',
    state: 'needs user confirmation',
  },
];

const recoverySavedInteractionSteps: readonly InteractionStep[] = [
  { detail: 'Saved after review', label: 'Recorded', mode: 'commit', state: 'saved' },
  {
    detail: 'Evidence stays inspectable',
    label: 'Audit trail',
    mode: 'reveal',
    state: 'available',
  },
  { detail: 'Return to the updated picture', label: 'Today', mode: 'preview', state: 'available' },
];

const meloInteractionSteps: readonly InteractionStep[] = [
  { detail: 'Ask one bounded question', label: 'Ask', mode: 'melo', state: 'available' },
  {
    detail: 'Local records stay visible',
    label: 'Show records',
    mode: 'reveal',
    state: 'available',
  },
  {
    detail: 'Changes still need your tap',
    label: 'Review',
    mode: 'preview',
    state: 'needs user confirmation',
  },
];

const dogfoodInteractionSteps: readonly InteractionStep[] = [
  {
    detail: 'Internal test only',
    label: 'Label',
    mode: 'protect',
    state: 'available',
  },
  {
    detail: 'Fake seeds only',
    label: 'Load',
    mode: 'commit',
    state: 'needs user confirmation',
  },
  {
    detail: 'Redacted local files',
    label: 'Export',
    mode: 'protect',
    state: 'available',
  },
];

const tabs: readonly Readonly<{ id: ProductScreen; label: string; icon: string }>[] = [
  { id: 'start', label: 'Start', icon: START_ICON },
  { id: 'import', label: 'Review', icon: REVIEW_ICON },
  { id: 'today', label: 'Today', icon: HOME_ICON },
  { id: 'more', label: 'More', icon: BULLETS },
];

function isProductScreen(screen: Screen): screen is ProductScreen {
  return (
    screen === 'start' ||
    screen === 'today' ||
    screen === 'timeline' ||
    screen === 'calendar' ||
    screen === 'plans' ||
    screen === 'melo' ||
    screen === 'money' ||
    screen === 'import' ||
    screen === 'recovery' ||
    screen === 'more' ||
    screen === 'dogfood' ||
    screen === 'data' ||
    screen === 'pots' ||
    screen === 'subscriptions' ||
    screen === 'insights' ||
    screen === 'ritual'
  );
}

const MIN_TEST_PURCHASE = 20;
const MAX_TEST_PURCHASE = 240;
const TEST_PURCHASE_STEP = 20;
const APP_LOCK_TIMEOUT_MS = 30_000;

function AppLockOverlay({
  message,
  onUnlock,
  posture,
  visible,
}: {
  message: string;
  onUnlock: () => void;
  posture: LocalSecurityPosture | null;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onUnlock}>
      <View style={styles.lockScrim}>
        <View accessibilityViewIsModal accessible={false} style={styles.lockPanel}>
          <FolioBrandMark size={64} />
          <Text accessibilityRole="header" style={styles.answerTitle}>
            Folio is locked.
          </Text>
          <Text style={styles.bodyText}>{message}</Text>
          <View style={styles.factList}>
            <RouteRow
              label="Key"
              tone={posture?.secureStoreAvailable ? 'confirmed' : 'attention'}
              value={databaseKeyStateCopy(posture?.databaseKeyState)}
            />
            <RouteRow
              label="Unlock"
              tone={posture?.appLockMode === undefined ? 'attention' : 'confirmed'}
              value={appLockModeCopy(posture?.appLockMode)}
            />
          </View>
          <PrimaryButton
            accessibilityHint="Runs the local device unlock flow."
            label="Unlock Folio"
            onPress={onUnlock}
          />
        </View>
      </View>
    </Modal>
  );
}

function FirstMinuteScreen({
  discoveryRows,
  onAdvance,
  onBack,
  onFinish,
  onOpenImportReview,
  onOpenSampleBriefing,
  onOpenWhatIf,
  onStartImportDiscovery,
  onStartQuickEstimate,
  privateExampleMode,
  route,
  step,
  summary,
  surpriseMoved,
}: {
  discoveryRows: readonly DiscoveryRow[];
  onAdvance: () => void;
  onBack: () => boolean;
  onFinish: () => void;
  onOpenImportReview: () => void;
  onOpenSampleBriefing: () => void;
  onOpenWhatIf: () => void;
  onStartImportDiscovery: () => void;
  onStartQuickEstimate: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
  step: number;
  summary: LocalImportSummary | undefined;
  surpriseMoved: boolean;
}) {
  const firstMinuteProgress = importQueueProgressFromCounts({
    readRows: summary?.parsedRows ?? route.confirmedTransactionCount + route.pendingReviewCount,
    readyRows: 0,
    reviewRows: route.pendingReviewCount,
    skippedRows: summary?.skippedRows ?? 0,
  });
  const pressureLabel = privateExampleMode ? 'Car repair' : 'Test pressure';
  const pressureDetail = privateExampleMode
    ? 'Repair today preview - not saved yet'
    : 'Pressure point preview - not saved yet';
  const firstMinutePreviewRoute = surpriseMoved
    ? route
    : buildRouteAfterTodayDelta({
        deltaMinor: -32_000,
        detail: pressureDetail,
        label: pressureLabel,
        route,
      });

  useEffect(() => {
    if (step === 1 && surpriseMoved) {
      AccessibilityInfo.announceForAccessibility(
        `Repair moved. Today returns to ${formatMinorMoney(
          route.availableNowMinor,
        )} breathing room.`,
      );
    }
  }, [route.availableNowMinor, step, surpriseMoved]);

  if (step === 0) {
    return (
      <FirstMinuteWelcomeSurface
        actions={firstMinuteActions}
        body="Folio starts local-first on this device. No account, cloud or AI is required, and nothing affects your money view until you review it."
        meloSummary={firstMinuteMeloBriefing.summary}
        title={firstMinutePrimaryMessage}
        onOpenSampleBriefing={onOpenSampleBriefing}
        onStartImportDiscovery={onStartImportDiscovery}
        onStartQuickEstimate={onStartQuickEstimate}
      />
    );
  }

  if (step === 1) {
    return (
      <View style={styles.screenStack}>
        <StepRail activeStep={1} />
        <Text style={styles.answerLabel}>Try a change</Text>
        <Text accessibilityRole="header" style={styles.answerTitle}>
          {privateExampleMode
            ? 'Move the surprise. Watch the month react.'
            : 'Test pressure. Watch the month react.'}
        </Text>
        <Text style={styles.bodyText}>
          {privateExampleMode
            ? 'This starts from the private example. Move the repair to see the month update before anything is saved.'
            : 'This starts from what you saved on this device. Test a pressure point before anything is saved.'}
        </Text>

        <View style={styles.routeCanvas}>
          <Text style={styles.routeCanvasLabel}>
            {surpriseMoved ? 'After the repair moves' : 'Before saving anything'}
          </Text>
          <BreathingHorizon route={firstMinutePreviewRoute} />
          <View style={styles.consequenceRows}>
            <RouteRow
              label={
                surpriseMoved
                  ? 'Today restored'
                  : privateExampleMode
                    ? 'Repair today'
                    : 'Test today'
              }
              value={formatMinorMoney(firstMinutePreviewRoute.availableNowMinor)}
              tone={firstMinutePreviewRoute.availableNowMinor < 0 ? 'attention' : 'confirmed'}
            />
            <RouteRow
              label="Tightest point"
              value={`${formatMinorMoney(firstMinutePreviewRoute.tightestBalanceMinor)} ${
                firstMinutePreviewRoute.tightestDay
              }`}
              tone={
                firstMinutePreviewRoute.tightestBalanceMinor < 0
                  ? 'attention'
                  : surpriseMoved
                    ? 'confirmed'
                    : 'estimated'
              }
            />
            <RouteRow
              label="Review queue"
              value={`${firstMinutePreviewRoute.pendingReviewCount} item${
                firstMinutePreviewRoute.pendingReviewCount === 1 ? '' : 's'
              }`}
              tone={firstMinutePreviewRoute.pendingReviewCount > 0 ? 'attention' : 'confirmed'}
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <PrimaryButton
            accessibilityHint={
              surpriseMoved
                ? privateExampleMode
                  ? 'Continues to the import discovery example.'
                  : 'Continues to what you are checking now.'
                : privateExampleMode
                  ? 'Moves the repair in the local example and updates the month summary.'
                  : 'Tests pressure in what you saved and updates the month summary.'
            }
            label={surpriseMoved ? 'Continue' : privateExampleMode ? 'Move the repair' : 'Move it'}
            onPress={onAdvance}
          />
          <SecondaryButton
            accessibilityHint="Returns to the previous first-minute step."
            label="Back"
            onPress={onBack}
          />
        </View>
        <SecondaryButton
          accessibilityHint="Opens a sheet for testing a purchase without saving it."
          label="Open what-if sheet"
          onPress={onOpenWhatIf}
        />
      </View>
    );
  }

  if (step === 2) {
    return (
      <View style={styles.screenStack}>
        <StepRail activeStep={2} />
        <Text style={styles.answerLabel}>Import as discovery</Text>
        <Text accessibilityRole="header" style={styles.answerTitle}>
          {privateExampleMode
            ? 'Starter import finds the shape of a month.'
            : 'Folio shows what it is using.'}
        </Text>
        {privateExampleMode ? (
          <View
            accessible
            accessibilityLabel="Private example statement. Example data is not saved as yours."
            style={styles.filePill}
          >
            <Text style={styles.fileName}>Private example statement</Text>
            <Text style={styles.fileStatus}>Example data, not saved as yours</Text>
          </View>
        ) : null}
        <View style={styles.progressPanel}>
          <View
            accessible
            accessibilityLabel="Import progress"
            accessibilityRole="progressbar"
            accessibilityValue={{
              max: 100,
              min: 0,
              now: firstMinuteProgress.progressPercent,
              text: `${firstMinuteProgress.progressPercent}% complete. ${firstMinuteProgress.readRows} read. ${firstMinuteProgress.resolvedRows} resolved; ${firstMinuteProgress.reviewRows} need your eye.`,
            }}
            style={styles.progressTrack}
          >
            <View
              style={[styles.progressFill, { width: `${firstMinuteProgress.progressPercent}%` }]}
            />
          </View>
          <Text style={styles.rowText}>
            {firstMinuteProgress.readRows} read. {firstMinuteProgress.resolvedRows} resolved;{' '}
            {firstMinuteProgress.reviewRows} need your eye.
          </Text>
          {firstMinuteProgress.skippedRows > 0 ? (
            <Text style={styles.noteText}>
              {firstMinuteProgress.skippedRows} duplicate
              {firstMinuteProgress.skippedRows === 1 ? '' : 's'} ignored.
            </Text>
          ) : null}
          <Text style={styles.progressText}>
            {discoveryRows.length} useful signal{discoveryRows.length === 1 ? '' : 's'} found.
          </Text>
        </View>
        <DiscoveryList rows={discoveryRows} />
        <Text style={styles.noteText}>
          {privateExampleMode
            ? 'Example payments are waiting for this rehearsal.'
            : 'Current records stay unchanged.'}
        </Text>
        <View style={styles.actionRow}>
          <PrimaryButton
            accessibilityHint="Shows the first position based on the local example payments."
            label="Build first answer"
            onPress={onAdvance}
          />
          <SecondaryButton
            accessibilityHint="Returns to the previous first-minute step."
            label="Back"
            onPress={onBack}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenStack}>
      <StepRail activeStep={3} />
      <Text style={styles.answerLabel}>Until next payday</Text>
      <Text accessibilityRole="header" style={styles.answerTitle}>
        {privateExampleMode
          ? 'Private example picture is built.'
          : 'Your current picture is ready.'}
      </Text>
      <View
        accessible
        accessibilityLabel={`${formatMinorMoney(route.availableNowMinor)} breathing room after known bills.`}
        style={styles.firstReliefMoney}
      >
        <Text style={styles.moneyValue}>{formatMinorMoney(route.availableNowMinor)}</Text>
        <Text style={styles.moneyCaption}>breathing room after known bills</Text>
      </View>
      <BreathingHorizon route={route} />
      <View style={styles.factList}>
        <RouteRow
          label={privateExampleMode ? 'Rent' : 'Known records'}
          value={privateExampleMode ? 'Covered' : `${route.confirmedTransactionCount}`}
          tone="confirmed"
        />
        <RouteRow
          label="Lowest projected balance"
          value={`${formatMinorMoney(route.tightestBalanceMinor)} ${route.tightestDay}`}
          tone={route.tightestBalanceMinor < 0 ? 'attention' : 'confirmed'}
        />
        <RouteRow
          label="Details needing review"
          value={`${route.pendingReviewCount}`}
          tone={route.pendingReviewCount > 0 ? 'attention' : 'confirmed'}
        />
      </View>
      {privateExampleMode ? (
        <View
          accessible
          accessibilityLabel={`One useful question. A rent payment is ${formatPounds(
            3,
          )} higher than usual. Was that a fee, a new amount or a one-off?`}
          style={styles.questionPanel}
        >
          <Text style={styles.noteTitle}>One useful question</Text>
          <Text style={styles.noteText}>
            A rent payment is {formatPounds(3)} higher than usual. Was that a fee, a new amount or a
            one-off?
          </Text>
        </View>
      ) : (
        <View
          accessible
          accessibilityLabel={`${route.pendingReviewCount} current details need review.`}
          style={styles.questionPanel}
        >
          <Text style={styles.noteTitle}>
            {route.pendingReviewCount > 0 ? 'Review queue' : 'No review question right now'}
          </Text>
          <Text style={styles.noteText}>
            {route.pendingReviewCount > 0
              ? `${route.pendingReviewCount} current detail${
                  route.pendingReviewCount === 1 ? '' : 's'
                } need your decision.`
              : 'Folio is using confirmed local records only.'}
          </Text>
        </View>
      )}
      <View style={styles.actionRow}>
        <PrimaryButton
          accessibilityHint="Opens the Today screen with this first answer."
          label="Open Today"
          onPress={onFinish}
        />
        {route.pendingReviewCount > 0 ? (
          <SecondaryButton
            accessibilityHint="Opens the import review list for uncertain details."
            label={`Review ${route.pendingReviewCount} detail${
              route.pendingReviewCount === 1 ? '' : 's'
            }`}
            onPress={onOpenImportReview}
          />
        ) : null}
      </View>
    </View>
  );
}

function SampleBriefingScreen({
  onAddWhatIKnow,
  onDismiss,
  onImportStatement,
}: {
  onAddWhatIKnow: () => void;
  onDismiss: () => void;
  onImportStatement: () => void;
}) {
  return (
    <SampleBriefingValueSurface
      cards={sampleBriefingCards}
      labels={sampleBriefingMelo.labels}
      meloSummary={sampleBriefingMelo.summary}
      onAddWhatIKnow={onAddWhatIKnow}
      onDismiss={onDismiss}
      onImportStatement={onImportStatement}
    />
  );
}

function StartScreen({
  onOpenSampleBriefing,
  onStartBillFlow,
  onStartDebtFlow,
  onStartImportDiscovery,
  onStartQuickEstimate,
}: {
  onOpenSampleBriefing: () => void;
  onStartBillFlow: () => void;
  onStartDebtFlow: () => void;
  onStartImportDiscovery: () => void;
  onStartQuickEstimate: () => void;
}) {
  const [showMoreStartOptions, setShowMoreStartOptions] = useState(false);
  return (
    <FolioScreen>
      <View style={styles.answerCanvas}>
        <Eyebrow>Your money</Eyebrow>
        <ScreenHeading>Will your money last to payday?</ScreenHeading>
        <SupportText>Start with whatever you already have — it only takes a minute.</SupportText>
      </View>

      <View style={styles.answerCanvas}>
        <PrimaryDecisionCard
          accessibilityHint="Builds your first payday picture from a few numbers."
          detail="Tell me what you've got, your next pay, and one bill — I'll show you if you make it."
          onPress={onStartQuickEstimate}
          title="See where you stand"
        />
        <Text style={styles.startReassurance}>
          Nothing's saved until you say so. Have a look first.
        </Text>
      </View>

      <View>
        <Reveal
          accessibilityHint="Other ways to start: use a bank statement, organise a debt or check a bill."
          detail="Use a bank statement, organise a debt or check a bill."
          expanded={showMoreStartOptions}
          onToggle={() => setShowMoreStartOptions((visible) => !visible)}
          title="Start another way"
        />
        {showMoreStartOptions ? (
          <View>
            <QuietPathRow
              detail="Paste it in or pick a file — you choose what counts."
              label="Use a bank statement"
              onPress={onStartImportDiscovery}
            />
            <QuietPathRow
              detail="See what a debt leaves you to live on."
              label="Sort out a debt"
              onPress={onStartDebtFlow}
            />
            <QuietPathRow
              detail="See if a bill fits before payday."
              label="Check a bill fits"
              onPress={onStartBillFlow}
            />
          </View>
        ) : null}
        <QuietPathRow
          label="Have a look with example numbers first"
          onPress={onOpenSampleBriefing}
        />
      </View>
    </FolioScreen>
  );
}

function StartJobButton({
  detail,
  label,
  onPress,
  primary,
  secondary,
}: Readonly<{
  detail: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
  secondary?: boolean;
}>) {
  return (
    <Pressable
      accessibilityHint={detail}
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.startJobButton,
        primary ? styles.startJobButtonPrimary : undefined,
        secondary ? styles.startJobButtonSecondary : undefined,
        pressed ? styles.pressedLift : undefined,
      ]}
    >
      <View style={styles.flex}>
        <Text style={[styles.startJobTitle, primary ? styles.startJobTitlePrimary : undefined]}>
          {label}
        </Text>
        <Text style={[styles.startJobText, primary ? styles.startJobTextPrimary : undefined]}>
          {detail}
        </Text>
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.chevron, primary ? styles.chevronPrimary : undefined]}
      >
        {CHEVRON}
      </Text>
    </Pressable>
  );
}

function LensChoiceButton({
  lens,
  onPress,
  selected,
}: Readonly<{ lens: ProductLens; onPress: () => void; selected: boolean }>) {
  return (
    <Pressable
      accessibilityHint={`Sets the start path to ${lens.label}. ${lens.homeEmphasis}`}
      accessibilityLabel={lens.label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.lensChoice,
        selected ? styles.lensChoiceSelected : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={[styles.lensChoiceTitle, selected ? styles.lensChoiceTitleSelected : undefined]}>
        {lens.label}
      </Text>
      <Text style={[styles.lensChoiceText, selected ? styles.lensChoiceTextSelected : undefined]}>
        {lens.homeEmphasis}
      </Text>
    </Pressable>
  );
}

function QuickEstimateScreen({
  onSaveEstimate,
}: {
  onSaveEstimate: (input: QuickEstimateInput) => void;
}) {
  const asOfDate = useMemo(() => currentLocalIsoDate(), []);
  // Render only the steps that move the picture forward. The data array keeps an
  // "exactness" entry for compatibility, but asking it as its own step felt like a
  // form, so the flow skips it and treats every number as a fine starting point.
  const guidedFlowSteps = useMemo(
    () => [
      guidedManualQuestions[0]!, // money now
      guidedManualQuestions[2]!, // next income
      guidedManualQuestions[3]!, // must-pay
      {
        context: 'One last thing, then you can see where you stand.',
        estimateLabel: 'Add later',
        id: 'worry_payment' as const,
        inputLabel: 'Anything worrying you',
        question: 'Anything you want to keep in view?',
        skipLabel: 'Nothing right now',
        why: 'Keep a debt or payment in sight so it never sneaks up on you.',
      },
    ],
    [],
  );
  const [activeStep, setActiveStep] = useState(0);
  const [cashNowText, setCashNowText] = useState('');
  const [incomeTitle, setIncomeTitle] = useState('Next income');
  const [incomeAmountText, setIncomeAmountText] = useState('');
  const [incomeDate, setIncomeDate] = useState(addIsoDays(asOfDate, 7));
  const [incomeConfirmed, setIncomeConfirmed] = useState(false);
  const [incomeRecurring, setIncomeRecurring] = useState(true);
  const [billTitle, setBillTitle] = useState('Bill or debt payment');
  const [billAmountText, setBillAmountText] = useState('');
  const [billDate, setBillDate] = useState(addIsoDays(asOfDate, 1));
  const [showWorryNote, setShowWorryNote] = useState(false);
  const [worryNote, setWorryNote] = useState('');
  const activeQuestion = guidedFlowSteps[activeStep] ?? guidedFlowSteps[0]!;
  const totalFlowSteps = guidedFlowSteps.length;
  const cashNowMinor = previewAmountMinorFromText(cashNowText);
  const incomeAmountMinor = previewAmountMinorFromText(incomeAmountText);
  const billAmountMinor = previewAmountMinorFromText(billAmountText);
  const estimateInput: QuickEstimateInput = {
    billAmountText,
    billDate,
    billTitle,
    cashNowText,
    incomeAmountText,
    incomeDate,
    incomeTitle,
    incomeCertainty: incomeConfirmed ? 'confirmed' : 'expected',
    incomeRepeats: incomeRecurring ? 'monthly' : 'none',
  };
  const estimateReady =
    cashNowMinor !== null &&
    incomeAmountMinor !== null &&
    incomeAmountMinor > 0 &&
    billAmountMinor !== null &&
    billAmountMinor > 0 &&
    isValidIsoDateText(incomeDate) &&
    isValidIsoDateText(billDate);
  const previewRoute = useMemo(() => {
    if (!estimateReady) return null;
    return buildLocalRouteSummary(
      createQuickEstimateThroughCanonicalRepository(asOfDate, estimateInput),
    );
  }, [asOfDate, estimateInput, estimateReady]);
  const canContinue = activeStep < totalFlowSteps - 1 || estimateReady;
  const goBack = useCallback(() => {
    setActiveStep((step) => Math.max(0, step - 1));
  }, []);

  const continueFlow = useCallback(() => {
    if (activeStep < totalFlowSteps - 1) {
      setActiveStep((step) => Math.min(totalFlowSteps - 1, step + 1));
      return;
    }

    if (estimateReady) {
      onSaveEstimate(estimateInput);
    }
  }, [activeStep, estimateInput, estimateReady, onSaveEstimate]);

  const useEstimate = useCallback(() => {
    if (activeStep === 0) {
      if (cashNowText.trim().length === 0) setCashNowText('250');
      return;
    }

    if (activeStep === 1) {
      if (incomeAmountText.trim().length === 0) setIncomeAmountText('1000');
      return;
    }

    if (activeStep === 2) {
      if (billAmountText.trim().length === 0) setBillAmountText('100');
      return;
    }

    setBillTitle('Debt payment');
    setShowWorryNote(true);
    if (worryNote.trim().length === 0) setWorryNote('A debt or payment to keep in view');
  }, [activeStep, billAmountText, cashNowText, incomeAmountText, worryNote]);

  const skipStep = useCallback(() => {
    if (activeStep === 0) setCashNowText('');
    if (activeStep === 1) {
      setIncomeAmountText('');
      setIncomeTitle('Income not added yet');
    }
    if (activeStep === 2) {
      setBillAmountText('');
      setBillTitle('Nothing must-pay yet');
    }
    if (activeStep === 3) {
      setShowWorryNote(false);
      setWorryNote('');
    }
    if (activeStep < totalFlowSteps - 1) {
      setActiveStep((step) => step + 1);
    }
  }, [activeStep, totalFlowSteps]);

  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>{`Step ${activeStep + 1} of ${totalFlowSteps}`}</Text>
      <GuidedProgress activeStep={activeStep} totalSteps={totalFlowSteps} />
      <Text accessibilityRole="header" style={styles.answerTitle}>
        {activeQuestion.question}
      </Text>
      <Text style={styles.bodyText}>
        {activeStep === 0
          ? 'Three quick numbers and you can see where you stand. A rough guess is fine.'
          : activeQuestion.context}
      </Text>

      <GuidedInputStep
        estimateLabel={activeQuestion.estimateLabel}
        onEstimate={useEstimate}
        onSkip={skipStep}
        question={activeQuestion.question}
        skipLabel={activeQuestion.skipLabel}
        why={activeQuestion.why}
      >
        {activeStep === 0 ? (
          <TextInput
            accessibilityLabel="Money available right now"
            accessibilityHint="Enter the money available today. A rough estimate is okay."
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setCashNowText}
            placeholder="0.00"
            placeholderTextColor={colors.text.muted}
            style={styles.heroAmountInput}
            value={cashNowText}
          />
        ) : null}

        {activeStep === 1 ? (
          <>
            <TextInput
              accessibilityLabel="Next income name"
              accessibilityHint="Name the next income, such as payday, wages or salary."
              onChangeText={setIncomeTitle}
              placeholder="Payday, wages or salary"
              placeholderTextColor={colors.text.muted}
              style={styles.textInput}
              value={incomeTitle}
            />
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Next income amount"
                accessibilityHint="Enter the expected income amount."
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setIncomeAmountText}
                placeholder="0.00"
                placeholderTextColor={colors.text.muted}
                style={[styles.amountInput, styles.flex]}
                value={incomeAmountText}
              />
              <TextInput
                accessibilityLabel="Next income date"
                accessibilityHint="Enter the expected income date as year, month, day."
                inputMode="numeric"
                keyboardType="numbers-and-punctuation"
                onChangeText={setIncomeDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
                style={styles.dateInput}
                value={incomeDate}
              />
            </View>
            <View style={styles.quickRow}>
              <SecondaryButton
                accessibilityHint="Marks whether this income is confirmed or only expected."
                label={incomeConfirmed ? 'Confirmed' : 'Expected'}
                onPress={() => setIncomeConfirmed((value) => !value)}
              />
              <SecondaryButton
                accessibilityHint="Marks whether this income repeats."
                label={incomeRecurring ? 'Repeats' : 'One-off'}
                onPress={() => setIncomeRecurring((value) => !value)}
              />
            </View>
          </>
        ) : null}

        {activeStep === 2 ? (
          <>
            <TextInput
              accessibilityLabel="Must-pay item name"
              accessibilityHint="Name the next bill, payment or debt minimum."
              onChangeText={setBillTitle}
              placeholder="Rent, loan, bill or minimum payment"
              placeholderTextColor={colors.text.muted}
              style={styles.textInput}
              value={billTitle}
            />
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Must-pay amount"
                accessibilityHint="Enter the amount that must be paid."
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setBillAmountText}
                placeholder="0.00"
                placeholderTextColor={colors.text.muted}
                style={[styles.amountInput, styles.flex]}
                value={billAmountText}
              />
              <TextInput
                accessibilityLabel="Must-pay due date"
                accessibilityHint="Enter the due date as year, month, day."
                inputMode="numeric"
                keyboardType="numbers-and-punctuation"
                onChangeText={setBillDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
                style={styles.dateInput}
                value={billDate}
              />
            </View>
            <View style={styles.quickRow}>
              <SecondaryButton
                accessibilityHint="Labels this must-pay item as a debt payment."
                label="Debt payment"
                onPress={() => setBillTitle('Debt payment')}
              />
              <SecondaryButton
                accessibilityHint="Labels this must-pay item as a bill."
                label="Bill"
                onPress={() => setBillTitle('Bill')}
              />
            </View>
          </>
        ) : null}

        {activeStep === 3 ? (
          <>
            <View style={styles.pressureChoicePanel}>
              <Text style={styles.noteTitle}>Keep something in view</Text>
              <Text style={styles.noteText}>
                Add a debt or payment you want to keep an eye on, or skip it and add it whenever.
              </Text>
            </View>
            {showWorryNote ? (
              <TextInput
                accessibilityLabel="Debt or payment note"
                accessibilityHint="Add a note about any debt, arrears or payment you want Folio to keep visible."
                multiline
                onChangeText={setWorryNote}
                placeholder="Loan minimum, rent arrears, council tax, or anything to keep visible"
                placeholderTextColor={colors.text.muted}
                style={styles.statementInput}
                textAlignVertical="top"
                value={worryNote}
              />
            ) : (
              <SecondaryButton
                accessibilityHint="Shows an optional note box for a debt or payment worry."
                label="Add note"
                onPress={() => setShowWorryNote(true)}
              />
            )}
          </>
        ) : null}
      </GuidedInputStep>

      {previewRoute === null ? (
        <View
          accessible
          accessibilityLabel="Your picture appears once you add money now, your next income and one payment with dates."
          style={styles.guidedPreviewPanel}
        >
          <Text style={styles.noteTitle}>You are nearly there.</Text>
          <Text style={styles.noteText}>
            Add what you have now, your next income and one payment to see if it lasts.
          </Text>
        </View>
      ) : (
        <View accessible={false} accessibilityLiveRegion="polite" style={styles.routeCanvas}>
          <Text style={styles.routeCanvasLabel}>Here is where you stand</Text>
          <BreathingHorizon compact route={previewRoute} />
          <View style={styles.consequenceRows}>
            <RouteRow
              label="Breathing room"
              action={`This starts with ${formatMinorMoney(
                cashNowMinor ?? 0,
              )}, then adds ${incomeTitle} and ${billTitle}.`}
              value={formatMinorMoney(previewRoute.availableNowMinor)}
              tone={previewRoute.availableNowMinor < 0 ? 'attention' : 'confirmed'}
            />
            <RouteRow
              label="Lowest projected balance"
              action="This is the tightest point after the money and must-pay item you entered."
              value={`${formatMinorMoney(previewRoute.tightestBalanceMinor)} ${
                previewRoute.tightestDay
              }`}
              tone={previewRoute.tightestBalanceMinor < 0 ? 'attention' : 'confirmed'}
            />
            <RouteRow label="Review queue" value="0" tone="confirmed" />
          </View>
        </View>
      )}

      <View style={styles.actionRow}>
        <SecondaryButton
          accessibilityHint="Returns to the previous question."
          disabled={activeStep === 0}
          label="Back"
          onPress={goBack}
        />
        <PrimaryButton
          accessibilityHint={
            activeStep < totalFlowSteps - 1
              ? 'Moves to the next step.'
              : 'Keeps these numbers on this device and opens Today.'
          }
          disabled={!canContinue}
          label={
            activeStep < totalFlowSteps - 1
              ? 'Next'
              : estimateReady
                ? 'Save first picture'
                : 'A couple more numbers'
          }
          onPress={continueFlow}
        />
      </View>
    </View>
  );
}

function GuidedInputStep({
  children,
  estimateLabel,
  onEstimate,
  onSkip,
  question,
  skipLabel,
  why,
}: Readonly<{
  children: ReactNode;
  estimateLabel: string;
  onEstimate: () => void;
  onSkip: () => void;
  question: string;
  skipLabel: string;
  why: string;
}>) {
  return (
    <View accessible accessibilityLabel={`${question} ${why}`} style={styles.guidedStepPanel}>
      {children}
      <Text style={styles.guidedWhyText}>{why}</Text>
      <View style={styles.guidedControlRow}>
        <SecondaryButton
          accessibilityHint={`Uses the estimate path for: ${question}`}
          label={estimateLabel}
          onPress={onEstimate}
        />
        <SecondaryButton
          accessibilityHint={`Skips this question for now: ${question}`}
          label={skipLabel}
          onPress={onSkip}
        />
      </View>
    </View>
  );
}

function GuidedProgress({
  activeStep,
  totalSteps,
}: Readonly<{ activeStep: number; totalSteps: number }>) {
  return (
    <View
      accessible
      accessibilityLabel={`Guided input progress. Step ${activeStep + 1} of ${totalSteps}.`}
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: totalSteps,
        min: 1,
        now: activeStep + 1,
        text: `Step ${activeStep + 1} of ${totalSteps}`,
      }}
      style={styles.guidedProgressTrack}
    >
      <View
        style={[
          styles.guidedProgressFill,
          { width: `${Math.round(((activeStep + 1) / totalSteps) * 100)}%` },
        ]}
      />
    </View>
  );
}

function SegmentButton({
  label,
  onPress,
  selected,
}: Readonly<{ label: string; onPress: () => void; selected: boolean }>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segmentButton,
        selected ? styles.segmentButtonSelected : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        numberOfLines={1}
        style={[styles.segmentText, selected ? styles.segmentTextSelected : undefined]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DebtGuidedScreen({
  onOpenImports,
  onSaveDebt,
}: {
  onOpenImports: () => void;
  onSaveDebt: (input: LocalPlannedCommitmentInput) => void;
}) {
  const asOfDate = useMemo(() => currentLocalIsoDate(), []);
  const [activeDebtStep, setActiveDebtStep] = useState(0);
  const [lenderName, setLenderName] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [minimumPaymentText, setMinimumPaymentText] = useState('');
  const [dueDate, setDueDate] = useState(addIsoDays(asOfDate, 7));
  const [aprText, setAprText] = useState('');
  const [status, setStatus] = useState<'arrangement' | 'behind' | 'current' | 'unknown'>('unknown');
  const [note, setNote] = useState('');
  const [pressure, setPressure] = useState<'high' | 'medium' | 'unknown'>('unknown');
  const paymentMinor = previewAmountMinorFromText(minimumPaymentText);
  const balanceMinor = previewAmountMinorFromText(balanceText);
  const debtStepCount = 5;
  const ready = paymentMinor !== null && paymentMinor > 0 && isValidIsoDateText(dueDate);
  const debtTitle = lenderName.trim().length === 0 ? 'Debt payment' : lenderName.trim();
  const continueDebtFlow = () => {
    if (activeDebtStep < debtStepCount - 1) {
      setActiveDebtStep((step) => Math.min(debtStepCount - 1, step + 1));
      return;
    }
    if (!ready) return;
    onSaveDebt({
      amountText: minimumPaymentText,
      date: dueDate,
      protected: true,
      status,
      pressure,
      title: `Debt payment: ${debtTitle}${
        aprText.trim().length === 0 ? '' : `, APR ${aprText.trim()}`
      }${balanceMinor === null ? '' : `, balance ${formatMinorMoney(balanceMinor)}`}${
        note.trim().length === 0 ? '' : ` - ${note.trim()}`
      }`,
    });
  };
  const debtStepBody = (() => {
    if (activeDebtStep === 0) {
      return (
        <TextInput
          accessibilityLabel="Debt lender or name"
          accessibilityHint="Enter the lender, account or debt name."
          onChangeText={setLenderName}
          placeholder="Lender, card or payment name"
          placeholderTextColor={colors.text.muted}
          style={styles.textInput}
          value={lenderName}
        />
      );
    }
    if (activeDebtStep === 1) {
      return (
        <TextInput
          accessibilityLabel="Minimum payment"
          accessibilityHint="Enter the minimum payment due."
          inputMode="decimal"
          keyboardType="decimal-pad"
          onChangeText={setMinimumPaymentText}
          placeholder="Minimum payment"
          placeholderTextColor={colors.text.muted}
          style={styles.heroAmountInput}
          value={minimumPaymentText}
        />
      );
    }
    if (activeDebtStep === 2) {
      return (
        <TextInput
          accessibilityLabel="Debt payment due date"
          accessibilityHint="Enter the due date as year, month, day."
          inputMode="numeric"
          keyboardType="numbers-and-punctuation"
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text.muted}
          style={styles.textInput}
          value={dueDate}
        />
      );
    }
    if (activeDebtStep === 3) {
      return (
        <View style={styles.pressureChoicePanel}>
          <Text style={styles.noteTitle}>Payment state</Text>
          <View style={styles.segmentedControl}>
            {(['current', 'behind', 'arrangement', 'unknown'] as const).map((option) => (
              <SegmentButton
                key={option}
                label={sentenceCase(option)}
                onPress={() => setStatus(option)}
                selected={status === option}
              />
            ))}
          </View>
          <Text style={styles.noteTitle}>How soon does it feel?</Text>
          <View style={styles.segmentedControl}>
            {(['high', 'medium', 'unknown'] as const).map((option) => (
              <SegmentButton
                key={option}
                label={option === 'high' ? 'Feels urgent' : sentenceCase(option)}
                onPress={() => setPressure(option)}
                selected={pressure === option}
              />
            ))}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.pressureChoicePanel}>
        <Text style={styles.noteTitle}>Only add this if it helps you recognise the payment.</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Debt balance"
            accessibilityHint="Enter the debt balance if you know it."
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setBalanceText}
            placeholder="Balance if known"
            placeholderTextColor={colors.text.muted}
            style={[styles.amountInput, styles.flex]}
            value={balanceText}
          />
          <TextInput
            accessibilityLabel="APR if known"
            accessibilityHint="Enter the APR if you know it. You can leave this blank."
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setAprText}
            placeholder="APR if known"
            placeholderTextColor={colors.text.muted}
            style={[styles.amountInput, styles.flex]}
            value={aprText}
          />
        </View>
        <TextInput
          accessibilityLabel="Debt note"
          accessibilityHint="Add a note about this debt payment."
          multiline
          onChangeText={setNote}
          placeholder="Arrangement, missing due date, or anything to remember"
          placeholderTextColor={colors.text.muted}
          style={styles.statementInput}
          textAlignVertical="top"
          value={note}
        />
      </View>
    );
  })();
  const debtStepCopies = [
    {
      estimateLabel: 'Use payment name',
      onEstimate: () =>
        setLenderName(lenderName.trim().length === 0 ? 'Card or lender' : lenderName),
      onSkip: () => setLenderName(''),
      question: 'Which payment should Folio keep visible?',
      skipLabel: 'Name later',
      why: 'A plain name is enough. It makes the payment recognisable without asking for account details.',
    },
    {
      estimateLabel: 'Use rough amount',
      onEstimate: () =>
        setMinimumPaymentText(minimumPaymentText.trim().length === 0 ? '25' : minimumPaymentText),
      onSkip: () => setMinimumPaymentText(''),
      question: 'What minimum payment has to be protected?',
      skipLabel: 'Add later',
      why: 'The route only needs the payment that must leave before payday. You can correct it later.',
    },
    {
      estimateLabel: 'Use next week',
      onEstimate: () => setDueDate(addIsoDays(asOfDate, 7)),
      onSkip: () => setDueDate(addIsoDays(asOfDate, 14)),
      question: 'When does it need to leave?',
      skipLabel: 'Use two weeks',
      why: 'The date decides whether this payment tightens the next payday route.',
    },
    {
      estimateLabel: 'Keep unknown',
      onEstimate: () => {
        setStatus('unknown');
        setPressure('unknown');
      },
      onSkip: () => {
        setStatus('unknown');
        setPressure('unknown');
      },
      question: 'What should Folio remember about the pressure?',
      skipLabel: 'Skip pressure',
      why: 'This is only a label for your review. Folio does not rank debts or tell you what to pay first.',
    },
    {
      estimateLabel: 'Leave details blank',
      onEstimate: () => {
        setBalanceText('');
        setAprText('');
        setNote('');
      },
      onSkip: () => {
        setBalanceText('');
        setAprText('');
        setNote('');
      },
      question: 'Anything else that helps you recognise it?',
      skipLabel: 'No details',
      why: 'Balance, APR and notes stay as context. The route uses the minimum payment and due date.',
    },
  ];
  const debtStepCopy = debtStepCopies[activeDebtStep] ?? debtStepCopies[0]!;

  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>Organise debts</Text>
      <Text accessibilityRole="header" style={styles.answerTitle}>
        Which debt payment is worrying you first?
      </Text>
      <Text style={styles.bodyText}>
        Add the minimum payment and due date. You see where it lands before payday; Folio does not
        tell you what to pay first.
      </Text>

      <GuidedProgress activeStep={activeDebtStep} totalSteps={debtStepCount} />
      <GuidedInputStep
        estimateLabel={debtStepCopy.estimateLabel}
        onEstimate={debtStepCopy.onEstimate}
        onSkip={debtStepCopy.onSkip}
        question={debtStepCopy.question}
        skipLabel={debtStepCopy.skipLabel}
        why={debtStepCopy.why}
      >
        {debtStepBody}
      </GuidedInputStep>

      <View style={styles.actionRow}>
        <SecondaryButton
          accessibilityHint={
            activeDebtStep === 0
              ? 'Opens Review so a statement payment can be marked as a debt payment.'
              : 'Returns to the previous debt question.'
          }
          label={activeDebtStep === 0 ? 'Find this payment' : 'Back'}
          onPress={
            activeDebtStep === 0
              ? onOpenImports
              : () => setActiveDebtStep((step) => Math.max(0, step - 1))
          }
        />
        <PrimaryButton
          accessibilityHint={
            activeDebtStep < debtStepCount - 1
              ? 'Moves to the next debt question.'
              : 'Saves this minimum payment as a protected debt payment in the route.'
          }
          disabled={activeDebtStep === debtStepCount - 1 && !ready}
          label={
            activeDebtStep < debtStepCount - 1
              ? 'Continue'
              : ready
                ? 'Save debt payment'
                : 'Add payment and date'
          }
          onPress={continueDebtFlow}
        />
      </View>

      <View style={styles.debtClarityPanel}>
        <Text style={styles.noteTitle}>What this changes</Text>
        <RouteRow
          label="Due before income"
          action="This payment is due before your next income if the date falls first."
          source="Debt entry"
          tone={ready ? 'attention' : 'estimated'}
          value={isValidIsoDateText(dueDate) ? dueDate : 'Date needed'}
        />
        <RouteRow
          label="Before payday"
          action="This reduces what is available before payday when saved as a must-pay item."
          source="Debt entry"
          tone={paymentMinor === null ? 'estimated' : 'attention'}
          value={paymentMinor === null ? 'Payment needed' : formatMinorMoney(-paymentMinor)}
        />
        <RouteRow
          label="Saved as"
          action="The route protects the minimum payment only after you save it."
          source="Debt entry"
          tone={ready ? 'confirmed' : 'estimated'}
          value={ready ? debtTitle : 'Needs payment and date'}
        />
        <RouteRow
          label="What you told Folio"
          action={
            status === 'behind'
              ? 'This payment is behind. The route keeps it before payday so it stays in view.'
              : status === 'arrangement'
                ? 'This payment is on an arrangement. The route keeps the minimum in view before payday.'
                : 'The route keeps this minimum payment in view before payday.'
          }
          source="Debt entry"
          tone={status === 'behind' ? 'attention' : 'estimated'}
          value={status === 'unknown' ? 'Status not set' : sentenceCase(status)}
        />
      </View>
    </View>
  );
}

function BillGuidedScreen({
  onOpenImports,
  onSaveBill,
}: {
  onOpenImports: () => void;
  onSaveBill: (input: LocalPlannedCommitmentInput) => void;
}) {
  const asOfDate = useMemo(() => currentLocalIsoDate(), []);
  const [billName, setBillName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState(addIsoDays(asOfDate, 3));
  const [mustPay, setMustPay] = useState(true);
  const [recurring, setRecurring] = useState(false);
  const [paid, setPaid] = useState(false);
  const amountMinor = previewAmountMinorFromText(amountText);
  const ready = billName.trim().length > 0 && amountMinor !== null && isValidIsoDateText(dueDate);

  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>Check bills</Text>
      <Text accessibilityRole="header" style={styles.answerTitle}>
        What must be paid before then?
      </Text>
      <Text style={styles.bodyText}>
        Add one bill or must-pay item. This shows whether it lands before your next income.
      </Text>
      <View style={styles.guidedStepPanel}>
        <TextInput
          accessibilityLabel="Bill name"
          accessibilityHint="Enter the bill or payment name."
          onChangeText={setBillName}
          placeholder="Rent, council tax, phone, insurance"
          placeholderTextColor={colors.text.muted}
          style={styles.textInput}
          value={billName}
        />
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Bill amount"
            accessibilityHint="Enter the bill amount."
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setAmountText}
            placeholder="0.00"
            placeholderTextColor={colors.text.muted}
            style={[styles.amountInput, styles.flex]}
            value={amountText}
          />
          <TextInput
            accessibilityLabel="Bill due date"
            accessibilityHint="Enter the due date as year, month, day."
            inputMode="numeric"
            keyboardType="numbers-and-punctuation"
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
            style={styles.dateInput}
            value={dueDate}
          />
        </View>
        <View style={styles.quickRow}>
          <SecondaryButton
            accessibilityHint="Marks this payment as must-pay before flexible spending."
            label={mustPay ? 'Must-pay' : 'Flexible'}
            onPress={() => setMustPay((value) => !value)}
          />
          <SecondaryButton
            accessibilityHint="Marks whether this bill repeats."
            label={recurring ? 'Recurring' : 'One-off'}
            onPress={() => setRecurring((value) => !value)}
          />
          <SecondaryButton
            accessibilityHint="Marks whether this bill is already paid."
            label={paid ? 'Already paid' : 'Not paid yet'}
            onPress={() => setPaid((value) => !value)}
          />
        </View>
      </View>

      <View style={styles.guidedPreviewPanel}>
        <Text style={styles.noteTitle}>What happens when you save it</Text>
        <Text style={styles.noteText}>
          {ready
            ? paid
              ? `${billName.trim()} — ${formatMinorMoney(-Math.abs(amountMinor ?? 0))} due ${dueDate}. This is marked paid, so it stays in view but does not lower your breathing room.`
              : `${billName.trim()} — ${formatMinorMoney(-Math.abs(amountMinor ?? 0))} due ${dueDate}. Folio keeps ${
                  mustPay
                    ? 'this in front of you as a must-pay item'
                    : 'this visible as a flexible item'
                } before your next income, and lowers your breathing room on the day it is due.`
            : 'Add a name, amount and date, and you will see how this bill lands before payday.'}
        </Text>
      </View>
      <View style={styles.actionRow}>
        <SecondaryButton
          accessibilityHint="Opens Review so a bank payment can be marked as a bill."
          label="Find this bill"
          onPress={onOpenImports}
        />
        <PrimaryButton
          accessibilityHint="Saves this bill as a protected must-pay item in the route."
          disabled={!ready}
          label="Save bill"
          onPress={() =>
            onSaveBill({
              amountText,
              date: dueDate,
              protected: mustPay && !paid,
              repeats: recurring ? 'monthly' : 'none',
              paid,
              title: billName.trim(),
            })
          }
        />
      </View>
    </View>
  );
}

function GuideMeScreen({
  onStartDebtFlow,
  onStartImportDiscovery,
  onStartQuickEstimate,
}: {
  onStartDebtFlow: () => void;
  onStartImportDiscovery: () => void;
  onStartQuickEstimate: () => void;
}) {
  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>Guide me</Text>
      <Text accessibilityRole="header" style={styles.answerTitle}>
        Which feels most urgent right now?
      </Text>
      <Text style={styles.bodyText}>Pick one. Folio will keep the next step small.</Text>
      <View style={styles.startJobStack}>
        <StartJobButton
          detail="Start with money now, next income and what must be paid."
          label="I need to make it to payday"
          onPress={onStartQuickEstimate}
          primary
        />
        <StartJobButton
          detail="Start with the payment that is worrying you."
          label="A debt payment"
          onPress={onStartDebtFlow}
        />
        <StartJobButton
          detail="Paste or choose a statement and check each one, one by one."
          label="My bank activity"
          onPress={onStartImportDiscovery}
        />
      </View>
    </View>
  );
}

function TodayScreen({
  onOpenMelo,
  onOpenSources,
  onOpenWhatIf,
  privateExampleMode,
  route,
  today,
}: {
  onOpenMelo: () => void;
  onOpenSources: () => void;
  onOpenWhatIf: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
  today: LocalTodayModel;
}) {
  const leadBriefing = today.briefingItems[0];
  const routeComplete =
    route.points.some((point) => point.deltaMinor > 0) &&
    route.points.some((point) => point.deltaMinor < 0);
  const reachesPayday = routeComplete && route.tightestBalanceMinor >= 0;
  const verdict = !routeComplete
    ? "Add your next pay and one bill, and I'll tell you if you make it."
    : reachesPayday
      ? 'You make it to payday.'
      : 'Money runs short before payday.';
  const heroValue = !routeComplete
    ? undefined
    : formatMinorMoney(
        reachesPayday ? route.tightestBalanceMinor : Math.abs(route.tightestBalanceMinor),
      );
  const heroCaption = !routeComplete
    ? undefined
    : reachesPayday
      ? 'spare at the tightest point'
      : 'short at the tightest point';
  const heroTone: 'calm' | 'attention' | 'neutral' = !routeComplete
    ? 'neutral'
    : reachesPayday
      ? 'calm'
      : 'attention';
  const [showTodayDetails, setShowTodayDetails] = useState(false);
  const todayMeloNote = buildCompactMeloNote({
    control:
      route.pendingReviewCount > 0
        ? 'Open details or check what is waiting for you.'
        : 'Open details or Melo.',
    matters: privateExampleMode
      ? 'Example data cannot become your records.'
      : reachesPayday
        ? 'You stay in the clear all the way to payday.'
        : (leadBriefing?.summary ?? today.whatChanged.summary),
    noticed: privateExampleMode
      ? 'Private example route loaded.'
      : reachesPayday
        ? `You reach payday with ${formatMinorMoney(route.tightestBalanceMinor)} to spare.`
        : (leadBriefing?.title ?? 'Today was rebuilt from local records.'),
  });
  return (
    <FolioScreen>
      <MoneyHero
        caption={heroCaption}
        eyebrow="Will I make it to payday?"
        headline={verdict}
        tone={heroTone}
        value={heroValue}
      />

      <BreathingHorizon route={route} />

      {!reachesPayday && today.recovery.active ? (
        <View accessible accessibilityLabel={today.recovery.summary} style={styles.notePanel}>
          <Text style={styles.noteTitle}>{today.recovery.title}</Text>
          <Text style={styles.noteText}>{today.recovery.summary}</Text>
          <Text style={styles.noteText}>
            {today.recovery.pathForward[0] ?? 'Try a change first — nothing saves until you do.'}
          </Text>
        </View>
      ) : null}

      <View>
        <Reveal
          accessibilityHint="Shows what changed since you last looked."
          detail={surfacePreviewText(today.whatChanged.summary, 80)}
          expanded={showTodayDetails}
          onToggle={() => setShowTodayDetails((visible) => !visible)}
          title="What changed?"
        />
        {showTodayDetails ? (
          <View accessible accessibilityLabel={today.whatChanged.summary} style={styles.notePanel}>
            <Text style={styles.noteText}>{todayMeloNote.noticed}</Text>
            {today.whatChanged.items.slice(0, 3).map((item) => (
              <RouteRow
                key={item.id}
                label={item.title}
                tone={item.urgency === 'urgent' ? 'attention' : 'confirmed'}
                value={item.summary}
              />
            ))}
          </View>
        ) : null}
        <QuietPathRow label="What if I spend?" onPress={onOpenWhatIf} />
        <QuietPathRow label="See why these numbers" onPress={onOpenSources} />
        <QuietPathRow label="Ask Melo what changed" onPress={onOpenMelo} />
      </View>
    </FolioScreen>
  );
}

function TimelineScreen({
  onOpenCalendar,
  onOpenSources,
  timeline,
}: {
  onOpenCalendar: () => void;
  onOpenSources: () => void;
  timeline: LocalTimelineModel;
}) {
  return (
    <View style={styles.screenStack}>
      <SectionHeader title="Timeline" rightText={timeline.sourceLabel} />
      <TimelineMeaningSurface
        briefing={timeline.meloBriefingText}
        expectationCount={timeline.expectationCount}
        factCount={timeline.factCount}
        reviewCount={timeline.reviewCount}
        onOpenCalendar={onOpenCalendar}
        onOpenSources={onOpenSources}
      />
      <TimelineList events={timeline.events} />
    </View>
  );
}

function CalendarScreen({
  calendar,
  ledger,
  onAddCommitment,
  onOpenImports,
  onOpenMoney,
  privateExampleMode,
  route,
}: {
  calendar: LocalCalendarModel;
  ledger: LocalLedgerState;
  onAddCommitment: (input: LocalPlannedCommitmentInput) => void;
  onOpenImports: () => void;
  onOpenMoney: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
}) {
  const [selectedDate, setSelectedDate] = useState(ledger.asOfDate);
  const [plannedTitle, setPlannedTitle] = useState('');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [showAgendaDetails, setShowAgendaDetails] = useState(false);

  useEffect(() => {
    setSelectedDate(ledger.asOfDate);
  }, [ledger.asOfDate]);

  const weekDays = useMemo(
    () => buildWeekDays(ledger.asOfDate, selectedDate),
    [ledger.asOfDate, selectedDate],
  );
  const calendarMonth = formatCalendarMonth(ledger.asOfDate);
  const selectedDateLabel = formatLongCalendarDate(selectedDate);
  const selectedRoutePoint = routePointForDate(route, selectedDate);
  const selectedRows = useMemo(
    () => filterLocalCalendarEventsForDate(calendar.agenda, selectedDate),
    [calendar.agenda, selectedDate],
  );
  const routeTone = route.tightestBalanceMinor < 0 ? 'attention' : 'confirmed';
  const plannedAmountMinor = previewAmountMinorFromText(plannedAmount);
  const plannedReady =
    plannedTitle.trim().length > 0 &&
    plannedAmountMinor !== null &&
    plannedAmountMinor > 0 &&
    isValidIsoDateText(selectedDate);
  const plannedPreviewRoute = useMemo(() => {
    if (!plannedReady) return null;
    try {
      return buildLocalRouteSummary(
        createPlannedCommitmentThroughCanonicalRepository(ledger, {
          amountText: plannedAmount,
          date: selectedDate,
          title: plannedTitle,
        }),
      );
    } catch {
      return null;
    }
  }, [ledger, plannedAmount, plannedReady, plannedTitle, selectedDate]);
  const calendarMeloNote = buildCompactMeloNote({
    control:
      route.pendingReviewCount > 0
        ? 'Open Review imports or inspect the selected day.'
        : 'Tap a day, inspect sources, or add a reviewed commitment.',
    matters:
      selectedRows.length > 0
        ? `${selectedRows.length} route item${
            selectedRows.length === 1 ? '' : 's'
          } stay source-linked.`
        : 'Selected days show route impact before any new save.',
    noticed: `${formatMinorMoney(route.tightestBalanceMinor)} ${route.tightestDay} is the tightest day.`,
  });

  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>{calendarMonth}</Text>
      <CalendarPlannerIntro privateExampleMode={privateExampleMode} />
      <View style={styles.weekRow}>
        {weekDays.map((day) => {
          const rows = filterLocalCalendarEventsForDate(calendar.agenda, day.date);
          const daySummary = summarizeLocalCalendarDay(rows);
          return (
            <Pressable
              accessible
              accessibilityLabel={`${day.weekdayLong} ${day.dayOfMonth} ${calendarMonth}${
                day.isToday ? ', today' : ''
              }. ${daySummary.label}. ${daySummary.detail}. ${
                day.selected ? 'Selected' : 'Tap to inspect this day'
              }.`}
              accessibilityRole="button"
              accessibilityState={{ selected: day.selected }}
              key={day.date}
              onPress={() => setSelectedDate(day.date)}
              style={({ pressed }) => [
                styles.dayPill,
                day.selected ? styles.dayPillActive : undefined,
                daySummary.tone === 'attention' ? styles.dayPillAttention : undefined,
                pressed ? styles.dayPillPressed : undefined,
              ]}
            >
              <Text style={[styles.dayCaption, day.selected ? styles.dayCaptionActive : undefined]}>
                {day.weekdayShort}
              </Text>
              <Text style={[styles.dayText, day.selected ? styles.dayTextActive : undefined]}>
                {day.dayOfMonth}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.daySignalText,
                  day.selected ? styles.daySignalTextActive : undefined,
                  daySummary.tone === 'attention' ? styles.daySignalTextAttention : undefined,
                ]}
              >
                {daySummary.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        accessible
        accessibilityLabel={`Selected day ${selectedDateLabel}. Route balance ${formatMinorMoney(
          selectedRoutePoint.balanceMinor,
        )} after ${selectedRoutePoint.title}. ${selectedRows.length} route item${
          selectedRows.length === 1 ? '' : 's'
        } on this day.`}
        style={styles.selectedDayPanel}
      >
        <Text style={styles.answerLabel}>Selected day</Text>
        <Text style={styles.noteTitle}>{selectedDateLabel}</Text>
        <View style={styles.consequenceRows}>
          <RouteRow
            label="Route balance"
            source={selectedRoutePoint.sourceLabel}
            value={`${formatMinorMoney(selectedRoutePoint.balanceMinor)} ${
              selectedRoutePoint.label
            }`}
            tone={selectedRoutePoint.tone}
          />
          <RouteRow
            label="Route items"
            source={selectedRows[0]?.sourceLabel ?? selectedRoutePoint.sourceLabel}
            value={`${selectedRows.length} route item${selectedRows.length === 1 ? '' : 's'}`}
            tone={selectedRows.length > 0 ? 'confirmed' : 'estimated'}
          />
        </View>
      </View>

      <View style={styles.manualPanel}>
        <Text style={styles.noteTitle}>Add a commitment</Text>
        <Text style={styles.noteText}>
          Saves a protected local outflow on the selected day and rebuilds the route everywhere.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Commitment title"
            onChangeText={setPlannedTitle}
            placeholder="Council tax, bill or reminder"
            placeholderTextColor={colors.text.muted}
            style={styles.textInput}
            value={plannedTitle}
          />
          <TextInput
            accessibilityLabel="Commitment amount"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setPlannedAmount}
            placeholder="0.00"
            placeholderTextColor={colors.text.muted}
            style={styles.amountInput}
            value={plannedAmount}
          />
        </View>
        <View style={styles.consequenceRows}>
          <RouteRow label="Date" value={selectedDateLabel} tone="confirmed" />
          <RouteRow
            label="After save"
            value={
              plannedPreviewRoute === null
                ? 'Waiting for title and amount'
                : `${formatMinorMoney(plannedPreviewRoute.tightestBalanceMinor)} ${
                    plannedPreviewRoute.tightestDay
                  }`
            }
            tone={
              plannedPreviewRoute === null
                ? 'estimated'
                : plannedPreviewRoute.tightestBalanceMinor < 0
                  ? 'attention'
                  : 'confirmed'
            }
          />
        </View>
        <PrimaryButton
          accessibilityHint="Adds this protected commitment to the selected calendar day and rebuilds the route."
          disabled={!plannedReady}
          label="Add to route"
          onPress={() => {
            if (!plannedReady) return;
            onAddCommitment({
              amountText: plannedAmount,
              date: selectedDate,
              title: plannedTitle,
            });
            setPlannedTitle('');
            setPlannedAmount('');
          }}
        />
      </View>

      <View style={styles.routeCanvas}>
        <Text style={styles.routeCanvasLabel}>Local route</Text>
        <BreathingHorizon route={route} />
        <View style={styles.consequenceRows}>
          <RouteRow
            label="Breathing room"
            value={formatMinorMoney(route.availableNowMinor)}
            tone={routeTone}
          />
          <RouteRow
            label="Lowest projected balance"
            value={`${formatMinorMoney(route.tightestBalanceMinor)} ${route.tightestDay}`}
            tone={routeTone}
          />
          <RouteRow
            label="Review queue"
            value={`${route.pendingReviewCount} item${route.pendingReviewCount === 1 ? '' : 's'}`}
            tone={route.pendingReviewCount > 0 ? 'attention' : 'confirmed'}
          />
        </View>
      </View>

      <CompactMeloNoteSurface note={calendarMeloNote} />

      <View style={styles.actionRow}>
        <PrimaryButton
          accessibilityHint="Opens the Money screen to test or add a local spend."
          label="Test or add spend"
          onPress={onOpenMoney}
        />
        <SecondaryButton
          accessibilityHint="Opens the import review queue."
          label="Review imports"
          onPress={onOpenImports}
        />
      </View>

      <SectionHeader
        title="Selected day"
        rightText={`${selectedRows.length} route item${selectedRows.length === 1 ? '' : 's'}`}
      />
      {selectedRows.length > 0 ? (
        <TimelineList events={selectedRows} />
      ) : (
        <CalendarEmptyDay
          selectedDateLabel={selectedDateLabel}
          selectedRoutePoint={selectedRoutePoint}
        />
      )}

      <FolioRevealRow
        accessibilityHint="Shows or hides the full money-aware agenda."
        accessibilityLabel={`Full agenda. ${calendar.agenda.length} route item${
          calendar.agenda.length === 1 ? '' : 's'
        }.`}
        detail="Open when you need every route item."
        expanded={showAgendaDetails}
        mode="preview"
        onPress={() => setShowAgendaDetails((visible) => !visible)}
        title="Full agenda"
      />
      {showAgendaDetails ? (
        <>
          <SectionHeader title="Agenda" rightText={`${calendar.agenda.length} route items`} />
          <TimelineList events={calendar.agenda} />
        </>
      ) : null}
    </View>
  );
}

function PlansScreen({
  onOpenCalendar,
  onOpenImports,
  plans,
}: {
  onOpenCalendar: () => void;
  onOpenImports: () => void;
  plans: LocalPlansModel;
}) {
  return (
    <View style={styles.screenStack}>
      <SectionHeader title="Plans" rightText={plans.sourceLabel} />
      <PlansPathSurface
        projectionCount={plans.planRows.length}
        reviewCount={plans.reviewRows.length}
        sourceLabel={plans.sourceLabel}
      />
      <View style={styles.actionRow}>
        <PrimaryButton
          accessibilityHint="Opens the calendar where commitments can be reviewed."
          label="Open calendar"
          onPress={onOpenCalendar}
        />
        <SecondaryButton
          accessibilityHint="Opens import review tasks."
          label="Review imports"
          onPress={onOpenImports}
        />
      </View>

      {plans.recoveryBriefing !== undefined ? (
        <View style={styles.notePanelStrong}>
          <Badge label="Review" tone="attention" />
          <Text style={styles.noteTitle}>{plans.recoveryBriefing.title}</Text>
          <Text style={styles.noteText}>{plans.recoveryBriefing.fact}</Text>
          <Text style={styles.noteText}>{plans.recoveryBriefing.immediateEffect}</Text>
          <View style={styles.consequenceRows}>
            {plans.recoveryBriefing.choices.slice(0, 3).map((choice) => (
              <RouteRow
                key={choice.id}
                label={choice.label}
                tone="estimated"
                value={choice.consequence}
              />
            ))}
          </View>
        </View>
      ) : null}

      <SectionHeader
        title="What's coming up"
        rightText={`${plans.planRows.length} item${plans.planRows.length === 1 ? '' : 's'}`}
      />
      {plans.planRows.length > 0 ? (
        <View style={styles.reviewList}>
          {plans.planRows.map((row) => (
            <PlanProjectionRow key={row.id} row={row} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyStatePanel}>
          <Text style={styles.noteTitle}>Nothing coming up yet.</Text>
          <Text style={styles.noteText}>
            Add a dated commitment from Calendar to see what's coming up here.
          </Text>
        </View>
      )}

      <SectionHeader
        title="Review tasks"
        rightText={`${plans.reviewRows.length} item${plans.reviewRows.length === 1 ? '' : 's'}`}
      />
      {plans.reviewRows.length > 0 ? (
        <View style={styles.reviewList}>
          {plans.reviewRows.map((row) => (
            <PlanReviewTaskRow key={row.id} row={row} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyStatePanel}>
          <Text style={styles.noteTitle}>No plan review tasks.</Text>
          <Text style={styles.noteText}>Import and scenario reviews will appear here.</Text>
        </View>
      )}
    </View>
  );
}

function PlanProjectionRow({ row }: { row: LocalPlansModel['planRows'][number] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      accessible
      accessibilityHint="Reveals the plan rule, assumptions, affected records and linked evidence."
      accessibilityLabel={`${row.title}. ${row.progressLabel}. Due ${row.dueDate}. ${row.intention}.`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((visible) => !visible)}
      style={({ pressed }) => [styles.reviewRow, pressed ? styles.pressedLift : undefined]}
    >
      <View style={styles.reviewHeader}>
        <Text style={styles.sourceLabel}>{row.title}</Text>
        <Badge label={row.stateLabel} tone={row.tone} />
      </View>
      <Text style={styles.noteText}>{row.intention}</Text>
      <View style={styles.consequenceRows}>
        <RouteRow label="Target" source={row.sourceLabel} tone={row.tone} value={row.target} />
        <RouteRow label="Visible now" tone={row.tone} value={row.covered} />
        <RouteRow label="Due" source={row.ruleLabel} tone="estimated" value={row.dueDate} />
      </View>
      <Text style={styles.noteText}>{row.nextStep}</Text>
      <Text style={styles.originalText}>
        {row.linkedRecordCount} linked local record
        {row.linkedRecordCount === 1 ? '' : 's'}
      </Text>
      {expanded ? (
        <View style={styles.planRevealPanel}>
          <RouteRow
            label="Rule"
            source={row.authorityLabel}
            tone={row.tone}
            value={row.ruleLabel}
          />
          <RouteRow
            label="Next review"
            source={row.reviewStateLabel}
            tone={row.reviewRequired ? 'attention' : 'estimated'}
            value={row.nextReviewDate}
          />
          <RouteRow
            label="Next movement"
            source="Plan impact"
            tone={row.tone}
            value={row.nextExpectedMovement}
          />
          <Text style={styles.originalText}>Affected by: {row.affectedBy.join(', ')}</Text>
          <Text style={styles.originalText}>Evidence: {row.linkedEvidence.join(', ')}</Text>
          <Text style={styles.originalText}>Assumptions: {row.assumptions.join(' ')}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function PlanReviewTaskRow({ row }: { row: LocalPlansModel['reviewRows'][number] }) {
  return (
    <View
      accessible
      accessibilityLabel={`${row.title}. ${row.stateLabel}. Due ${row.dueDate}.`}
      style={styles.reviewRow}
    >
      <View style={styles.reviewHeader}>
        <Text style={styles.sourceLabel}>{row.title}</Text>
        <Badge label={row.stateLabel} tone={row.tone} />
      </View>
      <Text style={styles.noteText}>Due {row.dueDate}</Text>
    </View>
  );
}

function ImportReviewScreen({
  discoveryRows,
  documentStages,
  drafts,
  importSurfaceMode,
  lastAction,
  onApplyDraftEdit,
  onConfirmDraft,
  onDismissDraft,
  onMeloSuggestDraft,
  onPickDocument,
  onStartManualFromFile,
  onStageImport,
  privateExampleMode,
  summary,
}: {
  discoveryRows: readonly DiscoveryRow[];
  documentStages: readonly LocalDocumentStage[];
  drafts: readonly LocalImportDraft[];
  importSurfaceMode: ImportSurfaceMode;
  lastAction: string | null;
  onApplyDraftEdit: (rowId: string, input: LocalImportDraftEditInput) => void;
  onConfirmDraft: (rowId: string) => void;
  onDismissDraft: (
    rowId: string,
    reason?: LocalImportRejectionReason,
    status?: 'Rejected' | 'Excluded',
  ) => void;
  onMeloSuggestDraft: (rowId: string) => void;
  onPickDocument: () => void;
  onStartManualFromFile: () => void;
  onStageImport: (text: string) => void;
  privateExampleMode: boolean;
  summary: LocalImportSummary | undefined;
}) {
  const [statementText, setStatementText] = useState('');
  const [showPastePanel, setShowPastePanel] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editInterpretation, setEditInterpretation] = useState('');
  const [editAmountText, setEditAmountText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [selectedReviewDraftId, setSelectedReviewDraftId] = useState<string | null>(null);
  const [showMoreRowActions, setShowMoreRowActions] = useState(false);
  const [showImportDetails, setShowImportDetails] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [localReviewAction, setLocalReviewAction] = useState<string | null>(null);
  const [hiddenDocumentIds, setHiddenDocumentIds] = useState<readonly string[]>([]);
  const showPrivateExampleRows = !(privateExampleMode && importSurfaceMode === 'user_statement');
  const visibleDrafts = showPrivateExampleRows ? drafts : [];
  const visibleDiscoveryRows = showPrivateExampleRows ? discoveryRows : [];
  const visibleSummary = showPrivateExampleRows ? summary : undefined;
  const selectedReviewDraft = visibleDrafts.find((draft) => draft.rowId === selectedReviewDraftId);
  const progress = importQueueProgressFromDrafts(visibleSummary, visibleDrafts);
  const latestDocument = documentStages.find(
    (document) => !hiddenDocumentIds.includes(document.id),
  );
  const editingDraft = drafts.find((draft) => draft.rowId === editingDraftId);
  const statementReady = statementText.trim().length > 0;
  const editReady =
    editInterpretation.trim().length > 0 &&
    previewAmountMinorFromText(editAmountText) !== null &&
    isValidIsoDateText(editDate);
  const actionMessage = localReviewAction ?? lastAction;

  const startEditing = useCallback((draft: LocalImportDraft) => {
    setEditingDraftId(draft.rowId);
    setEditInterpretation(draft.interpretation);
    setEditAmountText(formatMinorMoney(draft.amountMinor));
    setEditDate(draft.date);
  }, []);

  const saveEditing = useCallback(
    (rowId: string) => {
      onApplyDraftEdit(rowId, {
        amountText: editAmountText,
        date: editDate,
        interpretation: editInterpretation,
      });
      setEditingDraftId(null);
    },
    [editAmountText, editDate, editInterpretation, onApplyDraftEdit],
  );

  const markDraftMeaning = useCallback(
    (
      row: LocalImportDraft,
      meaning: 'Bill' | 'Debt payment' | 'Income' | 'Refund',
      amountDirection: 'incoming' | 'outgoing',
    ) => {
      const absoluteAmount = Math.abs(row.amountMinor);
      const signedAmount = amountDirection === 'incoming' ? absoluteAmount : -absoluteAmount;
      onApplyDraftEdit(row.rowId, {
        amountText: formatMinorMoney(signedAmount),
        date: row.date,
        interpretation: `${meaning}: ${stripMeaningPrefix(row.interpretation)}`,
      });
      setLocalReviewAction(`${meaning} label added for review. Nothing is saved until you accept.`);
    },
    [onApplyDraftEdit],
  );

  useEffect(() => {
    if (lastAction) {
      AccessibilityInfo.announceForAccessibility(lastAction);
    }
  }, [lastAction]);

  useEffect(() => {
    if (selectedReviewDraftId !== null && selectedReviewDraft === undefined) {
      setSelectedReviewDraftId(null);
    }
  }, [selectedReviewDraft, selectedReviewDraftId]);

  // Each time a different row's sheet opens (or it closes), collapse the secondary actions so the
  // user always starts from the three primary choices: Add, Edit, Ignore.
  useEffect(() => {
    setShowMoreRowActions(false);
  }, [selectedReviewDraftId]);

  return (
    <View style={styles.screenStack}>
      {latestDocument && isReviewOnlyDocument(latestDocument, visibleSummary) ? (
        <View
          accessible
          accessibilityLabel="This file is saved. We can't read it for you yet, so you can add the key numbers yourself, keep it for later, or remove it."
          style={styles.importPastePanel}
        >
          <Text style={styles.answerLabel}>File saved</Text>
          <Text accessibilityRole="header" style={styles.noteTitle}>
            We can’t read this file automatically yet.
          </Text>
          <Text style={styles.noteText}>
            Open it on your device and add the key numbers yourself — what you have, income, a bill
            or a debt payment. You choose what to keep, and nothing changes until you do.
          </Text>
          <PrimaryButton
            accessibilityHint="Opens the guided path to add the key numbers from this file yourself."
            label="Add the numbers yourself"
            onPress={onStartManualFromFile}
          />
          <View style={styles.quickRow}>
            <Pressable
              accessibilityHint="Keeps this file here for later. Nothing changes."
              accessibilityRole="button"
              onPress={() => setLocalReviewAction('File kept for later. Nothing changed.')}
              style={({ pressed }) => [
                styles.startExploreLink,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.startExploreText}>Keep for later</Text>
            </Pressable>
            <Pressable
              accessibilityHint="Removes this file from review. Anything you've already added stays."
              accessibilityRole="button"
              onPress={() => {
                setHiddenDocumentIds((ids) => [...ids, latestDocument.id]);
                setLocalReviewAction('File set aside. Anything you already added stays.');
              }}
              style={({ pressed }) => [
                styles.startExploreLink,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.startExploreText}>Remove file</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.answerCanvas}>
        <Eyebrow>Review</Eyebrow>
        <ScreenHeading>What to check</ScreenHeading>
        <SupportText>Nothing has been added yet — you choose what to keep.</SupportText>
      </View>

      <View style={styles.reviewList}>
        {visibleDrafts.length === 0 ? (
          <View
            accessible
            accessibilityLabel="Nothing has been added yet. Choose what to keep. Add bank activity below to find what's coming in and going out."
            style={styles.emptyStatePanel}
          >
            <Text style={styles.noteTitle}>Choose what to keep.</Text>
            <Text style={styles.noteText}>
              Add bank activity below and we’ll find what's coming in and going out for you to
              check. {REVIEW_WAITING_REMINDER}
            </Text>
          </View>
        ) : null}
        {visibleDrafts.map((row) => {
          const rowReady = row.reviewState === 'ready-for-user-confirmation';
          const out = row.amountMinor < 0;
          const magnitude = formatMinorMoney(Math.abs(row.amountMinor));
          return (
            <ReviewDecisionCard
              amountLabel={`${magnitude} ${out ? 'out' : 'in'}`}
              consequence={
                out
                  ? `If you add it, your payday picture drops by ${magnitude}.`
                  : `If you add it, your payday picture rises by ${magnitude}.`
              }
              dateLabel={formatReviewDay(row.date)}
              flagLine={
                row.reasons.length > 0
                  ? `Worth a look: ${formatReviewReasons(row.reasons)}`
                  : undefined
              }
              key={row.rowId}
              onAdd={() => onConfirmDraft(row.rowId)}
              onEdit={() => startEditing(row)}
              onIgnore={() => onDismissDraft(row.rowId, 'other')}
              onMore={() => setSelectedReviewDraftId(row.rowId)}
              question={`Is this ${row.interpretation}?`}
              sourceLine="From your statement"
              state={rowReady ? 'ready' : 'waiting'}
            />
          );
        })}
      </View>

      {actionMessage ? (
        <View
          accessible
          accessibilityLabel={`Update. ${actionMessage}`}
          accessibilityLiveRegion="polite"
          style={styles.actionNotice}
        >
          <Text style={styles.noteText}>{actionMessage}</Text>
        </View>
      ) : null}

      <FolioRevealRow
        accessibilityHint="Shows the ways to add bank activity: choose a file, paste text, and the latest file and progress."
        accessibilityLabel="Add bank activity. Choose a CSV or text file, paste statement text, and see the latest file and progress."
        detail="Choose a file or paste text to find what's coming in and going out."
        expanded={showAddActivity}
        mode="reveal"
        onPress={() => setShowAddActivity((visible) => !visible)}
        title="Add bank activity"
      />

      {showAddActivity ? (
        <>
          <View style={styles.importPastePanel}>
            <Text style={styles.noteTitle}>Use a bank statement</Text>
            <Text style={styles.noteText}>
              CSV or copied text can create payments to check. PDF and screenshots can be added for
              review, but automatic reading is not ready for those files yet.
            </Text>
            <PrimaryButton
              accessibilityHint="Opens the system document picker for CSV, TSV or text statement files."
              label="Choose CSV/TXT file"
              onPress={onPickDocument}
            />
            <SecondaryButton
              accessibilityHint="Shows or hides the local statement paste box."
              label={showPastePanel ? 'Hide paste box' : 'Paste statement text'}
              onPress={() => setShowPastePanel((visible) => !visible)}
            />
            <Pressable
              accessibilityHint="Adds a few example payments so you can try the review flow. They wait for your check, just like your own, and nothing is added until you add it."
              accessibilityRole="button"
              onPress={() => onStageImport(SAMPLE_STATEMENT_CSV)}
              style={({ pressed }) => [
                styles.startExploreLink,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.startExploreText}>Try it with a sample statement</Text>
            </Pressable>
          </View>

          {showPastePanel ? (
            <View style={styles.importPastePanel}>
              <Text style={styles.noteTitle}>Local statement text</Text>
              <TextInput
                accessibilityHint="Paste CSV statement text here."
                accessibilityLabel="Statement text"
                multiline
                onChangeText={setStatementText}
                placeholder="Date,Description,Amount"
                placeholderTextColor={colors.text.muted}
                style={styles.statementInput}
                textAlignVertical="top"
                value={statementText}
              />
              <PrimaryButton
                accessibilityHint="Reads the text locally and finds payments for review."
                disabled={!statementReady}
                label="Find payments to review"
                onPress={() => onStageImport(statementText)}
              />
            </View>
          ) : null}

          {latestDocument ? (
            <View
              accessible
              accessibilityLabel={`Latest file ${latestDocument.filename}. ${latestDocument.byteSize} bytes. ${documentSourceCopy(
                latestDocument,
              )}`}
              style={styles.documentStagePanel}
            >
              <Text style={styles.answerLabel}>Latest file</Text>
              <Text style={styles.noteTitle}>{latestDocument.filename}</Text>
              <Text style={styles.noteText}>
                {latestDocument.mediaType} - {latestDocument.byteSize} bytes -{' '}
                {latestDocument.storageState === 'copied_to_app_cache'
                  ? 'read locally for review'
                  : 'pasted text'}
              </Text>
              <Text style={styles.originalText}>{documentSourceCopy(latestDocument)}</Text>
            </View>
          ) : null}

          {visibleSummary !== undefined || visibleDrafts.length > 0 ? (
            <View style={styles.progressPanel}>
              <View
                accessible
                accessibilityLabel="Import progress"
                accessibilityRole="progressbar"
                accessibilityValue={{
                  max: 100,
                  min: 0,
                  now: progress.progressPercent,
                  text: `${progress.progressPercent}% complete. ${progress.readRows} found. ${progress.resolvedRows} decided; ${progress.readyRows} ready to add; ${progress.reviewRows} need your eye.`,
                }}
                style={styles.progressTrack}
              >
                <View style={[styles.progressFill, { width: `${progress.progressPercent}%` }]} />
              </View>
              <Text style={styles.rowText}>
                {progress.readRows} found. {progress.readyRows} ready; {progress.reviewRows} need
                review.
              </Text>
              {progress.skippedRows > 0 ? (
                <Text style={styles.noteText}>
                  {progress.skippedRows} duplicate{progress.skippedRows === 1 ? '' : 's'} skipped.
                </Text>
              ) : null}
              <Text style={styles.progressText}>Found — check before saving.</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {selectedReviewDraft ? (
        <Modal
          animationType="slide"
          transparent
          visible
          onRequestClose={() => setSelectedReviewDraftId(null)}
        >
          <View style={styles.modalScrim}>
            <View
              accessibilityViewIsModal
              accessible={false}
              style={[styles.sheet, styles.reviewActionSheet]}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.sheetHandle}
              />
              <Text style={styles.answerLabel}>Ways to handle this</Text>
              <View style={styles.reviewHeader}>
                <View style={styles.flex}>
                  <Text accessibilityRole="header" style={styles.sheetTitle}>
                    Is this {selectedReviewDraft.interpretation}?
                  </Text>
                  <Text style={styles.bodyText}>
                    {formatReviewDay(selectedReviewDraft.date)} · From your statement
                  </Text>
                </View>
                <Text style={styles.amountText}>
                  {formatMinorMoney(selectedReviewDraft.amountMinor)}
                </Text>
              </View>
              <View style={styles.consequenceRows}>
                <Text style={styles.noteText}>
                  {selectedReviewDraft.date} · From your statement: “{selectedReviewDraft.original}”
                </Text>
                <Text style={styles.noteText}>
                  {selectedReviewDraft.amountMinor < 0
                    ? 'Money out if you add it.'
                    : 'Money in if you add it.'}{' '}
                  Nothing changes until you do.
                </Text>
              </View>
              <View style={styles.reviewPrimaryActions}>
                <PrimaryButton
                  accessibilityHint={`Adds ${selectedReviewDraft.interpretation} to your money.`}
                  accessibilityLabel={`Add ${selectedReviewDraft.interpretation} to my money`}
                  label="Add to my money"
                  onPress={() => {
                    onConfirmDraft(selectedReviewDraft.rowId);
                    setSelectedReviewDraftId(null);
                  }}
                />
              </View>

              <FolioRevealRow
                accessibilityHint="Shows other ways to handle this one: edit, set aside, or label it."
                accessibilityLabel="More. Edit, ignore, duplicate, transfer, refund, income, bill, debt payment or later."
                detail="Edit, set aside, or label it."
                expanded={showMoreRowActions}
                mode="reveal"
                onPress={() => setShowMoreRowActions((visible) => !visible)}
                title="More"
              />

              {showMoreRowActions ? (
                <View style={styles.reviewActionGrid}>
                  <SecondaryButton
                    accessibilityHint="Opens fields to change this payment before you add it."
                    label="Edit"
                    onPress={() => {
                      startEditing(selectedReviewDraft);
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Keeps this one out of your money."
                    label="Ignore"
                    onPress={() => {
                      onDismissDraft(selectedReviewDraft.rowId, 'other');
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Marks this as a duplicate and keeps it out of your picture."
                    label="Duplicate"
                    onPress={() => {
                      onDismissDraft(selectedReviewDraft.rowId, 'duplicate');
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Excludes this as an internal transfer or movement."
                    label="Transfer"
                    onPress={() => {
                      onDismissDraft(selectedReviewDraft.rowId, 'transfer-internal', 'Excluded');
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Marks this as a refund and keeps it waiting for Add."
                    label="Refund"
                    onPress={() => {
                      markDraftMeaning(selectedReviewDraft, 'Refund', 'incoming');
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Marks this as income and keeps it waiting for Add."
                    label="Income"
                    onPress={() => {
                      markDraftMeaning(selectedReviewDraft, 'Income', 'incoming');
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Marks this as a bill and keeps it waiting for Add."
                    label="Bill"
                    onPress={() => {
                      markDraftMeaning(selectedReviewDraft, 'Bill', 'outgoing');
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Marks this as a debt payment and keeps it waiting for Add."
                    label="Debt payment"
                    onPress={() => {
                      markDraftMeaning(selectedReviewDraft, 'Debt payment', 'outgoing');
                      setSelectedReviewDraftId(null);
                    }}
                  />
                  <SecondaryButton
                    accessibilityHint="Leaves this one waiting and changes nothing."
                    label="Later"
                    onPress={() => {
                      setLocalReviewAction(
                        `${selectedReviewDraft.interpretation} left for later. Nothing changed.`,
                      );
                      setSelectedReviewDraftId(null);
                    }}
                  />
                </View>
              ) : null}
              <View style={styles.actionRow}>
                <SecondaryButton
                  accessibilityHint="Closes these actions without changing this payment."
                  label="Close"
                  onPress={() => setSelectedReviewDraftId(null)}
                />
                <SecondaryButton
                  accessibilityHint={`Asks Melo for a review-only label suggestion for ${selectedReviewDraft.original}.`}
                  accessibilityLabel={`Ask Melo to suggest a label for ${selectedReviewDraft.original}`}
                  label="Ask Melo"
                  onPress={() => {
                    onMeloSuggestDraft(selectedReviewDraft.rowId);
                    setSelectedReviewDraftId(null);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <FolioRevealRow
        accessibilityHint="Shows or hides the original wording and review details for this import."
        accessibilityLabel="Review details. Original wording stays attached and Melo suggestions only run when asked."
        detail="Original wording and history stay attached."
        expanded={showImportDetails}
        mode="reveal"
        onPress={() => setShowImportDetails((visible) => !visible)}
        title="Original and review details"
      />

      {showImportDetails ? (
        <>
          <DiscoveryList rows={visibleDiscoveryRows} />

          <View
            accessible
            accessibilityLabel="Nothing is silently rewritten. Original wording stays attached, local history keeps a record and Melo suggestions only run when you tap Ask Melo."
            style={styles.notePanel}
          >
            <Text style={styles.noteTitle}>Nothing is silently rewritten.</Text>
            <Text style={styles.noteText}>
              Original wording stays attached. Melo suggestions only run when you ask.
            </Text>
          </View>
        </>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={editingDraft !== undefined}
        onRequestClose={() => setEditingDraftId(null)}
      >
        <View style={styles.modalScrim}>
          <View accessibilityViewIsModal accessible={false} style={styles.sheet}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.sheetHandle}
            />
            <Text style={styles.answerLabel}>Edit this payment</Text>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              Change it before confirming.
            </Text>
            <Text style={styles.bodyText}>
              The original wording stays attached. Saving this edit still leaves this payment
              waiting for your Add tap.
            </Text>
            <TextInput
              accessibilityLabel="Edited interpretation"
              onChangeText={setEditInterpretation}
              placeholder="Interpretation"
              placeholderTextColor={colors.text.muted}
              style={styles.textInput}
              value={editInterpretation}
            />
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Edited amount"
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setEditAmountText}
                placeholder="-12.34"
                placeholderTextColor={colors.text.muted}
                style={[styles.textInput, styles.flex]}
                value={editAmountText}
              />
              <TextInput
                accessibilityLabel="Edited date"
                onChangeText={setEditDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
                style={styles.dateInput}
                value={editDate}
              />
            </View>
            <View style={styles.actionRow}>
              <SecondaryButton
                accessibilityHint="Closes editing without changing this waiting payment."
                label="Cancel"
                onPress={() => setEditingDraftId(null)}
              />
              <PrimaryButton
                accessibilityHint="Saves this edited payment. It still needs your Add before anything changes."
                disabled={!editReady}
                label="Save edit"
                onPress={() => {
                  if (editingDraft !== undefined) {
                    saveEditing(editingDraft.rowId);
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MeloScreen({
  ledger,
  onOpenImports,
  onOpenRecovery,
  onOpenSources,
  onOpenWhatIf,
  privateExampleMode,
  route,
  snapshot,
}: {
  ledger: LocalLedgerState;
  onOpenImports: () => void;
  onOpenRecovery: () => void;
  onOpenSources: () => void;
  onOpenWhatIf: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
  snapshot: MeloLocalFinancialSnapshot;
}) {
  const defaultPrompt = `Can I spend ${formatPounds(120)} before payday?`;
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [lastPrompt, setLastPrompt] = useState(defaultPrompt);
  const [showMeloDetails, setShowMeloDetails] = useState(false);
  const [draft, setDraft] = useState<MeloLocalAiDraft>(() =>
    draftMeloLocalAiResponse({
      prompt: defaultPrompt,
      snapshot,
      cloudAiEnabled: false,
      cloudConsentGranted: false,
      source: 'quick_action',
    }),
  );
  const promptReady = prompt.trim().length > 0;
  const evidenceRecords = useMemo(
    () => buildMeloLocalEvidenceRecords(ledger, route, lastPrompt, 4),
    [ledger, lastPrompt, route],
  );
  const recordLookup = useMemo(
    () => buildMeloLocalRecordLookup(ledger, route, lastPrompt, 4),
    [ledger, lastPrompt, route],
  );
  const displayDraft = useMemo<MeloLocalAiDraft>(() => {
    if (recordLookup === null) return draft;

    return {
      ...draft,
      answer: recordLookup.answer,
      uncertainty: 'none',
      uncertaintyReason: 'Melo answered from matching local records without changing anything.',
      dataUsed: recordLookup.dataUsed,
      detectedAmountMinor: null,
      financialConclusion: recordLookup.financialConclusion,
      followUpChips: ['See sources', 'Ask a spend question', 'Review imports'],
      guardrails: recordLookup.guardrails,
      intent: 'explain_position',
      requiresUserReview: false,
      actions: [
        {
          detail: 'Open the records and money figures used for this answer.',
          kind: 'explain_sources',
          label: 'See sources',
          requiresUserReview: false,
        },
        {
          detail: 'Try a spend amount without saving it.',
          kind: 'open_what_if',
          label: 'Test a purchase',
          requiresUserReview: true,
        },
        {
          detail: 'Confirm, edit or dismiss each payment one at a time.',
          kind: 'review_imports',
          label: 'Review imports',
          requiresUserReview: true,
        },
      ],
    };
  }, [draft, recordLookup]);
  const safeDisplayDraft = useMemo<MeloLocalAiDraft>(
    () => gateMeloLocalAiDraft(displayDraft).draft,
    [displayDraft],
  );
  const displayedEvidenceRecords = recordLookup?.records ?? evidenceRecords;
  const meloStateRows = useMemo(
    () =>
      buildMeloStateRows({
        evidenceCount: displayedEvidenceRecords.length,
        requiresReview: safeDisplayDraft.requiresUserReview,
        uncertainty: safeDisplayDraft.uncertainty,
      }),
    [
      displayedEvidenceRecords.length,
      safeDisplayDraft.requiresUserReview,
      safeDisplayDraft.uncertainty,
    ],
  );

  const runLocalAi = useCallback(
    (question?: string) => {
      const nextPrompt = (question ?? prompt).trim();
      if (nextPrompt.length === 0) return;

      const nextDraft = draftMeloLocalAiResponse({
        prompt: nextPrompt,
        snapshot,
        cloudAiEnabled: false,
        cloudConsentGranted: false,
        source: question ? 'quick_action' : 'typed_prompt',
      });
      const nextLookup = buildMeloLocalRecordLookup(ledger, route, nextPrompt, 4);

      setLastPrompt(nextPrompt);
      setDraft(nextDraft);
      setPrompt('');
      AccessibilityInfo.announceForAccessibility('Melo response is ready for review.');
    },
    [ledger, prompt, route, snapshot],
  );

  useEffect(() => {
    setDraft(
      draftMeloLocalAiResponse({
        prompt: lastPrompt,
        snapshot,
        cloudAiEnabled: false,
        cloudConsentGranted: false,
        source: 'quick_action',
      }),
    );
  }, [lastPrompt, snapshot]);
  const routeBriefingText = gateMeloText(
    `I am using ${
      privateExampleMode ? 'the private example route' : 'your records on this device'
    }: ${formatMinorMoney(snapshot.availableNowMinor)} available now, tightest point ${formatMinorMoney(
      snapshot.tightestBalanceMinor,
    )} ${snapshot.tightestDay}.`,
    'I am using visible local records for this briefing.',
  );
  const routeConclusionText = gateMeloText(
    snapshot.pendingReviewCount > 0
      ? `${snapshot.pendingReviewCount} review item${
          snapshot.pendingReviewCount === 1 ? '' : 's'
        } are held out of confirmed math.`
      : 'No review items are being treated as confirmed.',
    'Review items stay separate from confirmed math.',
  );

  return (
    <View style={styles.screenStack}>
      <View style={styles.chatTitle}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.avatarLargeSmall}
        >
          <Text style={styles.avatarLargeText}>M</Text>
        </View>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.answerTitle}>
            Melo
          </Text>
          <Text style={styles.rowText}>
            Local rules -{' '}
            {privateExampleMode ? 'using the private example' : 'using what you have saved'}
          </Text>
        </View>
      </View>

      <MeloBoundarySurface />

      <InteractionRibbon
        accessibilityLabel="Melo interaction language. Ask one bounded question, reveal local records, and review before any change is saved."
        steps={meloInteractionSteps}
      />

      <View style={styles.chatStack}>
        <View
          accessible
          accessibilityLabel={`Melo current route briefing. ${formatMinorMoney(
            snapshot.availableNowMinor,
          )} available now. Tightest point ${formatMinorMoney(snapshot.tightestBalanceMinor)} ${
            snapshot.tightestDay
          }. ${snapshot.pendingReviewCount} imports or records need review.`}
          style={[styles.chatBubble, styles.chatBubbleMelo]}
        >
          <Text style={styles.chatSpeaker}>Melo route briefing</Text>
          <Text style={styles.chatText}>{surfacePreviewText(routeBriefingText, 110)}</Text>
          <Text style={styles.aiConclusion}>{routeConclusionText}</Text>
        </View>
      </View>

      <View style={styles.aiPromptPanel}>
        <Text style={styles.answerLabel}>Ask one useful thing</Text>
        <Text style={styles.noteText}>
          Melo explains local records. Changes still need your tap.
        </Text>
        <TextInput
          accessibilityHint="Type a question for Melo, such as can I spend 120 before payday."
          accessibilityLabel="Ask Melo"
          maxLength={180}
          multiline
          onChangeText={setPrompt}
          onSubmitEditing={() => runLocalAi()}
          placeholder={`Can I spend ${formatPounds(120)} before payday?`}
          placeholderTextColor={colors.text.muted}
          returnKeyType="send"
          style={styles.aiInput}
          value={prompt}
        />
        <PrimaryButton
          accessibilityHint="Runs the local Melo rules draft from the current route."
          disabled={!promptReady}
          label="Ask Melo"
          onPress={() => runLocalAi()}
        />
      </View>

      <View style={styles.chatStack}>
        <View
          accessible
          accessibilityLabel={`You asked Melo: ${lastPrompt}`}
          style={[styles.chatBubble, styles.chatBubbleUser]}
        >
          <Text style={[styles.chatSpeaker, styles.chatSpeakerUser]}>You</Text>
          <Text style={[styles.chatText, styles.chatTextUser]}>{lastPrompt}</Text>
        </View>
        <View
          accessible
          accessibilityLabel={`Melo local rules answered: ${safeDisplayDraft.answer}. ${safeDisplayDraft.financialConclusion}`}
          style={[styles.chatBubble, styles.chatBubbleMelo]}
        >
          <Text style={styles.chatSpeaker}>Melo local rules</Text>
          <Text style={styles.chatText}>{surfacePreviewText(safeDisplayDraft.answer, 130)}</Text>
          <Text style={styles.aiConclusion}>{safeDisplayDraft.financialConclusion}</Text>
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={`Melo state pattern. ${meloStateRows
          .map((row) => `${row.label}: ${row.detail}`)
          .join('. ')}`}
        style={styles.meloStatePanel}
      >
        <Text style={styles.answerLabel}>Melo state</Text>
        {meloStateRows.map((row) => (
          <View key={row.label} style={styles.meloStateRow}>
            <Badge label={row.label} tone={row.tone} />
            <Text style={styles.meloStateText}>{row.detail}</Text>
          </View>
        ))}
      </View>

      <View style={styles.aiResultPanel}>
        <View style={styles.metaRow}>
          <Text style={styles.noteTitle}>Melo can do next</Text>
          <Badge label="Local" tone="confirmed" />
        </View>
        <View style={styles.aiActionStack}>
          {safeDisplayDraft.actions.map((action) => (
            <Pressable
              accessibilityHint={`${action.detail} ${
                action.requiresUserReview ? 'Requires your review before anything changes.' : ''
              }`}
              accessibilityLabel={`${action.label}. ${action.detail}`}
              accessibilityRole="button"
              key={`${action.kind}-${action.label}`}
              onPress={() =>
                handleMeloAction({
                  askMelo: runLocalAi,
                  kind: action.kind,
                  openImports: onOpenImports,
                  openRecovery: onOpenRecovery,
                  openSources: onOpenSources,
                  openWhatIf: onOpenWhatIf,
                })
              }
              style={({ pressed }) => [styles.aiActionRow, pressed ? styles.pressed : undefined]}
            >
              <View style={styles.flex}>
                <Text style={styles.aiActionTitle}>{action.label}</Text>
                <Text style={styles.aiActionDetail}>{action.detail}</Text>
              </View>
              {action.requiresUserReview ? <Badge label="Review" tone="attention" /> : null}
            </Pressable>
          ))}
        </View>
        <FolioRevealRow
          accessibilityHint="Shows or hides the local records and guardrails Melo checked."
          accessibilityLabel={`Sources Melo checked. ${safeDisplayDraft.dataUsed.join('. ')}`}
          detail="Open for data used and guardrails."
          expanded={showMeloDetails}
          mode="melo"
          onPress={() => setShowMeloDetails((visible) => !visible)}
          title="Sources Melo checked"
        />
        {showMeloDetails ? (
          <>
            <View
              accessible
              accessibilityLabel={`Data used. ${safeDisplayDraft.dataUsed.join('. ')}`}
              style={styles.aiDataPanel}
            >
              <Text style={styles.noteTitle}>Data used</Text>
              {safeDisplayDraft.dataUsed.map((item) => (
                <Text key={item} style={styles.noteText}>
                  {item}
                </Text>
              ))}
            </View>
            <View
              accessible
              accessibilityLabel={`Local records Melo checked. ${displayedEvidenceRecords
                .map((record) => `${record.title}. ${record.detail}. ${record.meta}`)
                .join('. ')}`}
              style={styles.aiDataPanel}
            >
              <Text style={styles.noteTitle}>Local records checked</Text>
              {displayedEvidenceRecords.map((record) => (
                <View key={record.id} style={styles.aiEvidenceRow}>
                  <View style={styles.flex}>
                    <Text style={styles.sourceLabel}>{record.title}</Text>
                    <Text style={styles.originalText}>{record.detail}</Text>
                    <Text style={styles.reviewInterpretation}>{record.meta}</Text>
                  </View>
                  {record.amountMinor !== undefined ? (
                    <Text style={styles.sourceDetail}>{formatMinorMoney(record.amountMinor)}</Text>
                  ) : null}
                </View>
              ))}
            </View>
            <View style={styles.aiGuardrailStack}>
              {safeDisplayDraft.guardrails.map((guardrail) => (
                <Text key={guardrail} style={styles.noteText}>
                  {guardrail}
                </Text>
              ))}
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.quickRow}>
        <SecondaryButton
          accessibilityHint="Asks Melo whether a test purchase fits."
          label={`Can I spend ${formatPounds(120)}?`}
          onPress={() => runLocalAi(`Can I spend ${formatPounds(120)} before payday?`)}
        />
        <SecondaryButton
          accessibilityHint="Asks Melo to explain the available amount."
          label={`Why ${formatMinorMoney(route.availableNowMinor)}?`}
          onPress={() =>
            runLocalAi(`Why is ${formatMinorMoney(route.availableNowMinor)} available?`)
          }
        />
        <SecondaryButton
          accessibilityHint="Asks Melo to help review uncertain imports."
          label="Review imports"
          onPress={() => runLocalAi('Review imports needing my eye')}
        />
      </View>
    </View>
  );
}

function MoneyScreen({
  amount,
  onAddManualTransaction,
  onDecrease,
  onIncrease,
  privateExampleMode,
  route,
  scenario,
}: {
  amount: number;
  onAddManualTransaction: (input: ManualTransactionInput) => void;
  onDecrease: () => void;
  onIncrease: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
  scenario: LocalScenarioPreview;
}) {
  const [manualTitle, setManualTitle] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const previewRoute = scenario.previewRoute;
  const manualAmountMinor = previewAmountMinorFromText(manualAmount);
  const manualEntryReady =
    manualTitle.trim().length > 0 && manualAmountMinor !== null && manualAmountMinor > 0;

  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>Purchase test</Text>
      <Text accessibilityRole="header" style={styles.answerTitle}>
        Test a purchase without saving it.
      </Text>
      <Text style={styles.bodyText}>
        Preview only. Folio recalculates from{' '}
        {privateExampleMode
          ? 'the private example until you add your own money'
          : 'the same confirmed data'}
        .
      </Text>
      <AmountStepper amount={amount} onDecrease={onDecrease} onIncrease={onIncrease} />
      <View accessibilityLiveRegion="polite" style={styles.routeCanvas}>
        <Text style={styles.routeCanvasLabel}>What-if route</Text>
        <BreathingHorizon route={previewRoute} />
      </View>
      <ImpactRows amount={amount} impact={scenario.impact} />
      <SecondaryButton
        accessibilityHint="Copies the tried amount into the entry field below without saving it."
        label="Use amount in entry"
        onPress={() => setManualAmount(String(amount))}
      />

      <View style={styles.manualPanel}>
        <Text style={styles.noteTitle}>Add it yourself</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Entry title"
            onChangeText={setManualTitle}
            placeholder="Title"
            placeholderTextColor={colors.text.muted}
            style={[styles.textInput, styles.flex]}
            value={manualTitle}
          />
          <TextInput
            accessibilityLabel="Entry amount"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setManualAmount}
            placeholder="0.00"
            placeholderTextColor={colors.text.muted}
            style={styles.amountInput}
            value={manualAmount}
          />
        </View>
        <View style={styles.actionRow}>
          <PrimaryButton
            accessibilityHint="Adds this spend locally."
            disabled={!manualEntryReady}
            label="Add spend"
            onPress={() =>
              onAddManualTransaction({
                title: manualTitle,
                amountText: manualAmount,
                kind: 'spend',
              })
            }
          />
          <SecondaryButton
            accessibilityHint="Adds this income locally."
            disabled={!manualEntryReady}
            label="Add income"
            onPress={() =>
              onAddManualTransaction({
                title: manualTitle,
                amountText: manualAmount,
                kind: 'income',
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

function RecoveryScreen({
  ledger,
  onRecoveryAccepted,
  onRecordRecoverySpend,
  onReturnToday,
  plans,
  route,
}: {
  ledger: LocalLedgerState;
  onRecoveryAccepted: () => void;
  onRecordRecoverySpend: (input: ManualTransactionInput) => boolean;
  onReturnToday: () => void;
  plans: LocalPlansModel;
  route: LocalRouteSummary;
}) {
  const [recoveryTitle, setRecoveryTitle] = useState('');
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [acceptedConfirmation, setAcceptedConfirmation] =
    useState<RecoveryAcceptedConfirmation | null>(null);
  const recoveryMinor = previewAmountMinorFromText(recoveryAmount) ?? 0;
  const recoveryReady = recoveryTitle.trim().length > 0 && recoveryMinor > 0;
  const recoveryScenario = useMemo(
    () =>
      buildLocalRecoverySpendScenarioPreview(ledger, route, {
        amountMinor: recoveryMinor,
        label: recoveryTitle.trim() || 'Recovery spend',
      }),
    [ledger, recoveryMinor, recoveryTitle, route],
  );
  const previewRoute = recoveryScenario.previewRoute;
  const afterRecoveryMinor = recoveryScenario.impact.remainingMinor;
  const scenarioNotice = sentenceJoin([
    recoveryScenario.scenario.title,
    recoveryScenario.scenario.authorityState,
    recoveryScenario.writesImmediately ? 'Writes immediately' : 'Does not write immediately',
  ]);
  const recoveryMeloNote = buildCompactMeloNote({
    control: 'Review the preview, then record locally or go back.',
    matters:
      afterRecoveryMinor < 0
        ? 'The pressure is shown as a consequence, not a label.'
        : `${formatProtectedItems(route.protectedItems)} stays visible before saving.`,
    noticed: recoveryReady
      ? `${recoveryTitle.trim()} changes the preview route.`
      : 'This recovery item is still a preview.',
  });

  if (acceptedConfirmation !== null) {
    return (
      <View style={styles.screenStack}>
        <Badge label="Recovery saved" tone="confirmed" />
        <Text accessibilityRole="header" style={styles.answerTitle}>
          Your reviewed update is now part of the plan.
        </Text>
        <Text style={styles.bodyText}>
          Folio recorded the reviewed recovery update and rebuilt the local picture.
        </Text>
        <View
          accessible
          accessibilityLabel={`Recovery saved. ${acceptedConfirmation.changed}. ${acceptedConfirmation.protectedItems}. Inspect evidence in ${acceptedConfirmation.evidencePath}. Next review date ${acceptedConfirmation.nextReviewDate}.`}
          style={styles.recoveryConfirmationPanel}
        >
          <Text style={styles.noteTitle}>Recovery saved</Text>
          <View style={styles.consequenceRows}>
            <RouteRow
              label="What changed"
              source="Accepted recovery decision"
              tone="confirmed"
              value={acceptedConfirmation.changed}
            />
            <RouteRow
              label="Still protected"
              source="Current route protected items"
              tone="confirmed"
              value={acceptedConfirmation.protectedItems}
            />
            <RouteRow
              label="Decision evidence"
              source="Timeline and Data and privacy"
              tone="confirmed"
              value={acceptedConfirmation.evidencePath}
            />
            <RouteRow
              label="Next review"
              source="Plan review date"
              tone="estimated"
              value={acceptedConfirmation.nextReviewDate}
            />
          </View>
        </View>
        <InteractionRibbon
          accessibilityLabel="Recovery saved interaction language. Inspect Today, Timeline, Calendar or Data and privacy before making another change."
          steps={recoverySavedInteractionSteps}
        />
        <PrimaryButton
          accessibilityHint="Returns to Today after the saved recovery confirmation."
          label="Return to Today"
          onPress={onReturnToday}
        />
      </View>
    );
  }

  return (
    <View style={styles.screenStack}>
      <Badge label="Preview" tone="attention" />
      <Text accessibilityRole="header" style={styles.answerTitle}>
        Preview a pressure point before recording it.
      </Text>
      <Text style={styles.bodyText}>
        Try the amount first. Nothing is saved until you name it and tap record.
      </Text>
      <RecoveryPathSurface note={recoveryMeloNote} />
      <InteractionRibbon
        accessibilityLabel="Recovery interaction language. Try the change first, keep protected items visible, and record only after review."
        steps={recoveryInteractionSteps}
      />
      <View style={styles.manualPanel}>
        <Text style={styles.noteTitle}>Recovery spend</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Recovery item title"
            onChangeText={setRecoveryTitle}
            placeholder="Repair, bill or urgent spend"
            placeholderTextColor={colors.text.muted}
            style={[styles.textInput, styles.flex]}
            value={recoveryTitle}
          />
          <TextInput
            accessibilityLabel="Recovery item amount"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setRecoveryAmount}
            placeholder="0.00"
            placeholderTextColor={colors.text.muted}
            style={styles.amountInput}
            value={recoveryAmount}
          />
        </View>
      </View>
      <View
        accessible
        accessibilityLabel="Recovery preview guardrails. This is a preview. Nothing has changed yet. You review protected items, pressure and sources before saving."
        style={styles.recoveryGuardrailPanel}
      >
        <Text style={styles.noteTitle}>Preview guardrails</Text>
        <Text style={styles.noteText}>
          Nothing has changed yet. Folio is showing what remains protected, what becomes pressured
          and what you can inspect before saving.
        </Text>
        <View style={styles.consequenceRows}>
          <RouteRow
            label="State"
            source={recoveryScenario.scenario.authorityState}
            tone="estimated"
            value="Preview only"
          />
          <RouteRow
            label="Protected"
            source="Current route protected items"
            tone={route.protectedItems.length > 0 ? 'confirmed' : 'estimated'}
            value={formatProtectedItems(route.protectedItems)}
          />
          <RouteRow
            label="Save effect"
            source="User confirmation"
            tone="attention"
            value="Only after Record locally"
          />
        </View>
      </View>
      <View style={styles.factList}>
        <RouteRow
          label="Now available"
          source="Current route before preview"
          value={formatMinorMoney(route.availableNowMinor)}
          tone={route.availableNowMinor < 0 ? 'attention' : 'confirmed'}
        />
        <RouteRow
          label="Preview after spend"
          source="Scenario preview"
          value={formatMinorMoney(afterRecoveryMinor)}
          tone={
            afterRecoveryMinor < 0
              ? 'attention'
              : afterRecoveryMinor < 4_500
                ? 'estimated'
                : 'confirmed'
          }
        />
        <RouteRow
          label="Tightest day"
          source="Preview route"
          value={`${formatMinorMoney(previewRoute.tightestBalanceMinor)} ${
            previewRoute.tightestDay
          }`}
          tone={previewRoute.tightestBalanceMinor < 0 ? 'attention' : 'estimated'}
        />
        <RouteRow
          label="Coming up"
          value={`${plans.planRows.length} draft${plans.planRows.length === 1 ? '' : 's'}`}
          tone={plans.planRows.length > 0 ? 'estimated' : 'confirmed'}
        />
        <RouteRow
          label="Protected items"
          value={`${route.protectedItems.length} item${route.protectedItems.length === 1 ? '' : 's'}`}
          tone={route.protectedItems.length > 0 ? 'confirmed' : 'estimated'}
        />
      </View>
      <BreathingHorizon route={previewRoute} />
      <View
        accessible
        accessibilityLabel={`Nothing is saved yet. Folio rebuilt the preview route from your confirmed records. ${scenarioNotice}`}
        style={styles.notePanelStrong}
      >
        <Text style={styles.noteTitle}>Nothing is saved yet.</Text>
        <Text style={styles.noteText}>
          Folio rebuilt this preview from your confirmed records. Recording it adds a local spend
          and rebuilds Today, Calendar, Money and Melo.
        </Text>
      </View>
      <PrimaryButton
        accessibilityHint="Records this recovery spend locally and shows the recovery confirmation."
        disabled={!recoveryReady}
        label="Record locally"
        onPress={() => {
          const saved = onRecordRecoverySpend({
            title: recoveryTitle,
            amountText: recoveryAmount,
            kind: 'spend',
          });
          if (!saved) return;
          setAcceptedConfirmation(
            buildRecoveryAcceptedConfirmation({
              amountMinor: recoveryMinor,
              plans,
              protectedItems: route.protectedItems,
              remainingMinor: afterRecoveryMinor,
              title: recoveryTitle,
            }),
          );
          onRecoveryAccepted();
        }}
      />
      <SecondaryButton
        accessibilityHint="Returns to Today without saving this recovery item."
        label="Back without saving"
        onPress={onReturnToday}
      />
    </View>
  );
}

function MoreScreen({
  developerModeAvailable,
  developerModeEnabled,
  onLockApp,
  onOpenCalendar,
  onOpenData,
  onOpenDogfood,
  onOpenImport,
  onOpenPlans,
  onOpenRecovery,
  onOpenTimeline,
  onReplayFirstMinute,
  onRefreshSecurity,
  onResetSample,
  onToggleDeveloperMode,
  persistenceStatus,
  privateExampleMode,
  securityPosture,
  vaultSummary,
}: {
  developerModeAvailable: boolean;
  developerModeEnabled: boolean;
  onLockApp: () => void;
  onOpenCalendar: () => void;
  onOpenData: () => void;
  onOpenDogfood: () => void;
  onOpenImport: () => void;
  onOpenPlans: () => void;
  onOpenRecovery: () => void;
  onOpenTimeline: () => void;
  onReplayFirstMinute: () => void;
  onRefreshSecurity: () => void;
  onResetSample: () => void;
  onToggleDeveloperMode: () => void;
  persistenceStatus: PersistenceStatus;
  privateExampleMode: boolean;
  securityPosture: LocalSecurityPosture | null;
  vaultSummary: LocalLedgerVaultSummary;
}) {
  const securityMode = securityPosture?.appLockMode;
  const securityCopy = securityPostureCopy(securityPosture);
  const lockAvailable = securityMode === 'device_auth';
  const persistenceCopy = persistenceStatusCopy(persistenceStatus, privateExampleMode);

  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>More</Text>
      <Text accessibilityRole="header" style={styles.answerTitle}>
        More options.
      </Text>
      <MenuRow
        detail="See accepted changes and review items as explanation"
        hint="Opens Timeline from More."
        title="Timeline"
        onPress={onOpenTimeline}
      />
      <MenuRow
        detail="See dates that matter to the money picture"
        hint="Opens Calendar from More."
        title="Calendar"
        onPress={onOpenCalendar}
      />
      <MenuRow
        detail="See what's coming up, based on what you've planned"
        hint="Opens your plans."
        title="Plans"
        onPress={onOpenPlans}
      />
      <MenuRow
        detail="See what changes and what stays protected before you spend"
        hint="Opens a safe-to-spend preview."
        title="What if I spend?"
        onPress={onOpenRecovery}
      />
      <MenuRow
        detail="What's waiting, what you ignored and your review history"
        hint="Opens Review."
        title="Review"
        onPress={onOpenImport}
      />
      <MenuRow
        detail="Search, export and clear records on this device"
        hint="Opens Data and privacy."
        title="Data and privacy"
        onPress={onOpenData}
      />
      <MenuRow
        detail="Example only, not your data, nothing saved"
        hint="Opens the sample briefing without changing anything you've saved."
        title="Sample briefing"
        onPress={onResetSample}
      />
      {developerModeEnabled ? (
        <>
          <MenuRow
            detail="Fake seeds, reset and redacted test files for developer testing"
            hint="Opens developer test controls for this build."
            title="Internal test mode"
            onPress={onOpenDogfood}
          />
          <MenuRow
            detail="Return to the relief-first introduction"
            hint="Replays the first-minute product flow without changing anything you've saved."
            title="Replay first minute"
            onPress={onReplayFirstMinute}
          />
        </>
      ) : null}
      <View style={styles.securityPanel}>
        <Text style={styles.answerLabel}>Settings</Text>
        <Text style={styles.noteTitle}>{securityCopy}</Text>
        <Text style={styles.originalText}>
          {securityPosture?.note ?? 'Checking local security posture on this device.'}
        </Text>
        {lockAvailable ? (
          <PrimaryButton
            accessibilityHint="Locks Folio and requires device authentication before returning."
            label="Lock app now"
            onPress={onLockApp}
          />
        ) : (
          <SecondaryButton
            accessibilityHint="Rechecks device key storage and device authentication availability."
            label="Refresh security check"
            onPress={onRefreshSecurity}
          />
        )}
        <RouteRow
          label="Key"
          tone={securityPosture?.secureStoreAvailable ? 'confirmed' : 'attention'}
          value={databaseKeyStateCopy(securityPosture?.databaseKeyState)}
        />
        <RouteRow
          label="App lock"
          tone={lockAvailable ? 'confirmed' : 'attention'}
          value={appLockModeCopy(securityPosture?.appLockMode)}
        />
        {developerModeAvailable ? (
          <SecondaryButton
            accessibilityHint="Shows or hides developer and test tools. Off by default and never shown in the released app."
            label={developerModeEnabled ? 'Turn off developer mode' : 'Turn on developer mode'}
            onPress={onToggleDeveloperMode}
          />
        ) : null}
      </View>
      <View style={styles.vaultPanel}>
        <Text style={styles.answerLabel}>On this device</Text>
        <Text style={styles.noteTitle}>{persistenceCopy}</Text>
        <RouteRow
          label="Saved here"
          tone={persistenceStatus === 'saved' ? 'confirmed' : 'attention'}
          value={persistenceStatusShortCopy(persistenceStatus)}
        />
        <Text style={styles.originalText}>
          Everything you add stays on this device. You can take it with you or clear it from Data
          and privacy.
        </Text>
        {developerModeEnabled ? (
          <>
            <RouteRow
              label="Records"
              tone="confirmed"
              value={`${vaultSummary.transactionRows} transactions, ${vaultSummary.importDraftRows} drafts, ${vaultSummary.documentStageRows} files`}
            />
            <RouteRow
              label="Local history"
              tone={vaultSummary.validation.valid ? 'confirmed' : 'attention'}
              value={`${vaultSummary.searchRows} source-linked records, ${vaultSummary.historyRows} saved changes`}
            />
            <Text style={styles.originalText}>
              Local record check {vaultSummary.validation.valid ? 'passed' : 'needs review'}.
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

function DogfoodModeScreen({
  lastAction,
  onExportDiagnostic,
  onLoadScenario,
  onOpenData,
  onResetLocalData,
  scenarios,
  status,
}: {
  lastAction: string | null;
  onExportDiagnostic: () => Promise<string>;
  onLoadScenario: (id: DogfoodScenarioSeed['id']) => void;
  onOpenData: () => void;
  onResetLocalData: () => void;
  scenarios: readonly DogfoodScenarioSeed[];
  status: DogfoodStatus;
}) {
  const [diagnosticMessage, setDiagnosticMessage] = useState(
    'No redacted test file prepared in this session.',
  );
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const exportDiagnostic = useCallback(async () => {
    setDiagnosticBusy(true);
    const message = await onExportDiagnostic();
    setDiagnosticMessage(message);
    setDiagnosticBusy(false);
  }, [onExportDiagnostic]);

  return (
    <View style={styles.screenStack}>
      <Text style={styles.answerLabel}>Internal test</Text>
      <Text accessibilityRole="header" style={styles.answerTitle}>
        Internal test mode
      </Text>
      <Text style={styles.bodyText}>
        Local owner testing controls. Fake seeds, reset and redacted test files stay on this device.
      </Text>

      <InteractionRibbon
        accessibilityLabel="Internal test interaction language. Internal label, fake seed loading and redacted local test file export."
        steps={dogfoodInteractionSteps}
      />

      <View style={styles.securityPanel}>
        <Text style={styles.answerLabel}>{dogfoodModeContract.label}</Text>
        <Text style={styles.noteTitle}>No upload path is enabled.</Text>
        <Text style={styles.originalText}>
          Account, cloud, AI and Open Banking are not required for this owner harness.
        </Text>
        <RouteRow
          label="Upload"
          source="Owner test settings"
          tone="confirmed"
          value={String(status.dogfoodMode.uploadAllowed)}
        />
        <RouteRow
          label="Workspace"
          source="Local records on this device"
          tone="confirmed"
          value={status.workspaceState.empty ? 'Empty personal local' : 'Personal local'}
        />
        <RouteRow
          label="Picture"
          source="Current local picture"
          tone={status.routeState.pendingReview > 0 ? 'attention' : 'confirmed'}
          value={`${status.routeState.routePoints} points, ${status.routeState.pendingReview} review`}
        />
      </View>

      <View style={styles.manualPanel}>
        <Text style={styles.noteTitle}>Local record counts</Text>
        <RouteRow
          label="Facts"
          source="Local records on this device"
          tone="confirmed"
          value={`${status.canonicalObjectCounts.transactions} payments, ${status.canonicalObjectCounts.events} events`}
        />
        <RouteRow
          label="Imports"
          source="Local records on this device"
          tone={status.importReviewState.activeDrafts > 0 ? 'attention' : 'confirmed'}
          value={`${status.canonicalObjectCounts.importDrafts} drafts, ${status.importReviewState.rejectedEvidence} rejected`}
        />
        <RouteRow
          label="Plans"
          source="Local records on this device"
          tone={status.planRecoveryState.impactsNeedingReview > 0 ? 'attention' : 'confirmed'}
          value={`${status.planRecoveryState.activePlans} active, ${status.planRecoveryState.planRules} rules`}
        />
        <RouteRow
          label="Recovery"
          source="Local records on this device"
          tone={status.planRecoveryState.acceptedRecoveries > 0 ? 'estimated' : 'confirmed'}
          value={`${status.canonicalObjectCounts.scenarios} previews, ${status.planRecoveryState.decisions} decisions`}
        />
        <RouteRow
          label="Melo"
          source="Local records on this device"
          tone="confirmed"
          value={`${status.meloProposalCount} review notes`}
        />
      </View>

      <View style={styles.securityPanel}>
        <Text style={styles.answerLabel}>Reset and test file</Text>
        <Text style={styles.noteTitle}>Clean state before each run.</Text>
        <Text style={styles.originalText}>
          Reset clears local test data. Export writes redacted JSON and Markdown files to app
          storage.
        </Text>
        {lastAction !== null ? (
          <Text style={styles.noteText}>Last action: {lastAction}</Text>
        ) : null}
        <Text style={styles.noteText}>{diagnosticMessage}</Text>
        <View style={styles.actionRow}>
          <SecondaryButton
            accessibilityHint="Resets local records to an empty dogfood baseline."
            label="Reset local data"
            onPress={onResetLocalData}
          />
          <PrimaryButton
            accessibilityHint="Writes a redacted local test file for the owner test."
            disabled={diagnosticBusy}
            label={diagnosticBusy ? 'Preparing' : 'Export test file'}
            onPress={() => {
              void exportDiagnostic();
            }}
          />
        </View>
        <SecondaryButton
          accessibilityHint="Opens Data and privacy to inspect exports and clearing state."
          label="Open Data and privacy"
          onPress={onOpenData}
        />
      </View>

      <View style={styles.sourcePanel}>
        <Text style={styles.answerLabel}>Scenario seeds</Text>
        {scenarios.map((scenario) => (
          <MenuRow
            detail={`Fake data. Opens ${scenario.targetScreen}. Expected: ${scenario.expectedSurfaces.join(', ')}.`}
            hint={`Loads the internal test scenario ${scenario.title}.`}
            key={scenario.id}
            onPress={() => onLoadScenario(scenario.id)}
            title={scenario.title}
          />
        ))}
      </View>
    </View>
  );
}

function DataControlScreen({
  ledger,
  lastAction,
  onClearLocalRecords,
  onPrepareExport,
  persistenceStatus,
  privateExampleMode,
  route,
}: {
  ledger: LocalLedgerState;
  lastAction: string | null;
  onClearLocalRecords: () => void;
  onPrepareExport: () => Promise<string>;
  persistenceStatus: PersistenceStatus;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
}) {
  const [query, setQuery] = useState('');
  const [exportMessage, setExportMessage] = useState('No export file prepared in this session.');
  const [exportBusy, setExportBusy] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const [showRecordDetails, setShowRecordDetails] = useState(false);
  const records = useMemo(
    () => searchLocalLedgerEvidenceRecords(ledger, route, query, Number.MAX_SAFE_INTEGER),
    [ledger, query, route],
  );
  const totalRecords =
    ledger.transactions.length +
    ledger.importDrafts.length +
    ledger.rejectedImports.length +
    ledger.documentStages.length +
    ledger.history.length;
  const routePointCount = route.points.length;
  const workspaceEmpty = totalRecords === 0;

  const prepareExport = useCallback(async () => {
    setExportBusy(true);
    const message = await onPrepareExport();
    setExportMessage(message);
    setExportBusy(false);
  }, [onPrepareExport]);

  const clearRecords = useCallback(() => {
    onClearLocalRecords();
    setClearArmed(false);
    setQuery('');
    setExportMessage(
      'Local records were cleared. The workspace is empty; the first picture is not a confirmed zero bank balance.',
    );
  }, [onClearLocalRecords]);

  return (
    <FolioScreen>
      <View style={styles.answerCanvas}>
        <Eyebrow>Data and privacy</Eyebrow>
        <ScreenHeading>It stays on this device.</ScreenHeading>
      </View>

      <TrustPanel
        exportBusy={exportBusy}
        lines={[
          'Your data stays on this device.',
          'Anything you ignore stays separate from your money.',
          workspaceEmpty
            ? 'Nothing is saved yet — the opening figure is only a starting point.'
            : 'You can take a copy with you, or start fresh, anytime.',
        ]}
        onExport={() => {
          void prepareExport();
        }}
        onStartFresh={clearArmed ? clearRecords : () => setClearArmed(true)}
        startFreshArmed={clearArmed}
      />

      {exportMessage ? <SupportText>{exportMessage}</SupportText> : null}
      {lastAction !== null ? <SupportText>{lastAction}</SupportText> : null}

      <View>
        <Reveal
          accessibilityHint="Search and show what you've added, what's waiting and what you ignored on this device."
          detail="Added, waiting and ignored, on this device."
          expanded={showRecordDetails || query.trim().length > 0}
          onToggle={() => setShowRecordDetails((visible) => !visible)}
          title="See what's saved"
        />
        {showRecordDetails || query.trim().length > 0 ? (
          <View style={styles.answerCanvas}>
            <TextInput
              accessibilityLabel="Search what's saved"
              onChangeText={setQuery}
              placeholder="Merchant, bill, date or amount"
              placeholderTextColor={colors.text.muted}
              style={styles.textInput}
              value={query}
            />
            {records.length === 0 ? (
              <View
                accessible
                accessibilityLabel="Nothing matches this search."
                style={styles.sourceRow}
              >
                <Text style={styles.noteTitle}>Nothing matches.</Text>
                <Text style={styles.noteText}>Try a name, amount or date.</Text>
              </View>
            ) : (
              records.map((record) => <DataRecordRow key={record.id} record={record} />)
            )}
          </View>
        ) : null}
      </View>
    </FolioScreen>
  );
}

function DataRecordRow({ record }: { record: LocalSearchRecord }) {
  return (
    <View
      accessible
      accessibilityLabel={`${record.title}. ${record.detail}. ${record.meta}. ${
        record.amountMinor === undefined ? '' : formatMinorMoney(record.amountMinor)
      } ${toneAccessibilityLabel(record.tone)}.`}
      style={styles.sourceRow}
    >
      <View style={styles.reviewHeader}>
        <Text style={styles.sourceLabel}>{record.title}</Text>
        <Badge label={record.tone === 'attention' ? 'Review' : 'Known'} tone={record.tone} />
      </View>
      <Text style={styles.originalText}>{record.detail}</Text>
      <Text style={styles.reviewInterpretation}>{record.meta}</Text>
      {record.amountMinor !== undefined ? (
        <Text style={styles.sourceDetail}>{formatMinorMoney(record.amountMinor)}</Text>
      ) : null}
    </View>
  );
}

function BottomNav({
  active,
  onChange,
}: {
  active: ProductScreen;
  onChange: (screen: ProductScreen) => void;
}) {
  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            accessibilityHint={`Switches to the ${tab.label} screen.`}
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.navItem,
              tab.id === 'melo' ? styles.navItemMelo : undefined,
              selected ? styles.navItemActive : undefined,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.navIcon,
                tab.id === 'melo' ? styles.navIconMelo : undefined,
                selected && tab.id !== 'melo' ? styles.navIconActive : undefined,
              ]}
            >
              {tab.icon}
            </Text>
            <Text style={[styles.navText, selected ? styles.navTextActive : undefined]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepRail({ activeStep }: { activeStep: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`First minute progress. Step ${activeStep + 1} of 4.`}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 4, min: 1, now: activeStep + 1 }}
      style={styles.progressRail}
    >
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[styles.progressDot, index <= activeStep ? styles.progressDotActive : undefined]}
        />
      ))}
    </View>
  );
}

function BreathingHorizon({
  compact,
  recovery,
  route,
  shifted,
}: {
  compact?: boolean;
  recovery?: boolean;
  route?: LocalRouteSummary;
  shifted?: boolean;
}) {
  const chart = route === undefined ? undefined : routeChartGeometry(route.points);
  const previewGeometry =
    chart === undefined ? breathingHorizonGeometry({ recovery, shifted }) : undefined;
  const routeStrokeColor =
    chart === undefined
      ? recovery
        ? colors.accent.primary
        : shifted
          ? colors.accent.warm
          : colors.accent.primary
      : route !== undefined && (route.tightestBalanceMinor < 0 || route.pendingReviewCount > 0)
        ? colors.accent.warm
        : colors.accent.primary;
  const pillLabel =
    chart !== undefined
      ? `${formatMinorMoney(chart.tightestPoint.point.balanceMinor)} lowest ${routeChartPointLabel(
          chart.tightestPoint.point,
        )}`
      : recovery
        ? 'Example route rebuilt'
        : shifted
          ? 'Example after payday'
          : 'Example gets tight';
  const routePoints = chart?.points ?? [];
  const nextIncomePoint = route?.points.find((point) => point.deltaMinor > 0);
  const nextOutflowPoint = route?.points.find((point) => point.deltaMinor < 0);
  const protectedBufferMinor =
    route?.points.reduce((total, point) => total + (point.protectedMinor ?? 0), 0) ?? 0;
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const selectedChartPoint =
    chart === undefined
      ? undefined
      : (routePoints.find((point) => routeChartPointKey(point) === selectedPointKey) ??
        chart.tightestPoint ??
        routePoints[0]);
  const middleAxis =
    chart === undefined
      ? recovery
        ? 'Repair'
        : shifted
          ? 'After'
          : 'Tue'
      : routeChartPointLabel(chart.tightestPoint.point);
  const finalAxis =
    (chart === undefined
      ? undefined
      : routeChartPointLabel(chart.points[chart.points.length - 1]?.point)) ??
    (recovery ? 'Breathing room' : shifted ? 'Payday' : 'Payday');
  const axisLabels: readonly RouteAxisLabel[] =
    chart === undefined
      ? [
          { anchor: 'start', key: 'preview-start', label: 'Today', x: 0 },
          {
            anchor: 'middle',
            key: 'preview-middle',
            label: middleAxis,
            x: previewGeometry?.middleX ?? 112,
          },
          { anchor: 'end', key: 'preview-final', label: finalAxis, x: 318 },
        ]
      : routeChartAxisLabels(chart);
  const bufferLineY = chart === undefined ? undefined : Math.max(20, Math.min(78, chart.zeroY));
  const isTightRoute = routeStrokeColor === colors.accent.warm;
  const routeHaloColor = isTightRoute ? colors.accent.warmSoft : colors.accent.primarySoft;
  const routeAreaPath =
    chart !== undefined && routePoints.length > 1
      ? `${chart.path} L ${routePoints[routePoints.length - 1]!.x} 96 L ${routePoints[0]!.x} 96 Z`
      : undefined;
  const tightestNode = routePoints.find((point) => point.index === chart?.tightestPoint.index);

  // Don't draw a route the data can't support. With a real ledger but no future income or no
  // must-pay item yet, the line would be decorative — so ask for what's missing instead.
  if (route !== undefined && (nextIncomePoint === undefined || nextOutflowPoint === undefined)) {
    const incompleteMessage =
      nextIncomePoint === undefined && nextOutflowPoint === undefined
        ? "Add your next pay and one bill you can't skip, and I'll show you if it lasts."
        : nextIncomePoint === undefined
          ? "Add your next pay and I'll show you if this lasts to payday."
          : "Add one bill you can't skip and I'll show you what's pressing before payday.";
    return (
      <View style={styles.routeObject}>
        <Text style={styles.routeCanvasLabel}>Will I make it to payday?</Text>
        <View
          accessible
          accessibilityLabel={`Not enough added yet to answer this. ${incompleteMessage}`}
          style={styles.routeIncompletePanel}
        >
          <Text style={styles.noteTitle}>Just one or two things to add.</Text>
          <Text style={styles.noteText}>{incompleteMessage}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.routeObject}>
      {route !== undefined && compact !== true ? (
        <FolioRevealRow
          accessibilityHint="Shows the money-in, money-out and protected-bills breakdown behind this answer."
          accessibilityLabel="Show the breakdown of money in, money out and protected bills."
          detail="What's coming in, what's going out, bills set aside, and what's still to check."
          expanded={showBreakdown}
          mode="reveal"
          onPress={() => setShowBreakdown((visible) => !visible)}
          title="Show the breakdown"
        />
      ) : null}
      {route !== undefined && showBreakdown ? (
        <View
          accessible
          accessibilityLabel={`Money in, money out and protected bills. Spare after bills ${formatMinorMoney(
            route.availableNowMinor,
          )}. Next income ${
            nextIncomePoint === undefined
              ? route.nextPaydayLabel
              : `${nextIncomePoint.title} on ${nextIncomePoint.date}`
          }. Bills and debt payments ${
            nextOutflowPoint === undefined
              ? 'not added yet'
              : `${nextOutflowPoint.title} on ${nextOutflowPoint.date}`
          }. Protected buffer ${formatMinorMoney(protectedBufferMinor)}. Lowest point ${formatMinorMoney(
            route.tightestBalanceMinor,
          )} ${route.tightestDay}. ${route.pendingReviewCount} waiting review. ${
            route.confirmedTransactionCount
          } accepted changes.`}
          style={styles.routePressureGrid}
        >
          <RouteRow
            label="Left to spend"
            action="What's yours to spend once your bills and debt payments are set aside."
            tone={route.availableNowMinor < 0 ? 'attention' : 'confirmed'}
            value={formatMinorMoney(route.availableNowMinor)}
          />
          <RouteRow
            label="Next money in"
            action="The next pay or income I'm counting on."
            tone={nextIncomePoint === undefined ? 'estimated' : nextIncomePoint.tone}
            value={
              nextIncomePoint === undefined
                ? route.nextPaydayLabel
                : `${nextIncomePoint.title} - ${nextIncomePoint.date}`
            }
          />
          <RouteRow
            label="What's going out"
            action="The next bills and payments that take money off the table."
            tone={nextOutflowPoint === undefined ? 'estimated' : 'attention'}
            value={
              nextOutflowPoint === undefined
                ? 'None added yet'
                : `${nextOutflowPoint.title} - ${formatMinorMoney(nextOutflowPoint.deltaMinor)}`
            }
          />
          <RouteRow
            label="Set aside for bills"
            action="Bills and debt payments I keep aside before anything you can spend."
            tone={protectedBufferMinor > 0 ? 'confirmed' : 'estimated'}
            value={
              protectedBufferMinor > 0 ? formatMinorMoney(protectedBufferMinor) : 'No payments yet'
            }
          />
          <RouteRow
            label="Tightest day"
            action="The day your money gets lowest before payday."
            tone={route.tightestBalanceMinor < 0 ? 'attention' : 'confirmed'}
            value={`${formatMinorMoney(route.tightestBalanceMinor)} ${route.tightestDay}`}
          />
          <RouteRow
            label="Still to check"
            action="Things waiting for you — they stay out of the picture until you say yes."
            tone={route.pendingReviewCount > 0 ? 'attention' : 'confirmed'}
            value={`${route.pendingReviewCount} waiting`}
          />
          <RouteRow
            label="You've okayed"
            action="The only imported items I'm using are the ones you've okayed."
            tone={route.confirmedTransactionCount > 0 ? 'confirmed' : 'estimated'}
            value={`${route.confirmedTransactionCount} added`}
          />
        </View>
      ) : null}
      <View
        accessible
        accessibilityLabel={
          route !== undefined && chart !== undefined
            ? `Money route built from ${route.points.length} balance points. ${formatMinorMoney(
                route.availableNowMinor,
              )} available now. Lowest plotted point is ${formatMinorMoney(
                chart.tightestPoint.point.balanceMinor,
              )} ${routeChartPointLabel(chart.tightestPoint.point)}. ${
                route.pendingReviewCount
              } details need review. ${route.points.some((point) => point.reviewState === 'needs source') ? 'One point still needs a source. ' : ''}Tap a point to reveal source, state and effect.`
            : breathingHorizonLabel({ recovery, shifted })
        }
        accessibilityRole="image"
        style={[styles.horizon, compact === true ? styles.horizonCompact : undefined]}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.tightPill,
            shifted ? styles.tightPillShifted : undefined,
            recovery ? styles.tightPillRecovery : undefined,
          ]}
        >
          {pillLabel}
        </Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.routeLayerSvg}
        >
          <Svg height="96" style={styles.horizonSvg} viewBox="0 0 320 96" width="100%">
            {routeAreaPath !== undefined ? (
              <Path d={routeAreaPath} fill={routeStrokeColor} fillOpacity={0.15} stroke="none" />
            ) : null}
            <Path
              d={chart?.shadowPath ?? previewGeometry?.shadowPath ?? ''}
              fill="none"
              opacity={chart === undefined ? 0.62 : isTightRoute ? 0.55 : 0.7}
              stroke={chart === undefined ? routeColors.shadow : routeHaloColor}
              strokeLinecap="round"
              strokeWidth={16}
            />
            <Path
              d={chart?.path ?? previewGeometry?.path ?? ''}
              fill="none"
              stroke={routeStrokeColor}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={8}
            />
            {chart !== undefined && bufferLineY !== undefined ? (
              <>
                <Path
                  d={`M 18 ${bufferLineY} L 304 ${bufferLineY}`}
                  fill="none"
                  opacity={0.72}
                  stroke={colors.border.strong}
                  strokeDasharray="4 8"
                  strokeLinecap="round"
                  strokeWidth={2}
                />
                <SvgText
                  fill={colors.text.primary}
                  fontSize="10"
                  fontWeight="800"
                  textAnchor="start"
                  x="20"
                  y={Math.max(14, bufferLineY - 5)}
                >
                  Set aside for bills
                </SvgText>
              </>
            ) : null}
            {previewGeometry?.ghostPath ? (
              <Path
                d={previewGeometry.ghostPath}
                fill="none"
                opacity={0.42}
                stroke={routeColors.repairGhost}
                strokeDasharray="8 10"
                strokeLinecap="round"
                strokeWidth={5}
              />
            ) : null}
            {chart !== undefined ? (
              routePoints.map((point, index) => {
                const isEndpoint = index === 0 || index === routePoints.length - 1;
                const isTightest =
                  point.index === chart.tightestPoint.index &&
                  point.point.title === chart.tightestPoint.point.title;
                return (
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    fill={routePointFill(point.point, index, routePoints.length)}
                    key={`${point.point.date}-${point.point.title}-${index}`}
                    r={isEndpoint ? 8 : isTightest ? 7 : 5}
                    stroke={routePointStroke(point.point, isTightest)}
                    strokeWidth={isTightest ? 4 : 3}
                  />
                );
              })
            ) : (
              <>
                <Circle
                  cx={18}
                  cy={previewGeometry?.startY ?? 58}
                  fill={colors.surface.base}
                  r={8}
                  stroke={colors.text.primary}
                  strokeWidth={3}
                />
                <Circle
                  cx={previewGeometry?.middleX ?? 112}
                  cy={previewGeometry?.middleY ?? 68}
                  fill={colors.surface.base}
                  r={8}
                  stroke={shifted || recovery ? colors.accent.repair : colors.accent.warm}
                  strokeWidth={4}
                />
                <Circle
                  cx={304}
                  cy={previewGeometry?.endY ?? 42}
                  fill={routeColors.payday}
                  r={9}
                  stroke={colors.text.primary}
                  strokeWidth={3}
                />
              </>
            )}
            {chart !== undefined
              ? routePoints.map((point, index) => {
                  const delta = point.point.deltaMinor;
                  if (delta === 0) return null;
                  return delta > 0 ? (
                    <SvgText
                      fill={colors.text.success}
                      fontSize="8"
                      fontWeight="900"
                      key={`glyph-${index}`}
                      textAnchor="middle"
                      x={point.x}
                      y={Math.max(8, point.y - 9)}
                    >
                      ▲
                    </SvgText>
                  ) : (
                    <SvgText
                      fill={colors.text.warning}
                      fontSize="8"
                      fontWeight="900"
                      key={`glyph-${index}`}
                      textAnchor="middle"
                      x={point.x}
                      y={Math.min(92, point.y + 14)}
                    >
                      ▼
                    </SvgText>
                  );
                })
              : null}
            {tightestNode !== undefined ? (
              <>
                <Path
                  d={`M ${tightestNode.x} ${tightestNode.y + 2} L ${tightestNode.x} 90`}
                  opacity={0.6}
                  stroke={colors.text.warning}
                  strokeDasharray="2 3"
                  strokeWidth={1.5}
                />
                <SvgText
                  fill={colors.text.primary}
                  fontSize="11"
                  fontWeight="900"
                  textAnchor="middle"
                  x={Math.max(22, Math.min(298, tightestNode.x))}
                  y={Math.max(11, tightestNode.y - 11)}
                >
                  {formatMinorMoney(tightestNode.point.balanceMinor)}
                </SvgText>
              </>
            ) : null}
            {axisLabels.map((label) => (
              <SvgText
                fill={colors.text.muted}
                fontSize="10"
                fontWeight="700"
                key={label.key}
                textAnchor={label.anchor}
                x={label.x}
                y="92"
              >
                {label.label}
              </SvgText>
            ))}
          </Svg>
        </View>
      </View>
      {chart !== undefined ? (
        <>
          <View style={styles.routePointStrip}>
            {routePoints.map((point) => {
              const key = routeChartPointKey(point);
              const selected = key === routeChartPointKey(selectedChartPoint ?? point);
              return (
                <Pressable
                  accessibilityHint="Reveals why this dated point exists and what record is attached."
                  accessibilityLabel={point.point.accessibleLabel}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={key}
                  onPress={() => setSelectedPointKey(key)}
                  style={({ pressed }) => [
                    styles.routePointChip,
                    selected ? styles.routePointChipActive : undefined,
                    pressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.routePointChipLabel,
                      selected ? styles.routePointChipLabelActive : undefined,
                    ]}
                  >
                    {routeChartPointLabel(point.point)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.routePointChipValue,
                      selected ? styles.routePointChipLabelActive : undefined,
                    ]}
                  >
                    {routePointTypeLabel(point.point)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedChartPoint === undefined ? null : (
            <View
              accessible
              accessibilityLabel={`What's happening here. ${selectedChartPoint.point.accessibleLabel}`}
              style={styles.routePointPanel}
            >
              <Text style={styles.answerLabel}>What's happening here</Text>
              <Text style={styles.routePointHead}>
                {selectedChartPoint.point.title} · {formatReviewDay(selectedChartPoint.point.date)}
              </Text>
              <View style={styles.consequenceRows}>
                <RoutePointSection
                  body={
                    selectedChartPoint.point.deltaMinor === 0
                      ? 'No change to your money here.'
                      : selectedChartPoint.point.deltaMinor > 0
                        ? `${formatMinorMoney(selectedChartPoint.point.deltaMinor)} came in.`
                        : `${formatMinorMoney(
                            Math.abs(selectedChartPoint.point.deltaMinor),
                          )} went out.`
                  }
                  heading="What happened"
                />
                <RoutePointSection
                  body={selectedChartPoint.point.explanation}
                  heading="What caused it"
                />
                <RoutePointSection
                  body={formatMinorMoney(selectedChartPoint.point.balanceMinor)}
                  heading="Left after this"
                />
                <RoutePointSection
                  body={
                    route?.pendingReviewCount
                      ? `${route.pendingReviewCount} ${
                          route.pendingReviewCount === 1 ? 'is' : 'are'
                        } waiting — not counted here yet.`
                      : 'Nothing waiting for review.'
                  }
                  heading="Still waiting for review"
                />
              </View>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

function TimelineList({ events }: { events: readonly TimelineEvent[] }) {
  const [expandedEventKey, setExpandedEventKey] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <View
        accessible
        accessibilityLabel="No records yet. Add a manual item or stage a statement to create route events."
        style={styles.emptyStatePanel}
      >
        <Text style={styles.noteTitle}>No records yet.</Text>
        <Text style={styles.noteText}>
          Add a manual item or stage a statement to build this list.
        </Text>
      </View>
    );
  }

  const groups = groupTimelineEvents(events);

  return (
    <View style={styles.timelineList}>
      {groups.map((group) => (
        <View key={group.id} style={styles.timelineGroup}>
          <View
            accessible
            accessibilityLabel={`${group.title}. ${group.events.length} timeline entr${
              group.events.length === 1 ? 'y' : 'ies'
            }. ${group.description}`}
            style={styles.timelineGroupHeader}
          >
            <Text style={styles.timelineGroupTitle}>{group.title}</Text>
            <Text style={styles.timelineGroupRight}>{group.description}</Text>
          </View>
          {group.events.map((event, eventIndex) => {
            const key = timelineEventKey(group.id, event, eventIndex);
            const expanded = expandedEventKey === key;
            return (
              <Pressable
                accessible
                accessibilityHint="Reveals the source, authority state and action path for this timeline entry."
                accessibilityLabel={`${event.day}. ${event.kindLabel ?? 'Timeline entry'}. ${
                  event.title
                }. ${surfacePreviewText(event.detail, 84)}. ${
                  event.evidence?.summary ?? ''
                }. ${event.amount}. ${toneAccessibilityLabel(event.tone)}.`}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                key={key}
                onPress={() => setExpandedEventKey((current) => (current === key ? null : key))}
                style={({ pressed }) => [styles.eventRow, pressed ? styles.pressed : undefined]}
              >
                <View style={styles.dayColumn}>
                  <Text numberOfLines={1} style={styles.dayColumnText}>
                    {event.day}
                  </Text>
                </View>
                <View style={styles.eventCopy}>
                  <Text style={styles.rowTitle}>{event.title}</Text>
                  <Text style={styles.rowText}>{surfacePreviewText(event.detail, 84)}</Text>
                  {event.evidence === undefined ? null : (
                    <Text style={styles.rowMeta}>
                      {humanEvidenceLine(
                        event.evidence.sourceLabel,
                        event.evidence.authorityState,
                        event.evidence.reviewState,
                      )}
                    </Text>
                  )}
                  {expanded ? (
                    <View style={styles.timelineRevealPanel}>
                      <Text style={styles.originalText}>{event.detail}</Text>
                      {event.evidence === undefined ? null : (
                        <>
                          <Text style={styles.originalText}>
                            Source: {humanEvidenceSourceLabel(event.evidence.sourceLabel)}
                          </Text>
                          <Text style={styles.originalText}>
                            State: {surfaceStateLabel(event.evidence.authorityState)}
                          </Text>
                          <Text style={styles.originalText}>
                            Action: {surfaceStateLabel(event.evidence.actionPath)}
                          </Text>
                          <Text style={styles.originalText}>{event.evidence.summary}</Text>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
                <View style={styles.eventAmount}>
                  <Text style={styles.amountText}>{event.amount}</Text>
                  <Badge
                    label={
                      event.kindLabel ??
                      (event.tone === 'confirmed'
                        ? 'Known'
                        : event.tone === 'estimated'
                          ? 'Preview'
                          : 'Review')
                    }
                    tone={event.tone}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function timelineEventKey(groupId: string, event: TimelineEvent, eventIndex: number): string {
  return [
    groupId,
    event.date ?? event.day,
    event.kind ?? event.kindLabel ?? event.tone,
    event.title,
    event.amount,
    eventIndex,
  ].join('|');
}

function groupTimelineEvents(events: readonly TimelineEvent[]): readonly Readonly<{
  id: string;
  title: string;
  description: string;
  events: readonly TimelineEvent[];
}>[] {
  const groups = [
    {
      id: 'now',
      title: 'Now',
      description: 'current facts',
      events: [] as TimelineEvent[],
    },
    {
      id: 'needs-review',
      title: 'Needs review',
      description: 'waiting on you',
      events: [] as TimelineEvent[],
    },
    {
      id: 'coming-up',
      title: 'Coming up',
      description: 'future route',
      events: [] as TimelineEvent[],
    },
    {
      id: 'plan-recovery',
      title: 'Plan movement',
      description: 'plans and recovery',
      events: [] as TimelineEvent[],
    },
    {
      id: 'evidence-history',
      title: 'History',
      description: 'source trail',
      events: [] as TimelineEvent[],
    },
  ];
  const byId = new Map(groups.map((group) => [group.id, group.events]));

  for (const event of events) {
    byId.get(timelineGroupId(event))?.push(event);
  }

  return groups.filter((group) => group.events.length > 0);
}

function timelineGroupId(event: TimelineEvent): string {
  const kindText = `${event.kind ?? ''} ${event.kindLabel ?? ''}`.toLowerCase();
  const evidenceAction = event.evidence?.actionPath.toLowerCase() ?? '';
  const reviewState = event.evidence?.reviewState?.toLowerCase() ?? '';

  if (
    event.tone === 'attention' ||
    evidenceAction === 'review' ||
    reviewState.includes('review') ||
    /\b(import|task|melo)\b/u.test(kindText)
  ) {
    return 'needs-review';
  }

  if (/\b(plan|scenario|obligation|commitment|recovery)\b/u.test(kindText)) {
    return 'plan-recovery';
  }

  if (/\b(audit|decision|document|balance|history)\b/u.test(kindText)) {
    return 'evidence-history';
  }

  if (event.day !== 'Past' && event.day !== 'Today') {
    return 'coming-up';
  }

  return 'now';
}

function CalendarEmptyDay({
  selectedDateLabel,
  selectedRoutePoint,
}: {
  selectedDateLabel: string;
  selectedRoutePoint: LocalRoutePoint;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`No route items on ${selectedDateLabel}. Route balance remains ${formatMinorMoney(
        selectedRoutePoint.balanceMinor,
      )} after ${selectedRoutePoint.title}.`}
      style={styles.emptyStatePanel}
    >
      <Text style={styles.noteTitle}>No route items on this day.</Text>
      <Text style={styles.noteText}>
        Route balance remains {formatMinorMoney(selectedRoutePoint.balanceMinor)} after{' '}
        {selectedRoutePoint.title.toLowerCase()}.
      </Text>
    </View>
  );
}

function DiscoveryList({ rows }: { rows: readonly DiscoveryRow[] }) {
  return (
    <View style={styles.discoveryList}>
      {rows.map((row) => (
        <View
          accessible
          accessibilityLabel={`${row.label}. ${row.detail}. Source: ${row.source}. ${toneAccessibilityLabel(row.tone)}.`}
          key={row.label}
          style={styles.discoveryRow}
        >
          <Badge label={row.tone === 'confirmed' ? 'Found' : 'Review'} tone={row.tone} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{row.label}</Text>
            <Text style={styles.rowText}>{row.detail}</Text>
            <Text style={styles.originalText}>{row.source}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function WhatIfSheet({
  amount,
  onOpenMoney,
  reduceMotionEnabled,
  scenario,
  visible,
  onClose,
  onDecrease,
  onIncrease,
}: {
  amount: number;
  onOpenMoney: () => void;
  reduceMotionEnabled: boolean;
  scenario: LocalScenarioPreview;
  visible: boolean;
  onClose: () => void;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const whatIfRoute = scenario.previewRoute;

  return (
    <Modal
      animationType={reduceMotionEnabled ? 'none' : 'slide'}
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalScrim}>
        <View accessibilityViewIsModal accessible={false} style={styles.sheet}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.sheetHandle}
          />
          <Text style={styles.answerLabel}>Test a purchase</Text>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            This changes nothing until you record it.
          </Text>
          <AmountStepper amount={amount} onDecrease={onDecrease} onIncrease={onIncrease} />
          <BreathingHorizon route={whatIfRoute} />
          <ImpactRows amount={amount} impact={scenario.impact} />
          <View style={styles.actionRow}>
            <SecondaryButton
              accessibilityHint="Closes the test purchase sheet without saving."
              label="Close"
              onPress={onClose}
            />
            <PrimaryButton
              accessibilityHint="Closes this sheet and opens Money so you can name the spend before saving it."
              label="Open Money to record"
              onPress={() => {
                onClose();
                onOpenMoney();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SourceSheet({
  ledger,
  onClose,
  reduceMotionEnabled,
  route,
  visible,
}: {
  ledger: LocalLedgerState;
  onClose: () => void;
  reduceMotionEnabled: boolean;
  route: LocalRouteSummary;
  visible: boolean;
}) {
  const rows = buildSourceRows(ledger, route);

  return (
    <Modal
      animationType={reduceMotionEnabled ? 'none' : 'slide'}
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalScrim}>
        <View accessibilityViewIsModal accessible={false} style={styles.sheet}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.sheetHandle}
          />
          <Text style={styles.answerLabel}>Sources</Text>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            What the answer is built from.
          </Text>
          <Text style={styles.bodyText}>
            Everything on this device is shown with its original wording, Folio's reading, where it
            came from and its review state together.
          </Text>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sourcePanel}>
              {rows.map((row, index) => (
                <View
                  accessible
                  accessibilityLabel={sentenceJoin([
                    row.source,
                    `Original wording: ${row.original}`,
                    `Folio interpretation: ${row.interpretation}`,
                    `State ${row.stateLabel}`,
                    row.status,
                  ])}
                  key={`${row.source}-${row.original}-${row.interpretation}-${index}`}
                  style={styles.sourceRow}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={styles.sourceLabel}>{row.source}</Text>
                    <Badge label={row.stateLabel} tone={row.tone} />
                  </View>
                  <Text style={styles.originalText}>{row.original}</Text>
                  <Text style={styles.reviewInterpretation}>
                    Folio interpretation: {row.interpretation}
                  </Text>
                  <Text style={styles.sourceDetail}>{row.status}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <PrimaryButton
            accessibilityHint="Closes the sources sheet."
            label="Done"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

function AmountStepper({
  amount,
  onDecrease,
  onIncrease,
}: {
  amount: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const decreaseDisabled = amount <= MIN_TEST_PURCHASE;
  const increaseDisabled = amount >= MAX_TEST_PURCHASE;

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityHint={`Lowers the test purchase by ${formatPounds(TEST_PURCHASE_STEP)}.`}
        accessibilityLabel="Decrease test purchase"
        accessibilityRole="button"
        accessibilityState={{ disabled: decreaseDisabled }}
        disabled={decreaseDisabled}
        onPress={onDecrease}
        style={({ pressed }) => [
          styles.stepperButton,
          decreaseDisabled ? styles.disabledControl : undefined,
          pressed ? styles.pressed : undefined,
        ]}
      >
        <Text style={styles.stepperButtonText}>-</Text>
      </Pressable>
      <View
        accessible
        accessibilityLabel={`Test purchase amount ${formatPounds(amount)}.`}
        accessibilityLiveRegion="polite"
        style={styles.stepperAmount}
      >
        <Text style={styles.stepperLabel}>Purchase</Text>
        <Text style={styles.stepperValue}>{formatPounds(amount)}</Text>
      </View>
      <Pressable
        accessibilityHint={`Raises the test purchase by ${formatPounds(TEST_PURCHASE_STEP)}.`}
        accessibilityLabel="Increase test purchase"
        accessibilityRole="button"
        accessibilityState={{ disabled: increaseDisabled }}
        disabled={increaseDisabled}
        onPress={onIncrease}
        style={({ pressed }) => [
          styles.stepperButton,
          increaseDisabled ? styles.disabledControl : undefined,
          pressed ? styles.pressed : undefined,
        ]}
      >
        <Text style={styles.stepperButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

function ImpactRows({ amount, impact }: { amount: number; impact: PurchaseImpact }) {
  return (
    <View style={styles.impactPanel}>
      <RouteRow label="Test spend" value={`${formatPounds(amount)} today`} tone="estimated" />
      <RouteRow
        label="Breathing room"
        value={formatMinorMoney(impact.remainingMinor)}
        tone={impact.tone}
      />
      <RouteRow label="Tightest point" value={impact.tightestPoint} tone={impact.tone} />
    </View>
  );
}

function RouteRow({
  action = 'Tap to reveal what this number depends on.',
  label,
  source,
  tone,
  value,
}: {
  action?: string;
  label: string;
  source?: string;
  tone: EventTone;
  value: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      accessible
      accessibilityHint="Reveals what this amount depends on."
      accessibilityLabel={`${label}: ${value}. ${toneAccessibilityLabel(tone)}.${
        expanded
          ? ` ${source === undefined ? '' : `Based on ${source}. `}${action}`
          : ' Tap to show why.'
      }`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((visible) => !visible)}
      style={({ pressed }) => [styles.routeRow, pressed ? styles.pressed : undefined]}
    >
      <Text style={styles.routeLabel}>{label}</Text>
      <View style={styles.routeValueBlock}>
        <Text style={styles.routeValue}>{value}</Text>
        {expanded ? (
          <>
            {source === undefined ? null : (
              <Text style={styles.routeSourceText}>Based on {source}</Text>
            )}
            <Text style={styles.routeRevealText}>{action}</Text>
          </>
        ) : (
          <Text style={styles.routeRevealHint}>Show why</Text>
        )}
      </View>
      <Badge
        label={tone === 'confirmed' ? 'Confirmed' : tone === 'estimated' ? 'Estimate' : 'Check'}
        tone={tone}
      />
    </Pressable>
  );
}

function RoutePointSection({ heading, body }: { heading: string; body: string }) {
  return (
    <View accessible accessibilityLabel={`${heading}. ${body}`} style={styles.routePointSection}>
      <Text style={styles.routePointSectionHeading}>{heading}</Text>
      <Text style={styles.routePointSectionBody}>{body}</Text>
    </View>
  );
}

function databaseKeyStateCopy(state: LocalSecurityPosture['databaseKeyState'] | undefined): string {
  if (state === 'secure_store_reused') return 'Device key active';
  if (state === 'secure_store_generated') return 'Device key created';
  if (state === 'secure_store_unavailable_fallback') return 'Memory-only records';
  return 'Checking device key';
}

function appLockModeCopy(mode: LocalSecurityPosture['appLockMode'] | undefined): string {
  if (mode === 'device_auth') return 'Device authentication';
  if (mode === 'tester_unlocked_no_biometric') return 'No device app lock';
  if (mode === 'secure_store_only') return 'Key storage only';
  return 'Checking app lock';
}

function securityPostureCopy(posture: LocalSecurityPosture | null): string {
  if (posture === null) return 'Checking device security';
  if (posture.appLockMode === 'device_auth') return 'Device auth available for app lock';
  if (posture.appLockMode === 'secure_store_only')
    return 'Key stored locally; device app lock unavailable';
  return 'Memory-only records; device app lock unavailable';
}

function persistenceStatusCopy(status: PersistenceStatus, privateExampleMode = false): string {
  if (privateExampleMode) return 'Private example is not saved.';
  if (status === 'saved') return 'Saved on this device.';
  if (status === 'saving') return 'Saving on this device.';
  if (status === 'failed') return 'Device save failed; your latest changes are in memory only.';
  if (status === 'memory_only')
    return 'Your latest changes are in memory until device save succeeds.';
  return 'Checking device save.';
}

function persistenceStatusShortCopy(status: PersistenceStatus): string {
  if (status === 'saved') return 'Saved';
  if (status === 'saving') return 'Saving';
  if (status === 'failed') return 'Failed';
  if (status === 'memory_only') return 'Memory only';
  return 'Checking';
}

function isMemoryOnlySaveError(error: unknown): boolean {
  return error instanceof Error && /memory-only|device key storage/i.test(error.message);
}

function isPrivateExampleDraftAction(state: LocalLedgerState, rowId: string): boolean {
  return isPrivateExampleLedger(state) && rowId.startsWith('seed_');
}

function formatReviewReasons(reasons: readonly string[]): string {
  return uniqueText(reasons.map(reviewReasonCopy)).join(' ');
}

const REVIEW_DAY_MONTHS = [
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
] as const;

function formatReviewDay(iso: string): string {
  const parts = iso.split('-');
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12) return iso;
  return `${day} ${REVIEW_DAY_MONTHS[month - 1]}`;
}

function stripMeaningPrefix(value: string): string {
  return value.replace(/^(?:Bill|Debt payment|Income|Refund):\s*/iu, '').trim();
}

function isReviewOnlyDocument(
  document: LocalDocumentStage,
  summary: LocalImportSummary | undefined,
): boolean {
  const mediaType = document.mediaType.toLowerCase();
  return (
    summary === undefined ||
    mediaType.includes('pdf') ||
    mediaType.includes('image') ||
    mediaType.includes('octet-stream') ||
    !/\b(?:csv|text|tab-separated|comma-separated)\b/iu.test(mediaType)
  );
}

function reviewReasonCopy(reason: string): string {
  const normalized = reason.trim().toLowerCase();
  const copyByReason: Readonly<Record<string, string>> = {
    ambiguous_amount: 'Worth checking: the amount looks unclear.',
    ambiguous_date: 'Worth checking: the date looks unclear.',
    amount_changed: 'You changed the amount.',
    balance_mismatch: "The numbers don't quite add up yet.",
    edited_locally: 'You edited this payment.',
    formula_like_text: 'Worth checking: this amount is higher than usual.',
    limited_evidence: "There isn't much to go on yet.",
    missing_required_field: 'Add the missing detail before you add it.',
    possible_duplicate: 'This might be a duplicate.',
    possible_transfer: 'This might be a transfer between your accounts.',
    qif_limitation: "Some details couldn't be read from this file.",
    uncertain_counterparty: 'Worth checking: who this was with.',
    uncategorised: 'Needs a label before it is added.',
    untrusted_parser_input: 'The wording needs a quick check.',
  };
  return (
    copyByReason[normalized.replace(/[\s-]+/g, '_')] ??
    sentenceCase(normalized.replace(/[_-]+/g, ' '))
  );
}

function uniqueText(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function sentenceCase(value: string): string {
  return value.length === 0 ? 'Needs review' : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function SectionHeader({ rightText, title }: { rightText: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionRight}>{rightText}</Text>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: EventTone }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${toneAccessibilityLabel(tone)}.`}
      style={[styles.badge, toneBadgeStyle(tone)]}
    >
      <Text style={[styles.badgeText, toneBadgeTextStyle(tone)]}>{label}</Text>
    </View>
  );
}

function InteractionRibbon({
  accessibilityLabel,
  steps,
}: {
  accessibilityLabel: string;
  steps: readonly InteractionStep[];
}) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.interactionRibbon}>
      {steps.map((step, index) => (
        <View
          key={`${step.mode}-${step.label}`}
          style={[
            styles.interactionStep,
            index === steps.length - 1 ? styles.interactionStepLast : undefined,
          ]}
        >
          <View style={[styles.interactionDot, interactionDotStyle(step.mode)]} />
          <View style={styles.flex}>
            <View style={styles.interactionHeader}>
              <Text style={styles.interactionLabel}>{step.label}</Text>
              <Badge label={step.state} tone={objectStateTone(step.state)} />
            </View>
            <Text style={styles.interactionDetail}>{step.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function FolioRevealRow({
  accessibilityHint,
  accessibilityLabel,
  detail,
  expanded,
  mode = 'reveal',
  onPress,
  title,
}: {
  accessibilityHint: string;
  accessibilityLabel: string;
  detail: string;
  expanded: boolean;
  mode?: InteractionMode;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.disclosureRow,
        pressed ? styles.pressedLift : undefined,
        expanded ? styles.disclosureRowOpen : undefined,
      ]}
    >
      <View style={[styles.revealHandle, interactionDotStyle(mode)]}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.revealHandleText}
        >
          {expanded ? '-' : '+'}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.disclosureTitle}>{title}</Text>
        <Text style={styles.disclosureText}>{detail}</Text>
      </View>
      <Text style={[styles.chevron, expanded ? styles.chevronOpen : undefined]}>
        {expanded ? 'v' : CHEVRON}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  label,
  onPress,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const intent = buttonIntentForLabel(label, 'primary');

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? `${label}. ${intent}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled === true}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled === true ? styles.disabledControl : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  label,
  onPress,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const intent = buttonIntentForLabel(label, 'secondary');

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? `${label}. ${intent}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled === true}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled === true ? styles.disabledControl : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function MenuRow({
  detail,
  hint,
  onPress,
  title,
}: {
  detail: string;
  hint?: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed ? styles.pressed : undefined]}
    >
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowText}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>{CHEVRON}</Text>
    </Pressable>
  );
}

function toneBadgeStyle(tone: EventTone): StyleProp<ViewStyle> {
  const palette = {
    confirmed: styles.badgeConfirmed,
    estimated: styles.badgeEstimated,
    attention: styles.badgeAttention,
  } as const;

  return palette[tone];
}

function toneBadgeTextStyle(tone: EventTone): StyleProp<TextStyle> {
  const palette = {
    confirmed: styles.badgeTextConfirmed,
    estimated: styles.badgeTextEstimated,
    attention: styles.badgeTextAttention,
  } as const;

  return palette[tone];
}

function objectStateTone(state: InteractionObjectState): EventTone {
  if (
    state === 'requires review' ||
    state === 'needs source' ||
    state === 'needs user confirmation'
  ) {
    return 'attention';
  }
  if (state === 'preview only' || state === 'disabled') return 'estimated';
  return 'confirmed';
}

function interactionDotStyle(mode: InteractionMode): StyleProp<ViewStyle> {
  const palette = {
    commit: styles.interactionDotCommit,
    melo: styles.interactionDotMelo,
    preview: styles.interactionDotPreview,
    protect: styles.interactionDotProtect,
    reveal: styles.interactionDotReveal,
  } as const;

  return palette[mode];
}

function buttonIntentForLabel(label: string, kind: 'primary' | 'secondary'): string {
  const normalized = label.toLowerCase();

  if (normalized.includes('already empty') || normalized.includes('no records')) {
    return 'No action';
  }

  if (
    normalized.includes('accept') ||
    normalized.includes('clear') ||
    normalized.includes('confirm') ||
    normalized.includes('record') ||
    normalized.includes('save')
  ) {
    return normalized.includes('clear') ? 'Clear deliberately' : 'Record after review';
  }

  if (
    normalized.includes('sample') ||
    normalized.includes('scenario') ||
    normalized.includes('test') ||
    normalized.includes('try')
  ) {
    return 'Try first';
  }

  if (normalized.includes('ask') || normalized.includes('melo')) {
    return 'Ask';
  }

  if (
    normalized.includes('calendar') ||
    normalized.includes('export') ||
    normalized.includes('import') ||
    normalized.includes('review') ||
    normalized.includes('source') ||
    normalized.includes('statement')
  ) {
    return normalized.includes('source') || normalized.includes('export') ? 'Show sources' : 'Open';
  }

  return kind === 'primary' ? 'Continue' : 'Open';
}

function formatPounds(value: number): string {
  return value < 0 ? `-${GBP}${Math.abs(value)}` : `${GBP}${value}`;
}

function formatByteCount(value: number): string {
  if (value < 1024) return `${value} bytes`;
  return `${Math.round(value / 1024)} KB`;
}

function previewAmountMinorFromText(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\u00a3/g, '')
    .replace(/[$,\s()]/g, '')
    .replace(/^\+|-+/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [major = '0', minor = ''] = normalized.split('.');
  const amountMinor = Number(major) * 100 + Number(minor.padEnd(2, '0'));
  return Number.isSafeInteger(amountMinor) ? amountMinor : null;
}

function isValidIsoDateText(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  return parseIsoLocalDate(trimmed).toISOString().slice(0, 10) === trimmed;
}

function formatMinorMoney(minor: number): string {
  return formatMinorAmount(minor).replace('GBP ', GBP);
}

// Plain-English lookup for an engine state token. Never echoes a raw token: unknown,
// "not-required", and "dismissed" tokens collapse to an empty string so internal vocabulary
// (e.g. "not required", "system derived", "user confirmed") can never reach a user.
function surfaceStateLabel(value: string): string {
  const token = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    // authority states
    'imported-claim': 'From an import',
    'user-confirmed': 'Confirmed by you',
    confirmed: 'Confirmed by you',
    estimated: 'Estimated',
    // review states
    'needs-review': 'Waiting for review',
    'needs source': 'Needs a source',
    'requires review': 'Waiting for review',
    'preview only': 'Preview only',
    'ready-for-user-confirmation': 'Awaiting your confirmation',
    ready: 'Awaiting review',
  };
  return labels[token] ?? '';
}

// The internal empty-baseline source label produced by the engine is not user-facing wording.
// Translate it to plain language anywhere it would otherwise be shown to a user.
function humanEvidenceSourceLabel(sourceLabel: string): string {
  if (sourceLabel.startsWith('Empty workspace baseline')) {
    return 'Nothing added yet — your picture fills in as you add money.';
  }
  return sourceLabel;
}

// One human-readable evidence line combining source plus state, or the plain empty-state
// sentence when there is nothing yet (no jargon, no certainty tail to confuse an empty screen).
function humanEvidenceLine(
  sourceLabel: string,
  authorityState: string,
  reviewState: string | undefined,
): string {
  if (sourceLabel.startsWith('Empty workspace baseline')) {
    return 'Nothing added yet — your picture fills in as you add money.';
  }
  const base = sourceLabel.replace(/\s*\([^)]*\)\s*$/u, '').trim();
  if (/^opening balance/iu.test(base)) {
    return 'From the money on hand you entered.';
  }
  if (authorityState === 'imported-claim') {
    return base + " — from an import you haven't reviewed.";
  }
  if (reviewState === 'needs-review') {
    return base + ' — waiting for your review.';
  }
  return base;
}

function routeSourceStateLabel(route: LocalRouteSummary): string {
  if (route.pendingReviewCount > 0 || route.tightestBalanceMinor < 0) return 'Review';
  return 'Known';
}

function routeTimelineEvents(route: LocalRouteSummary): readonly TimelineEvent[] {
  const pointRows = route.points.slice(1).map<TimelineEvent>((point) => ({
    day: point.label,
    title: point.title,
    detail: routePointDetail(point),
    amount: formatMinorMoney(point.balanceMinor),
    tone: point.tone,
  }));
  const reviewRows = route.timeline
    .filter((event) => event.tone === 'attention')
    .map<TimelineEvent>((event) => ({
      day: event.day,
      title: event.title,
      detail: event.detail,
      amount: formatMinorMoney(event.amountMinor),
      tone: event.tone,
    }));

  return [...pointRows, ...reviewRows];
}

function routePointDetail(point: LocalRoutePoint): string {
  if (point.explanation.length > 0) return point.explanation;
  if (isProtectedReservePoint(point)) {
    return `${formatMinorMoney(Math.abs(point.deltaMinor))} held back for known bills`;
  }
  if (point.deltaMinor === 0) return 'Opening balance point';
  return `Balance after ${formatMinorMoney(point.deltaMinor)} route delta`;
}

function isProtectedReservePoint(point: LocalRoutePoint): boolean {
  return point.title === 'Set aside for bills' && point.deltaMinor < 0;
}

function routeChartPointLabel(point: LocalRoutePoint | undefined): string {
  if (point === undefined) return 'Today';
  if (isProtectedReservePoint(point)) return 'after bills';
  return point.label;
}

function routeChartAxisLabels(chart: RouteChartGeometry): readonly RouteAxisLabel[] {
  const firstPoint = chart.points[0];
  const finalPoint = chart.points[chart.points.length - 1];
  const candidates: readonly RouteAxisLabel[] = [
    {
      anchor: 'start',
      key: 'route-start',
      label: routeChartPointLabel(firstPoint?.point),
      x: 0,
    },
    {
      anchor: 'middle',
      key: 'route-tightest',
      label: routeChartPointLabel(chart.tightestPoint.point),
      x: chart.tightestPoint.x,
    },
    {
      anchor: 'end',
      key: 'route-final',
      label: routeChartPointLabel(finalPoint?.point),
      x: 318,
    },
  ];
  const labels: RouteAxisLabel[] = [];

  for (const candidate of candidates) {
    const duplicatesText = labels.some((label) => label.label === candidate.label);
    const collidesWithPrevious = labels.some((label) => Math.abs(label.x - candidate.x) < 48);
    if (duplicatesText || collidesWithPrevious) continue;
    labels.push(candidate);
  }

  return labels;
}

function buildDiscoveryRows(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
): readonly DiscoveryRow[] {
  const rows: DiscoveryRow[] = [
    {
      label: 'Confirmed local records',
      detail: `${route.confirmedTransactionCount} saved payment${
        route.confirmedTransactionCount === 1 ? '' : 's'
      } counted in your path.`,
      source: route.lastActionLabel,
      tone: 'confirmed',
    },
  ];
  const reservedPoint = route.points.find(isProtectedReservePoint);

  if (reservedPoint !== undefined) {
    rows.push({
      label: 'Protected bills reserved',
      detail: `${formatMinorMoney(Math.abs(reservedPoint.deltaMinor))} held back before spending.`,
      source: formatRoutePointList(route.points),
      tone: reservedPoint.balanceMinor < 0 ? 'attention' : 'confirmed',
    });
  } else {
    rows.push({
      label: 'No protected reserve',
      detail: 'No confirmed future protected bills are being held back.',
      source: formatRoutePointList(route.points),
      tone: 'confirmed',
    });
  }

  if (ledger.importDrafts.length > 0) {
    const firstDraft = ledger.importDrafts[0];
    rows.push({
      label: 'Review queue',
      detail: `${ledger.importDrafts.length} payment${
        ledger.importDrafts.length === 1 ? '' : 's'
      } waiting for your decision.`,
      source: firstDraft?.original ?? 'Local import draft',
      tone: 'attention',
    });
  }

  const latestDocument = ledger.documentStages[0];
  if (latestDocument !== undefined) {
    rows.push({
      label: 'Latest local file',
      detail: `${latestDocument.mediaType}, ${latestDocument.byteSize} bytes added for review.`,
      source: latestDocument.filename,
      tone: 'confirmed',
    });
  }

  const manualCount = ledger.transactions.filter(
    (transaction) => transaction.source === 'manual',
  ).length;
  if (manualCount > 0) {
    rows.push({
      label: 'Added by you',
      detail: `${manualCount} local manual item${manualCount === 1 ? '' : 's'} saved.`,
      source:
        ledger.transactions.find((transaction) => transaction.source === 'manual')?.original ??
        'Added by you',
      tone: 'confirmed',
    });
  }

  return rows.slice(0, 5);
}

function buildRouteAfterTodayDelta({
  deltaMinor,
  detail,
  label,
  route,
}: {
  deltaMinor: number;
  detail: string;
  label: string;
  route: LocalRouteSummary;
}): LocalRouteSummary {
  const points = route.points.map<LocalRoutePoint>((point, index) => {
    const nextBalanceMinor = point.balanceMinor + deltaMinor;
    const isShortfall = nextBalanceMinor < 0;
    const previewTitle = index === 0 ? `${point.title} after ${label.toLowerCase()}` : point.title;
    return {
      ...point,
      accessibleLabel: `${previewTitle}. Preview only. ${formatMinorMoney(
        nextBalanceMinor,
      )}. ${detail}.`,
      actionLabel: 'Review before saving',
      authorityLabel: 'Hypothetical scenario preview',
      balanceMinor: nextBalanceMinor,
      deltaMinor: index === 0 ? point.deltaMinor + deltaMinor : point.deltaMinor,
      explanation:
        index === 0
          ? `${detail}. Nothing has been written to your records on this device.`
          : `${point.explanation} Preview route includes ${label}.`,
      pointKind: isShortfall ? 'shortfall' : 'preview',
      provenanceLabel: `${point.provenanceLabel}; scenario ${label}`,
      reviewState: 'preview only',
      sourceLabel: 'Scenario preview',
      title: previewTitle,
      tone: isShortfall ? 'attention' : 'estimated',
    };
  });
  const tightestPoint = tightestRoutePointFromPoints(points);

  return {
    ...route,
    availableNowMinor: route.availableNowMinor + deltaMinor,
    lastActionLabel: `${label} preview. Nothing saved yet.`,
    points,
    tightestBalanceMinor: tightestPoint.balanceMinor,
    tightestDay: tightestPoint.label,
    timeline: [
      {
        amountMinor: deltaMinor,
        day: 'Today',
        detail,
        title: label,
        tone: (deltaMinor < 0 ? 'estimated' : 'confirmed') as EventTone,
      },
      ...route.timeline,
    ],
  };
}

function buildWeekDays(asOfDate: string, selectedDate: string): readonly WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addIsoDays(asOfDate, index);
    const parsed = parseIsoLocalDate(date);
    return {
      date,
      dayOfMonth: new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' }).format(
        parsed,
      ),
      weekdayLong: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        weekday: 'long',
      }).format(parsed),
      weekdayShort: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        weekday: 'short',
      })
        .format(parsed)
        .toUpperCase(),
      isToday: date === asOfDate,
      selected: date === selectedDate,
    };
  });
}

function formatCalendarMonth(asOfDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parseIsoLocalDate(asOfDate));
}

function routePointForDate(route: LocalRouteSummary, selectedDate: string): LocalRoutePoint {
  const firstPoint = route.points[0];
  let selectedPoint = firstPoint;

  for (const point of route.points) {
    if (point.date <= selectedDate) {
      selectedPoint = point;
    }
  }

  return (
    selectedPoint ??
    ({
      accessibleLabel:
        'Current picture. Empty workspace. No local records are stored; zero is not a confirmed balance.',
      actionLabel: 'Add a fact or import statement',
      authorityLabel: 'No source yet',
      balanceMinor: route.availableNowMinor,
      date: selectedDate,
      deltaMinor: 0,
      dependsOn: [],
      explanation: 'No local records are stored; this is only a starting placeholder.',
      label: 'Today',
      pointKind: 'confirmed',
      provenanceLabel: 'No local records stored',
      reviewState: 'needs source',
      sourceLabel: 'Empty workspace',
      title: 'Current picture',
      tone: route.availableNowMinor < 0 ? 'attention' : 'confirmed',
    } satisfies LocalRoutePoint)
  );
}

function formatLongCalendarDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(parseIsoLocalDate(date));
}

function timelineDayLabel(date: string, asOfDate: string): string {
  if (date <= asOfDate) return date === asOfDate ? 'Today' : 'Past';
  const distance = Math.round(
    (parseIsoLocalDate(date).getTime() - parseIsoLocalDate(asOfDate).getTime()) / 86_400_000,
  );
  if (distance === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(
    parseIsoLocalDate(date),
  );
}

function addIsoDays(date: string, days: number): string {
  const parsed = parseIsoLocalDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function currentLocalIsoDate(): string {
  const now = new Date();
  const localMidday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  return localMidday.toISOString().slice(0, 10);
}

function parseIsoLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function routeChartGeometry(points: readonly LocalRoutePoint[]): RouteChartGeometry {
  const sourcePoints =
    points.length > 0
      ? points
      : [
          {
            accessibleLabel:
              'No dated points yet. Nothing added — your picture fills in as you add money.',
            actionLabel: 'Add a fact or import statement',
            authorityLabel: 'No source yet',
            balanceMinor: 0,
            date: 'local',
            deltaMinor: 0,
            dependsOn: [],
            explanation: 'No local records are stored; this is only a starting placeholder.',
            label: 'Today',
            pointKind: 'confirmed' as const,
            provenanceLabel: 'No local records stored',
            reviewState: 'needs source' as const,
            sourceLabel: 'Empty workspace',
            title: 'No dated points yet',
            tone: 'estimated' as const,
          },
        ];
  const left = 18;
  const right = 304;
  const top = 18;
  const bottom = 76;
  const balances = [...sourcePoints.map((point) => point.balanceMinor), 0];
  const rawMin = Math.min(...balances);
  const rawMax = Math.max(...balances);
  const baseRange = Math.max(rawMax - rawMin, Math.abs(rawMax), Math.abs(rawMin), 5_000);
  const padding = Math.max(2_500, Math.round(baseRange * 0.08));
  const minMinor = rawMin === rawMax ? rawMin - padding : rawMin - padding;
  const maxMinor = rawMin === rawMax ? rawMax + padding : rawMax + padding;
  const range = Math.max(1, maxMinor - minMinor);
  const xStep = sourcePoints.length > 1 ? (right - left) / (sourcePoints.length - 1) : 0;
  const yForBalance = (balanceMinor: number) =>
    bottom - ((balanceMinor - minMinor) / range) * (bottom - top);
  const mappedPoints = sourcePoints.map<ChartPoint>((point, index) => ({
    index,
    point,
    x: Math.round(left + xStep * index),
    y: Math.round(yForBalance(point.balanceMinor)),
  }));
  const tightestPoint = tightestChartPoint(mappedPoints);
  const path = mappedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const shadowPath = mappedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${Math.min(86, point.y + 11)}`)
    .join(' ');

  return {
    crossesZero: minMinor < 0 && maxMinor > 0,
    maxMinor,
    minMinor,
    path,
    points: mappedPoints,
    shadowPath,
    tightestPoint,
    zeroY: Math.round(yForBalance(0)),
  };
}

function tightestChartPoint(points: readonly ChartPoint[]): ChartPoint {
  if (points.length === 0) {
    throw new Error('Route chart needs at least one point.');
  }

  const candidates = points.length > 1 ? points.slice(1) : points;
  const initial = candidates[0] ?? points[0];
  if (initial === undefined) {
    throw new Error('Route chart needs at least one point.');
  }

  return candidates.reduce<ChartPoint>(
    (current, point) => (point.point.balanceMinor < current.point.balanceMinor ? point : current),
    initial,
  );
}

function tightestRoutePointFromPoints(
  points: readonly LocalRoutePoint[],
): Readonly<{ balanceMinor: number; label: string }> {
  const candidates = points.length > 1 ? points.slice(1) : points;
  const tightest = candidates.reduce<LocalRoutePoint | undefined>(
    (current, point) =>
      current === undefined || point.balanceMinor < current.balanceMinor ? point : current,
    undefined,
  );

  return {
    balanceMinor: tightest?.balanceMinor ?? 0,
    label: tightest?.label ?? 'Today',
  };
}

function routeChartPointKey(point: ChartPoint): string {
  return `${point.index}-${point.point.date}-${point.point.title}-${point.point.pointKind}`;
}

function routePointTypeLabel(point: LocalRoutePoint): string {
  if (point.reviewState === 'needs source') return 'Needs source';
  if (point.reviewState === 'requires review') return 'Review';
  if (point.reviewState === 'preview only') return 'Preview';

  switch (point.pointKind) {
    case 'commitment':
      return 'Commitment';
    case 'expected':
      return point.deltaMinor > 0 ? 'Income' : 'Expected';
    case 'plan':
      return 'Plan';
    case 'preview':
      return 'Preview';
    case 'shortfall':
      return 'Shortfall';
    case 'confirmed':
      return 'Confirmed';
  }
}

function routePointFill(point: LocalRoutePoint, index: number, pointCount: number): string {
  if (point.pointKind === 'preview') return colors.accent.warmSoft;
  if (point.pointKind === 'shortfall') return colors.accent.repairSoft;
  if (index === pointCount - 1 && point.deltaMinor > 0) return routeColors.payday;
  if (point.tone === 'attention') return colors.accent.repairSoft;
  if (point.tone === 'estimated') return colors.surface.base;
  return index === 0 ? colors.surface.base : colors.accent.primarySoft;
}

function routePointStroke(point: LocalRoutePoint, isTightest: boolean): string {
  if (point.pointKind === 'preview') return colors.accent.warm;
  if (point.pointKind === 'shortfall') return colors.accent.repair;
  if (point.tone === 'attention') return colors.accent.repair;
  if (isTightest || point.tone === 'estimated') return colors.accent.warm;
  return colors.text.primary;
}

function formatRoutePointList(points: readonly LocalRoutePoint[]): string {
  if (points.length === 0) return 'No plotted points yet';
  return points
    .map((point) => `${point.title}: ${formatMinorMoney(point.balanceMinor)}`)
    .join('; ');
}

function breathingHorizonGeometry({
  recovery,
  shifted,
}: {
  recovery: boolean | undefined;
  shifted: boolean | undefined;
}): Readonly<{
  endY: number;
  ghostPath?: string;
  middleX: number;
  middleY: number;
  path: string;
  shadowPath: string;
  startY: number;
}> {
  const pressure = 0.28;
  const movedPressure = shifted || recovery ? 12 : 0;
  const startY = 58;
  const middleX = recovery ? 126 : shifted ? 116 : 112;
  const middleY = Math.round(52 + pressure * 24 + movedPressure);
  const endY = recovery ? 34 : shifted ? 36 : 42;
  const path = [
    `M 18 ${startY}`,
    `C 56 ${startY - 8}, 78 ${startY - 12}, ${middleX - 18} ${middleY - 4}`,
    `C ${middleX - 2} ${middleY + 3}, ${middleX + 22} ${middleY + 7}, 164 ${middleY + 6}`,
    `C 205 ${middleY + 2}, 232 ${endY + 20}, 304 ${endY}`,
  ].join(' ');
  const shadowPath = [
    `M 18 ${startY + 11}`,
    `C 56 ${startY + 3}, 78 ${startY - 1}, ${middleX - 18} ${middleY + 7}`,
    `C ${middleX - 2} ${middleY + 14}, ${middleX + 22} ${middleY + 18}, 164 ${middleY + 17}`,
    `C 205 ${middleY + 13}, 232 ${endY + 31}, 304 ${endY + 11}`,
  ].join(' ');
  const ghostPath =
    shifted || recovery
      ? `M 18 58 C 58 50, 86 49, 112 58 C 140 68, 166 70, 190 60 C 230 46, 270 40, 304 34`
      : undefined;

  return {
    endY,
    ...(ghostPath === undefined ? {} : { ghostPath }),
    middleX,
    middleY,
    path,
    shadowPath,
    startY,
  };
}

function buildSourceRows(ledger: LocalLedgerState, route: LocalRouteSummary): readonly SourceRow[] {
  const openingPoint = route.points[0];
  const reservedPoint = route.points.find(isProtectedReservePoint);
  const tightestPoint = tightestRoutePointFromPoints(route.points);
  const routeRow: SourceRow = {
    source: 'Route math',
    original:
      reservedPoint === undefined
        ? `${openingPoint?.title ?? 'Opening balance'}: ${formatMinorMoney(
            openingPoint?.balanceMinor ?? ledger.cashOnHandMinor,
          )}; no future protected reserve.`
        : `${openingPoint?.title ?? 'Opening balance'}: ${formatMinorMoney(
            openingPoint?.balanceMinor ?? ledger.cashOnHandMinor,
          )}; ${reservedPoint.title}: ${formatMinorMoney(reservedPoint.deltaMinor)} -> ${formatMinorMoney(
            reservedPoint.balanceMinor,
          )}.`,
    interpretation: `${route.points.length} plotted balance points; lowest ${formatMinorMoney(
      tightestPoint.balanceMinor,
    )} ${tightestPoint.label}`,
    stateLabel: routeSourceStateLabel(route),
    status: `${route.confirmedTransactionCount} confirmed records; ${route.pendingReviewCount} details still need review.`,
    tone:
      route.tightestBalanceMinor < 0 || route.pendingReviewCount > 0 ? 'attention' : 'confirmed',
  };
  const transactionRows = ledger.transactions.map<SourceRow>((transaction) => ({
    source:
      transaction.source === 'manual'
        ? 'Added by you'
        : transaction.source === 'import'
          ? 'Confirmed import'
          : 'Example record',
    original:
      transaction.original ?? `${transaction.title} ${formatMinorMoney(transaction.amountMinor)}`,
    interpretation: `${transaction.title} ${formatMinorMoney(transaction.amountMinor)}`,
    stateLabel:
      transaction.source === 'manual'
        ? 'Manual'
        : transaction.source === 'import'
          ? 'Confirmed'
          : 'Example',
    status: transaction.protected
      ? 'Confirmed and protected in the route.'
      : 'Confirmed and included in the local answer.',
    tone: 'confirmed',
  }));
  const draftRows = ledger.importDrafts.map<SourceRow>((draft) => ({
    source: 'Import question',
    original: draft.original,
    interpretation: draft.interpretation,
    stateLabel: draftStateLabel(draft),
    status: `${draft.status}. ${draft.reasons.join(', ') || 'Waiting for your decision'}.`,
    tone: draft.status === 'Ready to confirm' ? 'confirmed' : 'attention',
  }));
  const rejectedRows = ledger.rejectedImports.map<SourceRow>((rejected) => ({
    source: 'Rejected evidence',
    original: rejected.original,
    interpretation: rejected.interpretation,
    stateLabel: rejected.status,
    status: `${rejected.rejectionReason.replace(
      /-/g,
      ' ',
    )}. Non-financial evidence; not counted in Today, Timeline or Plans.`,
    tone: 'attention',
  }));
  const documentRows = ledger.documentStages.map<SourceRow>((stage) => ({
    source: 'Local file',
    original: stage.filename,
    interpretation: `${stage.mediaType}, ${stage.byteSize} bytes`,
    stateLabel: 'Local',
    status: documentSourceCopy(stage),
    tone: 'confirmed',
  }));

  return [routeRow, ...documentRows, ...transactionRows, ...draftRows, ...rejectedRows];
}

function formatProtectedItems(items: readonly string[]): string {
  if (items.length === 0) return 'known bills';
  if (items.length === 1) return items[0] ?? 'known bills';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? 'known bills'}`;
}

function importDraftSourceName(
  latestDocument: LocalDocumentStage | undefined,
  summary: LocalImportSummary | undefined,
): string | undefined {
  if (latestDocument !== undefined) return latestDocument.filename;
  if (summary !== undefined) return 'Pasted statement';
  return undefined;
}

function documentSourceCopy(stage: LocalDocumentStage): string {
  const source =
    stage.storageState === 'copied_to_app_cache'
      ? 'Statement text added for review'
      : 'Pasted text added for review';
  return `${source}; the file name stays attached to what you review.`;
}

function draftStateLabel(draft: LocalImportDraft): string {
  return draft.status === 'Ready to confirm' ? 'Waiting' : 'Needs fixing';
}

function importReviewHeaderCopy(input: {
  draftCount: number;
  readRows: number;
  showPrivateExampleRows: boolean;
}): Readonly<{ body: string; title: string }> {
  if (!input.showPrivateExampleRows) {
    return {
      body: 'Choose or paste a statement. Check these before they count.',
      title: 'Choose a statement to start.',
    };
  }

  if (input.draftCount === 0) {
    return {
      body:
        input.readRows > 0
          ? 'Nothing is waiting. What you ignore or mark as a duplicate stays out of your picture.'
          : 'Paste text or choose a file when you want money to check. Nothing is added yet.',
      title: 'Nothing waiting to check.',
    };
  }

  return {
    body: 'Check each one before it affects Today or your path.',
    title: 'Ready for you to check.',
  };
}

function importQueueProgressFromDrafts(
  summary: LocalImportSummary | undefined,
  drafts: readonly LocalImportDraft[],
): ImportQueueProgress {
  const readyRows = drafts.filter((draft) => draft.status === 'Ready to confirm').length;
  const reviewRows = drafts.length - readyRows;

  return importQueueProgressFromCounts({
    readRows: summary?.parsedRows ?? drafts.length,
    readyRows,
    reviewRows,
    skippedRows: summary?.skippedRows ?? 0,
  });
}

function importQueueProgressFromCounts(input: {
  readRows: number;
  readyRows: number;
  reviewRows: number;
  skippedRows?: number;
}): ImportQueueProgress {
  const readRows = Math.max(0, input.readRows);
  const readyRows = Math.max(0, input.readyRows);
  const reviewRows = Math.max(0, input.reviewRows);
  const skippedRows = Math.max(0, input.skippedRows ?? 0);
  const resolvedRows = Math.max(0, readRows - readyRows - reviewRows);
  const reviewedRows = resolvedRows + readyRows;
  const progressPercent =
    readRows === 0 ? 0 : Math.max(5, Math.min(100, Math.round((reviewedRows / readRows) * 100)));

  return {
    progressPercent,
    readRows,
    readyRows,
    resolvedRows,
    reviewRows,
    skippedRows,
  };
}

function handleMeloAction({
  askMelo,
  kind,
  openImports,
  openRecovery,
  openSources,
  openWhatIf,
}: {
  askMelo: (question?: string) => void;
  kind: MeloLocalAiActionKind;
  openImports: () => void;
  openRecovery: () => void;
  openSources: () => void;
  openWhatIf: () => void;
}): void {
  switch (kind) {
    case 'open_what_if':
      openWhatIf();
      return;
    case 'review_imports':
      openImports();
      return;
    case 'explain_sources':
      openSources();
      return;
    case 'build_recovery_route':
      openRecovery();
      return;
    case 'ask_clarifying_question':
      askMelo('What can you help with locally?');
      return;
  }
}

function buildMeloStateRows(input: {
  evidenceCount: number;
  requiresReview: boolean;
  uncertainty: MeloLocalAiDraft['uncertainty'];
}): readonly Readonly<{ detail: string; label: string; tone: EventTone }>[] {
  const needsReview = input.requiresReview || input.uncertainty !== 'none';
  return [
    {
      detail: gateMeloText(
        'Melo noticed a local question or route movement.',
        'Melo noticed a local question or route movement.',
      ),
      label: 'Melo noticed',
      tone: 'confirmed',
    },
    {
      detail: gateMeloText(
        `${input.evidenceCount} local record${
          input.evidenceCount === 1 ? '' : 's'
        } checked before answering.`,
        'Local records were checked before answering.',
      ),
      label: 'Melo checked',
      tone: 'confirmed',
    },
    {
      detail: gateMeloText(
        needsReview
          ? 'Melo needs review before anything changes.'
          : 'No change is waiting for Melo to write.',
        'Melo cannot write changes directly.',
      ),
      label: 'Melo needs review',
      tone: needsReview ? 'attention' : 'confirmed',
    },
    {
      detail: gateMeloText(
        'Melo can explain the visible sources and assumptions.',
        'Melo can explain visible sources and assumptions.',
      ),
      label: 'Melo can explain',
      tone: 'estimated',
    },
    {
      detail: gateMeloText(
        'Melo proposes review-only next steps; it does not apply them.',
        'Melo proposals stay review-only.',
      ),
      label: 'Melo proposes',
      tone: needsReview ? 'attention' : 'estimated',
    },
    {
      detail: gateMeloText(
        'You decide what, if anything, becomes a record.',
        'You decide what becomes a record.',
      ),
      label: 'You decide',
      tone: 'confirmed',
    },
  ];
}

function useReducedMotionPreference(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotionEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}

function screenAccessibilityTitle(screen: Screen): string {
  const titles: Record<Screen, string> = {
    billFlow: 'Check bills',
    calendar: 'Calendar',
    data: 'Data and privacy',
    debtFlow: 'Organise debts',
    dogfood: 'Internal test mode',
    firstMinute: 'First minute',
    foundItems: 'Check what Folio found',
    guideFlow: 'Guide me',
    import: 'Review',
    insights: 'Insights',
    melo: 'Melo',
    money: 'Money what-if',
    more: 'More controls',
    plans: 'Plans',
    pots: 'Pots',
    quickEstimate: 'Quick estimate',
    recovery: 'Recovery spend preview',
    ritual: 'Payday ritual',
    sampleBriefing: 'Sample briefing',
    start: 'Start',
    subscriptions: 'Subscriptions',
    timeline: 'Timeline',
    today: 'Today',
  };

  return titles[screen];
}

function breathingHorizonLabel({
  recovery,
  shifted,
}: {
  recovery: boolean | undefined;
  shifted: boolean | undefined;
}): string {
  if (recovery) {
    return 'Money picture. Repair is included, the plan is rebuilt, and breathing room returns after the next payday.';
  }

  if (shifted) {
    return 'Money picture. After moving the repair, debt finish moves by 3 weeks and breathing room returns after payday.';
  }

  return 'Money picture. Today is covered, Tuesday gets tight, and payday restores breathing room.';
}

function toneAccessibilityLabel(tone: EventTone): string {
  if (tone === 'confirmed') return 'Known and confirmed';
  if (tone === 'estimated') return 'Preview based on current local picture';
  return 'Needs attention';
}

function sentenceJoin(parts: readonly string[]): string {
  const cleaned = parts.map((part) => part.trim().replace(/[.!?]+$/u, '')).filter(Boolean);
  return `${cleaned.join('. ')}.`;
}

function buildRecoveryAcceptedConfirmation({
  amountMinor,
  plans,
  protectedItems,
  remainingMinor,
  title,
}: Readonly<{
  amountMinor: number;
  plans: LocalPlansModel;
  protectedItems: readonly string[];
  remainingMinor: number;
  title: string;
}>): RecoveryAcceptedConfirmation {
  const reviewDate = plans.planRows[0]?.nextReviewDate ?? 'No plan review date yet';

  return {
    changed: `${title.trim()} is recorded as ${formatMinorMoney(amountMinor)}. Route now shows ${formatMinorMoney(
      remainingMinor,
    )} after the update.`,
    evidencePath: 'Timeline decision entry and Data and privacy audit history',
    nextReviewDate: reviewDate,
    protectedItems: formatProtectedItems(protectedItems),
  };
}

function surfacePreviewText(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

const colors = folioTokens.color.role;
const routeColors = folioTokens.color.route;
const spacing = folioTokens.spacing.scale;
const radius = folioTokens.size.radius;

const hitTarget = folioTokens.hitTarget.minimumDp;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  appFrame: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  errorRecoveryFrame: {
    alignItems: 'center',
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorRecoveryTitle: {
    color: colors.text.primary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 36,
    textAlign: 'center',
  },
  errorRecoveryBody: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  errorRecoveryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.inverse,
    borderRadius: radius,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  errorRecoveryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '800',
  },
  appTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
  },
  topBarIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contextChip: {
    backgroundColor: '#FFFFFF99',
    borderColor: colors.border.subtle,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  contextChipText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  statusRevealPanel: {
    backgroundColor: '#FFFFFF99',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
    padding: spacing.md,
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF99',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    height: hitTarget,
    justifyContent: 'center',
    width: hitTarget,
  },
  roundButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  content: {
    // Just breathing room before the bottom nav. The nav is a flex sibling below the
    // flex:1 ScrollView and carries its own safe-area inset, so it is cleared automatically on
    // every screen size — no device-tuned reserve (the old 184 left a dead band + cut content).
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  scrollWithNav: {
    // No fixed reserve: the scroll area fills the exact space above the nav on any device.
    marginBottom: 0,
  },
  contentWithoutNav: {
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xl,
  },
  screenStack: {
    gap: spacing.lg,
  },
  avatarLarge: {
    alignItems: 'center',
    backgroundColor: colors.surface.inverse,
    borderRadius: 24,
    height: 64,
    justifyContent: 'center',
    marginTop: spacing.xl,
    width: 64,
  },
  avatarLargeSmall: {
    alignItems: 'center',
    backgroundColor: colors.surface.inverse,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarLargeText: {
    color: colors.text.inverse,
    fontSize: 22,
    fontWeight: '800',
  },
  progressRail: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressDot: {
    backgroundColor: colors.border.subtle,
    borderRadius: 2,
    flex: 1,
    height: 4,
  },
  progressDotActive: {
    backgroundColor: colors.accent.primary,
  },
  answerCanvas: {
    gap: spacing.sm,
  },
  answerLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  answerTitle: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  bodyText: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 23,
  },
  moneyValue: {
    color: colors.text.primary,
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -1.2,
    lineHeight: 60,
  },
  firstReliefMoney: {
    gap: spacing.xs,
  },
  moneyCaption: {
    color: colors.text.secondary,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metaLink: {
    color: colors.accent.primary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  meloAvatarSmall: {
    alignItems: 'center',
    backgroundColor: colors.surface.inverse,
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  meloAvatarSmallText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '800',
  },
  flex: {
    flex: 1,
  },
  chevron: {
    color: colors.text.muted,
    fontSize: 28,
    lineHeight: 30,
  },
  chevronPrimary: {
    color: colors.text.inverse,
  },
  horizon: {
    height: 128,
    justifyContent: 'center',
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  horizonCompact: {
    height: 96,
    marginTop: spacing.xs,
  },
  routeObject: {
    gap: spacing.sm,
  },
  routePressureGrid: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  tightPill: {
    alignSelf: 'center',
    backgroundColor: colors.accent.warmSoft,
    borderRadius: radius,
    color: colors.text.warning,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  tightPillShifted: {
    backgroundColor: colors.accent.primarySoft,
    color: colors.accent.primaryStrong,
  },
  tightPillRecovery: {
    backgroundColor: colors.accent.repairSoft,
    color: colors.text.danger,
  },
  routeLayer: {
    height: 86,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 28,
  },
  routeLayerSvg: {
    height: 96,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 28,
  },
  horizonSvg: {
    height: 96,
  },
  routePointStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  routePointChip: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: 7,
    borderWidth: 1,
    minHeight: 42,
    minWidth: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  routePointChipActive: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.surface.inverse,
  },
  routePointChipLabel: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  routePointChipLabelActive: {
    color: colors.text.inverse,
  },
  routePointChipValue: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  routePointPanel: {
    backgroundColor: colors.background.sunken,
    borderColor: colors.border.subtle,
    borderRadius: 7,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  routePointHead: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  routePointSection: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    gap: 2,
    paddingTop: spacing.sm,
  },
  routePointSectionHeading: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  routePointSectionBody: {
    color: colors.text.primary,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  routeStroke: {
    borderRadius: 14,
    height: 6,
    position: 'absolute',
  },
  routeShadow: {
    backgroundColor: routeColors.shadow,
    height: 16,
    opacity: 0.62,
  },
  routeMainConfirmed: {
    backgroundColor: colors.accent.primary,
  },
  routeMainShifted: {
    backgroundColor: colors.accent.warm,
  },
  routeMainRecovery: {
    backgroundColor: colors.accent.primary,
  },
  routePieceOne: {
    left: 0,
    top: 48,
    transform: [{ rotate: '-8deg' }],
    width: '28%',
  },
  routePieceTwo: {
    left: '24%',
    top: 54,
    transform: [{ rotate: '10deg' }],
    width: '26%',
  },
  routePieceThree: {
    left: '46%',
    top: 50,
    transform: [{ rotate: '-7deg' }],
    width: '28%',
  },
  routePieceFour: {
    left: '70%',
    top: 40,
    transform: [{ rotate: '-19deg' }],
    width: '31%',
  },
  horizonDot: {
    backgroundColor: colors.background.app,
    borderColor: colors.surface.inverse,
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    position: 'absolute',
    top: 74,
    width: 16,
  },
  horizonDotOne: {
    left: 0,
  },
  horizonDotTwo: {
    left: '34%',
    borderColor: colors.accent.warm,
  },
  horizonDotThree: {
    backgroundColor: routeColors.payday,
    right: 0,
    top: 50,
    borderColor: colors.surface.inverse,
  },
  horizonDotThreeRecovery: {
    backgroundColor: routeColors.repairGhost,
  },
  horizonDotAttention: {
    borderColor: colors.accent.repair,
  },
  axisLabels: {
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  axisText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  routeCanvas: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  selectedDayPanel: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  routeCanvasLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  consequenceRows: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
  },
  factList: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
  },
  routeRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  routeLabel: {
    color: colors.text.muted,
    flex: 0.82,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  routeValue: {
    color: colors.text.primary,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    minWidth: 0,
  },
  routeValueBlock: {
    flex: 1.35,
    gap: 2,
    minWidth: 0,
  },
  routeSourceText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  routeRevealText: {
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  routeRevealHint: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  interactionRibbon: {
    backgroundColor: '#FFFFFF8F',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  interactionStep: {
    alignItems: 'center',
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 36,
    paddingBottom: spacing.xs,
  },
  interactionStepLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  interactionDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  interactionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  interactionDotPreview: {
    backgroundColor: colors.accent.warm,
  },
  interactionDotReveal: {
    backgroundColor: colors.accent.primary,
  },
  interactionDotCommit: {
    backgroundColor: colors.surface.inverse,
  },
  interactionDotMelo: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.surface.inverse,
    borderWidth: 2,
  },
  interactionDotProtect: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
    borderWidth: 2,
  },
  interactionLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  interactionDetail: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.inverse,
    borderColor: colors.surface.inverse,
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: hitTarget,
    minWidth: 118,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryButtonIntent: {
    color: colors.text.inverse,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
    opacity: 0.78,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFD9',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: hitTarget,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  disabledControl: {
    opacity: 0.42,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },
  secondaryButtonIntent: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  pressedLift: {
    opacity: 0.88,
    transform: [{ translateY: 1 }, { scale: 0.995 }],
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  sectionRight: {
    color: colors.accent.primary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  timelineList: {
    gap: spacing.sm,
  },
  timelineGroup: {
    gap: spacing.xs,
  },
  timelineGroupHeader: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF80',
    borderRadius: radius,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  timelineGroupTitle: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  timelineGroupRight: {
    color: colors.text.muted,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'right',
  },
  eventRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF99',
    borderRadius: radius,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
    padding: spacing.md,
  },
  dayColumn: {
    alignItems: 'center',
    backgroundColor: colors.background.sunken,
    borderRadius: radius,
    height: 34,
    justifyContent: 'center',
    width: 58,
  },
  dayColumnText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
  },
  eventCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eventAmount: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    minWidth: 64,
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  rowText: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  rowMeta: {
    color: colors.accent.primary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  timelineRevealPanel: {
    backgroundColor: colors.background.sunken,
    borderColor: colors.border.subtle,
    borderRadius: 7,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  amountText: {
    color: colors.text.primary,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'right',
  },
  meloNote: {
    alignItems: 'center',
    backgroundColor: colors.accent.primarySoft,
    borderRadius: radius,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    padding: spacing.md,
  },
  meloNoteText: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  meloNoteStrong: {
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayPill: {
    alignItems: 'center',
    borderRadius: radius,
    flex: 1,
    gap: spacing.xs,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  dayPillPressed: {
    opacity: 0.72,
  },
  dayPillActive: {
    backgroundColor: colors.surface.inverse,
  },
  dayPillAttention: {
    borderColor: colors.accent.repair,
  },
  dayCaption: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
  dayCaptionActive: {
    color: '#BDC6C0',
  },
  dayText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  dayTextActive: {
    color: colors.text.inverse,
  },
  daySignalText: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
    maxWidth: '100%',
  },
  daySignalTextActive: {
    color: '#DCE6E0',
  },
  daySignalTextAttention: {
    color: colors.text.danger,
  },
  filePill: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  fileName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  fileStatus: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  progressPanel: {
    gap: spacing.sm,
  },
  progressTrack: {
    backgroundColor: colors.border.subtle,
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.accent.primary,
    borderRadius: 4,
    height: 8,
    width: '64%',
  },
  progressText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  discoveryList: {
    gap: spacing.sm,
  },
  discoveryRow: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF99',
    borderRadius: radius,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  reviewList: {
    gap: spacing.sm,
  },
  reviewRow: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  reviewDecisionRow: {
    borderColor: colors.border.subtle,
    borderWidth: 1,
    minHeight: 136,
  },
  reviewRowFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  editPanel: {
    backgroundColor: colors.background.sunken,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  importPastePanel: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  statementInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyStatePanel: {
    backgroundColor: colors.background.sunken,
    borderRadius: radius,
    gap: spacing.xs,
    padding: spacing.md,
  },
  reviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sourceLabel: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  originalText: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  reviewInterpretation: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusText: {
    color: colors.text.secondary,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  decisionConsequenceStrip: {
    backgroundColor: colors.background.sunken,
    borderRadius: 7,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  decisionConsequenceText: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewActionSheet: {
    gap: spacing.sm,
  },
  reviewActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reviewPrimaryActions: {
    gap: spacing.sm,
  },
  disclosureRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF99',
    borderRadius: radius,
    borderColor: '#FFFFFF00',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    padding: spacing.md,
  },
  disclosureRowOpen: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
  },
  revealHandle: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  revealHandleText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  disclosureText: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  disclosureTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  chevronOpen: {
    color: colors.accent.primary,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  singleActionRow: {
    flexDirection: 'row',
  },
  actionNotice: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  notePanel: {
    backgroundColor: colors.accent.primarySoft,
    borderRadius: radius,
    gap: spacing.xs,
    padding: spacing.md,
  },
  routeIncompletePanel: {
    backgroundColor: colors.accent.primarySoft,
    borderRadius: radius,
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  notePanelStrong: {
    backgroundColor: colors.accent.primarySoft,
    borderRadius: radius,
    gap: spacing.xs,
    padding: spacing.md,
  },
  documentStagePanel: {
    backgroundColor: colors.surface.raised,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  securityPanel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  vaultPanel: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  questionPanel: {
    backgroundColor: colors.accent.warmSoft,
    borderColor: colors.accent.warm,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noteTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  noteText: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  chatTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  chatStack: {
    gap: spacing.sm,
  },
  chatBubble: {
    borderRadius: radius,
    gap: spacing.xs,
    maxWidth: '90%',
    padding: spacing.md,
  },
  chatBubbleMelo: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderWidth: 1,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.surface.inverse,
  },
  chatSpeaker: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  chatSpeakerUser: {
    color: '#DCE6E0',
  },
  chatText: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  chatTextUser: {
    color: colors.text.inverse,
  },
  aiPromptPanel: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  aiInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  aiConclusion: {
    color: colors.accent.primaryStrong,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  aiResultPanel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  aiActionStack: {
    gap: spacing.xs,
  },
  aiActionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  aiActionTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  aiActionDetail: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  aiEvidenceRow: {
    alignItems: 'flex-start',
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  aiDataPanel: {
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderRadius: 7,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  aiGuardrailStack: {
    gap: spacing.xs,
  },
  meloStatePanel: {
    backgroundColor: '#FFFFFF99',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  meloStateRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  meloStateText: {
    color: colors.text.secondary,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  manualPanel: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  startJobStack: {
    gap: spacing.sm,
  },
  startReassurance: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  startExploreLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  startExploreText: {
    color: colors.text.muted,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  startJobButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  startJobButtonPrimary: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.surface.inverse,
    minHeight: 96,
  },
  startJobButtonSecondary: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 94,
    paddingHorizontal: spacing.md,
  },
  startJobTitle: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  startJobTitlePrimary: {
    color: colors.text.inverse,
    fontSize: 19,
    lineHeight: 25,
  },
  startJobText: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  startJobTextPrimary: {
    color: '#DCE6E0',
  },
  guidedQuestionCard: {
    backgroundColor: '#FFFFFF99',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  guidedStepPanel: {
    backgroundColor: '#FFFFFFE6',
    borderColor: colors.border.subtle,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  guidedWhyText: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 23,
  },
  guidedControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  guidedPreviewPanel: {
    backgroundColor: colors.background.sunken,
    borderColor: '#FFFFFF00',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  debtClarityPanel: {
    backgroundColor: colors.accent.warmSoft,
    borderColor: '#FFFFFF00',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  pressureChoicePanel: {
    backgroundColor: colors.background.sunken,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  guidedProgressTrack: {
    backgroundColor: colors.border.subtle,
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  guidedProgressFill: {
    backgroundColor: colors.surface.inverse,
    borderRadius: 4,
    height: 8,
  },
  segmentedControl: {
    backgroundColor: colors.background.sunken,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: hitTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  segmentButtonSelected: {
    backgroundColor: colors.surface.inverse,
  },
  segmentText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  segmentTextSelected: {
    color: colors.text.inverse,
  },
  inputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 21,
    minHeight: hitTarget,
    minWidth: 160,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    lineHeight: 21,
    minHeight: hitTarget,
    minWidth: 104,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroAmountInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.text.primary,
    borderRadius: 8,
    borderWidth: 2,
    color: colors.text.primary,
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    lineHeight: 42,
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    lineHeight: 21,
    minHeight: hitTarget,
    minWidth: 128,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: 24,
    borderWidth: 1,
    height: hitTarget,
    justifyContent: 'center',
    width: hitTarget,
  },
  stepperButtonText: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  stepperAmount: {
    alignItems: 'center',
    minWidth: 142,
  },
  stepperLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  stepperValue: {
    color: colors.text.primary,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    lineHeight: 50,
  },
  impactPanel: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
  },
  planRevealPanel: {
    backgroundColor: colors.background.sunken,
    borderRadius: 7,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  recoveryGuardrailPanel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  recoveryConfirmationPanel: {
    backgroundColor: colors.accent.warmSoft,
    borderColor: colors.accent.warm,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
  badgeConfirmed: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
  },
  badgeEstimated: {
    backgroundColor: colors.accent.warmSoft,
    borderColor: colors.accent.warm,
  },
  badgeAttention: {
    backgroundColor: colors.accent.repairSoft,
    borderColor: colors.accent.repair,
  },
  badgeTextConfirmed: {
    color: colors.accent.primaryStrong,
  },
  badgeTextEstimated: {
    color: colors.text.warning,
  },
  badgeTextAttention: {
    color: colors.text.danger,
  },
  menuRow: {
    alignItems: 'center',
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  bottomNav: {
    alignItems: 'flex-start',
    backgroundColor: '#FAF9F5',
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    height: 74,
    justifyContent: 'space-around',
    left: 0,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    position: 'absolute',
    right: 0,
  },
  navItem: {
    alignItems: 'center',
    borderRadius: radius,
    gap: 2,
    minHeight: 58,
    minWidth: 56,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  navItemMelo: {
    marginTop: -6,
  },
  navItemActive: {},
  navIcon: {
    color: colors.text.muted,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    minHeight: 28,
    minWidth: 36,
    overflow: 'hidden',
    textAlign: 'center',
  },
  navIconMelo: {
    backgroundColor: colors.surface.inverse,
    borderRadius: 18,
    color: colors.text.inverse,
    height: 38,
    lineHeight: 38,
    minWidth: 38,
  },
  navIconActive: {
    backgroundColor: colors.accent.primarySoft,
    borderRadius: 14,
    color: colors.accent.primary,
  },
  navText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
  },
  navTextActive: {
    color: colors.accent.primary,
  },
  modalScrim: {
    backgroundColor: colors.background.scrim,
    flex: 1,
    justifyContent: 'flex-end',
  },
  lockScrim: {
    alignItems: 'center',
    backgroundColor: colors.background.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockPanel: {
    backgroundColor: colors.background.app,
    borderRadius: radius,
    gap: spacing.lg,
    maxWidth: 420,
    padding: spacing.xl,
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.background.app,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: spacing.md,
    maxHeight: '92%',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border.strong,
    borderRadius: 3,
    height: 4,
    marginBottom: spacing.xs,
    width: 38,
  },
  sheetTitle: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  sourcePanel: {
    gap: spacing.sm,
  },
  lensPanel: {
    backgroundColor: '#FFFFFF99',
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  lensGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  lensChoice: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: 7,
    borderWidth: 1,
    flexGrow: 1,
    gap: 3,
    minHeight: 72,
    minWidth: 136,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  lensChoiceSelected: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.surface.inverse,
  },
  lensChoiceTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  lensChoiceTitleSelected: {
    color: colors.text.inverse,
  },
  lensChoiceText: {
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  lensChoiceTextSelected: {
    color: '#DCE6E0',
  },
  lensDetailPanel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: colors.accent.primary,
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetScrollContent: {
    paddingBottom: spacing.sm,
  },
  sourceRow: {
    backgroundColor: '#FFFFFF99',
    borderRadius: radius,
    gap: spacing.xs,
    padding: spacing.md,
  },
  sourceDetail: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
});

export {
  APP_LOCK_TIMEOUT_MS,
  AppLockOverlay,
  BottomNav,
  BULLETS,
  CalendarScreen,
  DataControlScreen,
  BillGuidedScreen,
  DebtGuidedScreen,
  DogfoodModeScreen,
  FirstMinuteScreen,
  GuideMeScreen,
  ImportReviewScreen,
  MAX_TEST_PURCHASE,
  MeloScreen,
  MIN_TEST_PURCHASE,
  MoneyScreen,
  MoreScreen,
  PlansScreen,
  QuickEstimateScreen,
  RecoveryScreen,
  SampleBriefingScreen,
  StartScreen,
  SourceSheet,
  TEST_PURCHASE_STEP,
  TimelineScreen,
  TodayScreen,
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
};

export type { DiscoveryRow, ImportSurfaceMode, PersistenceStatus, ProductScreen, Screen };

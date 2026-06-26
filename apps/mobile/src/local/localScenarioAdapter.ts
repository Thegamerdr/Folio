import {
  createEntityVersion,
  createInstantString,
  createScenarioId,
  type Scenario,
} from '@folio/domain';

import {
  formatMinorAmount,
  type LocalLedgerState,
  type LocalRoutePoint,
  type LocalRouteSummary,
} from './localLedger.js';
import { canonicalMobileWorkspaceId } from './canonicalLedgerAdapter.js';

export type LocalScenarioTone = 'confirmed' | 'estimated' | 'attention';

export type LocalScenarioImpact = Readonly<{
  remainingMinor: number;
  tightestPoint: string;
  tone: LocalScenarioTone;
}>;

export type LocalScenarioPreview = Readonly<{
  scenario: Scenario;
  previewRoute: LocalRouteSummary;
  impact: LocalScenarioImpact;
  amountMinor: number;
  writesImmediately: false;
  confirmationRequired: true;
  realityTransactionCount: number;
}>;

export function buildLocalPurchaseScenarioPreview(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
  amountMajor: number,
): LocalScenarioPreview {
  const amountMinor = amountMajor * 100;
  return buildLocalDeltaScenarioPreview(ledger, route, {
    amountMinor,
    detail: 'Preview only - not saved',
    label: 'Test purchase',
    scenarioKey: `purchase_${amountMinor}`,
  });
}

export function buildLocalRecoverySpendScenarioPreview(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
  input: Readonly<{ amountMinor: number; label: string }>,
): LocalScenarioPreview {
  return buildLocalDeltaScenarioPreview(ledger, route, {
    amountMinor: input.amountMinor,
    detail: 'Recovery spend preview - not saved yet',
    label: input.label,
    scenarioKey: `recovery_${input.amountMinor}_${input.label}`,
  });
}

export function editLocalRecoverySpendScenarioPreview(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
  previous: LocalScenarioPreview,
  input: Readonly<{ amountMinor: number; label: string }>,
): LocalScenarioPreview {
  const edited = buildLocalDeltaScenarioPreview(ledger, route, {
    amountMinor: input.amountMinor,
    detail: 'Edited recovery spend preview - not saved yet',
    label: input.label,
    scenarioKey: `recovery_edit_${previous.scenario.id}_${input.amountMinor}_${input.label}`,
  });

  return {
    ...edited,
    scenario: {
      ...edited.scenario,
      title: `${input.label} edited preview`,
    },
  };
}

function buildLocalDeltaScenarioPreview(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
  input: Readonly<{
    amountMinor: number;
    detail: string;
    label: string;
    scenarioKey: string;
  }>,
): LocalScenarioPreview {
  const deltaMinor = -Math.max(0, input.amountMinor);
  const previewRoute = buildRouteAfterTodayDelta({
    deltaMinor,
    detail: input.detail,
    label: input.label,
    route,
  });
  const impact = buildScenarioImpact(previewRoute);

  return {
    scenario: {
      id: createScenarioId(
        `scenario_local_${stableScenarioKey(input.scenarioKey)}_${ledger.asOfDate.replace(
          /-/g,
          '_',
        )}`,
      ),
      workspaceId: canonicalMobileWorkspaceId,
      title: input.label,
      status: 'previewed',
      authorityState: 'hypothetical',
      createdAt: createInstantString(`${ledger.asOfDate}T12:00:00Z`),
      version: createEntityVersion({
        dataVersion: `local-scenario:${ledger.asOfDate}:${stableScenarioKey(input.scenarioKey)}`,
      }),
      assumptionIds: [],
      affectedPlanIds: [],
    },
    previewRoute,
    impact,
    amountMinor: Math.max(0, input.amountMinor),
    writesImmediately: false,
    confirmationRequired: true,
    realityTransactionCount: ledger.transactions.length,
  };
}

function buildRouteAfterTodayDelta({
  deltaMinor,
  detail,
  label,
  route,
}: Readonly<{
  deltaMinor: number;
  detail: string;
  label: string;
  route: LocalRouteSummary;
}>): LocalRouteSummary {
  const points = route.points.map<LocalRoutePoint>((point, index) => {
    const nextBalanceMinor = point.balanceMinor + deltaMinor;
    const isShortfall = nextBalanceMinor < 0;
    const previewTitle = index === 0 ? `${point.title} after ${label.toLowerCase()}` : point.title;
    return {
      ...point,
      accessibleLabel: `${previewTitle}. Preview only. ${formatMinorAmount(
        nextBalanceMinor,
      )}. ${detail}.`,
      actionLabel: 'Review before saving',
      authorityLabel: 'Hypothetical scenario preview',
      balanceMinor: nextBalanceMinor,
      deltaMinor: index === 0 ? point.deltaMinor + deltaMinor : point.deltaMinor,
      explanation:
        index === 0
          ? `${detail}. Nothing has been written to the local ledger.`
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
        tone: deltaMinor < 0 ? 'estimated' : 'confirmed',
      },
      ...route.timeline,
    ],
  };
}

function buildScenarioImpact(previewRoute: LocalRouteSummary): LocalScenarioImpact {
  const tone =
    previewRoute.availableNowMinor < 0 || previewRoute.tightestBalanceMinor < 0
      ? 'attention'
      : previewRoute.availableNowMinor < 4_500 || previewRoute.tightestBalanceMinor < 4_500
        ? 'estimated'
        : 'confirmed';

  return {
    remainingMinor: previewRoute.availableNowMinor,
    tightestPoint:
      previewRoute.tightestBalanceMinor < 0
        ? `Short by ${formatMinorAmount(Math.abs(previewRoute.tightestBalanceMinor))}`
        : `${formatMinorAmount(previewRoute.tightestBalanceMinor)} ${previewRoute.tightestDay}`,
    tone,
  };
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

function stableScenarioKey(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
  return normalized.length === 0 ? 'preview' : normalized;
}

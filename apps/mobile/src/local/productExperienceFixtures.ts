import { validateMeloRenderableOutput } from '@folio/melo-policy';

import {
  acceptImportDraftThroughCanonicalRepository,
  createPlannedCommitmentThroughCanonicalRepository,
  createQuickEstimateThroughCanonicalRepository,
  editImportDraftThroughCanonicalRepository,
  recordRecoverySpendThroughCanonicalRepository,
  rejectImportDraftThroughCanonicalRepository,
  stageStatementImportThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildLocalCalendarModel } from './localCalendarAdapter.js';
import { buildLocalPlansModel } from './localPlansAdapter.js';
import {
  buildLocalRecoverySpendScenarioPreview,
  type LocalScenarioPreview,
} from './localScenarioAdapter.js';
import { buildLocalTimelineModel } from './localTimelineAdapter.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';
import {
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  type LocalLedgerState,
} from './localLedger.js';
import { sampleBriefingCards, sampleBriefingMelo } from './productExperienceLoop.js';

export type ProductExperienceFixtureId =
  | 'empty_first_launch'
  | 'sample_briefing'
  | 'minimal_manual_user'
  | 'one_upcoming_bill'
  | 'rejected_import'
  | 'duplicate_rejected_import'
  | 'accepted_import'
  | 'edited_import'
  | 'active_plan'
  | 'bad_month_recovery_preview'
  | 'accepted_recovery'
  | 'document_attachment'
  | 'calendar_planner_items'
  | 'data_control_export';

export type ProductExperienceFixture = Readonly<{
  id: ProductExperienceFixtureId;
  title: string;
  description: string;
  state: LocalLedgerState;
  synthetic: true;
  sampleOnly: boolean;
  scenarioPreview?: LocalScenarioPreview;
  expectedSurfaces: readonly string[];
  canonicalRecordCounts: Readonly<{
    auditLog: number;
    calendarItems: number;
    decisions: number;
    documents: number;
    events: number;
    importDrafts: number;
    importedClaims: number;
    plans: number;
    scenarios: number;
    transactions: number;
  }>;
  primaryCopy: readonly string[];
  policyGates: readonly string[];
}>;

export function createProductExperienceFixtures(
  asOfDate = '2026-06-22',
): readonly ProductExperienceFixture[] {
  const empty = createEmptyLocalLedgerState(asOfDate);
  const minimalManual = createQuickEstimateThroughCanonicalRepository(asOfDate, {
    billAmountText: '875.00',
    billDate: '2026-07-01',
    billTitle: 'Rent',
    cashNowText: '1190.47',
    incomeAmountText: '1840.00',
    incomeDate: '2026-06-27',
    incomeTitle: 'Payday',
  });
  const upcomingBill = createPlannedCommitmentThroughCanonicalRepository(
    { ...empty, cashOnHandMinor: 35_000 },
    {
      amountText: '120.00',
      date: '2026-06-29',
      title: 'Council tax',
    },
  );
  const stagedCoffee = stageStatementImportThroughCanonicalRepository(
    empty,
    'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
  ).state;
  const rejectedImport = rejectImportDraftThroughCanonicalRepository(
    stagedCoffee,
    stagedCoffee.importDrafts[0]?.rowId ?? '',
    { reason: 'duplicate' },
  );
  const duplicateRejectedImport = stageStatementImportThroughCanonicalRepository(
    rejectedImport,
    'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
  ).state;
  const acceptedImport = acceptImportDraftThroughCanonicalRepository(
    editImportDraftThroughCanonicalRepository(
      stagedCoffee,
      stagedCoffee.importDrafts[0]?.rowId ?? '',
      {
        amountText: '-3.25',
        date: asOfDate,
        interpretation: 'Coffee',
      },
    ),
    stagedCoffee.importDrafts[0]?.rowId ?? '',
  );
  const stagedTypo = stageStatementImportThroughCanonicalRepository(
    empty,
    'Date,Description,Amount\n2026-06-22,Cfee,-3.25',
  ).state;
  const editedImport = editImportDraftThroughCanonicalRepository(
    stagedTypo,
    stagedTypo.importDrafts[0]?.rowId ?? '',
    {
      amountText: '-4.50',
      date: asOfDate,
      interpretation: 'Coffee corrected',
    },
  );
  const activePlan = createPlannedCommitmentThroughCanonicalRepository(
    { ...empty, cashOnHandMinor: 20_000 },
    {
      amountText: '25.00',
      date: '2026-06-24',
      title: 'Dentist',
    },
  );
  const recoveryPreview = buildLocalRecoverySpendScenarioPreview(
    activePlan,
    buildLocalRouteSummary(activePlan),
    {
      amountMinor: 8_000,
      label: 'Repair',
    },
  );
  const acceptedRecovery = recordRecoverySpendThroughCanonicalRepository(activePlan, {
    amountText: '80.00',
    kind: 'spend',
    title: 'Repair',
  });
  const documentAttachment = stageStatementImportThroughCanonicalRepository(
    empty,
    'Date,Description,Amount\n2026-06-22,Synthetic stationery,-6.25',
    {
      byteSize: 68,
      filename: 'synthetic-statement.csv',
      mediaType: 'text/csv',
      storageState: 'copied_to_app_cache',
    },
  ).state;
  const calendarPlannerItems = createPlannedCommitmentThroughCanonicalRepository(
    stageStatementImportThroughCanonicalRepository(
      { ...empty, cashOnHandMinor: 60_000 },
      'Date,Description,Amount\n2026-06-23,Synthetic bill,-45.00',
    ).state,
    {
      amountText: '140.00',
      date: '2026-06-30',
      title: 'Insurance renewal',
    },
  );
  const stagedExportEvidence = stageStatementImportThroughCanonicalRepository(
    acceptedRecovery,
    'Date,Description,Amount\n2026-06-25,Synthetic subscription,-12.00',
    {
      byteSize: 76,
      filename: 'synthetic-export-source.csv',
      mediaType: 'text/csv',
      storageState: 'copied_to_app_cache',
    },
  ).state;
  const dataControlExport = rejectImportDraftThroughCanonicalRepository(
    stagedExportEvidence,
    stagedExportEvidence.importDrafts[0]?.rowId ?? '',
    { reason: 'not-mine' },
  );

  return [
    fixture({
      id: 'empty_first_launch',
      title: 'Empty first launch',
      description: 'Fresh local workspace with only an opening balance anchor.',
      state: empty,
      expectedSurfaces: ['firstMinute', 'data'],
      primaryCopy: [
        'Folio helps you understand where you stand, what changed, and what happens next.',
      ],
    }),
    fixture({
      id: 'sample_briefing',
      title: 'Sample briefing',
      description: 'Labelled example copy that is not written to user records.',
      state: empty,
      sampleOnly: true,
      expectedSurfaces: ['sampleBriefing'],
      primaryCopy: [
        sampleBriefingMelo.labels.join(', '),
        sampleBriefingCards.map((card) => card.title).join(', '),
      ],
    }),
    fixture({
      id: 'minimal_manual_user',
      title: 'Minimal manual user',
      description: 'Three entered facts: current money, next income and next protected payment.',
      state: minimalManual,
      expectedSurfaces: ['quickEstimate', 'today', 'timeline', 'calendar', 'plans'],
      primaryCopy: ['This is enough for a first briefing. You can add more later.'],
    }),
    fixture({
      id: 'one_upcoming_bill',
      title: 'One upcoming bill',
      description: 'A single protected commitment creates a plan and calendar deadline.',
      state: upcomingBill,
      expectedSurfaces: ['today', 'calendar', 'plans'],
      primaryCopy: ['Council tax'],
    }),
    fixture({
      id: 'rejected_import',
      title: 'Rejected import',
      description: 'A staged row rejected as duplicate and retained as evidence only.',
      state: rejectedImport,
      expectedSurfaces: ['import', 'data', 'timeline'],
      primaryCopy: ['Rejected evidence'],
    }),
    fixture({
      id: 'duplicate_rejected_import',
      title: 'Duplicate rejected import',
      description: 'A future import recognises an earlier user rejection before confirmation.',
      state: duplicateRejectedImport,
      expectedSurfaces: ['import', 'data'],
      primaryCopy: ['previously rejected: duplicate'],
    }),
    fixture({
      id: 'accepted_import',
      title: 'Accepted import',
      description: 'A reviewed row accepted into canonical financial reality.',
      state: acceptedImport,
      expectedSurfaces: ['import', 'today', 'timeline'],
      primaryCopy: ['Coffee confirmed'],
    }),
    fixture({
      id: 'edited_import',
      title: 'Edited import',
      description: 'A staged row corrected by the user before confirmation.',
      state: editedImport,
      expectedSurfaces: ['import', 'timeline'],
      primaryCopy: ['Coffee corrected'],
    }),
    fixture({
      id: 'active_plan',
      title: 'Active plan',
      description: 'A protected future commitment projected as a user-owned plan.',
      state: activePlan,
      expectedSurfaces: ['today', 'timeline', 'calendar', 'plans'],
      primaryCopy: ['Protect Dentist'],
    }),
    fixture({
      id: 'bad_month_recovery_preview',
      title: 'Bad-month recovery preview',
      description: 'A pressure scenario preview that does not mutate records.',
      state: activePlan,
      scenarioPreview: recoveryPreview,
      expectedSurfaces: ['recovery'],
      primaryCopy: ['Repair recovery preview'],
    }),
    fixture({
      id: 'accepted_recovery',
      title: 'Accepted recovery',
      description: 'A recorded recovery spend that creates scenario, decision and audit evidence.',
      state: acceptedRecovery,
      expectedSurfaces: ['today', 'timeline', 'calendar', 'plans', 'recovery'],
      primaryCopy: ['Repair'],
    }),
    fixture({
      id: 'document_attachment',
      title: 'Document attachment',
      description: 'A local statement file staged as document/source evidence.',
      state: documentAttachment,
      expectedSurfaces: ['import', 'today', 'timeline', 'data'],
      primaryCopy: ['synthetic-statement.csv'],
    }),
    fixture({
      id: 'calendar_planner_items',
      title: 'Calendar and planner items',
      description: 'Import review task plus protected commitment dates in the planner surface.',
      state: calendarPlannerItems,
      expectedSurfaces: ['calendar', 'plans', 'timeline'],
      primaryCopy: ['Insurance renewal', 'Synthetic bill'],
    }),
    fixture({
      id: 'data_control_export',
      title: 'Data Control export scenario',
      description: 'Accepted records, source files and rejected evidence visible before export.',
      state: dataControlExport,
      expectedSurfaces: ['data', 'timeline'],
      primaryCopy: ['synthetic-export-source.csv', 'Prepare export file'],
    }),
  ];
}

export function createProductExperienceFixtureEvidence(
  asOfDate = '2026-06-22',
): readonly ProductExperienceFixture[] {
  return createProductExperienceFixtures(asOfDate);
}

function fixture(
  input: Readonly<{
    id: ProductExperienceFixtureId;
    title: string;
    description: string;
    state: LocalLedgerState;
    expectedSurfaces: readonly string[];
    primaryCopy: readonly string[];
    sampleOnly?: boolean;
    scenarioPreview?: LocalScenarioPreview;
  }>,
): ProductExperienceFixture {
  const repository = createCanonicalRepositoryForLocalLedgerState(input.state).snapshot();
  const route = buildLocalRouteSummary(input.state);
  const today = buildLocalTodayModel(input.state, route);
  const timeline = buildLocalTimelineModel(input.state);
  const calendar = buildLocalCalendarModel(input.state, route);
  const plans = buildLocalPlansModel(input.state, route);
  const gatedCopy = [
    ...input.primaryCopy,
    today.meloBriefingText,
    timeline.meloBriefingText,
    ...plans.meloPlanBriefings.map((briefing) => briefing.summary),
  ];

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    state: input.state,
    synthetic: true,
    sampleOnly: input.sampleOnly ?? false,
    expectedSurfaces: input.expectedSurfaces,
    canonicalRecordCounts: {
      auditLog: repository.collections.auditLog.length,
      calendarItems: calendar.calendarItemCount,
      decisions: repository.collections.decisions.length,
      documents: repository.collections.documents.length,
      events: repository.collections.events.length,
      importDrafts: repository.collections.importDrafts.length,
      importedClaims: repository.collections.importedClaims.length,
      plans: repository.collections.plans.length,
      scenarios: repository.collections.scenarios.length,
      transactions: repository.collections.transactions.length,
    },
    primaryCopy: input.primaryCopy,
    policyGates: gatedCopy.every((copy) => validateMeloRenderableOutput(copy).renderable)
      ? ['melo-policy-renderable']
      : ['melo-policy-blocked'],
    ...(input.scenarioPreview === undefined ? {} : { scenarioPreview: input.scenarioPreview }),
  };
}

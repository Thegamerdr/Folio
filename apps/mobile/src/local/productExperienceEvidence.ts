import {
  dataControlTrustCopy,
  firstMinuteActions,
  firstMinutePrimaryMessage,
  importEntryTrustCopy,
  importReviewActionCopy,
  quickEstimateEnoughCopy,
  sampleBriefingCards,
  sampleBriefingMelo,
} from './productExperienceLoop.js';

export type ProductExperienceCaptureId =
  | 'empty-first-launch'
  | 'sample-briefing'
  | 'import-entry'
  | 'staged-import-review'
  | 'accepted-import'
  | 'edited-import'
  | 'rejected-import-state'
  | 'rejected-duplicate-detection'
  | 'minimal-manual-entry'
  | 'first-real-today-briefing'
  | 'timeline'
  | 'calendar'
  | 'plans'
  | 'recovery-preview'
  | 'accepted-recovery'
  | 'data-control'
  | 'melo-surface';

export type ProductExperienceRouteEvidence = Readonly<{
  id: ProductExperienceCaptureId;
  route: string;
  surface: string;
  proves: readonly string[];
  canonicalGuards: readonly string[];
}>;

export const productExperienceScreenshotStatus = {
  captured: true,
  manifestPath: 'apps/mobile/evidence/mobile-shell-visual-pass/manifest.json',
  method: 'static HTML render harness generated from local ledger models and surface copy',
  screenshotRoot: 'apps/mobile/evidence/mobile-shell-visual-pass/screenshots',
  requiredSurfaceIds: [
    'empty-first-launch',
    'sample-briefing',
    'import-entry',
    'staged-import-review',
    'rejected-import-state',
    'minimal-manual-path',
    'first-real-today-briefing',
    'timeline',
    'calendar',
    'plans',
    'recovery-preview',
    'data-control',
    'melo-surface',
  ],
} as const;

export const productExperienceRouteEvidence: readonly ProductExperienceRouteEvidence[] = [
  {
    id: 'empty-first-launch',
    route: 'firstMinute',
    surface: 'FirstMinuteScreen',
    proves: [
      firstMinutePrimaryMessage,
      `Actions: ${firstMinuteActions.map((action) => action.label).join(', ')}`,
      'No account, cloud or AI is required before use.',
    ],
    canonicalGuards: [
      'Viewing the first-minute surface creates no financial records.',
      'Data Control is reachable before adding anything.',
    ],
  },
  {
    id: 'sample-briefing',
    route: 'sampleBriefing',
    surface: 'SampleBriefingScreen',
    proves: [
      sampleBriefingMelo.labels.join(', '),
      sampleBriefingCards.map((card) => card.title).join(', '),
    ],
    canonicalGuards: [
      'Example briefing is labelled as not user data.',
      'Leaving sample mode writes nothing to local records.',
    ],
  },
  {
    id: 'import-entry',
    route: 'import',
    surface: 'ImportReviewScreen entry',
    proves: [...importEntryTrustCopy],
    canonicalGuards: [
      'Rows wait for review as questions.',
      'No transaction is saved until the user accepts a row.',
    ],
  },
  {
    id: 'staged-import-review',
    route: 'import',
    surface: 'ImportReviewScreen row review',
    proves: [
      'Each row shows source, date, amount, source quality, interpretation and review state.',
      `Actions: ${importReviewActionCopy.map((action) => action.label).join(', ')}`,
    ],
    canonicalGuards: [
      'Unreviewed imports do not affect Today position.',
      'Unreviewed imports do not affect Plans.',
      'Edits preserve original source wording before confirmation.',
    ],
  },
  {
    id: 'accepted-import',
    route: 'import -> today -> timeline',
    surface: 'ImportReviewScreen accept action',
    proves: [
      'Accepted rows become confirmed transactions after review.',
      'Accepted rows create provenance, decision and audit evidence.',
    ],
    canonicalGuards: [
      'Acceptance requires the staged row to be awaiting user confirmation.',
      'Dependent Today and Timeline surfaces rebuild from local records.',
    ],
  },
  {
    id: 'edited-import',
    route: 'import',
    surface: 'ImportReviewScreen edit modal',
    proves: [
      'Edited rows keep original wording attached.',
      'Edited rows wait for confirmation before becoming transactions.',
    ],
    canonicalGuards: [
      'User correction records preserve the before/after meaning trail.',
      'Editing alone does not create a confirmed financial record.',
    ],
  },
  {
    id: 'rejected-import-state',
    route: 'data',
    surface: 'DataControlScreen evidence search',
    proves: ['Rejected and excluded imports are retained as searchable evidence.'],
    canonicalGuards: [
      'Rejected evidence is non-financial.',
      'Rejected evidence is not counted as Today, Timeline reality or Plans.',
    ],
  },
  {
    id: 'rejected-duplicate-detection',
    route: 'import',
    surface: 'ImportReviewScreen duplicate review',
    proves: ['A future import can flag a row that was previously rejected as duplicate.'],
    canonicalGuards: [
      'Prior duplicate evidence stays searchable.',
      'Restaged duplicate evidence remains review-only until the user acts.',
    ],
  },
  {
    id: 'minimal-manual-entry',
    route: 'quickEstimate',
    surface: 'QuickEstimateScreen',
    proves: [
      'The manual path asks for current money, next income and one important payment.',
      quickEstimateEnoughCopy,
    ],
    canonicalGuards: [
      'Manual entries create source, provenance, audit and timeline records.',
      'No account, cloud, AI, Open Banking or Business mode is required.',
    ],
  },
  {
    id: 'first-real-today-briefing',
    route: 'today',
    surface: 'TodayScreen',
    proves: [quickEstimateEnoughCopy, 'Today shows position, changes, review items and sources.'],
    canonicalGuards: [
      'Today is rebuilt from local records.',
      'Important numbers expose source and evidence paths.',
    ],
  },
  {
    id: 'timeline',
    route: 'timeline',
    surface: 'TimelineScreen',
    proves: ['Timeline shows facts, expectations, review rows, decisions and audit changes.'],
    canonicalGuards: [
      'Timeline rebuilds from local records and review items.',
      'Rejected evidence does not appear as normal financial reality.',
    ],
  },
  {
    id: 'calendar',
    route: 'calendar',
    surface: 'CalendarScreen',
    proves: [
      'Calendar shows commitments, review tasks, plan deadlines, planned contributions and recovery follow-ups.',
    ],
    canonicalGuards: [
      'Calendar rows derive from calendar items, commitments, plans and planner tasks.',
      'Rejected evidence does not become a real commitment.',
    ],
  },
  {
    id: 'plans',
    route: 'plans',
    surface: 'PlansScreen',
    proves: [
      'Plans show title, protected amount, movement, review state, next step and linked records.',
    ],
    canonicalGuards: [
      'Plan rows are repository-backed.',
      'Plan movement is derived from reviewed plan impact records.',
    ],
  },
  {
    id: 'recovery-preview',
    route: 'recovery',
    surface: 'RecoveryScreen',
    proves: ['Recovery preview shows what changed, what it affects and what remains protected.'],
    canonicalGuards: [
      'Previewing recovery does not mutate reality.',
      'Saving recovery records a user action and rebuilds dependent surfaces.',
    ],
  },
  {
    id: 'accepted-recovery',
    route: 'recovery -> today -> timeline -> plans -> calendar',
    surface: 'RecoveryScreen record action',
    proves: ['Accepted recovery records a user decision and updates dependent surfaces.'],
    canonicalGuards: [
      'Accepted recovery creates scenario, decision and audit records.',
      'Plans remain reviewable after recovery changes.',
    ],
  },
  {
    id: 'data-control',
    route: 'data',
    surface: 'DataControlScreen',
    proves: [...dataControlTrustCopy],
    canonicalGuards: [
      'User can inspect, export and clear local data.',
      'Cloud, AI, Open Banking and Business mode are not required for this loop.',
    ],
  },
  {
    id: 'melo-surface',
    route: 'melo',
    surface: 'MeloScreen',
    proves: [
      'Melo explains the current local route, import review, recovery preview and source records.',
    ],
    canonicalGuards: [
      'All rendered Melo draft text passes local Melo policy gating.',
      'Melo actions require user review before records can change.',
    ],
  },
] as const;

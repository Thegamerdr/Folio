import { SCREEN_IDS, SHEET_IDS, type ScreenId, type SheetId } from '../../types';

/**
 * The Lovable reference contains more routes than the final mobile information architecture.
 * This inventory makes every reference job explicit without pretending the final app should ship
 * 92 screens and 41 sheets. A merge keeps the capability in `nativeTarget`; a defer is an
 * intentional product boundary, not an accidentally missing route.
 */
export type ReferenceDispositionStatus = 'live' | 'partial' | 'deferred';
export type ReferenceDispositionAction = 'keep' | 'evolve' | 'merge' | 'defer';

export type ReferenceScreenDisposition = Readonly<{
  referenceId: string;
  workspace: 'personal' | 'shared' | 'business';
  action: ReferenceDispositionAction;
  status: ReferenceDispositionStatus;
  nativeTarget?: ScreenId;
  finalHome: string;
}>;

export type ReferenceSheetDisposition = Readonly<{
  referenceId: string;
  action: ReferenceDispositionAction;
  status: ReferenceDispositionStatus;
  nativeTarget?: Exclude<SheetId, null>;
  finalHome: string;
}>;

const screen = (
  referenceId: string,
  workspace: ReferenceScreenDisposition['workspace'],
  action: ReferenceDispositionAction,
  status: ReferenceDispositionStatus,
  nativeTarget: ScreenId | undefined,
  finalHome: string,
): ReferenceScreenDisposition => ({
  referenceId,
  workspace,
  action,
  status,
  ...(nativeTarget === undefined ? {} : { nativeTarget }),
  finalHome,
});

const sheet = (
  referenceId: string,
  action: ReferenceDispositionAction,
  status: ReferenceDispositionStatus,
  nativeTarget: Exclude<SheetId, null> | undefined,
  finalHome: string,
): ReferenceSheetDisposition => ({
  referenceId,
  action,
  status,
  ...(nativeTarget === undefined ? {} : { nativeTarget }),
  finalHome,
});

/** All 92 reference ScreenIds from master-plan section 10, exactly once. */
export const REFERENCE_SCREEN_DISPOSITIONS: readonly ReferenceScreenDisposition[] = [
  // Personal launch and core (32)
  screen('start', 'personal', 'merge', 'partial', 'first-answer', 'Welcome / First Answer'),
  screen('guided', 'personal', 'merge', 'partial', 'first-answer', 'Progressive First Answer'),
  screen('intake', 'personal', 'evolve', 'live', 'intake', 'Add Data'),
  screen('pdf-success', 'personal', 'merge', 'live', 'pdf-success', 'Shared Intake Result'),
  screen('pdf-fallback', 'personal', 'merge', 'live', 'pdf-fallback', 'Shared Intake Help'),
  screen('image-success', 'personal', 'merge', 'live', 'image-success', 'Shared Intake Result'),
  screen('image-fallback', 'personal', 'merge', 'live', 'image-fallback', 'Shared Intake Help'),
  screen('paste-success', 'personal', 'merge', 'live', 'paste-success', 'Shared Intake Result'),
  screen('review', 'personal', 'evolve', 'live', 'review', 'Review / Needs you'),
  screen('today', 'personal', 'evolve', 'live', 'today', 'Today'),
  screen('today-after', 'personal', 'keep', 'live', 'today-after', 'Today post-action state'),
  screen('privacy', 'personal', 'merge', 'live', 'privacy', 'More / Data & Security'),
  screen('melo', 'personal', 'evolve', 'live', 'melo', 'Melo home'),
  screen('more', 'personal', 'evolve', 'partial', 'more', 'More settings hub'),
  screen('calendar', 'personal', 'evolve', 'live', 'calendar', 'Plan / Calendar'),
  screen('plans', 'personal', 'evolve', 'partial', 'plans', 'Plan hub'),
  screen('paywall', 'personal', 'evolve', 'partial', 'paywall', 'Account / Plan'),
  screen('whatif', 'personal', 'merge', 'live', 'whatif', 'Adjust Path / Preview'),
  screen('recovery', 'personal', 'merge', 'live', 'recovery', 'Adjust Path / Recovery'),
  screen('add-bill', 'personal', 'merge', 'live', 'add-bill', 'Plan / Bills add flow'),
  screen('add-debt', 'personal', 'merge', 'live', 'add-debt', 'Plan / Debts add flow'),
  screen('subs', 'personal', 'evolve', 'live', 'subs', 'Plan / Subscriptions'),
  screen('pots', 'personal', 'evolve', 'live', 'pots', 'Plan / Pots & Goals'),
  screen('ritual', 'personal', 'keep', 'live', 'ritual', 'Full-focus payday ritual'),
  screen('insights', 'personal', 'keep', 'live', 'insights', 'Today or Plan / Insights'),
  screen('shortfall', 'personal', 'merge', 'live', 'shortfall', 'Adjust Path / Resolve'),
  screen('account', 'personal', 'evolve', 'partial', 'account', 'More / Account'),
  screen('decisions', 'personal', 'merge', 'live', 'decision-history', 'Review / Decisions'),
  screen('connections', 'personal', 'evolve', 'live', 'money-sources', 'Money Sources'),
  screen('debts', 'personal', 'evolve', 'partial', 'plans', 'Plan / Debts'),
  screen('returning-recap', 'personal', 'keep', 'partial', 'today', 'One-time Today recap'),
  screen('global-search', 'personal', 'keep', 'partial', 'more', 'Global search action'),

  // Shared and support (15)
  screen('timeline', 'shared', 'merge', 'live', 'timeline', 'Review / Activity'),
  screen('memory', 'shared', 'merge', 'live', 'melo-memory', 'Melo / Memory'),
  screen('backup', 'shared', 'merge', 'partial', 'privacy', 'Data & Security / Sync & Backup'),
  screen('applock', 'shared', 'merge', 'partial', 'privacy', 'Data & Security / App security'),
  screen('notifications', 'shared', 'merge', 'partial', 'account', 'Notifications & Quiet Hours'),
  screen('partner-mode', 'shared', 'defer', 'deferred', undefined, 'Encrypted sharing programme'),
  screen('trust', 'shared', 'merge', 'partial', 'privacy', 'Data & Security overview'),
  screen('signin', 'shared', 'merge', 'partial', 'account', 'Account identity and recovery'),
  screen(
    'correction-ledger',
    'shared',
    'merge',
    'live',
    'decision-history',
    'Review / Decisions and corrections',
  ),
  screen('visualizer', 'shared', 'merge', 'live', 'visualizer', 'Intake / Review evidence'),
  screen('widget-preview', 'shared', 'defer', 'deferred', undefined, 'Native widgets programme'),
  screen('quiet-hours', 'shared', 'merge', 'partial', 'account', 'Notifications & Quiet Hours'),
  screen('inbox', 'shared', 'merge', 'partial', 'review', 'Review / Needs you'),
  screen('accessibility', 'shared', 'merge', 'partial', 'account', 'More / Accessibility'),
  screen('data-access-log', 'shared', 'merge', 'live', 'privacy', 'Data & Security / Access log'),

  // Business foundation and narrowed beta (28)
  screen('business-today', 'business', 'evolve', 'live', 'today', 'Business Today'),
  screen('business-review', 'business', 'evolve', 'live', 'review', 'Business Review'),
  screen('business-melo', 'business', 'merge', 'live', 'melo', 'Workspace-aware Melo home'),
  screen('business-more', 'business', 'evolve', 'live', 'more', 'Business More'),
  screen(
    'business-account',
    'business',
    'merge',
    'partial',
    'account',
    'Business identity and sources',
  ),
  screen(
    'business-activity',
    'business',
    'merge',
    'live',
    'timeline',
    'Business Review / Activity',
  ),
  screen('business-intake', 'business', 'merge', 'partial', 'intake', 'Business Add Data'),
  screen('business-calendar', 'business', 'merge', 'live', 'calendar', 'Business dates'),
  screen('business-plans', 'business', 'merge', 'live', 'plans', 'Money / Forecast commitments'),
  screen('business-data', 'business', 'merge', 'partial', 'privacy', 'Business data and recovery'),
  screen('business-workspace-current', 'business', 'merge', 'live', 'more', 'Workspace Manager'),
  screen('business-workspace-personal', 'business', 'merge', 'live', 'more', 'Workspace Manager'),
  screen(
    'business-workspace-create',
    'business',
    'merge',
    'partial',
    'more',
    'Workspace create flow',
  ),
  screen(
    'business-workspace-rename',
    'business',
    'merge',
    'partial',
    'more',
    'Workspace rename flow',
  ),
  screen(
    'business-workspace-archive',
    'business',
    'merge',
    'partial',
    'more',
    'Workspace archive flow',
  ),
  screen(
    'business-workspace-archived',
    'business',
    'merge',
    'partial',
    'more',
    'Archived workspaces',
  ),
  screen(
    'business-entity-setup',
    'business',
    'evolve',
    'live',
    'business-entity-setup',
    'Business entity setup',
  ),
  screen('business-runway', 'business', 'evolve', 'live', 'business-runway', 'Money / Runway'),
  screen(
    'business-invoices',
    'business',
    'evolve',
    'live',
    'business-invoices',
    'Money / Invoices',
  ),
  screen('business-vat', 'business', 'merge', 'live', 'business-vat', 'Money / Tax Pack / VAT'),
  screen(
    'business-obligations',
    'business',
    'merge',
    'live',
    'business-obligations',
    'Today and Tax Pack obligations',
  ),
  screen('business-money', 'business', 'evolve', 'live', 'business-money', 'Business Money'),
  screen('business-insights', 'business', 'merge', 'live', 'business-insights', 'Money / Insights'),
  screen('business-clients', 'business', 'keep', 'live', 'business-clients', 'Money / Clients'),
  screen(
    'business-mileage',
    'business',
    'merge',
    'live',
    'business-deductions',
    'Expenses / Mileage',
  ),
  screen(
    'business-home-office',
    'business',
    'merge',
    'live',
    'business-deductions',
    'Expenses / Home office',
  ),
  screen('mileage-log', 'business', 'merge', 'partial', 'business-deductions', 'Mileage log'),
  screen(
    'home-office-compare',
    'business',
    'merge',
    'partial',
    'business-deductions',
    'Home-office comparison',
  ),

  // Regulated/high-risk Business research (17)
  screen('business-corp-tax', 'business', 'evolve', 'partial', 'business-corp-tax', 'Tax estimate'),
  screen(
    'business-payroll',
    'business',
    'defer',
    'deferred',
    'business-payroll',
    'Payroll estimator only',
  ),
  screen(
    'business-dividends',
    'business',
    'evolve',
    'partial',
    'business-dividends',
    'Ltd Toolkit',
  ),
  screen('business-dla', 'business', 'evolve', 'partial', 'business-dla', 'Ltd Toolkit / DLA'),
  screen(
    'business-companies-house',
    'business',
    'merge',
    'partial',
    'business-companies-house',
    'Obligations checklist/export',
  ),
  screen('business-filings', 'business', 'evolve', 'live', 'business-filings', 'Tax Pack'),
  screen(
    'business-filing-vat',
    'business',
    'merge',
    'live',
    'business-filing-vat',
    'Tax Pack / VAT',
  ),
  screen('business-filing-sa', 'business', 'merge', 'live', 'business-filing-sa', 'Tax Pack / SA'),
  screen('business-filing-ct', 'business', 'merge', 'live', 'business-filing-ct', 'Tax Pack / CT'),
  screen(
    'business-filing-cs',
    'business',
    'merge',
    'live',
    'business-filing-cs',
    'Obligations / Confirmation Statement',
  ),
  screen(
    'business-filing-accounts',
    'business',
    'merge',
    'live',
    'business-filing-accounts',
    'Tax Pack / Accounts',
  ),
  screen('business-ir35', 'business', 'defer', 'deferred', undefined, 'Tax Centre education'),
  screen(
    'business-vat-scheme',
    'business',
    'merge',
    'partial',
    'business-vat',
    'VAT scheme comparison',
  ),
  screen(
    'sa-payments',
    'business',
    'merge',
    'partial',
    'business-obligations',
    'Tax payment schedule',
  ),
  screen(
    'mtd-checklist',
    'business',
    'merge',
    'live',
    'business-filings',
    'Dated readiness checklist',
  ),
  screen('pension-planner', 'business', 'defer', 'deferred', undefined, 'Later planning tool'),
  screen(
    'salary-vs-dividend',
    'business',
    'merge',
    'partial',
    'business-dividends',
    'Ltd Toolkit comparison',
  ),
];

/** All 41 reference SheetIds from master-plan section 11, exactly once. */
export const REFERENCE_SHEET_DISPOSITIONS: readonly ReferenceSheetDisposition[] = [
  sheet('route-detail', 'keep', 'live', 'route-detail', 'Worked-out route detail'),
  sheet('edit-txn', 'merge', 'live', 'edit-txn', 'Transaction detail/edit'),
  sheet('edit-item', 'merge', 'live', 'edit-item', 'Candidate or transaction detail'),
  sheet('melo-chat', 'evolve', 'live', 'melo-chat', 'Context panel and full conversation'),
  sheet('share', 'keep', 'live', 'share', 'Native share'),
  sheet('onboarding', 'evolve', 'partial', 'onboarding', 'Progressive setup'),
  sheet('log-spend', 'merge', 'live', 'log-spend', 'Add transaction / Spend'),
  sheet('log-invoice', 'evolve', 'live', 'log-invoice', 'Business invoice draft'),
  sheet('log-payment', 'merge', 'live', 'log-payment', 'Payment match/log'),
  sheet('add-debt', 'evolve', 'live', 'declare-debt', 'Plan debt setup'),
  sheet('add-plan', 'evolve', 'live', 'add-plan', 'Plan/goal setup'),
  sheet('household-setup', 'defer', 'deferred', 'household-setup', 'Sharing programme'),
  sheet('sub-caught', 'merge', 'live', 'sub-caught', 'Review subscription candidate'),
  sheet('add-event', 'keep', 'live', 'add-event', 'Calendar manual event'),
  sheet('calendar-export', 'keep', 'live', 'calendar-export', 'Native ICS export'),
  sheet(
    'calendar-connect',
    'evolve',
    'partial',
    'calendar-connect',
    'Provider information/consent',
  ),
  sheet('safe-zone', 'keep', 'live', 'safe-zone', 'Worked-out number'),
  sheet('shelf', 'keep', 'live', 'shelf', 'Adjust Path saved scenarios'),
  sheet('afford-check', 'merge', 'live', 'afford-check', 'Adjust Path spend preview'),
  sheet('lens-picker', 'evolve', 'live', 'lens-picker', 'What matters now'),
  sheet('chart-style', 'defer', 'deferred', 'chart-style', 'Design-lab only'),
  sheet('hidden-review', 'merge', 'live', 'hidden-review', 'Review decisions/hidden'),
  sheet('day-detail', 'keep', 'live', 'day-detail', 'Calendar day detail'),
  sheet('companion-touches', 'merge', 'live', 'companion-touches', 'Melo preferences'),
  sheet('debt-schedule', 'keep', 'live', 'debt-schedule', 'Debt payoff detail'),
  sheet('confirm-move', 'keep', 'partial', 'shelf', 'Explicit reversible movement'),
  sheet('bank-connection', 'evolve', 'partial', 'calendar-connect', 'Open Banking consent/info'),
  sheet('melo-intro', 'merge', 'partial', 'onboarding', 'Optional Welcome moment'),
  sheet('recent-activity', 'merge', 'partial', 'edit-txn', 'Review Activity/undo'),
  sheet('review-conflict', 'keep', 'partial', 'edit-item', 'Source conflict resolution'),
  sheet('split-txn', 'keep', 'partial', 'edit-txn', 'Transaction split'),
  sheet('cycle-rollover', 'keep', 'partial', 'onboarding', 'Cycle confirmation'),
  sheet('sub-checkin', 'keep', 'partial', 'sub-caught', 'Subscription check-in'),
  sheet('payday-cadence', 'keep', 'partial', 'onboarding', 'Income cadence'),
  sheet('add-income', 'merge', 'partial', 'log-spend', 'Add transaction / Income'),
  sheet('refund-pair', 'keep', 'partial', 'edit-txn', 'Refund matching'),
  sheet('log-transfer', 'merge', 'partial', 'log-spend', 'Add transaction / Transfer'),
  sheet('late-payment-ladder', 'keep', 'partial', 'log-invoice', 'Invoice follow-up options'),
  sheet('pot-why', 'keep', 'partial', 'shelf', 'Pot rationale/rule'),
  sheet('quote-to-invoice', 'keep', 'partial', 'log-invoice', 'Quote conversion'),
  sheet('export-cycle-pdf', 'keep', 'partial', 'share', 'Native working-copy report'),
];

export const REFERENCE_SCREEN_IDS = REFERENCE_SCREEN_DISPOSITIONS.map((item) => item.referenceId);
export const REFERENCE_SHEET_IDS = REFERENCE_SHEET_DISPOSITIONS.map((item) => item.referenceId);

export function isCurrentNativeScreen(value: string): value is ScreenId {
  return (SCREEN_IDS as readonly string[]).includes(value);
}

export function isCurrentNativeSheet(value: string): value is Exclude<SheetId, null> {
  return (SHEET_IDS as readonly string[]).includes(value);
}

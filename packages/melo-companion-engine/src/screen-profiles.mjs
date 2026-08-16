/**
 * Product-facing screen profiles for the portable Fenice companion.
 *
 * This is deliberately data-only: host adapters can translate a route to one
 * of these profiles without importing browser or router code. A profile tells
 * the engine what the screen is about, when to stay quiet, and which compact
 * contextual action is useful when the user taps Fenice.
 */

const action = (id, label, prompt) => ({ id, label, prompt });
const hidden = (domain, attention = 'suppressed') => ({
  domain,
  attention,
  hidden: true,
  action: null,
});

export const SCREEN_PROFILES = Object.freeze({
  today: {
    domain: 'personal',
    attention: 'money-path',
    action: action(
      'today.explain',
      "Explain today's path",
      "Explain today's money path and what is driving it.",
    ),
  },
  'today-after': {
    domain: 'personal',
    attention: 'what-changed',
    action: action(
      'today-after.explain',
      'What changed?',
      'Explain what changed since my last move.',
    ),
  },
  pots: {
    domain: 'personal',
    attention: 'pots',
    action: action(
      'pots.explain',
      'Explain my pots',
      'Explain how my pots are tracking and what to top up next.',
    ),
  },
  subscriptions: {
    domain: 'personal',
    attention: 'subscriptions',
    action: action(
      'subs.explain',
      'Explain my subscriptions',
      'Summarise my subscriptions and flag anything unusual.',
    ),
  },
  subs: {
    domain: 'personal',
    attention: 'subscriptions',
    action: action(
      'subs.explain',
      'Explain my subscriptions',
      'Summarise my subscriptions and flag anything unusual.',
    ),
  },
  recovery: {
    domain: 'personal',
    attention: 'recovery',
    action: action(
      'recovery.explain',
      'Explain recovery',
      'Explain the recovery plan Melo is suggesting.',
    ),
  },
  insights: {
    domain: 'personal',
    attention: 'insights',
    action: action(
      'insights.explain',
      'What changed?',
      'Explain what my recent insights are telling me.',
    ),
  },
  calendar: {
    domain: 'personal',
    attention: 'calendar',
    action: action(
      'calendar.explain',
      'Explain this month',
      'What should I look at on my calendar this month?',
    ),
  },
  'global-search': {
    domain: 'personal',
    attention: 'search',
    suppressWhileTyping: true,
    action: action(
      'search.explain',
      'What can I search?',
      'Explain what I can jump to from search.',
    ),
  },
  melo: {
    domain: 'personal',
    attention: 'companion',
    action: action(
      'melo.explain',
      'How Melo works',
      'Explain how you decide what to say and when.',
    ),
  },
  more: {
    domain: 'personal',
    attention: 'navigation',
    action: action(
      'more.help',
      'Where should I look next?',
      'Suggest a useful place to look next in Melo.',
    ),
  },
  timeline: {
    domain: 'personal',
    attention: 'timeline',
    action: action(
      'timeline.explain',
      'Explain this timeline',
      'Explain what happened across this timeline.',
    ),
  },
  plans: {
    domain: 'personal',
    attention: 'plans',
    action: action(
      'plans.next',
      'What should I do next?',
      'Look at my plans and suggest my next move.',
    ),
  },
  whatif: {
    domain: 'personal',
    attention: 'scenario',
    action: action(
      'whatif.explain',
      'Explain this scenario',
      'Explain what would happen in this What-if scenario.',
    ),
  },
  account: {
    domain: 'personal',
    attention: 'settings',
    action: action(
      'account.help',
      'Explain a setting',
      'Explain what a setting on this screen does.',
    ),
  },
  memory: {
    domain: 'personal',
    attention: 'memory',
    action: action('memory.explain', 'Explain memory', 'Explain what Melo is remembering and why.'),
  },
  decisions: {
    domain: 'personal',
    attention: 'decisions',
    action: action(
      'decisions.explain',
      'Explain decisions',
      "Explain the decisions I've made and their impact.",
    ),
  },
  backup: {
    domain: 'personal',
    attention: 'privacy',
    action: action('backup.explain', 'Explain backup', 'Explain how backup works in Melo.'),
  },
  notifications: {
    domain: 'personal',
    attention: 'notifications',
    action: action(
      'notifications.help',
      'Explain a notification',
      'Explain what this notification means.',
    ),
  },
  'data-access-log': {
    domain: 'personal',
    attention: 'privacy',
    action: action(
      'data-access.explain',
      'Explain data access',
      'Explain what Melo read and when.',
    ),
  },
  'widget-preview': {
    domain: 'personal',
    attention: 'widget',
    action: action('widget.explain', 'Explain the widget', 'Explain what this widget shows.'),
  },
  debts: {
    domain: 'personal',
    attention: 'debts',
    action: action(
      'debts.explain',
      'Explain my debts',
      'Explain where my debt plan stands right now.',
    ),
  },
  'business-today': {
    domain: 'business',
    attention: 'business-today',
    action: action(
      'business-today.explain',
      'Explain today',
      'Explain what today looks like for the business.',
    ),
  },
  'business-review': {
    domain: 'business',
    attention: 'review',
    action: action(
      'business-review.explain',
      'Explain what needs review',
      "Explain what's waiting for me to review.",
    ),
  },
  'business-runway': {
    domain: 'business',
    attention: 'runway',
    action: action(
      'business-runway.explain',
      'Explain runway',
      "Explain what's driving the business runway right now.",
    ),
  },
  'business-money': {
    domain: 'business',
    attention: 'business-money',
    action: action(
      'business-money.explain',
      'Explain business money',
      'Explain the one business money issue worth checking today.',
    ),
  },
  'business-invoices': {
    domain: 'business',
    attention: 'invoices',
    action: action(
      'business-invoices.explain',
      'Explain invoices',
      'Explain the state of the business invoices right now.',
    ),
  },
  'business-vat': {
    domain: 'business',
    attention: 'vat',
    action: action('business-vat.explain', 'Explain VAT', 'Explain what is coming up for VAT.'),
  },
  'business-filings': {
    domain: 'business',
    attention: 'filings',
    action: action(
      'business-filings.explain',
      'What should I file first?',
      'Explain which business filing needs attention first.',
    ),
  },
  'business-calendar': {
    domain: 'business',
    attention: 'business-calendar',
    action: action(
      'business-calendar.explain',
      'Explain this month',
      'Explain the important business dates this month.',
    ),
  },
  'business-plans': {
    domain: 'business',
    attention: 'business-plans',
    action: action(
      'business-plans.next',
      'What should I do next?',
      'Suggest the next useful business money move.',
    ),
  },
  'business-more': {
    domain: 'business',
    attention: 'business-navigation',
    action: action(
      'business-more.help',
      'Where should I look next?',
      'Suggest a useful business surface to check next.',
    ),
  },
  'business-account': {
    domain: 'business',
    attention: 'business-settings',
    action: action(
      'business-account.help',
      'Explain a setting',
      'Explain what this business setting does.',
    ),
  },
  // Full-take and auth/payment surfaces deliberately suppress the companion.
  start: hidden('personal', 'start-flow'),
  guided: hidden('personal', 'guided-input'),
  intake: hidden('personal', 'file-intake'),
  'pdf-success': hidden('personal', 'file-intake'),
  'pdf-fallback': hidden('personal', 'file-input'),
  'image-success': hidden('personal', 'file-intake'),
  'image-fallback': hidden('personal', 'file-input'),
  'paste-success': hidden('personal', 'file-intake'),
  review: hidden('personal', 'review-flow'),
  ritual: hidden('personal', 'ritual-flow'),
  shortfall: hidden('personal', 'shortfall-flow'),
  paywall: hidden('personal', 'auth-payment'),
  signin: hidden('personal', 'auth-payment'),
  'add-bill': hidden('personal', 'form'),
  'add-debt': hidden('personal', 'form'),
  applock: hidden('personal', 'auth-payment'),
  privacy: {
    domain: 'personal',
    attention: 'privacy',
    action: action('privacy.explain', 'Explain privacy', 'Explain what Melo does with my data.'),
  },
  'partner-mode': {
    domain: 'personal',
    attention: 'privacy',
    action: action(
      'partner.explain',
      'Explain partner mode',
      'Explain what partner mode shares and hides.',
    ),
  },
  trust: {
    domain: 'personal',
    attention: 'privacy',
    action: action('trust.explain', 'Explain trust', 'Explain how Melo handles trust and data.'),
  },
  'correction-ledger': {
    domain: 'personal',
    attention: 'corrections',
    action: action(
      'corrections.explain',
      'Explain corrections',
      'Explain what I corrected and why it matters.',
    ),
  },
  visualizer: {
    domain: 'personal',
    attention: 'visualizer',
    action: action(
      'visualizer.explain',
      'Explain the visualizer',
      'Explain what Melo saw in the visualizer.',
    ),
  },
  connections: {
    domain: 'personal',
    attention: 'connections',
    action: action(
      'connections.explain',
      'Explain connections',
      'Explain what connecting an account will do.',
    ),
  },
  'returning-recap': {
    domain: 'personal',
    attention: 'recap',
    action: action('recap.explain', 'Explain the recap', 'Explain what changed while I was away.'),
  },
  'quiet-hours': {
    domain: 'personal',
    attention: 'quiet-hours',
    action: action(
      'quiet-hours.explain',
      'Explain quiet hours',
      'Explain how quiet hours affect notifications.',
    ),
  },
  inbox: {
    domain: 'personal',
    attention: 'inbox',
    action: action(
      'inbox.explain',
      'What needs attention?',
      'Summarise the notifications that need my attention.',
    ),
  },
  accessibility: {
    domain: 'personal',
    attention: 'accessibility',
    action: action(
      'accessibility.explain',
      'Explain accessibility',
      'Explain the accessibility options on this screen.',
    ),
  },
  'business-intake': hidden('business', 'business-intake'),
  'business-entity-setup': hidden('business', 'business-setup'),
  'business-workspace-create': hidden('business', 'business-setup'),
  'business-workspace-rename': hidden('business', 'business-setup'),
  'business-workspace-archive': hidden('business', 'business-archive'),
  'business-melo': {
    domain: 'business',
    attention: 'business-companion',
    action: action(
      'business-melo.explain',
      'What does Melo watch here?',
      'Explain what Melo watches on the business side.',
    ),
  },
  'business-activity': {
    domain: 'business',
    attention: 'business-activity',
    action: action(
      'business-activity.explain',
      'Explain activity',
      'Summarise recent business activity.',
    ),
  },
  'business-data': {
    domain: 'business',
    attention: 'business-data',
    action: action(
      'business-data.explain',
      'Explain business data',
      'Explain what business data lives on this device.',
    ),
  },
  'business-workspace-current': {
    domain: 'business',
    attention: 'workspace',
    action: action(
      'business-workspace.explain',
      'Explain workspaces',
      'Explain how personal and business workspaces separate.',
    ),
  },
  'business-workspace-personal': {
    domain: 'business',
    attention: 'workspace',
    action: action(
      'business-workspace.explain-personal',
      'Explain workspaces',
      'Explain how personal and business workspaces separate.',
    ),
  },
  'business-workspace-archived': {
    domain: 'business',
    attention: 'workspace',
    action: action(
      'business-workspace.archived',
      'Explain archived',
      'Explain what archiving keeps and what it hides.',
    ),
  },
  'business-corp-tax': {
    domain: 'business',
    attention: 'corporation-tax',
    action: action(
      'business-corp-tax.explain',
      'Explain Corporation Tax',
      "Explain what's driving Corporation Tax.",
    ),
  },
  'business-payroll': {
    domain: 'business',
    attention: 'payroll',
    action: action(
      'business-payroll.explain',
      'Explain payroll',
      "Explain the payroll run and what's owed.",
    ),
  },
  'business-dividends': {
    domain: 'business',
    attention: 'dividends',
    action: action(
      'business-dividends.explain',
      'Explain dividends',
      'Explain dividends and distributable reserves.',
    ),
  },
  'business-dla': {
    domain: 'business',
    attention: 'director-loan',
    action: action(
      'business-dla.explain',
      "Explain the director's loan",
      "Explain the director's loan and any exposure.",
    ),
  },
  'business-companies-house': {
    domain: 'business',
    attention: 'companies-house',
    action: action(
      'business-ch.explain',
      'Explain Companies House',
      'Explain the Companies House filings that matter.',
    ),
  },
  'business-obligations': {
    domain: 'business',
    attention: 'obligations',
    action: action(
      'business-obligations.explain',
      'Explain obligations',
      'Explain recurring business obligations.',
    ),
  },
  'business-filing-vat': {
    domain: 'business',
    attention: 'vat-filing',
    action: action(
      'business-filing-vat.explain',
      'Explain this VAT filing',
      'Explain this VAT filing and what I need to do.',
    ),
  },
  'business-filing-sa': {
    domain: 'business',
    attention: 'self-assessment',
    action: action(
      'business-filing-sa.explain',
      'Explain this SA filing',
      'Explain this Self Assessment filing.',
    ),
  },
  'business-filing-ct': {
    domain: 'business',
    attention: 'corporation-tax',
    action: action(
      'business-filing-ct.explain',
      'Explain this CT filing',
      'Explain this Corporation Tax filing.',
    ),
  },
  'business-filing-cs': {
    domain: 'business',
    attention: 'confirmation-statement',
    action: action(
      'business-filing-cs.explain',
      'Explain confirmation statement',
      'Explain the confirmation statement.',
    ),
  },
  'business-filing-accounts': {
    domain: 'business',
    attention: 'accounts',
    action: action(
      'business-filing-accounts.explain',
      'Explain accounts filing',
      'Explain the accounts filing.',
    ),
  },
  'business-insights': {
    domain: 'business',
    attention: 'business-insights',
    action: action(
      'business-insights.explain',
      'Explain business insights',
      'Explain what business insights are showing.',
    ),
  },
  'business-clients': {
    domain: 'business',
    attention: 'clients',
    action: action(
      'business-clients.explain',
      'Explain clients',
      'Summarise clients and who owes what.',
    ),
  },
  'business-mileage': {
    domain: 'business',
    attention: 'mileage',
    action: action(
      'business-mileage.explain',
      'Explain mileage',
      'Explain the mileage claim and threshold.',
    ),
  },
  'business-home-office': {
    domain: 'business',
    attention: 'home-office',
    action: action(
      'business-home-office.explain',
      'Explain home office',
      'Explain simplified versus actual home-office claims.',
    ),
  },
  'business-ir35': {
    domain: 'business',
    attention: 'ir35',
    action: action(
      'business-ir35.explain',
      'Explain IR35',
      'Explain what the IR35 indicator means.',
    ),
  },
  'business-vat-scheme': {
    domain: 'business',
    attention: 'vat-scheme',
    action: action(
      'business-vat-scheme.explain',
      'Explain VAT scheme',
      'Explain which VAT scheme suits the business.',
    ),
  },
  'mileage-log': {
    domain: 'business',
    attention: 'mileage',
    action: action(
      'mileage-log.explain',
      'Explain the mileage log',
      'Explain how the mileage log affects the claim.',
    ),
  },
  'home-office-compare': {
    domain: 'business',
    attention: 'home-office',
    action: action(
      'home-office-compare.explain',
      'Explain the comparison',
      'Explain simplified versus actual home office side by side.',
    ),
  },
  'sa-payments': {
    domain: 'business',
    attention: 'self-assessment',
    action: action(
      'sa-payments.explain',
      'Explain payments on account',
      'Explain payments on account and when they are due.',
    ),
  },
  'mtd-checklist': {
    domain: 'business',
    attention: 'mtd',
    action: action('mtd.explain', 'Explain MTD readiness', 'Explain what MTD readiness means.'),
  },
  'pension-planner': {
    domain: 'business',
    attention: 'pension',
    action: action(
      'pension-planner.explain',
      'Explain the pension picture',
      'Explain the pension planner outputs.',
    ),
  },
  'salary-vs-dividend': {
    domain: 'business',
    attention: 'salary-dividend',
    action: action(
      'salary-vs-dividend.explain',
      'Explain salary versus dividend',
      'Explain the salary/dividend trade-off.',
    ),
  },
});

const DEFAULT_PROFILE = Object.freeze({
  domain: 'unknown',
  attention: 'neutral',
  hidden: false,
  action: null,
});

export function resolveScreenProfile(screen) {
  if (!screen) return { id: null, ...DEFAULT_PROFILE };
  const profile = SCREEN_PROFILES[screen] ?? DEFAULT_PROFILE;
  return { id: screen, ...DEFAULT_PROFILE, ...profile };
}

/**
 * Resolve a screen-specific reaction without fabricating a financial event.
 * The caller still supplies the real event and context; this only selects the
 * appropriate visual intensity and default action for that surface.
 */
export function resolveScreenReaction(screen, event) {
  const profile = resolveScreenProfile(screen);
  const type = event?.type;
  let visualState = null;
  let intensity = event?.intensity ?? 'normal';

  if (profile.hidden) {
    return { profile, visualState: null, intensity, contextAction: null };
  }

  if (['RUNWAY_CHANGED', 'TIGHT_POINT_REACHED'].includes(type)) {
    visualState = event.direction === 'improved' ? 'positive-small' : 'concern-small';
  } else if (
    ['SHORTFALL_OPENED', 'BILL_RISK', 'VAT_DUE', 'BUSINESS_FILING_DUE', 'INVOICE_OVERDUE'].includes(
      type,
    )
  ) {
    visualState =
      intensity === 'major' || profile.attention === 'runway' ? 'concern-major' : 'concern-small';
  } else if (
    ['SHORTFALL_RESOLVED', 'RECOVERY_EXIT', 'IMPORTANT_BILL_COVERED', 'BILL_SHIELD_ARMED'].includes(
      type,
    )
  ) {
    visualState = 'reassurance';
  } else if (
    [
      'DEBT_CLEARED',
      'POT_GOAL_HIT',
      'PAYDAY',
      'RITUAL_COMPLETED',
      'CYCLE_CLOSED',
      'FILING_COMPLETED',
    ].includes(type)
  ) {
    visualState = 'positive-major';
    intensity = 'major';
  } else if (
    [
      'POT_ADDED',
      'POT_HALFWAY',
      'SUB_PAUSED',
      'SUB_RESUMED',
      'INVOICE_PAID',
      'TAX_OBLIGATION_RESOLVED',
      'STATEMENT_IMPORTED',
      'BEFORE_SPEND_RESULT',
    ].includes(type)
  ) {
    visualState = 'positive-small';
  } else if (
    ['IMPORT_STARTED', 'THINKING_START', 'RECALCULATION_START', 'FILING_STARTED'].includes(type)
  ) {
    visualState = 'thinking-loop';
  } else if (['IMPORT_FAILED', 'FILING_FAILED', 'BLOCKED'].includes(type)) {
    visualState = 'blocked';
  } else if (
    ['BEFORE_SPEND_ASKED', 'SUB_CAUGHT', 'WAITING_INPUT', 'ACTION_REQUIRED'].includes(type)
  ) {
    visualState = 'waiting-for-user';
  } else if (type === 'USER_INTERACT' || type === 'FIRST_ANSWER' || type === 'WHAT_CHANGED') {
    visualState = 'result-acknowledgement';
  }

  return {
    profile,
    visualState,
    intensity,
    contextAction: event?.contextAction ?? profile.action,
  };
}

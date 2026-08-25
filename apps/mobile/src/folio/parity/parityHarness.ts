/**
 * Explicit visual-parity capture harness.
 *
 * This module is inert unless EXPO_PUBLIC_MELO_PARITY_CAPTURE=true is baked into a dedicated QA
 * build. In capture mode it never reads or starts native persistence, never writes fixture rows to
 * a user's vault, fixes the clock, and builds every financial state through the same public store
 * authorities the product uses. Production defaults remain untouched.
 */
import {
  addAccount,
  addDebt,
  addEvidenceDocument,
  addPlan,
  addTransaction,
  createEmptyWorkspacePartition,
  enqueueReviewItems,
  hydrateFromBlob,
  resetToEmpty,
  setCurrentBalance,
  setIncomeSources,
  setMeloPrimerSeen,
  setOnboarding,
  setPots,
  setSubs,
  updateBusinessOperations,
  type BalanceConfidence,
  type Sub,
} from '../store';
import {
  BUSINESS_ACCEPTANCE_NOW,
  ltdAcceptanceFixture,
  soleTraderAcceptanceFixture,
} from '../lib/fixtures/businessAcceptanceFixture';
import {
  createBusinessWorkspace,
  createPersonalWorkspaceRoot,
} from '../lib/workspaceRoot';
import type { ScreenId, SheetId } from '../types';

export const PARITY_FIXTURE_IDS = [
  'confirmed-safe',
  'provisional-low-confidence',
  'pressured',
  'negative-shortfall',
  'populated-commitments',
  'pending-review',
  'business-sole-trader',
  'business-ltd',
  'empty',
  'first-run',
] as const;

export type ParityFixtureId = (typeof PARITY_FIXTURE_IDS)[number];
export type ParityTheme = 'light' | 'dark';

export type ParityHarnessConfig = Readonly<{
  fixture: ParityFixtureId;
  nowISO: string;
  screen: ScreenId;
  sheet: SheetId;
  theme: ParityTheme;
}>;

const DEFAULT_CAPTURE_NOW = '2026-08-18T08:00:00.000Z';

const SCREEN_IDS: ReadonlySet<string> = new Set([
  'start',
  'guided',
  'intake',
  'pdf-success',
  'pdf-fallback',
  'image-success',
  'image-fallback',
  'paste-success',
  'visualizer',
  'review',
  'review-item',
  'today',
  'today-mode',
  'today-stability',
  'today-after',
  'whatif',
  'plans',
  'calendar',
  'timeline',
  'add-bill',
  'add-debt',
  'recovery',
  'subs',
  'pots',
  'ritual',
  'insights',
  'shortfall',
  'more',
  'privacy',
  'melo',
  'paywall',
  'account',
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

const SHEET_IDS: ReadonlySet<string> = new Set([
  'route-detail',
  'edit-txn',
  'appearance',
  'melo-chat',
  'share',
  'onboarding',
  'log-spend',
  'log-invoice',
  'log-payment',
  'add-plan',
  'declare-debt',
  'household-setup',
  'sub-caught',
  'income-caught',
  'bill-caught',
  'drift-caught',
  'annual-caught',
  'add-event',
  'calendar-export',
  'calendar-connect',
  'safe-zone',
  'shelf',
  'afford-check',
  'lens-picker',
  'chart-style',
  'hidden-review',
  'day-detail',
]);

function isFixtureId(value: string | undefined): value is ParityFixtureId {
  return PARITY_FIXTURE_IDS.some((candidate) => candidate === value);
}

function captureScreen(value: string | undefined): ScreenId {
  return value !== undefined && SCREEN_IDS.has(value) ? (value as ScreenId) : 'today';
}

function captureSheet(value: string | undefined): SheetId {
  return value !== undefined && SHEET_IDS.has(value) ? (value as NonNullable<SheetId>) : null;
}

/** Returns null in every ordinary production/debug build. Expo inlines these explicit public env
 *  reads at bundle time, so a capture APK is an intentional, separately-built artifact. */
export function getParityHarnessConfig(): ParityHarnessConfig | null {
  if (process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE !== 'true') return null;
  const fixtureValue = process.env.EXPO_PUBLIC_MELO_PARITY_FIXTURE;
  if (!isFixtureId(fixtureValue)) {
    throw new Error(`Unknown parity fixture: ${fixtureValue ?? '(missing)'}.`);
  }
  const nowISO = process.env.EXPO_PUBLIC_MELO_PARITY_NOW ?? DEFAULT_CAPTURE_NOW;
  if (!Number.isFinite(Date.parse(nowISO))) throw new Error(`Invalid parity clock: ${nowISO}.`);
  return {
    fixture: fixtureValue,
    nowISO: new Date(nowISO).toISOString(),
    screen: captureScreen(process.env.EXPO_PUBLIC_MELO_PARITY_SCREEN),
    sheet: captureSheet(process.env.EXPO_PUBLIC_MELO_PARITY_SHEET),
    theme: process.env.EXPO_PUBLIC_MELO_PARITY_THEME === 'dark' ? 'dark' : 'light',
  };
}

let clockInstalled = false;

/** A capture-only clock. Calls with explicit Date constructor arguments retain native behaviour;
 *  only no-argument Date()/new Date()/Date.now() are fixed. */
function installCaptureClock(nowISO: string): void {
  if (clockInstalled) return;
  const NativeDate = globalThis.Date;
  const fixedTime = NativeDate.parse(nowISO);
  const FixedDate = new Proxy(NativeDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length === 0 ? [fixedTime] : args, newTarget);
    },
    apply(target, thisArg, args) {
      if (args.length === 0) return new NativeDate(fixedTime).toString();
      return Reflect.apply(target, thisArg, args);
    },
  }) as DateConstructor;
  Object.defineProperty(FixedDate, 'now', { configurable: true, value: () => fixedTime });
  globalThis.Date = FixedDate;
  clockInstalled = true;
}

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function baseSubscriptions(kind: 'safe' | 'pressured' | 'negative'): Sub[] {
  const rows: Sub[] = [
    {
      name: 'Council tax',
      cost: kind === 'safe' ? 120 : kind === 'pressured' ? 260 : 420,
      nextRenewalDaysAway: 2,
      nextRenewalISO: isoDay(2),
      lastUsedDaysAgo: 0,
      usesPerMonth: 1,
    },
    {
      name: 'Energy',
      cost: kind === 'safe' ? 68 : kind === 'pressured' ? 180 : 310,
      nextRenewalDaysAway: 4,
      nextRenewalISO: isoDay(4),
      lastUsedDaysAgo: 0,
      usesPerMonth: 1,
    },
  ];
  return rows;
}

function configurePersonalBase(input: Readonly<{
  balance: number;
  confidence: BalanceConfidence;
  income: number;
  kind: 'safe' | 'pressured' | 'negative';
}>): void {
  resetToEmpty({ onboardingDone: true });
  setOnboarding({ done: true, name: 'Alex', payday: 28, monthlyIncome: input.income });
  setCurrentBalance({
    amount: input.balance,
    source: input.confidence === 'rough' ? 'user-entered' : 'corrected',
    confidence: input.confidence,
  });
  setIncomeSources([
    {
      id: 'fixture-income-main',
      label: 'Payday',
      cadence: 'monthly',
      dayOfMonth: 28,
      amount: input.income,
      source: input.confidence === 'rough' ? 'inferred' : 'onboarding',
    },
  ]);
  setSubs(baseSubscriptions(input.kind));
  setMeloPrimerSeen(true);
  addTransaction({
    id: 'fixture-txn-groceries',
    when: new Date(Date.now() - 86_400_000).toISOString(),
    merchant: 'Groceries',
    amount: -42,
    category: 'food',
    source: 'manual',
  });
}

function configureBusiness(kind: 'sole-trader' | 'ltd'): void {
  const personal = createPersonalWorkspaceRoot().workspaces[0]!;
  const suffix = kind === 'sole-trader' ? 'parity_sole' : 'parity_ltd';
  const business = createBusinessWorkspace({
    id: `workspace_business_${suffix}`,
    name: kind === 'sole-trader' ? 'Northstar Studio' : 'Harbour & Field Ltd',
    encryptedSubkeyId: `workspace-subkey-business-${suffix}-v1`,
  });
  const root = {
    workspaces: [personal, business],
    activeWorkspaceId: business.id,
    dataWorkspaceId: business.id,
  } as const;
  const empty = createEmptyWorkspacePartition(root, business.id, BUSINESS_ACCEPTANCE_NOW.toISOString());
  hydrateFromBlob(JSON.stringify(empty), business.id);
  const fixture = kind === 'sole-trader' ? soleTraderAcceptanceFixture() : ltdAcceptanceFixture();
  updateBusinessOperations(fixture.state);
  for (const [index, account] of fixture.accounts.entries()) {
    addAccount({
      name: index === 0 ? 'Business current account' : `Business account ${index + 1}`,
      kind: 'bank',
      balanceMinor: account.balanceMinor,
      isLiability: account.isLiability,
      ...(account.closed === undefined ? {} : { closed: account.closed }),
      balanceAsOfISO: BUSINESS_ACCEPTANCE_NOW.toISOString(),
      addedAt: BUSINESS_ACCEPTANCE_NOW.toISOString(),
    });
  }
  setMeloPrimerSeen(true);
}

/** Applies one deterministic state through real store authorities. Must run before persistence is
 *  started; app/index.tsx deliberately skips persistence entirely in capture mode. */
export function activateParityHarness(config: ParityHarnessConfig): void {
  installCaptureClock(config.nowISO);

  if (config.fixture === 'business-sole-trader') {
    configureBusiness('sole-trader');
    return;
  }
  if (config.fixture === 'business-ltd') {
    configureBusiness('ltd');
    return;
  }
  if (config.fixture === 'empty') {
    resetToEmpty({ onboardingDone: true });
    return;
  }
  if (config.fixture === 'first-run') {
    resetToEmpty({ onboardingDone: false });
    return;
  }

  if (config.fixture === 'provisional-low-confidence') {
    configurePersonalBase({ balance: 680, confidence: 'rough', income: 1450, kind: 'safe' });
    return;
  }
  if (config.fixture === 'pressured') {
    configurePersonalBase({ balance: 520, confidence: 'corrected', income: 1500, kind: 'pressured' });
    return;
  }
  if (config.fixture === 'negative-shortfall') {
    configurePersonalBase({ balance: 300, confidence: 'corrected', income: 1200, kind: 'negative' });
    return;
  }

  configurePersonalBase({ balance: 1480, confidence: 'corrected', income: 2600, kind: 'safe' });

  if (config.fixture === 'populated-commitments') {
    setPots([
      { id: 'fixture-buffer', name: 'Buffer', saved: 420, goal: 900, perWeek: 30, accent: true },
      {
        id: 'fixture-holiday',
        name: 'Holiday · October',
        saved: 360,
        goal: 1200,
        perWeek: 45,
        accent: false,
      },
    ]);
    addDebt({
      id: 'fixture-loan',
      name: 'Personal loan',
      kind: 'loan',
      balance: 2400,
      apr: 12.9,
      minPayment: 120,
      dueDom: 24,
      addedAt: '2026-06-01T08:00:00.000Z',
    });
    addPlan({
      id: 'fixture-plan',
      name: 'New laptop',
      target: 1600,
      saved: 420,
      byDate: '2026-12-15',
      perWeek: 45,
      addedAt: '2026-06-01T08:00:00.000Z',
    });
    return;
  }

  if (config.fixture === 'pending-review') {
    const evidence = addEvidenceDocument({
      id: 'evidence_11111111111111111111111111111111',
      filename: 'parity-statement.pdf',
      mediaType: 'application/pdf',
      byteSize: 4096,
      addedAtISO: new Date().toISOString(),
      sourceType: 'document',
      extractionStatus: 'read',
      storageState: 'encrypted-device-vault',
    });
    const nativeRandom = Math.random;
    Math.random = () => 0.3141592653;
    try {
      enqueueReviewItems([
        {
          source: 'pdf',
          sourceEvidenceId: evidence.id,
          merchant: 'Railcard',
          amount: -30,
          date: isoDay(-1),
          category: 'transport',
          hint: 'looks like travel',
        },
        {
          source: 'pdf',
          sourceEvidenceId: evidence.id,
          merchant: 'Freelance payment',
          amount: 480,
          date: isoDay(-2),
          category: 'income',
          hint: 'looks like income',
        },
      ]);
    } finally {
      Math.random = nativeRandom;
    }
  }
}

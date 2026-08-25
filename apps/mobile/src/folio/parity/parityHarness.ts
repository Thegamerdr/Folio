/**
 * Explicit visual-parity capture harness.
 *
 * This module is inert unless EXPO_PUBLIC_MELO_PARITY_CAPTURE=true is baked into a dedicated QA
 * build. In capture mode it never reads or starts native persistence, never writes fixture rows to
 * a user's vault, fixes the clock, and builds every financial state through the same public store
 * authorities the product uses. Production defaults remain untouched.
 */
import { Linking } from 'react-native';

import {
  addAccount,
  addCalendarEvent,
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
import fixtureManifestJson from './fixtures.json';
import {
  BUSINESS_ACCEPTANCE_NOW,
  ltdAcceptanceFixture,
  soleTraderAcceptanceFixture,
} from '../lib/fixtures/businessAcceptanceFixture';
import { createBusinessWorkspace, createPersonalWorkspaceRoot } from '../lib/workspaceRoot';
import type { ScreenId, SheetId } from '../types';

export type ParityFixtureId = keyof typeof fixtureManifestJson.fixtures;
export const PARITY_FIXTURE_IDS = Object.freeze(
  Object.keys(fixtureManifestJson.fixtures) as ParityFixtureId[],
);
export type ParityTheme = 'light' | 'dark';

type PersonalFixture = Readonly<{
  kind: 'personal';
  designPressure: 'safe' | 'calm' | 'soft' | 'pressured' | 'overspent';
  balance: number;
  balanceSource: 'user-entered' | 'corrected';
  confidence: BalanceConfidence;
  income: number;
  payday: number;
  subscriptions: ReadonlyArray<Readonly<{ name: string; cost: number; daysAway: number }>>;
  pots?: ReadonlyArray<
    Readonly<{
      id: string;
      name: string;
      saved: number;
      goal: number;
      perWeek: number;
      accent: boolean;
    }>
  >;
  debts?: ReadonlyArray<
    Readonly<{
      id: string;
      name: string;
      kind: 'loan';
      balance: number;
      apr: number;
      minPayment: number;
      dueDom: number;
      addedAt: string;
    }>
  >;
  plans?: ReadonlyArray<
    Readonly<{
      id: string;
      name: string;
      target: number;
      saved: number;
      byDate: string;
      perWeek: number;
      addedAt: string;
    }>
  >;
  reviewItems?: ReadonlyArray<
    Readonly<{
      source: 'pdf';
      merchant: string;
      amount: number;
      date: string;
      category: 'transport' | 'income';
      hint: string;
    }>
  >;
}>;

const fixtureManifest = fixtureManifestJson as unknown as Readonly<{
  schemaVersion: 1;
  nowISO: string;
  randomSeed: number;
  locale: 'en-GB';
  timeZone: 'UTC';
  personalDefaults: Readonly<{
    name: string;
    transactions: ReadonlyArray<
      Readonly<{
        id: string;
        when: string;
        merchant: string;
        amount: number;
        category: 'food' | 'fun';
        source: 'manual';
      }>
    >;
  }>;
  designAdapter: Readonly<{
    implicitCalendarEvents: ReadonlyArray<
      Readonly<{
        id: string;
        date: string;
        kind: 'out' | 'review';
        title: string;
        note?: string;
        amount?: number;
      }>
    >;
  }>;
  fixtures: Record<ParityFixtureId, PersonalFixture | Readonly<{ kind: string }>>;
}>;

function isPersonalFixture(
  fixture: PersonalFixture | Readonly<{ kind: string }>,
): fixture is PersonalFixture {
  return fixture.kind === 'personal' && 'balance' in fixture;
}

export type ParityHarnessConfig = Readonly<{
  fixture: ParityFixtureId;
  nowISO: string;
  screen: ScreenId;
  sheet: SheetId;
  theme: ParityTheme;
}>;

const DEFAULT_CAPTURE_NOW = fixtureManifest.nowISO;

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
  'plan',
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

export type ParityRuntimeControl = Readonly<{
  screen: ScreenId;
  sheet: SheetId;
  theme: ParityTheme;
  sequence: number;
}>;

let parityRuntimeControl: ParityRuntimeControl | null = null;
let parityRuntimeSequence = 0;
let parityRuntimeSubscription: { remove: () => void } | null = null;
const parityRuntimeListeners = new Set<() => void>();

/** Stable snapshot used by capture-only external stores. Ordinary builds always return null. */
export function getParityRuntimeControl(): ParityRuntimeControl | null {
  return parityRuntimeControl;
}

export function subscribeParityRuntimeControl(listener: () => void): () => void {
  parityRuntimeListeners.add(listener);
  return () => parityRuntimeListeners.delete(listener);
}

function applyParityRuntimeUrl(url: string): void {
  const baked = getParityHarnessConfig();
  if (baked === null) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== 'folio:' || parsed.hostname !== 'parity') return;

  const screenValue = parsed.searchParams.get('screen') ?? undefined;
  const sheetValue = parsed.searchParams.get('sheet') ?? undefined;
  const themeValue = parsed.searchParams.get('theme') ?? undefined;
  const prior = parityRuntimeControl ?? {
    screen: baked.screen,
    sheet: baked.sheet,
    theme: baked.theme,
    sequence: parityRuntimeSequence,
  };

  const screen = screenValue !== undefined && SCREEN_IDS.has(screenValue)
    ? (screenValue as ScreenId)
    : prior.screen;
  const sheet =
    sheetValue === 'none'
      ? null
      : sheetValue !== undefined && SHEET_IDS.has(sheetValue)
        ? (sheetValue as NonNullable<SheetId>)
        : screenValue !== undefined
          ? null
          : prior.sheet;
  const theme = themeValue === 'dark' || themeValue === 'light' ? themeValue : prior.theme;

  parityRuntimeSequence += 1;
  parityRuntimeControl = { screen, sheet, theme, sequence: parityRuntimeSequence };
  for (const listener of parityRuntimeListeners) listener();
}

/**
 * Enables capture-only runtime navigation through `folio://parity?...` deep links. A single
 * fixture APK can therefore render an entire family in both themes without rebuilding for every
 * surface. The listener is never installed in an ordinary build.
 */
export function startParityRuntimeControl(): () => void {
  if (getParityHarnessConfig() === null) return () => undefined;
  if (parityRuntimeSubscription === null) {
    parityRuntimeSubscription = Linking.addEventListener('url', ({ url }) => {
      applyParityRuntimeUrl(url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url !== null) applyParityRuntimeUrl(url);
    });
  }
  return () => undefined;
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

function addPinnedSourcePotCadenceAdapters(input: PersonalFixture): void {
  const pots = input.pots ?? [];
  if (pots.length === 0) return;

  const now = new Date(Date.now());
  const paydayOffset = (((input.payday - now.getUTCDate()) % 31) + 31) % 31;
  const nativeDefaultTopUpDate = isoDay(paydayOffset);
  for (let offset = 0; offset <= 35; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000);
    if (date.getUTCDay() !== 5) continue;
    const dateISO = date.toISOString().slice(0, 10);
    // Native already projects an unmigrated pot once on the resolved payday.
    if (dateISO === nativeDefaultTopUpDate) continue;
    for (const pot of pots) {
      if (!(pot.perWeek > 0)) continue;
      addCalendarEvent({
        id: `fixture-design-pot-${pot.id}-${dateISO}`,
        date: dateISO,
        kind: 'out',
        title: `${pot.name} pot`,
        note: 'Weekly top-up',
        amount: -pot.perWeek,
      });
    }
  }
}

function fixtureSubscriptions(fixture: PersonalFixture): Sub[] {
  return fixture.subscriptions.map((row) => ({
    name: row.name,
    cost: row.cost,
    nextRenewalDaysAway: row.daysAway,
    nextRenewalISO: isoDay(row.daysAway),
    lastUsedDaysAgo: 0,
    usesPerMonth: 1,
  }));
}

function withFixtureRandom<T>(run: () => T): T {
  const nativeRandom = Math.random;
  let seed = fixtureManifest.randomSeed >>> 0;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  try {
    return run();
  } finally {
    Math.random = nativeRandom;
  }
}

function configurePersonalBase(input: PersonalFixture): void {
  resetToEmpty({ onboardingDone: true });
  setOnboarding({
    done: true,
    name: fixtureManifest.personalDefaults.name,
    payday: input.payday,
    monthlyIncome: input.income,
  });
  setCurrentBalance({
    amount: input.balance,
    source: input.balanceSource,
    confidence: input.confidence,
  });
  setIncomeSources([
    {
      id: 'fixture-income-main',
      label: 'Payday',
      cadence: 'monthly',
      dayOfMonth: input.payday,
      amount: input.income,
      source: input.confidence === 'rough' ? 'inferred' : 'onboarding',
    },
  ]);
  setSubs(fixtureSubscriptions(input));
  setMeloPrimerSeen(true);
  for (const event of fixtureManifest.designAdapter.implicitCalendarEvents) {
    addCalendarEvent({
      id: event.id,
      date: event.date,
      kind: event.kind,
      title: event.title,
      ...(event.note === undefined ? {} : { note: event.note }),
      ...(event.amount === undefined ? {} : { amount: event.amount }),
    });
  }
  for (const transaction of fixtureManifest.personalDefaults.transactions) {
    addTransaction(transaction);
  }
  setPots([...(input.pots ?? [])]);
  addPinnedSourcePotCadenceAdapters(input);
  for (const debt of input.debts ?? []) addDebt(debt);
  for (const plan of input.plans ?? []) addPlan(plan);
  if ((input.reviewItems?.length ?? 0) > 0) {
    const evidence = addEvidenceDocument({
      id: 'evidence_11111111111111111111111111111111',
      filename: 'parity-statement.pdf',
      mediaType: 'application/pdf',
      byteSize: 4096,
      addedAtISO: fixtureManifest.nowISO,
      sourceType: 'document',
      extractionStatus: 'read',
      storageState: 'encrypted-device-vault',
    });
    withFixtureRandom(() =>
      enqueueReviewItems(
        (input.reviewItems ?? []).map((item) => ({
          ...item,
          sourceEvidenceId: evidence.id,
        })),
      ),
    );
  }
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
  const empty = createEmptyWorkspacePartition(
    root,
    business.id,
    BUSINESS_ACCEPTANCE_NOW.toISOString(),
  );
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

function configureEmptyBusiness(): void {
  const personal = createPersonalWorkspaceRoot().workspaces[0]!;
  const business = createBusinessWorkspace({
    id: 'workspace_business_parity_empty',
    name: 'Business',
    encryptedSubkeyId: 'workspace-subkey-business-parity-empty-v1',
  });
  const root = {
    workspaces: [personal, business],
    activeWorkspaceId: business.id,
    dataWorkspaceId: business.id,
  } as const;
  const empty = createEmptyWorkspacePartition(
    root,
    business.id,
    BUSINESS_ACCEPTANCE_NOW.toISOString(),
  );
  hydrateFromBlob(JSON.stringify(empty), business.id);
  setMeloPrimerSeen(true);
}

/** Applies one deterministic state through real store authorities. Must run before persistence is
 *  started; app/index.tsx deliberately skips persistence entirely in capture mode. */
export function activateParityHarness(config: ParityHarnessConfig): void {
  installCaptureClock(config.nowISO);

  const fixture = fixtureManifest.fixtures[config.fixture];

  if (config.fixture === 'business-empty') {
    configureEmptyBusiness();
    return;
  }
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

  if (!isPersonalFixture(fixture)) {
    throw new Error(`Parity fixture ${config.fixture} has unsupported kind ${fixture.kind}.`);
  }
  configurePersonalBase(fixture);
}

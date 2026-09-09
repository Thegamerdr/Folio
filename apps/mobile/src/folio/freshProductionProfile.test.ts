import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPersistBlob,
  getState,
  hydrateFromBlob,
  resetAll,
  resetToEmpty,
  setCurrentBalance,
  setOnboarding,
  setPartial,
  hasConfiguredMoneyPicture,
  type AppState,
} from './store';
import { buildFinancialPlanFromState, toFinancialPlanInput } from './lib/financialPlan';
import { PERSISTED_WORKSPACE_ROW_COLLECTIONS } from './lib/workspaceRows';
import { resetSampleFixture } from './test/sampleFixture';
import { reanchorRenewals } from './lib/renewalMath';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function expectEmptyFinancialState(state: AppState): void {
  for (const collection of PERSISTED_WORKSPACE_ROW_COLLECTIONS) {
    if (collection !== 'accounts') expect(state[collection] ?? [], collection).toEqual([]);
  }
  // Main is a neutral account shell required by the canonical storage binding, with no money.
  expect(state.accounts).toHaveLength(1);
  expect(state.accounts?.[0]).toMatchObject({ name: 'Main', balanceMinor: 0, isLiability: false });
  expect(state.currentBalance.amount).toBe(0);
  expect(state.currentBalance.source).not.toBe('sample');
  expect(state.currentBalance.confidence).not.toBe('sample');
  expect(state.onboarding.monthlyIncome).toBe(0);
  expect(state.bufferAmount).toBe(0);
  expect(state.modeExtras).toEqual({});
  expect(state.subPaused).toEqual({});
  expect(state.subOverrides).toEqual({});
  expect(state.spendHold).toBeNull();
  expect(state.merchantCategories).toEqual({});
  expect(state.readerCandidates).toEqual([]);
  expect(hasConfiguredMoneyPicture(state)).toBe(false);
  const input = toFinancialPlanInput(state, { now: NOW, horizonDays: 35 });
  expect(input.accounts).toEqual({ main: 0 });
  expect(input.income).toEqual([]);
  expect(input.commitments).toEqual([]);
  expect(input.debts).toEqual([]);
  expect(input.livingCosts).toEqual([]);
  expect(input.bufferMinor).toBe(0);
  const plan = buildFinancialPlanFromState(state, { now: NOW, horizonDays: 35 });
  expect(plan.safeToSpendMinor).toBe(0);
  expect(plan.shortfallMinor).toBe(0);
  expect(plan.protectedBeforeIncomeMinor).toBe(0);
}

beforeEach(() => resetAll());

describe('production profile data hygiene', () => {
  it('boots the production module with zero financial entities and no artificial plan', async () => {
    vi.resetModules();
    const freshModule = await import('./store');
    expect(freshModule.getState().onboarding.done).toBe(false);
    expectEmptyFinancialState(freshModule.getState());
  });

  it.each(Array.from({ length: 13 }, (_, index) => index + 1))(
    'hydrates missing financial slots at schema v%i without inventing any records',
    (schemaVersion) => {
      hydrateFromBlob(JSON.stringify({ schemaVersion }));
      expectEmptyFinancialState(getState());
    },
  );

  it('keeps future-schema recovery empty rather than publishing prototype defaults', () => {
    hydrateFromBlob(JSON.stringify({ schemaVersion: 999, currentBalance: { amount: 99999 } }));
    expectEmptyFinancialState(getState());
  });

  it('calculates only explicitly entered manual money and preserves it through a cold module restart', async () => {
    setOnboarding({ done: true, name: 'Manual setup', payday: 28, monthlyIncome: 1000 });
    setCurrentBalance({ amount: 500, source: 'user-entered', confidence: 'corrected' });
    setPartial({
      bufferAmount: 50,
      subs: [
        {
          name: 'Real rent',
          cost: 100,
          nextRenewalDaysAway: 3,
          nextRenewalISO: '2026-09-12',
          obligationAnchorISO: '2026-09-12',
          lastUsedDaysAgo: 0,
          usesPerMonth: 0,
        },
      ],
    });
    const disk = getPersistBlob();
    const before = buildFinancialPlanFromState(getState(), { now: NOW, horizonDays: 35 });
    expect(before.safeToSpendMinor).toBe(35000);
    expect(before.shortfallMinor).toBe(0);
    expect(before.nextIncomeDate).toBe('2026-09-28');
    expect(getState().transactions).toEqual([]);
    vi.resetModules();
    const restarted = await import('./store');
    restarted.hydrateFromBlob(disk);
    const after = restarted.getState();
    expect(after.subs.map((sub) => sub.name)).toEqual(['Real rent']);
    expect(after.debts).toEqual([]);
    expect(after.pots).toEqual([]);
    expect(after.plans).toEqual([]);
    expect(after.transactions).toEqual([]);
    expect(after.currentBalance.amount).toBe(500);
    expect(buildFinancialPlanFromState(after, { now: NOW, horizonDays: 35 }).safeToSpendMinor).toBe(
      35000,
    );
  });

  it.each(['resetAll', 'resetToEmpty'] as const)(
    '%s clears all fixture money and restart cannot reseed it',
    (reset) => {
      resetSampleFixture();
      setPartial({
        modeExtras: { reset: 70 },
        spendHold: {
          start: '2026-09-09',
          end: '2026-09-12',
          dailyCap: 10,
          setAt: NOW.toISOString(),
        },
      });
      if (reset === 'resetAll') resetAll();
      else resetToEmpty();
      expectEmptyFinancialState(getState());
      const disk = getPersistBlob();
      hydrateFromBlob(disk);
      expectEmptyFinancialState(getState());
    },
  );

  it('preserves companion preferences, chosen mode, purchases and allowance while clearing financial history', () => {
    setPartial({
      moneyMode: 'stability',
      lens: {
        plusUnlocked: true,
        proUnlocked: false,
        trialCycleId: 'old-cycle',
        trialEndedCycleId: null,
        trialEndAcknowledged: false,
      },
      melo: {
        quietMode: true,
        wardrobe: ['scarf'],
        tone: 'honest',
        soundEnabled: true,
        preferredPosition: 'left',
      },
      aiReads: { monthKey: '2026-09', used: 3 },
      aiReadCache: { 'financial-document': { stale: 'private data' } } as never,
      oneMoveHistory: [{ key: 'old-financial-signal', shownAt: NOW.toISOString() } as never],
    });
    const before = getState();
    resetToEmpty();
    hydrateFromBlob(getPersistBlob());
    expectEmptyFinancialState(getState());
    expect(getState().moneyMode).toBe('stability');
    expect(getState().melo).toEqual(before.melo);
    expect(getState().lens).toMatchObject({
      plusUnlocked: true,
      proUnlocked: false,
      trialCycleId: null,
    });
    expect(getState().aiReads).toEqual({ monthKey: '2026-09', used: 3 });
    expect(getState().aiReadCache).toEqual({});
    expect(getState().oneMoveHistory).toEqual([]);
  });

  it('removes old anchored sample subscriptions and untouched migrated income without losing a real same-name bill', () => {
    resetSampleFixture();
    const legacy = getState();
    const anchored = reanchorRenewals(legacy.subs, '2026-07-01').items;
    setPartial({
      subs: [
        ...anchored,
        {
          name: 'Spotify',
          cost: 11,
          nextRenewalDaysAway: 3,
          nextRenewalISO: '2026-09-12',
          lastUsedDaysAgo: 0,
          usesPerMonth: 0,
        },
      ],
      incomeSources: [
        {
          id: 'income-migrated-pay',
          label: 'Pay',
          cadence: 'monthly',
          dayOfMonth: 25,
          amount: 2180,
          source: 'onboarding',
        },
      ],
      potLedger: [
        {
          id: 'pl-backfill-holiday',
          potId: 'holiday',
          at: '2026-06-01T00:00:00.000Z',
          kind: 'deposit',
          amount: 420,
          source: 'backfill',
        },
      ],
    });
    hydrateFromBlob(getPersistBlob());
    expect(getState().subs).toHaveLength(1);
    expect(getState().subs[0]).toMatchObject({ name: 'Spotify', cost: 11, usesPerMonth: 0 });
    expect(getState().incomeSources).toEqual([]);
    expect(getState().onboarding.monthlyIncome).toBe(0);
    expect(getState().potLedger).toEqual([]);
    expect(getState().cycles).toEqual([]);
    expect(getState().transactions).toEqual([]);
    expect(getState().currentBalance.amount).toBe(0);
    hydrateFromBlob(getPersistBlob());
    expect(getState().subs).toHaveLength(1);
  });

  it('keeps an explicitly paused same-shaped subscription through expiry and repeated restarts', () => {
    resetSampleFixture();
    const spotify = getState().subs.find((sub) => sub.name === 'Spotify')!;
    setPartial({
      subs: [
        { ...spotify, pausedUntil: '2026-01-02', pausedAt: '2026-01-01', pauseReason: 'My choice' },
      ],
      subPaused: { Spotify: true },
    });
    hydrateFromBlob(getPersistBlob());
    expect(getState().subs).toHaveLength(1);
    expect(getState().subs[0]?.autoResume).toBe('prompt');
    hydrateFromBlob(getPersistBlob());
    expect(getState().subs).toHaveLength(1);
    expect(getState().subs[0]?.name).toBe('Spotify');
  });

  it('preserves an explicit protective buffer in a partly configured real profile with leftover samples', () => {
    resetSampleFixture();
    setCurrentBalance({ amount: 500, source: 'user-entered', confidence: 'corrected' });
    setPartial({ bufferAmount: 100 });
    hydrateFromBlob(getPersistBlob());
    expect(getState().currentBalance.amount).toBe(500);
    expect(getState().bufferAmount).toBe(100);
    expect(getState().subs).toEqual([]);
    expect(getState().debts).toEqual([]);
  });

  it('does not manufacture historical deposits or income while upgrading an untouched v1 sample', () => {
    resetSampleFixture();
    const legacy: Record<string, unknown> = { ...getState(), schemaVersion: 1 };
    delete legacy.potLedger;
    delete legacy.incomeSources;
    hydrateFromBlob(JSON.stringify(legacy));
    expectEmptyFinancialState(getState());
  });

  it('keeps visual fixture generators outside the production import graph', () => {
    const root = resolve(process.cwd(), 'apps/mobile');
    function inspect(directory: string): void {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!['test', '__tests__', '__fixtures__'].includes(entry.name)) inspect(path);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
          expect(readFileSync(path, 'utf8'), path).not.toMatch(
            /from\s+['"][^'"]*test\/sampleFixture['"]/,
          );
        }
      }
    }
    inspect(join(root, 'src'));
    inspect(join(root, 'app'));
    expect(readFileSync(join(root, 'src/folio/store.ts'), 'utf8')).not.toContain(
      'seedTransactions',
    );
  });
});

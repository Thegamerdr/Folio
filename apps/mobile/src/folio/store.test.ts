// Folio data-spine tests — pure-logic coverage for the RN store port
// (apps/mobile/src/folio/store.ts).
//
// The store is a module-level singleton (in-memory persisted blob, no DOM),
// so each test starts from a known clean seed via `resetAll()` in beforeEach.
// We assert only the deterministic logic: ordering + caps, pause toggles,
// reset semantics, Melo tool matching/guards/undo, fastForwardMonth
// determinism, transaction cap, and that seeding happens only on empty.
//
// Node-safe: touches only the store module (no react-native runtime, no DOM),
// so it is a plain `.test.ts` collected by the apps/**/*.test.ts runner.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type Account,
  type CycleRecord,
  type IncomeSource,
  type Pot,
  type Transaction,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_ACCOUNT_ID,
  accountIdOf,
  addAccount,
  addCardPayoffDetails,
  addCycle,
  addDebt,
  addEvidenceDocument,
  addIgnoredBankExternalId,
  addIgnoredReviewSig,
  addStatementAsHistory,
  addToPot,
  addTransaction,
  addTransactionsBatch,
  applyMeloTool,
  attachEvidenceDocumentToTransaction,
  bankTransactions,
  bankAnalyticsTransactions,
  borrowFromPot,
  clearReaderCandidates,
  clearReviewQueue,
  completePaydayRitualMelo,
  consumeLoadDegraded,
  createEmptyWorkspacePartition,
  currentFinancialDate,
  deleteBankImportedHistory,
  dismissBillSignal,
  dismissIncomeSignal,
  detachEvidenceDocumentFromTransaction,
  editTransaction,
  endLensTrial,
  enqueueReviewItems,
  fastForwardMonth,
  forgetMerchantCategory,
  getPersistBlob,
  getState,
  getWorkspaceRowRepository,
  hasConfiguredMoneyPicture,
  hasAnyUserData,
  hydrateFromBlob,
  isBankTxn,
  isRealUser,
  logDebtPayment,
  linkOwnAccountTransfer,
  markTransactionDeclined,
  markTransactionDuplicate,
  matchMeloTool,
  purgeSeedIfReal,
  stripSeedData,
  payCreditCardFromBank,
  pauseMany,
  queueInputFromCandidates,
  rememberMerchantCategory,
  recordWorkspaceOwnerTransferLeg,
  recordTransactionRefund,
  recordTransactionReversal,
  recordMaterialDecision,
  restoreBackupFromBlob,
  removeEvidenceDocument,
  removeIncomeSource,
  removeTransaction,
  renameAccount,
  refreshBusinessMeloProgress,
  reanchorSubRenewals,
  resetAll,
  resetToEmpty,
  resolveReviewItem,
  rollbackWorkspaceOwnerTransferLeg,
  reviewCandidateSig,
  selectBankBalanceMinor,
  selectCreditAvailability,
  selectNetPositionMinor,
  selectOverdraftSummary,
  setAccountFacilities,
  setAccountBalance,
  setCurrentBalance,
  setIncomeSources,
  setModeExtra,
  setOnboarding,
  setPartial,
  setPotAllowNegative,
  setPots,
  setSpendHold,
  startLensTrial,
  setReaderCandidates,
  setReaderClosingBalance,
  setTightPointGoal,
  sweepReviewQueue,
  sweepAutoResumeNow,
  syncHistoryCycles,
  togglePaused,
  totalDebtMinor,
  undoDebtPayment,
  updateBusinessOperations,
  updateAccountPolicy,
  upsertIncomeSource,
} from './store';
import { createWorkspaceId } from '@folio/domain';
import type { CandidateMoneyItem } from './lib/importSheet';
import { subscribeMeloReaction, type MeloReactionPayload } from './lib/melo/reactionBus';
import {
  createBusinessWorkspace,
  createPersonalWorkspaceRoot,
  PERSONAL_WORKSPACE_ID,
  PERSONAL_WORKSPACE_SUBKEY_ID,
} from './lib/workspaceRoot';
import { PERSISTED_WORKSPACE_ROW_COLLECTIONS } from './lib/workspaceRows';

beforeEach(() => {
  // Clean, known seed before every test (defaults + seeded transactions).
  resetAll();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('workspace-local financial dates', () => {
  it('resolves BST and GMT boundaries from the workspace timezone, not the host or UTC day', () => {
    expect(currentFinancialDate(new Date('2026-08-16T23:30:00.000Z'))).toBe('2026-08-17');
    expect(currentFinancialDate(new Date('2026-08-16T00:30:00.000Z'))).toBe('2026-08-16');
    expect(currentFinancialDate(new Date('2026-12-31T23:30:00.000Z'))).toBe('2026-12-31');
  });

  it('reanchors and auto-resumes subscriptions on the London day after BST midnight', () => {
    setPartial({
      subs: [
        {
          name: 'Boundary sub',
          cost: 10,
          nextRenewalDaysAway: 99,
          nextRenewalISO: '2026-08-17',
          pausedUntil: '2026-08-17',
          lastUsedDaysAgo: 0,
          usesPerMonth: 1,
        },
      ],
      subPaused: { 'Boundary sub': true },
    });
    const today = currentFinancialDate(new Date('2026-08-16T23:30:00.000Z'));

    reanchorSubRenewals(today);
    expect(getState().subs[0]?.nextRenewalDaysAway).toBe(0);
    expect(sweepAutoResumeNow(today)).toEqual(['Boundary sub']);
    expect(getState().subPaused['Boundary sub']).toBe(false);
  });
});

function owned<T extends object>(row: T): T & { workspaceId: typeof PERSONAL_WORKSPACE_ID } {
  return { ...row, workspaceId: PERSONAL_WORKSPACE_ID };
}

function activateMeloBusinessWorkspace(options?: { ltd?: boolean }) {
  resetToEmpty();
  const personalRoot = createPersonalWorkspaceRoot();
  const businessId = createWorkspaceId(
    options?.ltd ? 'workspace_melo_tools_ltd' : 'workspace_melo_tools_sole',
  );
  const businessWorkspace = createBusinessWorkspace({
    id: businessId,
    name: options?.ltd ? 'Melo Tools Ltd' : 'Melo Tools Studio',
    encryptedSubkeyId: options?.ltd
      ? 'workspace-subkey-business-melo-tools-ltd-v1'
      : 'workspace-subkey-business-melo-tools-sole-v1',
  });
  const partition = createEmptyWorkspacePartition(
    {
      workspaces: [...personalRoot.workspaces, businessWorkspace],
      activeWorkspaceId: businessId,
      dataWorkspaceId: businessId,
    },
    businessId,
    '2026-07-19T12:00:00.000Z',
  );
  hydrateFromBlob(JSON.stringify(partition), businessId);
  const account = addAccount({
    name: 'Business current',
    kind: 'bank',
    balanceMinor: 1_000,
  });
  updateBusinessOperations({
    entity: options?.ltd
      ? {
          kind: 'ltd',
          companyName: 'Melo Tools Ltd',
          yearEnd: '2027-03-31',
          taxRegion: 'england-ni',
          directors: [{ id: 'director-avery', name: 'Avery' }],
          shareholders: [{ id: 'shareholder-avery', name: 'Avery', shares: 100 }],
          vat: { registered: false },
          createdAt: '2026-07-19T12:00:00.000Z',
        }
      : {
          kind: 'sole-trader',
          tradingName: 'Melo Tools Studio',
          taxRegion: 'england-ni',
          studentLoanPlans: [],
          vat: { registered: false },
          createdAt: '2026-07-19T12:00:00.000Z',
        },
    clients: [
      {
        id: 'client-acme',
        name: 'Acme',
        createdAt: '2026-07-19T12:00:00.000Z',
      },
    ],
    ...(options?.ltd ? { ytdProfitMinor: 100_000 } : {}),
  });
  return { account, businessId };
}

// ---------------------------------------------------------------------------
// addCycle — newest-first ordering + 24-cap
// ---------------------------------------------------------------------------
describe('addCycle', () => {
  const cyc = (label: string): CycleRecord => ({
    closedAt: `2026-07-${label.padStart(2, '0')}`,
    label,
    spare: 100,
    tightPoint: 40,
    setAside: 50,
    note: `note ${label}`,
  });

  it('prepends the new cycle so history is newest-first', () => {
    const before = getState().cycles.length;
    addCycle(cyc('1'));
    const cycles = getState().cycles;

    expect(cycles.length).toBe(before + 1);
    expect(cycles[0]!.label).toBe('1');
  });

  it('updates only the active workspace progression at close and ritual completion', () => {
    addCycle(cyc('1'));
    expect(getState().stage.current).toBe('ash');
    expect(getState().streak).toMatchObject({ count: 1, bestCount: 1 });

    completePaydayRitualMelo(new Date('2026-07-01T12:00:00.000Z'));
    expect(getState().stage).toMatchObject({
      current: 'ember',
      enteredAt: '2026-07-01T12:00:00.000Z',
      lastRebirthAt: '2026-07-01T12:00:00.000Z',
    });
  });

  it('caps history at 24 cycles, dropping the oldest', () => {
    // Seed starts with 2 cycles; add 30 more → must clamp to 24, newest kept.
    for (let i = 1; i <= 30; i++) addCycle(cyc(String(i)));
    const cycles = getState().cycles;

    expect(cycles.length).toBe(24);
    expect(cycles[0]!.label).toBe('30'); // most recent at the head
  });

  it('clears nextYouNote when a cycle closes', () => {
    setPartial({ nextYouNote: 'past-you wrote this' });
    addCycle(cyc('1'));

    expect(getState().nextYouNote).toBe('');
  });

  it('earns live Lovable companion touches from this workspace cycle history', () => {
    setPartial({ cycles: [], melo: { quietMode: false, wardrobe: [], tone: 'calm' } });
    addCycle(cyc('1'));
    expect(getState().melo?.wardrobe).toEqual(['scarf']);

    addCycle(cyc('2'));
    addCycle(cyc('3'));
    expect(getState().melo?.wardrobe).toEqual(['scarf']);
  });
});

// ---------------------------------------------------------------------------
// pauseMany / togglePaused
// ---------------------------------------------------------------------------
describe('pauseMany / togglePaused', () => {
  it('pauseMany sets the given subs to the requested value', () => {
    pauseMany(['Spotify', 'Netflix'], true);
    const paused = getState().subPaused;

    expect(paused.Spotify).toBe(true);
    expect(paused.Netflix).toBe(true);
  });

  it('pauseMany can un-pause a batch', () => {
    pauseMany(['Spotify', 'Netflix'], true);
    pauseMany(['Spotify', 'Netflix'], false);
    const paused = getState().subPaused;

    expect(paused.Spotify).toBe(false);
    expect(paused.Netflix).toBe(false);
  });

  it('togglePaused flips when no explicit value is given', () => {
    expect(!!getState().subPaused.Notion).toBe(false);
    togglePaused('Notion');
    expect(getState().subPaused.Notion).toBe(true);
    togglePaused('Notion');
    expect(getState().subPaused.Notion).toBe(false);
  });

  it('togglePaused honours an explicit value', () => {
    togglePaused('iCloud', true);
    expect(getState().subPaused.iCloud).toBe(true);
    togglePaused('iCloud', true); // idempotent at the same value
    expect(getState().subPaused.iCloud).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// timelineEvents — @rn-engine timeline-verbs. togglePaused logs sub-paused/sub-resumed;
// addIgnoredReviewSig logs review-ignored (only when given a subject). Newest first, capped at 200.
// ---------------------------------------------------------------------------
describe('timelineEvents log', () => {
  it('togglePaused logs a sub-paused event when a sub is paused', () => {
    togglePaused('Spotify', true);
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
    expect(events[0]!.kind).toBe('sub-paused');
    expect(events[0]!.subject).toBe('Spotify');
    expect(typeof events[0]!.at).toBe('string');
  });

  it('togglePaused logs a sub-resumed event when a paused sub is resumed', () => {
    togglePaused('Spotify', true);
    togglePaused('Spotify', false);
    const events = getState().timelineEvents ?? [];
    // Newest first — the resume is index 0, the pause is index 1.
    expect(events[0]!.kind).toBe('sub-resumed');
    expect(events[0]!.subject).toBe('Spotify');
    expect(events[1]!.kind).toBe('sub-paused');
  });

  it('togglePaused logs nothing when the value does not actually change', () => {
    togglePaused('Spotify', true);
    togglePaused('Spotify', true); // idempotent no-op
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
  });

  it('addIgnoredReviewSig logs a review-ignored event only when given a subject', () => {
    addIgnoredReviewSig('tesco|4210|2026-07-01', 'Tesco');
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
    expect(events[0]!.kind).toBe('review-ignored');
    expect(events[0]!.subject).toBe('Tesco');
  });

  it('addIgnoredReviewSig logs nothing when no subject is given', () => {
    addIgnoredReviewSig('tesco|4210|2026-07-01');
    expect((getState().timelineEvents ?? []).length).toBe(0);
  });

  it('addIgnoredReviewSig is idempotent by signature — a repeat call logs nothing further', () => {
    addIgnoredReviewSig('tesco|4210|2026-07-01', 'Tesco');
    addIgnoredReviewSig('tesco|4210|2026-07-01', 'Tesco');
    expect((getState().timelineEvents ?? []).length).toBe(1);
  });

  it('caps the log at 200, newest first', () => {
    for (let i = 0; i < 205; i++) togglePaused(`Sub${i}`, true);
    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(200);
    expect(events[0]!.subject).toBe('Sub204');
  });
});

// ---------------------------------------------------------------------------
// Melo reaction emission — addToPot (goal-crossing thresholds) and
// togglePaused (pause/resume whisper). RN port of the web's reactionBus emits
// (folio-melo lib/store.ts). The store emits via a dynamic `import(...)`, so
// each assertion awaits a microtask flush before checking the captured payload.
// ---------------------------------------------------------------------------
describe('Melo reaction emission', () => {
  // The store emits reactions via a dynamic `import('./lib/melo/reactionBus')`, which resolves on a
  // later microtask than a plain `Promise.resolve()` chain. Rather than guess the exact tick count,
  // subscribe for the lifetime of the test and let each `it` block use its own channel/key scoping
  // (or a fresh `resetAll()` beforeEach) to avoid cross-test bleed.
  function captureOnce(channel: string): { payload: MeloReactionPayload | null } {
    const box: { payload: MeloReactionPayload | null } = { payload: null };
    subscribeMeloReaction(channel, (p) => {
      box.payload = p;
    });
    return box;
  }

  // Flushes the dynamic `import(...)` microtask queue the store's emit helpers schedule.
  async function flushReactionImport(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('addToPot emits a "full" cheer reaction the moment a deposit tips a pot over its goal', async () => {
    // Holiday pot seeds at 420/1200 (35% — below both thresholds).
    setPots((ps) => ps.map((p) => (p.id === 'holiday' ? { ...p, saved: 1190, goal: 1200 } : p)));
    const box = captureOnce('pots-inline');

    addToPot('holiday', 20); // 1190 -> 1210, crosses the 100% line
    await flushReactionImport();

    expect(box.payload?.mood).toBe('cheer');
    expect(box.payload?.pose).toBe('safe');
    expect(box.payload?.key).toBe('holiday');
    expect(box.payload?.line).toBe('Holiday is full. Small yes.');
  });

  it('addToPot emits a "halfway" curious reaction the moment a deposit crosses 50%', async () => {
    setPots((ps) => ps.map((p) => (p.id === 'christmas' ? { ...p, saved: 140, goal: 300 } : p)));
    const box = captureOnce('pots-inline');

    addToPot('christmas', 20); // 140 -> 160, crosses the 50% line (150)
    await flushReactionImport();

    expect(box.payload?.mood).toBe('curious');
    expect(box.payload?.pose).toBe('none');
    expect(box.payload?.key).toBe('christmas');
    expect(box.payload?.line).toBe('Halfway. Quietly working.');
  });

  it('addToPot emits nothing when the deposit does not cross a threshold', async () => {
    setPots((ps) => ps.map((p) => (p.id === 'buffer' ? { ...p, saved: 10, goal: 500 } : p)));
    const box = captureOnce('pots-inline');

    addToPot('buffer', 5); // 10 -> 15, nowhere near 50% or 100%
    await flushReactionImport();

    expect(box.payload).toBe(null);
  });

  it('togglePaused pausing a sub emits a calm "paused" whisper on subs-inline', async () => {
    const box = captureOnce('subs-inline');

    togglePaused('Spotify', true);
    await flushReactionImport();

    expect(box.payload?.mood).toBe('calm');
    expect(box.payload?.pose).toBe('safe');
    expect(box.payload?.key).toBe('Spotify');
    expect(box.payload?.line).toBe("Spotify paused for one cycle. I'll resume it after.");
  });

  it('togglePaused resuming a sub emits a curious "back on" whisper on subs-inline', async () => {
    togglePaused('Spotify', true);
    await flushReactionImport(); // let the setup call's own emit resolve before we start watching
    const box = captureOnce('subs-inline');

    togglePaused('Spotify', false);
    await flushReactionImport();

    expect(box.payload?.mood).toBe('curious');
    expect(box.payload?.pose).toBe('check');
    expect(box.payload?.line).toBe("Spotify back on. I'll watch the timing.");
  });

  it('togglePaused emits nothing when the value does not actually change', async () => {
    togglePaused('Spotify', true);
    await flushReactionImport(); // let the setup call's own emit resolve before we start watching
    const box = captureOnce('subs-inline');

    togglePaused('Spotify', true); // idempotent — no flip
    await flushReactionImport();

    expect(box.payload).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// borrowFromPot — ENGINES.md § 4/6. Pulls money OUT of a pot for a Shortfall
// draw; refuses to go negative unless the pot opted in via allowNegative.
// ---------------------------------------------------------------------------
describe('borrowFromPot', () => {
  it('lowers the pot balance and writes a borrow ledger entry', () => {
    const before = getState().pots.find((p) => p.id === 'holiday')!.saved;

    const applied = borrowFromPot('holiday', 50, 'shortfall-borrow');

    expect(applied).toBe(true);
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before - 50);
    const entry = getState().potLedger[0]!;
    expect(entry.kind).toBe('borrow');
    expect(entry.potId).toBe('holiday');
    expect(entry.amount).toBe(50);
    expect(entry.source).toBe('shortfall-borrow');
  });

  it('is a no-op on a non-positive amount', () => {
    const before = getState().pots.find((p) => p.id === 'holiday')!.saved;
    expect(borrowFromPot('holiday', 0)).toBe(false);
    expect(borrowFromPot('holiday', -10)).toBe(false);
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before);
  });

  it('is a no-op for an unknown pot id', () => {
    expect(borrowFromPot('does-not-exist', 10)).toBe(false);
  });

  it('refuses to push a hard-capped pot below zero', () => {
    // Christmas pot seeds at 60 saved — asking for more than that must fail.
    const before = getState().pots.find((p) => p.id === 'christmas')!.saved;
    expect(before).toBeLessThan(100);

    const applied = borrowFromPot('christmas', 100);

    expect(applied).toBe(false);
    expect(getState().pots.find((p) => p.id === 'christmas')!.saved).toBe(before);
  });

  it('allows dipping below zero once the pot opts in via allowNegative', () => {
    setPotAllowNegative('christmas', true);
    const before = getState().pots.find((p) => p.id === 'christmas')!.saved;

    const applied = borrowFromPot('christmas', before + 40);

    expect(applied).toBe(true);
    expect(getState().pots.find((p) => p.id === 'christmas')!.saved).toBe(-40);
  });

  it('never silently no-ops the way a negative addToPot call would', () => {
    // Regression guard for the ShortfallScreen bug: addToPot's `amount > 0` guard makes a
    // negative-amount call a silent no-op, so borrowFromPot must be the write path instead.
    const before = getState().pots.find((p) => p.id === 'holiday')!.saved;
    addToPot('holiday', -30, 'shortfall-borrow'); // the old, broken call shape
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before); // unchanged (no-op)

    const applied = borrowFromPot('holiday', 30, 'shortfall-borrow'); // the correct call shape
    expect(applied).toBe(true);
    expect(getState().pots.find((p) => p.id === 'holiday')!.saved).toBe(before - 30);
  });

  it('persists a material pot receipt awaiting outcome across app restart', () => {
    addToPot('holiday', 20, 'manual');
    const entry = getState().decisionLedger?.[0];
    expect(entry).toMatchObject({
      decisionType: 'pot-contribution',
      status: 'awaiting-outcome',
      workspaceKind: 'personal',
    });

    const blob = getPersistBlob();
    resetToEmpty();
    hydrateFromBlob(blob);

    expect(getState().decisionLedger?.[0]?.id).toBe(entry?.id);
    expect(getState().decisionLedger?.[0]?.status).toBe('awaiting-outcome');
  });
});

// ---------------------------------------------------------------------------
// modeExtras — onboarding follow-up answers persist per mode (2026-07-10 audit fix: 8 of 10
// modes' answers were captured on-screen and then silently dropped).
// ---------------------------------------------------------------------------
describe('setModeExtra', () => {
  it('records the answer per mode without touching other modes, rounding and flooring at 0', () => {
    resetAll();
    setModeExtra('debt', 12_400.6);
    setModeExtra('growth', 250);
    setModeExtra('reset', -10);

    expect(getState().modeExtras).toEqual({ debt: 12_401, growth: 250, reset: 0 });
  });

  it('re-answering one mode never wipes another mode’s declaration', () => {
    resetAll();
    setModeExtra('debt', 5000);
    setModeExtra('debt', 6000);

    expect(getState().modeExtras).toEqual({ debt: 6000 });
  });

  it('round-trips through the persistence blob', () => {
    resetAll();
    setModeExtra('planning', 8000);
    const blob = getPersistBlob();

    resetToEmpty();
    expect(getState().modeExtras).toEqual({});

    hydrateFromBlob(blob);
    expect(getState().modeExtras).toEqual({ planning: 8000 });
  });
});

// ---------------------------------------------------------------------------
// resetAll — clears tightPointGoal (and other state) back to defaults
// ---------------------------------------------------------------------------
describe('resetAll', () => {
  it('clears tightPointGoal back to null', () => {
    setTightPointGoal(150);
    expect(getState().tightPointGoal).toBe(150);

    resetAll();
    expect(getState().tightPointGoal).toBe(null);
  });

  it('restores the default pots and re-seeds transactions', () => {
    setPots([]);
    expect(getState().pots.length).toBe(0);

    resetAll();
    expect(getState().pots.length).toBe(3);
    expect(getState().transactions.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// resetToEmpty — CLEAN-EMPTY reset (no demo reseed), keeps only onboarding.done +
// schemaVersion; hasAnyUserData distinguishes a real app from a demo one.
// ---------------------------------------------------------------------------
describe('resetToEmpty', () => {
  it('wipes every user-data slot to a genuinely empty state', () => {
    // Start from the demo seed (resetAll runs in beforeEach) + add some more data.
    setPartial({
      subPaused: { Spotify: true },
      subOverrides: { Netflix: 2 },
      potLedger: [
        {
          id: 'pl-1',
          potId: 'holiday',
          at: '2026-06-01T00:00:00.000Z',
          kind: 'deposit',
          amount: 10,
          source: 'manual',
        },
      ],
      calendarEvents: [{ id: 'e1', date: '2026-07-01', kind: 'out', title: 'Rent', amount: -900 }],
      edits: [],
    });

    resetToEmpty();
    const s = getState();

    expect(s.transactions).toEqual([]);
    expect(s.pots).toEqual([]);
    expect(s.subs).toEqual([]);
    expect(s.subPaused).toEqual({});
    expect(s.subOverrides).toEqual({});
    expect(s.cycles).toEqual([]);
    expect(s.edits).toEqual([]);
    expect(s.calendarEvents).toEqual([]);
    expect(s.potLedger).toEqual([]);
    expect(s.readerCandidates).toEqual([]);
    expect(s.nextYouNote).toBe('');
    expect(s.tightPointGoal).toBe(null);
  });

  it('does NOT reseed any sample/demo data', () => {
    resetToEmpty();
    const s = getState();
    // resetAll seeds 3 pots + a non-empty seeded transaction list; resetToEmpty must not.
    expect(s.pots.length).toBe(0);
    expect(s.transactions.length).toBe(0);
    expect(s.subs.length).toBe(0);
    expect(s.cycles.length).toBe(0);
  });

  it('sets a neutral, honest empty balance (£0, not a sample source)', () => {
    resetToEmpty();
    const bal = getState().currentBalance;
    expect(bal.amount).toBe(0);
    expect(bal.source).not.toBe('sample'); // a chosen empty, not seeded demo data
    expect(bal.confidence).not.toBe('sample');
    expect(typeof bal.setAt).toBe('string');
    expect(bal.setAt.length).toBeGreaterThan(0);
  });

  it('forces onboarding.done true so a returning clean user is NOT re-onboarded', () => {
    setPartial({ onboarding: { done: false, name: 'Ada', payday: 25, monthlyIncome: 2180 } });
    resetToEmpty();
    expect(getState().onboarding.done).toBe(true);
  });

  it('clears identifying onboarding values — no name, payday or income survives', () => {
    // Live regression (owner's phone, 2026-07-11): after "Clear to empty" the Today screen
    // still showed the old monthly income as "coming in" — onboarding.monthlyIncome survived
    // the wipe. A later release drill proved name and payday were also retained. All three are user
    // data; only the non-identifying completion flag may remain after a local clear.
    setPartial({ onboarding: { done: true, name: 'Ada', payday: 12, monthlyIncome: 2533 } });
    resetToEmpty();
    const onboarding = getState().onboarding;
    expect(onboarding.monthlyIncome).toBe(0);
    expect(onboarding.name).toBe('');
    expect(onboarding.payday).toBe(25);
    expect(onboarding.done).toBe(true);
    expect(getState().incomeSources).toEqual([]);
  });

  it('preserves schemaVersion', () => {
    const before = getState().schemaVersion;
    resetToEmpty();
    expect(getState().schemaVersion).toBe(before);
  });

  it('is immutable — produces a new state object, never mutating the previous one', () => {
    const prev = getState();
    resetToEmpty();
    const next = getState();
    expect(next).not.toBe(prev); // brand-new object reference
    // The captured previous snapshot still has its demo data (was not mutated).
    expect(prev.pots.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// hasAnyUserData — true on a seeded/used app, false after a CLEAN-EMPTY reset
// ---------------------------------------------------------------------------
describe('hasAnyUserData', () => {
  it('is true on the seeded demo state (transactions + pots + subs + cycles)', () => {
    resetAll();
    expect(hasAnyUserData(getState())).toBe(true);
  });

  it('is false after resetToEmpty (a genuinely empty app)', () => {
    resetToEmpty();
    expect(hasAnyUserData(getState())).toBe(false);
  });

  it('is true if ANY one data slot is non-empty', () => {
    resetToEmpty();
    expect(hasAnyUserData(getState())).toBe(false);
    addTransaction({ merchant: 'Tesco', amount: -42.1, category: 'food', source: 'manual' });
    expect(hasAnyUserData(getState())).toBe(true);
  });
});

describe('hasConfiguredMoneyPicture', () => {
  it('is false after a local clear even though onboarding stays done and the £0 balance is non-sample', () => {
    resetToEmpty();

    expect(getState().onboarding.done).toBe(true);
    expect(getState().currentBalance.source).not.toBe('sample');
    expect(hasConfiguredMoneyPicture(getState())).toBe(false);
  });

  it('becomes true when a route-driving balance or income is present', () => {
    resetToEmpty();
    setCurrentBalance({ amount: 220, source: 'user-entered', confidence: 'rough' });
    expect(hasConfiguredMoneyPicture(getState())).toBe(true);

    resetToEmpty();
    setOnboarding({ monthlyIncome: 1_000 });
    expect(hasConfiguredMoneyPicture(getState())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Accounts (ACCOUNTS_MODEL.md P1) — migration synthesizes exactly one default
// bank account mirroring the legacy `currentBalance` scalar; accountIdOf
// defaults; multi-account bank-only sum excludes credit cards; net position
// subtracts liabilities. The single-account (migrated) case must be BEHAVIOR-
// PRESERVING: selectBankBalanceMinor() === the old currentBalance.amount,
// byte-for-byte.
// ---------------------------------------------------------------------------
describe('accounts (ACCOUNTS_MODEL.md P1)', () => {
  it('a fresh install (DEFAULTS/resetAll) has exactly one synthesized Main bank account', () => {
    resetAll();
    const accounts = getState().accounts ?? [];
    expect(accounts.length).toBe(1);
    expect(accounts[0]).toMatchObject({
      id: DEFAULT_ACCOUNT_ID,
      name: 'Main',
      kind: 'bank',
      isLiability: false,
    });
  });

  it('migration: a persisted blob predating `accounts` synthesizes one Main account mirroring currentBalance exactly', () => {
    resetAll();
    setCurrentBalance({ amount: 456.78, source: 'user-entered', confidence: 'rough' });
    const beforeBalance = getState().currentBalance;
    const preAccountsBlob = { ...getState() } as Record<string, unknown>;
    delete preAccountsBlob.accounts;
    hydrateFromBlob(JSON.stringify(preAccountsBlob));

    const accounts = getState().accounts ?? [];
    expect(accounts.length).toBe(1);
    expect(accounts[0]?.id).toBe(DEFAULT_ACCOUNT_ID);
    expect(accounts[0]?.balanceMinor).toBe(beforeBalance.amount);
    expect(accounts[0]?.balanceAsOfISO).toBe(beforeBalance.setAt);
  });

  it('migration preserves the EXACT prior balance — selectBankBalanceMinor equals the old currentBalance.amount byte-for-byte', () => {
    resetAll();
    setCurrentBalance({ amount: 1234.56, source: 'statement', confidence: 'statement-derived' });
    const expectedAmount = getState().currentBalance.amount;
    const preAccountsBlob = { ...getState() } as Record<string, unknown>;
    delete preAccountsBlob.accounts;
    hydrateFromBlob(JSON.stringify(preAccountsBlob));

    expect(selectBankBalanceMinor(getState())).toBe(expectedAmount);
  });

  it('a blob that already carries accounts keeps them intact across load (not re-synthesized)', () => {
    resetAll();
    const existing: Account[] = [
      {
        id: 'acct-custom',
        name: 'Monzo Current',
        kind: 'bank',
        isLiability: false,
        balanceMinor: 999,
        balanceAsOfISO: '2026-07-01T00:00:00.000Z',
        addedAt: '2026-07-01T00:00:00.000Z',
      },
    ];
    setPartial({ accounts: existing });
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    expect(getState().accounts).toEqual(existing.map(owned));
  });

  it('resetToEmpty synthesizes one (empty-balance) Main account, never zero accounts', () => {
    resetToEmpty();
    const accounts = getState().accounts ?? [];
    expect(accounts.length).toBe(1);
    expect(accounts[0]?.id).toBe(DEFAULT_ACCOUNT_ID);
    expect(accounts[0]?.balanceMinor).toBe(0);
  });

  it('accountIdOf defaults to DEFAULT_ACCOUNT_ID when a transaction has no accountId', () => {
    expect(accountIdOf({})).toBe(DEFAULT_ACCOUNT_ID);
  });

  it('accountIdOf returns the explicit accountId when set', () => {
    expect(accountIdOf({ accountId: 'acct-other' })).toBe('acct-other');
  });

  it('addAccount adds a new account and defaults isLiability from kind', () => {
    resetAll();
    const card = addAccount({ name: 'Amex Gold', kind: 'credit-card', balanceMinor: 200 });
    expect(card.isLiability).toBe(true);
    expect(card.balanceMinor).toBe(200);

    const savings = addAccount({ name: 'Savings pot', kind: 'savings' });
    expect(savings.isLiability).toBe(false);
    expect(savings.balanceMinor).toBe(0);

    const accounts = getState().accounts ?? [];
    expect(accounts.length).toBe(3); // Main + card + savings
  });

  it('normalises explicit GBP and rejects foreign accounts without mutating state', () => {
    resetToEmpty();
    const gbp = addAccount({ name: 'Savings', kind: 'savings', currency: ' gbp ' });
    expect(gbp.currency).toBe('GBP');

    const before = getState().accounts;
    expect(() =>
      addAccount({ name: 'Euro account', kind: 'bank', currency: 'EUR', balanceMinor: 9_999 }),
    ).toThrow(/GBP only/u);
    expect(getState().accounts).toEqual(before);
  });

  it('keeps restored foreign accounts visible but excludes them from every GBP money path', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 500, '2026-07-05T00:00:00.000Z');
    const main = getState().accounts?.find((account) => account.id === DEFAULT_ACCOUNT_ID)!;
    const foreign: Account = {
      ...main,
      id: 'acct-eur-legacy',
      name: 'Euro account',
      currency: 'EUR',
      balanceMinor: 9_999,
    };
    setPartial({ accounts: [main, foreign] });
    const blob = getPersistBlob();
    resetToEmpty();

    expect(hydrateFromBlob(blob)).toEqual({ status: 'applied' });
    expect(getState().accounts?.some((account) => account.id === foreign.id)).toBe(true);
    expect(selectBankBalanceMinor(getState())).toBe(500);
    expect(selectNetPositionMinor(getState())).toBe(500);
    expect(getState().currentBalance.amount).toBe(500);
    expect(setAccountBalance(foreign.id, 1)).toBe(false);
    expect(getState().accounts?.find((account) => account.id === foreign.id)?.balanceMinor).toBe(
      9_999,
    );

    const foreignTransaction = addTransaction({
      merchant: 'Foreign row',
      amount: -20,
      category: 'other',
      source: 'manual',
      accountId: foreign.id,
    });
    expect(bankTransactions(getState()).some((row) => row.id === foreignTransaction.id)).toBe(
      false,
    );
  });

  it('renameAccount updates the name and is a no-op for an unknown id', () => {
    resetAll();
    renameAccount(DEFAULT_ACCOUNT_ID, 'Monzo Current');
    expect(getState().accounts?.find((a) => a.id === DEFAULT_ACCOUNT_ID)?.name).toBe(
      'Monzo Current',
    );

    const before = getState().accounts;
    renameAccount('acct-does-not-exist', 'Whatever');
    expect(getState().accounts).toEqual(before);
  });

  it('setAccountBalance updates balance + balanceAsOfISO and is a no-op for an unknown id', () => {
    resetAll();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 555, '2026-07-05T00:00:00.000Z');
    const main = getState().accounts?.find((a) => a.id === DEFAULT_ACCOUNT_ID);
    expect(main?.balanceMinor).toBe(555);
    expect(main?.balanceAsOfISO).toBe('2026-07-05T00:00:00.000Z');

    const before = getState().accounts;
    setAccountBalance('acct-does-not-exist', 1, '2026-07-05T00:00:00.000Z');
    expect(getState().accounts).toEqual(before);
  });

  it('setAccountBalance on a bank account syncs the legacy currentBalance scalar (two-way sync invariant)', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 555, '2026-07-05T00:00:00.000Z', {
      source: 'statement',
      confidence: 'statement-derived',
    });

    const cb = getState().currentBalance;
    expect(cb.amount).toBe(555);
    expect(cb.source).toBe('statement');
    expect(cb.confidence).toBe('statement-derived');
    expect(cb.setAt).toBe('2026-07-05T00:00:00.000Z');
  });

  it('setAccountBalance scalar sync uses the bank-only SUM across accounts, defaulting provenance to corrected', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 700, '2026-07-05T00:00:00.000Z');
    const savings = addAccount({ name: 'Savings', kind: 'savings', balanceMinor: 0 });
    setAccountBalance(savings.id, 300, '2026-07-06T00:00:00.000Z');

    const cb = getState().currentBalance;
    expect(cb.amount).toBe(1000); // 700 + 300 — the same figure selectBankBalanceMinor reports
    expect(cb.amount).toBe(selectBankBalanceMinor(getState()));
    expect(cb.source).toBe('corrected');
  });

  it('setAccountBalance on a credit card never touches the currentBalance scalar (borrowing is not bank money)', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 1000, '2026-07-05T00:00:00.000Z');
    const cbBefore = getState().currentBalance;

    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 0 });
    setAccountBalance(card.id, 400, '2026-07-06T00:00:00.000Z');

    expect(getState().currentBalance).toEqual(cbBefore);
  });

  it('payCreditCardFromBank moves the currentBalance scalar with the bank side in the same write', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 1000, '2026-07-05T00:00:00.000Z');
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 500 });
    addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    payCreditCardFromBank(DEFAULT_ACCOUNT_ID, card.id, 200);

    expect(getState().currentBalance.amount).toBe(800);
    expect(getState().currentBalance.amount).toBe(selectBankBalanceMinor(getState()));
  });

  it('selectBankBalanceMinor sums only bank/savings/cash accounts, excluding credit cards', () => {
    resetAll();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 500, '2026-07-05T00:00:00.000Z');
    addAccount({ name: 'Savings', kind: 'savings', balanceMinor: 300 });
    addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 200 });

    expect(selectBankBalanceMinor(getState())).toBe(800); // 500 + 300, card excluded
  });

  it('selectNetPositionMinor subtracts liability (credit-card) balances', () => {
    resetAll();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 500, '2026-07-05T00:00:00.000Z');
    addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 200 });

    expect(selectNetPositionMinor(getState())).toBe(300); // 500 - 200
  });

  it('selectBankBalanceMinor and selectNetPositionMinor fall back to currentBalance.amount when accounts is empty/absent', () => {
    resetAll();
    setPartial({ accounts: [] });
    setCurrentBalance({ amount: 42, source: 'user-entered', confidence: 'rough' });

    expect(selectBankBalanceMinor(getState())).toBe(42);
    expect(selectNetPositionMinor(getState())).toBe(42);
  });

  it('setCurrentBalance keeps the default bank account in sync (legacy write path stays correct)', () => {
    resetAll();
    setCurrentBalance({ amount: 900, source: 'user-entered', confidence: 'statement-derived' });
    const main = getState().accounts?.find((a) => a.id === DEFAULT_ACCOUNT_ID);
    expect(main?.balanceMinor).toBe(900);
    expect(selectBankBalanceMinor(getState())).toBe(900);
  });

  describe('setCurrentBalance — multi-account bank total', () => {
    it('single account: behavior identical to before (currentBalance.amount === input)', () => {
      resetAll();
      setCurrentBalance({ amount: 456, source: 'user-entered', confidence: 'rough' });

      const main = getState().accounts?.find((a) => a.id === DEFAULT_ACCOUNT_ID);
      expect(main?.balanceMinor).toBe(456);
      expect(getState().currentBalance.amount).toBe(456);
    });

    it('two bank accounts: currentBalance.amount becomes the SUM across accounts, not a raw echo', () => {
      resetToEmpty();
      setAccountBalance(DEFAULT_ACCOUNT_ID, 500, '2026-07-05T00:00:00.000Z');
      const savings = addAccount({ name: 'Savings', kind: 'savings', balanceMinor: 300 });

      setCurrentBalance({ amount: 1000, source: 'user-entered', confidence: 'statement-derived' });

      const main = getState().accounts?.find((a) => a.id === DEFAULT_ACCOUNT_ID);
      const savingsAfter = getState().accounts?.find((a) => a.id === savings.id);
      expect(main?.balanceMinor).toBe(1000);
      expect(savingsAfter?.balanceMinor).toBe(300);
      expect(getState().currentBalance.amount).toBe(1300);
    });

    it('no accounts array: falls back to next.amount verbatim', () => {
      resetAll();
      setPartial({ accounts: [] });

      setCurrentBalance({ amount: 42, source: 'user-entered', confidence: 'rough' });

      expect(getState().currentBalance.amount).toBe(42);
    });
  });

  it('bankTransactions/isBankTxn: single-account (migrated) install returns every transaction unchanged', () => {
    resetToEmpty();
    addTransaction({ merchant: 'Rent', amount: -900, category: 'bills', source: 'manual' });
    addTransaction({ merchant: 'Pay', amount: 2000, category: 'income', source: 'manual' });

    const state = getState();
    expect(bankTransactions(state)).toEqual(state.transactions);
    expect(state.transactions.every((t) => isBankTxn(state, t))).toBe(true);
  });

  it('bankTransactions excludes a transaction posted to a credit-card account', () => {
    resetToEmpty();
    const card = addAccount({ name: 'Amex Gold', kind: 'credit-card' });

    addTransaction({ merchant: 'Rent', amount: -900, category: 'bills', source: 'manual' });
    const cardTxn = addTransaction({
      merchant: 'Netflix',
      amount: -50,
      category: 'other',
      source: 'manual',
      accountId: card.id,
    });

    const state = getState();
    const filtered = bankTransactions(state);
    expect(filtered.some((t) => t.id === cardTxn.id)).toBe(false);
    expect(filtered.length).toBe(state.transactions.length - 1);
    expect(isBankTxn(state, cardTxn)).toBe(false);
  });

  it('keeps hidden accounts in totals but closes and excludes them without deleting history', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 500, '2026-07-05T00:00:00.000Z');
    const savings = addAccount({ name: 'Savings', kind: 'savings', balanceMinor: 300 });
    const row = addTransaction({
      merchant: 'Savings interest',
      amount: 3,
      category: 'income',
      source: 'manual',
      accountId: savings.id,
    });

    const balanceBeforeHide = getState().currentBalance;
    expect(updateAccountPolicy(savings.id, { hidden: true })).toBe(true);
    expect(selectBankBalanceMinor(getState())).toBe(800);
    expect(getState().currentBalance).toEqual(balanceBeforeHide);
    expect(bankTransactions(getState()).some((transaction) => transaction.id === row.id)).toBe(
      true,
    );

    expect(updateAccountPolicy(savings.id, { excludedFromTotals: true })).toBe(true);
    expect(selectBankBalanceMinor(getState())).toBe(500);
    expect(getState().currentBalance.amount).toBe(500);
    expect(bankTransactions(getState()).some((transaction) => transaction.id === row.id)).toBe(
      false,
    );
    expect(getState().transactions.some((transaction) => transaction.id === row.id)).toBe(true);

    expect(updateAccountPolicy(savings.id, { excludedFromTotals: false, closed: true })).toBe(true);
    expect(selectBankBalanceMinor(getState())).toBe(500);
    expect(setAccountBalance(savings.id, 999)).toBe(false);
    expect(getState().accounts?.find((account) => account.id === savings.id)?.balanceMinor).toBe(
      300,
    );

    expect(updateAccountPolicy(savings.id, { hidden: false, closed: false })).toBe(true);
    expect(selectBankBalanceMinor(getState())).toBe(800);
    expect(bankTransactions(getState()).some((transaction) => transaction.id === row.id)).toBe(
      true,
    );
  });

  it('reports credit and overdraft facilities separately from actual cash and debt', () => {
    resetToEmpty();
    expect(setAccountBalance(DEFAULT_ACCOUNT_ID, -150, '2026-07-05T00:00:00.000Z')).toBe(true);
    expect(setAccountFacilities(DEFAULT_ACCOUNT_ID, { arrangedOverdraftLimit: 300 })).toBe(true);
    const card = addAccount({
      name: 'Card',
      kind: 'credit-card',
      balanceMinor: 250,
      creditLimit: 1_000,
    });
    addAccount({
      name: 'Card in credit',
      kind: 'credit-card',
      balanceMinor: -40,
      creditLimit: 500,
    });

    expect(selectBankBalanceMinor(getState())).toBe(-150);
    expect(selectCreditAvailability(getState())).toEqual({
      knownAvailableCredit: 1_290,
      unknownLimitAccountCount: 0,
      overLimitBy: 0,
    });
    expect(selectOverdraftSummary(getState())).toEqual({
      arrangedUsed: 150,
      arrangedRemaining: 150,
      unarrangedBy: 0,
      overdrawnAccountCount: 1,
    });
    expect(totalDebtMinor(getState())).toBe(250);
    expect(selectNetPositionMinor(getState())).toBe(-360);

    expect(setAccountFacilities(DEFAULT_ACCOUNT_ID, { arrangedOverdraftLimit: 100 })).toBe(true);
    expect(selectOverdraftSummary(getState()).unarrangedBy).toBe(50);
    expect(setAccountFacilities(card.id, { creditLimit: null })).toBe(true);
    expect(selectCreditAvailability(getState()).unknownLimitAccountCount).toBe(1);
  });

  it('rejects malformed balances and facilities without mutating account state', () => {
    resetToEmpty();
    const before = structuredClone(getState().accounts);

    expect(() => addAccount({ name: 'Broken', kind: 'bank', balanceMinor: Number.NaN })).toThrow(
      /finite amount/u,
    );
    expect(() =>
      addAccount({
        name: 'Broken card',
        kind: 'credit-card',
        creditLimit: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(/finite amount/u);
    expect(setAccountBalance(DEFAULT_ACCOUNT_ID, Number.NaN)).toBe(false);
    expect(() =>
      setAccountFacilities(DEFAULT_ACCOUNT_ID, { arrangedOverdraftLimit: Number.MAX_VALUE }),
    ).toThrow(/fits safely/u);
    expect(getState().accounts).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Credit-cards-as-liabilities (ACCOUNTS_MODEL.md §2.4 / §4 P2) — a credit-card
// Account is bridged into the existing Debt model (debtEngine reads Debt[]
// unchanged) via sync-on-write, without double-counting; totalDebtMinor sums
// card accounts + unlinked pure Debt rows exactly once each; a card import
// never moves the safe-zone (bank-only) number; a bank→card payment reduces
// both sides atomically.
// ---------------------------------------------------------------------------
describe('credit-cards as liabilities (ACCOUNTS_MODEL.md P2)', () => {
  it('a brand-new credit-card account with a balance has no linked Debt row until payoff details are declared', () => {
    resetToEmpty();
    const card = addAccount({ name: 'Amex Gold', kind: 'credit-card', balanceMinor: 500 });

    const debts = getState().debts ?? [];
    expect(debts.some((d) => d.linkedAccountId === card.id)).toBe(false);
    // The account itself still carries the balance correctly (net position sees it) —
    // only the amortisation VIEW needs payoff details.
    expect(selectNetPositionMinor(getState())).toBe(-500);
  });

  it('addCardPayoffDetails creates the linked Debt row from the account balance', () => {
    resetToEmpty();
    const card = addAccount({ name: 'Amex Gold', kind: 'credit-card', balanceMinor: 500 });
    const debt = addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    expect(debt).not.toBeNull();
    expect(debt?.linkedAccountId).toBe(card.id);
    expect(debt?.balance).toBe(500);
    expect(debt?.kind).toBe('card');

    const debts = getState().debts ?? [];
    expect(debts.filter((d) => d.linkedAccountId === card.id).length).toBe(1);
  });

  it('addCardPayoffDetails is a no-op for a non-card account, an unknown account, or a card that already has a linked Debt', () => {
    resetToEmpty();
    const bank = getState().accounts?.[0]!;
    expect(addCardPayoffDetails(bank.id, { apr: 0, minPayment: 0, dueDom: 1 })).toBeNull();
    expect(addCardPayoffDetails('acct-nope', { apr: 0, minPayment: 0, dueDom: 1 })).toBeNull();

    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 100 });
    addCardPayoffDetails(card.id, { apr: 20, minPayment: 10, dueDom: 5 });
    const again = addCardPayoffDetails(card.id, { apr: 999, minPayment: 999, dueDom: 1 });
    expect(again).toBeNull();
    expect(getState().debts?.filter((d) => d.linkedAccountId === card.id).length).toBe(1);
  });

  it('setAccountBalance on a linked credit card updates the Debt balance too, leaving apr/minPayment/dueDom untouched', () => {
    resetToEmpty();
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 500 });
    addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    setAccountBalance(card.id, 350, '2026-07-05T00:00:00.000Z');

    const debt = getState().debts?.find((d) => d.linkedAccountId === card.id);
    expect(debt?.balance).toBe(350);
    expect(debt?.apr).toBe(22.9);
    expect(debt?.minPayment).toBe(25);
    expect(debt?.dueDom).toBe(15);
  });

  it('a credit-card account (£500 owed) appears in totalDebtMinor and net position (bank − 500), without double-counting once linked', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 1000, '2026-07-05T00:00:00.000Z');
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 500 });
    addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    expect(totalDebtMinor(getState())).toBe(500);
    expect(selectNetPositionMinor(getState())).toBe(500); // 1000 - 500
    expect(selectBankBalanceMinor(getState())).toBe(1000); // bank-only, card excluded
  });

  it('a pure loan Debt (no linked account) and an imported card both show in totalDebtMinor without double-counting', () => {
    resetToEmpty();
    addDebt({
      name: 'Personal loan',
      kind: 'loan',
      balance: 2400,
      apr: 12.9,
      minPayment: 120,
      dueDom: 5,
    });
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 500 });
    addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    expect(totalDebtMinor(getState())).toBe(2900); // 2400 loan + 500 card, once each
    // Sanity: the loan Debt row itself is untouched by the card sync.
    expect(getState().debts?.find((d) => d.name === 'Personal loan')?.balance).toBe(2400);
  });

  it('a credit-card statement import (via setAccountBalance) does not change bank-only cashflow/safe-zone reads', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 1000, '2026-07-05T00:00:00.000Z');
    const bankBefore = selectBankBalanceMinor(getState());

    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 0 });
    addTransaction({
      merchant: 'Netflix',
      amount: -12.99,
      category: 'other',
      source: 'manual',
      accountId: card.id,
    });
    setAccountBalance(card.id, 200, '2026-07-06T00:00:00.000Z'); // card statement closing balance

    // Bank balance / bank-only cashflow are unaffected by the card import.
    expect(selectBankBalanceMinor(getState())).toBe(bankBefore);
    const state = getState();
    expect(bankTransactions(state).some((t) => t.merchant === 'Netflix')).toBe(false);
  });

  it('payCreditCardFromBank reduces the bank balance and the card owed amount atomically, and updates the linked Debt', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 1000, '2026-07-05T00:00:00.000Z');
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 500 });
    addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    const ok = payCreditCardFromBank(DEFAULT_ACCOUNT_ID, card.id, 200);

    expect(ok).toBe(true);
    expect(selectBankBalanceMinor(getState())).toBe(800);
    expect(getState().accounts?.find((a) => a.id === card.id)?.balanceMinor).toBe(300);
    expect(getState().debts?.find((d) => d.linkedAccountId === card.id)?.balance).toBe(300);
  });

  it('payCreditCardFromBank applies only what is owed on overpayment and is a no-op for invalid inputs', () => {
    resetToEmpty();
    setAccountBalance(DEFAULT_ACCOUNT_ID, 1000, '2026-07-05T00:00:00.000Z');
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 100 });
    addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    expect(payCreditCardFromBank(DEFAULT_ACCOUNT_ID, card.id, 500)).toBe(true);
    expect(selectBankBalanceMinor(getState())).toBe(900);
    expect(getState().accounts?.find((a) => a.id === card.id)?.balanceMinor).toBe(0);
    expect(getState().debts?.find((d) => d.linkedAccountId === card.id)?.balance).toBe(0);

    expect(payCreditCardFromBank(DEFAULT_ACCOUNT_ID, card.id, 0)).toBe(false);
    expect(payCreditCardFromBank(DEFAULT_ACCOUNT_ID, card.id, 10)).toBe(false);
    expect(payCreditCardFromBank(DEFAULT_ACCOUNT_ID, 'acct-nope', 10)).toBe(false);
    expect(payCreditCardFromBank(card.id, card.id, 10)).toBe(false); // "bank" side is itself a liability
  });
});

// ---------------------------------------------------------------------------
// logDebtPayment / undoDebtPayment — card-linked debt/account sync (plan 103).
// A card-linked Debt mirrors an Account (Debt.linkedAccountId): logging or
// undoing a payment against the Debt must land on the linked Account's
// balanceMinor in the SAME write, or the Debt-lens figure and the
// account/net-worth figure disagree, and the next statement import
// (syncCardDebt) silently erases the payment from the Debt row.
// ---------------------------------------------------------------------------
describe('logDebtPayment — card-linked debt/account sync', () => {
  it('logDebtPayment on a card-linked debt decrements both the Debt balance and the linked Account balanceMinor', () => {
    resetToEmpty();
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 200 });
    const debt = addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });

    logDebtPayment(debt!.id, 50);

    expect(getState().debts?.find((d) => d.id === debt!.id)?.balance).toBe(150);
    expect(getState().accounts?.find((a) => a.id === card.id)?.balanceMinor).toBe(150);
  });

  it('undoDebtPayment on a card-linked debt restores both the Debt balance and the linked Account balanceMinor', () => {
    resetToEmpty();
    const card = addAccount({ name: 'Amex', kind: 'credit-card', balanceMinor: 200 });
    const debt = addCardPayoffDetails(card.id, { apr: 22.9, minPayment: 25, dueDom: 15 });
    logDebtPayment(debt!.id, 50);

    undoDebtPayment(debt!.id, 50);

    expect(getState().debts?.find((d) => d.id === debt!.id)?.balance).toBe(200);
    expect(getState().accounts?.find((a) => a.id === card.id)?.balanceMinor).toBe(200);
  });

  it('logDebtPayment on an unlinked debt changes only the debt; accounts are untouched', () => {
    resetToEmpty();
    const accountsBefore = getState().accounts;
    const loan = addDebt({
      name: 'Personal loan',
      kind: 'loan',
      balance: 2400,
      apr: 12.9,
      minPayment: 120,
      dueDom: 5,
    });

    logDebtPayment(loan.id, 100);

    expect(getState().debts?.find((d) => d.id === loan.id)?.balance).toBe(2300);
    expect(getState().accounts).toEqual(accountsBefore);
  });

  it('logDebtPayment/undoDebtPayment on an unlinked debt keep their existing no-op and clamp behaviour', () => {
    resetToEmpty();
    const loan = addDebt({
      name: 'Personal loan',
      kind: 'loan',
      balance: 40,
      apr: 12.9,
      minPayment: 10,
      dueDom: 5,
    });

    logDebtPayment(loan.id, 0); // no-op: amount not > 0
    expect(getState().debts?.find((d) => d.id === loan.id)?.balance).toBe(40);

    logDebtPayment(loan.id, 100); // clamps at £0, never negative
    expect(getState().debts?.find((d) => d.id === loan.id)?.balance).toBe(0);

    undoDebtPayment(loan.id, 25); // adds back, no clamp
    expect(getState().debts?.find((d) => d.id === loan.id)?.balance).toBe(25);

    logDebtPayment('debt-nope', 10); // unknown id: no-op, no throw
    undoDebtPayment('debt-nope', 10);
    expect(getState().debts?.find((d) => d.id === loan.id)?.balance).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// applyMeloTool — tool-name matching (ENGINES §6) returns candidates ambiguous
// ---------------------------------------------------------------------------
describe('matchMeloTool — normalised name matching', () => {
  it('resolves a punctuation/case-noisy name to the canonical tool', () => {
    const m = matchMeloTool('  Log-Transfer!! ');
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.name).toBe('log_transfer');
  });

  it('resolves an unambiguous substring', () => {
    const m = matchMeloTool('log spend');
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.name).toBe('log_spend');
  });

  it('hands back candidates (or none) when the name does not resolve', () => {
    const m = matchMeloTool('totally unknown verb');
    expect(m.ok).toBe(false);
    if (!m.ok) expect(Array.isArray(m.candidates)).toBe(true);
  });

  it('treats a dropped tool name (pause_subscription) as no longer a Melo tool', () => {
    // Pause is NO LONGER a Melo tool — the name must not resolve, so applyMeloTool refuses it.
    const res = applyMeloTool('pause_subscription', { name: 'Notion' });
    expect(res.applied).toBe(false);
    // It does not silently pause anything.
    expect(!!getState().subPaused.Notion).toBe(false);
  });

  it('treats move_between_pots / set_tight_point_goal as unknown to Melo too', () => {
    expect(
      applyMeloTool('move_between_pots', { from: 'holiday', to: 'buffer', amount: 5 }).applied,
    ).toBe(false);
    expect(applyMeloTool('set_tight_point_goal', { amount: 50 }).applied).toBe(false);
  });

  it('applyMeloTool reports an unknown tool instead of mutating', () => {
    const res = applyMeloTool('frobnicate', {});
    expect(res.applied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyMeloTool — the log_* family: behaviour + bad-arg guards
// ---------------------------------------------------------------------------
describe('applyMeloTool — log_spend', () => {
  it('records a negative, Melo-sourced spend with a valid category', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_spend', { merchant: 'Greggs', amount: 3.5, category: 'food' });
    expect(res.applied).toBe(true);
    expect(getState().transactions.length).toBe(before + 1);
    const top = getState().transactions[0]!;
    expect(top.merchant).toBe('Greggs');
    expect(top.amount).toBe(-3.5);
    expect(top.category).toBe('food');
    expect(top.source).toBe('melo');
    expect(getState().decisionLedger).toEqual([]);
  });

  it('falls back to the "other" category for an off-list category', () => {
    applyMeloTool('log_spend', { merchant: 'X', amount: 2, category: 'not-a-category' });
    expect(getState().transactions[0]!.category).toBe('other');
  });

  it('rejects bad args (no merchant / non-positive amount)', () => {
    expect(applyMeloTool('log_spend', { merchant: '', amount: 5 }).applied).toBe(false);
    expect(applyMeloTool('log_spend', { merchant: 'Greggs', amount: 0 }).applied).toBe(false);
  });
});

describe('applyMeloTool — log_income', () => {
  it('records a POSITIVE inflow, defaulting the category to income', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_income', { merchant: 'Employer', amount: 1800 });
    expect(res.applied).toBe(true);
    expect(getState().transactions.length).toBe(before + 1);
    const top = getState().transactions[0]!;
    expect(top.merchant).toBe('Employer');
    expect(top.amount).toBe(1800); // positive = inflow
    expect(top.category).toBe('income'); // default when none given
    expect(top.source).toBe('melo');
    expect(getState().decisionLedger).toHaveLength(1);
    expect(getState().decisionLedger?.[0]).toMatchObject({
      decisionType: 'melo-confirmed-action',
      status: 'awaiting-outcome',
    });
  });

  it('reads the payer from `source` when `merchant` is absent', () => {
    const res = applyMeloTool('log_income', { source: 'Refund pool', amount: 12 });
    expect(res.applied).toBe(true);
    expect(getState().transactions[0]!.merchant).toBe('Refund pool');
  });

  it('honours a valid explicit category and rejects bad args', () => {
    applyMeloTool('log_income', { merchant: 'Side gig', amount: 40, category: 'other' });
    expect(getState().transactions[0]!.category).toBe('other');
    expect(applyMeloTool('log_income', { merchant: '', amount: 5 }).applied).toBe(false);
    expect(applyMeloTool('log_income', { merchant: 'X', amount: -5 }).applied).toBe(false);
  });

  it('undo removes the logged income', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_income', { merchant: 'Employer', amount: 1800 });
    expect(getState().transactions.length).toBe(before + 1);
    if (res.applied) res.undo();
    expect(getState().transactions.length).toBe(before);
  });
});

describe('applyMeloTool — log_refund', () => {
  it('records an unlinked POSITIVE refund without misclassifying it as income', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_refund', { merchant: 'ASOS', amount: 24.99 });
    expect(res.applied).toBe(true);
    expect(getState().transactions.length).toBe(before + 1);
    const top = getState().transactions[0]!;
    expect(top.amount).toBe(24.99); // inflow
    expect(top.merchant).toContain('ASOS');
    expect(top.merchant.toLowerCase()).toContain('refund'); // honestly tagged as a refund
    expect(top.category).toBe('other'); // a refund is NOT income — never auto-filed as income
    expect(top.source).toBe('melo');
    expect(top.moneyMovementKind).toBe('refund');
    expect(top.refundOfId).toBeUndefined();
    expect(bankAnalyticsTransactions(getState()).some((row) => row.id === top.id)).toBe(false);
    expect(getState().decisionLedger).toHaveLength(1);
    expect(getState().decisionLedger?.[0]).toMatchObject({
      decisionType: 'melo-confirmed-action',
      status: 'awaiting-outcome',
    });
  });

  it('uses a real transaction relationship when the original transaction id is supplied', () => {
    resetToEmpty();
    const original = addTransaction({
      id: 'asos-order-123',
      merchant: 'ASOS order #123',
      amount: -40,
      category: 'shopping',
      source: 'manual',
    });
    const result = applyMeloTool('log_refund', {
      merchant: 'ASOS',
      amount: 10,
      original: 'ASOS order #123',
      originalTransactionId: original.id,
    });

    expect(result.applied).toBe(true);
    expect(getState().transactions[0]).toMatchObject({
      merchant: expect.stringContaining('ASOS order #123'),
      refundOfId: original.id,
      moneyMovementKind: 'refund',
      source: 'melo',
    });
    expect(bankAnalyticsTransactions(getState())[0]).toMatchObject({
      id: original.id,
      amount: -30,
    });
  });

  it('fails closed when a claimed original transaction id is unavailable', () => {
    const before = getState().transactions.length;
    const result = applyMeloTool('log_refund', {
      merchant: 'ASOS',
      amount: 10,
      originalTransactionId: 'missing',
    });

    expect(result.applied).toBe(false);
    expect(getState().transactions).toHaveLength(before);
  });

  it('rejects bad args (no merchant / non-positive amount)', () => {
    expect(applyMeloTool('log_refund', { merchant: '', amount: 5 }).applied).toBe(false);
    expect(applyMeloTool('log_refund', { merchant: 'ASOS', amount: 0 }).applied).toBe(false);
  });

  it('undo removes the logged refund', () => {
    const before = getState().transactions.length;
    const res = applyMeloTool('log_refund', { merchant: 'ASOS', amount: 24.99 });
    expect(getState().transactions.length).toBe(before + 1);
    if (res.applied) res.undo();
    expect(getState().transactions.length).toBe(before);
  });
});

describe('applyMeloTool — log_transfer', () => {
  it('records a neutral PAIR (out + in) on one timestamp that nets to £0', () => {
    resetToEmpty();
    const savings = addAccount({ name: 'Savings', kind: 'savings' });
    const before = getState().transactions.length;
    const res = applyMeloTool('log_transfer', {
      from: 'Main',
      to: 'Savings',
      amount: 100,
      fromAccountId: DEFAULT_ACCOUNT_ID,
      toAccountId: savings.id,
    });
    expect(res.applied).toBe(true);
    // Two legs added.
    expect(getState().transactions.length).toBe(before + 2);
    const [first, second] = getState().transactions;
    // One negative leg, one positive leg, equal magnitude → nets to zero.
    expect(first!.amount + second!.amount).toBe(0);
    expect(Math.abs(first!.amount)).toBe(100);
    // Both legs are neutral 'other', Melo-sourced, share a timestamp, and name both endpoints.
    expect(first!.category).toBe('other');
    expect(second!.category).toBe('other');
    expect(first!.source).toBe('melo');
    expect(first!.when).toBe(second!.when);
    const labels = `${first!.merchant} ${second!.merchant}`;
    expect(labels).toContain('Main');
    expect(labels).toContain('Savings');
    expect(labels.toLowerCase()).toContain('transfer');
    expect(first!.moneyMovementKind).toBe('transfer');
    expect(second!.moneyMovementKind).toBe('transfer');
    expect(first!.transferLinkId).toBe(second!.transferLinkId);
    expect(new Set([first!.accountId, second!.accountId])).toEqual(
      new Set([DEFAULT_ACCOUNT_ID, savings.id]),
    );
    expect(bankAnalyticsTransactions(getState())).toEqual([]);
  });

  it('rejects bad args (missing endpoint / non-positive amount)', () => {
    expect(applyMeloTool('log_transfer', { from: '', to: 'Savings', amount: 50 }).applied).toBe(
      false,
    );
    expect(
      applyMeloTool('log_transfer', { from: 'Current', to: 'Savings', amount: 0 }).applied,
    ).toBe(false);
  });

  it('undo removes BOTH legs', () => {
    resetToEmpty();
    const savings = addAccount({ name: 'Savings', kind: 'savings' });
    const before = getState().transactions.length;
    const res = applyMeloTool('log_transfer', {
      from: 'Main',
      to: 'Savings',
      amount: 100,
      fromAccountId: DEFAULT_ACCOUNT_ID,
      toAccountId: savings.id,
    });
    expect(getState().transactions.length).toBe(before + 2);
    if (res.applied) res.undo();
    expect(getState().transactions.length).toBe(before);
  });

  it('does not invent transfer ownership when either endpoint cannot be resolved', () => {
    resetToEmpty();
    const before = getState().transactions.length;
    const result = applyMeloTool('log_transfer', {
      from: 'Main',
      to: 'Unknown savings account',
      amount: 100,
    });

    expect(result.applied).toBe(false);
    expect(getState().transactions).toHaveLength(before);
  });
});

// ---------------------------------------------------------------------------
// fastForwardMonth — determinism (the parts that do not use Math.random)
// ---------------------------------------------------------------------------
describe('applyMeloTool — Personal pot tools', () => {
  it('resolves a pot by normalised name and restores it on Undo', () => {
    setPartial({
      pots: [
        owned({
          id: 'pot-holiday',
          name: 'Holiday fund',
          saved: 100,
          goal: 500,
          perWeek: 10,
          accent: true,
        }),
      ],
      potLedger: [],
    });
    const result = applyMeloTool('add to pot', {
      pot: 'holiday-fund',
      amount: 25,
    });
    expect(result.applied).toBe(true);
    expect(getState().pots[0]?.saved).toBe(125);
    expect(getState().potLedger[0]).toMatchObject({
      potId: 'pot-holiday',
      amount: 25,
      source: 'melo',
    });
    if (result.applied) result.undo();
    expect(getState().pots[0]?.saved).toBe(100);
    expect(getState().potLedger).toEqual([]);
  });

  it('returns no target candidates instead of guessing an unknown pot', () => {
    setPartial({
      pots: [
        owned({
          id: 'pot-trip',
          name: 'Trip',
          saved: 100,
          goal: 500,
          perWeek: 10,
          accent: true,
        }),
      ],
    });
    expect(applyMeloTool('borrowFromPot', { pot: 'missing', amount: 5 })).toMatchObject({
      applied: false,
      candidates: [],
    });
  });
});

describe('applyMeloTool — Business tools', () => {
  it('fails closed when the proposed tool belongs to another workspace kind', () => {
    expect(applyMeloTool('log_business_expense', { merchant: 'Figma', amount: 40 })).toMatchObject({
      applied: false,
      reason: 'Switch to a Business workspace first.',
    });
    activateMeloBusinessWorkspace();
    expect(applyMeloTool('log_spend', { merchant: 'Greggs', amount: 4 })).toMatchObject({
      applied: false,
      reason: 'Switch to Personal first.',
    });
  });

  it('records Business cash against the selected account and reverses ledger and cash', () => {
    const { account } = activateMeloBusinessWorkspace();
    const beforeTransactions = getState().transactions.length;
    const result = applyMeloTool('log_business_expense', {
      merchant: 'Figma',
      amount: 40,
    });
    expect(result.applied).toBe(true);
    expect(getState().transactions[0]).toMatchObject({
      merchant: 'Figma',
      amount: -40,
      source: 'melo',
      workspaceId: getState().activeWorkspaceId,
    });
    expect(
      (getState().accounts ?? []).find((candidate) => candidate.id === account.id)?.balanceMinor,
    ).toBe(960);
    if (result.applied) result.undo();
    expect(getState().transactions).toHaveLength(beforeTransactions);
    expect(
      (getState().accounts ?? []).find((candidate) => candidate.id === account.id)?.balanceMinor,
    ).toBe(1_000);
  });

  it('records an invoice sent only for a real client, then applies and undoes payment', () => {
    const { account } = activateMeloBusinessWorkspace();
    expect(
      applyMeloTool('log_invoice_sent', {
        client: 'Unknown client',
        amount: 500,
        dueOn: '2026-08-31',
      }),
    ).toMatchObject({ applied: false, candidates: [] });

    const sent = applyMeloTool('log_invoice_sent', {
      client: 'acme',
      amount: 500,
      dueOn: '2026-08-31',
      reference: 'INV-1',
    });
    expect(sent.applied).toBe(true);
    expect(getState().business?.invoices[0]).toMatchObject({
      clientId: 'client-acme',
      reference: 'INV-1',
      totalMinor: 50_000,
      status: 'issued',
    });

    const paid = applyMeloTool('log_invoice_paid', { invoice: 'INV-1' });
    expect(paid.applied).toBe(true);
    expect(getState().business?.invoices[0]).toMatchObject({
      paidMinor: 50_000,
      status: 'paid',
    });
    expect(
      (getState().accounts ?? []).find((candidate) => candidate.id === account.id)?.balanceMinor,
    ).toBe(1_500);
    if (paid.applied) paid.undo();
    expect(getState().business?.invoices[0]).toMatchObject({
      paidMinor: 0,
      status: 'issued',
    });
    expect(
      (getState().accounts ?? []).find((candidate) => candidate.id === account.id)?.balanceMinor,
    ).toBe(1_000);
    if (sent.applied) sent.undo();
    expect(getState().business?.invoices).toEqual([]);
  });

  it('defaults Business issued, paid, and dividend dates to the London day after BST midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T23:30:00.000Z'));
    activateMeloBusinessWorkspace();

    expect(
      applyMeloTool('log_invoice_sent', {
        client: 'Acme',
        amount: 500,
        dueOn: '2026-09-30',
        reference: 'BST-1',
      }).applied,
    ).toBe(true);
    expect(getState().business?.invoices[0]?.issuedOn).toBe('2026-08-17');
    expect(applyMeloTool('log_invoice_paid', { invoice: 'BST-1' }).applied).toBe(true);
    expect(getState().business?.invoices[0]?.paidOn).toBe('2026-08-17');

    activateMeloBusinessWorkspace({ ltd: true });
    expect(applyMeloTool('log_dividend', { shareholder: 'Avery', amount: 100 }).applied).toBe(true);
    expect(getState().business?.dividends[0]?.declaredOn).toBe('2026-08-17');
  });

  it('requires a Ltd workspace and distributable reserves before declaring a dividend', () => {
    activateMeloBusinessWorkspace();
    expect(applyMeloTool('log_dividend', { amount: 100 })).toMatchObject({
      applied: false,
      reason: 'Dividends require a limited company.',
    });
    activateMeloBusinessWorkspace({ ltd: true });
    const result = applyMeloTool('log_dividend', { shareholder: 'Avery', amount: 100 });
    expect(result.applied).toBe(true);
    expect(getState().business?.dividends).toHaveLength(1);
    if (result.applied) result.undo();
    expect(getState().business?.dividends).toEqual([]);
    expect(applyMeloTool('log_dividend', { shareholder: 'Avery', amount: 10_000 })).toMatchObject({
      applied: false,
      reason: 'The dividend exceeds distributable reserves.',
    });
  });
});

describe('fastForwardMonth', () => {
  it('rolls subs forward: nextRenewalDaysAway<=0 → 30, lastUsedDaysAgo +30', () => {
    // Force one sub to a non-positive renewal so the <=0 branch is exercised.
    setPartial({
      subs: [
        { name: 'Due', cost: 5, nextRenewalDaysAway: 0, lastUsedDaysAgo: 1, usesPerMonth: 4 },
        { name: 'Later', cost: 5, nextRenewalDaysAway: 12, lastUsedDaysAgo: 3, usesPerMonth: 4 },
      ],
    });

    fastForwardMonth();
    const subs = getState().subs;
    const due = subs.find((s) => s.name === 'Due')!;
    const later = subs.find((s) => s.name === 'Later')!;

    expect(due.nextRenewalDaysAway).toBe(30); // <=0 rolled to 30
    expect(due.lastUsedDaysAgo).toBe(31); // +30
    expect(later.nextRenewalDaysAway).toBe(12); // positive renewal unchanged
    expect(later.lastUsedDaysAgo).toBe(33); // +30
  });

  it('prepends a synthetic cycle and keeps the 24-cap', () => {
    const before = getState().cycles.length;
    fastForwardMonth();
    const cycles = getState().cycles;

    expect(cycles.length).toBe(before + 1);
    expect(cycles[0]!.note).toBe('Auto-closed via fast-forward.');
  });

  it('ages existing cycles backwards by ~30 days', () => {
    // Use a unique note (not a month label) to identify the original — the
    // synthetic head's label is the *current* month and could otherwise collide.
    setPartial({
      cycles: [
        {
          closedAt: '2026-06-30',
          label: 'Original',
          spare: 1,
          tightPoint: 1,
          setAside: 1,
          note: 'orig-marker',
        },
      ],
    });
    fastForwardMonth();
    // The aged original sits behind the new synthetic head.
    const aged = getState().cycles.find((c) => c.note === 'orig-marker')!;
    expect(aged.closedAt).toBe('2026-05-31'); // 2026-06-30 minus 30 days (UTC)
  });
});

// ---------------------------------------------------------------------------
// transactions — 2000-cap, newest-first, honest drop accounting
// (DATA_INTELLIGENCE.md phase ④(A) — raised from the old 200)
// ---------------------------------------------------------------------------
describe('transactions cap', () => {
  it('keeps at most 2000, newest first', () => {
    // Add 2050 melo-logged spends; the head should be the most recent.
    // Each call round-trips the whole persisted blob (see store.ts `persist()`),
    // and the cap is 10x the old 200, so this legitimately takes longer under
    // parallel test-runner load than the default 5s budget — bump it rather
    // than shrinking the iteration count and losing the over-cap assertion.
    for (let i = 0; i < 2050; i++) {
      applyMeloTool('log_spend', { merchant: `M${i}`, amount: 1, category: 'other' });
    }
    const txns = getState().transactions;

    expect(txns.length).toBe(2000);
    expect(txns[0]!.merchant).toBe('M2049'); // last added is at the head
  }, 20_000);

  it('increments droppedTransactionCount by exactly how many rows an eviction drops', () => {
    setPartial({ transactions: [], droppedTransactionCount: 0 });
    for (let i = 0; i < 2010; i++) {
      addTransaction({ merchant: `M${i}`, amount: 1, category: 'other', source: 'manual' });
    }
    expect(getState().transactions.length).toBe(2000);
    expect(getState().droppedTransactionCount).toBe(10);
  }, 20_000);

  it('does not touch droppedTransactionCount while under the cap', () => {
    setPartial({ transactions: [], droppedTransactionCount: 0 });
    addTransaction({ merchant: 'Tesco', amount: -5, category: 'food', source: 'manual' });
    expect(getState().droppedTransactionCount).toBe(0);
  });

  it('accumulates across repeated eviction events rather than resetting each time', () => {
    setPartial({ transactions: [], droppedTransactionCount: 0 });
    for (let i = 0; i < 2005; i++) {
      addTransaction({ merchant: `A${i}`, amount: 1, category: 'other', source: 'manual' });
    }
    expect(getState().droppedTransactionCount).toBe(5);
    for (let i = 0; i < 5; i++) {
      addTransaction({ merchant: `B${i}`, amount: 1, category: 'other', source: 'manual' });
    }
    expect(getState().droppedTransactionCount).toBe(10);
  }, 20_000);
});

// ---------------------------------------------------------------------------
// addTransactionsBatch — single-write batch entrance, same retention policy
// ---------------------------------------------------------------------------
describe('addTransactionsBatch', () => {
  it('is a no-op on an empty batch', () => {
    setPartial({ transactions: [] });
    const result = addTransactionsBatch([]);
    expect(result).toEqual([]);
    expect(getState().transactions).toEqual([]);
  });

  it('matches the ordering a per-row addTransaction loop would produce (last row ends up at the head)', () => {
    setPartial({ transactions: [] });
    addTransactionsBatch([
      { merchant: 'First', amount: -1, category: 'food', source: 'manual' },
      { merchant: 'Second', amount: -2, category: 'food', source: 'manual' },
      { merchant: 'Third', amount: -3, category: 'food', source: 'manual' },
    ]);
    const merchants = getState().transactions.map((t) => t.merchant);
    expect(merchants).toEqual(['Third', 'Second', 'First']);
  });

  it('returns the full rows added, in the same order they were passed in', () => {
    setPartial({ transactions: [] });
    const result = addTransactionsBatch([
      { merchant: 'First', amount: -1, category: 'food', source: 'manual' },
      { merchant: 'Second', amount: -2, category: 'food', source: 'manual' },
    ]);
    expect(result.map((t) => t.merchant)).toEqual(['First', 'Second']);
    expect(result.every((t) => typeof t.id === 'string' && t.id.length > 0)).toBe(true);
    expect(result.every((t) => typeof t.when === 'string' && t.when.length > 0)).toBe(true);
  });

  it('applies the same 2000-cap + drop accounting as addTransaction', () => {
    setPartial({ transactions: [], droppedTransactionCount: 0 });
    const rows = Array.from({ length: 2010 }, (_, i) => ({
      merchant: `M${i}`,
      amount: 1,
      category: 'other' as const,
      source: 'manual' as const,
    }));
    addTransactionsBatch(rows);
    expect(getState().transactions.length).toBe(2000);
    expect(getState().droppedTransactionCount).toBe(10);
  });

  it('preserves an explicit when/id per row (statement-dated import)', () => {
    setPartial({ transactions: [] });
    addTransactionsBatch([
      {
        id: 'fixed-id',
        when: '2026-01-15T00:00:00.000Z',
        merchant: 'Tesco',
        amount: -10,
        category: 'food',
        source: 'manual',
      },
    ]);
    const row = getState().transactions[0]!;
    expect(row.id).toBe('fixed-id');
    expect(row.when).toBe('2026-01-15T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// editTransaction — non-destructive correction history (ENGINES §6)
// ---------------------------------------------------------------------------
describe('editTransaction', () => {
  // Seed a single known manual row to correct, so assertions don't depend on
  // the default seed set.
  const seedOne = (over: Partial<Transaction> = {}): Transaction =>
    addTransaction({
      merchant: 'Tesco',
      amount: -42.1,
      category: 'food',
      source: 'manual',
      ...over,
    });

  it('replaces the row in place — same id, no duplicate, count unchanged', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne();
    const before = getState().transactions.length;

    editTransaction(row.id, { amount: -50 }, 'user');

    const txns = getState().transactions;
    expect(txns.length).toBe(before); // no double count
    const matches = txns.filter((t) => t.id === row.id);
    expect(matches.length).toBe(1); // exactly one row with that id
    expect(matches[0]!.amount).toBe(-50); // row carries the new value
    // The edit was recorded — the row update and the history grew together.
    expect((getState().edits ?? []).length).toBe(1);
  });

  it('appends one correction record per changed field, leaving the original recoverable', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne({ amount: -42.1, merchant: 'Tesco' });

    editTransaction(row.id, { amount: -50, merchant: 'Tesco Extra' }, 'user');

    const edits = getState().edits ?? [];
    // Two changed fields -> two records.
    expect(edits.length).toBe(2);
    const amountEdit = edits.find((e) => e.field === 'amount')!;
    const merchantEdit = edits.find((e) => e.field === 'merchant')!;
    // The original value survives inside `before` — nothing was overwritten away.
    expect(amountEdit.before).toBe(-42.1);
    expect(amountEdit.after).toBe(-50);
    expect(merchantEdit.before).toBe('Tesco');
    expect(merchantEdit.after).toBe('Tesco Extra');
    // Every record is attributed and stamped.
    expect(amountEdit.txnId).toBe(row.id);
    expect(amountEdit.by).toBe('user');
    expect(typeof amountEdit.at).toBe('string');
    expect(amountEdit.at.length).toBeGreaterThan(0);
  });

  it('records who made the edit (melo)', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne();
    editTransaction(row.id, { merchant: 'Greggs' }, 'melo');
    expect((getState().edits ?? [])[0]!.by).toBe('melo');
  });

  it('a no-op edit (field set to its current value) writes nothing', () => {
    setPartial({ transactions: [], edits: [] });
    const row = seedOne({ amount: -42.1 });

    editTransaction(row.id, { amount: -42.1 }, 'user');

    expect((getState().edits ?? []).length).toBe(0); // no record
    expect(getState().transactions.find((t) => t.id === row.id)!.amount).toBe(-42.1);
  });

  it('an unknown txn id is a safe no-op', () => {
    setPartial({ transactions: [], edits: [] });
    seedOne();
    editTransaction('does-not-exist', { amount: -1 }, 'user');
    expect((getState().edits ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// schema migration — v2 → v3 defaults the `edits` correction history
// ---------------------------------------------------------------------------
describe('schema migration v3', () => {
  it('defaults DEFAULTS/state to the current schema version with an empty edit history', () => {
    resetAll();
    expect(getState().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(getState().edits).toEqual([]);
  });
});

describe('schema migration v15 workspace-local companion progression', () => {
  it('defaults a v14 partition to bounded stage and streak slices owned by that workspace', () => {
    resetAll();
    const v14Blob = { ...getState(), schemaVersion: 14 } as Record<string, unknown>;
    const fallbackAt = getState().currentBalance.setAt;
    delete v14Blob.stage;
    delete v14Blob.streak;

    hydrateFromBlob(JSON.stringify(v14Blob));

    expect(getState()).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      stage: {
        current: 'ember',
        enteredAt: fallbackAt,
        lastRebirthAt: null,
        history: [{ stage: 'ember', at: fallbackAt }],
      },
      streak: {
        count: 0,
        lastQualifiedCycleId: null,
        bestCount: 0,
        updatedAt: fallbackAt,
      },
    });
  });
});

// ---------------------------------------------------------------------------
// schema migration — v5 → v6 defaults the `timelineEvents` log (@rn-engine timeline-verbs)
// ---------------------------------------------------------------------------
describe('schema migration v17 Decision Ledger', () => {
  it('adds an empty ledger without fabricating history from existing money rows', () => {
    resetToEmpty();
    addTransaction({
      merchant: 'Real shop',
      amount: -24,
      category: 'food',
      source: 'manual',
    });
    addCycle({
      closedAt: '2026-07-20',
      label: 'July',
      spare: 20,
      tightPoint: 10,
      setAside: 0,
      note: 'real cycle',
    });
    const v16Blob = { ...getState(), schemaVersion: 16 } as Record<string, unknown>;
    delete v16Blob.decisionLedger;

    hydrateFromBlob(JSON.stringify(v16Blob));

    expect(getState().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(getState().decisionLedger).toEqual([]);
    expect(getState().transactions).toHaveLength(1);
    expect(getState().cycles).toHaveLength(1);
  });
});

describe('schema migration v18 Critical Journey records', () => {
  it('adds empty bounded journey slices without fabricating explanations from existing receipts', () => {
    resetToEmpty();
    addTransaction({
      merchant: 'Real shop',
      amount: -24,
      category: 'food',
      source: 'manual',
    });
    const v17Blob = { ...getState(), schemaVersion: 17 } as Record<string, unknown>;
    delete v17Blob.provisionalAnswers;
    delete v17Blob.materialChanges;
    delete v17Blob.correctionImpacts;
    delete v17Blob.criticalJourneyContinuity;

    hydrateFromBlob(JSON.stringify(v17Blob));

    expect(getState().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(getState().provisionalAnswers).toEqual([]);
    expect(getState().materialChanges).toEqual([]);
    expect(getState().correctionImpacts).toEqual([]);
    expect(getState().criticalJourneyContinuity).toEqual([]);
    expect(getState().transactions).toHaveLength(1);
  });
});

describe('schema migration v19 workspace companion isolation', () => {
  const financialCompanionState = {
    oneMoveHistory: [{ key: 'recovery', shownAt: '2026-08-16' }],
    meloMoves: [
      {
        id: 'move-workspace-money',
        createdAt: '2026-08-16T12:00:00.000Z',
        headline: 'Hold £40 today',
        kind: 'hold' as const,
        amount: 40,
        targetId: 'workspace-pot',
        status: 'accepted' as const,
        baselinePathSpare: -25,
        baselineTightPoint: -80,
      },
    ],
    meloDismissLog: [
      { kind: 'recovery', reason: 'not-now' as const, at: '2026-08-16T12:01:00.000Z' },
    ],
    meloMemoryThread: [
      {
        id: 'cycle-workspace-july',
        at: '2026-07-31T12:00:00.000Z',
        kind: 'cadence' as const,
        text: 'Closed July with £120 spare.',
        editable: true,
        source: 'observed' as const,
      },
    ],
    meloForgottenMemoryIds: ['workspace-forgotten-money-memory'],
  };

  it('preserves Personal financial companion history', () => {
    resetToEmpty();
    setPartial(financialCompanionState);
    const personalV18 = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    personalV18.schemaVersion = 18;

    expect(hydrateFromBlob(JSON.stringify(personalV18), PERSONAL_WORKSPACE_ID)).toEqual({
      status: 'applied',
    });

    expect(getState().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(getState()).toMatchObject(financialCompanionState);
  });

  it('privacy-cleans contaminated Business history once and preserves global preferences', () => {
    resetToEmpty();
    const personalRoot = createPersonalWorkspaceRoot();
    const businessId = createWorkspaceId('workspace_business_companion_migration');
    const business = createBusinessWorkspace({
      id: businessId,
      name: 'Companion Migration Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-companion-migration-v1',
    });
    const businessV18 = {
      ...createEmptyWorkspacePartition(
        {
          workspaces: [...personalRoot.workspaces, business],
          activeWorkspaceId: businessId,
          dataWorkspaceId: businessId,
        },
        businessId,
        '2026-08-16T12:00:00.000Z',
      ),
      schemaVersion: 18,
      ...financialCompanionState,
      meloPrimerSeen: true,
      meloPrimerBeat: 2,
      meloPrimerSeenAt: '2026-08-16T12:00:00.000Z',
      melo: { quietMode: true, wardrobe: ['scarf'], tone: 'honest' as const },
      chartStyle: 'bars' as const,
    };

    expect(hydrateFromBlob(JSON.stringify(businessV18), businessId)).toEqual({ status: 'applied' });

    expect(getState()).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      oneMoveHistory: [],
      meloMoves: [],
      meloDismissLog: [],
      meloMemoryThread: [],
      meloForgottenMemoryIds: [],
      meloPrimerSeen: true,
      meloPrimerBeat: 2,
      meloPrimerSeenAt: '2026-08-16T12:00:00.000Z',
      melo: { quietMode: true, wardrobe: ['scarf'], tone: 'honest' },
      chartStyle: 'bars',
    });

    const migrated = getPersistBlob(businessId);
    expect(hydrateFromBlob(migrated, businessId)).toEqual({ status: 'applied' });
    expect(getState()).toMatchObject({
      oneMoveHistory: [],
      meloMoves: [],
      meloDismissLog: [],
      meloMemoryThread: [],
      meloForgottenMemoryIds: [],
    });
  });

  it('defaults missing Business companion fields to empty collections', () => {
    resetToEmpty();
    const personalRoot = createPersonalWorkspaceRoot();
    const businessId = createWorkspaceId('workspace_business_companion_missing');
    const business = createBusinessWorkspace({
      id: businessId,
      name: 'Legacy Missing Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-companion-missing-v1',
    });
    const businessV18 = createEmptyWorkspacePartition(
      {
        workspaces: [...personalRoot.workspaces, business],
        activeWorkspaceId: businessId,
        dataWorkspaceId: businessId,
      },
      businessId,
      '2026-08-16T12:00:00.000Z',
    ) as unknown as Record<string, unknown>;
    businessV18.schemaVersion = 18;
    delete businessV18.oneMoveHistory;
    delete businessV18.meloMoves;
    delete businessV18.meloDismissLog;
    delete businessV18.meloMemoryThread;
    delete businessV18.meloForgottenMemoryIds;

    expect(hydrateFromBlob(JSON.stringify(businessV18), businessId)).toEqual({ status: 'applied' });
    expect(getState()).toMatchObject({
      oneMoveHistory: [],
      meloMoves: [],
      meloDismissLog: [],
      meloMemoryThread: [],
      meloForgottenMemoryIds: [],
    });
  });
});

describe('schema migration v20 trusted-core evidence', () => {
  it('removes unsupported confidence while preserving money, sources, audits and round-trip bytes', () => {
    resetToEmpty();
    const legacy = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    legacy.schemaVersion = 19;
    legacy.currentBalance = {
      amount: 432.1,
      source: 'statement',
      confidence: 'statement-derived',
      setAt: '2026-08-16T12:00:00.000Z',
    };
    legacy.decisionLedger = [
      {
        id: 'decision_legacy_confidence',
        question: { priority: 'cashflow_confidence' },
        userPriority: 'cashflow_confidence',
        factSnapshots: [
          {
            factId: 'fact_balance',
            confidence: 'high',
            amount: { minorUnits: 43_210, currency: 'GBP' },
            sourceRecordIds: ['source_statement_1'],
          },
        ],
        assumptions: [{ id: 'assumption_bill', confidence: 'low', sourceFactIds: ['fact_bill'] }],
        safeRange: {
          confidence: 'medium',
          confidenceReasons: [
            { id: 'legacy_balance_evidence', impact: 'raises', sourceFactIds: ['fact_balance'] },
            { id: 'legacy_bill_evidence', impact: 'lowers', sourceFactIds: ['fact_bill'] },
          ],
          reliance: 'use_caution',
        },
        forecast: { confidence: 'medium', sourceFactIds: ['fact_balance'] },
        forecastEvaluations: [
          {
            confidence: 'low',
            expected: { confidence: 'medium', sourceFactIds: ['fact_balance'] },
          },
        ],
        audit: [{ at: '2026-08-16T12:00:00.000Z', action: 'presented', ref: 'today' }],
      },
    ];
    legacy.provisionalAnswers = [
      { id: 'answer_legacy_confidence', confidence: 'medium', safeRange: { confidence: 'low' } },
    ];
    legacy.materialChanges = [
      {
        id: 'change_legacy_confidence',
        before: { confidence: 'high' },
        after: { confidence: 'low' },
      },
    ];
    legacy.correctionImpacts = [
      {
        id: 'correction_legacy_confidence',
        before: { confidence: 'low' },
        after: { confidence: 'high' },
      },
    ];
    legacy.criticalJourneyContinuity = [
      { id: 'continuity_legacy_confidence', lastSafeRange: { confidence: 'medium' } },
    ];

    expect(hydrateFromBlob(JSON.stringify(legacy))).toEqual({ status: 'applied' });

    const migrated = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    const trustedCoreJson = JSON.stringify({
      decisionLedger: migrated.decisionLedger,
      provisionalAnswers: migrated.provisionalAnswers,
      materialChanges: migrated.materialChanges,
      correctionImpacts: migrated.correctionImpacts,
      criticalJourneyContinuity: migrated.criticalJourneyContinuity,
    });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(trustedCoreJson).not.toContain('"confidence"');
    expect(trustedCoreJson).not.toContain('cashflow_confidence');
    expect(trustedCoreJson).toContain('cashflow_source_quality');
    expect(trustedCoreJson).toContain('"minorUnits":43210');
    expect(trustedCoreJson).toContain('source_statement_1');
    expect(trustedCoreJson).toContain('"action":"presented"');
    expect(trustedCoreJson).toContain('"evidenceNotes"');
    expect(trustedCoreJson).toContain('"impact":"supports"');
    expect(trustedCoreJson).toContain('"impact":"limits"');
    expect(getState().currentBalance).toMatchObject({
      amount: 432.1,
      source: 'statement',
      confidence: 'statement-derived',
    });

    const firstPass = getPersistBlob();
    expect(hydrateFromBlob(firstPass)).toEqual({ status: 'applied' });
    expect(getPersistBlob()).toBe(firstPass);
  });
});

describe('schema migration v6', () => {
  it('a pre-v6 blob with no timelineEvents migrates to an empty log, byte-identical otherwise', () => {
    resetAll();
    // Simulate a persisted v5 blob (no timelineEvents field at all).
    const v5Blob = { ...getState(), schemaVersion: 5 } as Record<string, unknown>;
    delete v5Blob.timelineEvents;
    hydrateFromBlob(JSON.stringify(v5Blob));

    const s = getState();
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.timelineEvents).toEqual([]);
  });

  it('a blob that already carries timelineEvents keeps them intact across migration', () => {
    togglePaused('Spotify', true);
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    const events = getState().timelineEvents ?? [];
    expect(events.length).toBe(1);
    expect(events[0]!.kind).toBe('sub-paused');
    expect(events[0]!.subject).toBe('Spotify');
  });
});

// ---------------------------------------------------------------------------
// seed only on empty — resetAll re-seeds; an explicit non-empty set survives
// ---------------------------------------------------------------------------
describe('seeding', () => {
  it('resetAll seeds transactions (fresh non-empty history)', () => {
    resetAll();
    expect(getState().transactions.length).toBeGreaterThan(0);
    // Seeded rows are labelled source:"seed".
    expect(getState().transactions.every((t) => t.source === 'seed')).toBe(true);
  });

  it('a user-set transaction list is not overwritten by a seed', () => {
    setPartial({
      transactions: [
        {
          id: 'only',
          when: new Date().toISOString(),
          merchant: 'Mine',
          amount: -1,
          category: 'other',
          source: 'manual',
        },
      ],
    });
    // No re-seed happens on a plain partial write.
    expect(getState().transactions.length).toBe(1);
    expect(getState().transactions[0]!.merchant).toBe('Mine');
  });
});

// ---------------------------------------------------------------------------
// getPersistBlob / hydrateFromBlob — native-persistence serialize round-trip
// (ENGINES §7 store-migration / RN_PORT "Store migration"). Pure + Node-safe.
// ---------------------------------------------------------------------------
describe('persist blob round-trip', () => {
  it('serializes the current state and rehydrates it faithfully', () => {
    setPartial({
      tightPointGoal: 180,
      nextYouNote: 'hold the line',
      onboarding: { done: true, name: 'Ada', payday: 1, monthlyIncome: 2600 },
    });
    const blob = getPersistBlob();

    // Drift away, then restore from the captured blob.
    setPartial({ tightPointGoal: null, nextYouNote: '' });
    hydrateFromBlob(blob);

    const s = getState();
    expect(s.tightPointGoal).toBe(180);
    expect(s.nextYouNote).toBe('hold the line');
    expect(s.onboarding.name).toBe('Ada');
    expect(s.onboarding.monthlyIncome).toBe(2600);
  });

  it('round-trips through the current schema version with the edit history intact', () => {
    setPartial({ transactions: [], edits: [] });
    const row = addTransaction({
      merchant: 'Tesco',
      amount: -42.1,
      category: 'food',
      source: 'manual',
    });
    editTransaction(row.id, { amount: -50 }, 'user');

    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    const s = getState();
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect((s.edits ?? []).length).toBe(1);
    expect(s.transactions.find((t) => t.id === row.id)?.amount).toBe(-50);
  });

  it('does not persist the ephemeral focus bridges; they hydrate to null', () => {
    setPartial({ calendarFocusDate: '2026-07-04', routeFocusDate: '2026-07-04' });
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;

    expect('calendarFocusDate' in parsed).toBe(false);
    expect('routeFocusDate' in parsed).toBe(false);

    hydrateFromBlob(getPersistBlob());
    expect(getState().calendarFocusDate).toBe(null);
    expect(getState().routeFocusDate).toBe(null);
  });

  it('a malformed blob leaves state untouched', () => {
    setPartial({ tightPointGoal: 99 });
    expect(hydrateFromBlob('not valid json')).toEqual({ status: 'malformed' });
    expect(getState().tightPointGoal).toBe(99);
  });

  it('classifies a future schema without publishing defaults or replacing current state', () => {
    setPartial({ tightPointGoal: 808 });
    const before = getPersistBlob();
    const future = JSON.parse(before) as Record<string, unknown>;
    future['schemaVersion'] = CURRENT_SCHEMA_VERSION + 1;
    future['tightPointGoal'] = 999;

    expect(hydrateFromBlob(JSON.stringify(future))).toEqual({
      status: 'incompatible-future-schema',
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    });
    expect(getPersistBlob()).toBe(before);
    expect(getState().tightPointGoal).toBe(808);
    expect(consumeLoadDegraded()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// load() degraded-path hardening (Plan 101). Before this plan, a present-but-
// wrong-shaped array field (e.g. `subs` persisted as a string) threw inside
// load()'s try block, and the catch swallowed it into the seeded `DEFAULTS` —
// which `hasAnyUserData` reads as TRUE, so persist.ts's backup-refresh gate
// would copy that just-corrupted blob over the last-good backup. The
// Array.isArray guards added to every array field close the throw itself;
// `consumeLoadDegraded()` is the escape hatch for persist.ts to detect a
// throw that happens anyway (e.g. from a field this suite cannot reach
// through the public hydrateFromBlob API) and treat the source file as
// unreadable instead of trusting the degraded state.
// ---------------------------------------------------------------------------
describe('load() degraded-path hardening', () => {
  it('a wrong-shaped subs field (string instead of array) degrades that field to its default instead of throwing', () => {
    const blob = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    blob.subs = 'corrupt';
    hydrateFromBlob(JSON.stringify(blob));

    // The Array.isArray guard (Step 1) means this shape no longer reaches
    // load()'s catch at all — the flag stays unset.
    expect(consumeLoadDegraded()).toBe(false);
    expect(Array.isArray(getState().subs)).toBe(true);
  });

  it('consumeLoadDegraded reads false after a clean hydrate and is read-once (consuming it clears it)', () => {
    hydrateFromBlob(getPersistBlob());

    // A healthy hydrate never sets the flag...
    expect(consumeLoadDegraded()).toBe(false);
    // ...and it does not leak `true` from some earlier degraded load in this
    // file — every read consumes/resets it, and load() also resets it at the
    // top of its own try block on every call.
    expect(consumeLoadDegraded()).toBe(false);

    // NOTE ON COVERAGE: with every array field in load() now Array.isArray-
    // guarded (Step 1), this suite cannot craft a blob that throws THROUGH
    // the public hydrateFromBlob API — every malformed shape this store
    // recognises degrades to a default instead of reaching load()'s catch.
    // The flag's actual throw path (persist.ts's tryHydrateFile treating
    // consumeLoadDegraded()===true as "unreadable" so it falls through to
    // the park-main + restore-backup path instead of refreshing the backup
    // from a just-degraded blob) is Step 3 of plan 101 and is exercised
    // end-to-end by Plan 102's persist recovery-matrix suite
    // (lib/persistRecovery.test.ts) — this file has no filesystem to drive
    // tryHydrateFile through.
  });
});

// ---------------------------------------------------------------------------
// readerCandidates — transient statement-reader review queue.
// Review-before-truth: candidates only, never auto-counted, and MUST NOT
// survive a restart — excluded from getPersistBlob, reset by load(), exactly
// like the ephemeral calendarFocusDate/routeFocusDate bridges.
// ---------------------------------------------------------------------------
describe('readerCandidates staging slot', () => {
  // Model-extracted candidates carry the lowest/most-tentative confidence so
  // they MUST be reviewed before becoming posted facts.
  const candidate = (over: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem => ({
    id: 'reader-1',
    source: 'csv',
    kind: 'spend',
    merchant: 'Tesco',
    amount: -42.1,
    confidence: 'low',
    ...over,
  });

  it('defaults to an empty queue', () => {
    expect(getState().readerCandidates).toEqual([]);
  });

  it('set then clear round-trips the staged candidates', () => {
    const txnsBefore = getState().transactions.length;
    const items = [
      candidate({ id: 'r1' }),
      candidate({ id: 'r2', merchant: 'Caffè Nero', amount: -4.2 }),
    ];
    setReaderCandidates(items);

    const staged = getState().readerCandidates;
    expect(staged.length).toBe(2);
    expect(staged.map((c) => c.id)).toEqual(['r1', 'r2']);
    // Every staged item is a tentative candidate — never a posted fact.
    expect(staged.every((c) => c.confidence === 'low')).toBe(true);
    // Staging does NOT auto-count: it never touches the transactions ledger.
    expect(getState().transactions.length).toBe(txnsBefore);

    clearReaderCandidates();
    expect(getState().readerCandidates).toEqual([]);
  });

  it('is dropped from the persist blob — the review queue must not survive a restart', () => {
    setReaderCandidates([candidate()]);
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;

    expect('readerCandidates' in parsed).toBe(false);
  });

  it('hydrate leaves the staging slot empty even if a blob smuggled candidates in', () => {
    // Stage candidates, then hand-build a blob that (illegitimately) carries
    // them, to prove hydrate resets the slot rather than trusting the disk.
    setReaderCandidates([candidate()]);
    const blob = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    blob.readerCandidates = [candidate({ id: 'smuggled' })];

    hydrateFromBlob(JSON.stringify(blob));

    expect(getState().readerCandidates).toEqual([]);
  });

  // RECALL (lib/merchantMemory.ts, DATA_INTELLIGENCE.md phase ③): setReaderCandidates is the single
  // choke point for both the LLM statement/photo reader and the on-device text/CSV parser, so recall
  // is applied here rather than at every producer.
  it('recall overrides a fresh model category guess with the remembered one', () => {
    rememberMerchantCategory('Tesco', 'food');
    setReaderCandidates([candidate({ id: 'r1', merchant: 'Tesco', category: 'other' })]);

    const [staged] = getState().readerCandidates as Array<
      CandidateMoneyItem & { rememberedCategory?: true }
    >;
    expect(staged?.category).toBe('food');
    expect(staged?.rememberedCategory).toBe(true);
  });

  it('a candidate for a merchant with no remembered category is staged unchanged', () => {
    setReaderCandidates([
      candidate({ id: 'r1', merchant: 'Never Corrected Ltd', category: 'other' }),
    ]);

    const [staged] = getState().readerCandidates as Array<
      CandidateMoneyItem & { rememberedCategory?: true }
    >;
    expect(staged?.category).toBe('other');
    expect(staged?.rememberedCategory).toBeUndefined();
  });
});

describe('encrypted source evidence lifecycle', () => {
  const evidenceId = 'evidence_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  function registerEvidence() {
    return addEvidenceDocument({
      id: evidenceId,
      filename: 'june-current-account.pdf',
      mediaType: 'application/pdf',
      byteSize: 4096,
      addedAtISO: '2026-07-15T12:00:00.000Z',
      sourceType: 'document',
      extractionStatus: 'read',
      storageState: 'encrypted-device-vault',
    });
  }

  it('persists metadata only and stamps the active workspace owner', () => {
    const stored = registerEvidence();

    expect(stored.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().evidenceDocuments).toEqual([stored]);
    const persisted = JSON.parse(getPersistBlob()) as {
      evidenceDocuments?: Array<Record<string, unknown>>;
    };
    expect(persisted.evidenceDocuments).toEqual([stored]);
    expect(persisted.evidenceDocuments?.[0]).not.toHaveProperty('uri');
  });

  it('keeps the source link through staging, review and a confirmed transaction', () => {
    registerEvidence();
    const candidate: CandidateMoneyItem = {
      id: 'reader-evidence-1',
      source: 'pdf',
      kind: 'spend',
      merchant: 'Supplier Ltd',
      amount: -42.1,
      confidence: 'low',
      sourceEvidenceId: evidenceId,
    };
    setReaderCandidates([candidate]);
    const queued = enqueueReviewItems(queueInputFromCandidates([candidate], 'pdf')).fresh[0]!;
    const transaction = addTransaction({
      merchant: queued.merchant,
      amount: queued.amount,
      category: 'shopping',
      source: 'manual',
      sourceEvidenceId: evidenceId,
    });

    expect(getState().readerCandidates[0]?.sourceEvidenceId).toBe(evidenceId);
    expect(queued.sourceEvidenceId).toBe(evidenceId);
    expect(transaction.sourceEvidenceId).toBe(evidenceId);
  });

  it('links a later encrypted receipt without replacing original import provenance', () => {
    registerEvidence();
    const receiptId = 'evidence_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    addEvidenceDocument({
      id: receiptId,
      filename: 'supplier-receipt.jpg',
      mediaType: 'image/jpeg',
      byteSize: 2048,
      addedAtISO: '2026-07-16T09:00:00.000Z',
      sourceType: 'image',
      extractionStatus: 'not-requested',
      storageState: 'encrypted-device-vault',
    });
    const transaction = addTransaction({
      merchant: 'Supplier Ltd',
      amount: -42.1,
      category: 'shopping',
      source: 'manual',
      sourceEvidenceId: evidenceId,
    });

    expect(attachEvidenceDocumentToTransaction(receiptId, transaction.id)).toBe(true);
    expect(attachEvidenceDocumentToTransaction(receiptId, transaction.id)).toBe(false);
    expect(getState().transactions.find((row) => row.id === transaction.id)?.sourceEvidenceId).toBe(
      evidenceId,
    );
    expect(getState().evidenceDocuments?.find((row) => row.id === receiptId)).toMatchObject({
      linkedTransactionIds: [transaction.id],
    });
    expect(JSON.parse(getPersistBlob()).evidenceDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: receiptId, linkedTransactionIds: [transaction.id] }),
      ]),
    );

    expect(detachEvidenceDocumentFromTransaction(receiptId, transaction.id)).toBe(true);
    expect(getState().evidenceDocuments?.find((row) => row.id === receiptId)).not.toHaveProperty(
      'linkedTransactionIds',
    );
    expect(detachEvidenceDocumentFromTransaction(receiptId, transaction.id)).toBe(false);
  });

  it('clears receipt relationships when a transaction is removed but keeps the encrypted file', () => {
    const receipt = registerEvidence();
    const transaction = addTransaction({
      merchant: 'Supplier Ltd',
      amount: -42.1,
      category: 'shopping',
      source: 'manual',
    });
    attachEvidenceDocumentToTransaction(receipt.id, transaction.id);

    removeTransaction(transaction.id);

    expect(getState().transactions.some((row) => row.id === transaction.id)).toBe(false);
    expect(getState().evidenceDocuments).toHaveLength(1);
    expect(getState().evidenceDocuments?.[0]).not.toHaveProperty('linkedTransactionIds');
  });

  it('keeps the source link and filename through bulk history and its import log', () => {
    registerEvidence();
    setPartial({ transactions: [], statementImports: [] });
    addStatementAsHistory([
      {
        id: 'reader-evidence-history',
        source: 'pdf',
        kind: 'spend',
        merchant: 'Supplier Ltd',
        amount: -125,
        date: '2026-07-12',
        confidence: 'low',
        sourceEvidenceId: evidenceId,
      },
    ]);

    expect(getState().transactions[0]?.sourceEvidenceId).toBe(evidenceId);
    expect(getState().statementImports?.[0]).toMatchObject({
      filename: 'june-current-account.pdf',
      sourceEvidenceId: evidenceId,
    });
  });

  it('fails closed for missing, cross-workspace or conflicting evidence metadata', () => {
    expect(() =>
      setReaderCandidates([
        {
          id: 'missing-evidence-candidate',
          source: 'pdf',
          kind: 'spend',
          merchant: 'Unknown',
          amount: -1,
          confidence: 'low',
          sourceEvidenceId: evidenceId,
        },
      ]),
    ).toThrow(/unavailable in this workspace/);

    expect(() =>
      addEvidenceDocument({
        id: evidenceId,
        workspaceId: createWorkspaceId('workspace_business_wrong'),
        filename: 'wrong.pdf',
        mediaType: 'application/pdf',
        byteSize: 1,
        addedAtISO: '2026-07-15T12:00:00.000Z',
        sourceType: 'document',
        extractionStatus: 'read',
        storageState: 'encrypted-device-vault',
      }),
    ).toThrow(/belongs to workspace/);

    registerEvidence();
    expect(() =>
      addEvidenceDocument({
        id: evidenceId,
        filename: 'different.pdf',
        mediaType: 'application/pdf',
        byteSize: 4096,
        addedAtISO: '2026-07-15T12:00:00.000Z',
        sourceType: 'document',
        extractionStatus: 'read',
        storageState: 'encrypted-device-vault',
      }),
    ).toThrow(/conflicts/);
  });

  it('removes metadata and every link atomically while keeping confirmed records', () => {
    registerEvidence();
    const candidate: CandidateMoneyItem = {
      id: 'reader-remove-evidence',
      source: 'pdf',
      kind: 'spend',
      merchant: 'Evidence row',
      amount: -7,
      confidence: 'low',
      sourceEvidenceId: evidenceId,
    };
    setReaderCandidates([candidate]);
    enqueueReviewItems(queueInputFromCandidates([candidate], 'pdf'));
    setPartial({ transactions: [], statementImports: [] });
    addStatementAsHistory([
      { ...candidate, id: 'reader-remove-history', merchant: 'Confirmed evidence row' },
    ]);

    expect(removeEvidenceDocument(evidenceId)).toBe(true);
    const after = getState();
    expect(after.evidenceDocuments).toEqual([]);
    expect(after.transactions).toHaveLength(1);
    expect(after.statementImports).toHaveLength(1);
    expect(after.transactions[0]).not.toHaveProperty('sourceEvidenceId');
    expect(after.statementImports?.[0]).not.toHaveProperty('sourceEvidenceId');
    expect(after.readerCandidates[0]).not.toHaveProperty('sourceEvidenceId');
    expect(after.reviewQueue?.[0]).not.toHaveProperty('sourceEvidenceId');
    expect(removeEvidenceDocument(evidenceId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readerClosingBalance — the readerCandidates sibling threading the reader's
// closing-balance result (StatementReadResult.closingBalance) through to
// BulkStatementLanding. Proves the FULL thread — a reader 'ok' result with a
// closing balance survives into the staging slot, and clearReaderCandidates
// wipes it alongside the candidates — not just that the two ends exist.
// ---------------------------------------------------------------------------
describe('readerClosingBalance staging slot', () => {
  const candidate = (over: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem => ({
    id: 'reader-1',
    source: 'csv',
    kind: 'spend',
    merchant: 'Tesco',
    amount: -42.1,
    confidence: 'low',
    ...over,
  });

  it('defaults to null', () => {
    expect(getState().readerClosingBalance).toBeNull();
  });

  it('a reader "ok" result with a closing balance survives the same store write IntakeScreen makes', () => {
    // Mirrors IntakeScreen's runReader handler: on `result.kind === 'ok'`, it calls
    // setReaderCandidates(result.candidates) THEN setReaderClosingBalance(result.closingBalance) —
    // the exact shape `extractStatementCandidates` returns (statementReaderClient.ts).
    const result = {
      kind: 'ok' as const,
      candidates: [candidate()],
      closingBalance: { amount: 1.96, asOfISO: '2026-06-30' },
    };
    setReaderCandidates(result.candidates);
    setReaderClosingBalance(result.closingBalance);

    expect(getState().readerCandidates).toHaveLength(1);
    expect(getState().readerClosingBalance).toEqual({ amount: 1.96, asOfISO: '2026-06-30' });
  });

  it('a reader "ok" result with no closing balance stages null, not undefined or a stale value', () => {
    setReaderCandidates([candidate({ id: 'r1' })]);
    setReaderClosingBalance({ amount: 250, asOfISO: '2026-06-01' });

    // A later read (e.g. the chunked reader, which never surfaces one) explicitly clears it.
    setReaderCandidates([candidate({ id: 'r2' })]);
    setReaderClosingBalance(null);

    expect(getState().readerClosingBalance).toBeNull();
  });

  it('clearReaderCandidates wipes the balance alongside the candidates (the read-once wipe)', () => {
    setReaderCandidates([candidate()]);
    setReaderClosingBalance({ amount: 12.34, asOfISO: '2026-05-15' });

    clearReaderCandidates();

    expect(getState().readerCandidates).toEqual([]);
    expect(getState().readerClosingBalance).toBeNull();
  });

  it('is dropped from the persist blob — must not survive a restart', () => {
    setReaderCandidates([candidate()]);
    setReaderClosingBalance({ amount: 1.96, asOfISO: '2026-06-30' });
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;

    expect('readerClosingBalance' in parsed).toBe(false);
  });

  it('hydrate leaves the balance null even if a blob smuggled one in', () => {
    setReaderClosingBalance({ amount: 1.96, asOfISO: '2026-06-30' });
    const blob = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    blob.readerClosingBalance = { amount: 999, asOfISO: '2026-01-01' };

    hydrateFromBlob(JSON.stringify(blob));

    expect(getState().readerClosingBalance).toBeNull();
  });

  it('resetToEmpty clears the balance', () => {
    setReaderClosingBalance({ amount: 1.96, asOfISO: '2026-06-30' });
    resetToEmpty();
    expect(getState().readerClosingBalance).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// schema migration — v6 → v7 introduces the PERSISTED reviewQueue (the design
// source's v7→v8 seam, ported 1:1). Unlike readerCandidates above, this queue
// survives a restart.
// ---------------------------------------------------------------------------
describe('schema migration v7', () => {
  it('a pre-v7 blob with no reviewQueue migrates to an empty queue, byte-identical otherwise', () => {
    resetAll();
    // Simulate a persisted v6 blob (no reviewQueue field at all).
    const v6Blob = { ...getState(), schemaVersion: 6 } as Record<string, unknown>;
    delete v6Blob.reviewQueue;
    hydrateFromBlob(JSON.stringify(v6Blob));

    const s = getState();
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.reviewQueue).toEqual([]);
  });

  it('a blob that already carries queued items keeps them intact across migration', () => {
    enqueueReviewItems([{ source: 'pdf', merchant: 'Tesco', amount: -42.1, date: '2026-07-01' }]);
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    const queue = getState().reviewQueue ?? [];
    expect(queue.length).toBe(1);
    expect(queue[0]!.merchant).toBe('Tesco');
    expect(queue[0]!.source).toBe('pdf');
  });

  it('a blob predating reviewQueueSpillover (phase ⑦) loads with an empty spillover', () => {
    resetAll();
    const preSpilloverBlob = { ...getState() } as Record<string, unknown>;
    delete preSpilloverBlob.reviewQueueSpillover;
    hydrateFromBlob(JSON.stringify(preSpilloverBlob));

    expect(getState().reviewQueueSpillover).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Demo/seed containment (owner rule 2026-07-06): shipped demo data must NEVER
// be shown as a real user's own money. A real user's state is cleaned of seed
// records on load (OTA cleanup for already-contaminated devices), and an import
// atomically replaces any lingering demo set — real + demo never coexist. Seed
// records are stripped ONLY by unambiguous marker; a real sub the user owns
// (even one named like a seed sub) is never fuzzy-deleted.
// ---------------------------------------------------------------------------
describe('demo/seed containment', () => {
  function candidate(over: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem {
    return {
      id: `cand-${Math.random().toString(36).slice(2)}`,
      source: 'pdf',
      kind: 'spend',
      merchant: 'Tesco',
      amount: -10,
      confidence: 'low',
      ...over,
    };
  }

  it('isRealUser is false for the untouched demo/preview state, true once real data exists', () => {
    resetAll(); // seeds the full demo set
    expect(isRealUser(getState())).toBe(false);
    setPartial({ onboarding: { ...getState().onboarding, done: true } });
    expect(isRealUser(getState())).toBe(true);
  });

  it('stripSeedData removes every seed-marked record and is idempotent', () => {
    resetAll();
    const stripped = stripSeedData(getState());
    expect(stripped.transactions.some((t) => t.source === 'seed')).toBe(false);
    expect((stripped.debts ?? []).some((d) => d.id === 'seed-klarna' || d.id === 'seed-loan')).toBe(
      false,
    );
    expect((stripped.plans ?? []).some((p) => p.id === 'seed-macbook')).toBe(false);
    expect(stripped.currentBalance.source).not.toBe('sample');
    expect(stripped.pots).toEqual([]); // untouched seed pot set → cleared
    expect(stripped.subs).toEqual([]); // untouched default sub set → cleared
    // Idempotent — running it again changes nothing.
    expect(stripSeedData(stripped)).toEqual(stripped);
  });

  it('stripSeedData NEVER deletes a real sub the user owns (even one named like a seed sub)', () => {
    resetAll();
    // A modified sub set (not the untouched default) — e.g. the user's own Spotify only.
    const realSpotify = {
      name: 'Spotify',
      cost: 9.99,
      nextRenewalDaysAway: 5,
      lastUsedDaysAgo: 0,
      usesPerMonth: 30,
    };
    setPartial({ subs: [realSpotify] });
    expect(stripSeedData(getState()).subs).toEqual([owned(realSpotify)]);
  });

  it('stripSeedData does NOT delete real onboarding pots that reuse seed pot ids', () => {
    resetAll();
    // OnboardingSheet builds real pots with the SAME ids as the seed pots, but
    // saved:0 and the user's own goals — they are NOT the shipped seed objects
    // and MUST survive. Regression for the id-collision review finding: keying
    // the strip on ids alone would wipe these real, user-created pots.
    const onboardingPots = [
      {
        id: 'holiday',
        name: 'Holiday · September',
        saved: 0,
        goal: 1200,
        perWeek: 35,
        accent: true,
      },
      { id: 'buffer', name: 'Buffer', saved: 0, goal: 500, perWeek: 20, accent: false },
      { id: 'christmas', name: 'Christmas', saved: 0, goal: 300, perWeek: 15, accent: false },
    ];
    setPartial({ onboarding: { ...getState().onboarding, done: true }, pots: onboardingPots });
    expect(stripSeedData(getState()).pots).toEqual(onboardingPots.map(owned));
  });

  it('strips a seed debt even after another engine modified a field (matched by seed-* id), keeps real debts', () => {
    resetAll();
    // Simulate an engine having touched the seed loan (changed balance + added a
    // linked field), so it no longer field-matches DEFAULTS.debts. It must STILL
    // be stripped — by its unambiguous `seed-*` id — while a real card is kept.
    const modifiedSeedDebt = {
      id: 'seed-loan',
      name: 'Personal loan',
      kind: 'loan' as const,
      balance: 999,
      apr: 12.9,
      minPayment: 120,
      dueDom: 5,
      addedAt: '2026-03-01T00:00:00.000Z',
      linkedAccountId: 'acct-x',
    };
    const realDebt = {
      id: 'debt-real-1',
      name: 'My real loan',
      kind: 'loan' as const,
      balance: 100,
      apr: 20,
      minPayment: 10,
      dueDom: 1,
      addedAt: '2026-07-01T00:00:00.000Z',
    };
    setPartial({
      onboarding: { ...getState().onboarding, done: true },
      debts: [modifiedSeedDebt, realDebt],
    });
    const stripped = stripSeedData(getState());
    expect((stripped.debts ?? []).some((d) => d.id.startsWith('seed-'))).toBe(false);
    expect((stripped.debts ?? []).find((d) => d.id === 'debt-real-1')).toBeTruthy();
  });

  it('purgeSeedIfReal is a reference-equal no-op on a demo state, and strips on a real one', () => {
    resetAll();
    const demo = getState();
    expect(purgeSeedIfReal(demo)).toBe(demo); // isRealUser false → untouched
    setPartial({ onboarding: { ...getState().onboarding, done: true } });
    expect(purgeSeedIfReal(getState()).transactions.some((t) => t.source === 'seed')).toBe(false);
  });

  it('OTA cleanup: a REAL user blob with leaked demo data is cleaned on load; real data survives', () => {
    // The owner-device scenario: a real, onboarded user whose ledger ALSO holds
    // shipped demo records (seed txns + Klarna/loan + MacBook) — exactly what
    // leaked past onboarding. Persist + hydrate == the OTA build reloading the
    // device blob.
    resetAll();
    const realTxn: Transaction = {
      id: 'imp-real-1',
      when: '2026-03-03T00:00:00.000Z',
      merchant: 'Real Shop',
      amount: -12.5,
      category: 'food',
      source: 'manual', // a real (non-seed) row — how imported/added rows land
    };
    setPartial({
      onboarding: { ...getState().onboarding, done: true },
      transactions: [realTxn, ...getState().transactions], // real + seed mixed
    });
    hydrateFromBlob(getPersistBlob());

    const s = getState();
    expect(s.transactions.some((t) => t.source === 'seed')).toBe(false);
    expect((s.debts ?? []).some((d) => d.id === 'seed-klarna' || d.id === 'seed-loan')).toBe(false);
    expect((s.plans ?? []).some((p) => p.id === 'seed-macbook')).toBe(false);
    expect(s.transactions.find((t) => t.id === 'imp-real-1')).toBeTruthy(); // real data intact
  });

  it('an import into a still-demo state atomically replaces the demo set (no mixing)', () => {
    resetAll(); // demo: seed txns + Klarna/loan + MacBook + £720 sample balance
    expect(isRealUser(getState())).toBe(false);
    addStatementAsHistory([candidate({ merchant: 'Real Co', amount: -20, date: '2026-03-03' })]);

    const s = getState();
    expect(s.transactions.some((t) => t.source === 'seed')).toBe(false); // demo txns gone
    expect(s.transactions.some((t) => t.merchant === 'Real Co')).toBe(true); // real landed
    expect((s.debts ?? []).some((d) => d.id === 'seed-klarna')).toBe(false); // demo debt gone
    expect((s.plans ?? []).some((p) => p.id === 'seed-macbook')).toBe(false); // demo plan gone
    expect(s.currentBalance.source).not.toBe('sample');
  });
});

// ---------------------------------------------------------------------------
// schema migration — v7 → v8 introduces the income-cadence model
// (`incomeSources`, see lib/income.ts). Every pre-v8 install synthesizes
// exactly ONE monthly source ("Pay") from its legacy onboarding.payday +
// .monthlyIncome, so a real user's existing pay setup is carried forward
// honestly instead of silently discarded on upgrade.
// ---------------------------------------------------------------------------
describe('schema migration v8', () => {
  it('synthesizes one monthly "Pay" source from legacy onboarding.payday + monthlyIncome', () => {
    resetAll();
    setPartial({
      onboarding: { ...getState().onboarding, done: true, payday: 28, monthlyIncome: 2500 },
    });
    // Simulate a persisted v7 blob (no incomeSources field at all).
    const v7Blob = { ...getState(), schemaVersion: 7 } as Record<string, unknown>;
    delete v7Blob.incomeSources;
    hydrateFromBlob(JSON.stringify(v7Blob));

    const s = getState();
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.incomeSources).toEqual([
      {
        id: 'income-migrated-pay',
        label: 'Pay',
        cadence: 'monthly',
        dayOfMonth: 28,
        amount: 2500,
        source: 'onboarding',
        workspaceId: PERSONAL_WORKSPACE_ID,
      },
    ]);
  });

  it('leaves every other field byte-identical across the v7 -> v8 migration', () => {
    resetToEmpty();
    const before = getState();
    const v7Blob = { ...before, schemaVersion: 7 } as Record<string, unknown>;
    delete v7Blob.incomeSources;
    hydrateFromBlob(JSON.stringify(v7Blob));

    const after = getState();
    const {
      incomeSources: _incomeAfter,
      schemaVersion: _versionAfter,
      subs: subsAfter,
      ...restAfter
    } = after;
    const {
      incomeSources: _incomeBefore,
      schemaVersion: _versionBefore,
      subs: subsBefore,
      ...restBefore
    } = before;
    expect(restAfter).toEqual(restBefore);
    // Subs compare modulo `nextRenewalISO`: EVERY hydration deliberately synthesizes the date
    // anchor for legacy subs (the Phase-2 relative-day-rot fix — lib/renewalMath.ts
    // `reanchorRenewals`, called by load()). That is hydration behaviour, not migration drift;
    // everything else about each sub must still be byte-identical.
    const stripAnchor = (subs: typeof subsAfter) =>
      subs.map(({ nextRenewalISO: _anchor, ...rest }) => rest);
    expect(stripAnchor(subsAfter)).toEqual(stripAnchor(subsBefore));
    expect(subsAfter.every((sub) => typeof sub.nextRenewalISO === 'string')).toBe(true);
  });

  it('a blob that already carries incomeSources keeps them intact across migration (not re-synthesized)', () => {
    resetAll();
    const existing: IncomeSource[] = [
      {
        id: 'weekly-wage',
        label: 'Weekly wage',
        cadence: 'weekly',
        anchorISO: '2026-06-05',
        amount: 400,
        source: 'manual',
      },
    ];
    setIncomeSources(existing);
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    expect(getState().incomeSources).toEqual(existing.map(owned));
  });

  it('a fresh install (DEFAULTS) has an empty incomeSources list', () => {
    resetAll();
    expect(getState().incomeSources).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// schema migration — v8 → v9 introduces the production workspace root. This version deliberately
// locks the still-global top-level data partition to Personal; Business cannot be selected until
// every row and query seam is workspace-scoped.
// ---------------------------------------------------------------------------
describe('schema migration v9 workspace root', () => {
  it('assigns a pre-workspace persisted store to one immutable Personal data partition', () => {
    resetToEmpty();
    addTransaction({ merchant: 'Real shop', amount: -12.5, category: 'food', source: 'manual' });
    const before = getState();
    const v8Blob = { ...before, schemaVersion: 8 } as Record<string, unknown>;
    delete v8Blob.workspaces;
    delete v8Blob.activeWorkspaceId;
    delete v8Blob.dataWorkspaceId;

    hydrateFromBlob(JSON.stringify(v8Blob));

    const after = getState();
    expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(after.activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(after.dataWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(after.workspaces).toEqual([
      expect.objectContaining({
        id: PERSONAL_WORKSPACE_ID,
        kind: 'personal',
        name: 'Personal',
        encryptedSubkeyId: PERSONAL_WORKSPACE_SUBKEY_ID,
        archivedAt: null,
      }),
    ]);
    expect(after.transactions).toEqual(before.transactions);
  });

  it('does not trust a crafted Business activation before entity/query isolation exists', () => {
    const blob = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    const personal = getState().workspaces[0]!;
    blob.workspaces = [
      personal,
      {
        ...personal,
        id: 'workspace_business_injected',
        kind: 'business',
        name: 'Injected Ltd',
        encryptedSubkeyId: 'workspace-subkey-business-injected',
      },
    ];
    blob.activeWorkspaceId = 'workspace_business_injected';
    blob.dataWorkspaceId = 'workspace_business_injected';

    hydrateFromBlob(JSON.stringify(blob));

    expect(getState().workspaces).toEqual([personal]);
    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().dataWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
  });

  it('persists the Personal workspace root across a native blob round-trip', () => {
    const before = getState();
    const blob = getPersistBlob();
    resetAll();
    hydrateFromBlob(blob);

    expect(getState().workspaces).toEqual(before.workspaces);
    expect(getState().activeWorkspaceId).toBe(before.activeWorkspaceId);
    expect(getState().dataWorkspaceId).toBe(before.dataWorkspaceId);
  });

  it('clean reset cannot leave a Business selection or subkey behind', () => {
    expect(() =>
      setPartial({
        activeWorkspaceId: 'workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID,
        dataWorkspaceId: 'workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID,
      }),
    ).toThrow(/complete, verified partition replacement/);

    resetToEmpty();

    expect(getState().workspaces).toHaveLength(1);
    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().dataWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().workspaces[0]?.encryptedSubkeyId).toBe(PERSONAL_WORKSPACE_SUBKEY_ID);
  });
});

describe('schema v11 isolated workspace partitions', () => {
  it('builds and hydrates a genuinely empty Business partition without Personal or sample rows', () => {
    resetToEmpty();
    const personalBlob = getPersistBlob(PERSONAL_WORKSPACE_ID);
    const personalRoot = createPersonalWorkspaceRoot();
    const businessId = createWorkspaceId('workspace_business_partition_test');
    const business = createBusinessWorkspace({
      id: businessId,
      name: 'Studio Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-partition-v1',
    });
    const businessRoot = {
      workspaces: [...personalRoot.workspaces, business],
      activeWorkspaceId: businessId,
      dataWorkspaceId: businessId,
    };
    const partition = createEmptyWorkspacePartition(
      businessRoot,
      businessId,
      '2026-07-15T20:00:00.000Z',
    );

    expect(partition.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(partition.accounts).toEqual([]);
    expect(partition.transactions).toEqual([]);
    expect(partition.pots).toEqual([]);
    expect(partition.subs).toEqual([]);
    expect(partition.reviewQueue).toEqual([]);
    expect(JSON.stringify(partition)).not.toContain('Pret');
    expect(JSON.stringify(partition)).not.toContain('workspaceId":"workspace_personal_local');

    const raw = JSON.stringify(partition);
    hydrateFromBlob(raw, businessId);
    expect(getState().activeWorkspaceId).toBe(businessId);
    expect(getState().dataWorkspaceId).toBe(businessId);
    expect(getState().workspaces).toHaveLength(2);
    expect(getPersistBlob(businessId)).not.toContain('workspace_personal_local","merchant');
    expect(() => hydrateFromBlob(raw, PERSONAL_WORKSPACE_ID)).toThrow(/does not belong/);

    resetToEmpty();
    expect(getState().activeWorkspaceId).toBe(businessId);
    expect(getState().dataWorkspaceId).toBe(businessId);
    expect(getState().workspaces).toEqual(businessRoot.workspaces);
    expect(getState().accounts).toEqual([]);
    expect(getState().transactions).toEqual([]);

    hydrateFromBlob(personalBlob, PERSONAL_WORKSPACE_ID);
    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
  });

  it('keeps Business operations inside the active encrypted Business partition', () => {
    resetToEmpty();
    const personalBlob = getPersistBlob(PERSONAL_WORKSPACE_ID);
    const personalRoot = createPersonalWorkspaceRoot();
    const businessId = createWorkspaceId('workspace_business_operations_test');
    const businessWorkspace = createBusinessWorkspace({
      id: businessId,
      name: 'Exact Studio Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-operations-v1',
    });
    const businessRoot = {
      workspaces: [...personalRoot.workspaces, businessWorkspace],
      activeWorkspaceId: businessId,
      dataWorkspaceId: businessId,
    };
    const partition = createEmptyWorkspacePartition(
      businessRoot,
      businessId,
      '2026-07-18T20:00:00.000Z',
    );
    hydrateFromBlob(JSON.stringify(partition), businessId);

    updateBusinessOperations((current) => ({
      entity: {
        kind: 'sole-trader',
        tradingName: 'Exact Studio',
        taxRegion: 'england-ni',
        studentLoanPlans: [],
        vat: { registered: false },
        createdAt: '2026-07-18T20:00:00.000Z',
      },
      clients: [
        ...current.clients,
        {
          id: 'client-exact',
          name: 'Real Client',
          createdAt: '2026-07-18T20:01:00.000Z',
        },
      ],
    }));

    const businessBlob = getPersistBlob(businessId);
    expect(JSON.parse(businessBlob).business).toMatchObject({
      entity: { kind: 'sole-trader', tradingName: 'Exact Studio' },
      clients: [{ id: 'client-exact', name: 'Real Client' }],
    });

    hydrateFromBlob(personalBlob, PERSONAL_WORKSPACE_ID);
    expect(getState().business?.entity).toBeNull();
    expect(getState().business?.clients).toEqual([]);
    expect(() => updateBusinessOperations({ ytdProfitMinor: 100_000 })).toThrow(
      /active Business workspace/,
    );
  });

  it('ticks the Business weekly streak from that partition runway and overdue invoices', () => {
    resetToEmpty();
    const personalRoot = createPersonalWorkspaceRoot();
    const businessId = createWorkspaceId('workspace_business_weekly_progress_test');
    const businessWorkspace = createBusinessWorkspace({
      id: businessId,
      name: 'Weekly Studio Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-weekly-progress-v1',
    });
    const partition = createEmptyWorkspacePartition(
      {
        workspaces: [...personalRoot.workspaces, businessWorkspace],
        activeWorkspaceId: businessId,
        dataWorkspaceId: businessId,
      },
      businessId,
      '2026-07-05T12:00:00.000Z',
    );
    hydrateFromBlob(JSON.stringify(partition), businessId);
    addAccount({
      name: 'Business current',
      kind: 'bank',
      balanceMinor: 1_000,
    });
    updateBusinessOperations({
      obligations: [
        {
          id: 'obligation-software',
          label: 'Software',
          amountMinor: 3_000,
          cadence: 'monthly',
          nextDue: '2026-07-10',
          category: 'software',
        },
      ],
    });

    expect(refreshBusinessMeloProgress(new Date('2026-07-06T12:00:00.000Z'))).toBe(true);
    expect(getState().streak).toMatchObject({
      count: 1,
      bestCount: 1,
      lastQualifiedCycleId: 'business-week:2026-W27',
    });
    const sameWeekStreak = getState().streak;
    refreshBusinessMeloProgress(new Date('2026-07-10T12:00:00.000Z'));
    expect(getState().streak).toBe(sameWeekStreak);

    updateBusinessOperations({
      invoices: [
        {
          id: 'invoice-overdue',
          clientId: 'client-overdue',
          clientName: 'Late Client',
          issuedOn: '2026-06-01',
          dueOn: '2026-07-12',
          totalMinor: 50_000,
          paidMinor: 0,
          status: 'overdue',
        },
      ],
    });
    expect(refreshBusinessMeloProgress(new Date('2026-07-13T12:00:00.000Z'))).toBe(true);
    expect(getState().streak).toMatchObject({
      count: 0,
      bestCount: 1,
      lastQualifiedCycleId: null,
    });
  });

  it('publishes and rolls back one owner-transfer partition leg as one cash-and-ledger change', () => {
    resetToEmpty();
    const personalRoot = createPersonalWorkspaceRoot();
    const businessId = createWorkspaceId('workspace_business_owner_leg_test');
    const businessWorkspace = createBusinessWorkspace({
      id: businessId,
      name: 'Owner Studio Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-owner-leg-v1',
    });
    const partition = createEmptyWorkspacePartition(
      {
        workspaces: [...personalRoot.workspaces, businessWorkspace],
        activeWorkspaceId: businessId,
        dataWorkspaceId: businessId,
      },
      businessId,
      '2026-07-18T20:00:00.000Z',
    );
    hydrateFromBlob(JSON.stringify(partition), businessId);
    const account = addAccount({
      name: 'Business current',
      kind: 'bank',
      balanceMinor: 1_000,
    });

    const leg = recordWorkspaceOwnerTransferLeg({
      transferId: 'owner-transfer-test',
      label: 'Owner transfer · dividend · to Personal',
      amount: 250,
      direction: 'out',
      when: '2026-07-18T21:00:00.000Z',
    });

    expect((getState().accounts ?? []).find((row) => row.id === account.id)?.balanceMinor).toBe(
      750,
    );
    expect(getState().currentBalance.amount).toBe(750);
    expect(getState().transactions.find((row) => row.id === leg.transactionId)).toMatchObject({
      amount: -250,
      accountId: account.id,
      externalId: 'owner-transfer-test',
      workspaceId: businessId,
    });

    expect(rollbackWorkspaceOwnerTransferLeg(leg.transactionId)).toBe(true);
    expect((getState().accounts ?? []).find((row) => row.id === account.id)?.balanceMinor).toBe(
      1_000,
    );
    expect(getState().transactions.some((row) => row.id === leg.transactionId)).toBe(false);
  });
});

describe('schema migration v10 workspace-owned rows', () => {
  it('assigns every legacy persisted row to Personal without dropping real values', () => {
    resetToEmpty();
    setPartial({
      transactions: [
        {
          id: 'legacy-transaction',
          when: '2026-07-14T12:00:00.000Z',
          merchant: 'Real shop',
          amount: -12.5,
          category: 'food',
          source: 'manual',
        },
      ],
      calendarEvents: [
        {
          id: 'legacy-calendar',
          date: '2026-07-20',
          kind: 'deadline',
          title: 'File return',
        },
      ],
      reviewQueue: [
        {
          id: 'legacy-review',
          source: 'pdf',
          merchant: 'Needs review',
          amount: -8,
          addedAt: '2026-07-15T12:00:00.000Z',
        },
      ],
      statementImports: [
        {
          id: 'legacy-import',
          source: 'pdf',
          rowCount: 1,
          atISO: '2026-07-15T12:00:00.000Z',
        },
      ],
    });

    const v9Blob = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    v9Blob.schemaVersion = 9;
    for (const collection of PERSISTED_WORKSPACE_ROW_COLLECTIONS) {
      const rows = v9Blob[collection];
      if (!Array.isArray(rows)) continue;
      v9Blob[collection] = rows.map((candidate) => {
        const { workspaceId: _legacyMissing, ...row } = candidate as Record<string, unknown>;
        return row;
      });
    }

    hydrateFromBlob(JSON.stringify(v9Blob));

    const after = getState();
    expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(after.transactions[0]).toMatchObject({
      id: 'legacy-transaction',
      merchant: 'Real shop',
      amount: -12.5,
      workspaceId: PERSONAL_WORKSPACE_ID,
    });
    expect(after.calendarEvents[0]?.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(after.reviewQueue?.[0]?.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(after.statementImports?.[0]?.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    for (const collection of PERSISTED_WORKSPACE_ROW_COLLECTIONS) {
      const rows = (after as unknown as Record<string, unknown>)[collection];
      if (!Array.isArray(rows)) continue;
      expect(
        rows.every(
          (candidate) =>
            (candidate as Record<string, unknown>).workspaceId === PERSONAL_WORKSPACE_ID,
        ),
        collection,
      ).toBe(true);
    }
  });

  it('stamps ordinary writes and the native persist blob with the active Personal owner', () => {
    setPartial({
      transactions: [
        {
          id: 'new-write',
          when: '2026-07-15T12:00:00.000Z',
          merchant: 'Owner row',
          amount: -3,
          category: 'other',
          source: 'manual',
        },
      ],
    });

    expect(getState().transactions[0]?.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    const persisted = JSON.parse(getPersistBlob()) as {
      transactions: Array<{ workspaceId?: string }>;
    };
    expect(persisted.transactions[0]?.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
  });

  it('rejects a crafted Business-owned row instead of rewriting or filtering it', () => {
    const before = getState().transactions;

    expect(() =>
      setPartial({
        transactions: [
          {
            id: 'business-leak',
            when: '2026-07-15T12:00:00.000Z',
            merchant: 'Must not land',
            amount: -99,
            category: 'other',
            source: 'manual',
            workspaceId: 'workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID,
          },
        ],
      }),
    ).toThrow(/belongs to workspace workspace_business_injected/);
    expect(getState().transactions).toBe(before);
  });

  it('requires an explicit valid workspace for repository reads', () => {
    setPartial({
      transactions: [
        {
          id: 'repository-row',
          when: '2026-07-15T12:00:00.000Z',
          merchant: 'Scoped read',
          amount: -4,
          category: 'other',
          source: 'manual',
        },
      ],
    });

    const repository = getWorkspaceRowRepository(PERSONAL_WORKSPACE_ID);
    expect(repository.list('transactions')).toBe(getState().transactions);
    expect(() =>
      getWorkspaceRowRepository('workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID),
    ).toThrow(/unavailable/);
  });

  it('rejects a crafted partial workspace switch before it can poison later reads or writes', () => {
    expect(() =>
      setPartial({
        activeWorkspaceId: 'workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID,
      }),
    ).toThrow(/complete, verified partition replacement/);

    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    setPartial({ nextYouNote: 'still Personal' });
    expect(getState().nextYouNote).toBe('still Personal');
  });
});

// ---------------------------------------------------------------------------
// incomeSources setters — setIncomeSources / upsertIncomeSource / removeIncomeSource
// ---------------------------------------------------------------------------
describe('income sources setters', () => {
  const weekly: IncomeSource = {
    id: 'src-weekly',
    label: 'Weekly wage',
    cadence: 'weekly',
    anchorISO: '2026-06-05',
    amount: 400,
    source: 'manual',
  };
  const monthly: IncomeSource = {
    id: 'src-monthly',
    label: 'Side gig',
    cadence: 'monthly',
    dayOfMonth: 10,
    amount: 200,
    source: 'manual',
  };

  it('setIncomeSources replaces the whole list', () => {
    setIncomeSources([weekly]);
    expect(getState().incomeSources).toEqual([owned(weekly)]);
    setIncomeSources([weekly, monthly]);
    expect(getState().incomeSources).toEqual([owned(weekly), owned(monthly)]);
  });

  it('setIncomeSources accepts an updater function over the previous list', () => {
    setIncomeSources([weekly]);
    setIncomeSources((prev) => [...prev, monthly]);
    expect(getState().incomeSources).toEqual([owned(weekly), owned(monthly)]);
  });

  it('upsertIncomeSource adds a new source by id', () => {
    setIncomeSources([weekly]);
    upsertIncomeSource(monthly);
    expect(getState().incomeSources).toEqual([owned(weekly), owned(monthly)]);
  });

  it('upsertIncomeSource replaces an existing source with the same id (immutable)', () => {
    setIncomeSources([weekly]);
    const updated: IncomeSource = { ...weekly, amount: 999 };
    upsertIncomeSource(updated);
    const sources = getState().incomeSources ?? [];
    expect(sources.length).toBe(1);
    expect(sources[0]).toEqual(owned(updated));
  });

  it('removeIncomeSource removes by id', () => {
    setIncomeSources([weekly, monthly]);
    removeIncomeSource(weekly.id);
    expect(getState().incomeSources).toEqual([owned(monthly)]);
  });

  it('removeIncomeSource is a no-op when the id is not present', () => {
    setIncomeSources([weekly]);
    removeIncomeSource('does-not-exist');
    expect(getState().incomeSources).toEqual([owned(weekly)]);
  });
});

// ---------------------------------------------------------------------------
// dismissIncomeSignal — IncomeCaughtSheet's "Not this one" suppression list
// (mirrors addIgnoredReviewSig's "said no once, stays quiet" contract).
// ---------------------------------------------------------------------------
describe('dismissIncomeSignal', () => {
  it('records the merchant, normalised (trimmed + lowercased)', () => {
    dismissIncomeSignal('  Stafflink Payroll  ');
    expect(getState().dismissedIncomeSignals).toEqual(['stafflink payroll']);
  });

  it('is idempotent — a repeat call for the same merchant does not duplicate it', () => {
    dismissIncomeSignal('Stafflink Payroll');
    dismissIncomeSignal('stafflink payroll'); // same merchant, different case
    expect(getState().dismissedIncomeSignals).toEqual(['stafflink payroll']);
  });

  it('prepends new dismissals so the most recent is first', () => {
    dismissIncomeSignal('Alpha Co');
    dismissIncomeSignal('Beta Co');
    expect(getState().dismissedIncomeSignals).toEqual(['beta co', 'alpha co']);
  });
});

// ---------------------------------------------------------------------------
// dismissBillSignal — BillCaughtSheet's "Not this one" suppression list
// (DATA_INTELLIGENCE.md phase ⑤(B); identical contract to dismissIncomeSignal).
// ---------------------------------------------------------------------------
describe('dismissBillSignal', () => {
  it('records the merchant, normalised (trimmed + lowercased)', () => {
    dismissBillSignal('  Octopus Energy  ');
    expect(getState().dismissedBillSignals).toEqual(['octopus energy']);
  });

  it('is idempotent — a repeat call for the same merchant does not duplicate it', () => {
    dismissBillSignal('Octopus Energy');
    dismissBillSignal('octopus energy'); // same merchant, different case
    expect(getState().dismissedBillSignals).toEqual(['octopus energy']);
  });

  it('prepends new dismissals so the most recent is first', () => {
    dismissBillSignal('Council Tax');
    dismissBillSignal('BT Broadband');
    expect(getState().dismissedBillSignals).toEqual(['bt broadband', 'council tax']);
  });

  it('is independent of dismissedIncomeSignals — dismissing a bill does not touch income dismissals', () => {
    dismissIncomeSignal('Stafflink Payroll');
    dismissBillSignal('Octopus Energy');
    expect(getState().dismissedIncomeSignals).toEqual(['stafflink payroll']);
    expect(getState().dismissedBillSignals).toEqual(['octopus energy']);
  });
});

// ---------------------------------------------------------------------------
// merchantCategories — merchant→category memory (DATA_INTELLIGENCE.md phase
// ③): rememberMerchantCategory / forgetMerchantCategory, cap + eviction,
// most-recent-wins, normalisation symmetry with lib/subSignals.ts.
// ---------------------------------------------------------------------------
describe('merchantCategories', () => {
  it('a fresh install (DEFAULTS) has an empty merchantCategories map', () => {
    expect(getState().merchantCategories).toEqual({});
  });

  it('rememberMerchantCategory upserts a normalised-key entry with hits:1', () => {
    rememberMerchantCategory('Tesco Stores Ltd.', 'food');
    const entry = getState().merchantCategories?.['tesco stores ltd'];
    expect(entry).toBeDefined();
    expect(entry?.category).toBe('food');
    expect(entry?.hits).toBe(1);
    expect(typeof entry?.correctedAt).toBe('string');
  });

  it('normalises merchant keys the same way lib/subSignals.ts does (case/punct/whitespace)', () => {
    rememberMerchantCategory('  TESCO   STORES-LTD.  ', 'food');
    const keys = Object.keys(getState().merchantCategories ?? {});
    expect(keys).toEqual(['tesco stores ltd']);
  });

  it('a repeat correction for the same merchant (agreeing) keeps the category and increments hits', () => {
    rememberMerchantCategory('Tesco', 'other');
    rememberMerchantCategory('Tesco', 'other');
    const map = getState().merchantCategories ?? {};
    expect(Object.keys(map)).toHaveLength(1);
    expect(map['tesco']?.category).toBe('other');
    expect(map['tesco']?.hits).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Flip threshold — a disagreeing correction stages as pending and only
  // promotes to committed after the SAME new category is chosen twice in a row.
  // ---------------------------------------------------------------------------

  it('one mis-tap does not flip the committed category — it only stages a pending one', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // single disagreement
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('other');
    expect(entry?.pendingCount).toBe(1);
  });

  it('two consecutive agreeing corrections flip the committed category', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other');
    rememberMerchantCategory('Tesco', 'other'); // same disagreement again — flips
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('other');
    expect(entry?.pendingCategory).toBeUndefined();
    expect(entry?.pendingCount).toBeUndefined();
  });

  it('alternating A/B/A corrections never flip — each new disagreement resets pending', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1
    rememberMerchantCategory('Tesco', 'food'); // agrees with committed — resets pending
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1 again (not x2)
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('other');
    expect(entry?.pendingCount).toBe(1);
  });

  it('a different disagreement than the pending one resets pending to the new candidate', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1
    rememberMerchantCategory('Tesco', 'bills'); // different disagreement — resets to bills x1
    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('bills');
    expect(entry?.pendingCount).toBe(1);
  });

  it('hits increments on every call, including pending disagreements', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other');
    rememberMerchantCategory('Tesco', 'other');
    expect(getState().merchantCategories?.['tesco']?.hits).toBe(3);
  });

  it('recall keeps returning the committed category during a pending window', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending, not yet flipped
    setReaderCandidates([
      {
        id: 'r1',
        source: 'csv',
        kind: 'spend',
        merchant: 'Tesco',
        amount: -42.1,
        category: 'other',
        confidence: 'low',
      },
    ]);
    const [staged] = getState().readerCandidates as Array<
      CandidateMoneyItem & { rememberedCategory?: true }
    >;
    expect(staged?.category).toBe('food');
    expect(staged?.rememberedCategory).toBe(true);
  });

  it('pending state survives a persist round-trip (hydrateFromBlob)', () => {
    rememberMerchantCategory('Tesco', 'food');
    rememberMerchantCategory('Tesco', 'other'); // pending: other x1
    const blob = getPersistBlob();

    hydrateFromBlob(blob);

    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('other');
    expect(entry?.pendingCount).toBe(1);
  });

  it('forgetMerchantCategory removes the entry', () => {
    rememberMerchantCategory('Tesco', 'food');
    forgetMerchantCategory('Tesco');
    expect(getState().merchantCategories?.['tesco']).toBeUndefined();
  });

  it('forgetMerchantCategory is a no-op for a merchant with no remembered entry', () => {
    rememberMerchantCategory('Tesco', 'food');
    const before = getState().merchantCategories;
    forgetMerchantCategory('Never Seen Merchant');
    expect(getState().merchantCategories).toEqual(before);
  });

  it('caps the map at 500 entries, evicting the least-recently-corrected on overflow', () => {
    for (let i = 0; i < 500; i += 1) {
      rememberMerchantCategory(`Merchant ${i}`, 'other');
    }
    expect(Object.keys(getState().merchantCategories ?? {})).toHaveLength(500);

    // 'merchant 0' is the oldest correction — a 501st NEW merchant should evict it.
    rememberMerchantCategory('Merchant 500', 'food');
    const map = getState().merchantCategories ?? {};
    expect(Object.keys(map)).toHaveLength(500);
    expect(map['merchant 0']).toBeUndefined();
    expect(map['merchant 500']).toBeDefined();
  });

  it('does not evict anything when correcting an EXISTING merchant at capacity', () => {
    for (let i = 0; i < 500; i += 1) {
      rememberMerchantCategory(`Merchant ${i}`, 'other');
    }
    // Re-correct an existing merchant — map stays at exactly 500, nothing evicted. This is the first
    // disagreement, so under the flip threshold it stages pending rather than committing immediately.
    rememberMerchantCategory('Merchant 250', 'food');
    const map = getState().merchantCategories ?? {};
    expect(Object.keys(map)).toHaveLength(500);
    expect(map['merchant 0']).toBeDefined();
    expect(map['merchant 250']?.category).toBe('other');
    expect(map['merchant 250']?.pendingCategory).toBe('food');
  });
});

// ---------------------------------------------------------------------------
// Transaction lifecycle — pending/void/reversal/transfer/refund/provider correction truth.
// ---------------------------------------------------------------------------
describe('transaction lifecycle truth', () => {
  it('migrates legacy rows to posted without changing the financial record', () => {
    resetToEmpty();
    const legacy = addTransaction({
      id: 'legacy-row',
      when: '2026-07-01T00:00:00.000Z',
      merchant: 'Legacy row',
      amount: -12.5,
      category: 'other',
      source: 'manual',
    });
    const old = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    old['schemaVersion'] = 20;
    old['transactions'] = [{ ...legacy, lifecycleStatus: undefined }];

    hydrateFromBlob(JSON.stringify(old));

    expect(getState().transactions[0]).toMatchObject({
      id: 'legacy-row',
      amount: -12.5,
      lifecycleStatus: 'posted',
    });
  });

  it('retains pending and declined rows but excludes them from realised cashflow', () => {
    resetToEmpty();
    const pending = addTransaction({
      merchant: 'Card authorisation',
      amount: -25,
      category: 'shopping',
      source: 'bank',
      lifecycleStatus: 'pending',
    });
    const declined = addTransaction({
      merchant: 'Declined payment',
      amount: -40,
      category: 'shopping',
      source: 'bank',
      lifecycleStatus: 'pending',
    });
    markTransactionDeclined(declined.id, '2026-08-01T12:00:00.000Z');

    expect(getState().transactions).toHaveLength(2);
    expect(bankTransactions(getState())).toEqual([]);
    expect(getState().transactions.find((row) => row.id === pending.id)?.lifecycleStatus).toBe(
      'pending',
    );
    expect(getState().transactions.find((row) => row.id === declined.id)).toMatchObject({
      lifecycleStatus: 'void',
      lifecycleReason: 'declined',
    });
  });

  it('keeps duplicate evidence while preventing a second financial effect', () => {
    resetToEmpty();
    const original = addTransaction({
      merchant: 'Grocer',
      amount: -30,
      category: 'food',
      source: 'manual',
    });
    const duplicate = addTransaction({
      merchant: 'Grocer',
      amount: -30,
      category: 'food',
      source: 'bank',
    });
    markTransactionDuplicate(duplicate.id, original.id, '2026-08-02T12:00:00.000Z');

    expect(bankTransactions(getState()).map((row) => row.id)).toEqual([original.id]);
    expect(getState().transactions.find((row) => row.id === duplicate.id)).toMatchObject({
      lifecycleStatus: 'void',
      lifecycleReason: 'duplicate',
      duplicateOfId: original.id,
    });
  });

  it('records reversal and partial/full refunds without inflating income', () => {
    resetToEmpty();
    const reversedSpend = addTransaction({
      id: 'reversed-spend',
      merchant: 'Cancelled order',
      amount: -42,
      category: 'shopping',
      source: 'manual',
    });
    recordTransactionReversal(reversedSpend.id, {
      id: 'reversal-row',
      when: '2026-08-04T00:00:00.000Z',
    });
    const spend = addTransaction({
      id: 'refunded-spend',
      merchant: 'Shoes',
      amount: -100,
      category: 'shopping',
      source: 'manual',
    });
    recordTransactionRefund(spend.id, 30, { id: 'partial-refund' });
    recordTransactionRefund(spend.id, 70, { id: 'final-refund' });

    expect(bankTransactions(getState())).toHaveLength(5);
    expect(bankAnalyticsTransactions(getState())).toEqual([]);
    expect(() => recordTransactionRefund(spend.id, 1)).toThrow(/cannot exceed/i);
  });

  it('links equal opposite legs across accounts and removes them from spend/income analytics', () => {
    resetToEmpty();
    const savings = addAccount({ name: 'Savings', kind: 'savings', balanceMinor: 0 });
    const debit = addTransaction({
      id: 'transfer-debit',
      merchant: 'Move to savings',
      amount: -200,
      category: 'other',
      source: 'manual',
      accountId: DEFAULT_ACCOUNT_ID,
    });
    const credit = addTransaction({
      id: 'transfer-credit',
      merchant: 'Move from current',
      amount: 200,
      category: 'other',
      source: 'manual',
      accountId: savings.id,
    });

    linkOwnAccountTransfer(debit.id, credit.id, 'own-transfer-1');

    expect(bankTransactions(getState())).toHaveLength(2);
    expect(bankAnalyticsTransactions(getState())).toEqual([]);
  });

  it('reconciles a stable provider ID from pending to posted without overwriting a newer manual correction', () => {
    resetToEmpty();
    vi.useFakeTimers();
    const accepted = addTransaction({
      id: 'provider-row',
      when: '2026-08-01T00:00:00.000Z',
      merchant: 'Initial provider name',
      amount: -10,
      category: 'other',
      source: 'bank',
      externalId: 'stable-provider-id',
      lifecycleStatus: 'pending',
      providerUpdatedAt: '2026-08-01T10:00:00.000Z',
    });
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'));
    editTransaction(accepted.id, { merchant: 'My corrected name', amount: -12 }, 'user');

    const result = enqueueReviewItems([
      {
        source: 'bank',
        merchant: 'Stale provider name',
        amount: -11,
        date: '2026-08-02',
        externalId: 'stable-provider-id',
        bankConnectionId: 'connection-1',
        lifecycleStatus: 'posted',
        providerUpdatedAt: '2026-08-09T12:00:00.000Z',
      },
    ]);

    expect(result.fresh).toEqual([]);
    expect(getState().reviewQueue).toEqual([]);
    expect(getState().transactions.find((row) => row.id === accepted.id)).toMatchObject({
      merchant: 'My corrected name',
      amount: -12,
      lifecycleStatus: 'posted',
      providerUpdatedAt: '2026-08-09T12:00:00.000Z',
    });
  });

  it('reconciles a queued provider proposal in place when pending becomes posted', () => {
    resetToEmpty();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    enqueueReviewItems([
      {
        source: 'bank',
        merchant: 'Pending shop',
        amount: -15,
        date: '2026-08-01',
        externalId: 'provider-pending-1',
        bankConnectionId: 'connection-1',
        lifecycleStatus: 'pending',
        providerUpdatedAt: '2026-08-01T11:00:00.000Z',
      },
    ]);
    const queuedId = getState().reviewQueue?.[0]?.id;

    vi.setSystemTime(new Date('2026-08-02T12:00:00.000Z'));
    const result = enqueueReviewItems([
      {
        source: 'bank',
        merchant: 'Settled shop',
        amount: -16,
        date: '2026-08-02',
        externalId: 'provider-pending-1',
        bankConnectionId: 'connection-1',
        lifecycleStatus: 'posted',
        providerUpdatedAt: '2026-08-02T11:00:00.000Z',
      },
    ]);

    expect(result.fresh).toEqual([]);
    expect(getState().reviewQueue).toHaveLength(1);
    expect(getState().reviewQueue?.[0]).toMatchObject({
      id: queuedId,
      merchant: 'Settled shop',
      amount: -16,
      date: '2026-08-02',
      lifecycleStatus: 'posted',
      providerUpdatedAt: '2026-08-02T11:00:00.000Z',
    });
  });
});

// ---------------------------------------------------------------------------
// reviewQueue — the persisted intake review queue (web enqueueReviewItems /
// resolveReviewItem / clearReviewQueue / sweepReviewQueue semantics).
// ---------------------------------------------------------------------------
describe('reviewQueue', () => {
  const input = (
    over: Partial<{ source: 'pdf'; merchant: string; amount: number; date: string }> = {},
  ) => ({
    source: 'pdf' as const,
    merchant: 'Tesco',
    amount: -42.1,
    date: '2026-07-01',
    ...over,
  });

  it('defaults to an empty queue', () => {
    expect(getState().reviewQueue).toEqual([]);
  });

  it('enqueue stamps id + addedAt and returns the fresh items with zero dropped', () => {
    // Arrange + Act
    const { fresh, dropped } = enqueueReviewItems([input()]);

    // Assert
    expect(fresh.length).toBe(1);
    expect(fresh[0]!.id).toMatch(/^rv-/);
    expect(new Date(fresh[0]!.addedAt).getTime()).not.toBeNaN();
    expect(dropped).toBe(0);
    const queue = getState().reviewQueue ?? [];
    expect(queue.length).toBe(1);
    expect(queue[0]!.merchant).toBe('Tesco');
  });

  it('newest items sit at the head of the queue', () => {
    enqueueReviewItems([input()]);
    enqueueReviewItems([input({ merchant: 'Boots', amount: -8.4 })]);

    const queue = getState().reviewQueue ?? [];
    expect(queue.map((it) => it.merchant)).toEqual(['Boots', 'Tesco']);
  });

  it('skips duplicates already in the queue (same merchant + amount + date)', () => {
    enqueueReviewItems([input()]);
    const { fresh, dropped } = enqueueReviewItems([input()]);

    expect(fresh).toEqual([]);
    expect(dropped).toBe(0);
    expect((getState().reviewQueue ?? []).length).toBe(1);
  });

  it('a different date is NOT a duplicate', () => {
    enqueueReviewItems([input()]);
    enqueueReviewItems([input({ date: '2026-07-02' })]);

    expect((getState().reviewQueue ?? []).length).toBe(2);
  });

  it('skips candidates whose signature the user already ignored', () => {
    addIgnoredReviewSig(reviewCandidateSig('Tesco', -42.1, '2026-07-01'));
    const { fresh, dropped } = enqueueReviewItems([input()]);

    expect(fresh).toEqual([]);
    expect(dropped).toBe(0);
    expect((getState().reviewQueue ?? []).length).toBe(0);
  });

  it('caps the queue at 60, spills the rest into reviewQueueSpillover, and reports dropped', () => {
    const many = Array.from({ length: 70 }, (_, i) =>
      input({ merchant: `Shop ${i}`, amount: -(i + 1) }),
    );
    const { fresh, dropped } = enqueueReviewItems(many);

    expect(fresh.length).toBe(70);
    expect(dropped).toBe(10);
    expect((getState().reviewQueue ?? []).length).toBe(60);
    expect((getState().reviewQueueSpillover ?? []).length).toBe(10);
  });

  it('spillover holds the tail of a single over-cap call (array order preserved within one call)', () => {
    const many = Array.from({ length: 70 }, (_, i) =>
      input({ merchant: `Shop ${i}`, amount: -(i + 1) }),
    );
    enqueueReviewItems(many);

    // Within one enqueueReviewItems call every fresh row shares the same `addedAt`, so ties break by
    // array order (matches the pre-spillover `[...fresh, ...existing]` convention this preserves):
    // Shop 0 (first in the call) stays visible, Shop 69 (last) is what spills over.
    const queueMerchants = (getState().reviewQueue ?? []).map((it) => it.merchant);
    const spilloverMerchants = (getState().reviewQueueSpillover ?? []).map((it) => it.merchant);
    expect(queueMerchants).toContain('Shop 0');
    expect(spilloverMerchants).toContain('Shop 69');
    expect(spilloverMerchants).not.toContain('Shop 0');
  });

  it('resolveReviewItem removes exactly the given id; unknown ids are a safe no-op', () => {
    enqueueReviewItems([input(), input({ merchant: 'Boots', amount: -8.4 })]);
    const queue = getState().reviewQueue ?? [];
    const target = queue.find((it) => it.merchant === 'Tesco')!;

    resolveReviewItem(target.id);
    resolveReviewItem('rv-does-not-exist');

    const after = getState().reviewQueue ?? [];
    expect(after.length).toBe(1);
    expect(after[0]!.merchant).toBe('Boots');
  });

  it('resolveReviewItem refills the freed slot from reviewQueueSpillover', () => {
    const many = Array.from({ length: 61 }, (_, i) =>
      input({ merchant: `Shop ${i}`, amount: -(i + 1) }),
    );
    enqueueReviewItems(many);
    expect((getState().reviewQueue ?? []).length).toBe(60);
    expect((getState().reviewQueueSpillover ?? []).length).toBe(1);
    // Shop 60 (last in the call) is the one that spilled over — see the array-order test above.
    expect((getState().reviewQueueSpillover ?? [])[0]!.merchant).toBe('Shop 60');

    const queue = getState().reviewQueue ?? [];
    resolveReviewItem(queue[0]!.id);

    expect((getState().reviewQueue ?? []).length).toBe(60);
    expect((getState().reviewQueueSpillover ?? []).length).toBe(0);
    // The spillover row (Shop 60) is now in the visible queue.
    expect((getState().reviewQueue ?? []).some((it) => it.merchant === 'Shop 60')).toBe(true);
  });

  it('clearReviewQueue drains both the visible queue and the spillover', () => {
    const many = Array.from({ length: 61 }, (_, i) =>
      input({ merchant: `Shop ${i}`, amount: -(i + 1) }),
    );
    enqueueReviewItems(many);
    expect((getState().reviewQueueSpillover ?? []).length).toBe(1);

    clearReviewQueue();

    expect(getState().reviewQueue).toEqual([]);
    expect(getState().reviewQueueSpillover).toEqual([]);
  });

  it('sweepReviewQueue ages out items older than 14 days and keeps fresh ones', () => {
    enqueueReviewItems([input()]);
    const queue = getState().reviewQueue ?? [];
    const stale = {
      ...queue[0]!,
      id: 'rv-stale',
      merchant: 'Old row',
      addedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    };
    setPartial({ reviewQueue: [...queue, stale] });

    sweepReviewQueue();

    const after = getState().reviewQueue ?? [];
    expect(after.some((it) => it.id === 'rv-stale')).toBe(false);
    expect(after.length).toBe(1);
  });

  it('sweepReviewQueue ages out stale spillover rows too', () => {
    const many = Array.from({ length: 61 }, (_, i) =>
      input({ merchant: `Shop ${i}`, amount: -(i + 1) }),
    );
    enqueueReviewItems(many);
    const spillover = getState().reviewQueueSpillover ?? [];
    expect(spillover.length).toBe(1);
    const stale = {
      ...spillover[0]!,
      addedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    };
    setPartial({ reviewQueueSpillover: [stale] });

    sweepReviewQueue();

    expect(getState().reviewQueueSpillover).toEqual([]);
  });

  it('persists across a blob round-trip (unlike the transient readerCandidates)', () => {
    enqueueReviewItems([input()]);
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    expect('reviewQueue' in parsed).toBe(true);

    hydrateFromBlob(getPersistBlob());
    expect((getState().reviewQueue ?? []).length).toBe(1);
  });

  it('resetToEmpty clears the queue and the spillover', () => {
    const many = Array.from({ length: 61 }, (_, i) =>
      input({ merchant: `Shop ${i}`, amount: -(i + 1) }),
    );
    enqueueReviewItems(many);
    expect((getState().reviewQueueSpillover ?? []).length).toBe(1);

    resetToEmpty();

    expect(getState().reviewQueue).toEqual([]);
    expect(getState().reviewQueueSpillover).toEqual([]);
  });

  it('queueInputFromCandidates maps reader candidates with date + note riding along', () => {
    const mapped = queueInputFromCandidates(
      [
        {
          id: 'r1',
          source: 'csv',
          kind: 'spend',
          merchant: 'Tesco',
          amount: -42.1,
          date: '2026-07-01',
          note: 'looks like a bill',
          confidence: 'low',
        },
        {
          id: 'r2',
          source: 'csv',
          kind: 'spend',
          merchant: 'Boots',
          amount: -8.4,
          confidence: 'low',
        },
      ],
      'pdf',
    );

    expect(mapped[0]).toEqual({
      source: 'pdf',
      merchant: 'Tesco',
      amount: -42.1,
      date: '2026-07-01',
      hint: 'looks like a bill',
    });
    // No explicit-undefined keys when the candidate carried no date/note.
    expect(mapped[1]).toEqual({ source: 'pdf', merchant: 'Boots', amount: -8.4 });
    expect('date' in mapped[1]!).toBe(false);
  });

  it('carries the confirmed account into every one-by-one review item', () => {
    const mapped = queueInputFromCandidates(
      [
        {
          id: 'r1',
          source: 'csv',
          kind: 'spend',
          merchant: 'Tesco',
          amount: -42.1,
          date: '2026-07-01',
          confidence: 'high',
        },
      ],
      'pdf',
      'acct-savings',
    );

    expect(mapped[0]?.accountId).toBe('acct-savings');
  });

  // Provenance carry-through (DATA_INTELLIGENCE.md phase ③): a merchant-memory recall applied
  // upstream (setReaderCandidates, or the paste path's own applyMemoryToCandidates call) must survive
  // this mapping into the persisted queue, so ReviewScreen can pre-select the chip + show honest
  // provenance instead of the recall silently evaporating at the queue boundary.
  it('carries category + rememberedCategory through when the candidate has them', () => {
    const mapped = queueInputFromCandidates(
      [
        {
          id: 'r1',
          source: 'csv',
          kind: 'spend',
          merchant: 'Tesco',
          amount: -42.1,
          category: 'food',
          rememberedCategory: true,
          confidence: 'low',
        },
      ],
      'pdf',
    );

    expect(mapped[0]).toEqual({
      source: 'pdf',
      merchant: 'Tesco',
      amount: -42.1,
      category: 'food',
      rememberedCategory: true,
    });
  });

  it('carries a fresh (non-remembered) category guess without a rememberedCategory flag', () => {
    const mapped = queueInputFromCandidates(
      [
        {
          id: 'r1',
          source: 'csv',
          kind: 'spend',
          merchant: 'Tesco',
          amount: -42.1,
          category: 'other',
          confidence: 'low',
        },
      ],
      'csv',
    );

    expect(mapped[0]).toEqual({
      source: 'csv',
      merchant: 'Tesco',
      amount: -42.1,
      category: 'other',
    });
    expect('rememberedCategory' in mapped[0]!).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// syncHistoryCycles — wires lib/historyCycles.ts's pure synthesizer to the
// live store (DATA_INTELLIGENCE.md phase ④(B)).
// The exhaustive grouping/idempotency/lived-wins/tight-point-approximation
// coverage lives in `lib/historyCycles.test.ts` against the pure
// `synthesizeHistoryCycles` function directly (deterministic `todayISO`, no
// clock dependency). This block only proves the store action's WIRING: it
// reads live `transactions`/`incomeSources`/`cycles`, calls the synthesizer,
// and merges the result back in — using `syncHistoryCycles()`'s real
// `new Date()` "today" against fixture months far enough in the past (well
// before this test file could plausibly still be running) that "is this
// month over yet" never flips underfoot.
describe('syncHistoryCycles', () => {
  const txn = (
    when: string,
    merchant: string,
    amount: number,
    over: Partial<Transaction> = {},
  ): Omit<Transaction, 'id'> => ({
    when,
    merchant,
    amount,
    category: 'other',
    source: 'manual',
    ...over,
  });

  it('is a no-op when there is no qualifying history', () => {
    setPartial({ transactions: [], cycles: [] });
    syncHistoryCycles();
    expect(getState().cycles).toEqual([]);
  });

  it('reconstructs a past month with >=5 transactions and tags it reconstructed', () => {
    setPartial({
      transactions: [
        // Starts on the 1st (within the PARTIAL FIRST MONTH grace window — see
        // lib/historyCycles.ts's FIRST_MONTH_MAX_START_DAY) so this happy-path test exercises a
        // normal, fully-covered month rather than the mid-month-start edge case.
        addTransaction(txn('2020-01-01T00:00:00.000Z', 'Tesco', -20)),
        addTransaction(txn('2020-01-10T00:00:00.000Z', 'Rent', -500)),
        addTransaction(txn('2020-01-15T00:00:00.000Z', 'Pay', 2000)),
        addTransaction(txn('2020-01-20T00:00:00.000Z', 'Netflix', -12)),
        addTransaction(txn('2020-01-25T00:00:00.000Z', 'Coffee', -4)),
      ],
      cycles: [],
    });
    syncHistoryCycles();

    const cycles = getState().cycles;
    expect(cycles.length).toBe(1);
    expect(cycles[0]!.reconstructed).toBe(true);
    expect(cycles[0]!.label).toBe('January 2020');
    expect(cycles[0]!.closedAt).toBe('2020-01-31');
  });

  it('never synthesizes the current calendar month', () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setPartial({
      transactions: Array.from({ length: 6 }, (_, i) =>
        addTransaction(txn(`${thisMonth}-0${(i % 9) + 1}T00:00:00.000Z`, `M${i}`, -10)),
      ),
      cycles: [],
    });
    syncHistoryCycles();
    expect(getState().cycles).toEqual([]);
  });

  it('treats August as closed once the workspace has crossed BST midnight into September', () => {
    setPartial({
      transactions: Array.from({ length: 5 }, (_, index) =>
        addTransaction(txn(`2026-08-0${index + 1}T12:00:00.000Z`, `August ${index}`, -10)),
      ),
      cycles: [],
    });

    syncHistoryCycles(new Date('2026-08-31T23:30:00.000Z'));

    expect(getState().cycles).toHaveLength(1);
    expect(getState().cycles[0]).toMatchObject({ label: 'August 2026', closedAt: '2026-08-31' });
  });

  it('does not synthesize a month with fewer than 5 transactions', () => {
    setPartial({
      transactions: [
        addTransaction(txn('2020-02-05T00:00:00.000Z', 'Tesco', -20)),
        addTransaction(txn('2020-02-10T00:00:00.000Z', 'Rent', -500)),
      ],
      cycles: [],
    });
    syncHistoryCycles();
    expect(getState().cycles).toEqual([]);
  });

  it('never overwrites a LIVED cycle for the same month', () => {
    const livedMarch: CycleRecord = {
      closedAt: '2020-03-28',
      label: 'March (lived)',
      spare: 123,
      tightPoint: 45,
      setAside: 10,
      note: 'ritual-sealed',
    };
    setPartial({
      transactions: Array.from({ length: 6 }, (_, i) =>
        addTransaction(txn(`2020-03-0${(i % 9) + 1}T00:00:00.000Z`, `M${i}`, -10)),
      ),
      cycles: [livedMarch],
    });
    syncHistoryCycles();

    const cycles = getState().cycles;
    expect(cycles).toEqual([owned(livedMarch)]); // untouched — no reconstructed duplicate for March
  });

  it('is idempotent — re-running over the same ledger never duplicates a month', () => {
    setPartial({
      transactions: Array.from({ length: 6 }, (_, i) =>
        addTransaction(txn(`2020-04-0${(i % 9) + 1}T00:00:00.000Z`, `M${i}`, -10)),
      ),
      cycles: [],
    });
    syncHistoryCycles();
    const firstRun = getState().cycles;
    syncHistoryCycles();
    const secondRun = getState().cycles;

    expect(secondRun.length).toBe(1);
    expect(secondRun).toEqual(firstRun);
  });

  it('upserts (refreshes) a reconstructed month as more history lands for it, instead of duplicating', () => {
    setPartial({
      transactions: Array.from({ length: 5 }, (_, i) =>
        addTransaction(txn(`2020-05-0${i + 1}T00:00:00.000Z`, `M${i}`, -10)),
      ),
      cycles: [],
    });
    syncHistoryCycles();
    const firstTightPoint = getState().cycles[0]!.tightPoint;

    // More May history lands (a second, larger import).
    addTransaction(txn('2020-05-20T00:00:00.000Z', 'BigOne', -200));
    syncHistoryCycles();

    const cycles = getState().cycles;
    expect(cycles.length).toBe(1); // still exactly one May entry, not two
    expect(cycles[0]!.tightPoint).toBeGreaterThan(firstTightPoint); // refreshed, not stale
  });

  // CYCLES RETENTION (DATA_INTELLIGENCE.md phase ④): syncHistoryCycles' merge must cap at 60,
  // evicting the oldest RECONSTRUCTED entries first, never a lived cycle — see
  // lib/historyCycles.test.ts's `capMergedCycles` suite for the exhaustive eviction-order coverage.
  // This block only proves the store action actually applies the cap end-to-end.
  it('caps merged cycles at 60, never evicting a lived cycle, when a bulk import would otherwise exceed it', () => {
    // 61 distinct past months of real (>=5 rows each, starting on the 1st so the earliest month
    // clears the PARTIAL FIRST MONTH guard) transaction history -> the synthesizer would normally
    // reconstruct all 61; the cap must trim to 60 by evicting the OLDEST reconstructed months, and
    // a lived June 2026 cycle (seeded directly, no backing transactions needed — lived cycles are
    // never re-derived) must survive regardless.
    const monthTxns: ReturnType<typeof txn>[] = [];
    for (let i = 0; i < 61; i++) {
      const year = 1965 + Math.floor(i / 12);
      const month = String((i % 12) + 1).padStart(2, '0');
      for (let d = 1; d <= 5; d++) {
        monthTxns.push(txn(`${year}-${month}-0${d}T00:00:00.000Z`, `M${i}-${d}`, -10));
      }
    }
    const lived: CycleRecord = {
      closedAt: '2026-06-28',
      label: 'June (lived)',
      spare: 50,
      tightPoint: 10,
      setAside: 20,
      note: 'ritual-sealed',
    };
    setPartial({
      transactions: monthTxns.map((t) => addTransaction(t)),
      cycles: [lived],
    });
    syncHistoryCycles();

    const cycles = getState().cycles;
    expect(cycles.length).toBe(60);
    expect(cycles.some((c) => c.closedAt === lived.closedAt && !c.reconstructed)).toBe(true);
    // The 60 kept reconstructed months must be the NEWEST 59 of the 61 (plus the 1 lived) — i.e.
    // the two OLDEST reconstructed months (1965, the earliest) were evicted first.
    const closedDates = cycles.map((c) => c.closedAt).sort();
    expect(closedDates[0]).not.toMatch(/^1965-01/);
  });
});

// ---------------------------------------------------------------------------
// addStatementAsHistory — the bulk "add all as history" action (task: BULK ADD-AS-HISTORY).
// ---------------------------------------------------------------------------
describe('addStatementAsHistory', () => {
  function candidate(over: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem {
    const source = over.source ?? 'pdf';
    const kind = over.kind ?? 'spend';
    const merchant = over.merchant ?? 'Tesco';
    const amount = over.amount ?? -10;
    return {
      id:
        over.id ??
        `cand-${source}-${over.date ?? 'no-date'}-${merchant.toLowerCase().replace(/\W+/gu, '-')}-${amount}`,
      source,
      kind,
      merchant,
      amount,
      confidence: 'low',
      ...over,
    };
  }

  it('is a no-op on an empty candidate list — no transactions added, zeroed summary', () => {
    const before = getState().transactions.length;
    const result = addStatementAsHistory([]);
    expect(getState().transactions.length).toBe(before);
    expect(result).toMatchObject({
      added: 0,
      dateRange: null,
      totalInPence: 0,
      totalOutPence: 0,
      droppedTransactionCount: 0,
      duplicatesSkipped: 0,
    });
    // No rows and no statement totals to check against → reconciliation is honestly 'unverified'.
    expect(result.reconciliation?.status).toBe('unverified');
  });

  it('lands every candidate as a transaction, signed amount verbatim', () => {
    setPartial({ transactions: [] });
    addStatementAsHistory([
      candidate({ merchant: 'Tesco', amount: -42.1, kind: 'spend', date: '2026-03-03' }),
      candidate({ merchant: 'Salary', amount: 215.51, kind: 'income', date: '2026-03-12' }),
    ]);
    const txns = getState().transactions;
    expect(txns.length).toBe(2);
    expect(txns.find((t) => t.merchant === 'Tesco')?.amount).toBe(-42.1);
    expect(txns.find((t) => t.merchant === 'Salary')?.amount).toBe(215.51);
  });

  it('gives an income-kind candidate category "income", never "food" — even with no category guess', () => {
    setPartial({ transactions: [] });
    addStatementAsHistory([candidate({ merchant: 'Staffline', amount: 215.51, kind: 'income' })]);
    const row = getState().transactions.find((t) => t.merchant === 'Staffline');
    expect(row?.category).toBe('income');
  });

  it('gives a spend-kind candidate a mapped category and falls back to "other" when unrecognised', () => {
    setPartial({ transactions: [] });
    addStatementAsHistory([
      candidate({
        merchant: 'Virgin Media',
        amount: -29,
        kind: 'bill',
        category: 'Bills & Utilities',
      }),
      candidate({
        merchant: 'Mystery Co',
        amount: -5,
        kind: 'spend',
        category: 'Something Unknown',
      }),
    ]);
    const txns = getState().transactions;
    expect(txns.find((t) => t.merchant === 'Virgin Media')?.category).toBe('bills');
    expect(txns.find((t) => t.merchant === 'Mystery Co')?.category).toBe('other');
  });

  it('calls syncHistoryCycles so a qualifying past month reconstructs (not left empty)', () => {
    setPartial({ transactions: [], cycles: [] });
    const rows = Array.from({ length: 5 }, (_, i) =>
      candidate({
        merchant: `M${i}`,
        amount: -10,
        kind: 'spend',
        date: `2020-01-${String(i + 1).padStart(2, '0')}`,
      }),
    );
    addStatementAsHistory(rows);
    const cycles = getState().cycles;
    expect(cycles.length).toBe(1);
    expect(cycles[0]?.reconstructed).toBe(true);
    expect(cycles[0]?.label).toBe('January 2020');
  });

  it('returns an honest summary — added count, date range, totals in pence', () => {
    setPartial({ transactions: [] });
    const result = addStatementAsHistory([
      candidate({ merchant: 'Tesco', amount: -42.1, kind: 'spend', date: '2026-03-03' }),
      candidate({ merchant: 'Landlord', amount: -450, kind: 'bill', date: '2026-03-12' }),
      candidate({ merchant: 'Salary', amount: 215.51, kind: 'income', date: '2026-03-25' }),
    ]);
    expect(result.added).toBe(3);
    expect(result.dateRange).toEqual({ fromISO: '2026-03-03', toISO: '2026-03-25' });
    expect(result.totalInPence).toBe(21551);
    expect(result.totalOutPence).toBe(49210);
  });

  it('surfaces the strongest detected income signal when one qualifies over the full landed ledger', () => {
    // Clear pots/subs/debts too — isOverspentLanding projects the whole money picture forward, and
    // the seeded demo pots/subs/debts would otherwise gate the income-signal check off (the same
    // "quiet moment" guard ReviewScreen.tsx's onAdd applies) before this test gets to assert on it.
    setPartial({
      transactions: [],
      incomeSources: [],
      dismissedIncomeSignals: [],
      pots: [],
      subs: [],
      debts: [],
      currentBalance: {
        amount: 5000,
        source: 'user-entered',
        confidence: 'rough',
        setAt: new Date().toISOString(),
      },
    });
    // 4 monthly credits of the same merchant/amount — clears incomeSignals.ts's own min-occurrence
    // floor for a 'monthly' cadence, exactly like caughtIncome.test.ts's own monthlyCredits fixture.
    const rows = Array.from({ length: 4 }, (_, i) =>
      candidate({
        merchant: 'Staffline Recruitment',
        amount: 1800,
        kind: 'income',
        date: `2026-0${i + 1}-12`,
      }),
    );
    const result = addStatementAsHistory(rows);
    expect(result.incomeSignal).toBeDefined();
    expect(result.incomeSignal?.merchant.toLowerCase()).toContain('staffline');
  });

  it('does not surface an income signal for a merchant already declared as an income source', () => {
    setPartial({
      transactions: [],
      pots: [],
      subs: [],
      debts: [],
      currentBalance: {
        amount: 5000,
        source: 'user-entered',
        confidence: 'rough',
        setAt: new Date().toISOString(),
      },
      incomeSources: [
        {
          id: 'is-staffline',
          label: 'Staffline Recruitment',
          cadence: 'monthly',
          dayOfMonth: 12,
          amount: 1800,
          source: 'onboarding',
        },
      ],
      dismissedIncomeSignals: [],
    });
    const rows = Array.from({ length: 4 }, (_, i) =>
      candidate({
        merchant: 'Staffline Recruitment',
        amount: 1800,
        kind: 'income',
        date: `2026-0${i + 1}-12`,
      }),
    );
    const result = addStatementAsHistory(rows);
    expect(result.incomeSignal).toBeUndefined();
  });

  it('surfaces a closingBalanceOffer only when the caller supplies one — never fabricated', () => {
    setPartial({ transactions: [] });
    const withOffer = addStatementAsHistory(
      [candidate({ merchant: 'Tesco', amount: -10, date: '2026-03-03' })],
      { amount: 1.96, asOfISO: '2021-03-31' },
    );
    expect(withOffer.closingBalanceOffer).toEqual({
      amountPence: 196,
      asOfISO: '2021-03-31',
      accountId: DEFAULT_ACCOUNT_ID,
    });

    setPartial({ transactions: [] });
    const withoutOffer = addStatementAsHistory([
      candidate({ merchant: 'Tesco', amount: -10, date: '2026-03-03' }),
    ]);
    expect(withoutOffer.closingBalanceOffer).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // droppedTransactionCount — task: HISTORY TRIM HONESTY. Reports the PER-IMPORT
  // delta this call caused, never the store's running lifetime total.
  // ---------------------------------------------------------------------------
  it('reports droppedTransactionCount 0 when the import does not push the ledger over the cap', () => {
    setPartial({ transactions: [], droppedTransactionCount: 0 });
    const result = addStatementAsHistory([
      candidate({ merchant: 'Tesco', amount: -10, date: '2026-03-03' }),
    ]);
    expect(result.droppedTransactionCount).toBe(0);
    expect(getState().droppedTransactionCount).toBe(0);
  });

  it('reports the PER-IMPORT eviction delta, not the ledger-wide lifetime total', () => {
    // Seed the ledger already carrying a prior lifetime drop count, so this test proves the
    // returned number is this call's OWN delta, not `getState().droppedTransactionCount` verbatim.
    setPartial({
      transactions: Array.from({ length: 1995 }, (_, i) => ({
        id: `seed-${i}`,
        when: new Date(2020, 0, 1 + i).toISOString(),
        merchant: `Seed${i}`,
        amount: -1,
        category: 'other' as const,
        source: 'manual' as const,
      })),
      droppedTransactionCount: 37, // some unrelated prior lifetime total
    });
    // 10 new rows pushes 1995+10=2005 over the 2000 cap -> evicts exactly 5.
    const rows = Array.from({ length: 10 }, (_, i) =>
      candidate({
        merchant: `New${i}`,
        amount: -1,
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const result = addStatementAsHistory(rows);
    expect(result.droppedTransactionCount).toBe(5); // this import's own delta
    expect(getState().droppedTransactionCount).toBe(42); // 37 prior + 5 new — lifetime total unaffected
  });

  it('matches the real Monzo-page fixture end to end (14 rows, income category correct, totals honest)', () => {
    setPartial({ transactions: [], incomeSources: [], dismissedIncomeSignals: [] });
    // The real gateway response for .claude-session/monzo-small.pdf (2026-07-06 live probe),
    // mapped into candidate shape — see the READER CLOSING BALANCE task's live-test note in
    // statementReaderClient.ts's SYSTEM_PROMPT doc for the confirmed closingBalance/closingDate.
    const monzoPage: CandidateMoneyItem[] = [
      candidate({
        merchant: 'FPS, Andrea Nsiah, Andrea Nsiah',
        amount: 30,
        kind: 'income',
        date: '2021-03-03',
      }),
      candidate({
        merchant: 'Card 39, Virgin Media Pymts',
        amount: -29,
        kind: 'bill',
        category: 'Bills & Utilities',
        date: '2021-03-04',
      }),
      candidate({
        merchant: 'STAFFLINE RECRUITM 396928974',
        amount: 215.51,
        kind: 'income',
        date: '2021-03-12',
      }),
      candidate({
        merchant: 'FPS, Andrea Nsiah, Andrea Nsiah',
        amount: 250,
        kind: 'income',
        date: '2021-03-12',
      }),
      candidate({
        merchant: 'MOB, Mohammed Khan, landlord',
        amount: -450,
        kind: 'bill',
        category: 'Rent',
        date: '2021-03-12',
      }),
      candidate({
        merchant: 'Card 39, Lycamobile Uk Ltd',
        amount: -15,
        kind: 'bill',
        category: 'Mobile Phone',
        date: '2021-03-15',
      }),
      candidate({
        merchant: 'FPS, Andrea Nsiah, Andrea Nsiah',
        amount: 52.5,
        kind: 'income',
        date: '2021-03-22',
      }),
      candidate({
        merchant: 'Card 39, Amznmktplace',
        amount: -52.5,
        kind: 'spend',
        category: 'Shopping',
        date: '2021-03-24',
      }),
      candidate({
        merchant: 'FPS, Ruzvidzo E T, EUGENE',
        amount: 5,
        kind: 'income',
        date: '2021-03-25',
      }),
      candidate({
        merchant: 'Card 39, Amazon Prime*Mu6140Pt4',
        amount: -7.99,
        kind: 'subscription',
        date: '2021-03-25',
      }),
      candidate({
        merchant: 'Card 39, Dropbox',
        amount: -9.99,
        kind: 'subscription',
        date: '2021-03-25',
      }),
      candidate({
        merchant: 'FPS, Edward Chawira, Thanks',
        amount: 10,
        kind: 'income',
        date: '2021-03-29',
      }),
      candidate({
        merchant: 'FPS, Andrea Nsiah, Andrea Nsiah',
        amount: 453,
        kind: 'income',
        date: '2021-03-29',
      }),
      candidate({
        merchant: 'MOB, Mohammed Khan, landlord',
        amount: -450,
        kind: 'bill',
        category: 'Rent',
        date: '2021-03-29',
      }),
    ];
    const result = addStatementAsHistory(monzoPage, { amount: 1.96, asOfISO: '2021-03-31' });

    expect(result.added).toBe(14);
    expect(result.dateRange).toEqual({ fromISO: '2021-03-03', toISO: '2021-03-29' });
    expect(result.closingBalanceOffer).toEqual({
      amountPence: 196,
      asOfISO: '2021-03-31',
      accountId: DEFAULT_ACCOUNT_ID,
    });

    const txns = getState().transactions;
    expect(txns.length).toBe(14);
    // Every income-kind row must be category 'income' — never 'food' (the diagnosed defect).
    const incomeRows = txns.filter((t) => t.amount > 0);
    expect(incomeRows.length).toBe(7);
    expect(incomeRows.every((t) => t.category === 'income')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // RE-IMPORT DEDUP + DATE-ORDER CORRECTNESS (owner: "what if I add more PDFs — does it
  // adapt & recalc by date"). See addStatementAsHistory's + applyTransactionRetention's docs.
  // ---------------------------------------------------------------------------
  describe('re-import correctness', () => {
    const fixture: CandidateMoneyItem[] = [
      candidate({ merchant: 'Tesco', amount: -42.1, kind: 'spend', date: '2026-03-03' }),
      candidate({ merchant: 'Landlord', amount: -450, kind: 'bill', date: '2026-03-12' }),
      candidate({ merchant: 'Salary', amount: 215.51, kind: 'income', date: '2026-03-25' }),
    ];

    it('re-importing the exact same statement twice leaves transaction count, cycles, and income UNCHANGED', () => {
      setPartial({ transactions: [], cycles: [], incomeSources: [], dismissedIncomeSignals: [] });

      const first = addStatementAsHistory(fixture);
      expect(first.added).toBe(3);
      expect(first.duplicatesSkipped).toBe(0);

      const afterFirst = getState();
      const txnCountAfterFirst = afterFirst.transactions.length;
      const cyclesAfterFirst = afterFirst.cycles;
      const incomeAfterFirst = afterFirst.transactions
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      // Re-import the SAME statement — every candidate collides with an already-landed row.
      const second = addStatementAsHistory(fixture);
      expect(second.added).toBe(0);
      expect(second.duplicatesSkipped).toBe(3); // all of them

      const afterSecond = getState();
      expect(afterSecond.transactions.length).toBe(txnCountAfterFirst); // unchanged
      expect(afterSecond.cycles).toEqual(cyclesAfterFirst); // unchanged, never doubled
      const incomeAfterSecond = afterSecond.transactions
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      expect(incomeAfterSecond).toBe(incomeAfterFirst); // unchanged
    });

    it('a partial-overlap import lands only the genuinely new rows', () => {
      setPartial({ transactions: [] });
      addStatementAsHistory(fixture);

      const overlapping: CandidateMoneyItem[] = [
        // Same source-row identity as fixture[0], so it is the one skipped row.
        candidate({ merchant: 'Tesco', amount: -42.1, kind: 'spend', date: '2026-03-03' }),
        // Genuinely new rows.
        candidate({ merchant: 'Coffee Shop', amount: -3.5, kind: 'spend', date: '2026-03-27' }),
        candidate({ merchant: 'Cinema', amount: -12, kind: 'spend', date: '2026-03-28' }),
      ];
      const result = addStatementAsHistory(overlapping);
      expect(result.added).toBe(2);
      expect(result.duplicatesSkipped).toBe(1);

      const merchants = getState().transactions.map((t) => t.merchant);
      expect(merchants.filter((m) => m === 'Tesco').length).toBe(1); // never doubled
      expect(merchants).toContain('Coffee Shop');
      expect(merchants).toContain('Cinema');
    });

    it('lands two legitimate same-date, same-amount, same-merchant rows with distinct candidate IDs', () => {
      setPartial({ transactions: [] });
      const repeatedFare = {
        merchant: 'City Rail',
        amount: -4.2,
        kind: 'spend' as const,
        date: '2026-03-03',
      };

      const result = addStatementAsHistory([
        candidate({ ...repeatedFare, id: 'pdf-row-17' }),
        candidate({ ...repeatedFare, id: 'pdf-row-18' }),
      ]);

      expect(result).toMatchObject({ added: 2, duplicatesSkipped: 0 });
      const fares = getState().transactions.filter(
        (transaction) => transaction.merchant === 'City Rail',
      );
      expect(fares).toHaveLength(2);
      expect(new Set(fares.map((transaction) => transaction.id)).size).toBe(2);
    });

    it('treats partial overlap by candidate identity, not natural-key similarity', () => {
      setPartial({ transactions: [] });
      const facts = {
        merchant: 'City Rail',
        amount: -4.2,
        kind: 'spend' as const,
        date: '2026-03-03',
      };
      const first = candidate({ ...facts, id: 'pdf-row-17' });
      addStatementAsHistory([first]);

      const result = addStatementAsHistory([first, candidate({ ...facts, id: 'pdf-row-18' })]);

      expect(result).toMatchObject({ added: 1, duplicatesSkipped: 1 });
      expect(
        getState().transactions.filter((transaction) => transaction.merchant === 'City Rail'),
      ).toHaveLength(2);
    });

    it('rejects a generated-ID collision before any state mutation', () => {
      setPartial({ transactions: [] });
      const repeatedSourceRow = candidate({
        id: 'pdf-row-collision',
        merchant: 'City Rail',
        amount: -4.2,
        date: '2026-03-03',
      });
      const before = getPersistBlob();

      expect(() => addStatementAsHistory([repeatedSourceRow, repeatedSourceRow])).toThrow(
        /candidate ID collision/,
      );
      expect(getPersistBlob()).toBe(before);
    });

    it('an OLDER-dated import does not evict newer rows already in the ledger under the cap', () => {
      // Seed the ledger already at the cap with RECENT dates.
      setPartial({
        transactions: Array.from({ length: 2000 }, (_, i) => ({
          id: `recent-${i}`,
          when: new Date(2026, 5, 1 + (i % 28)).toISOString(),
          merchant: `Recent${i}`,
          amount: -1,
          category: 'other' as const,
          source: 'manual' as const,
        })),
        droppedTransactionCount: 0,
      });

      // Import a statement dated well BEFORE anything already in the ledger.
      const olderRows = Array.from({ length: 5 }, (_, i) =>
        candidate({
          merchant: `Ancient${i}`,
          amount: -1,
          kind: 'spend',
          date: `2019-01-0${i + 1}`,
        }),
      );
      const result = addStatementAsHistory(olderRows);
      expect(result.added).toBe(5);
      // The 5 new OLDER rows should be exactly what's evicted — not any of the newer, already
      // present rows. Total is 2005, cap is 2000, so exactly 5 are evicted.
      expect(result.droppedTransactionCount).toBe(5);

      const txns = getState().transactions;
      expect(txns.length).toBe(2000);
      // None of the "Ancient" rows survive — they were the oldest by date, so retention evicted
      // them first, not the pre-existing "Recent" rows.
      expect(txns.some((t) => t.merchant.startsWith('Ancient'))).toBe(false);
      expect(txns.filter((t) => t.merchant.startsWith('Recent')).length).toBe(2000);
    });

    it('produces a date-correct ledger after mixed out-of-order imports', () => {
      setPartial({ transactions: [] });
      // Land a batch out of chronological order on purpose.
      addStatementAsHistory([
        candidate({ merchant: 'Mid', amount: -10, date: '2026-02-15' }),
        candidate({ merchant: 'Newest', amount: -10, date: '2026-03-01' }),
        candidate({ merchant: 'Oldest', amount: -10, date: '2026-01-01' }),
      ]);
      const whens = getState().transactions.map((t) => t.when);
      const sorted = [...whens].sort().reverse();
      expect(whens).toEqual(sorted); // newest-first, date-correct regardless of input order
    });

    it('a manual addTransaction still lands in the correct date position', () => {
      setPartial({ transactions: [] });
      addStatementAsHistory([
        candidate({ merchant: 'Newest', amount: -10, date: '2026-03-20' }),
        candidate({ merchant: 'Oldest', amount: -10, date: '2026-01-05' }),
      ]);
      // A manual entry dated in between the two statement rows.
      addTransaction({
        merchant: 'Manual Mid',
        amount: -5,
        category: 'other',
        source: 'manual',
        when: '2026-02-10T00:00:00.000Z',
      });
      const merchants = getState().transactions.map((t) => t.merchant);
      expect(merchants).toEqual(['Newest', 'Manual Mid', 'Oldest']);
    });
  });

  // ---------------------------------------------------------------------------
  // accountId param (ACCOUNTS_MODEL.md §3/§4 P1) — import-assigns-account lane.
  // ---------------------------------------------------------------------------
  describe('addStatementAsHistory — accountId param', () => {
    it('defaults every landed transaction to DEFAULT_ACCOUNT_ID when accountId is omitted', () => {
      setPartial({ transactions: [] });
      addStatementAsHistory([candidate({ merchant: 'Tesco', amount: -10, date: '2026-03-03' })]);
      const txns = getState().transactions;
      expect(txns.length).toBe(1);
      expect(txns[0]?.accountId).toBe(DEFAULT_ACCOUNT_ID);
    });

    it('tags every landed transaction with an explicitly-passed accountId', () => {
      setPartial({ transactions: [] });
      const card = addAccount({ name: 'Amex Gold', kind: 'credit-card' });
      addStatementAsHistory(
        [
          candidate({ merchant: 'Restaurant', amount: -40, date: '2026-03-03' }),
          candidate({
            merchant: 'Payment received',
            amount: 200,
            kind: 'income',
            date: '2026-03-10',
          }),
        ],
        undefined,
        card.id,
      );
      const txns = getState().transactions;
      expect(txns.length).toBe(2);
      expect(txns.every((t) => t.accountId === card.id)).toBe(true);
    });

    it('sets the named account balance via the closing-balance offer; the global scalar follows the bank sum on confirm', () => {
      // A user creating a named account + importing is a REAL user (already past
      // onboarding's demo wipe), so addStatementAsHistory's demo-purge guard is a
      // no-op here — this test isolates account-balance-vs-global-balance only.
      setPartial({ transactions: [], onboarding: { ...getState().onboarding, done: true } });
      const savings = addAccount({ name: 'Savings', kind: 'savings', balanceMinor: 0 });
      const beforeGlobalBalance = getState().currentBalance;
      const result = addStatementAsHistory(
        [candidate({ merchant: 'Interest', amount: 5, kind: 'income', date: '2026-03-03' })],
        { amount: 305, asOfISO: '2026-03-31' },
        savings.id,
      );
      // The offer carries the resolved accountId — never auto-applied by addStatementAsHistory
      // itself (review-before-truth: the caller's confirm tap performs the write).
      expect(result.closingBalanceOffer).toEqual({
        amountPence: 30500,
        asOfISO: '2026-03-31',
        accountId: savings.id,
      });
      expect(getState().currentBalance).toEqual(beforeGlobalBalance);
      // Simulate the confirm tap (BulkStatementLanding's "Use it" button).
      setAccountBalance(savings.id, 305, '2026-03-31');
      const account = getState().accounts?.find((a) => a.id === savings.id);
      expect(account?.balanceMinor).toBe(305);
      expect(account?.balanceAsOfISO).toBe('2026-03-31');
      // Two-way sync invariant (the 07-10 split-brain fix): the confirm tap moves the legacy
      // scalar to the bank-only SUM across accounts, so every remaining currentBalance reader
      // (Calendar ladder, Account, DayDetail, Paywall, Review) agrees with the route. This test
      // previously pinned the scalar as UNTOUCHED — that was the audited coherence bug, not the
      // contract.
      expect(getState().currentBalance.amount).toBe(selectBankBalanceMinor(getState()));
      expect(getState().currentBalance.amount).toBe(beforeGlobalBalance.amount + 305);
    });

    it('a second import into a DIFFERENT account stays separate from the first', () => {
      setPartial({ transactions: [] });
      const main = DEFAULT_ACCOUNT_ID;
      const card = addAccount({ name: 'Amex Gold', kind: 'credit-card' });

      addStatementAsHistory(
        [candidate({ merchant: 'Salary', amount: 2000, kind: 'income', date: '2026-03-01' })],
        { amount: 500, asOfISO: '2026-03-31' },
        main,
      );
      addStatementAsHistory(
        [candidate({ merchant: 'Groceries', amount: -60, date: '2026-03-05' })],
        { amount: 120, asOfISO: '2026-03-31' },
        card.id,
      );

      const txns = getState().transactions;
      const mainTxns = txns.filter((t) => t.accountId === main);
      const cardTxns = txns.filter((t) => t.accountId === card.id);
      expect(mainTxns.length).toBe(1);
      expect(mainTxns[0]?.merchant).toBe('Salary');
      expect(cardTxns.length).toBe(1);
      expect(cardTxns[0]?.merchant).toBe('Groceries');

      // Each import's closing-balance offer names its OWN account — never the other one.
      const importsLog = getState().statementImports ?? [];
      expect(importsLog.length).toBe(2);
      expect(importsLog.some((i) => i.accountId === main)).toBe(true);
      expect(importsLog.some((i) => i.accountId === card.id)).toBe(true);
    });

    it('the default no-account-chosen path still lands in Main', () => {
      setPartial({ transactions: [] });
      addStatementAsHistory([candidate({ merchant: 'Tesco', amount: -10, date: '2026-03-03' })]);
      const txns = getState().transactions;
      expect(txns.every((t) => (t.accountId ?? DEFAULT_ACCOUNT_ID) === DEFAULT_ACCOUNT_ID)).toBe(
        true,
      );
      const importsLog = getState().statementImports ?? [];
      expect(importsLog[0]?.accountId).toBe(DEFAULT_ACCOUNT_ID);
    });
  });

  // ---------------------------------------------------------------------------
  // statementImports log (task: coherence-fix) — the interim import counter
  // AccountScreen's "Statements & receipts" row + footprint grid read, ahead of
  // the full accounts/sources model.
  // ---------------------------------------------------------------------------
  describe('statementImports log', () => {
    it('is empty on a fresh reset', () => {
      resetToEmpty();
      expect(getState().statementImports ?? []).toEqual([]);
    });

    it('bumps by one entry per addStatementAsHistory call that lands new transactions', () => {
      setPartial({ transactions: [], statementImports: [] });
      addStatementAsHistory([
        candidate({ merchant: 'Tesco', amount: -10, date: '2026-03-03' }),
        candidate({ merchant: 'Salary', amount: 1800, kind: 'income', date: '2026-03-12' }),
      ]);
      expect(getState().statementImports).toHaveLength(1);
      expect(getState().statementImports?.[0]?.rowCount).toBe(2);

      addStatementAsHistory([
        candidate({ merchant: 'Coffee Shop', amount: -3.5, date: '2026-03-27' }),
      ]);
      expect(getState().statementImports).toHaveLength(2);
      // Newest first.
      expect(getState().statementImports?.[0]?.rowCount).toBe(1);
      expect(getState().statementImports?.[1]?.rowCount).toBe(2);
    });

    it('does not log an entry for a no-op call (empty candidates, or an all-duplicate re-import)', () => {
      setPartial({ transactions: [], statementImports: [] });
      addStatementAsHistory([]);
      expect(getState().statementImports).toHaveLength(0);

      const fixture = [candidate({ merchant: 'Tesco', amount: -10, date: '2026-03-03' })];
      addStatementAsHistory(fixture);
      expect(getState().statementImports).toHaveLength(1);

      // Re-importing the exact same statement adds nothing new — no phantom second log entry.
      addStatementAsHistory(fixture);
      expect(getState().statementImports).toHaveLength(1);
    });

    it('maps the landed candidate source onto the log entry, translating photo -> image', () => {
      setPartial({ transactions: [], statementImports: [] });
      addStatementAsHistory([candidate({ merchant: 'Tesco', amount: -10, source: 'photo' })]);
      expect(getState().statementImports?.[0]?.source).toBe('image');
    });

    it('caps the log at STATEMENT_IMPORT_CAP (200), newest first', () => {
      setPartial({ transactions: [], statementImports: [] });
      for (let i = 0; i < 205; i++) {
        addStatementAsHistory([
          candidate({ merchant: `M${i}`, amount: -1, date: `2026-01-01`, id: `unique-${i}` }),
        ]);
      }
      const log = getState().statementImports ?? [];
      expect(log.length).toBe(200);
    });
  });
});

// Type-only import smoke — keep Pot referenced so the import isn't pruned.
describe('Open Banking review staging', () => {
  it('dedupes provider-neutral external ids without collapsing legitimate same-value rows', () => {
    setPartial({ transactions: [], reviewQueue: [], reviewQueueSpillover: [] });
    const first = enqueueReviewItems([
      {
        source: 'bank',
        merchant: 'Coffee shop',
        amount: -4.5,
        date: '2026-07-14',
        externalId: 'bank-row-1',
        bankConnectionId: 'connection-1',
      },
      {
        source: 'bank',
        merchant: 'Coffee shop',
        amount: -4.5,
        date: '2026-07-14',
        externalId: 'bank-row-2',
        bankConnectionId: 'connection-1',
      },
    ]);
    expect(first.fresh).toHaveLength(2);
    expect(
      enqueueReviewItems([
        {
          source: 'bank',
          merchant: 'Coffee shop',
          amount: -4.5,
          date: '2026-07-14',
          externalId: 'bank-row-1',
          bankConnectionId: 'connection-1',
        },
      ]).fresh,
    ).toHaveLength(0);
  });

  it('does not requeue accepted or explicitly ignored bank rows', () => {
    setPartial({ transactions: [], reviewQueue: [], reviewQueueSpillover: [] });
    addTransaction({
      merchant: 'Accepted row',
      amount: -12,
      category: 'other',
      source: 'bank',
      externalId: 'bank-accepted',
      bankConnectionId: 'connection-1',
    });
    addIgnoredBankExternalId('bank-ignored');
    const result = enqueueReviewItems([
      {
        source: 'bank',
        merchant: 'Accepted row',
        amount: -12,
        externalId: 'bank-accepted',
        bankConnectionId: 'connection-1',
      },
      {
        source: 'bank',
        merchant: 'Ignored row',
        amount: -8,
        externalId: 'bank-ignored',
        bankConnectionId: 'connection-1',
      },
    ]);
    expect(result.fresh).toHaveLength(0);
  });

  it('deletes only the chosen connection history when explicitly requested', () => {
    setPartial({ transactions: [], reviewQueue: [], reviewQueueSpillover: [] });
    addTransaction({
      merchant: 'Connected bank',
      amount: -12,
      category: 'other',
      source: 'bank',
      externalId: 'bank-accepted',
      bankConnectionId: 'connection-1',
    });
    addTransaction({ merchant: 'Manual row', amount: -2, category: 'other', source: 'manual' });
    enqueueReviewItems([
      {
        source: 'bank',
        merchant: 'Queued bank row',
        amount: -8,
        externalId: 'bank-queued',
        bankConnectionId: 'connection-1',
      },
    ]);
    expect(deleteBankImportedHistory('connection-1')).toEqual({
      deletedTransactions: 1,
      deletedReviewItems: 1,
    });
    expect(getState().transactions.map((transaction) => transaction.merchant)).toEqual([
      'Manual row',
    ]);
    expect(getState().reviewQueue).toEqual([]);
  });
});

describe('Phase E.1 trusted journey writer wiring', () => {
  function configuredPersonalState() {
    resetToEmpty({ onboardingDone: true });
    setOnboarding({ done: true, payday: 25, monthlyIncome: 2200 });
    setCurrentBalance({ amount: 600, source: 'user-entered', confidence: 'corrected' });
    setPartial({ decisionLedger: [], materialChanges: [], correctionImpacts: [] });
  }

  it('records one causal material change when a posted transaction materially moves the range', () => {
    configuredPersonalState();
    const entry = recordMaterialDecision({
      idempotencyKey: 'phase-e1-writer-decision',
      contextRoute: 'whatif',
      question: 'Can I spend £80?',
      decisionType: 'purchase-affordability',
      amountMinor: -8_000,
      bufferDeltaMinor: -8_000,
      confirmedAction: true,
    });

    addTransaction({
      merchant: 'Bike repair',
      amount: -80,
      category: 'transport',
      source: 'manual',
    });

    expect(getState().materialChanges).toHaveLength(1);
    expect(getState().materialChanges?.[0]).toMatchObject({
      type: 'new_transaction',
      truth: 'user_confirmed',
      reviewRequired: false,
    });
    expect(getState().materialChanges?.[0]?.affectedDecisionIds).toContain(entry?.id);
  });

  it('does not record a material change for a non-moving writer no-op', () => {
    configuredPersonalState();

    setCurrentBalance({ amount: 600, source: 'user-entered', confidence: 'corrected' });

    expect(getState().materialChanges ?? []).toEqual([]);
  });

  it('records backup restore as a review-required material change that survives relaunch', () => {
    configuredPersonalState();
    const backup = getPersistBlob();
    setCurrentBalance({ amount: 150, source: 'corrected', confidence: 'corrected' });
    setPartial({ materialChanges: [] });

    restoreBackupFromBlob(backup);
    const changes = getState().materialChanges ?? [];
    expect(changes[0]).toMatchObject({
      type: 'restored_backup',
      reviewRequired: true,
      userActionRequired: true,
    });

    const relaunched = getPersistBlob();
    hydrateFromBlob(relaunched);
    expect(getState().materialChanges?.[0]?.id).toBe(changes[0]?.id);
  });

  it('lets a recovery bundle suppress per-move receipts while applying the underlying write', () => {
    configuredPersonalState();
    const bundled = recordMaterialDecision({
      idempotencyKey: 'test_recovery_bundle_one_receipt',
      decisionType: 'recovery-plan',
      contextRoute: 'recovery',
      question: 'Apply one recovery move.',
      questionSource: 'recovery',
      priority: 'avoid_shortfall',
      amountMinor: 3000,
      confirmedAction: true,
      selectedMoveIds: ['hold-spend'],
      outcome: 'awaiting',
      now: '2026-07-20T12:00:00.000Z',
    });
    setSpendHold(10, 3, new Date('2026-07-20T12:00:00.000Z'), { recordDecision: false });

    const spendHold = getState().spendHold;
    expect(spendHold).not.toBeNull();
    expect(spendHold?.dailyCap).toBe(10);
    const ledger = getState().decisionLedger ?? [];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.id).toBe(bundled?.id);
  });
});

const _potShape: Pot['accent'] = true;
void _potShape;

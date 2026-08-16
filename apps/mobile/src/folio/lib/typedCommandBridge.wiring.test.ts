import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_ACCOUNT_ID,
  addAccount,
  addCalendarEvent,
  addCycle,
  addDebt,
  addEvidenceDocument,
  addIgnoredBankExternalId,
  addIgnoredReviewSig,
  addStatementAsHistory,
  addToPot,
  addPlan,
  addToPlan,
  addTransaction,
  addTransactionsBatch,
  borrowFromPot,
  cacheAiRead,
  confirmDriftSignal,
  dismissAnnualSignal,
  dismissBillSignal,
  dismissDriftSignal,
  dismissIncomeSignal,
  editTransaction,
  endLensTrial,
  enqueueReviewItems,
  getState,
  logDebtPayment,
  markSubUsed,
  markWhatChangedSeen,
  nudgeSub,
  pauseMany,
  removeDebt,
  removeEvidenceDocument,
  removeCalendarEvent,
  removeIncomeSource,
  removePlan,
  removeSub,
  removeSubShareOverride,
  removeTransaction,
  repayToPot,
  resetSubOverrides,
  resolveReviewItem,
  resetToEmpty,
  recordAiRead,
  rememberMerchantCategory,
  forgetMerchantCategory,
  setAccountBalance,
  setCurrentBalance,
  setBufferAmount,
  setHousehold,
  setIncomeSources,
  setLensFullUnlocked,
  setMelo,
  setModeExtra,
  setMoneyMode,
  setNextYouNote,
  setOnboarding,
  setPotAllowNegative,
  setPots,
  setSubs,
  setSubShareOverride,
  setTightPointGoal,
  togglePaused,
  startLensTrial,
  acknowledgeTrialEnd,
  awardTinyWin,
  unhideReviewSig,
  updateCalendarEvent,
  upsertIncomeSource,
  undoDebtPayment,
} from '../store.js';
import { snapshotPendingAppStateCommands } from './typedCommandBridge.js';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot.js';

beforeEach(() => resetToEmpty());

describe('shipping AppState typed-command wiring', () => {
  it('queues balance and account mutations with their source-appropriate actor', () => {
    setCurrentBalance({ amount: 240, source: 'user-entered', confidence: 'rough' });
    const savings = addAccount({ name: 'Savings', kind: 'savings' });
    setAccountBalance(savings.id, 500, '2026-07-16T09:00:00.000Z', {
      source: 'statement',
      confidence: 'statement-derived',
    });

    expect(
      snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID).map((receipt) => ({
        type: receipt.command.type,
        actor: receipt.command.actor.kind,
      })),
    ).toEqual([
      { type: 'folio.balance.set_current.v1', actor: 'user' },
      { type: 'folio.material_change.record.v1', actor: 'system' },
      { type: 'folio.account.add.v1', actor: 'user' },
      { type: 'folio.account.set_balance.v1', actor: 'import' },
      { type: 'folio.material_change.record.v1', actor: 'system' },
    ]);
  });

  it('queues single, batch, correction, and removal mutations without raw values', () => {
    addTransaction({
      id: 'typed-manual-one',
      when: '2026-07-16T09:10:00.000Z',
      merchant: 'Private merchant one',
      amount: -11.23,
      category: 'food',
      source: 'manual',
      accountId: DEFAULT_ACCOUNT_ID,
    });
    addTransactionsBatch([
      {
        id: 'typed-bank-one',
        when: '2026-07-16T09:11:00.000Z',
        merchant: 'Private bank merchant',
        amount: -44.56,
        category: 'other',
        source: 'bank',
        accountId: DEFAULT_ACCOUNT_ID,
      },
    ]);
    editTransaction('typed-manual-one', { category: 'shopping' }, 'melo');
    removeTransaction('typed-bank-one');

    const pending = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    expect(pending.map((receipt) => receipt.command.type)).toEqual([
      'folio.transaction.record.v1',
      'folio.material_change.record.v1',
      'folio.transactions.record_batch.v1',
      'folio.material_change.record.v1',
      'folio.transaction.correct.v1',
      'folio.material_change.record.v1',
      'folio.correction_impact.record.v1',
      'folio.transaction.remove.v1',
      'folio.material_change.record.v1',
    ]);
    expect(pending.map((receipt) => receipt.command.actor.kind)).toEqual([
      'user',
      'system',
      'sync',
      'system',
      'melo',
      'system',
      'user',
      'user',
      'system',
    ]);
    const serialized = JSON.stringify(pending);
    expect(serialized).not.toContain('Private merchant one');
    expect(serialized).not.toContain('Private bank merchant');
    expect(serialized).not.toContain('-11.23');
    expect(serialized).not.toContain('-44.56');
  });

  it('routes staged bank proposals and their reviewed resolution through typed commands', () => {
    const queued = enqueueReviewItems([
      {
        source: 'bank',
        merchant: 'Private staged bank row',
        amount: -71.89,
        date: '2026-07-15',
        externalId: 'provider-neutral-row-one',
        bankConnectionId: 'connection-local-one',
      },
    ]).fresh[0]!;
    resolveReviewItem(queued.id, 'linked');

    expect(getState().reviewQueue).toEqual([]);
    const pending = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    expect(pending.map((receipt) => receipt.command.type)).toEqual([
      'folio.review.enqueue.v1',
      'folio.review.linked.v1',
    ]);
    expect(pending.map((receipt) => receipt.command.actor.kind)).toEqual(['sync', 'user']);
    expect(JSON.stringify(pending)).not.toContain('Private staged bank row');
    expect(JSON.stringify(pending)).not.toContain('-71.89');
  });

  it('routes durable pot, subscription, cycle, and debt mutations without private labels or values', () => {
    setPots([
      {
        id: 'Private emergency pot id',
        name: 'Private emergency pot name',
        saved: 100,
        goal: 900,
        perWeek: 25,
        accent: true,
      },
    ]);
    addToPot('Private emergency pot id', 12.34, 'private-source');
    borrowFromPot('Private emergency pot id', 7.89, 'private-borrow');
    repayToPot('Private emergency pot id', 4.56, 'private-repay');
    setPotAllowNegative('Private emergency pot id', true);

    setSubs([
      {
        name: 'Secret Stream Service',
        cost: 18.76,
        nextRenewalDaysAway: 4,
        nextRenewalISO: '2026-07-20',
        lastUsedDaysAgo: 2,
        usesPerMonth: 3,
      },
    ]);
    markSubUsed('Secret Stream Service');
    togglePaused('Secret Stream Service', true);
    pauseMany(['Secret Stream Service'], false);
    nudgeSub('Secret Stream Service', 2);
    resetSubOverrides('Secret Stream Service');
    removeSub('Secret Stream Service');

    addCycle({
      closedAt: '2026-07-16',
      label: 'Private July label',
      spare: 123.45,
      tightPoint: 67.89,
      setAside: 10.11,
      note: 'Private next-you note',
    });
    const debt = addDebt({
      id: 'debt-private-one',
      addedAt: '2026-07-16T10:00:00.000Z',
      name: 'Private lender name',
      kind: 'loan',
      balance: 4567.89,
      apr: 19.7,
      minPayment: 88.76,
      dueDom: 24,
    });
    logDebtPayment(debt.id, 20.12);
    undoDebtPayment(debt.id, 20.12);
    removeDebt(debt.id);

    const pending = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    expect(pending.map((receipt) => receipt.command.type)).toEqual([
      'folio.pots.replace.v1',
      'folio.pot.deposit.v1',
      'folio.decision_ledger.record_material.v1',
      'folio.material_change.record.v1',
      'folio.pot.borrow.v1',
      'folio.decision_ledger.record_material.v1',
      'folio.material_change.record.v1',
      'folio.pot.repay.v1',
      'folio.pot.overdraft_policy.set.v1',
      'folio.subscriptions.replace.v1',
      'folio.subscription.mark_used.v1',
      'folio.subscription.pause.v1',
      'folio.material_change.record.v1',
      'folio.decision_ledger.record_material.v1',
      'folio.subscriptions.resume_many.v1',
      'folio.material_change.record.v1',
      'folio.subscription.nudge.v1',
      'folio.decision_ledger.record_material.v1',
      'folio.subscription.nudge_reset.v1',
      'folio.subscription.remove.v1',
      'folio.material_change.record.v1',
      'folio.companion.tiny_win.award.v1',
      'folio.cycle.close.v1',
      'folio.decision_ledger.record_material.v1',
      'folio.material_change.record.v1',
      'folio.debt.add.v1',
      'folio.material_change.record.v1',
      'folio.debt.payment.record.v1',
      'folio.material_change.record.v1',
      'folio.debt.payment.reverse.v1',
      'folio.material_change.record.v1',
      'folio.debt.remove.v1',
      'folio.material_change.record.v1',
    ]);
    expect(
      pending
        .filter(
          (receipt) =>
            !['folio.companion.tiny_win.award.v1', 'folio.material_change.record.v1'].includes(
              receipt.command.type,
            ),
        )
        .every((receipt) => receipt.command.actor.kind === 'user'),
    ).toBe(true);
    expect(
      pending.find((receipt) => receipt.command.type === 'folio.companion.tiny_win.award.v1')
        ?.command.actor.kind,
    ).toBe('system');
    expect(
      pending
        .filter((receipt) => receipt.command.type === 'folio.material_change.record.v1')
        .every((receipt) => receipt.command.actor.kind === 'system'),
    ).toBe(true);

    const serialized = JSON.stringify(pending);
    for (const privateValue of [
      'Private emergency pot id',
      'Private emergency pot name',
      'Secret Stream Service',
      'Private July label',
      'Private next-you note',
      'Private lender name',
      '12.34',
      '18.76',
      '4567.89',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('routes committed financial context changes while keeping keystroke drafts out of audits', () => {
    setOnboarding({ done: true, name: 'Private owner name', payday: 17, monthlyIncome: 2345.67 });
    setNextYouNote('Private draft written one keystroke at a time');
    setTightPointGoal(123.45);
    setMoneyMode('household');
    setBufferAmount(321);
    setModeExtra('household', 875);
    setHousehold({ partnerName: 'Private partner name', defaultShare: 0.6 });
    setSubShareOverride('Private shared service', 0.75);
    removeSubShareOverride('Private shared service');

    const pending = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    expect(pending.map((receipt) => receipt.command.type)).toEqual([
      'folio.financial_context.onboarding.set.v1',
      'folio.material_change.record.v1',
      'folio.financial_context.tight_point_goal.set.v1',
      'folio.material_change.record.v1',
      'folio.financial_context.money_mode.set.v1',
      'folio.financial_context.buffer.set.v1',
      'folio.financial_context.mode_extra.set.v1',
      'folio.financial_context.household.set.v1',
      'folio.financial_context.household_subscription_share.set.v1',
      'folio.financial_context.household_subscription_share.remove.v1',
    ]);
    expect(getState().nextYouNote).toBe('Private draft written one keystroke at a time');
    expect(
      pending.every((receipt) =>
        receipt.command.type === 'folio.material_change.record.v1'
          ? receipt.command.actor.kind === 'system'
          : receipt.command.actor.kind === 'user',
      ),
    ).toBe(true);

    const serialized = JSON.stringify(pending);
    for (const privateValue of [
      'Private owner name',
      'Private draft written one keystroke at a time',
      'Private partner name',
      'Private shared service',
      '2345.67',
      '123.45',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('routes calendar, income schedule and planning changes without private source values', () => {
    const calendar = addCalendarEvent({
      id: 'Private calendar id',
      date: '2026-07-31',
      time: '09:45',
      kind: 'out',
      title: 'Private calendar title',
      note: 'Private calendar note',
      amount: -87.65,
      reminderOffsetMinutes: 90,
    });
    updateCalendarEvent(calendar.id, { date: '2026-08-01' });
    removeCalendarEvent(calendar.id);

    setIncomeSources([
      {
        id: 'Private income id',
        label: 'Private income label',
        cadence: 'monthly',
        dayOfMonth: 17,
        amount: 2345.67,
        source: 'manual',
      },
    ]);
    upsertIncomeSource({
      id: 'Private income id',
      label: 'Private updated income label',
      cadence: 'monthly',
      dayOfMonth: 18,
      amount: 2400.12,
      source: 'inferred',
    });
    removeIncomeSource('Private income id');

    const plan = addPlan({
      id: 'Private plan id',
      name: 'Private plan name',
      target: 4500.75,
      saved: 876.54,
      byDate: '2027-03-31',
      perWeek: 45.67,
      addedAt: '2026-07-16T08:07:06.005Z',
    });
    addToPlan(plan.id, 25.43);
    removePlan(plan.id);

    const pending = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    expect(pending.map((receipt) => receipt.command.type)).toEqual([
      'folio.calendar_event.add.v1',
      'folio.material_change.record.v1',
      'folio.calendar_event.update.v1',
      'folio.calendar_event.remove.v1',
      'folio.material_change.record.v1',
      'folio.income_schedules.replace.v1',
      'folio.material_change.record.v1',
      'folio.income_schedule.update.v1',
      'folio.material_change.record.v1',
      'folio.income_schedule.remove.v1',
      'folio.material_change.record.v1',
      'folio.plan.add.v1',
      'folio.plan.contribution.record.v1',
      'folio.plan.remove.v1',
    ]);
    expect(
      pending.every((receipt) =>
        receipt.command.type === 'folio.material_change.record.v1'
          ? receipt.command.actor.kind === 'system'
          : receipt.command.actor.kind === 'user',
      ),
    ).toBe(true);

    const serialized = JSON.stringify(pending);
    for (const privateValue of [
      'Private calendar id',
      'Private calendar title',
      'Private calendar note',
      'Private income id',
      'Private income label',
      'Private updated income label',
      'Private plan id',
      'Private plan name',
      '2345.67',
      '4500.75',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('routes intelligence, evidence and companion runtime mutations without private values', () => {
    dismissIncomeSignal('Private employer');
    dismissBillSignal('Private utility');
    dismissDriftSignal('Private rail');
    confirmDriftSignal('Private rail');
    dismissAnnualSignal('Private annual merchant');
    rememberMerchantCategory('Private category merchant', 'bills');
    forgetMerchantCategory('Private category merchant');
    addIgnoredReviewSig('Private merchant|-8765|2026-07-31');
    unhideReviewSig('Private merchant|-8765|2026-07-31');
    addIgnoredBankExternalId('provider-neutral-private-row');

    const evidenceId = 'evidence_0123456789abcdef0123456789abcdef';
    addEvidenceDocument({
      id: evidenceId,
      filename: 'private-statement.pdf',
      mediaType: 'application/pdf',
      byteSize: 123_456,
      addedAtISO: '2026-07-16T11:00:00.000Z',
      sourceType: 'document',
      extractionStatus: 'read',
      storageState: 'encrypted-device-vault',
    });
    removeEvidenceDocument(evidenceId);

    recordAiRead(PERSONAL_WORKSPACE_ID, '2026-07');
    cacheAiRead(PERSONAL_WORKSPACE_ID, 'private-file-content-key', {
      candidates: [
        {
          id: 'private-cache-candidate',
          source: 'pdf',
          kind: 'bill',
          merchant: 'Private cached merchant',
          amount: -91.23,
          confidence: 'medium',
          note: 'Private cached source note',
        },
      ],
      closingBalance: {
        amount: 1_234.56,
        asOfISO: '2026-07-16T11:01:00.000Z',
      },
      at: '2026-07-16T11:02:00.000Z',
    });
    markWhatChangedSeen('2026-07-16T11:03:00.000Z');

    setLensFullUnlocked(true);
    startLensTrial('2026-07-01');
    endLensTrial();
    acknowledgeTrialEnd();
    setMelo({ quietMode: true, wardrobe: ['private-scarf'], tone: 'dry' });
    awardTinyWin('first-sub-caught');

    addStatementAsHistory([
      {
        id: 'private-import-candidate',
        source: 'pdf',
        kind: 'bill',
        merchant: 'Private imported merchant',
        amount: -71.89,
        date: '2026-07-15',
        confidence: 'high',
      },
    ]);

    const pending = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    expect(pending.map((receipt) => receipt.command.type)).toEqual([
      'folio.intelligence.income_signal.dismiss.v1',
      'folio.intelligence.bill_signal.dismiss.v1',
      'folio.intelligence.drift_signal.dismiss.v1',
      'folio.intelligence.drift_signal.confirm.v1',
      'folio.intelligence.annual_signal.dismiss.v1',
      'folio.intelligence.merchant_category.remember.v1',
      'folio.intelligence.merchant_category.forget.v1',
      'folio.intelligence.review_signature.ignore.v1',
      'folio.intelligence.review_signature.unhide.v1',
      'folio.intelligence.bank_external_id.ignore.v1',
      'folio.intelligence.evidence_document.add.v1',
      'folio.intelligence.evidence_document.remove.v1',
      'folio.companion.ai_read.record.v1',
      'folio.companion.ai_read_cache.store.v1',
      'folio.companion.what_changed.mark_seen.v1',
      'folio.companion.entitlement.reconcile.v1',
      'folio.companion.lens_trial.start.v1',
      'folio.companion.lens_trial.end.v1',
      'folio.companion.lens_trial.acknowledge_end.v1',
      'folio.companion.preferences.update.v1',
      'folio.companion.tiny_win.award.v1',
      'folio.transactions.record_batch.v1',
      'folio.material_change.record.v1',
      'folio.intelligence.statement_import.record.v1',
    ]);

    const serialized = JSON.stringify(pending);
    for (const privateValue of [
      'Private employer',
      'Private utility',
      'Private rail',
      'Private annual merchant',
      'Private category merchant',
      'Private merchant',
      'provider-neutral-private-row',
      'private-statement.pdf',
      'private-file-content-key',
      'Private cached merchant',
      'Private cached source note',
      'private-scarf',
      'Private imported merchant',
      '-91.23',
      '-71.89',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });
});

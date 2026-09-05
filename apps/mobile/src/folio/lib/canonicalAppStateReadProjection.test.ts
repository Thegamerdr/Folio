import { describe, expect, it } from 'vitest';

import { DEFAULT_ACCOUNT_ID, getState, resetToEmpty, type AppState } from '../store';
import { PERSONAL_WORKSPACE_ID, type PersistedWorkspace } from './workspaceRoot';

import { readCanonicalAppStateMoneyProjection } from './canonicalAppStateReadProjection';
import { createCanonicalAppStateProjection } from './canonicalStateProjection';

function emptyState(): AppState {
  resetToEmpty();
  return structuredClone(getState());
}

function personalWorkspace(state: AppState): PersistedWorkspace {
  const workspace = state.workspaces.find((candidate) => candidate.id === PERSONAL_WORKSPACE_ID);
  if (workspace === undefined) throw new Error('Personal workspace fixture is missing.');
  return workspace;
}

describe('canonical AppState read projection', () => {
  it('round-trips accounts, aggregate balance provenance, posted rows and future expectations', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      currentBalance: {
        amount: 1_475,
        source: 'pdf-derived',
        confidence: 'statement-derived',
        setAt: '2026-07-16T09:00:00.000Z',
      },
      accounts: [
        {
          id: DEFAULT_ACCOUNT_ID,
          name: 'Current / bills',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 1_000,
          balanceAsOfISO: '2026-07-16T07:01:02.003Z',
          addedAt: '2026-06-01T10:11:12.013Z',
          currency: 'GBP',
        },
        {
          id: 'acct:savings/α',
          name: 'Rainy day',
          kind: 'savings',
          isLiability: false,
          balanceMinor: 500,
          balanceAsOfISO: '2026-07-16T07:02:03.004Z',
          addedAt: '2026-06-02T10:11:12.013Z',
          currency: 'GBP',
          closed: true,
        },
        {
          id: 'acct-card',
          name: 'Card',
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: 300,
          balanceAsOfISO: '2026-07-16T07:03:04.005Z',
          addedAt: '2026-06-03T10:11:12.013Z',
          currency: 'GBP',
        },
      ],
      transactions: [
        {
          id: 'txn:melo/α?1',
          when: '2026-07-15T08:01:02.003Z',
          merchant: '  Corner & Co.  ',
          amount: -10.25,
          category: 'food',
          source: 'melo',
          sourceEvidenceId: 'evidence:pdf/1',
          externalId: 'external-neutral-1',
          bankConnectionId: 'connection-local-1',
          accountId: DEFAULT_ACCOUNT_ID,
          financialAction: {
            kind: 'transfer',
            transferId: 'transfer-roundtrip',
            pairedTransactionId: 'transfer-roundtrip:in',
            direction: 'out',
          },
        },
        {
          id: 'txn:future/bank',
          when: '2026-07-20T13:14:15.016Z',
          merchant: 'Future Rail',
          amount: -44.5,
          category: 'transport',
          source: 'bank',
          externalId: 'external-neutral-2',
          bankConnectionId: 'connection-local-2',
          accountId: 'acct:savings/α',
        },
        {
          id: 'txn-manual-last',
          when: '2026-07-14T17:18:19.020Z',
          merchant: 'Manual row',
          amount: 120,
          category: 'income',
          source: 'manual',
          accountId: 'acct-card',
        },
      ],
    };

    const canonical = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-16T12:00:00.000Z',
    );
    const read = readCanonicalAppStateMoneyProjection(
      canonical.repositorySnapshot,
      String(workspace.id),
    );

    expect(canonical.repositorySnapshot.collections.expectations).toHaveLength(1);
    expect(canonical.repositorySnapshot.collections.transactions).toHaveLength(2);
    expect(
      canonical.repositorySnapshot.collections.accounts.find(
        (account) => account.projectionRole === 'reconciliation',
      ),
    ).toMatchObject({ sourceAccountId: 'acct-balance-reconciliation' });
    expect(read.currentBalance).toEqual(state.currentBalance);
    expect(read.accounts).toEqual(
      (state.accounts ?? []).map((account) => ({ ...account, workspaceId: workspace.id })),
    );
    expect(read.transactions).toEqual(
      state.transactions.map((transaction) => ({ ...transaction, workspaceId: workspace.id })),
    );
    expect(
      canonical.mobileSnapshot.transactions.find(
        (transaction) => transaction.sourceTransactionId === 'txn:melo/α?1',
      )?.financialAction,
    ).toEqual(state.transactions[0]!.financialAction);
  });

  it('round-trips rework continuity, subscription recovery and route holds losslessly', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      subs: [
        {
          name: 'Melo Music',
          workspaceId: workspace.id,
          cost: 9.99,
          nextRenewalDaysAway: 4,
          nextRenewalISO: '2026-07-22',
          lastUsedDaysAgo: 3,
          usesPerMonth: 4,
          pausedUntil: '2026-08-23',
          autoResume: 'prompt',
          pauseReason: 'making room before payday',
          pausedAt: '2026-07-18',
        },
      ],
      subPaused: { 'Melo Music': true },
      cancelledSubs: [
        {
          name: 'Old Stream',
          workspaceId: workspace.id,
          monthlyAmount: 12.5,
          cancelledAt: '2026-07-10',
        },
      ],
      spendHold: {
        start: '2026-07-18',
        end: '2026-07-24',
        dailyCap: 18,
        setAt: '2026-07-18T09:00:00.000Z',
        breachedDates: ['2026-07-20'],
      },
      whatIfHolds: [
        {
          id: 'hold-weekly',
          workspaceId: workspace.id,
          amount: 35,
          recurrence: 'weekly',
          addedAt: '2026-07-18T09:05:00.000Z',
          label: 'Train',
        },
      ],
      meloPrimerSeen: true,
      lastOpenedAt: '2026-07-17T09:00:00.000Z',
      oneMoveHistory: [
        {
          key: 'review',
          shownAt: '2026-07-18',
          tappedAt: '2026-07-18T09:10:00.000Z',
        },
      ],
      meloDismissLog: [
        {
          kind: 'recovery',
          reason: 'not-now',
          at: '2026-07-18T09:15:00.000Z',
        },
      ],
    };

    const projection = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-18T12:00:00.000Z',
    );
    const read = readCanonicalAppStateMoneyProjection(
      projection.repositorySnapshot,
      String(workspace.id),
      '2026-07-18',
    );

    expect(read.subs).toEqual(state.subs);
    expect(read.subPaused).toEqual(state.subPaused);
    expect(read.cancelledSubs).toEqual(state.cancelledSubs);
    expect(read.spendHold).toEqual(state.spendHold);
    expect(read.whatIfHolds).toEqual(state.whatIfHolds);
    expect(read.meloPrimerSeen).toBe(true);
    expect(read.lastOpenedAt).toBe(state.lastOpenedAt);
    expect(read.oneMoveHistory).toEqual(state.oneMoveHistory);
    expect(read.meloDismissLog).toEqual(state.meloDismissLog);
  });

  it('round-trips the complete Business operations aggregate through canonical recovery', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      business: {
        ...base.business!,
        entity: {
          kind: 'ltd',
          companyName: 'Northstar Studio Ltd',
          companyNumber: '12345678',
          incorporatedOn: '2025-04-10',
          yearEnd: '2027-03-31',
          taxRegion: 'england-ni',
          directors: [{ id: 'director-1', name: 'Avery North' }],
          shareholders: [{ id: 'shareholder-1', name: 'Avery North', shares: 100 }],
          vat: { registered: true, scheme: 'cash', number: 'GB123456789' },
          createdAt: '2026-07-18T10:00:00.000Z',
        },
        clients: [
          {
            id: 'client-1',
            name: 'Exact Client',
            email: 'billing@example.test',
            createdAt: '2026-07-18T10:01:00.000Z',
          },
        ],
        invoices: [
          {
            id: 'invoice-1',
            clientId: 'client-1',
            clientName: 'Exact Client',
            reference: 'INV-001',
            issuedOn: '2026-07-01',
            dueOn: '2026-07-31',
            totalMinor: 240_000,
            paidMinor: 40_000,
            status: 'part-paid',
          },
        ],
        obligations: [
          {
            id: 'obligation-1',
            label: 'Studio rent',
            amountMinor: 75_000,
            cadence: 'monthly',
            nextDue: '2026-08-01',
            category: 'rent',
          },
        ],
        vatReturns: [
          {
            id: 'vat-2026-q2',
            periodStart: '2026-04-01',
            periodEnd: '2026-06-30',
            dueOn: '2026-08-07',
            box1OutputVatMinor: 40_000,
            box4InputVatMinor: 8_000,
            box6SalesExVatMinor: 200_000,
            box7PurchasesExVatMinor: 40_000,
          },
        ],
        filings: [
          {
            id: 'filing-vat-2026-q2',
            kind: 'vat',
            period: '2026-04-01 to 2026-06-30',
            preparedAt: '2026-07-18T10:02:00.000Z',
            policyPackVersion: base.business!.policyPackVersion,
            amountMinor: 32_000,
            status: 'prepared',
          },
        ],
        memory: [
          {
            id: 'business-memory-1',
            at: '2026-07-18T10:03:00.000Z',
            kind: 'first-invoice',
            summary: 'The first real invoice is in.',
            reflected: false,
          },
        ],
        ytdProfitMinor: 5_400_000,
        ctPotMinor: 1_000_000,
        vatPotMinor: 32_000,
        employmentAllowanceClaimed: true,
      },
    };

    const projection = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-18T12:00:00.000Z',
    );
    const read = readCanonicalAppStateMoneyProjection(
      projection.repositorySnapshot,
      String(workspace.id),
      '2026-07-18',
    );

    expect(projection.repositorySnapshot.collections.financialContexts[0]).toMatchObject({
      businessOperationsJson: expect.any(String),
    });
    expect(read.business).toEqual(state.business);
  });

  it('fails closed when exact aggregate provenance is absent', () => {
    const state = emptyState();
    const workspace = personalWorkspace(state);
    const canonical = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-16T12:00:00.000Z',
    );
    const observations = canonical.repositorySnapshot.collections.balanceObservations.map(
      ({ sourceVariant: _sourceVariant, ...observation }) => observation,
    );

    expect(() =>
      readCanonicalAppStateMoneyProjection(
        {
          ...canonical.repositorySnapshot,
          collections: {
            ...canonical.repositorySnapshot.collections,
            balanceObservations: observations,
          },
        },
        String(workspace.id),
      ),
    ).toThrow(/missing exact source or confidence metadata/i);
  });

  it('round-trips durable pots, ledger events, subscriptions, preferences, cycles and debts', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      pots: [
        {
          id: 'pot:buffer/α',
          name: 'Soft landing',
          saved: 321.09,
          goal: 900,
          perWeek: 27.5,
          accent: true,
          cadence: { kind: 'custom', nextDate: '2026-07-28' },
          allowNegative: true,
        },
        {
          id: 'pot-monthly',
          name: 'Annual bill',
          saved: 80,
          goal: 240,
          perWeek: 0,
          accent: false,
          cadence: { kind: 'monthly', dayOfMonth: 31 },
        },
      ],
      potLedger: [
        {
          id: 'ledger:entry/1',
          potId: 'pot:buffer/α',
          at: '2026-07-15T10:11:12.013Z',
          kind: 'borrow',
          amount: 12.34,
          source: 'shortfall-borrow',
        },
      ],
      subs: [
        {
          name: 'Gym Pro / α',
          cost: 12.34,
          nextRenewalDaysAway: 4,
          nextRenewalISO: '2026-07-20',
          renewalPeriodDays: 14,
          lastUsedDaysAgo: 9,
          usesPerMonth: 3,
          trialEndsInDays: 2,
        },
      ],
      subPaused: { 'Gym Pro / α': true, Orphan: false },
      subOverrides: { 'Gym Pro / α': 3 },
      cycles: [
        {
          closedAt: '2026-06-25',
          label: 'June / reconstructed',
          spare: 88.75,
          tightPoint: -4.2,
          setAside: 55,
          note: 'Imported from lived history.',
          reconstructed: true,
        },
      ],
      debts: [
        {
          id: 'debt:card/α',
          name: 'Main card',
          kind: 'card',
          balance: 1_203.45,
          apr: 24.9,
          minPayment: 48.12,
          dueDom: 31,
          addedAt: '2026-07-01T09:08:07.006Z',
          linkedAccountId: 'acct-card',
        },
      ],
      onboarding: { done: true, name: 'Avery / α', payday: 17, monthlyIncome: 2_345.67 },
      nextYouNote: 'Protect the calm week — no panic moves.',
      tightPointGoal: 123.45,
      droppedTransactionCount: 42,
      moneyMode: 'household',
      bufferAmount: 321,
      modeExtras: { household: 875, debt: 110 },
      household: {
        partnerName: 'Morgan',
        defaultShare: 0.6,
        subShareOverrides: { 'Gym Pro / α': 0.75 },
      },
      calendarEvents: [
        {
          id: 'calendar:event/α',
          date: '2026-07-31',
          time: '09:45',
          kind: 'out',
          title: 'Private annual renewal',
          note: 'Review before paying.',
          amount: -87.65,
          reminderOffsetMinutes: 90,
        },
      ],
      incomeSources: [
        {
          id: 'income:salary/α',
          label: 'Main pay',
          cadence: 'monthly',
          dayOfMonth: 17,
          amount: 2_345.67,
          source: 'manual',
        },
        {
          id: 'income:side/β',
          label: 'Side work',
          cadence: 'fortnightly',
          anchorISO: '2026-07-10',
          amount: 321.09,
          source: 'inferred',
        },
      ],
      plans: [
        {
          id: 'plan:home/α',
          name: 'Moving fund',
          target: 4_500.75,
          saved: 876.54,
          byDate: '2027-03-31',
          perWeek: 45.67,
          addedAt: '2026-07-16T08:07:06.005Z',
        },
      ],
      edits: [
        {
          id: 'edit:private/alpha',
          txnId: 'txn:private/alpha',
          field: 'merchant',
          before: 'Old private merchant',
          after: 'Correct private merchant',
          at: '2026-07-16T08:10:11.012Z',
          by: 'user',
        },
      ],
      ignoredReviewSigs: ['private merchant|-8765|2026-07-31'],
      ignoredBankExternalIds: ['provider-neutral/private-alpha'],
      dismissedIncomeSignals: ['private employer'],
      dismissedBillSignals: ['private utility'],
      dismissedDriftSignals: [{ merchant: 'private rail', at: '2026-07-16T08:11:12.013Z' }],
      dismissedAnnualSignals: ['private annual merchant'],
      merchantCategories: {
        'private merchant': {
          category: 'bills',
          correctedAt: '2026-07-16T08:12:13.014Z',
          hits: 3,
          pendingCategory: 'shopping',
          pendingCount: 1,
        },
      },
      statementImports: [
        {
          id: 'import:private/alpha',
          source: 'pdf',
          rowCount: 19,
          atISO: '2026-07-16T08:13:14.015Z',
          accountId: DEFAULT_ACCOUNT_ID,
          filename: 'private-statement.pdf',
          closingBalanceMinor: 1_475.25,
          sourceEvidenceId: 'evidence_0123456789abcdef0123456789abcdef',
        },
      ],
      evidenceDocuments: [
        {
          id: 'evidence_0123456789abcdef0123456789abcdef',
          filename: 'private-statement.pdf',
          mediaType: 'application/pdf',
          byteSize: 123_456,
          addedAtISO: '2026-07-16T08:13:14.015Z',
          sourceType: 'document',
          extractionStatus: 'read',
          storageState: 'encrypted-device-vault',
          linkedTransactionIds: ['private-transaction-alpha'],
        },
      ],
      aiReads: { monthKey: '2026-07', used: 4 },
      aiReadCache: {
        'sha256:private/alpha': {
          candidates: [
            {
              id: 'candidate:private/alpha',
              sourceEvidenceId: 'evidence_0123456789abcdef0123456789abcdef',
              source: 'pdf',
              kind: 'bill',
              merchant: 'Private utility',
              amount: -87.65,
              date: '2026-07-31',
              category: 'bills',
              confidence: 'medium',
              note: 'Private source note',
            },
          ],
          closingBalance: {
            amount: 1_475.25,
            asOfISO: '2026-07-16T08:14:15.016Z',
            openingAmount: 1_700,
            statedTotalDebits: 324.75,
            statedTotalCredits: 100,
          },
          at: '2026-07-16T08:15:16.017Z',
        },
      },
      whatChangedSeenISO: '2026-07-16T08:16:17.018Z',
      lens: {
        plusUnlocked: true,
        proUnlocked: true,
        trialCycleId: null,
        trialEndedCycleId: '2026-06-25',
        trialEndAcknowledged: false,
      },
      melo: {
        quietMode: true,
        wardrobe: ['touch:scarf', 'touch:mug'],
        companionIntroSeen: true,
        tone: 'dry',
      },
      tinyWins: [
        {
          id: 'win:private/alpha',
          kind: 'first-sub-caught',
          awardedAt: '2026-07-16T08:17:18.019Z',
          message: 'Caught your first sub. Handled it.',
        },
      ],
      timelineEvents: [
        {
          id: 'timeline:private/alpha',
          at: '2026-07-16T08:18:19.020Z',
          kind: 'review-ignored',
          subject: 'Private timeline subject',
          note: 'Private timeline note',
        },
      ],
      reviewQueue: [
        {
          id: 'review:private/alpha',
          source: 'bank',
          sourceEvidenceId: 'evidence_0123456789abcdef0123456789abcdef',
          merchant: 'Private queued merchant',
          amount: -54.32,
          date: '2026-07-30',
          accountId: DEFAULT_ACCOUNT_ID,
          externalId: 'neutral-private-queued',
          bankConnectionId: 'connection-private-queued',
          hint: 'Private queue hint',
          addedAt: '2026-07-16T08:19:20.021Z',
          category: 'bills',
          rememberedCategory: true,
        },
      ],
      reviewQueueSpillover: [
        {
          id: 'review:private/spillover',
          source: 'pdf',
          merchant: 'Private spillover merchant',
          amount: -21.09,
          addedAt: '2026-07-16T08:20:21.022Z',
        },
      ],
    };

    const canonical = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-16T12:00:00.000Z',
    );
    const read = readCanonicalAppStateMoneyProjection(
      canonical.repositorySnapshot,
      String(workspace.id),
      '2026-07-16',
    );

    expect(canonical.repositorySnapshot.collections).toMatchObject({
      pots: expect.arrayContaining([expect.objectContaining({ sourcePotId: 'pot:buffer/α' })]),
      potLedgerEntries: [expect.objectContaining({ sourceEntryId: 'ledger:entry/1' })],
      subscriptions: [
        expect.objectContaining({ sourceName: 'Gym Pro / α', cadence: 'fortnightly' }),
      ],
      subscriptionPreferences: expect.arrayContaining([
        expect.objectContaining({ sourceName: 'Orphan', paused: false }),
      ]),
      cycleRecords: [expect.objectContaining({ reconstructed: true })],
      debts: [expect.objectContaining({ sourceDebtId: 'debt:card/α' })],
      financialContexts: [
        expect.objectContaining({
          droppedTransactionCount: 42,
          moneyMode: 'household',
        }),
      ],
      calendarItems: expect.arrayContaining([
        expect.objectContaining({ sourceCalendarEventId: 'calendar:event/α', sourceOrdinal: 0 }),
      ]),
      incomeSchedules: [
        expect.objectContaining({ sourceIncomeId: 'income:salary/α', sourceOrdinal: 0 }),
        expect.objectContaining({ sourceIncomeId: 'income:side/β', sourceOrdinal: 1 }),
      ],
      plans: [expect.objectContaining({ sourcePlanId: 'plan:home/α', sourceOrdinal: 0 })],
      transactionIntelligenceStates: [
        expect.objectContaining({
          ignoredReviewSignatures: ['private merchant|-8765|2026-07-31'],
        }),
      ],
      companionRuntimeStates: [
        expect.objectContaining({
          aiReads: { monthKey: '2026-07', used: 4 },
          melo: expect.objectContaining({ companionIntroSeen: true }),
        }),
      ],
    });
    expect(read.pots).toEqual(state.pots.map((pot) => ({ ...pot, workspaceId: workspace.id })));
    expect(read.potLedger).toEqual(
      state.potLedger.map((entry) => ({ ...entry, workspaceId: workspace.id })),
    );
    expect(read.subs).toEqual(
      state.subs.map((subscription) => ({ ...subscription, workspaceId: workspace.id })),
    );
    expect(read.subPaused).toEqual(state.subPaused);
    expect(read.subOverrides).toEqual(state.subOverrides);
    expect(read.cycles).toEqual(
      state.cycles.map((cycle) => ({ ...cycle, workspaceId: workspace.id })),
    );
    expect(read.debts).toEqual(
      (state.debts ?? []).map((debt) => ({ ...debt, workspaceId: workspace.id })),
    );
    expect(read.onboarding).toEqual(state.onboarding);
    expect(read.nextYouNote).toBe(state.nextYouNote);
    expect(read.tightPointGoal).toBe(state.tightPointGoal);
    expect(read.droppedTransactionCount).toBe(state.droppedTransactionCount);
    expect(read.moneyMode).toBe(state.moneyMode);
    expect(read.bufferAmount).toBe(state.bufferAmount);
    expect(read.modeExtras).toEqual(state.modeExtras);
    expect(read.household).toEqual(state.household);
    expect(read.calendarEvents).toEqual(
      state.calendarEvents.map((event) => ({ ...event, workspaceId: workspace.id })),
    );
    expect(read.incomeSources).toEqual(
      (state.incomeSources ?? []).map((source) => ({ ...source, workspaceId: workspace.id })),
    );
    expect(read.plans).toEqual(
      (state.plans ?? []).map((plan) => ({ ...plan, workspaceId: workspace.id })),
    );
    expect(read.edits).toEqual(
      (state.edits ?? []).map((edit) => ({ ...edit, workspaceId: workspace.id })),
    );
    expect(read.ignoredReviewSigs).toEqual(state.ignoredReviewSigs);
    expect(read.ignoredBankExternalIds).toEqual(state.ignoredBankExternalIds);
    expect(read.dismissedIncomeSignals).toEqual(state.dismissedIncomeSignals);
    expect(read.dismissedBillSignals).toEqual(state.dismissedBillSignals);
    expect(read.dismissedDriftSignals).toEqual(
      (state.dismissedDriftSignals ?? []).map((entry) => ({
        ...entry,
        workspaceId: workspace.id,
      })),
    );
    expect(read.dismissedAnnualSignals).toEqual(state.dismissedAnnualSignals);
    expect(read.merchantCategories).toEqual(state.merchantCategories);
    expect(read.statementImports).toEqual(
      (state.statementImports ?? []).map((entry) => ({ ...entry, workspaceId: workspace.id })),
    );
    expect(read.evidenceDocuments).toEqual(
      (state.evidenceDocuments ?? []).map((document) => ({
        ...document,
        workspaceId: workspace.id,
      })),
    );
    expect(read.aiReads).toEqual(state.aiReads);
    expect(read.aiReadCache).toEqual(state.aiReadCache);
    expect(read.whatChangedSeenISO).toBe(state.whatChangedSeenISO);
    expect(read.lens).toEqual(state.lens);
    expect(read.melo).toEqual(state.melo);
    expect(read.tinyWins).toEqual(state.tinyWins);
    expect(read.timelineEvents).toEqual(
      (state.timelineEvents ?? []).map((event) => ({ ...event, workspaceId: workspace.id })),
    );
    expect(read.reviewQueue).toEqual(
      (state.reviewQueue ?? []).map((item) => ({ ...item, workspaceId: workspace.id })),
    );
    expect(read.reviewQueueSpillover).toEqual(
      (state.reviewQueueSpillover ?? []).map((item) => ({
        ...item,
        workspaceId: workspace.id,
      })),
    );
  });

  it('rejects a canonical commit when a source amount cannot round-trip as integer minor units', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      transactions: [
        {
          id: 'fractional-minor-units',
          when: '2026-07-15T08:00:00.000Z',
          merchant: 'Invalid precision',
          amount: -1.234,
          category: 'other',
          source: 'manual',
          accountId: DEFAULT_ACCOUNT_ID,
        },
      ],
    };

    expect(() =>
      createCanonicalAppStateProjection(state, workspace, '2026-07-16T12:00:00.000Z'),
    ).toThrow(/projection parity failed for transactions/i);
  });
});

import { describe, expect, it } from 'vitest';
import { createCurrencyCode } from '@folio/domain';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  applyCategorisation,
  buildBoundedImportQuestionPlan,
  buildImportMeaningIndex,
  buildImportReviewPacket,
  buildSearchIndexEntries,
  detectImportFormat,
  findDuplicateCandidates,
  findTransferCandidates,
  importEngineBoundary,
  parseCsvImport,
  parseImportFile,
  parseOfxImport,
  parseQifImport,
  parseTextImport,
  reconcileImportedBalances,
  sanitizeSpreadsheetText,
  summariseCashflow,
} from '../src/index.js';

const base = {
  importJobId: 'import_job_phase5',
  sourceFileId: 'source_file_statement',
  accountId: 'account_current',
  currency: 'GBP',
} as const;
const gbp = createCurrencyCode('GBP');
const fixtureRoot = fileURLToPath(
  new URL('../../../apps/mobile/fixtures/bank-inputs/', import.meta.url).href,
);

function fixture(name: string): string {
  return readFileSync(`${fixtureRoot}${name}`, 'utf8');
}

const syntheticStatementCsvFixture = {
  importJobId: 'import_job_synthetic_review_001',
  sourceFileId: 'source_file_synthetic_statement_001',
  accountId: 'account_synthetic_current',
  currency: 'GBP',
  text: [
    'Date,Description,Debit,Credit,Balance,Transaction ID',
    '2026-06-20,Synthetic corner shop,12.34,,1237.66,syn-fit-001',
    '2026-06-21,Synthetic wages,,585.00,1822.66,syn-fit-002',
    '2026-06-22,Synthetic rent,735.00,,1087.66,syn-fit-003',
  ].join('\n'),
  expectedRows: [
    { localDate: '2026-06-20', description: 'Synthetic corner shop', amountMinor: -1234 },
    { localDate: '2026-06-21', description: 'Synthetic wages', amountMinor: 58500 },
    { localDate: '2026-06-22', description: 'Synthetic rent', amountMinor: -73500 },
  ],
} as const;

describe('Phase 5 import engine boundary', () => {
  it('keeps native, vault, OCR and UI capabilities blocked as metadata', () => {
    expect(importEngineBoundary.writesDirectlyToStorage).toBe(false);
    expect(importEngineBoundary.importsNativeOrUiRuntime).toBe(false);
    expect(
      importEngineBoundary.phase5BlockedCapabilities.map((capability) => capability.capability),
    ).toEqual(['encrypted-file-staging', 'pdf-image-ocr', 'review-ui']);
  });
});

describe('CSV canonical import rows', () => {
  it('parses quoted CSV, maps canonical fields, and escapes formula-like text', () => {
    const result = parseCsvImport({
      ...base,
      text: [
        'Date,Description,Debit,Credit,Balance,Transaction ID',
        '2026-01-02,"=HYPERLINK(""https://bad.example"",""Rent"")",800.00,,1200.00,fit-1',
        '2026-01-03,Payroll,,2500.00,3700.00,fit-2',
      ].join('\n'),
      parsedAt: '2026-01-10T00:00:00.000Z',
    });

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.normalized).toMatchObject({
      postedDate: '2026-01-02',
      description: '\'=HYPERLINK("https://bad.example","Rent")',
      amount: { minorUnits: -80000, currency: 'GBP' },
      runningBalance: { minorUnits: 120000, currency: 'GBP' },
      providerTransactionId: 'fit-1',
    });
    expect(result.rows[0]?.reviewState.reasons).toContain('formula_like_text');
    expect(result.rows[0]?.provenance).toMatchObject({
      importJobId: base.importJobId,
      sourceFileId: base.sourceFileId,
      sourceRowRef: 'csv:2',
      parsedAt: '2026-01-10T00:00:00.000Z',
    });
  });

  it('keeps repeated imports deterministic', () => {
    const text = 'Date,Description,Amount\n2026-01-04,Coffee,-3.25';
    const first = parseCsvImport({ ...base, text });
    const second = parseCsvImport({ ...base, text });

    expect(second.rows[0]?.canonicalRowId).toBe(first.rows[0]?.canonicalRowId);
    expect(second.rows[0]?.stableTransactionId).toBe(first.rows[0]?.stableTransactionId);
    expect(second.rows[0]?.provenance.rawRowHash).toBe(first.rows[0]?.provenance.rawRowHash);
  });

  it('supports explicit mappings for debit and credit exports', () => {
    const result = parseCsvImport({
      ...base,
      text: 'When,Payee,Out,In\n04/01/2026,Groceries,12.34,',
      dateOrder: 'dmy',
      mapping: { date: 'When', description: 'Payee', debit: 'Out', credit: 'In' },
    });

    expect(result.rows[0]?.normalized.postedDate).toBe('2026-01-04');
    expect(result.rows[0]?.normalized.amount.minorUnits).toBe(-1234);
  });
});

describe('deterministic import review packet', () => {
  it('turns the synthetic statement fixture into review rows and a commit preview', () => {
    const result = parseCsvImport({
      importJobId: syntheticStatementCsvFixture.importJobId,
      sourceFileId: syntheticStatementCsvFixture.sourceFileId,
      accountId: syntheticStatementCsvFixture.accountId,
      currency: syntheticStatementCsvFixture.currency,
      text: syntheticStatementCsvFixture.text,
      parsedAt: '2026-06-21T10:00:00.000Z',
    });
    const packet = buildImportReviewPacket({
      parseResult: result,
      categorisation: {
        knownCounterparties: {
          'Synthetic wages': 'category_salary',
        },
        userRules: [
          {
            categoryId: 'category_housing',
            pattern: /synthetic rent/i,
          },
          {
            categoryId: 'category_everyday',
            pattern: /synthetic corner shop/i,
          },
        ],
      },
    });

    expect(packet.rows.map((row) => [row.postedDate, row.description, row.amountMinor])).toEqual(
      syntheticStatementCsvFixture.expectedRows.map((row) => [
        row.localDate,
        row.description,
        row.amountMinor,
      ]),
    );
    expect(packet.counts).toMatchObject({
      parsedRows: 3,
      readyForAcceptance: 0,
      needsUserReview: 3,
      parseIssues: 0,
    });
    expect(packet.rows.every((row) => row.decisionState === 'needs_user_review')).toBe(true);
    expect(packet.commitPreview.acceptedRows).toEqual([]);
    expect(packet.commitPreview.deferredRowIds).toEqual(packet.rows.map((row) => row.rowId));
    expect(packet.cashflow.income.minorUnits).toBe(58500);
    expect(packet.cashflow.spending.minorUnits).toBe(-74734);
    expect(packet.searchIndex[0]?.provenanceHash).toBe(packet.rows[0]?.provenanceHash);
  });
});

describe('whole-app import truth fixtures', () => {
  it('exposes the import truth contract without treating staged rows as accepted facts', () => {
    const result = parseImportFile({
      ...base,
      filename: 'messy.csv',
      text: fixture('messy.csv'),
      dateOrder: 'dmy',
      parsedAt: '2026-06-24T09:00:00.000Z',
      mapping: {
        date: 'When',
        description: 'Payee',
        debit: 'Out',
        credit: 'In',
        runningBalance: 'Balance',
        providerTransactionId: 'ID',
      },
    });
    const packet = buildImportReviewPacket({ parseResult: result });

    expect(packet).toMatchObject({
      importJobId: base.importJobId,
      sourceFileId: base.sourceFileId,
      format: 'csv',
      commitPreview: { acceptedRows: [], caveat: 'preview_only_requires_review_command' },
    });
    expect(result.metadata).toMatchObject({
      importJobId: base.importJobId,
      sourceFileId: base.sourceFileId,
      accountId: base.accountId,
      rowCount: 3,
    });
    expect(result.parser.limitations.length).toBeGreaterThan(0);
    expect(packet.rows).toHaveLength(3);
    expect(packet.rows.every((row) => row.sourceRowRef.startsWith('csv:'))).toBe(true);
    expect(packet.rows.every((row) => row.reviewStatus === 'needs_review')).toBe(true);
    expect(packet.rows.every((row) => row.decisionState === 'needs_user_review')).toBe(true);
    expect(packet.rows.some((row) => row.reasons.includes('formula_like_text'))).toBe(true);
    expect(packet.searchIndex).toHaveLength(3);
    expect(packet.commitPreview.deferredRowIds).toEqual(packet.rows.map((row) => row.rowId));
    expect(packet.counts).toMatchObject({
      parsedRows: 3,
      readyForAcceptance: 0,
      needsUserReview: 3,
    });
  });

  it('does not require CSV because pasted bank text can be staged', () => {
    const result = parseImportFile({
      ...base,
      filename: 'pasted-statement.txt',
      text: fixture('pasted-statement.txt'),
      parsedAt: '2026-06-24T09:00:00.000Z',
    });
    const packet = buildImportReviewPacket({ parseResult: result });

    expect(result.format).toBe('text');
    expect(result.rows).toHaveLength(3);
    expect(result.reconciliation?.state).toBe('exact_match');
    expect(packet.counts.parsedRows).toBe(3);
    expect(packet.rows.every((row) => row.decisionState === 'needs_user_review')).toBe(true);
    expect(packet.commitPreview.acceptedRows).toEqual([]);
  });

  it('keeps messy CSV warninged and review-only', () => {
    const result = parseCsvImport({
      ...base,
      text: fixture('messy.csv'),
      dateOrder: 'dmy',
      mapping: {
        date: 'When',
        description: 'Payee',
        debit: 'Out',
        credit: 'In',
        runningBalance: 'Balance',
        providerTransactionId: 'ID',
      },
    });
    const packet = buildImportReviewPacket({ parseResult: result });

    expect(result.rows).toHaveLength(3);
    expect(result.rows[1]?.reviewState.reasons).toContain('formula_like_text');
    expect(packet.rows.filter((row) => row.decisionState === 'needs_user_review')).toHaveLength(3);
  });

  it('detects duplicates without double counting them as accepted rows', () => {
    const result = parseCsvImport({ ...base, text: fixture('duplicate-rows.csv') });
    const packet = buildImportReviewPacket({ parseResult: result });

    expect(packet.duplicates.length).toBeGreaterThan(0);
    expect(packet.rows.some((row) => row.reasons.includes('possible_duplicate'))).toBe(true);
    expect(packet.commitPreview.acceptedRows).toEqual([]);
  });

  it('detects transfers across accounts and removes confirmed pairs from income/spending', () => {
    const current = parseCsvImport({
      ...base,
      accountId: 'account_current',
      sourceFileId: 'source_transfer_current',
      text: fixture('transfer-current.csv'),
    });
    const savings = parseCsvImport({
      ...base,
      accountId: 'account_savings',
      sourceFileId: 'source_transfer_savings',
      text: fixture('transfer-savings.csv'),
    });
    const rows = [...current.rows, ...savings.rows];
    const transfers = findTransferCandidates(rows);
    const cashflow = summariseCashflow({ rows, confirmedTransfers: transfers });

    expect(transfers).toHaveLength(1);
    expect(cashflow.income.minorUnits).toBe(0);
    expect(cashflow.spending.minorUnits).toBe(0);
    expect(cashflow.transferMovement.minorUnits).toBe(0);
  });

  it('flags balance mismatches from plain text instead of claiming certainty', () => {
    const result = parseTextImport({
      ...base,
      text: fixture('balance-mismatch.txt'),
      parsedAt: '2026-06-24T09:00:00.000Z',
    });
    const packet = buildImportReviewPacket({ parseResult: result });

    expect(result.reconciliation?.state).toBe('unresolved_mismatch');
    expect(packet.rows.every((row) => row.reasons.includes('balance_mismatch'))).toBe(true);
  });

  it('indexes meanings conservatively: salary and rent are possible, Tesco is not an event', () => {
    const result = parseCsvImport({
      ...base,
      text: [
        fixture('salary-income.csv'),
        fixture('rent-bill.csv').split(/\r?\n/u).slice(1).join('\n'),
        fixture('supermarket-card-spending.csv').split(/\r?\n/u).slice(1).join('\n'),
        fixture('refund.csv').split(/\r?\n/u).slice(1).join('\n'),
        fixture('unclear-merchant.csv').split(/\r?\n/u).slice(1).join('\n'),
      ].join('\n'),
    });
    const packet = buildImportReviewPacket({ parseResult: result });
    const meaningIndex = buildImportMeaningIndex({ packet });

    expect(meaningIndex.meanings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'income_event',
          state: 'possible_review_only',
          createsEvent: false,
        }),
        expect.objectContaining({
          kind: 'recurring_commitment',
          state: 'possible_review_only',
          createsEvent: false,
        }),
        expect.objectContaining({
          kind: 'spending_transaction',
          state: 'transaction_only',
          createsEvent: false,
        }),
        expect.objectContaining({
          kind: 'refund',
          state: 'possible_review_only',
          createsEvent: false,
        }),
        expect.objectContaining({
          kind: 'unclear_merchant',
          state: 'possible_review_only',
          createsEvent: false,
        }),
      ]),
    );
  });

  it('creates explainable confirmed meanings only from supplied user confirmations', () => {
    const result = parseCsvImport({ ...base, text: fixture('salary-income.csv') });
    const packet = buildImportReviewPacket({ parseResult: result });
    const rowId = packet.rows[0]?.rowId;
    const meaningIndex = buildImportMeaningIndex({
      packet,
      confirmedMeaningRowIds: rowId === undefined ? [] : [rowId],
    });

    expect(meaningIndex.meanings[0]).toMatchObject({
      kind: 'income_event',
      state: 'confirmed',
      createsEvent: true,
      reviewRequired: false,
    });
    expect(meaningIndex.meanings[0]?.explanation).toContain('User confirmed');
  });
});

describe('OFX/QFX and QIF parsing', () => {
  it('parses OFX transactions, balances, and stable FITID/fallback identities', () => {
    const ofx = `
      <OFX>
        <BANKMSGSRSV1><STMTTRNRS><STMTRS>
          <CURDEF>GBP
          <BANKACCTFROM><ACCTID>12345678</ACCTID></BANKACCTFROM>
          <BANKTRANLIST>
            <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260102120000<TRNAMT>-10.50<FITID>abc-1<NAME>Coffee</STMTTRN>
            <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260103<TRNAMT>100.00<NAME>Refund<MEMO>No fit id</STMTTRN>
          </BANKTRANLIST>
          <LEDGERBAL><BALAMT>89.50<DTASOF>20260103</LEDGERBAL>
        </STMTRS></STMTTRNRS></BANKMSGSRSV1>
      </OFX>`;

    const result = parseOfxImport({ ...base, text: ofx, accountExternalId: 'acct-current' });
    const repeat = parseOfxImport({ ...base, text: ofx, accountExternalId: 'acct-current' });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.normalized.providerTransactionId).toBe('abc-1');
    expect(result.rows[1]?.stableTransactionId).toBe(repeat.rows[1]?.stableTransactionId);
    expect(result.reconciliation?.state).toBe('unresolved_mismatch');
    expect(result.metadata.accountExternalId).toBe('12345678');
  });

  it('parses QIF as legacy best effort and makes limitations review-visible', () => {
    const qif = [
      '!Type:Bank',
      'D02/01/26',
      'T-42.10',
      'PCorner Shop',
      'N123',
      '^',
      'D03/01/26',
      'T200.00',
      'PPayroll',
      'SSplit category',
      '$100.00',
      '^',
    ].join('\n');

    const result = parseQifImport({ ...base, text: qif, dateOrder: 'dmy' });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.normalized.postedDate).toBe('2026-01-02');
    expect(result.rows[1]?.reviewState.reasons).toContain('qif_limitation');
    expect(result.rows[1]?.reviewState.reasons).toContain('untrusted_parser_input');
    expect(result.parser.limitations.join(' ')).toContain('currency');
  });
});

describe('dedupe, transfers, reconciliation, categorisation and indexing', () => {
  it('finds layered duplicate candidates without dropping rows', () => {
    const result = parseCsvImport({
      ...base,
      text: [
        'Date,Description,Amount,Transaction ID',
        '2026-01-02,Coffee,-3.50,fit-1',
        '2026-01-02,Coffee,-3.50,fit-1',
        '2026-01-03,Coffee shop,-3.50,fit-2',
      ].join('\n'),
    });

    const candidates = findDuplicateCandidates(result.rows);

    expect(result.rows).toHaveLength(3);
    expect(candidates.some((candidate) => candidate.reason === 'provider_id')).toBe(true);
    expect(candidates.some((candidate) => candidate.reason === 'pending_to_posted_candidate')).toBe(
      true,
    );
    expect(result.rows[0]?.reviewState.reasons).toContain('possible_duplicate');
  });

  it('detects transfers and excludes confirmed transfer pairs from income/spending totals', () => {
    const current = parseCsvImport({
      ...base,
      accountId: 'account_current',
      text: 'Date,Description,Amount\n2026-01-05,Transfer to savings,-100.00\n2026-01-05,Salary,1000.00',
    });
    const savings = parseCsvImport({
      ...base,
      accountId: 'account_savings',
      sourceFileId: 'source_file_savings',
      text: 'Date,Description,Amount\n2026-01-06,Internal transfer from current,100.00',
    });
    const rows = [...current.rows, ...savings.rows];
    const transfers = findTransferCandidates(rows);
    const cashflow = summariseCashflow({ rows, confirmedTransfers: transfers });

    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ evidenceLevel: 'high' });
    expect(cashflow.income.minorUnits).toBe(100000);
    expect(cashflow.spending.minorUnits).toBe(0);
    expect(cashflow.transferMovement.minorUnits).toBe(0);
  });

  it('reconciles exact and mismatched balances deterministically', () => {
    const result = parseCsvImport({
      ...base,
      text: 'Date,Description,Amount\n2026-01-02,Coffee,-10.00\n2026-01-03,Payroll,100.00',
    });

    expect(
      reconcileImportedBalances({
        rows: result.rows,
        openingBalance: { minorUnits: 10000, currency: gbp },
        closingBalance: { minorUnits: 19000, currency: gbp },
      }).state,
    ).toBe('exact_match');
    expect(
      reconcileImportedBalances({
        rows: result.rows,
        openingBalance: { minorUnits: 10000, currency: gbp },
        closingBalance: { minorUnits: 18000, currency: gbp },
      }).difference?.minorUnits,
    ).toBe(-1000);
  });

  it('applies the categorisation ladder and emits search entries', () => {
    const result = parseCsvImport({
      ...base,
      text: 'Date,Description,Amount\n2026-01-02,Tesco groceries,-30.00\n2026-01-03,ACME Payroll,2000.00',
    });

    const categorised = applyCategorisation(result.rows, {
      knownCounterparties: { 'ACME Payroll': 'category_salary' },
    });
    const search = buildSearchIndexEntries(categorised);

    expect(categorised[0]?.normalized.categoryProposal).toMatchObject({
      categoryId: 'category_groceries',
      source: 'bundled_rule',
      requiresReview: true,
    });
    expect(categorised[1]?.normalized.categoryProposal).toMatchObject({
      categoryId: 'category_salary',
      source: 'known_counterparty',
      requiresReview: false,
    });
    expect(search[0]?.tokens).toContain('tesco');
    expect(search[0]?.provenanceHash).toBe(categorised[0]?.provenance.rawRowHash);
  });

  it('caps import questions and defers the remaining review work', () => {
    const first = parseCsvImport({
      ...base,
      text: [
        'Date,Description,Amount,Transaction ID',
        '2026-01-02,Coffee,-3.50,fit-1',
        '2026-01-02,Coffee,-3.50,fit-1',
      ].join('\n'),
    });
    const current = parseCsvImport({
      ...base,
      accountId: 'account_current',
      sourceFileId: 'source_file_current',
      text: 'Date,Description,Amount\n2026-01-05,Transfer to savings,-100.00',
    });
    const savings = parseCsvImport({
      ...base,
      accountId: 'account_savings',
      sourceFileId: 'source_file_savings',
      text: 'Date,Description,Amount\n2026-01-06,Internal transfer from current,100.00',
    });
    const categorised = applyCategorisation([...first.rows, ...current.rows, ...savings.rows]);
    const duplicates = findDuplicateCandidates(categorised);
    const transfers = findTransferCandidates(categorised);
    const plan = buildBoundedImportQuestionPlan({
      rows: categorised,
      duplicates,
      transfers,
      reconciliation: {
        state: 'unresolved_mismatch',
        importedMovementTotal: { minorUnits: -700, currency: gbp },
        difference: { minorUnits: 100, currency: gbp },
        explanations: ['Source balances do not equal imported movement.'],
      },
      maxQuestions: 3,
    });

    expect(plan.cap).toBe(3);
    expect(plan.questions).toHaveLength(3);
    expect(plan.questions.map((question) => question.intent)).toEqual([
      'resolve_duplicate',
      'confirm_transfer',
      'explain_balance_mismatch',
    ]);
    expect(plan.deferredIssueCount).toBeGreaterThan(0);
    expect(plan.reviewQueueReason).toContain('review queue');
  });
});

describe('format detection and spreadsheet safety helper', () => {
  it('detects supported import formats from text or filename', () => {
    expect(detectImportFormat('<OFX></OFX>')).toBe('ofx');
    expect(detectImportFormat('!Type:Bank\n^')).toBe('qif');
    expect(detectImportFormat('Date,Amount', 'statement.qfx')).toBe('qfx');
    expect(detectImportFormat('2026-06-24 ACME Salary +1840.00', 'statement.txt')).toBe('text');
    expect(detectImportFormat('Date,Amount')).toBe('csv');
  });

  it('routes generic imports and never evaluates spreadsheet-looking text', () => {
    const result = parseImportFile({
      ...base,
      filename: 'statement.csv',
      text: 'Date,Description,Amount\n2026-01-02,+cmd|-calc,-1.00',
    });

    expect(sanitizeSpreadsheetText('+cmd|-calc')).toBe("'+cmd|-calc");
    expect(result.rows[0]?.normalized.description).toBe("'+cmd|-calc");
    expect(result.rows[0]?.reviewState.reasons).toContain('formula_like_text');
  });
});

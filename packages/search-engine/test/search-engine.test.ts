import type { WorkspaceId } from '@folio/domain';
import { describe, expect, it } from 'vitest';

import {
  LocalSearchIndex,
  buildSearchIndexRecord,
  parseNaturalLanguageSearchQuery,
  rebuildSearchIndex,
  searchEngineBoundary,
} from '../src/index.js';

const workspaceAlpha = 'workspace_synthetic_alpha' as WorkspaceId;
const workspaceBeta = 'workspace_synthetic_beta' as WorkspaceId;

const alphaRecords = [
  {
    ref: {
      workspaceId: workspaceAlpha,
      entityType: 'transaction',
      entityId: 'transaction_synthetic_grocery',
      sourceVersion: 'revision:1',
    },
    title: 'Synthetic Grocer debit',
    excerpt: 'Labelled fixture for reusable bags and lunch supplies',
    keywords: ['synthetic fixture', 'debit'],
    facets: {
      merchant: 'Synthetic Grocer One',
      reference: 'SYN-REF-001',
      date: '2026-04-10',
      amount: { minorUnits: -4250, currency: 'GBP' },
      categoryId: 'category_synthetic_meals',
      accountId: 'account_synthetic_current',
      documentId: 'document_synthetic_receipt',
      businessTaxPeriod: '2026-Q2',
    },
  },
  {
    ref: {
      workspaceId: workspaceAlpha,
      entityType: 'event',
      entityId: 'event_synthetic_tax_deadline',
      sourceVersion: 'revision:1',
    },
    title: 'Synthetic VAT filing event',
    excerpt: 'Labelled fixture for a business tax period deadline',
    facets: {
      date: '2026-04-30',
      eventType: 'tax_deadline',
      businessTaxPeriod: '2026-Q2',
    },
  },
  {
    ref: {
      workspaceId: workspaceAlpha,
      entityType: 'plan',
      entityId: 'plan_synthetic_cashflow',
      sourceVersion: 'revision:1',
    },
    title: 'Synthetic cashflow plan milestone',
    excerpt: 'Labelled fixture plan for April reserve movement',
    facets: {
      date: '2026-04-18',
      amount: { minorUnits: 150000, currency: 'GBP' },
      planId: 'plan_synthetic_cashflow',
      accountIds: ['account_synthetic_current', 'account_synthetic_reserve'],
    },
  },
] as const;

describe('Phase 6 search engine boundary', () => {
  it('keeps the implementation pure, deterministic and local', () => {
    expect(searchEngineBoundary).toMatchObject({
      deterministic: true,
      importsDatabaseDriver: false,
      importsNativeRuntime: false,
      importsCloudOrAi: false,
      storesSourcePayloads: false,
      workspaceScoped: true,
    });
  });
});

describe('local indexing and typed search', () => {
  it('indexes by workspace and applies typed filters for financial, event, plan and document facets', () => {
    const index = new LocalSearchIndex(
      rebuildSearchIndex([
        ...alphaRecords,
        {
          ref: {
            workspaceId: workspaceBeta,
            entityType: 'transaction',
            entityId: 'transaction_synthetic_beta_shadow',
          },
          title: 'Synthetic Grocer debit',
          excerpt: 'Labelled fixture in a different workspace',
          facets: {
            merchant: 'Synthetic Grocer One',
            reference: 'SYN-REF-001',
            date: '2026-04-10',
            amount: { minorUnits: -4250, currency: 'GBP' },
            categoryId: 'category_synthetic_meals',
            accountId: 'account_synthetic_current',
          },
        },
      ]),
    );

    const transactionResults = index.search({
      workspaceId: workspaceAlpha,
      text: 'grocer',
      filters: {
        merchant: 'grocer one',
        reference: 'REF-001',
        date: '2026-04-10',
        dateRange: { from: '2026-04-01', to: '2026-04-30' },
        amount: {
          minMinorUnits: 4000,
          maxMinorUnits: 5000,
          currency: 'GBP',
          useAbsolute: true,
        },
        categoryId: 'category_synthetic_meals',
        accountId: 'account_synthetic_current',
        entityType: 'transaction',
        documentId: 'document_synthetic_receipt',
        businessTaxPeriod: '2026-Q2',
      },
    });

    expect(transactionResults.map((result) => result.ref.entityId)).toEqual([
      'transaction_synthetic_grocery',
    ]);
    expect(transactionResults[0]?.facets.amount).toEqual({ minorUnits: -4250, currency: 'GBP' });

    expect(
      index.search({
        workspaceId: workspaceBeta,
        text: 'grocer',
        filters: { accountId: 'account_synthetic_current' },
      }),
    ).toHaveLength(1);

    expect(
      index.search({
        workspaceId: workspaceAlpha,
        filters: { eventType: 'tax_deadline', businessTaxPeriod: '2026-Q2' },
      })[0]?.ref.entityId,
    ).toBe('event_synthetic_tax_deadline');

    expect(
      index.search({
        workspaceId: workspaceAlpha,
        filters: { planId: 'plan_synthetic_cashflow', accountId: 'account_synthetic_reserve' },
      })[0]?.ref.entityId,
    ).toBe('plan_synthetic_cashflow');
  });

  it('keeps archive and privacy visibility explicit', () => {
    const index = new LocalSearchIndex();
    index.upsert({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'document',
        entityId: 'document_synthetic_archived',
      },
      title: 'Synthetic archived statement',
      archived: true,
    });
    index.upsert({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'document',
        entityId: 'document_synthetic_private',
      },
      title: 'Synthetic private memo',
      privacy: 'private',
    });
    index.upsert({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'document',
        entityId: 'document_synthetic_sensitive',
      },
      title: 'Synthetic sensitive tax note',
      privacy: 'sensitive',
    });

    expect(index.search({ workspaceId: workspaceAlpha, text: 'archived' })).toHaveLength(0);
    expect(
      index.search({ workspaceId: workspaceAlpha, text: 'archived', archive: 'archived' })[0]?.ref
        .entityId,
    ).toBe('document_synthetic_archived');
    expect(index.search({ workspaceId: workspaceAlpha, text: 'private' })).toHaveLength(0);
    expect(
      index.search({
        workspaceId: workspaceAlpha,
        text: 'private',
        privacy: 'include_private',
      })[0]?.ref.entityId,
    ).toBe('document_synthetic_private');
    expect(index.search({ workspaceId: workspaceAlpha, text: 'sensitive' })).toHaveLength(0);
    expect(
      index.search({
        workspaceId: workspaceAlpha,
        text: 'sensitive',
        privacy: 'include_sensitive',
      })[0]?.ref.entityId,
    ).toBe('document_synthetic_sensitive');
  });

  it('returns deterministic ranking and highlight metadata', () => {
    const index = new LocalSearchIndex();
    index.upsert({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'transaction',
        entityId: 'transaction_synthetic_title_match',
      },
      title: 'Synthetic coffee title match',
      excerpt: 'Labelled fixture with a lower amount',
      facets: {
        date: '2026-04-12',
        amount: { minorUnits: -300, currency: 'GBP' },
      },
    });
    index.upsert({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'transaction',
        entityId: 'transaction_synthetic_excerpt_match',
      },
      title: 'Synthetic refreshment fixture',
      excerpt: 'Labelled coffee term in the excerpt',
      facets: {
        date: '2026-04-13',
        amount: { minorUnits: -400, currency: 'GBP' },
      },
    });

    const results = index.search({ workspaceId: workspaceAlpha, text: 'coffee' });

    expect(results.map((result) => result.ref.entityId)).toEqual([
      'transaction_synthetic_title_match',
      'transaction_synthetic_excerpt_match',
    ]);
    expect(results[0]).toMatchObject({
      rank: 1,
      ranking: {
        matchedTokens: ['coffee'],
        fieldMatches: ['title'],
      },
    });
    expect(results[0]?.highlights[0]).toMatchObject({
      field: 'title',
      ranges: [{ term: 'coffee' }],
    });
  });
});

describe('deterministic natural-language parsing', () => {
  it('translates common phrases into an editable typed query object', () => {
    const parsed = parseNaturalLanguageSearchQuery(
      [
        'grocer',
        'merchant:"Synthetic Grocer One"',
        'ref:SYN-REF-001',
        'category:category_synthetic_meals',
        'account:account_synthetic_current',
        'type:transaction',
        'from 2026-04-01 to 2026-04-30',
        'over GBP 40',
        'include archived',
        'include private',
      ].join(' '),
      { workspaceId: workspaceAlpha, defaultCurrency: 'GBP' },
    );

    expect(parsed.editable).toBe(true);
    expect(parsed.remainingText).toBe('grocer');
    expect(parsed.query).toMatchObject({
      workspaceId: workspaceAlpha,
      text: 'grocer',
      archive: 'all',
      privacy: 'include_private',
      filters: {
        merchant: 'Synthetic Grocer One',
        reference: 'SYN-REF-001',
        dateRange: { from: '2026-04-01', to: '2026-04-30' },
        amount: { minMinorUnits: 4000, currency: 'GBP', useAbsolute: true },
        categoryIds: ['category_synthetic_meals'],
        accountIds: ['account_synthetic_current'],
        entityTypes: ['transaction'],
      },
    });

    const index = new LocalSearchIndex(rebuildSearchIndex(alphaRecords));
    expect(index.search(parsed.query)[0]?.ref.entityId).toBe('transaction_synthetic_grocery');
  });

  it('anchors relative dates only when an explicit today value is supplied', () => {
    const anchored = parseNaturalLanguageSearchQuery('tax this month event:tax_deadline', {
      workspaceId: workspaceAlpha,
      today: '2026-04-15',
    });
    const unanchored = parseNaturalLanguageSearchQuery('tax this month event:tax_deadline', {
      workspaceId: workspaceAlpha,
    });

    expect(anchored.query.filters).toMatchObject({
      dateRange: { from: '2026-04-01', to: '2026-04-30' },
      eventTypes: ['tax_deadline'],
    });
    expect(anchored.remainingText).toBe('tax');
    expect(unanchored.notes).toEqual(['relative_date_requires_today']);
    expect(unanchored.remainingText).toBe('tax this month');
  });
});

describe('rebuildable source-reference records', () => {
  it('stores references and derived index metadata instead of source payloads', () => {
    const record = buildSearchIndexRecord({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'transaction',
        entityId: 'transaction_synthetic_reference_only',
        sourceHash: 'hash_synthetic_source',
      },
      title: 'Synthetic reference-only transaction',
      excerpt: 'Labelled derived excerpt',
    });

    expect(record.ref).toEqual({
      workspaceId: workspaceAlpha,
      entityType: 'transaction',
      entityId: 'transaction_synthetic_reference_only',
      sourceHash: 'hash_synthetic_source',
    });
    expect(record.sourceFingerprint).toMatch(/^fingerprint_/);
    expect(Object.keys(record)).not.toContain('source');
    expect(Object.keys(record)).not.toContain('sourcePayload');
  });

  it('upserts by source reference and rebuilds one workspace without crossing into another', () => {
    const index = new LocalSearchIndex();
    index.upsert({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'transaction',
        entityId: 'transaction_synthetic_rebuild',
      },
      title: 'Synthetic old title',
    });
    index.upsert({
      ref: {
        workspaceId: workspaceAlpha,
        entityType: 'transaction',
        entityId: 'transaction_synthetic_rebuild',
      },
      title: 'Synthetic new title',
    });
    index.upsert({
      ref: {
        workspaceId: workspaceBeta,
        entityType: 'transaction',
        entityId: 'transaction_synthetic_beta_kept',
      },
      title: 'Synthetic beta kept',
    });

    expect(index.snapshot(workspaceAlpha)).toHaveLength(1);
    expect(index.search({ workspaceId: workspaceAlpha, text: 'old' })).toHaveLength(0);
    expect(index.search({ workspaceId: workspaceAlpha, text: 'new' })).toHaveLength(1);

    const rebuild = index.rebuildWorkspace(workspaceAlpha, [
      {
        ref: {
          workspaceId: workspaceAlpha,
          entityType: 'document',
          entityId: 'document_synthetic_rebuilt',
        },
        title: 'Synthetic rebuilt document',
      },
    ]);

    expect(rebuild).toMatchObject({ workspaceId: workspaceAlpha, removed: 1, upserted: 1 });
    expect(index.search({ workspaceId: workspaceAlpha, text: 'new' })).toHaveLength(0);
    expect(index.search({ workspaceId: workspaceAlpha, text: 'rebuilt' })).toHaveLength(1);
    expect(index.search({ workspaceId: workspaceBeta, text: 'kept' })).toHaveLength(1);
  });
});

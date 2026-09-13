import { describe, expect, it } from 'vitest';

import { buildScaleFixture } from './scaleFixture.testSupport';
import {
  buildStatementReviewModel,
  filterStatementReviewRows,
  statementReviewSessionMatchesSource,
  statementReviewNaturalKey,
} from './statementReviewModel';

describe('statementReviewModel', () => {
  it('keeps every row inspectable while separating only honest issues from ready rows', () => {
    const fixture = buildScaleFixture(10_001);
    const model = buildStatementReviewModel(fixture.candidates);

    expect(model.rows).toHaveLength(10_001);
    expect(model.counts.total).toBe(10_001);
    expect(model.counts.ready + model.counts.issues).toBe(10_001);
    expect(filterStatementReviewRows(model.rows, 'all', '', new Set())).toHaveLength(10_001);
    expect(filterStatementReviewRows(model.rows, 'issues', '', new Set())).toHaveLength(
      model.counts.issues,
    );
    expect(model.rows.find((row) => row.candidate.confidence === 'low')?.status).toBe('issue');
  });

  it('marks exact natural-key collisions as possible duplicates without inventing fuzzy confidence', () => {
    const fixture = buildScaleFixture(2);
    const original = fixture.candidates[0]!;
    const copy = { ...original, id: 'copy-id', confidence: 'high' as const };
    const model = buildStatementReviewModel([original, copy, fixture.candidates[1]!]);

    expect(statementReviewNaturalKey(original)).toBe(statementReviewNaturalKey(copy));
    expect(model.counts.duplicates).toBe(2);
    expect(model.rows.slice(0, 2).every((row) => row.issue === 'possible-duplicate')).toBe(true);
  });

  it('keeps already-added and resolved repeats out of the ready and needs-checking counts', () => {
    const fixture = buildScaleFixture(2);
    const first = fixture.candidates[1]!;
    const repeat = { ...first, id: 'repeat-id' };
    const model = buildStatementReviewModel([first, repeat], {
      alreadyAddedIds: new Set([first.id]),
      resolvedDuplicateIds: new Set([repeat.id]),
    });

    expect(model.rows[0]?.status).toBe('already-added');
    expect(model.rows[1]?.status).toBe('ready');
    expect(model.counts.alreadyAdded).toBe(1);
    expect(model.counts.duplicates).toBe(0);
    expect(model.counts.ready).toBe(1);
    expect(model.counts.issues).toBe(0);
  });

  it('surfaces missing and invalid required fields before a candidate can be selected', () => {
    const base = buildScaleFixture(1).candidates[0]!;
    const missingDate = { ...base, id: 'missing-date' };
    delete (missingDate as { date?: string }).date;
    const model = buildStatementReviewModel([
      { ...base, id: 'missing-name', merchant: ' ' },
      { ...base, id: 'zero-amount', amount: 0 },
      missingDate,
      { ...base, id: 'invalid-date', date: '2026-02-30' },
    ]);

    expect(model.rows.map((row) => row.issue)).toEqual([
      'missing-name',
      'invalid-amount',
      'missing-date',
      'invalid-date',
    ]);
    expect(model.rows.every((row) => row.status === 'issue')).toBe(true);
    expect(model.counts.ready).toBe(0);
    expect(model.counts.issues).toBe(4);
  });

  it('keeps low-confidence rows blocked until an explicit valid review saves them', () => {
    const candidate = { ...buildScaleFixture(1).candidates[0]!, confidence: 'low' as const };
    expect(buildStatementReviewModel([candidate]).rows[0]?.status).toBe('issue');
    expect(buildStatementReviewModel([{ ...candidate, reviewed: true }]).rows[0]?.status).toBe(
      'ready',
    );
    expect(
      filterStatementReviewRows(
        buildStatementReviewModel([candidate]).rows,
        'issues',
        'Needs checking',
        new Set(),
      ),
    ).toHaveLength(1);
  });

  it('only resumes a persisted review for its source, while allowing an explicit cold resume', () => {
    const candidate = buildScaleFixture(1).candidates[0]!;
    const other = { ...candidate, id: 'other-source-row', source: 'paste' as const };
    const session = { sourceKey: `${candidate.source}:${candidate.id}` };
    expect(statementReviewSessionMatchesSource(session, [candidate])).toBe(true);
    expect(statementReviewSessionMatchesSource(session, [other])).toBe(false);
    expect(statementReviewSessionMatchesSource(session, [])).toBe(true);
    expect(statementReviewSessionMatchesSource({ ...session, workspaceId: 'personal' }, [], 'business')).toBe(false);
    expect(statementReviewSessionMatchesSource({ ...session, workspaceId: 'personal' }, [], 'personal')).toBe(true);
  });

  it('projects and filters the full 10k+ corpus within a conservative CI budget', () => {
    const fixture = buildScaleFixture(10_001);
    const startedAt = performance.now();
    const model = buildStatementReviewModel(fixture.candidates);
    const matches = filterStatementReviewRows(model.rows, 'all', 'merchant 42', new Set());
    const elapsedMs = performance.now() - startedAt;

    expect(matches.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(1_500);
  });
});

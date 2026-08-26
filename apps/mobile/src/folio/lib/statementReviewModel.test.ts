import { describe, expect, it } from 'vitest';

import { buildScaleFixture } from './scaleFixture.testSupport';
import {
  buildStatementReviewModel,
  filterStatementReviewRows,
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

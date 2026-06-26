import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  editImportDraft,
  stageStatementImport,
} from '../local/localLedger.js';
import { buildLocalTodayModel } from '../local/localTodayAdapter.js';

// Gap #7 — core-slice gap-closure coverage. Realigns and extends the product UX guards after the
// route-detail / review / route-SVG rework. Source is final; these assert the new reality.
//
// Mix of two kinds of assertions:
//   - Source pins (a–d, f, g, h): the wiring is structural, not observable from a pure function, so
//     we assert it on the source text the same way the sibling rebuild guards do.
//   - Behavioural (e, j): exercised through the canonical ledger mutations so the test survives a
//     refactor of the surface as long as the meaning is preserved.

const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');

const reviewSource = sourceBetween(
  mobileShellSource,
  'function ImportReviewScreen',
  'function MeloScreen',
);
const routeSource = sourceBetween(
  mobileShellSource,
  'function BreathingHorizon',
  'function TimelineList',
);
const routePanelSource = routeSource.slice(routeSource.indexOf('styles.routePointPanel'));

describe('core-slice gap closure (#7)', () => {
  // (a) A live waiting row can be shown in Review through a real import, with no dev wording.
  it('stages a real sample statement in Review without developer wording', () => {
    // The sample is a real CSV staged through the same import path as a pasted statement.
    expect(mobileShellSource).toContain('const SAMPLE_STATEMENT_CSV');
    expect(reviewSource).toContain('onStageImport(SAMPLE_STATEMENT_CSV)');
    expect(reviewSource).toContain('Try it with a sample statement');

    // The trigger and its surrounding panel copy must read as normal product UI — no dogfood,
    // internal, test-mode or seed vocabulary leaking through.
    const triggerStart = reviewSource.indexOf('onStageImport(SAMPLE_STATEMENT_CSV)');
    expect(triggerStart).toBeGreaterThanOrEqual(0);
    const triggerPanel = reviewSource.slice(
      reviewSource.lastIndexOf('styles.importPastePanel', triggerStart),
      triggerStart + 600,
    );
    for (const banned of [/\bdogfood\b/iu, /\binternal\b/iu, /test mode/iu, /\bseed\b/iu]) {
      expect(triggerPanel).not.toMatch(banned);
    }
  });

  // (b) The review primary action is row-specific and always active (the confirm handler promotes a
  // reviewed row to ready, then accepts it) — it is not disabled by review state.
  it('renders a per-row ReviewDecisionCard whose primary Add is never gated', () => {
    expect(reviewSource).toContain('visibleDrafts.map((row)');
    expect(reviewSource).toContain('<ReviewDecisionCard');
    expect(reviewSource).toContain('onAdd={() => onConfirmDraft(row.rowId)}');
    expect(reviewSource).toContain('onEdit={() => startEditing(row)}');
    expect(reviewSource).toContain("onIgnore={() => onDismissDraft(row.rowId, 'other')}");
    expect(reviewSource).toContain('onMore={() => setSelectedReviewDraftId(row.rowId)}');
    // rowReady still drives the visible badge state, but no disabled gate exists on the card.
    expect(reviewSource).toContain("state={rowReady ? 'ready' : 'waiting'}");
    expect(reviewSource).not.toContain('addDisabled');
    expect(reviewSource).toContain('label="Add to my money"');
  });

  // (c) Secondary actions hide behind "More"; the card itself shows only Add / Edit / Ignore / More.
  it('hides the secondary row actions behind the More sheet', () => {
    // The sheet opens for one row and resets to the primary action.
    expect(reviewSource).toContain('setSelectedReviewDraftId(row.rowId)');
    expect(reviewSource).toContain('setShowMoreRowActions(false)');
    expect(reviewSource).toContain('title="More"');

    // Only the primary action lives in the dedicated primary container.
    const primary = sourceBetween(reviewSource, 'styles.reviewPrimaryActions', 'FolioRevealRow');
    expect(primary).toContain('label="Add to my money"');
    for (const buried of ['Edit', 'Ignore', 'Duplicate', 'Transfer', 'Refund', 'Income', 'Later']) {
      expect(primary).not.toContain(`label="${buried}"`);
    }

    // The rest only render once "More" is expanded.
    const moreActions = reviewSource.slice(reviewSource.indexOf('showMoreRowActions ?'));
    for (const buried of [
      'label="Edit"',
      'label="Ignore"',
      'label="Duplicate"',
      'label="Transfer"',
      'label="Refund"',
      'label="Income"',
      'label="Bill"',
      'label="Debt payment"',
      'label="Later"',
    ]) {
      expect(moreActions).toContain(buried);
    }
  });

  // (d) The route SVG covers income / bill / debt / buffer / lowest-point concepts.
  it('plots income, outflow, buffer and lowest-point concepts in the route SVG', () => {
    // Lowest point: marked node with an inline value and a drop line.
    expect(routeSource).toContain('const tightestNode');
    expect(routeSource).toContain('tightestNode !== undefined');
    expect(routeSource).toContain('tightestNode.point.balanceMinor');

    // Buffer line for bills set aside.
    expect(routeSource).toContain('bufferLineY');
    expect(routeSource).toContain('Set aside for bills');

    // Income / outflow nodes and the protected buffer feed the chart.
    expect(routeSource).toContain('nextIncomePoint');
    expect(routeSource).toContain('nextOutflowPoint');
    expect(routeSource).toContain('protectedBufferMinor');

    // Directional glyph branch: ▲ for money in (delta > 0), ▼ for money out (delta < 0).
    expect(routeSource).toMatch(/delta > 0 \?[\s\S]*▲[\s\S]*▼/u);
  });

  // (e) An incomplete route does not fake meaning. Behaviourally: a route built from income alone
  // has no outflow point, which is exactly the condition the surface uses to show the
  // "just add one or two things" panel instead of a verdict.
  it('does not fabricate a verdict for an income-only route', () => {
    // The surface guard: incomplete when there is no income point OR no outflow point.
    expect(routeSource).toContain(
      'nextIncomePoint === undefined || nextOutflowPoint === undefined',
    );
    expect(routeSource).toContain('Add your next pay');
    expect(routeSource).toContain('Just one or two things to add.');

    // Build a real income-only route through the canonical mutations.
    const empty = { ...createEmptyLocalLedgerState('2026-06-24'), cashOnHandMinor: 10_000 };
    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-27,Salary,1200.00',
    ).state;
    const draft = staged.importDrafts[0];
    expect(draft).toBeDefined();
    const edited = editImportDraft(staged, draft?.rowId ?? '', {
      amountText: '1200.00',
      date: '2026-06-27',
      interpretation: 'Income: Salary',
    });
    const accepted = confirmImportDraft(edited, draft?.rowId ?? '');
    const route = buildLocalRouteSummary(accepted);

    // There is an income point but no outflow point — the verdict-blocking condition holds.
    const hasIncomePoint = route.points.some((point) => point.deltaMinor > 0);
    const hasOutflowPoint = route.points.some((point) => point.deltaMinor < 0);
    expect(hasIncomePoint).toBe(true);
    expect(hasOutflowPoint).toBe(false);
  });

  // (f) The route detail panel uses human stacked sections and drops per-line "Show why".
  it('uses human RoutePointSection rows in the route detail panel', () => {
    for (const heading of [
      'What happened',
      'What caused it',
      'Left after this',
      'Still waiting for review',
    ]) {
      expect(routePanelSource).toContain(heading);
    }
    expect(routePanelSource).toContain('RoutePointSection');
    // No per-line "Show why" affordance inside the panel.
    expect(routePanelSource).not.toMatch(/label="Show why"|>Show why</u);
  });

  // (g) Old / dead UI paths are not reachable from the shell.
  it('no longer references the removed surfaces or gated add action', () => {
    expect(mobileShellSource).not.toContain('TodayCalmAnswerSurface');
    expect(mobileShellSource).not.toContain('DataControlOwnershipSurface');
    expect(mobileShellSource).not.toContain('RoutePointAnswer');
    expect(mobileShellSource).not.toContain('addDisabled={!rowReady}');
  });

  // (j) Review-before-truth holds through the canonical path: a staged (unreviewed) row does not
  // change Today; promoting it to ready (edit) and confirming it does. Confirm requires ready, so
  // the row is promoted via editImportDraft first — the canonical mutation path.
  it('keeps unreviewed rows out of Today and lets an added row in', () => {
    const empty = { ...createEmptyLocalLedgerState('2026-06-24'), cashOnHandMinor: 30_000 };
    const before = buildLocalTodayModel(empty, buildLocalRouteSummary(empty));

    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-25,Council tax,-150.00',
    ).state;
    const stagedToday = buildLocalTodayModel(staged, buildLocalRouteSummary(staged));

    // Staged but unreviewed: Today is unchanged and nothing is posted.
    expect(staged.transactions).toEqual([]);
    expect(stagedToday.position.availableMinor).toBe(before.position.availableMinor);

    const draft = staged.importDrafts[0];
    expect(draft).toBeDefined();
    const promoted = editImportDraft(staged, draft?.rowId ?? '', {
      amountText: '-150.00',
      date: '2026-06-25',
      interpretation: 'Bill: Council tax',
    });
    const added = confirmImportDraft(promoted, draft?.rowId ?? '');
    const addedToday = buildLocalTodayModel(added, buildLocalRouteSummary(added));

    // Added: exactly one posted fact, and Today's available position drops.
    expect(added.transactions).toHaveLength(1);
    expect(addedToday.position.availableMinor).toBeLessThan(before.position.availableMinor);
  });
});

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find source range from ${start} to ${end}`);
  }

  return source.slice(startIndex, endIndex);
}

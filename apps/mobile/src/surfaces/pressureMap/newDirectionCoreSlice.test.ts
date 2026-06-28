import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  editImportDraft,
  stageStatementImport,
  type LocalLedgerState,
} from '../../local/localLedger.js';
import { buildLocalTodayModel } from '../../local/localTodayAdapter.js';
import { routeHasMeaningfulPath } from './routeMath.js';

// Mirror exactly what the Review screen's "Add to my money" does: a draft is promoted
// to ready (edit) and only then accepted (confirm). This is the review-before-truth gate.
function addAllWaitingRows(state: LocalLedgerState): LocalLedgerState {
  return state.importDrafts.reduce((acc, draft) => {
    const promoted = editImportDraft(acc, draft.rowId, {
      amountText: (draft.amountMinor / 100).toFixed(2),
      date: draft.date,
      interpretation: draft.interpretation,
    });
    return confirmImportDraft(promoted, draft.rowId);
  }, state);
}

// New-direction core-slice guards.
//
// Two kinds of assertion:
//   - Behavioural (engine): the review-before-truth + meaningful-path rules are exercised through
//     the canonical ledger, so they survive any surface refactor.
//   - Source pins: the user-facing wiring/copy of the new surface is structural and is asserted on
//     the source text the same way the sibling rebuild guards do. The real visual proof is the
//     installed-APK screenshots; these stop the new direction from silently regressing.

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

// Strip comments so banned-vocab scans only see real (rendered/identifier) code, never prose.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function sourceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? source.length : to);
}

const kit = read('./kit.tsx');
const start = read('./startScreen.tsx');
const rough = read('./roughFirstAnswer.tsx');
const review = read('./reviewDecision.tsx');
const moneyPath = read('./MoneyPath.tsx');
const today = read('./todayPath.tsx');
const trust = read('./trustControl.tsx');
const container = read('../../../app/index.tsx');

describe('new direction — core slice uses the new surface path', () => {
  it('container renders the core-slice screens from the pressure-map surface', () => {
    const importBlock = sourceBetween(container, "from '../src/surfaces/pressureMap'", ';');
    // The named imports appear just above the module specifier.
    const wiring = sourceBetween(container, 'pressureMap', "from '../src/surfaces/pressureMap'");
    expect(container).toContain("from '../src/surfaces/pressureMap'");
    for (const name of [
      'StartScreen',
      'TodayScreen',
      'ImportReviewScreen',
      'DataControlScreen',
      'QuickEstimateScreen',
      'BottomNav',
    ]) {
      expect(`${wiring}${importBlock}`).toContain(name);
    }
  });

  it('opens on the real question, not a dashboard', () => {
    expect(container).toContain("useState<Screen>('today')");
  });
});

describe('new direction — Pressure Moment (Start)', () => {
  it('has exactly one dominant action', () => {
    const matches = start.match(/<PrimaryAction/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(start).toContain('See where you stand');
  });

  it('keeps one dominant action above the accepted 2x2 quick-action grid', () => {
    // The accepted Lovable Start ends with a 2x2 grid of four subordinate quick-actions, below the
    // single dominant CTA. They are tiles, not equal-weight with the hero button.
    for (const tile of ['Add a statement', 'Try fake data', 'Check bills', 'Meet Melo']) {
      expect(start).toContain(tile);
    }
    // Start leads with the editorial serif Headline carrying one upright accent word.
    expect(start).toContain('Headline');
    // Lovable source: "Will your money <last> to payday?" — accent word is "last".
    expect(start).toContain('accent="last"');
    // Privacy entry point lives in the header, matching the accepted Start.
    expect(start).toContain('onOpenPrivacy');
  });
});

describe('new direction — Rough First Answer (one question at a time)', () => {
  it('gates the flow one topic per step', () => {
    expect(rough).toContain('step === 0');
    expect(rough).toContain('step === 1');
    expect(rough).toContain('step === 2');
    // A single amount surface per step (no form stack).
    expect((rough.match(/<MoneyPad/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(rough).toContain('What money can you see today?');
    expect(rough).toContain('Skip for now');
  });

  it('writes through the canonical quick estimate, not a bespoke path', () => {
    expect(rough).toContain('onSaveEstimate');
    expect(rough).toContain('QuickEstimateInput');
  });
});

describe('new direction — one-row Truth Decision (Review)', () => {
  const card = sourceBetween(review, 'const out = current.amountMinor', 'function MoreOption');

  it('the row owns its actions and Add comes before More', () => {
    expect(card).toContain('onConfirmDraft(current.rowId)');
    expect(card).toContain('onDismissDraft(current.rowId');
    expect(card).toContain('setEditing(current)');
    expect(card.indexOf('Add to my money')).toBeLessThan(card.indexOf("'More'"));
  });

  it('uses human copy, never parser/category/spreadsheet wording', () => {
    expect(review).toContain('Is this your {current.interpretation}?');
    expect(review).toContain('From your statement');
    const stripped = stripComments(review).toLowerCase();
    expect(stripped).not.toContain('spreadsheet');
    expect(stripped).not.toContain('formula text');
    expect(stripped).not.toContain('category still needs');
  });
});

describe('new direction — Signature Money Path + Point Explanation', () => {
  it('an empty / eventless route never fakes a path', () => {
    const empty = createEmptyLocalLedgerState('2026-06-24');
    expect(routeHasMeaningfulPath(buildLocalRouteSummary(empty))).toBe(false);
    expect(moneyPath).toContain('RouteEmpty');
    expect(moneyPath).toContain('fills in as you add money');
  });

  it('a real route with movement is drawn', () => {
    const empty = createEmptyLocalLedgerState('2026-06-24');
    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-25,Salary,1200.00\n2026-06-26,Rent,-800.00',
    ).state;
    const confirmed = addAllWaitingRows(staged);
    expect(routeHasMeaningfulPath(buildLocalRouteSummary(confirmed))).toBe(true);
  });

  it('route detail explains in human language, no engine vocab', () => {
    const detail = sourceBetween(moneyPath, 'function causeLine', 'const styles =');
    expect(detail).toContain('Left after this');
    expect(detail).toContain('Still waiting');
    const stripped = stripComments(detail).toLowerCase();
    for (const banned of ['ledger', 'provenance', 'canonical', 'authority', 'known']) {
      expect(stripped).not.toContain(banned);
    }
  });
});

describe('new direction — Trust / Control (Data & privacy)', () => {
  it('reads as trust, not session/admin status', () => {
    expect(trust).toContain('It stays on this device.');
    expect(trust).toContain('Export my data');
    expect(trust).toContain('Start fresh');
    const stripped = stripComments(trust).toLowerCase();
    // 'persistenceStatus' is an accepted prop name in the contract, never rendered — so we
    // scan for the actual admin phrases, not that substring.
    for (const banned of [
      'session',
      'no export file prepared',
      'quick estimate saved locally',
      'route rebuilt',
      'database',
    ]) {
      expect(stripped).not.toContain(banned);
    }
  });
});

describe('new direction — no advice, shame or fake certainty', () => {
  it('the verdict never advises or shames, and stays honest when the path is not real', () => {
    const stripped = stripComments(today).toLowerCase();
    for (const banned of [
      'you should',
      'you must',
      'cut back',
      'overspend',
      'stop spending',
      'irresponsible',
      'too much',
    ]) {
      expect(stripped).not.toContain(banned);
    }
    // When there is no real path, it states position without a yes/no claim — the empty-state
    // Editorial Ledger Headline reads "Here's where you stand", with the accent word italicised.
    expect(today).toContain("Here's where you ");
    expect(today).toContain('accent="stand"');
    expect(today).toContain('routeHasMeaningfulPath');
  });
});

describe('new direction — review-before-truth (behavioural)', () => {
  it('unreviewed rows do not change Today; added rows do', () => {
    const empty = createEmptyLocalLedgerState('2026-06-24');
    const before = buildLocalRouteSummary(empty);
    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-25,Salary,1200.00\n2026-06-26,Tesco,-42.00',
    ).state;
    const stagedRoute = buildLocalRouteSummary(staged);
    const stagedToday = buildLocalTodayModel(staged, stagedRoute);

    // Staged but unreviewed: Today is unchanged and rows wait.
    expect(stagedRoute.availableNowMinor).toBe(before.availableNowMinor);
    expect(stagedRoute.confirmedTransactionCount).toBe(0);
    expect(stagedRoute.pendingReviewCount).toBe(staged.importDrafts.length);
    expect(stagedToday.reviewCopy).toContain('waiting for review');

    // After adding the rows, Today reflects them.
    const confirmed = addAllWaitingRows(staged);
    const confirmedRoute = buildLocalRouteSummary(confirmed);
    expect(confirmedRoute.confirmedTransactionCount).toBeGreaterThan(0);
    expect(confirmedRoute.pendingReviewCount).toBe(0);
  });
});

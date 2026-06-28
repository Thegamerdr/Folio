// Lovable visual-target implementation guards.
//
// The accepted "Quiet Paper Luxury" Lovable mock is the visual source of truth. These guards lock
// the rules that are easy to silently regress when the surface is re-skinned:
//   1. Visible copy carries none of the banned machinery vocabulary (the brief's list).
//   2. Melo is a presence, never a mutator — it cannot add, ignore, classify, or move Today.
//   3. Review is a one-row decision: Add stays dominant, the secondary actions hide behind More,
//      and the "it's actually…" relabels (refund / income / bill / debt) go through the edit path.
//   4. Money-in reads green (you make it), action reads terracotta.
//   5. Behavioural: a brought-in source never moves Today on its own; only an added item does.
//
// The real visual proof is the installed-APK screenshots in evidence/. These stop the new
// direction from regressing the moment a future edit reaches for the old vocabulary or colour.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  editImportDraft,
  stageStatementImport,
} from '../../local/localLedger.js';

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// Extract the strings a user actually reads. A "visible" string is a quoted literal that reads as
// prose — it contains a space and is not an identifier, key, path, or media type (those carry '_'
// or '/'). This deliberately skips contract identifiers like `extractionStatus`,
// `untrusted_parser_input`, `melo_file_unreadable`, and `text/csv`, so the banned-vocab scan only
// ever sees rendered words — never engine plumbing.
function visibleStrings(source: string): string {
  const body = stripComments(source);
  const out: string[] = [];
  const quoted = /(["'])((?:\\.|(?!\1).)*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = quoted.exec(body)) !== null) {
    const value = m[2] ?? '';
    if (!value.includes(' ')) continue; // single tokens are labels/keys, not prose
    if (value.includes('_') || value.includes('/')) continue; // identifiers, keys, paths, mime
    out.push(value);
  }
  // JSX text nodes (Headline/Display/Body children rendered between tags), expression-free only.
  const jsxText = />\s*([A-Za-z][^<>{}]*?[A-Za-z.?])\s*</g;
  while ((m = jsxText.exec(body)) !== null) {
    out.push(m[1] ?? '');
  }
  return out.join('\n').toLowerCase();
}

const SURFACE_FILES = [
  'kit.tsx',
  'startScreen.tsx',
  'roughFirstAnswer.tsx',
  'reviewDecision.tsx',
  'foundItems.tsx',
  'fileWorkbench.tsx',
  'MoneyPath.tsx',
  'todayPath.tsx',
  'trustControl.tsx',
  'melo/MeloPresence.tsx',
  'melo/meloStates.ts',
  // Converted secondary surfaces (2026-06-27 whole-app pass) — these are now user-facing screens,
  // so the banned-visible-vocabulary guard must cover them too.
  'moreHub.tsx',
  'timeline.tsx',
  'plans.tsx',
  'secondaryKit.tsx',
  'calendarMonth.tsx',
  'meloCompanion.tsx',
] as const;

// The brief's banned visible vocabulary. Phrases are matched as substrings against the visible
// corpus only — multi-word phrases (e.g. "import review", "local ledger") cannot collide with the
// camelCase identifiers (ImportReviewScreen, localLedger) that are legitimately in the source.
const BANNED_VISIBLE = [
  'parser',
  'extraction',
  ' ocr', // word-ish; avoids matching inside larger benign words
  'provenance',
  'import review',
  'source record',
  'local ledger',
  'canonical',
  'indexed',
  'confidence score',
  'object count',
  'diagnostic',
  'financial reality',
  'make real',
  'spreadsheet',
] as const;

describe('Lovable target — visible copy carries no machinery vocabulary', () => {
  for (const file of SURFACE_FILES) {
    it(`${file} renders no banned jargon`, () => {
      const corpus = visibleStrings(read(`./${file}`));
      for (const banned of BANNED_VISIBLE) {
        expect(corpus.includes(banned.trim())).toBe(false);
      }
    });
  }

  it('the words people read are the accepted ones', () => {
    const review = read('./reviewDecision.tsx');
    const trust = read('./trustControl.tsx');
    const workbench = read('./fileWorkbench.tsx');
    expect(review).toContain('Add to my money');
    expect(review).toContain('Is this your {current.interpretation}?');
    expect(trust).toContain('It stays on this device.');
    expect(trust).toContain('Things you ignore stay separate.');
    expect(workbench).toContain('File saved. It has not changed your money picture.');
  });
});

describe('Lovable target — Melo is a presence, never a mutator', () => {
  const presence = read('./melo/MeloPresence.tsx');
  const states = read('./melo/meloStates.ts');

  it('MeloPresence exposes no callback that could write state', () => {
    // No add / ignore / classify / save / move-Today affordance reaches Melo. The shape of the
    // props enforces it — there is simply nothing here that mutates the ledger.
    for (const writer of [
      'onConfirm',
      'onAdd',
      'onSave',
      'onDismiss',
      'onApply',
      'onChange',
      'setLedger',
      'commitLocalLedger',
    ]) {
      expect(presence).not.toContain(writer);
    }
  });

  it('Melo copy gives no advice and claims no certainty', () => {
    const stripped = stripComments(states).toLowerCase();
    for (const banned of ['you should', 'you must', 'cut back', 'definitely', 'guaranteed']) {
      expect(stripped).not.toContain(banned);
    }
  });
});

describe('Lovable target — Review is a one-row decision', () => {
  const review = read('./reviewDecision.tsx');

  it('the secondary actions hide until More is opened', () => {
    // The whole secondary grid is gated behind the showMore state, and the dominant Add sits
    // outside that gate so it is always live.
    expect(review).toContain('setShowMore((v) => !v)');
    expect(review).toContain('{showMore ? (');
    const moreBlock = review.slice(review.indexOf('{showMore ? ('));
    // The dominant action must NOT live inside the More block.
    expect(moreBlock).not.toContain('Add to my money');
    // The dominant Add appears before the More toggle button in source order (and on screen).
    expect(review.indexOf('Add to my money')).toBeLessThan(
      review.indexOf('setShowMore((v) => !v)'),
    );
  });

  it('offers the accepted relabels and routes them through the edit path', () => {
    for (const label of ['A refund', 'Income', 'A bill', 'A debt payment']) {
      expect(review).toContain(label);
    }
    // Relabelling re-uses the canonical draft edit — it never invents a side path.
    expect(review).toContain('onApplyDraftEdit(draft.rowId');
  });

  it('money-in reads green (you make it), money-out reads ink', () => {
    expect(review).toContain('amountIn: { color: paper.positiveInk }');
    expect(review).toContain('amountOut: { color: paper.ink }');
  });
});

describe('Lovable target — colour semantics split action from "you make it"', () => {
  const kit = read('./kit.tsx');
  const path = read('./MoneyPath.tsx');

  it('the accent is terracotta and the positive verdict is green', () => {
    expect(kit).toContain("calm: '#E0633A'"); // terracotta action accent
    expect(kit).toContain("positive: '#3E8E5A'"); // calm green verdict
    expect(kit).toContain("positiveInk: '#2F7048'");
  });

  it('the holding path is green and the tight point is terracotta', () => {
    // lineTone "holds" → green; the lowest (tight) point → terracotta accent when it holds.
    expect(path).toContain(': paper.positive');
    expect(path).toContain('node.point.balanceMinor < 0 ? paper.repair : paper.calm');
  });
});

describe('Lovable target — a brought-in source never moves Today on its own', () => {
  it('a staged statement waits; only an added row changes the picture', () => {
    const empty = createEmptyLocalLedgerState('2026-06-24');
    const before = buildLocalRouteSummary(empty);

    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-25,Salary,1200.00\n2026-06-26,Tesco,-42.00',
    ).state;
    const stagedRoute = buildLocalRouteSummary(staged);

    // The source is in, but nothing counts: Today is unchanged and every row waits.
    expect(stagedRoute.availableNowMinor).toBe(before.availableNowMinor);
    expect(stagedRoute.confirmedTransactionCount).toBe(0);
    expect(stagedRoute.pendingReviewCount).toBe(staged.importDrafts.length);

    // Add exactly one row the way the Review card does (promote-then-confirm). Now Today moves.
    const first = staged.importDrafts[0]!;
    const added = confirmImportDraft(
      editImportDraft(staged, first.rowId, {
        amountText: (first.amountMinor / 100).toFixed(2),
        date: first.date,
        interpretation: first.interpretation,
      }),
      first.rowId,
    );
    const addedRoute = buildLocalRouteSummary(added);
    expect(addedRoute.confirmedTransactionCount).toBe(1);
    expect(addedRoute.pendingReviewCount).toBe(staged.importDrafts.length - 1);
  });
});

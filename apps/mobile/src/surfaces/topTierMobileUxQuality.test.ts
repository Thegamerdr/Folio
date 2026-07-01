import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  addPlannedCommitment,
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  editImportDraft,
  stageStatementImport,
} from '../local/localLedger.js';
import { buildLocalTodayModel } from '../local/localTodayAdapter.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url).href);
const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
// The pressure-map app was moved from app/index.tsx to app/home.tsx (reachable at /home) when the
// live route was flipped to the FolioShell; this guard follows that (unchanged) surface to home.tsx.
const appRoutePath = fileURLToPath(new URL('../../app/home.tsx', import.meta.url).href);
const standardPath = fileURLToPath(
  new URL('../local/productExperienceStandard.ts', import.meta.url).href,
);

const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const standardSource = readFileSync(standardPath, 'utf8');
const startSource = sourceBetween(
  mobileShellSource,
  'function StartScreen',
  'function LensChoiceButton',
);
const guidedSource = sourceBetween(
  mobileShellSource,
  'function QuickEstimateScreen',
  'function DebtGuidedScreen',
);
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
// Extract visible quoted copy from each file independently, then join. Extracting from a raw
// concatenation lets the quote-pairing regex span a file boundary and capture code comments
// (e.g. an app/index.tsx comment containing "canonical") as if they were visible copy — a false
// positive. Per-file extraction scans 100% of every file's visible strings while keeping each
// file's quotes balanced within itself.
const visibleCopy = `${quotedVisibleCopy(mobileShellSource)}\n${quotedVisibleCopy(
  appRouteSource,
)}\n${quotedVisibleCopy(standardSource)}`;

describe('top-tier mobile UX quality gate', () => {
  it('keeps the rejection audit artifact in the repo', () => {
    const auditPath = `${root}TOP_TIER_UX_REJECTION_AUDIT.md`;
    expect(existsSync(auditPath)).toBe(true);
    const audit = readFileSync(auditPath, 'utf8');
    expect(audit).toMatch(/\|\s*Start\s*\|\s*Fail\s*\|/u);
    expect(audit).toMatch(/\|\s*Breathing-room route\s*\|\s*Fail\s*\|/u);
    expect(audit).toContain(
      'Would the owner still want to uninstall after 10 minutes? Risk remains.',
    );
  });

  it('turns Start into a first-win screen with one dominant action', () => {
    expect(startSource).toContain('Will your money last to payday?');
    expect(startSource).toContain('See where you stand');
    expect(startSource).toContain("Nothing's saved until you say so. Have a look first.");
    expect(startSource).toContain('PrimaryDecisionCard');
    expect(startSource).toContain('QuietPathRow');
    expect(startSource).toContain('startJobButtonPrimary');
    expect(startSource).toContain('startJobButtonSecondary');
    expect(startSource).toContain('Have a look with example numbers first');
    expect(appRouteSource).toContain('onOpenSampleBriefing={openSampleBriefing}');
  });

  it('keeps guided input to one active mobile step with comfortable controls', () => {
    expect(guidedSource).toContain('const [activeStep, setActiveStep] = useState(0)');
    expect(guidedSource).toContain('guidedFlowSteps[activeStep]');
    expect(guidedSource).toContain('heroAmountInput');
    expect(guidedSource).toContain('keyboardType="decimal-pad"');
    expect(guidedSource).toContain('placeholder="YYYY-MM-DD"');
    expect(guidedSource).toContain('label="Add note"');
    expect(standardSource).toContain('A rough number is fine. You can correct it later.');
    expect(guidedSource).not.toContain('guidedManualQuestions.map');
    expect(guidedSource).not.toContain('ManualPathThreeFactsPanel');
  });

  it('makes Review a row-by-row bottom sheet decision experience', () => {
    expect(reviewSource).toContain('selectedReviewDraftId');
    expect(reviewSource).toContain('setSelectedReviewDraftId(row.rowId)');
    expect(reviewSource).toContain('reviewActionSheet');

    for (const label of [
      'label="Add to my money"',
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
      expect(reviewSource).toContain(label);
    }

    expect(reviewSource).toContain('if you add it.');
    expect(reviewSource).toContain('Nothing changes until you do.');
    expect(reviewSource).not.toContain('Decision consequences');
  });

  it('shows only Add, Edit and Ignore up front and hides the rest behind More options', () => {
    // The three primary actions live in a dedicated container, not the 10-up grid.
    const primary = sourceBetween(reviewSource, 'styles.reviewPrimaryActions', 'FolioRevealRow');
    expect(primary).toContain('label="Add to my money"');
    for (const buried of [
      'Edit',
      'Ignore',
      'Duplicate',
      'Transfer',
      'Refund',
      'Income',
      'Bill',
      'Later',
    ]) {
      expect(primary).not.toContain(`label="${buried}"`);
    }

    // The remaining actions only render when the user expands "More".
    expect(reviewSource).toContain('title="More"');
    expect(reviewSource).toMatch(
      /showMoreRowActions \?[\s\S]*label="Edit"[\s\S]*label="Ignore"[\s\S]*label="Duplicate"[\s\S]*label="Later"/u,
    );
    // The sheet resets to the single primary action every time a row opens.
    expect(reviewSource).toContain('setShowMoreRowActions(false)');
  });

  it('keeps unreviewed import rows out of Today and accepted rows in Today', () => {
    const empty = { ...createEmptyLocalLedgerState('2026-06-24'), cashOnHandMinor: 10_000 };
    const before = buildLocalTodayModel(empty, buildLocalRouteSummary(empty));
    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-25,Energy bill,-94.27',
    ).state;
    const stagedToday = buildLocalTodayModel(staged, buildLocalRouteSummary(staged));
    const draft = staged.importDrafts[0];
    expect(draft).toBeDefined();
    const edited = editImportDraft(staged, draft?.rowId ?? '', {
      amountText: '-94.27',
      date: '2026-06-25',
      interpretation: 'Bill: Energy bill',
    });
    const accepted = confirmImportDraft(edited, draft?.rowId ?? '');
    const acceptedToday = buildLocalTodayModel(accepted, buildLocalRouteSummary(accepted));

    expect(staged.transactions).toHaveLength(0);
    expect(stagedToday.position.availableMinor).toBe(before.position.availableMinor);
    expect(accepted.transactions).toHaveLength(1);
    expect(acceptedToday.position.availableMinor).toBeLessThan(before.position.availableMinor);
  });

  it('shows route facts, buffer, causes and row explanations instead of only a decorative line', () => {
    for (const copy of [
      'Will I make it to payday?',
      'Spare after bills',
      'Next income',
      "What's going out",
      'Protected buffer',
      'Lowest point',
      'Still to check',
      "You've okayed",
      'What caused it',
      'Left after this',
    ]) {
      expect(routeSource).toContain(copy);
    }
    expect(routeSource).toContain('bufferLineY');
    expect(routeSource).toContain('Tap a point to reveal source, state and effect.');
  });

  it('uses human-language answer rows in the point detail panel without per-line show-why', () => {
    // The point panel was reworked from per-line RouteRow + Badge + "Show why" into stacked
    // RoutePointSection heading/body rows. Assert the new human-language rows exist...
    const panel = routeSource.slice(routeSource.indexOf('styles.routePointPanel'));
    for (const copy of [
      'What happened',
      'Left after this',
      'What caused it',
      'Still waiting for review',
    ]) {
      expect(panel).toContain(copy);
    }
    expect(panel).toContain('RoutePointSection');
    // ...and that the per-line "Show why" affordance is gone from inside the panel (the single
    // remaining "Show why" is the panel-level accessibility label, not a per-row control).
    expect(panel).not.toMatch(/label="Show why"|>Show why</u);
  });

  it('keeps debt and bill flows contextual without advice or shame', () => {
    expect(mobileShellSource).toContain('Which debt payment is worrying you first?');
    expect(mobileShellSource).toContain('This payment is due before your next income');
    expect(mobileShellSource).toContain('Before payday');
    expect(mobileShellSource).toContain('What must be paid before then?');

    const before = {
      ...createEmptyLocalLedgerState('2026-06-24'),
      cashOnHandMinor: 65_000,
    };
    const after = addPlannedCommitment(before, {
      amountText: '128.50',
      date: '2026-06-26',
      protected: true,
      title: 'Debt payment: Card minimum',
    });

    expect(buildLocalRouteSummary(after).tightestBalanceMinor).toBeLessThan(
      buildLocalRouteSummary(before).tightestBalanceMinor,
    );
    expect(visibleCopy).not.toMatch(/\byou should\b/iu);
    // Ban real advice/shaming phrasing — not the bare substring "shame", which also occurs in the
    // intended anti-shame copy "No shame, no advice, just what is due and what changed."
    expect(visibleCopy).not.toMatch(/best strategy|recommended payment|be ashamed|ashamed of/iu);
  });

  it('keeps unsupported files useful without implying OCR exists', () => {
    // Honest about the limitation, one clear primary path, no equal-button wall, no OCR claim.
    expect(reviewSource).toContain('File saved');
    expect(reviewSource).toContain('read this file automatically yet');
    expect(reviewSource).toContain('Add the numbers yourself');
    expect(reviewSource).toContain('Keep for later');
    expect(reviewSource).toContain('Remove file');
    expect(visibleCopy).not.toMatch(/\bOCR\b/iu);
  });

  it('rejects system-explaining product copy in visible strings', () => {
    for (const pattern of [
      /Rows wait in Review before they count/iu,
      /Folio asks one thing at a time/iu,
      /This anchors the picture/iu,
      /Folio needs one starting number/iu,
      /Records change after your tap/iu,
      /Route pressure/iu,
      /\bcanonical\b/iu,
      /\bprovenance\b/iu,
      /\bparser\b/iu,
      /financial reality/iu,
      /event graph/iu,
      /object count/iu,
      /\bdiagnostic\b/iu,
      /staged locally/iu,
      /confidence score/iu,
    ]) {
      expect(visibleCopy).not.toMatch(pattern);
    }
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

// Extract only genuine string-literal UI copy — never code. Each literal is its own balanced pair:
// single/double-quoted literals contain NO embedded newline (a JS string can't span raw newlines,
// and forbidding them stops an unbalanced apostrophe — can't / Melo's, or a comment apostrophe —
// from opening a "string" that swallows code/identifiers across lines, which is how camelCase
// symbols like `createQuickEstimateThroughCanonicalRepository` and prose in `//` comments used to
// leak into the corpus). Backtick templates may span lines; their `${...}` interpolations are code
// expressions (e.g. `${status.canonicalObjectCounts...}`) and are stripped before the ban scan.
function quotedVisibleCopy(source: string): string {
  const literals: string[] = [];
  const re = /'((?:\\.|[^'\n\\])*)'|"((?:\\.|[^"\n\\])*)"|`((?:\\.|[^`\\])*)`/gu;
  for (const match of source.matchAll(re)) {
    const literal = (match[1] ?? match[2] ?? match[3] ?? '').replace(/\$\{[^}]*\}/gu, ' ');
    literals.push(literal);
  }
  return literals
    .filter((copy) => /[A-Za-z]/u.test(copy))
    .filter((copy) => !copy.includes('../'))
    .filter((copy) => !/^[a-z0-9_-]+$/u.test(copy))
    .filter((copy) => /[\s.,;:!?]/u.test(copy) || /^[A-Z]/u.test(copy))
    .join('\n');
}

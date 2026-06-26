import { readFileSync } from 'node:fs';
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
import { importReviewActionCopy } from '../local/productExperienceLoop.js';

const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');

const startScreenSource = sourceBetween(
  mobileShellSource,
  'function StartScreen',
  'function LensChoiceButton',
);
const quickEstimateSource = sourceBetween(
  mobileShellSource,
  'function QuickEstimateScreen',
  'function TodayScreen',
);
const reviewScreenSource = sourceBetween(
  mobileShellSource,
  'function ImportReviewScreen',
  'function MeloScreen',
);
const routeSource = sourceBetween(
  mobileShellSource,
  'function BreathingHorizon',
  'function TimelineList',
);
// Extract visible quoted copy from each file independently, then join. Concatenating the raw
// sources before extraction lets the quote-pairing regex span the file boundary and capture
// code comments (e.g. an app/index.tsx comment containing "canonical") as if they were visible
// copy — a false positive. Per-file extraction scans 100% of both files' visible strings while
// keeping each file's quotes balanced within itself.
const visibleCopy = `${quotedVisibleCopy(mobileShellSource)}\n${quotedVisibleCopy(appRouteSource)}`;

describe('real product UX rebuild guard', () => {
  it('makes Start lead directly into job flows', () => {
    for (const copy of [
      'See where you stand',
      'Use a bank statement',
      'Sort out a debt',
      'Check a bill fits',
      'example numbers first',
    ]) {
      expect(startScreenSource).toContain(copy);
    }

    expect(appRouteSource).toContain("setScreen('quickEstimate')");
    expect(appRouteSource).toContain("setScreen('debtFlow')");
    expect(appRouteSource).toContain("setScreen('billFlow')");
    expect(appRouteSource).toContain("setScreen('sampleBriefing')");
  });

  it('shows one guided input step instead of all questions as cards', () => {
    expect(quickEstimateSource).toContain('const [activeStep, setActiveStep] = useState(0)');
    expect(quickEstimateSource).toContain('const activeQuestion = guidedFlowSteps[activeStep]');
    expect(quickEstimateSource).toContain('<GuidedInputStep');
    expect(quickEstimateSource).toContain('<GuidedProgress');
    expect(quickEstimateSource).not.toContain('guidedManualQuestions.map');
    expect(quickEstimateSource).not.toContain('GuidedQuestionCard');
  });

  it('keeps row review actions attached to each row', () => {
    expect(importReviewActionCopy.map((action) => action.label)).toEqual([
      'Add',
      'Edit',
      'Ignore',
      'Duplicate',
      'Income',
      'Bill',
      'Debt payment',
      'Refund',
      'Later',
      'Wrong workspace',
      'Not mine',
      'Read wrong',
      'Transfer',
    ]);
    expect(reviewScreenSource).toContain('visibleDrafts.map((row)');
    expect(reviewScreenSource).toContain('setSelectedReviewDraftId(row.rowId)');
    expect(reviewScreenSource).toContain('reviewActionSheet');
    expect(reviewScreenSource).toContain('label="Add to my money"');
    expect(reviewScreenSource).toContain('label="Edit"');
    expect(reviewScreenSource).toContain('label="Ignore"');
    expect(reviewScreenSource).toContain('label="Duplicate"');
    expect(reviewScreenSource).toContain('label="Transfer"');
    expect(reviewScreenSource).toContain(
      "markDraftMeaning(selectedReviewDraft, 'Refund', 'incoming')",
    );
    expect(reviewScreenSource).not.toContain('Decision consequences');
  });

  it('gives unsupported files useful manual actions', () => {
    // One clear primary path plus quiet keep/remove links — not an equal-button wall.
    expect(reviewScreenSource).toContain('File saved');
    expect(reviewScreenSource).toContain('read this file automatically yet');
    expect(reviewScreenSource).toContain('Add the numbers yourself');
    expect(reviewScreenSource).toContain('Keep for later');
    expect(reviewScreenSource).toContain('Remove file');
  });

  it('keeps imported rows out of Today until accepted, then updates Today', () => {
    const empty = { ...createEmptyLocalLedgerState('2026-06-24'), cashOnHandMinor: 25_000 };
    const before = buildLocalTodayModel(empty, buildLocalRouteSummary(empty));
    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-24,Salary,1000.00',
    ).state;
    const stagedToday = buildLocalTodayModel(staged, buildLocalRouteSummary(staged));
    const draft = staged.importDrafts[0];
    expect(draft).toBeDefined();

    const edited = editImportDraft(staged, draft?.rowId ?? '', {
      amountText: '1000.00',
      date: '2026-06-24',
      interpretation: 'Income: Salary',
    });
    const accepted = confirmImportDraft(edited, draft?.rowId ?? '');
    const acceptedToday = buildLocalTodayModel(accepted, buildLocalRouteSummary(accepted));

    expect(staged.transactions).toEqual([]);
    expect(stagedToday.position.availableMinor).toBe(before.position.availableMinor);
    expect(accepted.transactions).toHaveLength(1);
    expect(acceptedToday.position.availableMinor).toBeGreaterThan(before.position.availableMinor);
  });

  it('makes debt first-class enough to change route pressure', () => {
    expect(mobileShellSource).toContain('function DebtGuidedScreen');
    for (const copy of [
      'Debt lender or name',
      'Debt balance',
      'Minimum payment',
      'Debt payment due date',
      'APR if known',
      'Feels urgent',
      'Debt note',
    ]) {
      expect(mobileShellSource).toContain(copy);
    }

    const before = {
      ...createEmptyLocalLedgerState('2026-06-24'),
      cashOnHandMinor: 50_000,
    };
    const after = addPlannedCommitment(before, {
      amountText: '100.00',
      date: '2026-06-25',
      protected: true,
      title: 'Debt payment: Abound',
    });

    expect(buildLocalRouteSummary(after).availableNowMinor).toBeLessThan(
      buildLocalRouteSummary(before).availableNowMinor,
    );
    expect(buildLocalRouteSummary(after).protectedItems).toContain('minimum payments');
  });

  it('turns the route into an explanatory pressure map', () => {
    for (const copy of [
      'Will I make it to payday?',
      "What's happening here",
      // Point-detail panel now uses stacked human-language RoutePointSection rows: "What happened",
      // "What caused it", "Left after this", "Still waiting for review".
      'What happened',
      'Left after this',
      'What caused it',
      'Still waiting for review',
      'Still to check',
      'Left to spend',
      'Next money in',
      "What's going out",
      'Set aside for bills',
      "You've okayed",
      'Things waiting for you — they stay out of the picture until you say yes.',
    ]) {
      expect(routeSource).toContain(copy);
    }
  });

  it('keeps live copy free of banned internal and advice language', () => {
    expect(visibleCopy).not.toMatch(/\bcanonical\b/iu);
    expect(visibleCopy).not.toMatch(/\bprovenance\b/iu);
    expect(visibleCopy).not.toMatch(/\bparser\b/iu);
    expect(visibleCopy).not.toMatch(/financial reality/iu);
    expect(visibleCopy).not.toMatch(/event graph/iu);
    expect(visibleCopy).not.toMatch(/confidence score/iu);
    expect(visibleCopy).not.toMatch(/This anchors the picture/iu);
    expect(visibleCopy).not.toMatch(/Folio needs one starting number/iu);
    expect(visibleCopy).not.toMatch(/Folio asks one thing/iu);
    expect(visibleCopy).not.toMatch(/Rows wait in Review/iu);
    expect(visibleCopy).not.toMatch(/Records change after your tap/iu);
    expect(visibleCopy).not.toMatch(/Route pressure/iu);
    expect(visibleCopy).not.toMatch(/\byou should\b/iu);
    expect(visibleCopy).not.toMatch(/best strategy|recommended payment/iu);
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

function quotedVisibleCopy(source: string): string {
  return Array.from(
    source.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/gu),
    (match) => match[2] ?? '',
  )
    .filter((copy) => /[A-Za-z]/u.test(copy))
    .filter((copy) => !copy.includes('../'))
    .filter((copy) => !/^[a-z0-9_-]+$/u.test(copy))
    .filter((copy) => /[\s.,;:!?]/u.test(copy) || /^[A-Z]/u.test(copy))
    .join('\n');
}

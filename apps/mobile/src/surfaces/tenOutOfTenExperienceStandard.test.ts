import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stageStatementImportThroughCanonicalRepository } from '../local/canonicalLedgerMutations.js';
import { buildLocalRouteSummary, createEmptyLocalLedgerState } from '../local/localLedger.js';
import { buildLocalTodayModel } from '../local/localTodayAdapter.js';
import {
  guidedManualQuestions,
  productExperiencePrinciples,
  productLenses,
} from '../local/productExperienceStandard.js';
import { importReviewActionCopy } from '../local/productExperienceLoop.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url).href);
const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const importReviewSurfacePath = fileURLToPath(
  new URL('./importReviewSurface.tsx', import.meta.url).href,
);
const standardDocPath = `${root}FOLIO_10_OUT_OF_10_EXPERIENCE_STANDARD.md`;
const screenReviewPath = `${root}FOLIO_10_OUT_OF_10_SCREEN_REVIEW.md`;
const languageSystemPath = `${root}FOLIO_10_OUT_OF_10_LANGUAGE_SYSTEM.md`;

const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const importReviewSurfaceSource = readFileSync(importReviewSurfacePath, 'utf8');
const surfaceSource = `${mobileShellSource}\n${importReviewSurfaceSource}`;
const quotedVisibleCopy = Array.from(
  surfaceSource.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/gu),
  (match) => match[2] ?? '',
)
  .filter((copy) => /[A-Za-z]/u.test(copy))
  .filter((copy) => !copy.includes('../'))
  .filter((copy) => !/^[a-z0-9_-]+$/u.test(copy))
  .filter((copy) => /[\s.,;:!?]/u.test(copy) || /^[A-Z]/u.test(copy))
  .join('\n');

describe('10/10 product experience standard pass', () => {
  it('creates the required permanent product standard documents', () => {
    expect(existsSync(standardDocPath)).toBe(true);
    expect(existsSync(screenReviewPath)).toBe(true);
    expect(existsSync(languageSystemPath)).toBe(true);

    expect(readFileSync(standardDocPath, 'utf8')).toContain('One obvious next step.');
    expect(readFileSync(screenReviewPath, 'utf8')).toMatch(/\|\s*Start\s*\|\s*Rebuild\s*\|/u);
    expect(readFileSync(languageSystemPath, 'utf8')).toContain('show why');
    expect(productExperiencePrinciples).toContain('Review before anything counts.');
  });

  it('starts from personal financial lenses instead of advanced destinations', () => {
    expect(productLenses.map((lens) => lens.label)).toEqual([
      'Make it to payday',
      'Organise debts',
      'Check bills',
      'Add bank activity',
      'See where I stand',
      'Guide me',
    ]);
    expect(
      productLenses.every((lens) => lens.hiddenUntilNeeded.includes('Internal test mode')),
    ).toBe(true);
    expect(mobileShellSource).toContain('Will your money last to payday?');
    expect(mobileShellSource).toContain('See where you stand');
    expect(mobileShellSource).toContain('onStartDebtFlow');
    expect(mobileShellSource).toContain('onStartBillFlow');
    expect(mobileShellSource).toContain('Use a bank statement');
    expect(mobileShellSource).toContain('Have a look with example numbers first');
  });

  it('makes manual input guided, contextual and debt/bill/income aware', () => {
    expect(guidedManualQuestions.map((question) => question.question)).toEqual([
      'What money do you have right now?',
      'Is that exact or a rough estimate?',
      'When is money coming in next?',
      'What must be paid before then?',
    ]);
    expect(surfaceSource).toContain('const [activeStep, setActiveStep] = useState(0)');
    expect(surfaceSource).toContain('GuidedInputStep');
    expect(surfaceSource).toContain('heroAmountInput');
    expect(surfaceSource).toContain('label="Add note"');
    expect(surfaceSource).not.toContain('GuidedQuestionCard');
    // Guided input no longer wears wizard chrome: no "Why this helps" label, no Optional badge,
    // no visible "1 of 5" step counter — just the question, one input, and a human helper line.
    expect(surfaceSource).not.toContain('Why this helps');
    expect(surfaceSource).not.toContain('guidedStepHeader');
    expect(surfaceSource).toContain('Debt payment');
    expect(surfaceSource).toContain('Rent, loan, bill or minimum payment');
    expect(surfaceSource).toContain('Save first picture');
  });

  it('keeps review powerful and understandable without committing waiting rows', () => {
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
    expect(surfaceSource).toContain('Rows to check');
    expect(surfaceSource).toContain('Nothing has been added yet. Choose what to keep.');
    expect(surfaceSource).toContain('reviewActionSheet');
    expect(surfaceSource).toContain('setSelectedReviewDraftId(row.rowId)');
    // Each row is a ReviewDecisionCard leading with Add / Edit / Ignore; "More" opens the sheet
    // that holds the rest of the actions.
    expect(surfaceSource).toContain('<ReviewDecisionCard');
    expect(surfaceSource).toContain('onMore={() => setSelectedReviewDraftId(row.rowId)}');
    expect(surfaceSource).toContain('title="More"');
    expect(surfaceSource).toContain('File kept for later. Nothing changed.');

    const empty = createEmptyLocalLedgerState('2026-06-24');
    const before = buildLocalTodayModel(empty, buildLocalRouteSummary(empty));
    const staged = stageStatementImportThroughCanonicalRepository(
      empty,
      'Date,Description,Amount\n2026-06-24,Rent,-875.00',
    ).state;
    const after = buildLocalTodayModel(staged, buildLocalRouteSummary(staged));

    expect(staged.importDrafts).toHaveLength(1);
    expect(staged.transactions).toEqual([]);
    expect(after.position.availableMinor).toBe(before.position.availableMinor);
  });

  it('keeps unsupported imports honest and gives manual extraction paths', () => {
    // PDF/screenshot honesty now lives in the "Add bank activity" paste panel; the JSX wraps the
    // sentence across lines, so assert the two halves rather than the line-broken whole.
    expect(surfaceSource).toContain('PDF and screenshots can be added for');
    expect(surfaceSource).toContain('automatic reading is not ready for those files yet');
    // Honest about the limit, one clear "add it yourself" path, no OCR claim.
    expect(surfaceSource).toContain('read this file automatically yet');
    expect(surfaceSource).toContain('Add the numbers yourself');
  });

  it('makes the route inspectable with show-why language and review context', () => {
    expect(surfaceSource).toContain('Pressure point');
    expect(surfaceSource).toContain('What caused it');
    expect(surfaceSource).toContain('Still to check');
    expect(surfaceSource).toContain('Spare after bills');
    expect(surfaceSource).toContain("What's going out");
    expect(surfaceSource).toContain('Protected buffer');
    expect(surfaceSource).toContain("You've okayed");
    expect(surfaceSource).toContain('Things waiting for you');
    expect(surfaceSource).toContain('Will I make it to payday?');
  });

  it('keeps visible copy free of banned technical, advice, shame and fake certainty language', () => {
    expect(quotedVisibleCopy).not.toMatch(/\bcanonical\b/iu);
    expect(quotedVisibleCopy).not.toMatch(/\bprovenance\b/iu);
    expect(quotedVisibleCopy).not.toMatch(/\bparser\b/iu);
    expect(quotedVisibleCopy).not.toMatch(/financial reality/iu);
    expect(quotedVisibleCopy).not.toMatch(/event graph/iu);
    expect(quotedVisibleCopy).not.toMatch(/object count/iu);
    expect(quotedVisibleCopy).not.toMatch(/\bdiagnostic\b/iu);
    expect(quotedVisibleCopy).not.toMatch(/AI detected/iu);
    expect(quotedVisibleCopy).not.toMatch(/confidence score/iu);
    expect(quotedVisibleCopy).not.toMatch(/This anchors the picture/iu);
    expect(quotedVisibleCopy).not.toMatch(/Folio needs one starting number/iu);
    expect(quotedVisibleCopy).not.toMatch(/Folio asks one thing/iu);
    expect(quotedVisibleCopy).not.toMatch(/Rows wait in Review/iu);
    expect(quotedVisibleCopy).not.toMatch(/Records change after your tap/iu);
    expect(quotedVisibleCopy).not.toMatch(/Route pressure/iu);
    expect(quotedVisibleCopy).not.toMatch(/\byou should\b/iu);
    expect(quotedVisibleCopy).not.toMatch(/\bshame\b/iu);
  });
});

import { describe, expect, it } from 'vitest';

import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { createProductExperienceFixtures } from './productExperienceFixtures.js';

const bannedSurfaceWords =
  /\bconfidence\b|confidence_|_confidence|\bscore\b|\breadiness\b|\badvice\b|\bfailed\b|\bfailure\b/i;

describe('product experience scenario fixtures', () => {
  it('exports the full synthetic fixture set for the overnight evidence pass', () => {
    const fixtures = createProductExperienceFixtures('2026-06-22');

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'empty_first_launch',
      'sample_briefing',
      'minimal_manual_user',
      'one_upcoming_bill',
      'rejected_import',
      'duplicate_rejected_import',
      'accepted_import',
      'edited_import',
      'active_plan',
      'bad_month_recovery_preview',
      'accepted_recovery',
      'document_attachment',
      'calendar_planner_items',
      'data_control_export',
    ]);
    expect(fixtures.every((fixture) => fixture.synthetic)).toBe(true);
    expect(fixtures.every((fixture) => fixture.expectedSurfaces.length > 0)).toBe(true);
    expect(
      fixtures.every((fixture) => fixture.policyGates.includes('melo-policy-renderable')),
    ).toBe(true);
    expect(
      JSON.stringify(fixtures.map(({ primaryCopy, title }) => ({ primaryCopy, title }))),
    ).not.toMatch(bannedSurfaceWords);
  });

  it('keeps sample and preview fixtures from creating user financial reality', () => {
    const fixtures = createProductExperienceFixtures('2026-06-22');
    const sample = fixtures.find((fixture) => fixture.id === 'sample_briefing');
    const preview = fixtures.find((fixture) => fixture.id === 'bad_month_recovery_preview');

    expect(sample).toMatchObject({
      sampleOnly: true,
      canonicalRecordCounts: expect.objectContaining({
        importDrafts: 0,
        plans: 0,
        scenarios: 0,
        transactions: 0,
      }),
    });
    expect(preview?.scenarioPreview).toMatchObject({
      confirmationRequired: true,
      writesImmediately: false,
      scenario: expect.objectContaining({
        authorityState: 'hypothetical',
        status: 'previewed',
      }),
    });
    expect(preview?.canonicalRecordCounts.scenarios).toBe(0);
  });

  it('distinguishes accepted, edited and rejected import fixture outcomes', () => {
    const fixtures = createProductExperienceFixtures('2026-06-22');
    const rejected = fixtures.find((fixture) => fixture.id === 'rejected_import');
    const duplicateRejected = fixtures.find(
      (fixture) => fixture.id === 'duplicate_rejected_import',
    );
    const accepted = fixtures.find((fixture) => fixture.id === 'accepted_import');
    const edited = fixtures.find((fixture) => fixture.id === 'edited_import');
    const rejectedSnapshot = createCanonicalRepositoryForLocalLedgerState(
      rejected?.state ?? fixtures[0]!.state,
    ).snapshot();
    const acceptedSnapshot = createCanonicalRepositoryForLocalLedgerState(
      accepted?.state ?? fixtures[0]!.state,
    ).snapshot();
    const editedSnapshot = createCanonicalRepositoryForLocalLedgerState(
      edited?.state ?? fixtures[0]!.state,
    ).snapshot();

    expect(rejectedSnapshot.collections.transactions).toEqual([]);
    expect(rejectedSnapshot.collections.importedClaims).toEqual([
      expect.objectContaining({ nonFinancial: true, rejectionReason: 'duplicate' }),
    ]);
    expect(
      duplicateRejected?.state.importDrafts.some((draft) =>
        draft.reasons.join(' ').includes('previously rejected: duplicate'),
      ),
    ).toBe(true);
    expect(acceptedSnapshot.collections.transactions).toHaveLength(1);
    expect(acceptedSnapshot.collections.auditLog).toContainEqual(
      expect.objectContaining({ action: 'import_confirmed' }),
    );
    expect(editedSnapshot.collections.transactions).toEqual([]);
    expect(editedSnapshot.collections.userCorrections).toContainEqual(
      expect.objectContaining({ kind: 'import-row-edit' }),
    );
  });

  it('covers plan, recovery, document and calendar fixture evidence', () => {
    const fixtures = createProductExperienceFixtures('2026-06-22');
    const activePlan = fixtures.find((fixture) => fixture.id === 'active_plan');
    const acceptedRecovery = fixtures.find((fixture) => fixture.id === 'accepted_recovery');
    const documentAttachment = fixtures.find((fixture) => fixture.id === 'document_attachment');
    const calendarPlanner = fixtures.find((fixture) => fixture.id === 'calendar_planner_items');
    const dataControlExport = fixtures.find((fixture) => fixture.id === 'data_control_export');

    expect(activePlan?.canonicalRecordCounts.plans).toBeGreaterThan(0);
    expect(activePlan?.canonicalRecordCounts.calendarItems).toBeGreaterThan(0);
    expect(acceptedRecovery?.canonicalRecordCounts.scenarios).toBeGreaterThan(0);
    expect(acceptedRecovery?.canonicalRecordCounts.decisions).toBeGreaterThan(0);
    expect(acceptedRecovery?.canonicalRecordCounts.auditLog).toBeGreaterThan(0);
    expect(documentAttachment?.canonicalRecordCounts.documents).toBeGreaterThan(0);
    expect(calendarPlanner?.canonicalRecordCounts.calendarItems).toBeGreaterThan(0);
    expect(calendarPlanner?.canonicalRecordCounts.importDrafts).toBeGreaterThan(0);
    expect(dataControlExport?.canonicalRecordCounts.transactions).toBeGreaterThan(0);
    expect(dataControlExport?.canonicalRecordCounts.documents).toBeGreaterThan(0);
    expect(dataControlExport?.canonicalRecordCounts.importedClaims).toBeGreaterThan(0);
  });
});

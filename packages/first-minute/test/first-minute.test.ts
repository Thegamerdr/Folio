import { describe, expect, it } from 'vitest';

import {
  bottomNavDestinations,
  buildQuickStartProjection,
  firstLaunchDataPaths,
  firstMinuteBoundary,
  firstMinuteTargetSeconds,
  getNativeKeyBlockedPhase4Tasks,
  getPhase4TaskStatus,
  localFirstPrivacyRouteSummary,
  mobileInformationArchitecture,
  phase4TaskStatuses,
  secondaryDestinations,
  syntheticPreviewTimeline,
  validateFirstLaunchDataPathChoice,
  validateQuickStartInput,
  validateQuickStartProjection,
  validateSyntheticPreviewTimeline,
} from '../src/index.js';

describe('first-minute package boundary', () => {
  it('is pure TypeScript model state with no native or UI ownership', () => {
    expect(firstMinuteBoundary).toMatchObject({
      packageName: '@folio/first-minute',
      deterministic: true,
      importsNativeOrUiRuntime: false,
      ownsNativeVaultLifecycle: false,
    });
    expect(firstMinuteTargetSeconds).toBe(60);
  });
});

describe('synthetic labelled preview data', () => {
  it('is clearly labelled, synthetic, user-data free and within the preview target', () => {
    expect(validateSyntheticPreviewTimeline(syntheticPreviewTimeline)).toEqual({
      ok: true,
      value: syntheticPreviewTimeline,
    });
    expect(syntheticPreviewTimeline.label).toContain('not your finances');
    expect(syntheticPreviewTimeline.targetSeconds).toBeLessThanOrEqual(20);
    expect(syntheticPreviewTimeline.guardrails).toEqual({
      noFakePersonalisation: true,
      clearlyLabelledDemo: true,
      neverMixesWithUserVault: true,
    });
    expect(
      syntheticPreviewTimeline.events.every((event) => event.synthetic && !event.usesUserData),
    ).toBe(true);
  });
});

describe('quick three-fact path', () => {
  it('validates available-now, income and outgoing facts before producing a temporary projection', () => {
    const projection = buildQuickStartProjection({
      asOf: '2026-06-20',
      availableNow: { minorUnits: 100000, currency: 'gbp' },
      nextIncome: {
        date: '2026-06-28',
        amount: { minorUnits: 80000, currency: 'GBP' },
        label: 'Payday',
      },
      nextImportantOutgoing: {
        date: '2026-06-24',
        amount: { minorUnits: -73500, currency: 'GBP' },
        label: 'Rent',
      },
      protectedFloor: { minorUnits: 10000, currency: 'GBP' },
    });

    expect(projection).toMatchObject({
      kind: 'first_minute_quick_start_projection',
      source: 'three_fact_quick_start',
      completeness: 'incomplete_but_useful',
      accountRequired: false,
      permissionsRequested: [],
      currency: 'GBP',
      balanceBeforeIncomeMinor: 26500,
      balanceOnIncomeDateMinor: 106500,
      availableBeforeIncomeMinor: 16500,
      coveredBeforeIncome: true,
      shortfallBeforeIncomeMinor: 0,
      nextImportantDate: '2026-06-24',
    });
    expect(projection.missingContext).toContain('recurring_rules');
    expect(validateQuickStartProjection(projection)).toEqual({ ok: true, value: projection });
  });

  it('rejects ambiguous or unsafe input facts', () => {
    const result = validateQuickStartInput({
      asOf: '2026-06-20',
      availableNow: { minorUnits: 100000, currency: 'GBP' },
      nextIncome: {
        date: '2026-06-19',
        amount: { minorUnits: -1, currency: 'GBP' },
      },
      nextImportantOutgoing: {
        date: '2026-06-24',
        amount: { minorUnits: 73500, currency: 'USD' },
        label: '',
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          'income_before_as_of',
          'income_must_be_positive',
          'outgoing_must_be_negative',
          'currency_mismatch',
          'invalid_outgoing_label',
        ]),
      );
    }
  });
});

describe('first-launch paths, privacy routes and navigation', () => {
  it('offers import, quick start and demo without upfront permissions or goal questionnaire', () => {
    expect(firstLaunchDataPaths.map((path) => path.id)).toEqual([
      'import_statement',
      'quick_start_three_facts',
      'explore_demo',
    ]);

    for (const path of firstLaunchDataPaths) {
      expect(validateFirstLaunchDataPathChoice(path.id)).toEqual({ ok: true, value: path });
      expect(path.accountRequired).toBe(false);
      expect(path.upfrontPermissions).toHaveLength(0);
      expect(path.startsGoalQuestionnaire).toBe(false);
      expect(path.reversible).toBe(true);
    }
  });

  it('summarises local-first data routes with cloud and banking off until chosen', () => {
    expect(localFirstPrivacyRouteSummary).toMatchObject({
      headline: 'Your information stays on this device unless you choose otherwise.',
      accountRequiredAtLaunch: false,
      permissionsRequestedAtLaunch: [],
      dataLocationIndicator: {
        label: 'On this device',
        cloudRoute: 'not_active',
      },
    });

    const routes = new Map(localFirstPrivacyRouteSummary.routes.map((route) => [route.id, route]));
    expect(routes.get('local_device_vault')).toMatchObject({
      state: 'active_by_default',
      leavesDevice: false,
    });
    expect(routes.get('open_banking')).toMatchObject({
      state: 'off_until_chosen',
      leavesDevice: true,
    });
    expect(routes.get('optional_cloud_account')).toMatchObject({
      state: 'off_until_chosen',
      leavesDevice: true,
    });
  });

  it('models the Phase 4 bottom navigation and secondary destinations', () => {
    expect(bottomNavDestinations.map((destination) => destination.id)).toEqual([
      'today',
      'timeline',
      'money',
      'plans',
      'calendar',
    ]);
    expect(secondaryDestinations.map((destination) => destination.id)).toEqual([
      'search',
      'transactions',
      'settings',
    ]);
    expect(mobileInformationArchitecture.workspaceIdentityVisible).toBe(true);
    expect(mobileInformationArchitecture.oneHandCommonPaths).toBe(true);
  });
});

describe('Phase 4 task metadata', () => {
  it('covers T060 through T070 and names the native-key blockers for T061/T062', () => {
    expect(phase4TaskStatuses.map((task) => task.id)).toEqual([
      'T060',
      'T061',
      'T062',
      'T063',
      'T064',
      'T065',
      'T066',
      'T067',
      'T068',
      'T069',
      'T070',
    ]);

    expect(getNativeKeyBlockedPhase4Tasks().map((task) => task.id)).toEqual(['T061', 'T062']);
    expect(getPhase4TaskStatus('T061')).toMatchObject({
      state: 'blocked_by_native_key',
      nativeKeyRequirement: {
        code: 'native_key_required',
        requiredTaskIds: ['T016'],
      },
    });
    expect(getPhase4TaskStatus('T062')).toMatchObject({
      state: 'blocked_by_native_key',
      nativeKeyRequirement: {
        code: 'native_key_required',
        requiredTaskIds: ['T016'],
      },
    });
  });
});

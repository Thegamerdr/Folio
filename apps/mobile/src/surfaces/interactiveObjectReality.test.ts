import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  addPlannedCommitment,
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  createInitialLocalLedgerState,
  stageStatementImport,
} from '../local/localLedger.js';
import {
  buildLocalCalendarModel,
  filterLocalCalendarEventsForDate,
  summarizeLocalCalendarDay,
} from '../local/localCalendarAdapter.js';
import { buildLocalPlansModel } from '../local/localPlansAdapter.js';
import { buildLocalPurchaseScenarioPreview } from '../local/localScenarioAdapter.js';
import { buildLocalTimelineModel } from '../local/localTimelineAdapter.js';

const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const dataControlSurfacePath = fileURLToPath(
  new URL('./dataControlSurface.tsx', import.meta.url).href,
);
const dataControlSurfaceSource = readFileSync(dataControlSurfacePath, 'utf8');
const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);
const appRouteSource = readFileSync(appRoutePath, 'utf8');

describe('interactive object reality pass', () => {
  it('turns route points into source-backed objects including commitments, income, preview and shortfall', () => {
    const route = buildLocalRouteSummary(createInitialLocalLedgerState('2026-06-22'));

    expect(route.points.every((point) => point.accessibleLabel.length > 0)).toBe(true);
    expect(route.points.every((point) => point.sourceLabel.length > 0)).toBe(true);
    expect(route.points.every((point) => point.provenanceLabel.length > 0)).toBe(true);
    expect(route.points.every((point) => point.actionLabel.length > 0)).toBe(true);
    expect(route.points.map((point) => point.pointKind)).toEqual([
      'confirmed',
      'commitment',
      'commitment',
      'expected',
      'commitment',
    ]);
    expect(route.points.find((point) => point.title === 'Payday')).toMatchObject({
      pointKind: 'expected',
      sourceLabel: 'Private example',
    });

    const preview = buildLocalPurchaseScenarioPreview(
      { ...createEmptyLocalLedgerState('2026-06-22'), cashOnHandMinor: 5_000 },
      buildLocalRouteSummary({
        ...createEmptyLocalLedgerState('2026-06-22'),
        cashOnHandMinor: 5_000,
      }),
      80,
    );

    expect(preview.previewRoute.points[0]).toMatchObject({
      authorityLabel: 'Hypothetical scenario preview',
      pointKind: 'shortfall',
      reviewState: 'preview only',
      sourceLabel: 'Scenario preview',
    });
  });

  it('derives calendar day meaning and plan card evidence from canonical records', () => {
    const ledger = addPlannedCommitment(
      { ...createEmptyLocalLedgerState('2026-06-22'), cashOnHandMinor: 20_000 },
      {
        amountText: '25.00',
        date: '2026-06-24',
        title: 'Dentist',
      },
    );
    const route = buildLocalRouteSummary(ledger);
    const calendar = buildLocalCalendarModel(ledger, route);
    const dayRows = filterLocalCalendarEventsForDate(calendar.agenda, '2026-06-24');
    const daySummary = summarizeLocalCalendarDay(dayRows);
    const plans = buildLocalPlansModel(ledger, route);

    expect(daySummary).toMatchObject({
      kind: 'commitment',
      label: 'Bill',
      tone: 'confirmed',
    });
    expect(dayRows.map((row) => row.kind)).toEqual(['commitment', 'plan']);
    expect(plans.planRows[0]).toMatchObject({
      affectedBy: expect.arrayContaining([expect.stringContaining('commitment')]),
      authorityLabel: expect.any(String),
      intention: expect.any(String),
      linkedEvidence: expect.arrayContaining([expect.stringContaining('plan')]),
      ruleLabel: expect.stringContaining('minimum buffer'),
    });
  });

  it('keeps staged imports and timeline entries as reviewable objects with concise default rows', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const timeline = buildLocalTimelineModel(staged);

    expect(timeline.events.some((event) => event.kindLabel === 'Import')).toBe(true);
    expect(mobileShellSource).toContain('function groupTimelineEvents');
    expect(mobileShellSource).toContain('surfacePreviewText(event.detail, 84)');
    expect(mobileShellSource).toContain('timelineRevealPanel');
    expect(mobileShellSource).toContain('Action: {surfaceStateLabel(event.evidence.actionPath)}');
  });

  it('renders interaction object controls for route, recovery, import, data control, Melo, status chips and money rows', () => {
    const combinedSource = `${mobileShellSource}\n${dataControlSurfaceSource}\n${appRouteSource}`;

    expect(combinedSource).toContain('type InteractionObjectState');
    expect(combinedSource).toContain("state: 'preview only'");
    expect(combinedSource).toContain("state: 'needs user confirmation'");
    expect(mobileShellSource).toContain('routePointStrip');
    expect(mobileShellSource).toContain('routePointPanel');
    expect(mobileShellSource).toContain('point.point.accessibleLabel');
    expect(mobileShellSource).toContain('Preview guardrails');
    expect(mobileShellSource).toContain('importReviewHeaderCopy');
    expect(mobileShellSource).toContain('No import rows waiting.');
    expect(dataControlSurfaceSource).toContain('Audit history');
    expect(dataControlSurfaceSource).toContain('Clear data');
    expect(mobileShellSource).toContain('Melo noticed');
    expect(mobileShellSource).toContain('Melo proposes');
    expect(mobileShellSource).toContain('User decides');
    expect(mobileShellSource).toContain('gateMeloText(');
    expect(appRouteSource).toContain('Business workspace is separate but not available in this UI');
    expect(appRouteSource).toContain('Cloud, AI and Open Banking are optional');
    // Provenance stays inspectable, but only on reveal — not as a permanent "Source: Current
    // picture" label on every row.
    expect(mobileShellSource).toContain('Based on {source}');
    expect(mobileShellSource).not.toContain('Source: Current picture');
    expect(mobileShellSource).toContain('accessibilityState={{ expanded }}');
    expect(combinedSource).not.toMatch(
      /\b(?:confidence|score|investment advice|debt advice|shame|streak)\b/iu,
    );
  });

  it('distinguishes cleared empty workspace from a confirmed zero balance', () => {
    const route = buildLocalRouteSummary(createEmptyLocalLedgerState('2026-06-22'));
    const serializedRoute = JSON.stringify(route);

    expect(route.points[0]).toMatchObject({
      reviewState: 'needs source',
      sourceLabel: 'Empty workspace',
      tone: 'estimated',
    });
    expect(route.points[0]?.accessibleLabel).toContain('needs source');
    expect(route.points[0]?.accessibleLabel).not.toMatch(
      /user confirmed|already real|Confirmed local calculation/i,
    );
    expect(serializedRoute).toContain('empty local baseline');
    expect(mobileShellSource).toContain('the first picture is not a confirmed zero bank balance.');
    expect(mobileShellSource).toContain('the opening figure is only a starting point.');
    expect(mobileShellSource).toContain("point.reviewState === 'needs source'");
    expect(mobileShellSource).toContain("normalized.includes('no records')");
  });
});

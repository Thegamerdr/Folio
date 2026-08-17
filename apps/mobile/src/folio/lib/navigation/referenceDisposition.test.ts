import { describe, expect, it } from 'vitest';

import { SCREEN_IDS, SHEET_IDS } from '../../types';
import {
  REFERENCE_SCREEN_DISPOSITIONS,
  REFERENCE_SCREEN_IDS,
  REFERENCE_SHEET_DISPOSITIONS,
  REFERENCE_SHEET_IDS,
} from './referenceDisposition';

describe('complete Lovable reference disposition', () => {
  it('accounts for all 92 reference screens exactly once', () => {
    expect(REFERENCE_SCREEN_DISPOSITIONS).toHaveLength(92);
    expect(new Set(REFERENCE_SCREEN_IDS).size).toBe(92);
  });

  it('accounts for all 41 reference sheets exactly once', () => {
    expect(REFERENCE_SHEET_DISPOSITIONS).toHaveLength(41);
    expect(new Set(REFERENCE_SHEET_IDS).size).toBe(41);
  });

  it('points every non-deferred screen job at a real native route', () => {
    const nativeIds = new Set<string>(SCREEN_IDS);
    const invalid = REFERENCE_SCREEN_DISPOSITIONS.filter(
      (item) =>
        item.status !== 'deferred' &&
        (item.nativeTarget === undefined || !nativeIds.has(item.nativeTarget)),
    );
    expect(invalid).toEqual([]);
  });

  it('points every non-deferred sheet job at a real native sheet', () => {
    const nativeIds = new Set<string>(SHEET_IDS);
    const invalid = REFERENCE_SHEET_DISPOSITIONS.filter(
      (item) =>
        item.status !== 'deferred' &&
        (item.nativeTarget === undefined || !nativeIds.has(item.nativeTarget)),
    );
    expect(invalid).toEqual([]);
  });

  it('records the consolidated intake, review and data-security destinations as live', () => {
    const required = [
      'pdf-success',
      'pdf-fallback',
      'image-success',
      'image-fallback',
      'paste-success',
      'review',
      'privacy',
    ];
    expect(
      REFERENCE_SCREEN_DISPOSITIONS.filter((item) => required.includes(item.referenceId)).map(
        (item) => [item.referenceId, item.status],
      ),
    ).toEqual(required.map((id) => [id, 'live']));
  });

  it('keeps intentional deferrals explicit instead of silently dropping them', () => {
    expect(
      REFERENCE_SCREEN_DISPOSITIONS.filter((item) => item.status === 'deferred').map(
        (item) => item.referenceId,
      ),
    ).toEqual([
      'partner-mode',
      'widget-preview',
      'business-payroll',
      'business-ir35',
      'pension-planner',
    ]);
    expect(
      REFERENCE_SHEET_DISPOSITIONS.filter((item) => item.status === 'deferred').map(
        (item) => item.referenceId,
      ),
    ).toEqual(['household-setup', 'chart-style']);
  });
});

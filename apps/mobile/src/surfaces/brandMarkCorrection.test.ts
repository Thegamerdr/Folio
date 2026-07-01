import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../../', import.meta.url).href);

const deprecatedSerifSplashHash =
  'DA7614F11B6A08D32DD9C1F6918A47F67CD33441F2281722B19FEC50B9160FD3';
const brandMarkPath = fileURLToPath(new URL('./brandMark.tsx', import.meta.url).href);
const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
// The pressure-map app was moved from app/index.tsx to app/home.tsx (reachable at /home) when the
// live route was flipped to the FolioShell; this guard follows that (unchanged) surface to home.tsx.
const appRoutePath = fileURLToPath(new URL('../../app/home.tsx', import.meta.url).href);
const firstMinutePath = fileURLToPath(new URL('./firstMinuteSurface.tsx', import.meta.url).href);
const dataControlPath = fileURLToPath(new URL('./dataControlSurface.tsx', import.meta.url).href);
const rendererPath = `${root}tooling/scripts/render-mobile-shell-evidence.ts`;
const directionPath = `${root}FOLIO_BRAND_MARK_DIRECTION.md`;
const splashPath = `${root}apps/mobile/assets/splash.png`;

const brandMarkSource = readFileSync(brandMarkPath, 'utf8');
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const firstMinuteSource = readFileSync(firstMinutePath, 'utf8');
const dataControlSource = readFileSync(dataControlPath, 'utf8');
const rendererSource = readFileSync(rendererPath, 'utf8');
const directionSource = readFileSync(directionPath, 'utf8');
const splashHash = createHash('sha256')
  .update(readFileSync(splashPath))
  .digest('hex')
  .toUpperCase();

describe('Folio temporary brand mark correction', () => {
  it('defines a non-serif folded-record route mark with an accessibility label', () => {
    expect(brandMarkSource).toContain('export function FolioBrandMark');
    expect(brandMarkSource).toContain(
      'Folio temporary brand mark: folded local record with a money line',
    );
    expect(brandMarkSource).toContain('accessibilityRole="image"');
    expect(brandMarkSource).toContain('<Svg');
    expect(brandMarkSource).toContain('<Path');
  });

  it('replaces the old live-surface F mark and deprecated splash asset', () => {
    for (const source of [
      mobileShellSource,
      appRouteSource,
      firstMinuteSource,
      dataControlSource,
    ]) {
      expect(source).not.toContain('<Text style={styles.avatarLargeText}>F</Text>');
      expect(source).not.toContain('>F</Text>');
    }

    expect(splashHash).not.toBe(deprecatedSerifSplashHash);
    expect(mobileShellSource).toContain('<FolioBrandMark size={64} />');
    expect(appRouteSource).toContain('<FolioBrandMark size={32} />');
    expect(firstMinuteSource).toContain('<FolioBrandMark size={34} />');
    expect(dataControlSource).toContain('<FolioBrandMark size={30} />');
  });

  it('documents the correction and updates the evidence-board renderer', () => {
    expect(directionSource).toContain('folded page + money line');
    expect(directionSource).toContain('Do not build a brand system around the old serif `F`');
    expect(directionSource).toContain(deprecatedSerifSplashHash);

    expect(rendererSource).toContain('function folioMark');
    expect(rendererSource).toContain(
      'Folio temporary brand mark: folded local record with a money line',
    );
    expect(rendererSource).toContain("folioMark('boardMark')");
    expect(rendererSource).toContain("folioMark(\n      'topbarMark'");
  });
});

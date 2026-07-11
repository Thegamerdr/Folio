// No-fabricated-content guard — source-scans the screens where demo-era merchant strings
// leaked to REAL users (owner's cleared phone, 2026-07-11: the Recovery screen offered
// "Move Octopus to the 12th" / "Pause Disney+" with zero subs in the store, and PdfSuccess
// could enqueue the sample statement's rows into a real review queue on a cold open).
//
// The rule (owner, 2026-07-06, memory folio-no-demo-data-in-release): the released app ships
// NO demo/seed data — demo content is opt-in via "Reset to the demo" and lives in the STORE
// seed, never hardcoded in a screen where a real user meets it as if it were theirs.
//
// VisualizerScreen deliberately keeps its SAMPLE_ROW_META map: it is display metadata for the
// demo paste flow, and real candidate data now takes precedence over it (fixed alongside this
// guard) — so it is not scanned here.
//
// Same source-scan pattern as melo.test.ts. Node-safe.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

const recovery = read('./RecoveryScreen.tsx');
const pdfSuccess = read('./PdfSuccessScreen.tsx');

// Demo-era merchant/figure strings that must never be hardcoded into these screens again.
const FABRICATED = ['Octopus', 'Disney+', 'Whitstone', '8.99', 'Statement_June_2025'] as const;

describe('no fabricated content on real-user screens', () => {
  it('RecoveryScreen derives every move from live store data', () => {
    for (const banned of FABRICATED) {
      expect(recovery, `RecoveryScreen contains "${banned}"`).not.toContain(banned);
    }
    // The moves must stay conditional on their real targets existing.
    expect(recovery).toContain('bill\n        ? {');
    expect(recovery).toContain('pausable\n        ? {');
  });

  it('RecoveryScreen shows the honest £0 shortfall, never the web demo £94', () => {
    expect(recovery).toContain('FALLBACK_SHORTFALL = 0');
  });

  it('PdfSuccessScreen has no sample statement to fall back to', () => {
    for (const banned of FABRICATED) {
      expect(pdfSuccess, `PdfSuccessScreen contains "${banned}"`).not.toContain(banned);
    }
    expect(pdfSuccess).toContain('EMPTY_FOUND');
  });
});

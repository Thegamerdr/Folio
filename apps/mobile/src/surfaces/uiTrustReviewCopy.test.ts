import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const surfaceFiles = [
  'dataControlSurface.tsx',
  'firstMinuteSurface.tsx',
  'importReviewSurface.tsx',
  'mobileShell.tsx',
  'sampleBriefingSurface.tsx',
] as const;

const surfaceSource = surfaceFiles
  .map((file) => readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url).href), 'utf8'))
  .join('\n');

const quotedVisibleCopy = Array.from(
  surfaceSource.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/gu),
  (match) => match[2] ?? '',
)
  .filter((copy) => /[A-Za-z]/u.test(copy))
  .filter((copy) => !copy.includes('../'))
  .filter((copy) => !/^[a-z0-9_-]+$/u.test(copy))
  .filter((copy) => /[\s.,;:!?]/u.test(copy) || /^[A-Z]/u.test(copy))
  .join('\n');

describe('pre-dogfood UI trust copy', () => {
  it('keeps technical repository and parser language out of visible dogfood/import copy', () => {
    const retiredVisibleCopy = [
      'Canonical object counts',
      'Canonical local repository',
      'Dogfood mode contract',
      'Reset clears local canonical data',
      'Source and parser details',
      'Source looked parseable',
      'Parser error',
      'Parser evidence is limited',
      'QIF parser limitation',
      'Parser input needs review',
    ];

    for (const copy of retiredVisibleCopy) {
      expect(surfaceSource).not.toContain(copy);
    }

    expect(surfaceSource).toContain('Local record counts');
    expect(surfaceSource).toContain('Local records on this device');
    expect(surfaceSource).toContain('Original and review details');
    expect(surfaceSource).toContain('Add to my money');
  });

  it('uses calmer money-view wording for review-before-reality moments', () => {
    const retiredHeavyCopy = [
      'Review decides what becomes reality.',
      'Accept makes this financial reality.',
      'nothing becomes financial reality',
      'Timeline reality',
      'Accepted reality',
    ];

    for (const copy of retiredHeavyCopy) {
      expect(surfaceSource).not.toContain(copy);
    }

    expect(surfaceSource).toContain('Check these before they count.');
    expect(surfaceSource).toContain('Add keeps this payment in your money view.');
    expect(surfaceSource).toContain('nothing affects your money view until you review it');
    expect(surfaceSource).toContain('Added to your money');
  });

  it('keeps mission-banned internal language out of visible copy strings', () => {
    const bannedVisiblePatterns = [
      /\bcanonical\b/iu,
      /\bprovenance\b/iu,
      /\bparser\b/iu,
      /\bindexed\b/iu,
      /financial reality/iu,
      /make real/iu,
      /recovery scenario/iu,
      /event graph/iu,
      /source record/iu,
      /source records/iu,
      /Data Control/iu,
      /Dogfood mode/iu,
      /object counts/iu,
      /staged locally/iu,
      /\bstaged\b/iu,
      /confidence score/iu,
      /AI detected/iu,
      /\bjudgement\b/iu,
      /\bjudgment\b/iu,
    ];

    for (const pattern of bannedVisiblePatterns) {
      expect(quotedVisibleCopy).not.toMatch(pattern);
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  findFlatRateSector,
  HMRC_FRS_SECTORS,
  HMRC_FRS_SECTOR_SOURCE,
  searchFlatRateSectors,
} from '../src/frsSectors.js';

describe('HMRC Flat Rate Scheme catalogue', () => {
  it('contains the complete published 54-sector table with stable unique identities', () => {
    expect(HMRC_FRS_SECTORS).toHaveLength(HMRC_FRS_SECTOR_SOURCE.sectorCount);
    expect(new Set(HMRC_FRS_SECTORS.map((sector) => sector.id)).size).toBe(54);
    expect(new Set(HMRC_FRS_SECTORS.map((sector) => sector.label)).size).toBe(54);
    expect(HMRC_FRS_SECTORS.every((sector) => sector.examples.length > 0)).toBe(true);
  });

  it('stores every published rate as integer basis points', () => {
    expect(
      HMRC_FRS_SECTORS.every(
        (sector) =>
          Number.isSafeInteger(sector.rateBasisPoints) &&
          sector.rateBasisPoints >= 400 &&
          sector.rateBasisPoints <= 1450,
      ),
    ).toBe(true);
    expect(findFlatRateSector('accountancy-or-bookkeeping')?.rateBasisPoints).toBe(1450);
    expect(findFlatRateSector('post-offices')?.rateBasisPoints).toBe(500);
    expect(
      findFlatRateSector('retailing-food-confectionery-tobacco-newspapers-or-childrens-clothing')
        ?.rateBasisPoints,
    ).toBe(400);
  });

  it('searches both sector labels and HMRC trade examples', () => {
    expect(searchFlatRateSectors('bookkeeper').map((sector) => sector.id)).toContain(
      'accountancy-or-bookkeeping',
    );
    expect(searchFlatRateSectors('taxi').map((sector) => sector.id)).toEqual([
      'transport-or-storage',
    ]);
    expect(searchFlatRateSectors('plumber').map((sector) => sector.id)).toEqual([
      'general-building-or-construction',
      'labour-only-building-or-construction',
    ]);
    expect(searchFlatRateSectors('')).toHaveLength(54);
  });

  it('keeps the official source and verification version explicit', () => {
    expect(HMRC_FRS_SECTOR_SOURCE.url).toBe(
      'https://www.gov.uk/hmrc-internal-manuals/vat-flat-rate-scheme/frs7300',
    );
    expect(HMRC_FRS_SECTOR_SOURCE.id).toBe('hmrc-frs7300-2024-05-31.v1');
  });
});

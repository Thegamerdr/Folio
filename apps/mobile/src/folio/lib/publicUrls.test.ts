import { describe, expect, it } from 'vitest';

import { MELO_NATIVE_LINK, MELO_PUBLIC_URLS } from './publicUrls';

describe('Melo public URL contract', () => {
  it('uses melo-money.com for website, legal, support and app links', () => {
    expect(MELO_PUBLIC_URLS).toEqual({
      website: 'https://melo-money.com',
      open: 'https://melo-money.com/open',
      privacy: 'https://melo-money.com/privacy',
      terms: 'https://melo-money.com/terms',
      support: 'https://melo-money.com/support',
      supportEmail: 'support@melo-money.com',
    });
  });

  it('uses the public Melo identity while preserving the pre-release scheme as an alias', () => {
    expect(MELO_NATIVE_LINK).toEqual({
      scheme: 'melo',
      legacySchemes: ['folio'],
      packageId: 'com.melomoney.app',
      host: 'melo-money.com',
      pathPrefix: '/open',
    });
  });
});

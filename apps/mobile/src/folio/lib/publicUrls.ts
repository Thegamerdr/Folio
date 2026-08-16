/** Public web and native-link contract for the Melo release identity. */
export const MELO_PUBLIC_URLS = {
  website: 'https://melo-money.com',
  open: 'https://melo-money.com/open',
  privacy: 'https://melo-money.com/privacy',
  terms: 'https://melo-money.com/terms',
  support: 'https://melo-money.com/support',
  supportEmail: 'support@melo-money.com',
} as const;

export const MELO_NATIVE_LINK = {
  scheme: 'melo',
  legacySchemes: ['folio'],
  packageId: 'com.melomoney.app',
  host: 'melo-money.com',
  pathPrefix: '/open',
} as const;

export type EntitlementTier = 'plus' | 'pro';

export type ProviderProof = Readonly<{
  productId: string;
  tier: EntitlementTier;
  providerState: string;
  expiresAt: string | null;
  acknowledged: boolean;
  test: boolean;
}>;

export type PurchaseProvider = Readonly<{
  configured: boolean;
  verify: (productId: string, purchaseToken: string) => Promise<ProviderProof>;
  acknowledge: (productId: string, purchaseToken: string) => Promise<boolean>;
}>;

export type EntitlementGrantClaims = Readonly<{
  v: 1;
  platform: 'google-play';
  tier: EntitlementTier;
  productId: string;
  tokenHash: string;
  providerState: string;
  expiresAt: string | null;
  refreshAfter: string;
  graceUntil: string | null;
  test: boolean;
}>;

export type GrantSigner = Readonly<{
  configured: boolean;
  publicJwk: Readonly<Record<string, unknown>> | null;
  sign: (claims: EntitlementGrantClaims) => Promise<string>;
}>;

export type EntitlementStore = Readonly<{
  put: (
    key: string,
    value: string,
    options?: Readonly<{ expirationTtl?: number }>,
  ) => Promise<void>;
}>;

export type RuntimeEnv = Readonly<{
  PACKAGE_NAME: string;
  GOOGLE_TOKEN_URI: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  ENTITLEMENT_ISSUER: string;
  ENTITLEMENT_AUDIENCE: string;
  ENTITLEMENT_SIGNING_KEY_ID: string;
  ENTITLEMENT_SIGNING_PRIVATE_KEY?: string;
  ENTITLEMENT_SIGNING_PUBLIC_JWK?: string;
  BILLING_PUBLIC_VERIFICATION_ENABLED?: string;
  ALLOWED_ORIGINS?: string;
}>;

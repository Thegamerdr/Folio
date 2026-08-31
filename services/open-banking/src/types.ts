export type ConnectionStatus =
  | 'pending_redirect'
  | 'pending_sync'
  | 'active'
  | 'error'
  | 'disconnected';

export type PublicAccount = Readonly<{
  accountRef: string;
  label: string;
  currency: string;
  kind: 'personal' | 'business';
  accountType: 'current' | 'savings' | 'card';
  lastSuccessfulRefreshAt: string | null;
}>;

export type CipherEnvelope =
  | Readonly<{
      v: 1;
      alg: 'A256GCM';
      nonce: string;
      ciphertext: string;
    }>
  | Readonly<{
      v: 2;
      alg: 'A256GCM';
      binding: 'melo-open-banking-connection';
      nonce: string;
      ciphertext: string;
    }>;

export type ProviderAccountSecret = {
  accountRef: string;
  providerAccountId: string;
  cursor?: string;
  rangeFrom?: string;
  rangeTo?: string;
  pendingRequestId?: string;
};

export type ProviderSecret = {
  providerConnectionId: string;
  accounts: ProviderAccountSecret[];
};

export type StoredConnection = {
  v: 2;
  /** Opaque SHA-256 workspace binding. Raw workspace IDs never leave the device. */
  workspaceRef: string;
  id: string;
  provider: 'truelayer-data-v3';
  status: ConnectionStatus;
  scopes: readonly ['accounts', 'transactions'];
  createdAt: string;
  callbackAt: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  disconnectedAt: string | null;
  lastSuccessfulRefreshAt: string | null;
  lastErrorCode: string | null;
  accounts: PublicAccount[];
  sealedProvider: CipherEnvelope | null;
};

export type PublicConnection = Readonly<{
  id: string;
  provider: 'truelayer-data-v3';
  providerLabel: 'TrueLayer';
  status: ConnectionStatus;
  scopes: readonly ['accounts', 'transactions'];
  createdAt: string;
  grantedAt: string | null;
  expiresAt: string | null;
  disconnectedAt: string | null;
  lastSuccessfulRefreshAt: string | null;
  lastErrorCode: string | null;
  accounts: readonly PublicAccount[];
  futureAccessStopped: boolean;
  providerRevocationSupported: false;
}>;

export type ProviderAccount = Readonly<{
  id: string;
  type: 'account' | 'card';
  accountType: 'current' | 'savings' | 'card';
  customerSegment: 'retail' | 'business';
  currency: string;
}>;

export type ProviderTransaction = Readonly<{
  id: string;
  timestamp: string;
  description: string;
  currency: string;
  amountInMinor: number;
  status: 'pending' | 'settled';
}>;

export type TransactionsPage =
  | Readonly<{ status: 'pending'; requestId: string }>
  | Readonly<{ status: 'failed'; requestId: string; reason: string }>
  | Readonly<{
      status: 'completed';
      requestId: string;
      items: readonly ProviderTransaction[];
      nextCursor: string | null;
    }>;

export type CreateProviderConnectionInput = Readonly<{
  displayName: string;
  email: string;
  returnUri: string;
  localConnectionId: string;
  endUserIp?: string;
}>;

export type ProviderRequestContext = Readonly<{
  endUserIp?: string;
}>;

export type ProviderGateway = Readonly<{
  configured: boolean;
  configurationValid: boolean;
  environment: string;
  createConnection: (
    input: CreateProviderConnectionInput,
  ) => Promise<Readonly<{ providerConnectionId: string; authorizationUrl: string }>>;
  listAccounts: (
    providerConnectionId: string,
    context?: ProviderRequestContext,
  ) => Promise<readonly ProviderAccount[]>;
  createTransactionsRequest: (
    providerConnectionId: string,
    providerAccountId: string,
    input: Readonly<{ from: string; to: string; cursor?: string }>,
    context?: ProviderRequestContext,
  ) => Promise<Readonly<{ requestId: string }>>;
  getTransactionsRequest: (
    providerConnectionId: string,
    providerAccountId: string,
    requestId: string,
    context?: ProviderRequestContext,
  ) => Promise<TransactionsPage>;
}>;

export type OpenBankingStore = Readonly<{
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: Readonly<{ expirationTtl?: number }>,
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (prefix: string) => Promise<readonly string[]>;
}>;

export type RuntimeEnv = Readonly<{
  /** Explicit release switch. Provider credentials alone must never expose the route. */
  OPEN_BANKING_ENABLED?: string;
  CLERK_ISSUER: string;
  CLERK_JWKS_URL: string;
  ALLOWED_ORIGINS?: string;
  PUBLIC_BASE_URL: string;
  APP_RETURN_URI: string;
  TRUELAYER_ENVIRONMENT: string;
  TRUELAYER_AUTH_BASE_URL: string;
  TRUELAYER_API_BASE_URL: string;
  TRUELAYER_CLIENT_ID?: string;
  TRUELAYER_CLIENT_SECRET?: string;
  CONNECTION_ENCRYPTION_KEY?: string;
}>;

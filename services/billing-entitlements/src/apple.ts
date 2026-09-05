import { BILLING_PRODUCT_TIERS } from './catalog';
import { BillingProviderError } from './google';
import type { EntitlementTier, PurchaseProvider, RuntimeEnv } from './types';

const APPLE_API_TIMEOUT_MS = 12_000;
const APPLE_BUNDLE_ID = 'com.folio.v2.greenfield';
const APPLE_ENVIRONMENTS = { Production: 'Production', Sandbox: 'Sandbox' } as const;

// Apple Root CA - G2/G3, published by Apple's PKI and used by App Store signed-data chains.
// Keep the trust anchors pinned in the Worker bundle; never fetch a root from runtime input.
const APPLE_ROOT_CA_G2 =
  'MIIFkjCCA3qgAwIBAgIIAeDltYNno+AwDQYJKoZIhvcNAQEMBQAwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEcyMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxMDA5WhcNMzkwNDMwMTgxMDA5WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzIxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANgREkhI2imKScUcx+xuM23+TfvgHN6sXuI2pyT5f1BrTM65MFQn5bPW7SXmMLYFN14UIhHF6Kob0vuy0gmVOKTvKkmMXT5xZgM4+xb1hYjkWpIMBDLyyED7Ul+f9sDx47pFoFDVEovy3d6RhiPw9bZyLgHaC/YuOQhfGaFjQQscp5TBhsRTL3b2CtcM0YM/GlMZ81fVJ3/8E7j4ko380yhDPLVoACVdJ2LT3VXdRCCQgzWTxb+4Gftr49wIQuavbfqeQMpOhYV4SbHXw8EwOTKrfl+q04tvny0aIWhwZ7Oj8ZhBbZF8+NfbqOdfIRqMM78xdLe40fTgIvS/cjTf94FNcX1RoeKz8NMoFnNvzcytN31O661A4T+B/fc9Cj6i8b0xlilZ3MIZgIxbdMYs0xBTJh0UT8TUgWY8h2czJxQI6bR3hDRSj4n4aJgXv8O7qhOTH11UL6jHfPsNFL4VPSQ08prcdUFmIrQB1guvkJ4M6mL4m1k8COKWNORj3rw31OsMiANDC1CvoDTdUE0V+1ok2Az6DGOeHwOx4e7hqkP0ZmUoNwIx7wHHHtHMn23KVDpA287PT0aLSmWaasZobNfMmRtHsHLDd4/E92GcdB/O/WuhwpyUgquUoue9G7q5cDmVF8Up8zlYNPXEpMZ7YLlmQ1A/bmH8DvmGqmAMQ0uVAgMBAAGjQjBAMB0GA1UdDgQWBBTEmRNsGAPCe8CjoA1/coB6HHcmjTAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQwFAAOCAgEAUabz4vS4PZO/Lc4Pu1vhVRROTtHlznldgX/+tvCHM/jvlOV+3Gp5pxy+8JS3ptEwnMgNCnWefZKVfhidfsJxaXwU6s+DDuQUQp50DhDNqxq6EWGBeNjxtUVAeKuowM77fWM3aPbn+6/Gw0vsHzYmE1SGlHKy6gLti23kDKaQwFd1z4xCfVzmMX3zybKSaUYOiPjjLUKyOKimGY3xn83uamW8GrAlvacp/fQ+onVJv57byfenHmOZ4VxG/5IFjPoeIPmGlFYl5bRXOJ3riGQUIUkhOb9iZqmxospvPyFgxYnURTbImHy99v6ZSYA7LNKmp4gDBDEZt7Y6YUX6yfIjyGNzv1aJMbDZfGKnexWoiIqrOEDCzBL/FePwN983csvMmOa/orz6JopxVtfnJBtIRD6e/J/JzBrsQzwBvDR4yGn1xuZW7AYJNpDrFEobXsmII9oDMJELuDY++ee1KG++P+w8j2Ud5cAeh6Squpj9kuNsJnfdBrRkBof0Tta6SqoWqPQFZ2aWuuJVecMsXUmPgEkrihLHdoBR37q9ZV0+N0djMenl9MU/S60EinpxLK8JQzcPqOMyT/RFtm2XNuyE9QoB6he7hY1Ck3DDUOUUi78/w0EP3SIEIwiKum1xRKtzCTrJ+VKACd+66eYWyi4uTLLT3OUEVLLUNIAytbwPF+E=';
const APPLE_ROOT_CA_G3 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

export type AppleSdk = typeof import('@apple/app-store-server-library');
export type AppleSdkLoader = () => Promise<AppleSdk>;

export function appleProvider(
  env: RuntimeEnv,
  sdkLoader: AppleSdkLoader = loadAppleSdk,
): PurchaseProvider {
  const appAppleId = Number(env.APPLE_APP_ID ?? '');
  const environmentName =
    env.APPLE_ENVIRONMENT === 'Production' || env.APPLE_ENVIRONMENT === 'Sandbox'
      ? env.APPLE_ENVIRONMENT
      : undefined;
  const configured =
    nonBlank(env.APPLE_ISSUER_ID) &&
    nonBlank(env.APPLE_KEY_ID) &&
    nonBlank(env.APPLE_PRIVATE_KEY) &&
    env.APPLE_BUNDLE_ID === APPLE_BUNDLE_ID &&
    environmentName !== undefined &&
    (environmentName === APPLE_ENVIRONMENTS.Sandbox ||
      (Number.isSafeInteger(appAppleId) && appAppleId > 0));

  return {
    configured,
    async verify(productId, purchaseToken) {
      if (!configured)
        throw new BillingProviderError(
          'provider_not_configured',
          503,
          'Apple verification is not configured.',
        );
      const sdk = await sdkLoader();
      const environment =
        environmentName === APPLE_ENVIRONMENTS.Sandbox
          ? sdk.Environment.SANDBOX
          : sdk.Environment.PRODUCTION;
      const verifier = new sdk.SignedDataVerifier(
        [Buffer.from(APPLE_ROOT_CA_G2, 'base64'), Buffer.from(APPLE_ROOT_CA_G3, 'base64')],
        true,
        environment,
        APPLE_BUNDLE_ID,
        environmentName === APPLE_ENVIRONMENTS.Production ? appAppleId : undefined,
      );
      const supplied = await bounded(verifier.verifyAndDecodeTransaction(purchaseToken));
      assertTransaction(supplied, productId, environmentName!);
      if (supplied.transactionId === undefined)
        throw invalid('purchase_not_found', 'Apple transaction has no identifier.');

      const client = new sdk.AppStoreServerAPIClient(
        env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        env.APPLE_KEY_ID!,
        env.APPLE_ISSUER_ID!,
        APPLE_BUNDLE_ID,
        environment,
      );
      const freshResponse = await bounded(client.getTransactionInfo(supplied.transactionId));
      if (typeof freshResponse.signedTransactionInfo !== 'string')
        throw invalid('provider_invalid_response', 'Apple returned no signed transaction.');
      const fresh = await bounded(
        verifier.verifyAndDecodeTransaction(freshResponse.signedTransactionInfo),
      );
      assertTransaction(fresh, productId, environmentName!);
      if (fresh.transactionId !== supplied.transactionId)
        throw invalid('proof_mismatch', 'Apple transaction changed during verification.');
      const tier = BILLING_PRODUCT_TIERS.get(productId) as EntitlementTier | undefined;
      if (tier === undefined) throw invalid('product_not_allowed', 'Apple product is not allowed.');

      if (tier === 'full') {
        return {
          productId,
          tier,
          providerState: 'PURCHASED',
          expiresAt: null,
          acknowledged: true,
          test: environmentName === 'Sandbox',
        };
      }
      const originalId = fresh.originalTransactionId ?? fresh.transactionId;
      const statuses = await bounded(client.getAllSubscriptionStatuses(originalId));
      const records = (statuses.data ?? []).flatMap((group) => group.lastTransactions ?? []);
      if (records.length > 64)
        throw invalid('provider_invalid_response', 'Apple returned too many subscription chains.');
      let latest:
        | Awaited<
            ReturnType<InstanceType<AppleSdk['SignedDataVerifier']>['verifyAndDecodeTransaction']>
          >
        | undefined;
      let renewal:
        | Awaited<
            ReturnType<InstanceType<AppleSdk['SignedDataVerifier']>['verifyAndDecodeRenewalInfo']>
          >
        | undefined;
      let status: number | undefined;
      let latestOrder = Number.NEGATIVE_INFINITY;
      for (const record of records) {
        if (record.signedTransactionInfo === undefined || record.signedRenewalInfo === undefined)
          continue;
        const candidate = await bounded(
          verifier.verifyAndDecodeTransaction(record.signedTransactionInfo),
        );
        if (candidate.productId !== productId || candidate.originalTransactionId !== originalId)
          continue;
        const candidateRenewal = await bounded(
          verifier.verifyAndDecodeRenewalInfo(record.signedRenewalInfo),
        );
        if (
          candidateRenewal.originalTransactionId !== originalId ||
          candidateRenewal.productId !== productId ||
          candidateRenewal.environment !== environmentName
        )
          continue;
        const candidateExpiry = candidate.expiresDate;
        if (!Number.isFinite(candidateExpiry)) continue;
        const candidateOrder = Number.isFinite(candidate.signedDate)
          ? candidate.signedDate!
          : Number.isFinite(candidate.purchaseDate)
            ? candidate.purchaseDate!
            : candidateExpiry!;
        if (
          latest === undefined ||
          candidateOrder > latestOrder ||
          (candidateOrder === latestOrder && candidateExpiry! > latest.expiresDate!)
        ) {
          latest = candidate;
          renewal = candidateRenewal;
          status = typeof record.status === 'number' ? record.status : undefined;
          latestOrder = candidateOrder;
        }
      }
      if (latest === undefined || renewal === undefined) {
        throw invalid('purchase_not_active', 'Apple returned no active subscription chain.');
      }
      assertTransaction(latest, productId, environmentName!);
      if (latest.originalTransactionId !== originalId)
        throw invalid('proof_mismatch', 'Apple subscription chain does not match.');
      if (latest.revocationDate !== undefined || latest.isUpgraded === true)
        throw invalid('purchase_not_active', 'Apple subscription is revoked or upgraded.');
      const expiry = latest.expiresDate;
      if (!Number.isFinite(expiry))
        throw invalid('provider_invalid_response', 'Apple subscription has no expiry.');
      const now = Date.now();
      const grace = renewal.gracePeriodExpiresDate;
      const inGrace =
        status === sdk.Status.BILLING_GRACE_PERIOD && Number.isFinite(grace) && grace! > now;
      const active = status === sdk.Status.ACTIVE || inGrace;
      if (!active || (expiry! <= now && !inGrace))
        throw invalid('purchase_expired', 'Apple subscription has expired or is not active.');
      const effectiveExpiry = inGrace ? grace! : expiry!;
      return {
        productId,
        tier,
        providerState: inGrace ? 'BILLING_GRACE_PERIOD' : 'ACTIVE',
        expiresAt: new Date(effectiveExpiry).toISOString(),
        acknowledged: true,
        test: environmentName === 'Sandbox',
      };
    },
    // StoreKit's finishTransaction is the client acknowledgement step; the server has no separate
    // acknowledge endpoint. The mobile lifecycle finishes only after this verified proof is saved.
    async acknowledge() {
      return configured;
    },
  };
}

async function loadAppleSdk(): Promise<AppleSdk> {
  // Do not hoist this import: the SDK initializes random/crypto machinery at module scope that
  // Workers rejects during global evaluation. Dynamic import is intentionally inside the handler.
  return import('@apple/app-store-server-library');
}

function assertTransaction(
  transaction: {
    bundleId?: string;
    environment?: string;
    productId?: string;
    revocationDate?: number;
    isUpgraded?: boolean;
  },
  productId: string,
  environment: 'Production' | 'Sandbox',
): void {
  if (
    transaction.bundleId !== APPLE_BUNDLE_ID ||
    transaction.environment !== environment ||
    transaction.productId !== productId
  ) {
    throw invalid('proof_mismatch', 'Apple transaction does not match this app or product.');
  }
  if (transaction.revocationDate !== undefined || transaction.isUpgraded === true) {
    throw invalid('purchase_not_active', 'Apple transaction is revoked or upgraded.');
  }
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new BillingProviderError('provider_timeout', 504, 'Apple verification timed out.'),
            ),
          APPLE_API_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function invalid(code: string, message: string): BillingProviderError {
  return new BillingProviderError(code, code === 'provider_invalid_response' ? 502 : 409, message);
}

function nonBlank(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

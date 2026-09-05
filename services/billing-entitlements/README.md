# Melo billing entitlements

This Worker is the trust boundary between App Store/Google Play Billing and Melo's on-device
entitlement state. The app sends an allowed product ID and the platform proof after the platform
reports `purchased`. The Worker verifies that proof with the provider API, stores only a SHA-256
proof hash, signs a short entitlement grant, and only then allows the client to finish the native
transaction.

The deployed foundation is intentionally unavailable until all of the following exist:

- the Play application and products;
- a service account with the minimum Play Console order/subscription permissions;
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` Worker secrets;
- `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` Worker secrets;
- `APPLE_BUNDLE_ID=com.folio.v2.greenfield`, `APPLE_ENVIRONMENT` (`Production` or `Sandbox`),
  and numeric `APPLE_APP_ID` (Production only) Worker variables;
- an Ed25519 signing key and matching public JWK;
- the `ENTITLEMENTS` KV binding.

The private Google key and entitlement signing key must never be placed in the app, repository,
Wrangler variables, logs, or release evidence. The APK receives only the Worker URL and Ed25519
public key. A client-created or unsigned entitlement is never accepted.

Apple setup uses only App Store Connect server credentials on the Worker. `APPLE_PRIVATE_KEY` is
the escaped PEM downloaded for the App Store Connect API key; it never ships to mobile. Apple
verification dynamically loads the official App Store Server Library inside the request handler,
pins the bundled Apple Root CA G2/G3 trust anchors, and requires an explicit `APPLE_ENVIRONMENT`
(`Production` or `Sandbox`) with exact bundle ID (and app ID in Production). It verifies the supplied
StoreKit JWS and then fetches fresh transaction/subscription status from the matching App Store API
before issuing a grant. LocalTesting, unsigned decoded claims, revoked/upgraded
transactions, and expired subscriptions are rejected. Billing grace is accepted only when Apple
returns an explicit grace status with a future grace expiry. Online certificate revocation checks are
enabled. API and OCSP transport use an abortable bounded native-fetch adapter and failures fail closed;
there is no production-to-sandbox fallback.

## Readiness commands

Run the non-destructive preflight from the repository root:

```text
pnpm billing:preflight
```

It checks the deployed health endpoint, current sellable catalog, KV binding, signer state and
secret names without printing secret values. Missing provider credentials are reported as `WAIT`
and do not fail the preflight. The strict activation check is:

```text
pnpm billing:readiness
```

That command exits non-zero until the Play service-account secrets are present and the Worker
reports `providerConfigured: true`. Install the two missing Play values without placing them in a
shell argument, file, log or commit:

```text
pnpm billing:secret:google-email
pnpm billing:secret:google-private-key
pnpm billing:readiness
```

Wrangler prompts for each value and writes it directly to the deployed Worker secret store. Use
only a Google Play license-testing account for E2E; the repository contains no purchase tokens or
customer data.

Apple uses the same preflight with `--apple` (run from `services/billing-entitlements`):

```text
node scripts/check-readiness.mjs --apple
node scripts/check-readiness.mjs --apple --activation
```

The strict Apple check requires the three named Apple secrets, signer, catalog and explicit
Production configuration. Sandbox configuration accepts only Sandbox proofs, marks grants as test
data and cannot pass production activation. A preflight is configuration evidence, not an actual
purchase/restore or iOS device test. Before deployment retain the `node-fetch` Wrangler alias:
it routes the official SDK's API and OCSP reads through the bounded native Worker transport.

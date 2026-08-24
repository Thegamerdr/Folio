# Billing runtime evidence — 2026-08-24

## Executed locally

Command:

```text
pnpm exec vitest run services/billing-entitlements/src/index.test.ts
```

Result: 6 tests passed, including configuration honesty, sellable catalog output, Full grant
issuance, Live offline grace calculation, unknown-product rejection, and provider-unconfigured
fail-closed behavior.

Command:

```text
pnpm exec tsc -p services/billing-entitlements/tsconfig.json --noEmit --pretty false
```

Result: passed.

## External evidence intentionally not claimed

No Play Console listing, license-testing purchase, Android Publisher service account, or Worker
secret was available in this environment. Therefore this package does not claim native purchase,
restore, cancellation/expiry, or live provider verification. The exact setup and evidence steps
are in `PRODUCT_CONFIGURATION.md`.

## Safe runtime checks after provisioning

1. `GET /health` must report `providerConfigured: true`, `signerConfigured: true`, and
   `tokenStoreConfigured: true`.
2. `GET /v1/catalog` must return the three sellable IDs only, with
   `pricesArePrototype: true` until the Play Console values are confirmed.
3. Use only a license-testing account. Save the final-binary purchase result, signed grant
   verification result, restore result, and cancellation/expiry result; do not save purchase
   tokens or private keys.

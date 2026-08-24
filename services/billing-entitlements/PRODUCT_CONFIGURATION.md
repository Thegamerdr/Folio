# Melo billing product configuration

This service-owned matrix is the implementation contract for the current Melo model. Prices are
the product brief values and must be entered or confirmed in Google Play Console; this file is not
evidence of a live listing or a completed sandbox purchase.

| Product ID           | Tier   | Google Play type                         | Cadence | Brief price    | New sale | Restore mapping |
| -------------------- | ------ | ---------------------------------------- | ------- | -------------- | -------- | --------------- |
| `folio.full`         | Full   | one-time in-app product (non-consumable) | once    | GBP 29.99      | yes      | Full            |
| `folio.live.monthly` | Live   | subscription                             | monthly | GBP 2.99/month | yes      | Live            |
| `folio.live.yearly`  | Live   | subscription                             | annual  | GBP 24.99/year | yes      | Live            |
| `folio.plus.monthly` | legacy | subscription                             | monthly | legacy         | no       | Full            |
| `folio.plus.yearly`  | legacy | subscription                             | annual  | legacy         | no       | Full            |
| `folio.pro.monthly`  | legacy | subscription                             | monthly | legacy         | no       | Full            |
| `folio.pro.yearly`   | legacy | subscription                             | annual  | legacy         | no       | Full            |

## Exact owner/provider actions still required

1. In Google Play Console, create the three sellable IDs exactly as listed, using GBP pricing and
   the stated billing type/cadence. Do not create new Plus/Pro sale products.
2. Add a license-testing account and use a test payment method; save purchase, restore,
   cancellation/expiry and invalid-token results for the final release binary.
3. Create a least-privilege Play service account with Android Publisher purchase verification and
   acknowledgement access. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` as Worker secrets only.
4. Generate the Ed25519 entitlement signing key, keep the private key as
   `ENTITLEMENT_SIGNING_PRIVATE_KEY`, and publish only the matching public JWK and key ID.
5. Bind the `ENTITLEMENTS` KV namespace and verify `/health` reports provider, signer and KV
   configuration before any test purchase.

The Worker rejects unknown products, pending/non-owned purchases, mismatched provider proofs and
unconfigured verification. It stores only a token hash and never logs a purchase token.

# Melo billing entitlements

This Worker is the trust boundary between Google Play Billing and Melo's on-device entitlement
state. The app sends an allowed product ID and the Play purchase token after the platform reports
`purchased`. The Worker verifies that proof with the Google Play Developer API, stores only a
SHA-256 token hash, signs a short entitlement grant, and then attempts acknowledgement.

The deployed foundation is intentionally unavailable until all of the following exist:

- the Play application and products;
- a service account with the minimum Play Console order/subscription permissions;
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` Worker secrets;
- an Ed25519 signing key and matching public JWK;
- the `ENTITLEMENTS` KV binding.

The private Google key and entitlement signing key must never be placed in the app, repository,
Wrangler variables, logs, or release evidence. The APK receives only the Worker URL and Ed25519
public key. A client-created or unsigned entitlement is never accepted.

## Public verification boundary

`POST /v1/google/verify` is independently disabled unless
`BILLING_PUBLIC_VERIFICATION_ENABLED` is the exact trimmed lowercase string `true`. The checked-in
value is `false`; provider or signer credentials do not enable the route. `/health` exposes only the
parsed `publicVerificationEnabled` boolean, while health and the public JWKS remain available.

An enabled request is handled in this order: trusted Cloudflare source identity, source rate limit,
bounded JSON read, product/token validation, purchase rate limit, local provider/signer readiness,
then Google verification, grant signing, optional acknowledgement and hash-only KV storage. CORS is
only a browser interoperability policy and is not authentication.

The request body is limited to 8,192 bytes actually read from the stream. A false, small or missing
`Content-Length` cannot bypass the limit. The route accepts JSON content types only and rejects
invalid UTF-8, malformed JSON, arrays and scalar JSON before any provider call.

## Rate-limit configuration

The account owner confirmed these two account-unique namespaces and initial restore-friendly limits:

| Binding                        | Namespace | Limit        | Purpose and rationale                                                                  |
| ------------------------------ | --------- | ------------ | -------------------------------------------------------------------------------------- |
| `VERIFY_SOURCE_RATE_LIMITER`   | `21001`   | 300 per 60 s | Loose coarse burst guard; avoids a restrictive per-IP quota on shared mobile networks. |
| `VERIFY_PURCHASE_RATE_LIMITER` | `21002`   | 10 per 60 s  | Bounds repeated provider work for one product/token while allowing restore retries.    |

Both keys are SHA-256 hashes with versioned domain labels. The source dimension hashes Cloudflare's
trusted connecting-IP value; the purchase dimension hashes the validated product ID and purchase
token. Raw source addresses, purchase tokens, composed identifiers and hash keys are never logged or
stored. Missing source identity, missing bindings, thrown limiter calls and malformed limiter
outcomes fail closed before Google is called.

Cloudflare's Rate Limiting binding is permissive, eventually consistent and local to a Cloudflare
location. It is defence-in-depth for provider abuse, not exact billing, fraud, entitlement or quota
accounting. If security review requires stronger caller proof, keep the public switch false and
design Play Integrity/account binding separately without making Melo login mandatory for restore.

## Responses and monitoring

- `429 verification_rate_limited` is generic, has `cache-control: no-store`, and returns
  `Retry-After: 60` for either limiter.
- `503 verification_unavailable` covers the disabled switch and unavailable identity/control
  dependencies without revealing which secret or binding is absent.
- `413 request_too_large`, `415 invalid_request` and `400 invalid_request` stop invalid input before
  provider work.

Limiter decisions emit a single structured event containing only `route`, `stage` and `code`.
Operations owns these initial Workers Logs alerts:

- page on three `source_limiter_unavailable`, `purchase_limiter_unavailable` or
  `source_identity_missing` events within five minutes;
- investigate 30 `rate_limited` events within five minutes or a sustained 429 share above 5% of
  verification attempts for ten minutes;
- review legitimate restore evidence before tightening either limit.

## Manual enablement sequence

This repository change does not deploy or enable the route. An authorised operator must:

1. reconfirm namespaces `21001` and `21002` are unique in the target Cloudflare account;
2. provision the minimum-privilege Google and signing secrets and the hash-only KV binding;
3. deploy a reviewed version with `BILLING_PUBLIC_VERIFICATION_ENABLED=false`;
4. confirm health reports `publicVerificationEnabled: false` and monitoring receives no control
   failures;
5. exercise a controlled Play verification and restore in a non-public/restricted rollout;
6. approve security, store and operations evidence, then deliberately publish a version with the
   switch set to exact `true`.

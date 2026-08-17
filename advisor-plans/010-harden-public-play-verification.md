# Plan 010: Harden Play verification before public reachability

> **Executor instructions**: Execute in the requested sequence after plan 009. Keep the verification
> POST route disabled in every public environment until this plan is DONE, reviewed and its operator
> prerequisites are supplied. Do not deploy or add secrets automatically. Follow every step and
> verification gate, and update `advisor-plans/README.md` when done unless a reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- services/billing-entitlements/src/index.ts services/billing-entitlements/src/index.test.ts services/billing-entitlements/src/types.ts services/billing-entitlements/wrangler.jsonc services/billing-entitlements/worker-configuration.d.ts services/billing-entitlements/README.md services/billing-entitlements/package.json apps/mobile/src/folio/lib/billing/billingVerification.ts docs/release-evidence/C14-store-billing-operations-release.md`
> Stop if the endpoint is already public-enabled without equivalent controls, if its request contract
> has changed, or if another plan added authentication/attestation that changes the abuse model.

## Status

- **Execution status**: DONE locally; public switch remains false and no deployment occurred
- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: scheduled after plan 009; no code dependency on the Business gate
- **Category**: security, billing, edge service, release safety
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

`POST /v1/google/verify` accepts an unauthenticated purchase token and can trigger Google Play verify
and acknowledge calls. Its current size check trusts `Content-Length`, so a chunked or dishonest
request can be read without the intended 8 KiB bound, and there is no kill switch or rate limit. CORS
does not protect a native/mobile API. Before the route is publicly reachable, it needs a fail-closed
exposure switch, bounded streaming input and abuse controls that run before provider work.

## Current state

- `services/billing-entitlements/src/index.ts:98-127` accepts the public verification POST after only
  provider/signer configuration checks, then calls Google with the submitted token.
- `safeJsonBody` at lines 191-203 rejects a declared `Content-Length` above 8192 but delegates to
  `request.json()` when the header is missing, false or chunked. The actual bytes are not bounded.
- `services/billing-entitlements/wrangler.jsonc` defines KV and observability but no rate-limit
  binding or public-verification switch.
- `services/billing-entitlements/src/types.ts` has no public-route configuration.
- Existing tests inject the provider, signer and store into `handleRequest`, which is the right seam
  for deterministic abuse-control tests.
- The service README says verification is intentionally unavailable until configuration exists, but
  provider credentials alone would currently make the POST route live.
- Cloudflare's current Rate Limiting binding accepts a caller-supplied key and returns a success
  decision, is configured with a unique numeric namespace ID, and is deliberately permissive and
  eventually consistent. It is an abuse guard, not billing/accounting truth. See the official
  [Rate Limiting binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
  and [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

## Commands you will need

| Purpose           | Command                                                                                                                                                                                                                                                                                                                                                                       | Expected on success                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Focused tests     | `pnpm exec vitest run services/billing-entitlements/src/index.test.ts --passWithNoTests`                                                                                                                                                                                                                                                                                      | exit 0                                             |
| Worker types      | `pnpm --filter @melo/billing-entitlements types`                                                                                                                                                                                                                                                                                                                              | exit 0 and only expected generated binding changes |
| Service typecheck | `pnpm --filter @melo/billing-entitlements typecheck`                                                                                                                                                                                                                                                                                                                          | exit 0                                             |
| Dry-run bundle    | `pnpm --filter @melo/billing-entitlements exec wrangler deploy --dry-run`                                                                                                                                                                                                                                                                                                     | exit 0; no deployment                              |
| Full gate         | `pnpm run ci`                                                                                                                                                                                                                                                                                                                                                                 | exit 0                                             |
| Formatting        | `pnpm exec prettier --check services/billing-entitlements/src/index.ts services/billing-entitlements/src/index.test.ts services/billing-entitlements/src/types.ts services/billing-entitlements/wrangler.jsonc services/billing-entitlements/worker-configuration.d.ts services/billing-entitlements/README.md docs/release-evidence/C14-store-billing-operations-release.md` | exit 0                                             |

## Scope

**In scope**:

- `services/billing-entitlements/src/index.ts`
- `services/billing-entitlements/src/index.test.ts`
- `services/billing-entitlements/src/types.ts`
- `services/billing-entitlements/wrangler.jsonc`
- `services/billing-entitlements/worker-configuration.d.ts`
- `services/billing-entitlements/README.md`
- `docs/release-evidence/C14-store-billing-operations-release.md`

**Read-only references**:

- `services/billing-entitlements/src/google.ts`
- `services/billing-entitlements/src/signing.ts`
- `apps/mobile/src/folio/lib/billing/billingVerification.ts`
- `tooling/config/release-blockers.json`

**Out of scope**:

- Deploying the Worker, changing DNS, setting production variables/secrets or enabling the route.
- Storing raw purchase tokens, request bodies or client IP addresses.
- Treating rate limits as exact quota, entitlement or fraud decisions.
- Requiring a Melo login and thereby breaking Google Play purchase restore for signed-out users.
- Designing Play Integrity attestation, device identity or a complete account-linking system in this
  patch.
- Changing product tiers, grant claims, offline grace, acknowledgement semantics or provider OAuth.
- A service rewrite, new repository or third-party rate-limit dependency.

## Git workflow

- Branch: `advisor/010-play-verification-abuse-controls`, based on the reviewed result of plan 009.
- Commit example: `fix(billing): harden public Play verification`.
- Do not push, deploy, create Cloudflare resources or set secrets without separate authorization.
- Never commit a real service-account key, signing private key, purchase token or IP-derived sample.

## Steps

### Step 1: Add an independent, fail-closed public route switch

Add `BILLING_PUBLIC_VERIFICATION_ENABLED` as a non-secret Worker variable with checked-in value
`false`. Parse it strictly: only exact trimmed lowercase `true` enables the POST route.

Check the switch immediately after route/method matching and before provider/signer configuration,
body parsing or abuse-limit calls. When disabled, return a generic 503 such as
`verification_unavailable`; do not reveal which credential or binding is absent. Keep `/health` and
the public JWKS route available, but make health report `publicVerificationEnabled: false` without
echoing raw environment values.

Production enablement must remain a separate operator action after this plan's tests, Cloudflare
bindings, monitoring and release evidence are approved. Provider credentials must never implicitly
enable the public route.

### Step 2: Add Cloudflare-native source and purchase limits

Add two Rate Limiting bindings to `wrangler.jsonc`:

- `VERIFY_SOURCE_RATE_LIMITER`: a coarse per-source burst limit before reading the body;
- `VERIFY_PURCHASE_RATE_LIMITER`: a tighter product-plus-purchase limit after bounded validation but
  before `provider.verify`.

The executor must obtain two unique numeric `namespace_id` values from the Cloudflare account owner.
Do not invent, copy from another service or reuse an ID. Choose initial limits with the owner from
expected restore/retry behavior; record the values and rationale in the service README. Use only
Cloudflare-supported periods and keep both limits loose enough for legitimate reinstall/restore.

Derive keys as follows:

- source key: SHA-256 of a fixed version label plus Cloudflare's trusted connecting-IP value;
- purchase key: SHA-256 of a fixed version label, validated `productId` and `purchaseToken`.

Never send or log the raw IP or purchase token, and never use raw token text as a limiter key. The
source limiter is not the only control because mobile networks share IPs; the purchase limiter is not
the only control because an attacker can rotate invalid tokens. Missing connecting-IP on the public
Cloudflare path, missing binding, thrown limiter calls or malformed limiter results must fail closed
without calling Google.

After editing bindings, run `pnpm --filter @melo/billing-entitlements types` and use the generated
`Env` binding types. Do not hand-maintain a competing ambient binding declaration.

### Step 3: Reuse the existing handler injection seam

Pass the two generated Cloudflare `RateLimit` bindings directly into `handleRequest` alongside the
existing store/provider/signer dependencies. Type the parameters with the generated binding type (or
the smallest `Pick` needed by tests); do not add a one-implementation abuse-control interface,
factory or middleware framework.

Keep hashing/key composition in a pure or directly testable helper. Unit tests can inject tiny objects
whose `limit` function returns allow, deny or throws, just as they already inject provider and signer.
Health, CORS and JWKS do not need the verification limiters.

### Step 4: Enforce the 8 KiB limit on bytes actually read

Replace `request.json()` with a bounded streaming reader:

1. reject a declared `Content-Length` above 8192 early, but never trust a smaller/missing value;
2. require an acceptable JSON content type for the POST;
3. read `request.body` chunks with a reader while counting actual bytes;
4. as soon as cumulative bytes exceed 8192, cancel the reader and return 413;
5. decode with fatal UTF-8 handling and reject invalid encoding;
6. parse JSON once and require a plain object, returning the existing generic invalid-request shape
   for malformed JSON, arrays or scalars.

Do not concatenate unbounded strings and then check length. Bound bytes, not JavaScript character
count. Keep the 8 KiB constant named and co-located with the reader.

### Step 5: Order controls before expensive or state-changing provider work

The verification path must execute in this order:

1. exact route/method and public-switch check;
2. source abuse decision;
3. bounded body read and structural validation;
4. existing product/token validation;
5. purchase abuse decision;
6. provider/signer readiness check if it has not already been reduced to a cheap, side-effect-free
   local check;
7. Google verify, grant signing, optional acknowledgement and KV write.

Return 429 with a generic body, `cache-control: no-store`, and a conservative `Retry-After` aligned to
the configured period when either limiter denies. Do not disclose whether the source or purchase
limit fired. Ensure CORS headers follow the existing allowlist logic.

Return 503 on limiter/binding failure and emit one structured log event containing route, decision
stage and a stable error code only. Never log headers, bodies, IPs, tokens, limiter keys, grants or
provider credential material.

### Step 6: Add adversarial request tests

Extend `index.test.ts` with injected limiter functions. Cover at minimum:

- switch absent/false/malformed: 503 and neither limiter nor provider called;
- enabled with missing/throwing abuse control: fail closed and provider not called;
- declared body above 8192: 413;
- missing `Content-Length` with a streamed body above 8192: 413;
- chunked/false small `Content-Length` with actual bytes above 8192: 413;
- exactly 8192 bytes or a normal valid request: progresses to validation without truncation;
- invalid UTF-8, malformed JSON, scalar/array JSON and wrong content type: rejected without provider;
- source denial: 429 before body/provider work;
- purchase denial: 429 after validation and before provider work;
- allowed request: existing verify/sign/acknowledge/store behavior remains intact;
- limiter keys are fixed-length hashes and do not contain the raw token, product/token concatenation
  or raw IP;
- health exposes only boolean readiness, not binding details or secrets.

Use constructed `ReadableStream<Uint8Array>` bodies for missing/chunked-length cases. Do not allocate
an unbounded test body.

### Step 7: Define the public enablement gate without deploying

Update the service README and C14 release evidence with:

- the switch and both binding names;
- chosen limits/periods and their restore-friendly rationale;
- 429 and 503 monitoring fields and alert thresholds owned by operations;
- proof that no raw identifier is logged;
- the dry-run, focused-test and typecheck results;
- a statement that rate limiting is permissive/eventually consistent and is defence-in-depth, not
  exact purchase accounting;
- the remaining manual steps to provision namespace IDs, configure secrets, deploy disabled, observe
  health, run a controlled verification, then enable deliberately.

If the security review decides rate limiting is insufficient for public verification, keep the switch
false and create a separate Play Integrity/account binding design. Do not bolt fragile device IDs or
mandatory Melo login onto purchase restore in this plan.

## Test plan

- Unit: strict switch parsing, bounded byte reader, UTF-8/JSON validation, hash key composition and
  fail-closed binding behavior.
- Handler: denial/error paths prove zero provider calls; allowed path preserves grant and KV behavior.
- Adversarial: dishonest/missing lengths, streaming over-limit data, malformed inputs and rotating
  source/purchase dimensions.
- Configuration: generated Worker types contain both Rate Limit bindings; dry-run bundle succeeds.
- Privacy: test logs/response bodies never include raw purchase token, limiter key, IP or secrets.
- Full: service typecheck, focused Vitest and `pnpm run ci` pass with the public switch false.

## Done criteria

- [x] Public verification is independently default-off and provider credentials cannot turn it on.
- [x] Actual request bytes are capped at 8192 for declared, missing and chunked lengths.
- [x] Source and hashed purchase limits run before every Google verify/acknowledge call.
- [x] Missing, failed or denied controls fail closed with stable generic responses.
- [x] No raw purchase token or IP enters rate-limit keys, logs, responses or durable storage.
- [x] Legitimate existing verification/grant/restore behavior remains green when controls allow it.
- [x] Wrangler types and dry-run bundle pass; documentation records namespace/operator prerequisites.
- [x] No deployment or public enablement occurred as part of implementation.

## Execution evidence — 2026-08-17

- Account owner confirmed unique rate-limit namespaces `21001` and `21002`, with source 300/60 s
  and purchase 10/60 s limits respectively.
- Focused Worker suite: 1 file / 33 tests passed, including disabled/malformed switches, missing and
  failed controls, hashed keys, 429/503 behavior, invalid callers, 8,192-byte boundaries, dishonest
  lengths, invalid UTF-8/JSON, replay denial and the allowed grant/acknowledgement path.
- `wrangler types` generated both `RateLimit` bindings and the false switch; service typecheck passed.
- Wrangler dry-run passed at 60.28 KiB upload / 14.40 KiB gzip and reported the expected 300/60 s
  and 10/60 s bindings. The command used `--dry-run`; no version was uploaded or deployed.
- Full `pnpm run ci` passed with 242 Vitest files / 2,819 tests, all 45 companion Node tests and
  both source-package validators.
- Checked-in `BILLING_PUBLIC_VERIFICATION_ENABLED` remains `false`; no secrets, DNS, deployed Worker
  version or external release state changed.

## STOP conditions

- The Cloudflare account owner has not supplied two unique numeric rate-limit namespace IDs. Keep the
  switch false; do not insert placeholders into deployable configuration.
- A production environment has already enabled the route. Disable it or add an equivalent edge block
  before continuing with code changes.
- The endpoint has acquired account auth, Play Integrity or a gateway limiter that materially changes
  the threat model. Re-assess ordering and avoid double-limiting legitimate restores.
- The client restore flow needs more requests than the proposed limits allow and no measured retry
  profile exists. Measure first; do not guess a restrictive quota.
- Security review requires reliable global/exact enforcement. Cloudflare's permissive per-location
  binding cannot satisfy that property; keep public verification off and select an appropriate
  stateful design separately.
- Any proposed test, log or fixture includes a real purchase token, service-account key, signing key
  or raw client IP.

## Maintenance notes

- Review 429/503 rates and legitimate restore retries before tightening limits. A rate limit that
  blocks reinstall recovery is a billing correctness defect.
- Version limiter key prefixes when composition changes so old and new traffic are intentionally
  separated.
- Regenerate Worker types whenever bindings change and keep `wrangler.jsonc` as their authority.
- Revisit attestation/account binding only with an explicit restore and privacy design; do not treat
  the native client or CORS as authentication.

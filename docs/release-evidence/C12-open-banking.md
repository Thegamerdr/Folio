# C12 Open Banking

## Current result

Melo now has a provider-neutral Open Banking runtime foundation integrated into the current native
app. It is no longer only a synthetic Phase 12 shell. The implementation is deliberately deployed
without provider credentials, so the coded app can prove its honest unavailable and sign-in gates
without pretending a bank connection exists.

Open Banking remains optional. Manual entry and statement import work without an account, bank
connection or provider availability. Provider rows stage into the existing Review queue and never
write directly to the ledger.

This is not approval to release Open Banking. TrueLayer procurement, processor/legal/DPIA sign-off,
sandbox credentials, provider contract testing, a consent-journey pilot, production approval,
support/incident operations and staged rollout remain owner/external gates.

## Current implementation

- `services/open-banking`: deployed Cloudflare Worker targeting TrueLayer Data v3 hosted
  authorisation.
- `packages/open-banking`: provider-neutral response validation and bank-candidate staging.
- `apps/mobile/src/folio/lib/openBankingNative.ts`: authenticated native client and hosted browser
  hand-off.
- `apps/mobile/src/folio/sheets/BankConnectionSheet.tsx`: contextual consent explanation, account
  mapping, sync-to-Review, disconnect and separate local-history deletion choice.
- `apps/mobile/src/folio/store.ts`: bank-source records, provider-neutral external-ID deduplication,
  exact ignored-row suppression and connection-scoped imported-history deletion.
- `apps/mobile/src/folio/screens/ReviewScreen.tsx`: bank candidates use the same
  review-before-truth decision path as other semi-automatic sources.
- `apps/mobile/src/folio/screens/AccountScreen.tsx`: current Account surface exposes the optional,
  read-only bank connection entry point.

The old `apps/mobile/src/phase12` synthetic evidence shell is not the authoritative product UI and
is absent from the current app. Historical Phase 12 screenshots remain provenance only.

## Security and data boundary

- TrueLayer client credentials and application access tokens exist only in the Worker.
- The application token is cached only in Worker memory until expiry.
- Provider connection and account IDs are encrypted with AES-256-GCM before KV storage.
- KV user keys contain a SHA-256 digest of the Clerk user ID, not the raw ID.
- The checked-in mobile client sends only an opaque SHA-256 workspace reference. Worker indexes,
  records and OAuth callback state bind that scope; list, sync and disconnect reject a connection
  ID owned by another workspace under the same user.
- New provider-secret ciphertext authenticates the hashed user, workspace reference and local
  connection ID as AES-GCM associated data. Moving it to a different boundary fails decryption.
- Headerless historic clients and old account-level records map only to Personal. Account deletion
  lists and deletes the complete hashed-user prefix across every workspace.
- The mobile app receives stable provider-neutral aliases, not TrueLayer IDs or tokens.
- Imported rows are returned as candidates and require an explicit local-account mapping plus
  `Send to Review`.
- Disconnect removes encrypted provider identifiers and stops future Melo refresh.
- Local imported-history deletion is a separate explicit decision.
- The UI does not claim bank/provider consent was revoked because the current TrueLayer Data v3
  OpenAPI does not expose a connection-revocation endpoint.
- Unsupported non-GBP rows are left out and reported; they are never silently coerced.

## Deployed service evidence

- URL: `https://melo-open-banking.tgdroppin.workers.dev`
- Version: `68a50f69-b841-479f-97e6-75fdf10cf75d`
- KV namespace: `8735425468884de39f1eb5f273929c44`
- `GET /health`: HTTP 200, `configurationReady: true`, `providerConfigured: false`,
  `activationReady: false`, `featureEnabled: false`, `providerCredentialsInApp: false`, and
  `directLedgerWrites: false`.
- Dark-gated `GET /v1/connections`: HTTP 404 with `feature_disabled`, before authentication.

The checked-in service setup and owner actions are documented in `services/open-banking/README.md`.
The provider implementation was reconciled against the current TrueLayer Data v3 documentation:

- `https://docs.truelayer.com/docs/enable-your-users-to-connect-their-bank-account`
- `https://docs.truelayer.com/docs/create-a-connection-1`
- `https://docs.truelayer.com/reference/get-accounts`
- `https://truelayer.com/legal/`

The 2026-08-31 owner-account check confirmed that `wrangler secret list` returned no secrets. The
credential-independent hardened Worker was deployed as
`68a50f69-b841-479f-97e6-75fdf10cf75d`; a current dry run passed, `GET /health` reported valid
non-secret configuration while provider credentials and both activation gates remained off. No
sandbox or production bank was connected.

The workspace-bound Worker changes described above are now deployed. Credential-independent tests
also cover the current TrueLayer Data v3 request shape, official-host pinning, hostile hosted-page
URLs, callback replay/cancellation, workspace isolation, complete account purge, validated
`Tl-User-IP` forwarding, HTTPS-only mobile endpoints, and build-time fail-closed behavior. The
deployed version identifier above remains authoritative for the dark, unconfigured endpoint.

The current runtime requests only `accounts` and `transactions`. It does not request or retrieve
current balances, so no release or pricing claim may describe the current build as live-balance
refresh. The balance-contract work and activation matrix are tracked in
`docs/product-strategy/TRUELAYER_ACTIVATION_CHECKLIST.md`.

## Verification

Completed on 2026-08-31:

- 42 focused tests passed across the Worker, TrueLayer transport, provider-neutral package, mobile
  runtime client, mobile release gate and build configuration.
- Open Banking Worker, mobile/package, AI gateway, Cloud Vault and billing typechecks passed.
- `wrangler deploy --dry-run`: passed; uploaded bundle 99.54 KiB, gzip 22.69 KiB.
- `pnpm open-banking:preflight`: all credential-independent local and deployed checks passed; only
  the three named secret inputs reported `WAIT`.
- Dark-gated deployment: version `68a50f69-b841-479f-97e6-75fdf10cf75d`, startup 7 ms.

Completed on 2026-07-14:

- `pnpm typecheck`: passed, including mobile, package, AI gateway, cloud vault and Open Banking
  Worker.
- `pnpm exec vitest run apps/mobile/src/folio/store.test.ts packages/open-banking/test/open-banking.test.ts services/open-banking/src/index.test.ts --passWithNoTests`:
  passed, 3 files and 255 tests.
- Open Banking package: 13 tests passed.
- Worker: 4 tests passed, covering unconfigured health, encrypted storage round-trip, hosted
  callback/sync without plaintext provider identifiers and disconnect semantics.
- Mobile store: 238 tests passed, including bank external-ID dedupe, accepted/ignored suppression
  and connection-scoped history removal.
- `wrangler deploy --dry-run`: passed.
- Android `:app:assembleRelease -PreactNativeArchitectures=x86_64`: passed.
- Release APK installed only to `emulator-5554`: passed.

Additional 2026-07-15 workspace-isolation verification (checked-in version, not deployed):

- Worker: 8 tests passed, covering two workspace partitions under one user, cross-workspace
  sync/delete refusal, callback binding, invalid references, Personal-only legacy migration,
  account-wide purge and AES-GCM associated-data mismatch failure.
- Mobile and Worker typechecks passed after making all non-account-deletion Open Banking calls
  require a `WorkspaceId`.

## Current Android evidence

The current release bundle was exercised with an empty local account; no sample financial rows were
created.

- `artifacts/open-banking-proof/01-account.png`: Account surface shows a zero balance marked
  `not set yet`, the optional bank entry point and no connected-bank claim.
- `artifacts/open-banking-proof/02-bank-connection.png`: bank sheet explains the optional/read-only
  boundary, TrueLayer role, Review-before-truth path, sign-in requirement and manual fallback.
- `artifacts/open-banking-proof/account.xml`: Android accessibility tree for Account.
- `artifacts/open-banking-proof/bank.xml`: Android accessibility tree for the bank sheet.
- `artifacts/open-banking-proof/melo-open-banking-x86_64-release.apk`: exact emulator proof APK.

## Remaining release gates

1. Configure the dedicated Clerk instance for Melo's intended email-code/passwordless flow.
2. Complete TrueLayer procurement, processor terms, DPIA/privacy and production-use review.
3. Register the callback URI and set sandbox client credentials plus the server encryption key.
4. Decide whether the pilot is transaction-refresh only or implement and verify the balance
   contract before making live-balance claims.
5. Run sandbox contract tests against TrueLayer's live sandbox and capture the hosted consent flow.
6. Complete a controlled real-provider pilot, including reconnect/expiry and failure recovery.
7. Approve store declarations, support and incident runbooks, monitoring and staged rollout.

Until those gates close, the correct product state is `providerConfigured: false`; manual and file
import remain the release-capable paths.

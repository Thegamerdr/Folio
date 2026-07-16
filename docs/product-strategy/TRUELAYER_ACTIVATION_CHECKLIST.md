# TrueLayer activation checklist

Status: provider decision made; procurement and activation not complete. Last verified: 2026-07-15.

## Decision and launch order

Melo will pursue **TrueLayer Data v3** as the primary UK Open Banking provider through the
regulated AIS/agent route. **GoCardless Bank Account Data** is the fallback only if TrueLayer fails
a written commercial, account-coverage, regulatory or production-access gate. Building two live
provider integrations in parallel would add cost and failure modes before Melo has a measured
connected-user cohort.

Launch in this order:

1. Personal manual/on-device product, which remains usable without a Melo account or bank.
2. Personal Open Banking pilot with 25-50 invited UK users and an allow-listed set of banks.
3. Personal staged rollout after connection, refresh, consent and support targets pass.
4. Business-account pilot for UK sole traders and one-owner service businesses only after the
   TrueLayer Console confirms the required business-account coverage.

The personal pilot is for UK adults with month-to-month pressure, debt or irregular income who use
GBP current or savings accounts. The first business cohort is UK sole traders, freelancers and
owner-operators with a clearly separated business account. Payroll, inventory, multi-entity and
direct-tax-filing businesses are not the first cohort.

## What exists today

- The provider-neutral Worker is deployed at
  `https://melo-open-banking.tgdroppin.workers.dev` and uses TrueLayer's hosted Data v3 journey.
- The 2026-07-15 production check returned `providerConfigured: false` and the Worker secret list
  was empty. This is an honest unconfigured service, not a live bank integration.
- The current implementation requests `accounts` and `transactions`, fetches accounts and stages
  transaction rows into Review. It does **not** request or retrieve current balances.
- TrueLayer credentials remain server-side. Connection and provider-account identifiers are
  AES-256-GCM encrypted before KV storage; KV keys use a SHA-256 digest of the Melo user identity.
- Transaction rows pass through the Worker without server persistence. They do not become local
  ledger truth until the user maps an account and confirms them through Review.
- Disconnect and account deletion remove Melo's encrypted provider identifiers and stop future Melo
  refresh. The current adapter does not have a proven Data v3 provider-side consent-revocation
  endpoint, so it reports `providerRevocationSupported: false` rather than overstating deletion.
- Manual entry and on-device file reading remain available when banking is absent or unavailable.

The 2026-07-15 primary-document cross-check found that TrueLayer's Data v3 connection reference
lists `balance` as an allowed consent scope, while the public connected-accounts response does not
contain balances and the current Data v3 guide does not publish a stable connected-account balance
request contract. Melo therefore does not guess an endpoint or add a consent scope it cannot
exercise. The exact production request/response contract must be confirmed with TrueLayer before
the balance adapter is implemented.

Primary sources: [Data v3 create connection](https://docs.truelayer.com/docs/create-a-connection-1)
and [Data v3 connected accounts](https://docs.truelayer.com/docs/get-all-user-accounts).

## Commercial and regulatory acceptance gates

Obtain written answers from TrueLayer before adding credentials:

| Gate               | Required answer or evidence                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regulatory route   | Melo's PFM use case is accepted under the correct TrueLayer AIS agent/principal route, including the contracting entity and countries allowed.                      |
| Product permission | Data v3 recurring account-information access is approved for the intended personal pilot and later sole-trader cohort.                                              |
| Coverage           | Console export identifies supported UK providers, retail/business segments, account types, scopes, history depth, pending-row support and production release stage. |
| Pricing            | Written costs at 1k, 10k and 100k active connections, including minimums, refresh/request charges, sandbox, premium data and support.                               |
| Refresh behaviour  | Cache windows, reasonable-use limits, request state, retries, bank-specific limits, reconnection and consent-expiry behaviour are documented.                       |
| Data protection    | DPA, controller/processor roles, subprocessors, data locations, retention/deletion, security measures and incident-notification terms pass review.                  |
| User journey       | Hosted-flow branding, TrueLayer attribution, consent wording and reconfirmation requirements are approved for Melo's UI.                                            |
| Operations         | Sandbox parity, status/incident feeds, support SLA, escalation path and production-pilot approval are agreed.                                                       |

If the agent route is used, required TrueLayer role/transaction attribution is a regulatory journey
requirement. It is not a substitute for technical privacy controls and must not be presented as an
AI-data disclaimer.

## Provider-console and secret setup

Complete these owner-controlled actions only after the gates above pass:

1. Create a dedicated Melo application in the TrueLayer Console; do not reuse another product's
   credentials.
2. Register
   `https://melo-open-banking.tgdroppin.workers.dev/v1/callback` as the hosted-flow return URI.
3. Confirm the mobile deep link `folio://open-banking` on Android and iOS release builds.
4. Replace the Clerk development instance in `services/open-banking/wrangler.jsonc` with the
   dedicated Melo production issuer and JWKS URL before production rollout.
5. Set `TRUELAYER_CLIENT_ID` and `TRUELAYER_CLIENT_SECRET` using `wrangler secret put`; never place
   their values in source, app configuration, CI output, screenshots or documentation.
6. Generate a cryptographically random 32-byte encryption key, encode it as base64 and set it as
   `CONNECTION_ENCRYPTION_KEY` using `wrangler secret put`.
7. Document credential and encryption-key ownership, rotation, recovery and incident procedures.
   Rotating the encryption key requires an explicit stored-record migration or forced reconnect;
   silently replacing it would orphan existing connections.
8. Re-deploy, confirm `providerConfigured: true`, and run the sandbox matrix below before inviting a
   user.

## Required implementation before claiming live balances

The current runtime contract is transactions-only. If Melo's paid `Live` offer promises a current
bank balance, complete all of this first:

1. Obtain the applicable Data v3 balance request/response contract from TrueLayer, then add the
   balance scope and endpoint only after sandbox evidence confirms the documented shape.
2. Extend Worker, `@folio/open-banking`, mobile runtime validation and the bank sheet with a
   provider-neutral balance payload, currency, as-of time and stale/failed state.
3. Keep provider balance separate from user-confirmed local balance. Define whether it is an
   observation, a reconciliation suggestion or the selected present-balance source; never silently
   overwrite local truth.
4. Test multiple accounts, credit/overdraft signs, missing balances, non-GBP accounts, stale cache,
   partial provider failure and reconnect.
5. Update product copy, pricing and evidence only after the feature passes on a real bank.

Until then, `Live` can mean recurring transaction refresh only. It must not claim live balance
refresh.

## Sandbox contract matrix

All rows require captured request IDs, timestamps and redacted logs; no real financial fixtures in
the repository or runtime.

- hosted authorisation: success, user cancellation, bank cancellation, callback replay and expired
  state;
- identity: signed-in user, expired Clerk token, wrong issuer and one user's connection requested by
  another user;
- accounts: zero/one/many accounts, unsupported currency, deleted account, renamed account and
  provider-account reordering;
- transactions: first history, pagination, pending-to-posted transition, duplicate external ID,
  amended row, empty range, large history and partial-account failure;
- refresh: in-progress request, complete request, provider timeout, 429/backoff, stale cache,
  consent expiry and reconnection;
- review: account mapping required, no direct ledger writes, accept, ignore, duplicate suppression
  and Personal/Business destination isolation;
- disconnect: encrypted identifiers deleted, refresh no longer possible, local imported history
  retained by default and separately deletable;
- observability: no credentials, access tokens, provider IDs, transaction descriptions, balances or
  user identifiers in logs, traces, errors or analytics.

## Pilot controls and stop rules

- Invite 25-50 users only from the supported-provider allow-list; do not open a public waitlist into
  an unknown bank-coverage matrix.
- Provide manual and on-device import fallback throughout the pilot.
- Measure connection completion, time to first reviewed row, refresh success, stale-feed rate,
  duplicate/correction rate, reconnect success, support contacts and seven-/thirty-day retention.
- Stop new connections immediately for plaintext secret/provider-ID exposure, cross-user or
  cross-workspace leakage, unexplained ledger writes, ineffective disconnect, material consent
  misstatement or an uncontained provider incident.
- Promote beyond pilot only after security review, DPIA/legal approval, accessibility testing,
  incident/support runbooks and store data declarations match the exercised implementation.

## Fallback trigger

Evaluate GoCardless only if a TrueLayer gate fails in writing. The fallback spike must prove the
same server-side credentials, encrypted identifiers, no server transaction persistence,
review-before-truth and disconnect boundaries before it can replace TrueLayer. Compare account
coverage, consent duration, bank request limits, refresh reliability, support and total connected
user cost; do not select it merely because sandbox access is easier.

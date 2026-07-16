# Melo business and Open Banking decision

Status: product direction approved for implementation; provider procurement, regulatory onboarding
and live pilot approval remain external release gates. Last verified: 2026-07-15.

## One product, two clearly separated jobs

Melo launches around the personal job first: help UK adults who are living month to month, carrying
debt, dealing with uneven income or avoiding their finances understand whether their money will last
and what can move. Manual entry and on-device statement import remain complete without an account,
subscription or bank connection.

Business is the second workspace, not a generic SME dashboard and not a filter over personal data.
Its first customer is a UK sole trader, freelancer or owner-operator who already has the personal
money problem and now needs to keep business cash, receipts, invoices and tax preparation separate.
Payroll-heavy employers, inventory businesses, multi-entity groups and direct tax filing are not the
first release.

## Navigation and companion role

- Personal remains the default. Business creation is never part of mandatory first-run onboarding.
- The workspace switcher always says `Personal` or the business name; colour is not the only signal.
- Melo stays in the primary bar because the companion is a core product function. Switching
  workspace changes Melo's scoped local context; it does not remove Melo or turn it into a separate
  business chatbot.
- Personal and Business have distinct accounts, transactions, search, documents, plans, calendars,
  exports, encryption subkeys and companion memory.
- A transfer between them is two explicitly linked records, never an invisible cross-workspace row.

## Business MVP

The first sellable Business workspace contains:

1. create/rename/archive one business workspace;
2. add or connect business accounts without importing them into Personal;
3. review and classify business income/expenses;
4. capture receipts and retain their source link;
5. clients and invoice lifecycle, including overdue and expected-cash events;
6. proposed payment matching with confirmation for ambiguity;
7. dated cash-flow/runway and recurring commitments;
8. tax-period organisation, a user-controlled reserve estimate and unresolved-item queue;
9. business calendar/reminders;
10. accountant-ready CSV/JSON/PDF package with evidence, period and policy version;
11. business-scoped Melo summaries and what-if questions, computed locally;
12. manual mileage records.

Direct HMRC submission, payroll, inventory, double-entry accounting, accountant collaboration,
multiple businesses and payment initiation stay outside this MVP until their separate compliance,
permissions and support programmes are complete.

## Delivery sequence

| Stage                | Product outcome                                                     | Release gate                                                        |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Personal launch      | Local core, local companion, manual/on-device import                | Mobile release, privacy and accessibility gates                     |
| Live pilot           | Optional recurring bank refresh for Personal                        | TrueLayer contract, agent/regulatory route, DPIA, sandbox and pilot |
| Business alpha       | Real workspace creation, isolation, receipts, cash flow and exports | No synthetic/sample data in runtime; workspace attack suite         |
| Business beta        | Invoices, matching, tax preparation, support operations             | UK tax/legal review, entitlement, support and accessibility         |
| Compliance expansion | MTD/HMRC adapter or accountant access                               | Separate regulatory programme and conformance evidence              |

The existing `@folio/business-workspace` package proves pure contracts with synthetic tests. Its
workspace shape is now connected to the production mobile app through schema v11. Schema v9
establishes Personal ownership; schema v10 adds ownership to every independently addressable
AppState row, complete-row query guards and an explicit scoped row repository; schema v11 adds an
encrypted workspace manifest and real per-workspace partitions. Each partition has an authenticated
encrypted state file, an opaque SQLCipher filename and a distinct HKDF-derived database key.
Create/switch/rename/archive/restore and account-wide recovery/deletion preserve those boundaries.
Backup/recovery, Open Banking, notification runtime, companion cache/widget, export/restore and
native persistence entry points also require or cryptographically bind workspace ownership.

The old Phase 13 synthetic screens remain absent. The current app instead has a persistent labelled
workspace control plus genuine empty Business Today, More and Melo surfaces, with Melo still in the
primary navigation. This completes the isolation/lifecycle foundation, not the full Business alpha:
manual Business record intake, receipt evidence, dated cash flow, exports and device/accessibility
evidence remain to be completed. The production sequence is defined in
`MELO_BUSINESS_ALPHA_BUILD_PLAN.md`.

## Commercial model

- `Free`: useful personal safety layer, manual entry, on-device statement/photo reading and local
  Melo answers.
- `Full`: £29.99 one-time working price for zero-marginal-cost local software and every personal
  lens. Ownership is permanent.
- `Live`: £2.99/month or £24.99/year working price for recurring infrastructure only—automatic bank
  refresh and encrypted sync when available. It does not buy better financial reasoning.
- `Business`: recurring add-on because bank connectivity, storage, support and compliance are
  recurring costs. £9.99/month is the first willingness-to-pay test, not a store commitment. Final
  price waits for provider quotes and a unit-economics sheet using store fees, connected-account
  cost, support load, tax/legal cost and expected churn.
- A user who stops Live or Business retains local records and basic export. Subscription lapse stops
  recurring services; it does not ransom financial history.

The initial acquisition message is not “AI finance”. It is “know what will happen before payday”
for Personal and “keep business cash, receipts and tax preparation out of your personal mess” for
Business.

## Open Banking provider decision

Primary provider: **TrueLayer Data API v3**, through TrueLayer's regulated AIS/agent route rather
than Melo seeking direct AISP registration for the first launch.

This is not only a paper preference. `services/open-banking` already implements the Data v3
connection, hosted authorisation, account and transaction request flow. It holds client credentials
server-side, encrypts connection/account identifiers with AES-256-GCM before KV storage, hashes the
Melo user key, uses an opaque SHA-256 workspace reference in its storage path and callback state,
and authenticates new ciphertext to the hashed user/workspace/connection as associated data. Lists,
sync and disconnect are workspace-owned; account deletion enumerates the full user prefix. Provider
rows still stage into Review and disconnect deletes encrypted provider identifiers.

That workspace-isolated Worker change is checked in and tested but has not been deployed. The last
deployed Worker remains deliberately provider-unconfigured, and no Personal or Business bank was
connected during this pass.

TrueLayer remains conditional on all of these commercial gates:

- written confirmation that Melo can launch under the correct TrueLayer AIS agent/principal model;
- Data v3 production access for personal-finance management;
- UK bank and account-type coverage needed by the pilot, including sole-trader/business accounts;
- pricing at 1k, 10k and 100k active connections plus refresh limits;
- DPA, subprocessor, residency, retention, incident and deletion terms;
- hosted-flow branding/consent approval and reconfirmation behaviour;
- sandbox parity, support SLA, outage/webhook behaviour and production pilot approval.

The checked-in Worker currently requests only `accounts` and `transactions`; it does not retrieve a
current balance. Therefore `Live` means recurring transaction refresh only until a provider-neutral
balance contract, truth/reconciliation rules and real-bank evidence are implemented. TrueLayer
documents Data v3 as UK-only with a hosted authorisation option for unregulated clients, recurring
access and consent reconfirmation. Its current connection reference lists a `balance` consent scope,
but the public Data v3 account response does not expose a stable balance request shape. Melo will not
guess that provider contract or claim live balances before TrueLayer confirms and the sandbox proves
it.
Sources: [Data v3 connection guide](https://docs.truelayer.com/docs/enable-your-users-to-connect-their-bank-account),
[create connection](https://docs.truelayer.com/docs/create-a-connection-1),
[connections and consent](https://docs.truelayer.com/docs/connections), and
[TrueLayer regulatory route](https://support.truelayer.com/hc/en-us/articles/4410221228049-What-does-being-regulated-mean).

Fallback provider: **GoCardless Bank Account Data**, activated only if TrueLayer fails a commercial,
coverage or production-access gate. Its official API documents accounts, balances, transactions,
up to 24 months of history and up to 90 days of continuous access; premium enrichment is separately
priced. Sources: [Bank Account Data overview](https://developer.gocardless.com/bank-account-data/overview)
and [enriched data](https://developer.gocardless.com/bank-account-data/enriched-bank-data-overview/).

Moneyhub remains a later benchmark for broader Open Finance/PFM capability, not a parallel launch
integration. Melo keeps the `BankDataProvider` boundary so changing provider does not rewrite the
domain or review flow.

The exact procurement, secret setup, sandbox matrix and pilot stop rules are defined in
`TRUELAYER_ACTIVATION_CHECKLIST.md`.

## Data and privacy boundary

The bank/AISP necessarily processes the accounts and transaction data a user authorises; encryption
cannot hide data from a provider that must retrieve it. Melo minimises that exposure through narrow
scopes, user-selected accounts and the regulated hosted journey. Provider credentials and access
identifiers never enter the app. The Worker processes fetched rows long enough to normalise and
deliver them, does not persist transaction rows, and stores only encrypted provider identifiers.
The signed-in account is not the data partition: the mobile client supplies an opaque workspace
reference, OAuth return state binds it, and a connection ID from one workspace is not readable,
refreshable or disconnectable from another.

Bank rows remain provider-reported candidates. They never write directly to the local ledger, and
Personal/Business assignment must be explicit before confirmation.

## Launch metrics and stop rules

Measure time to first real money picture, first-week return, successful/failed bank connection,
stale-feed rate, review correction rate, Personal/Business leakage defects, export completion,
support contacts per connected user and paid retention. Stop the pilot on any plaintext provider
credential, cross-workspace leak, unexplained transaction write, ineffective disconnect, consent
misstatement or provider incident that cannot be contained and communicated.

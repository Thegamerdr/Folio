# Open Banking and Permission Architecture

## Product position

Open Banking is an optional automation adapter, not the foundation of Folio. A user can receive core value through manual quick start and imports.

## Regulatory delivery model

For initial UK launch, integrate through a regulated Account Information Service provider rather than attempting direct authorisation before product-market fit. Encapsulate the provider behind `BankDataProvider` so Folio can replace or add providers without rewriting the domain.

A direct AISP path is a later company/regulatory programme, not an engineering shortcut.

## Consent principles

- Request only the data permissions needed for the feature the user selected.
- Explain why, what data, which accounts and how long.
- Let the user choose eligible accounts at the bank/provider journey.
- Do not promise arbitrary “pot-only” access if the bank/provider permission model does not expose it.
- Show an in-app consent dashboard with provider, accounts, scopes, expiry/reconfirmation and revoke control.
- Revocation stops future access; locally retained data is separately controlled.

## Permission timing

No Open Banking prompt on first launch. Prompt only after the user chooses “connect a bank” and sees the privacy explanation.

Likewise:

- camera permission only when capturing a document;
- microphone only when using voice;
- notification permission after the user creates a useful reminder or sees the value;
- calendar access only when enabling system calendar integration;
- biometric access only when enabling app lock.

## Data flow

```text
user selects connect bank
→ Folio creates consent request with provider
→ provider/bank authentication and account selection
→ callback/token held by secure backend adapter
→ provider data normalised to canonical import records
→ encrypted/minimised delivery to device
→ local reconciliation/review
→ local domain commit
```

Long-lived bank tokens must not live in the JavaScript bundle or ordinary local preferences. Server components store provider tokens encrypted with tightly controlled access and retrieve only for the user-authorised service.

## Refresh and gaps

- Track consent expiry/reconfirmation.
- Detect missing date ranges and provider outages.
- Mark delayed data clearly.
- Do not assume bank feed equals real-time final truth; pending/posted state matters.
- Reconcile provider transaction IDs and pending replacements.
- Allow CSV/manual gap filling without duplicates.

## User controls

- pause connection;
- revoke consent;
- remove one account;
- stop future sync while retaining imported history;
- delete imported history from Folio;
- reconnect through another provider;
- see last successful update and current data scope.

## Provider selection criteria

Evaluate:

- regulated status and UK coverage;
- account and transaction scope;
- consent UX and refresh behavior;
- pending/posted quality;
- webhook/reliability guarantees;
- sandbox quality;
- pricing at 1k/10k/100k connected accounts;
- data residency and processor terms;
- token security and incident history;
- business/SME account support;
- exportability and vendor lock-in.

Do not select solely on the cheapest headline price.

## Acceptance gates

- Manual/import-only mode remains complete.
- A revoked consent produces no further provider access.
- Account selection is faithfully represented.
- Personal and business bank accounts cannot silently enter the wrong workspace.
- Provider outage does not corrupt forecasts; stale state is visible.
- No raw provider token appears in client logs or database exports.

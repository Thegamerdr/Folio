# Security, Privacy and Threat Model

## Security objective

Protect a high-sensitivity financial record without making the user surrender ownership or live permanently online.

The security programme should target OWASP MASVS controls for storage, cryptography, authentication, network, platform, code and privacy, with a documented threat model and independent review before public launch.

## Assets

Highest sensitivity:

- transaction and balance history;
- debts, income and obligations;
- personal/business documents;
- tax records and invoices;
- account and Open Banking tokens;
- vault and recovery keys;
- Melo memory and conversation content;
- notification text.

## Threat actors and failures

- lost or stolen unlocked/locked device;
- malicious app or clipboard/screenshot leakage;
- compromised cloud account;
- backend breach;
- rogue administrator;
- compromised dependency/build pipeline;
- rooted/jailbroken device;
- insecure backups/logging;
- import file attacks;
- prompt injection in imported documents;
- model/provider data leakage;
- accidental personal/business mixing;
- destructive sync conflict;
- social-engineering recovery attempt.

## Local encryption

- SQLCipher-encrypted SQLite database.
- Separate encrypted document files; never store large source files as unencrypted blobs.
- Random vault key; no hardcoded keys.
- Platform Keychain/Keystore protects wrapping keys.
- Biometric/app PIN can gate unwrapping, but biometrics are not the vault key.
- Sensitive data excluded from app switcher previews where practical.
- Clipboard export is explicit and time-limited where supported.

A native crypto module should use platform primitives rather than JavaScript cryptography for root key handling.

## App lock

User-selectable:

- immediate;
- after short timeout;
- after device lock;
- never (with clear warning).

Offer biometric unlock with device credential fallback. Do not lock a user out of data solely because biometric enrollment changed; use a recovery route.

## Network security

- TLS only;
- strict certificate validation;
- short-lived service tokens;
- server-side cloud AI keys;
- no secrets in the mobile bundle;
- request signing or DPoP-style proof considered for high-risk endpoints;
- rate limiting, replay protection and idempotency keys;
- explicit egress allow-list for sensitive modules.

Certificate pinning is a threat-model decision, not a default checkbox, because operational failure can strand users. Document the choice.

## Import and document sandboxing

- Copy selected files into private app storage.
- Enforce MIME/content sniffing, size/page limits and decompression limits.
- Parse in isolated worker/native boundary where feasible.
- Reject executable content and unsafe embedded links.
- Treat document text as untrusted data, never model/system instructions.
- No automatic action derived from document content.

## AI privacy

- Deterministic/local route first.
- Send only the minimum structured context needed for the selected task.
- Never send the full vault by default.
- No provider training on user data by product policy.
- Redact identifiers when they are not required.
- Show cloud badge/consent before first cloud AI use.
- Cloud request/response retention is configurable and documented.
- Model output cannot bypass typed proposal validation.

## Telemetry

Default telemetry contains no amounts, merchant text, plan names, notes, document content or conversation text.

Use:

- OS/App Store aggregate diagnostics;
- local performance counters;
- explicit opt-in sanitised diagnostic bundle;
- event names with coarse, non-financial properties.

A support export must show exactly what will be shared.

## Privacy programme

Before launch:

- complete a UK GDPR DPIA;
- maintain a record of processing activities;
- define controller/processor roles for every cloud provider;
- execute DPAs and international-transfer assessment where relevant;
- publish plain-language privacy controls;
- maintain Apple privacy details and Google Data Safety declarations;
- implement access/export/deletion requests;
- test consent withdrawal.

Initial product scope should be adults. A youth/child version requires a separate age-appropriate design and legal review.

## Workspace isolation

Every domain query and mutation requires workspace scope. Business tax exports query only business workspace IDs. Personal and business document encryption keys are separate subkeys. Cross-workspace moves are explicit, audited and reversible.

## Security release gates

- Mobile threat model reviewed.
- MASVS checklist completed at agreed level.
- Dependency and secret scanning clean.
- Static/dynamic mobile security tests complete.
- Database migration and restore drills pass.
- Penetration test for auth/sync/cloud gateway.
- Cryptographic design reviewed by a qualified specialist.
- No high/critical finding open.
- Incident response and key-rotation runbook exercised.

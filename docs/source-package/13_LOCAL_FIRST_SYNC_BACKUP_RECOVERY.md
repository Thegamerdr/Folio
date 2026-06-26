# Local-First, Cloud Sync, Backup and Recovery

## Ownership model

> The user owns the data. Folio provides optional services.

The local encrypted vault is authoritative. An account, internet connection or cloud subscription is not required to use the personal core.

## Three operating modes

### 1. Local-only

- no Folio account;
- no server-held financial payload;
- manual encrypted export and device backup options;
- all core functions available.

### 2. Local + encrypted backup

- account authenticates the person to the backup service;
- server stores opaque encrypted vault snapshots and minimal routing metadata;
- restore requires a vault recovery method, not merely account login.

### 3. Local + encrypted multi-device sync

- each device has a local vault;
- encrypted operation envelopes sync through the service;
- deterministic merge/conflict policy;
- single-user multi-device at launch;
- household/accountant collaboration deferred.

## Authentication is not decryption

Apple/Google/passkey sign-in proves account access. It must not be the sole encryption-key recovery path.

Recommended key hierarchy:

```text
random 256-bit vault master key
├── personal workspace subkey
├── each business workspace subkey
├── document subkey(s)
└── sync envelope key
```

The master key is wrapped locally by a platform-protected key in Keychain/Android Keystore. Optional recovery uses a separate recovery secret/passphrase hardened with Argon2id and/or a printed recovery code.

The server does not receive an unwrapped vault key.

## Recovery options

During cloud enablement the user chooses at least one:

- device-to-device transfer;
- recovery code;
- recovery passphrase;
- trusted recovery device.

Explain the trade-off plainly: a zero-knowledge service cannot restore data without a valid recovery method.

Recovery flow must be tested before Folio claims a backup is protected. A periodic, optional “verify recovery” ritual can confirm that the user still has access without exposing the secret.

## Sync model

Every local mutation creates:

- domain command result;
- append-only operation record;
- monotonically ordered local sequence;
- entity version/HLC timestamp;
- encrypted outbox envelope.

The service stores and relays opaque envelopes. Devices apply operations idempotently.

### Conflict policy

- Posted transactions: preserve both; use explicit duplicate/reversal workflow.
- User edits to descriptive metadata: field-level last accepted version, preserving conflict history.
- Plans: merge non-overlapping fields; otherwise ask the user.
- Calendar/task completion: monotonic completed state unless reopened explicitly.
- Recurring rules: conflicting schedule/amount edits require review.
- Deletes: tombstone, grace period, then compaction.
- Workspace assignment: never auto-merge across personal/business.

Do not use “last write wins” as a universal policy.

## Snapshot and compaction

- Periodic encrypted snapshots shorten restore time.
- Operation history is compacted only after all registered active devices acknowledge a safe point.
- Old inactive devices are revoked through an explicit device manager.
- Revocation rotates sync keys for future envelopes.

## Cloud metadata minimisation

Permitted service metadata:

- account ID;
- device ID/public key;
- encrypted blob IDs;
- sequence and size;
- creation/expiry timestamps;
- entitlement and consent state;
- coarse operational metrics.

Avoid merchant names, amounts, categories, plan titles, document text and calendar details outside encrypted payloads.

## Backup behavior

- Atomic snapshot before schema migration.
- Validate backup hash and decryptability locally before marking successful.
- Keep at least two generations for corruption recovery.
- User can export an encrypted portable backup independent of Folio cloud.
- Never rely solely on iOS/Android automatic app backup because platform limits and key-restoration behavior vary.

## Account deletion

Account deletion is available in-app and through the required web path where applicable. The user chooses:

- delete cloud account and ciphertext but keep local vault;
- export then delete everything;
- delete a single device registration;
- delete a business workspace only.

Deletion is confirmed, queued with a short reversible grace period where lawful, then cryptographically and physically purged according to the published schedule.

## Failure behavior

If sync fails:

- local work continues;
- Today briefing shows a quiet sync state, not an alarm unless backup risk grows;
- retry uses exponential backoff;
- the app never blocks on cloud;
- no silent rollback to older cloud state.

## Acceptance gates

- Fresh install restores from snapshot + operations without plaintext server access.
- Loss of account session alone cannot decrypt a vault.
- Loss of one device does not prevent recovery when the selected recovery method exists.
- Simultaneous offline edits produce deterministic, reviewable outcomes.
- Cloud outage does not affect core calculations.

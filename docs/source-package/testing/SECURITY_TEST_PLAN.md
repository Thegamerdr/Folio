# Security Test Plan

## Scope

Mobile app, local vault, documents, importers, sync/cloud services, AI gateway, Open Banking adapter, account portal and build/release pipeline.

## Required test classes

### Local data protection

- database cannot open without valid key;
- no key/plaintext financial data in app files, logs, screenshots, clipboard or backups;
- document blobs encrypted independently;
- key wrapping uses Keychain/Keystore and invalidation behavior is handled;
- lock on configured inactivity/background state;
- biometric fallback/recovery paths tested;
- rooted/jailbroken device policy documented without falsely promising prevention.

### Cryptography/recovery

- unique random vault keys;
- subkey derivation and rotation;
- recovery secret KDF parameters benchmarked;
- wrong/reused/revoked recovery material fails safely;
- recovery does not reveal keys to server;
- lost-device revocation and new-device restore drill;
- corrupted/partial backup and rollback handling;
- cryptographic design reviewed by qualified specialist.

### Database and files

- SQL injection and malformed query inputs;
- migration interruption;
- WAL/temporary file encryption verification;
- path traversal/zip bombs/oversized imports;
- malicious CSV formula content;
- PDF/image parser hardening;
- FTS index isolation and secure deletion limitations documented.

### Authentication/session

- account optional for local core;
- token theft/replay/rotation;
- device registration and revocation;
- account enumeration and brute-force controls;
- OAuth redirect/deep-link validation;
- session separation from local vault unlock;
- account deletion does not silently destroy unrecovered local data.

### Sync/cloud

- server cannot decrypt test envelope;
- tenant/user/workspace authorization;
- replay, rollback and duplicate envelope handling;
- conflict/tombstone abuse;
- object-store URL expiry;
- metadata minimisation;
- backup integrity/authenticity;
- cross-device clock/revision attacks;
- service compromise tabletop.

### Workspace isolation

- personal/business repository queries fail closed;
- FTS/Melo/AI retrieval scope;
- export/tax/document/calendar isolation;
- cache, notification and analytics isolation;
- explicit audited cross-workspace movement only.

### AI/OCR/import injection

- prompt injection in statements, receipts and documents;
- model output schema bypass;
- tool/SQL command injection;
- sensitive-context overcollection;
- provider retention/training settings;
- no direct writes;
- quota/rate-limit evasion;
- unsafe advice-language red-team set.

### Network/API

- TLS configuration and certificate validation;
- authorization on every endpoint;
- object-level access control;
- rate limits/abuse controls;
- webhook signatures and replay protection;
- Open Banking token storage/rotation/revocation;
- AI gateway key secrecy;
- secure headers and deletion portal testing.

### Supply chain/build

- dependency/lockfile review;
- secrets scan and signed CI artifacts;
- least-privilege CI credentials;
- SBOM and licence register;
- native module provenance;
- OTA compatibility/native-version gate;
- production debug tooling disabled;
- store signing/release key controls.

## Privacy tests

- network capture proves no undeclared financial telemetry;
- crash reports contain synthetic/sanitised context only;
- diagnostic bundle preview/redaction;
- cloud/AI permissions revocable;
- export and deletion completeness;
- retention jobs verified;
- model-provider deletion tested where applicable.

## Test cadence

- automated security checks every CI run;
- dependency/SAST/secret scans continuously;
- threat-model update per major feature;
- independent mobile/API penetration test before public launch and major cloud/Open Banking changes;
- annual or risk-triggered cryptographic review;
- incident tabletop twice yearly.

## Release blockers

Any critical/high issue affecting confidentiality, integrity, workspace isolation, key recovery, data loss or unauthorised financial action blocks release. Medium issues require owner, compensating control and dated remediation.

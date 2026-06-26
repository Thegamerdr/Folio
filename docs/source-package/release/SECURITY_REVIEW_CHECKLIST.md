# Security Review Checklist

## Architecture
- [ ] Current threat model reviewed.
- [ ] Data-flow/trust-boundary diagram matches code.
- [ ] Personal/business isolation tested below UI.
- [ ] Cloud service cannot decrypt sample vault.

## Storage and keys
- [ ] SQLCipher enabled in production binaries.
- [ ] Database key never stored in plain preferences/JS bundle.
- [ ] Keychain/Keystore access controls reviewed.
- [ ] Encrypted document storage tested.
- [ ] Recovery code/passphrase flow and rotation tested.
- [ ] Logs, crash reports and backups checked for leakage.

## Network/backend
- [ ] TLS and token handling reviewed.
- [ ] API rate limits/idempotency/replay controls tested.
- [ ] AI/Open Banking secrets server-side.
- [ ] Least-privilege service roles.
- [ ] Account/device revoke and key rotation tested.

## Input/AI
- [ ] Malicious CSV/PDF/image corpus tested.
- [ ] Decompression/size/page limits enforced.
- [ ] Prompt injection cannot call tools or commit records.
- [ ] Model output schema and advice policy enforced.

## Supply chain/release
- [ ] Lockfiles, SBOM and dependency scan produced.
- [ ] Signing/CI secrets protected.
- [ ] Native dependency provenance reviewed.
- [ ] OTA/native compatibility guard enabled.
- [ ] Penetration test complete; no high/critical open.

## Operations
- [ ] Incident response and breach notification runbook.
- [ ] Key/provider/model rotation drills.
- [ ] Secure support diagnostic workflow.
- [ ] Vulnerability disclosure channel.

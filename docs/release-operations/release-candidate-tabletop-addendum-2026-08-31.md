# Release-candidate operations tabletop addendum — 31 August 2026

This addendum revalidated the existing internal tabletop against the current Melo release control
plane and Android candidate. It is internal evidence only; it does not approve production support,
legal notification, independent security review or store release.

## Evidence used

- Candidate: `release-artifacts/melo-0.0.1-2026-08-24/melo-0.0.1-1-production.aab`
- Candidate SHA-256: `6023B1A455907739B5EB6D7ABEA26B19212ADABF308170510ED2A50EB3E2A999`
- `pnpm release:status`
- `pnpm store:status`
- `pnpm operations:status`
- `docs/release-operations/incident-support-runbook.md`
- `docs/release-operations/rotation-drill-record.md`

## Exercise record

| Injected scenario                        | Detection                                            | Containment/correction                                                                      | Communication and closure                                                                            |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Wrong safe-to-spend or tax calculation   | Compare source event, policy-pack and binary version | Freeze affected path, recompute from source, retain correction row; rollback if binary-wide | Notify affected users; close after recomputation and notice evidence                                 |
| Corrupt local state or interrupted write | Startup integrity/recovery-generation signal         | Keep verified generation, quarantine unreadable family, offer restore/export                | Explain recoverable action without requesting secrets; close after verified launch or explicit error |
| Cloud/provider outage                    | Health timeout or stale-refresh signal               | Bound retries, mark backup/provider stale, preserve local/manual import                     | Explain local data is unchanged; close after health and backup/provider metadata recover             |
| Billing incident                         | Purchase/verification mismatch or pending state      | Stop grant issuance, preserve local core, replay only verified transactions                 | Explain store restoration route; close after provider verification and restore checks                |
| AI/provider incident                     | Unsafe output, schema rejection or provider failure  | Disable optional route; keep deterministic local flow                                       | Say wording service is unavailable without exposing prompts; close after policy/schema suites        |
| Tax/business policy issue                | Policy version/jurisdiction mismatch                 | Freeze policy pack and label estimates for review                                           | Provide source/effective-date correction note; close after reviewed export                           |
| Security/privacy incident                | Redacted diagnostic/access/boundary alert            | Contain, revoke/rotate, preserve minimal evidence and assess notification                   | Use owner-confirmed disclosure route only; close after containment and notification decision         |
| Bad store release/removal                | Console warning, crash spike or declaration mismatch | Halt rollout, identify hash/metadata and rollback where possible                            | Explain affected build and local export path; close after corrected declaration match                |

## Result

All eight required incident classes have a detection signal, named internal owner in the runbook,
containment/correction path, communication rule and closure criterion. The internal tabletop is
therefore complete. Production support and public vulnerability disclosure remain blocked until the
owner confirms an existing contact route; no address is fabricated.

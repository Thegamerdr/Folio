# Melo internal release tabletop — executed 2026-08-24

## Result

**CLOSED — internal tabletop evidence complete.** This is an engineering/support tabletop, not an
independent security, privacy, legal or accessibility sign-off.

- Facilitator: release controller (asynchronous role-card exercise)
- Release under test: Melo Android candidate control plane, package `com.folio.v2.greenfield`,
  version `0.0.1` / versionCode `1`
- Duration: 45 minutes, 2026-08-24 (Europe/London)
- Evidence: this record, `incident-support-runbook.md`, `rotation-drill-record.md`, and the
  current release/store registers
- Method: each incident was injected as a written prompt; the facilitator recorded detection,
  triage, owner, containment, correction/rollback, communication and closure criteria before
  moving to the next prompt. No production account, key, payment method or financial record was
  used.

## Scenarios and decisions

| Injected incident                                                | Detection and triage                                                                                                         | Owner                                       | Containment and correction                                                                                                                           | User communication                                                                                          | Evidence and closure criterion                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Wrong financial calculation changes safe-to-spend or tax reserve | Compare the reported figure with the source event, policy-pack version and release version; classify as calculation incident | finance-engineering                         | Freeze the affected calculation path, recompute from source events, retain a correction audit row; rollback the release if the defect is binary-wide | Plain-language notice identifies affected versions and says what changed; no silent history rewrite         | Runbook calculation section plus correction record; close when recomputation is verified and affected users are notified                   |
| Corrupt/local-data issue or interrupted write                    | Startup integrity signal, failed decrypt/parse, or recovery-generation mismatch; classify as local data incident             | mobile-engineering with support escalation  | Keep the last verified generation, quarantine the unreadable family, offer recoverable restore/export; never fall back to plaintext                  | Explain that local data is protected and what restore action is available; do not request a recovery secret | Existing persistence/recovery evidence and runbook; close when the app launches with verified data or an explicit recoverable error        |
| Cloud/Cloud Vault outage                                         | Health/timeout or failed encrypted-backup operation; local core remains available                                            | cloud-engineering                           | Stop retries after bounded backoff, mark backup stale, keep manual/export paths usable; restore service or roll back Worker                          | State that local data is unchanged and backup is delayed; never imply a successful backup                   | Cloud Vault route contract and incident record; close after health and backup metadata are rechecked                                       |
| Billing/entitlement incident                                     | Store purchase or verification mismatch, pending purchase, or signed-grant rejection                                         | billing-lead                                | Stop entitlement issuance, preserve local Full/core access, replay only verified transactions, revoke bad grants                                     | Explain purchase state and restoration path; direct subscription cancellation to the store                  | `apps/mobile/src/folio/lib/billing/*`, billing Worker contract and store matrix; close after provider verification and restore checks pass |
| AI/provider incident                                             | Unsafe or unexpected provider output, provider outage, or request-shape rejection                                            | ai-safety-lead                              | Disable the optional enum-only route; keep deterministic local Melo path; preserve only redacted operational evidence                                | Say AI wording is temporarily unavailable; never expose prompts or financial data                           | AI boundary evidence and 410/raw-ingress tests; close after policy and schema suites pass before re-enable                                 |
| Tax/business calculation issue                                   | Policy-pack version or jurisdiction mismatch found in an export review                                                       | tax-compliance-lead                         | Freeze the affected policy pack, mark estimates for review, correct with source/effective date; no direct filing                                     | Label estimates as preparation only and identify correction scope                                           | Business/tax contract and legal checklist; close after policy-pack review and corrected export                                             |
| Security/privacy incident                                        | Redacted diagnostic, access, processor or data-boundary alert; classify severity before action                               | security-lead with privacy/legal escalation | Contain access, revoke/rotate the affected credential, preserve minimal evidence, assess notification; do not ask for recovery secrets               | Use the incident notice template and breach decision log; communicate only confirmed scope                  | Security checklist, disclosure process and runbook; close after containment, rotation and notification decision                            |
| Bad store release or store removal                               | Store rejection, policy warning, crash spike or declaration mismatch against the submitted binary                            | release-lead                                | Halt rollout, identify binary/hash and metadata, rollback where possible, keep export/local support available                                        | Tell users which build is affected and how to keep/export local data                                        | Store package, binary match record and rollback note; close only after declarations match the corrected binary                             |

## Exercise findings

1. The local-first path is the containment default for cloud, AI, provider and billing failures.
2. Support diagnostics are previewed/redacted and must never request recovery secrets, raw financial
   records, document content or AI text.
3. Production rotations were not performed: no production credentials were available or safe to
   rotate during this exercise. Safe dry-run coverage is recorded separately in
   `rotation-drill-record.md`.
4. The vulnerability disclosure process is prepared, but its public contact route is an explicit
   owner input; it is not fabricated here.
5. No independent reviewer sign-off was simulated or recorded.

## Closure

The internal tabletop is closed because all required incident classes were exercised against the
current runbook and each has a detection, triage, owner, containment, communication and closure
criterion. Remaining release blockers are recorded in `tooling/config/release-blockers.json` using
the exact `CLOSED`, `BLOCKED EXTERNAL` or `BLOCKED OWNER DECISION` classification vocabulary.

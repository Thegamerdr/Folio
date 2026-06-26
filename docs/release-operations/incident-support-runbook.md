# Incident And Support Runbook

## Scope

This runbook covers release-blocking operations for calculation, sync, provider, AI, tax, security
and store-removal incidents. It is a prepared runbook, not proof that production operations have
been exercised.

## Support Boundary

- Support may verify account ownership, app version, entitlement state, provider state and
  diagnostic bundle metadata.
- Support must never request a vault recovery secret, passphrase, raw financial records, document
  content, screenshots containing financial detail or AI conversation text.
- Any diagnostic bundle must show the exact contents before export.
- Support must route suspected security, processor, provider, tax and store-removal issues to the
  named incident owner.

## Incident Classes

| Class         | Owner               | Severity model | User notice | Correction/rollback | No silent history rewrite |
| ------------- | ------------------- | -------------- | ----------- | ------------------- | ------------------------- |
| Calculation   | finance-engineering | Defined        | Required    | Recompute/correct   | Required                  |
| Sync          | cloud-engineering   | Defined        | Required    | Restore/replay      | Required                  |
| Provider      | provider-operations | Defined        | Required    | Revoke/reconnect    | Required                  |
| AI            | ai-safety-lead      | Defined        | Required    | Disable/rollback    | Required                  |
| Tax           | tax-compliance-lead | Defined        | Required    | Policy-pack update  | Required                  |
| Security      | security-lead       | Defined        | Required    | Contain/rotate      | Required                  |
| Store removal | release-lead        | Defined        | Required    | Comms/rollback      | Required                  |

## Calculation Defect

Trigger examples: incorrect balance projection, tax reserve estimate, invoice status, import
classification or plan cascade.

Required response:

- Identify affected versions, policy packs, fixture vectors and data ranges.
- Stop the faulty path or route it to manual review.
- Publish plain-language user notice before corrected recomputation where user-visible figures may
  change.
- Recompute from source events and keep an audit row explaining the correction.
- Never rewrite history silently.

## Sync Loss Or Duplication

Required response:

- Freeze affected sync cohorts and stop compaction until evidence is preserved.
- Identify operation IDs, device IDs, cursors and snapshot versions.
- Prefer exact operation replay from the last known-good snapshot.
- User notice must distinguish local data, cloud ciphertext and provider-token state.
- Never merge conflicting financial facts without review.

## Provider Token Or Service Incident

Required response:

- Revoke or suspend affected provider tokens.
- Keep local/manual import paths available.
- Mark provider-backed data stale and do not treat missing refresh as financial truth.
- Coordinate processor and legal notification if provider data was exposed.

## AI Unsafe Output

Required response:

- Disable the affected route or model immediately.
- Preserve redacted evaluation metadata only.
- Keep deterministic local flows available.
- Re-run schema, faithfulness, advice-boundary, prompt-injection and workspace-leakage suites
  before re-enabling.

## Tax Policy Pack Incident

Required response:

- Freeze the affected policy-pack version.
- Mark affected tax estimates as requiring review.
- Provide source-policy change notes and effective dates.
- Avoid direct filing claims until legal/tax review approves the correction.

## Security Incident

Required response:

- Contain active access and rotate affected keys, tokens or service roles.
- Assign breach notification owner and legal/privacy owner.
- Preserve audit evidence without exposing user financial content.
- Follow the account recovery/deletion runbook for revoke, restore and deletion implications.

## Store Removal Or Store Policy Incident

Required response:

- Freeze release rollout.
- Identify affected binary, store metadata, declared data flows and submitted review notes.
- Keep export and local-core support instructions available.
- Do not re-submit until privacy, accessibility, financial-feature and account-deletion declarations
  match the binary.

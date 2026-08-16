# Melo change gate

## Scope

- Phase/task IDs:
- User-visible behavior:
- Contracts changed:

## Constitution checks

- [ ] Core local behavior still works without account, internet, bank access or AI.
- [ ] No financial advice wording was introduced.
- [ ] Authoritative facts remain separate from expectations and projections.
- [ ] Personal and business data remain isolated below the UI.
- [ ] Money uses integer minor units and explicit currency.
- [ ] Melo/import/OCR/AI/sync paths create proposals or typed commands only.
- [ ] No real financial data, secrets or unapproved V1 runtime dependency was added.
- [ ] Accessibility and recovery states were considered for changed flows.

## Evidence

- [ ] `pnpm run ci` passes for the reviewed commit.
- [ ] Persistence migrations are forward-safe and preserve newer-schema data.
- [ ] Personal/business workspace and import-document privacy boundaries remain intact.
- [ ] Release evidence was added or linked for user-visible, native or rollout claims.

- Tests run:
- Offline evidence:
- Accessibility evidence:
- Security/privacy impact:
- Migration impact:
- Release evidence:
- Known risks:

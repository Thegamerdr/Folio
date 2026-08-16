# Melo repository and navigation authority

Status: current delivery authority, 2026-08-16.

## Repository authority

- The authoritative implementation repository is the existing Folio repository, materialized for
  this delivery at `C:\dev\melo-phase-d-work`.
- The reviewed delivery branch is
  [`codex/melo-one-app-convergence-2026-08-15`](https://github.com/Thegamerdr/Folio/tree/codex/melo-one-app-convergence-2026-08-15).
- Publication is blocked as of 2026-08-16: GitHub rejected inherited branch history containing
  artifact blobs over its 100 MB limit. The remote branch remains absent; resolving that requires a
  separately approved history migration or clean replay and must not be represented as complete.
- `apps/mobile` is the sole shipping Melo runtime. The public site, design experiments, historical
  prototypes and evidence surfaces do not create parallel applications or repository lineages.
- Navigation implementation commit `88a5ae320265dd0d5c6ffa486db1f74920147ad0` establishes the
  contracts below. The published branch tip is recorded in the delivery handoff after the normal
  push because this decision record cannot contain its own commit hash.

## Superseded statements

Repository evidence supersedes the statement in section 3.3 of the 2026-08-16 master product and
delivery plan that no authoritative native repository was found. The repository, shipping runtime,
branch lineage, validation commands and existing remote are now directly verified.

The navigation subsection of the
[2026-08-15 one-app authority](../2026-08-15/MELO_ONE_APP_AUTHORITY.md) is superseded only for the
selected primary-tab contracts. This record also supersedes older statements that place Melo in
primary navigation, including that wording in ADR 0014; Melo itself remains part of the product.

## Selected navigation contracts

- Personal: **Today / Plan / Review / More**.
- Business: **Today / Money / Review / More**.
- Melo remains a labelled, contextual companion action and is not a bottom-navigation tab.
- Business filing routes remain available from Business surfaces but select More rather than owning
  a primary tab.

## Boundaries that remain

This correction does not waive any unrelated product scope, data-safety, privacy, security,
accessibility, store, operations or beta gate. In particular, Business creation and public Play
verification remain disabled until their separately approved gates and evidence are complete.

Promotion means publishing this reviewed branch to the existing remote for integration. It does not
authorize a force-push, merge, default-branch change, deployment, new repository or parallel app.

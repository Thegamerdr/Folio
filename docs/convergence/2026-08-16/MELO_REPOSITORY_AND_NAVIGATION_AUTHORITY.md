# Melo repository and navigation authority

Status: current delivery authority, 2026-08-16.

## Repository authority

- The authoritative implementation repository is the existing Folio repository, materialized for
  this delivery at `C:\dev\melo-phase-d-work`.
- The reviewed delivery branch is
  [`codex/melo-one-app-convergence-2026-08-15`](https://github.com/Thegamerdr/Folio/tree/codex/melo-one-app-convergence-2026-08-15).
- The branch was published normally to the existing remote on 2026-08-17. Its first clean published
  tip was `c60db2edf12d6e523a6b19e506aa03258326fa40`; the
  [clean replay record](../2026-08-17/MELO_CLEAN_PUBLICATION_REPLAY.md) preserves the original tip,
  commit mapping, tree-equivalence proof and exact build-artifact exclusions.
- `apps/mobile` is the sole shipping Melo runtime. The public site, design experiments, historical
  prototypes and evidence surfaces do not create parallel applications or repository lineages.
- Published navigation implementation commit `91bee8e8362b0c61e33182a627d159787e215ee5` establishes the
  contracts below.

## Lovable design lineage

- UI/UX reference project: `d8323aca-d14c-4f6d-bb89-6d41bcefab7b`.
- Referenced Lovable head: `c75dad8c4151f7b6987bafc89ba8a3fc126196d2`.
- Referenced product-code baseline: `ef8d0cf5d6d5e8b82c5f8c38ba5c2d95bf72c04a`.
- These identifiers record the 2026-08-16 master plan's design lineage. Lovable remains the faithful
  UI/UX reference only; it was not contacted or modified during this repository publication.

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

# Melo convergence decisions

Status: decision log for this packet. Historical docs remain evidence; this file records superseding target decisions.

## Decisions

| ID | Decision | Supersedes/clarifies | Evidence |
| --- | --- | --- | --- |
| D-001 | The current product is not frozen as approved. The checkpoint is archival evidence only. | Any interpretation that the audit snapshot is a release candidate. | `MELO_PRE_CONVERGENCE_CHECKPOINT.md` |
| D-002 | Personal Trusted Core is the next product target. Business is separate and may share infrastructure only. | Any plan that lets Business IA or tax complexity reshape Personal core. | `MELO_TRUSTED_CORE_PRODUCT.md`, `MELO_INFORMATION_ARCHITECTURE.md` |
| D-003 | Melo is primarily a private financial decision companion / decision system. | Budgeting app, generic tracker, generic AI chat, or immediate financial OS framing. | `MELO_TRUSTED_CORE_PRODUCT.md` |
| D-004 | Safe Zone becomes Trusted Safe Range with source, freshness, assumptions, uncertainty, and reliance. | Single-number safe-to-spend as final answer. | `MELO_SAFE_RANGE_CONTRACT.md` |
| D-005 | Truth classes are canonical product language. | Feature-specific confidence terminology. | `MELO_TRUTH_MODEL.md` |
| D-006 | The LLM must not calculate consequential truth. | Any AI path that invents financial numbers. | `MeloChatSheet.tsx`, `localMeloTurn.ts`, Safe Range contract |
| D-007 | Material state writes require informed consent. | Silent Melo/tool/provider writes. | `MeloChatSheet.tsx`, `store.ts`, containment test |
| D-008 | Decision Ledger is bounded accountability, not generic event sourcing. | Architecture theatre or full rewrite. | `MELO_DECISION_LEDGER.md` |
| D-009 | Lovable is a design laboratory and intended UX source, not automatic final authority. | Blind parity implementation. | User brief and this packet |
| D-010 | `--accent`/`t.calm` is not a white/paper-text CTA fill. Accent labels use ink; primary CTAs use ink/paper pairings. | Earlier contrast drift. | `darkModeFoundation.test.ts`, token/source changes |
| D-011 | Main native exports must not persist plaintext files in document storage after sharing. | Durable plaintext export artefacts. | `exportNative.ts`, `exportNative.test.ts` |
| D-012 | Android document-reading claims must not imply iOS parity. | Cross-platform copy overclaim. | `IntakeScreen.tsx` |
| D-013 | Open Banking remains fail-closed/gated until production callback and provider identity proof exist. | Provider flows that appear live without configuration. | `openBankingNative.ts`, `BankConnectionSheet.tsx` |
| D-014 | Sample/demo data must never influence real workspace answers. | Demo content presented as user truth. | `noFabricatedContent.test.ts` |
| D-015 | Recurring invoices must not materialise drafts from screen render. | Business Today lifecycle mutation. | `BusinessTodayScreen.tsx`, `noFabricatedContent.test.ts` |

## Phase B superseding decisions

| ID | Decision | Evidence |
| --- | --- | --- |
| B-001 | Personal IA is Today, Calendar, Review/Activity, Plans, Melo, Decision History, Trust/Data and Account; not every concept becomes a permanent tab. | `MELO_INFORMATION_ARCHITECTURE.md`, `MELO_SCREEN_DISPOSITION.md`, `adrs/ADR-001-personal-information-architecture.md` |
| B-002 | Business IA is separate: Business Today, Activity/Review, Calendar, Runway, Clients/Invoices, Obligations/Filings, Business Melo and Business Data/Account. | `MELO_INFORMATION_ARCHITECTURE.md`, `adrs/ADR-002-business-information-architecture.md` |
| B-003 | Every current RN and Lovable screen has a declared treatment before Phase C begins. | `MELO_SCREEN_DISPOSITION.md` |
| B-004 | Trusted Core contracts live in `@folio/domain`; app/local code adapts to them. | `packages/domain/src/trustedCore.ts`, `adrs/ADR-004-domain-contract-ownership.md` |
| B-005 | Forecast calculation owner is `@folio/finance-engine`. | `MELO_ENGINE_CONVERGENCE_PLAN.md`, `adrs/ADR-005-forecast-engine-owner.md` |
| B-006 | Normalised SQL becomes canonical by slice; full AppState generations remain compatibility authority and rollback evidence until each slice is proven. | `MELO_DATA_MIGRATION_PLAN.md`, `adrs/ADR-006-appstate-sql-authority.md` |
| B-007 | Keep `FolioShell` in-memory routing through Phase C; route migration is deferred. | `MELO_NAVIGATION_TRANSITION.md`, `adrs/ADR-007-navigation-transition.md` |
| B-008 | Legacy Safe Zone engines are deprecated compatibility inputs; Phase C must target `TrustedSafeRangeResult`. | `apps/mobile/src/folio/lib/modes/safeZone.ts`, `packages/melo-engine/src/safeZone.ts`, `adrs/ADR-008-trusted-safe-range-interface.md` |
| B-009 | Decision Ledger remains a bounded material-decision record, not broad event sourcing. | `MELO_DECISION_LEDGER.md`, `adrs/ADR-009-decision-ledger-boundary.md` |
| B-010 | Phase B migrations are non-destructive scaffolds with no user-visible behaviour change. | `trustedCoreMigrationPlan`, `MELO_DATA_MIGRATION_PLAN.md`, `adrs/ADR-010-non-destructive-migrations.md` |

## Current canonical docs not overwritten

No historical handoff, audit, or release-evidence document was deleted or silently rewritten in this pass. This packet is the convergence authority for future work after human approval.

## Approval boundary

Phase A containment can be committed now. Phase B-G implementation requires human approval of the next phase.

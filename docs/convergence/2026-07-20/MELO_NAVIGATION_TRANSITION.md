# Melo navigation transition

Status: Phase B navigation strategy. No new navigation is implemented in Phase B.

## Current state

- Expo Router hosts the app entry.
- `apps/mobile/src/folio/shell/FolioShell.tsx` owns the in-memory screen/sheet state machine.
- `apps/mobile/src/folio/types.ts` owns `ScreenId`, `SheetId`, `Nav`, and payload types.
- `FolioShell` maps Business workspace screens separately from Personal screens.

## Decision

Keep the custom in-memory router through Phase C. Do not introduce new Expo routes until the Trusted Safe Range and critical Personal journeys are stable.

## Why

- The shell already protects current operational behaviour.
- Phase C needs answer-contract work, not navigation churn.
- Expo Router migration would add regression risk without making Safe Range more truthful.
- Screen disposition is not final screen implementation; navigation should change only when journeys are proven.

## Transitional strategy

| Stage | Navigation authority | Work allowed |
| --- | --- | --- |
| Phase B | `FolioShell.tsx` | Document IA and dispositions; no route implementation changes. |
| Phase C | `FolioShell.tsx` | Adapt Today and source drawers inside existing routes. |
| Phase D | `FolioShell.tsx` | Add Decision History as sub-surface or existing route target only after ledger exists. |
| Phase E | Re-evaluate Expo Router split | Move to route groups only if journey tests prove stable targets. |

## Personal route targets

| Concept | Current route/screen | Target transition |
| --- | --- | --- |
| Today | `today` | Keep route; evolve contents. |
| Calendar | `calendar` | Keep route; add truth/source states. |
| Review/Activity | `review`, `timeline`, `visualizer` | Consolidate tab target around Review/Activity after truth model. |
| Plans | `plans`, `whatif`, `recovery`, `ritual`, `shortfall` | Keep as separate routes until Phase E decides workbench shape. |
| Melo | `melo`, `melo-chat` sheet, `melo-memory`, `melo-moves` | Keep routes; later nest memory/moves under Trust/Data or Melo. |
| Trust/Data | `more`, `privacy`, data/export sheets | Keep in More; consolidate later. |
| Account | `account`, `paywall` | Keep under More/Account. |

## Business route targets

Business routing remains workspace-gated in `FolioShell`. Personal routes must not switch into Business content unless active workspace kind is Business. Business-specific routes remain separate and deferred from Personal Trusted Core.

## Acceptance criteria for any future navigation migration

- Every current route has a redirect or replacement.
- Deep links and sheet payloads have typed equivalents.
- Back behaviour is tested.
- Workspace switching cannot show stale Personal screen with Business state, or inverse.
- Hydration and persistence notices still render at shell level.
- Reduced-motion sheet behaviour remains intact.


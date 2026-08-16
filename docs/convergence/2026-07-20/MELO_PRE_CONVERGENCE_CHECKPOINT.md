# Melo pre-convergence checkpoint

Date: 2026-07-20  
Purpose: archival evidence checkpoint before Trusted Core convergence. This checkpoint preserves the state that existed when the Omega audit work was accepted as evidence. It does not approve the product, architecture, pricing, navigation, mascot behaviour, duplicate systems, or current feature set.

## Repository checkpoint

| Item | Evidence |
| --- | --- |
| RN repository | `C:\dev\melo-native-ux` |
| Active branch at checkpoint | `codex/melo-native-ux` |
| Active HEAD at checkpoint | `8cf2f9ba2656b6980cca1e58459521de71bb9967` |
| Working state at checkpoint | Dirty: 154 tracked files changed plus untracked assets, app evidence, public-site files, and generated artifacts. The dirty state was not reset or cleaned. |
| Recoverable archival branch | `audit-checkpoint/melo-pre-convergence-2026-07-20` |
| Recoverable snapshot commit | `17a912edf1740f8492ac9fadb3c0210f7966119a` |
| Recoverable annotated tag | `audit-checkpoint/melo-pre-convergence-2026-07-20-snapshot` pointing to `17a912edf1740f8492ac9fadb3c0210f7966119a` |
| Stashes | None reported by `git stash list` |
| Submodules | None reported by `git submodule status` |
| Preservation mechanism | Temporary git index: snapshot branch/tag were created from the full dirty worktree without moving the active branch and without discarding uncommitted work. |

## Lovable design checkpoint

| Item | Evidence |
| --- | --- |
| Lovable repository | `C:\dev\folio-melo-lovable-main` |
| Branch | `codex/business-native-handoff` |
| HEAD | `3911caf557685207872bfe238481a91e19392773` |
| Working state | Dirty when checkpointed; the design repo had tracked changes. |
| Recoverable archival branch | `audit-checkpoint/lovable-pre-convergence-2026-07-20` |
| Recoverable snapshot commit | `1c4fdb7866cfbe34efcfe16d79b0d57d71a0ae7f` |
| Recoverable annotated tag | `audit-checkpoint/lovable-pre-convergence-2026-07-20-snapshot` pointing to `1c4fdb7866cfbe34efcfe16d79b0d57d71a0ae7f` |

Lovable remains evidence for intended UX and design language, especially `C:\dev\folio-melo-lovable-main\src\components\folio\screens`, `C:\dev\folio-melo-lovable-main\src\components\folio\sheets`, `C:\dev\folio-melo-lovable-main\src\lib`, and `C:\dev\folio-melo-lovable-main\src\styles.css`. It is not an automatic final authority after convergence.

## Baseline evidence before containment

| Gate | Result |
| --- | --- |
| `pnpm test` | Passed before containment: 225 test files, 2590 tests. |
| `pnpm typecheck` | Passed before containment. |
| `pnpm build` | Passed before containment. |

## Phase 0B containment evidence

These are tightly scoped harm-containment changes made after the checkpoint. They are not broad redesign.

| Risk | Containment | Evidence |
| --- | --- | --- |
| Recurring invoices silently materialising drafts | Removed the Business Today lifecycle invocation of `generateDueRecurringInvoices` and `updateBusinessOperations(generated)`. | `apps/mobile/src/folio/screens/BusinessTodayScreen.tsx`, `apps/mobile/src/folio/screens/noFabricatedContent.test.ts` |
| Known contrast failures | Repaired white/paper text on accent/deep-accent fills to use `t.accentInk`; added a source guard that confines `t.inverse` to known ink-fill contexts. | `apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts`, multiple Personal sheets/screens, `apps/mobile/src/folio/sheets/EditTxnSheet.tsx`, `apps/mobile/src/folio/screens/VisualizerScreen.tsx` |
| Plaintext native exports retained indefinitely | Native export now stages in `FileSystem.cacheDirectory`, shares, then deletes the temporary export directory in `finally`. | `apps/mobile/src/folio/lib/exportNative.ts`, `apps/mobile/src/folio/lib/exportNative.test.ts` |
| Android-only document reading implying iOS parity | Intake footer is platform-specific: Android claims PDF/photo reading; non-Android says native proof is still required. | `apps/mobile/src/folio/screens/IntakeScreen.tsx` |
| Mock/unavailable provider integration appearing operational | Verified Open Banking remains gated by provider configuration and fails closed when the service URL is absent. No code change required. | `apps/mobile/src/folio/sheets/BankConnectionSheet.tsx`, `apps/mobile/src/folio/lib/openBankingNative.ts` |
| Obsolete mascot fallback | Verified runtime identity uses Melo/Phoenix canonical assets rather than an obsolete mascot fallback. No code change required. | `apps/mobile/src/folio/assets/canonicalAssets.ts`, `apps/mobile/src/folio/melo/Melo.tsx`, `apps/mobile/src/folio/copy/copy.ts` |
| Companion write boundary | Verified Melo chat proposals settle only after explicit Confirm, and `applyMeloTool` is invoked inside `confirmToolSuggestion`. No code change required. | `apps/mobile/src/folio/sheets/MeloChatSheet.tsx`, `apps/mobile/src/folio/store.ts`, `apps/mobile/src/folio/lib/melo/toolContract.ts`, `apps/mobile/src/local/localMeloTurn.ts` |

## Post-containment verification

| Command | Result |
| --- | --- |
| `pnpm vitest run apps/mobile/src/folio/screens/noFabricatedContent.test.ts apps/mobile/src/folio/lib/exportNative.test.ts apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts --passWithNoTests` | Passed: 3 files, 15 tests. |
| `pnpm typecheck` | Passed after containment. |
| `pnpm test` | Passed after containment: 226 files, 2593 tests. |
| `pnpm build` | Passed after containment. |

## Evidence caveats

- The Omega Reconciliation, Product Moat, and Company audit outputs were provided in the Codex conversation as strategic evidence. This packet records their accepted conclusions rather than silently rewriting historical source docs.
- The repo remains dirty by design. The active branch was not force-reset, cleaned, or switched.
- Checkpoint branches/tags are archival. They are not release candidates.

# Folio V2 UI Trust Review Register

Date: 2026-06-23  
Scope: pre-owner-dogfood UI evidence scoring and trust review.  
Mode: evidence review plus narrow P1 copy fixes only. No new product scope was added.

## Evidence Reviewed

Newest usable evidence was preferred when duplicate surfaces existed.

| Evidence set                                                         | Use in this review                          | Notes                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23`    | Primary object-flow evidence                | Strongest proof for import review, data control, recovery, Today, Timeline, Calendar, Plans and Melo object states.                                      |
| `apps/mobile/evidence/native-device-reality-pass-2026-06-23`         | Native Android screenshot/XML evidence      | Used for native-feel and route reality checks. Some old screenshots show stale redboxes or dev menus; later patched screenshots were treated as current. |
| `apps/mobile/evidence/recovery-replay-melo-ios-readiness-2026-06-23` | Recovery replay and Melo readiness evidence | Used for preview/accept/replay trust checks and cross-surface recovery movement.                                                                         |
| `apps/mobile/evidence/recovery-melo-completion-pass-2026-06-23`      | XML/report evidence only                    | Screenshot PNGs in this folder are unreadable in this workspace.                                                                                         |
| `apps/mobile/evidence/android-dogfood-pack-2026-06-23`               | XML/report evidence only                    | Screenshot PNGs in this folder are unreadable in this workspace.                                                                                         |
| `apps/mobile/evidence/brand-mark-correction-2026-06-23`              | Brand mark and first-minute evidence        | Usable screenshots confirm the temporary folded-record mark replaced the old editorial F direction.                                                      |
| `apps/mobile/evidence/mobile-shell-visual-pass`                      | Regenerated after-fix static evidence       | Used for after screenshots of changed copy and reviewed surfaces.                                                                                        |

Review contact sheets and after-fix screenshots are stored in:

- `apps/mobile/evidence/ui-trust-review-2026-06-23/review-contact-sheets`
- `apps/mobile/evidence/ui-trust-review-2026-06-23/after-screenshots`
- `apps/mobile/evidence/ui-trust-review-2026-06-23/after-screenshots-contact-sheet.png`
- `apps/mobile/evidence/ui-trust-review-2026-06-23/skipped-unreadable-images.txt`

## Surface Scores

Scale: 1 to 10. These are dogfood trust-readiness scores, not product success metrics.

| Surface               | Visual hierarchy | Emotional safety | Trust clarity | Source clarity | Touch comfort | Copy clarity | Local-first clarity | Review-before-save clarity | Melo usefulness | Native mobile feel | Overall |
| --------------------- | ---------------: | ---------------: | ------------: | -------------: | ------------: | -----------: | ------------------: | -------------------------: | --------------: | -----------------: | ------: |
| First Minute          |                8 |                9 |             9 |              7 |             8 |            8 |                  10 |                          9 |               6 |                  8 |       8 |
| Empty First Launch    |                8 |                9 |             8 |              7 |             8 |            8 |                   9 |                          8 |               5 |                  8 |       8 |
| Sample Briefing       |                8 |                9 |             8 |              8 |             8 |            8 |                   8 |                          9 |               6 |                  8 |       8 |
| Minimal Manual Path   |                7 |                8 |             8 |              7 |             7 |            8 |                   8 |                          8 |               5 |                  7 |       7 |
| Today                 |                8 |                9 |             8 |              8 |             8 |            8 |                   8 |                          8 |               7 |                  8 |       8 |
| Timeline              |                7 |                8 |             8 |              8 |             7 |            7 |                   8 |                          8 |               6 |                  7 |       7 |
| Calendar              |                7 |                8 |             8 |              7 |             7 |            7 |                   8 |                          7 |               5 |                  7 |       7 |
| Plans                 |                8 |                9 |             8 |              8 |             8 |            8 |                   8 |                          8 |               7 |                  8 |       8 |
| Recovery Preview      |                9 |               10 |             9 |              8 |             8 |            9 |                   8 |                         10 |               8 |                  8 |       9 |
| Recovery Accepted     |                8 |                9 |             8 |              8 |             8 |            8 |                   8 |                          9 |               8 |                  8 |       8 |
| Import Review         |                7 |                8 |             8 |              8 |             7 |            7 |                   8 |                         10 |               5 |                  7 |       7 |
| Rejected Import State |                8 |                9 |             9 |              8 |             8 |            8 |                   8 |                         10 |               5 |                  8 |       8 |
| Data Control          |                8 |                8 |             9 |              8 |             8 |            8 |                  10 |                          8 |               5 |                  8 |       8 |
| Melo Surface          |                8 |                9 |             8 |              8 |             8 |            8 |                   8 |                          8 |               9 |                  8 |       8 |
| Dogfood Mode          |                7 |                8 |             8 |              7 |             7 |            7 |                   9 |                          8 |               5 |                  7 |       7 |
| More / Settings       |                7 |                8 |             8 |              7 |             7 |            7 |                   8 |                          7 |               5 |                  7 |       7 |
| Brand Mark Usage      |                8 |                8 |             8 |              6 |             8 |            8 |                   7 |                          7 |               5 |                  8 |       8 |

## Issue Register

| ID           | Surface                                        | Score | Issue                                                                                                              | Severity | Why it matters                                                                                                                                                           | Evidence path                                                                                           | Recommended fix                                                                                                   | Fix before dogfood |
| ------------ | ---------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| UI-TRUST-001 | First Minute, Import Review, Data Control      |     7 | Heavy "financial reality" / "becomes reality" wording made review moments feel too absolute.                       | P1       | The product promise is calm clarity; heavy authority language can make import review feel punitive or irreversible.                                                      | `review-contact-sheets/interactive-object-01.png`, `review-contact-sheets/native-device-01.png`         | Replace with money-view and save-after-review wording.                                                            | Yes - fixed        |
| UI-TRUST-002 | Dogfood Mode, Import Review                    |     7 | Visible technical language leaked into user-facing copy: canonical, parser, provenance.                            | P1       | Owner dogfood should test product trust, not repository vocabulary. Technical labels reduce comprehension and trust.                                                     | `review-contact-sheets/interactive-object-02.png`, source scan                                          | Replace visible labels with local records, statement reader, source history and review details.                   | Yes - fixed        |
| UI-TRUST-003 | Android dogfood pack, Recovery/Melo completion |     6 | Several screenshot evidence PNGs are unreadable in this workspace.                                                 | P1       | A dogfood pack that relies on corrupted screenshots weakens trust in the pack even when XML/report evidence exists.                                                      | `skipped-unreadable-images.txt`                                                                         | Recapture or replace corrupted screenshots before using those folders as owner-facing proof.                      | Yes                |
| UI-TRUST-004 | Import Review                                  |     7 | Native import accept/reject was not fully proven through the native UI in the latest native-device reality report. | P1       | Import review is a trust-critical path; owner dogfood needs certainty that accept/reject changes the right records and leaves rejected rows out of Today/Timeline/Plans. | `apps/mobile/evidence/native-device-reality-pass-2026-06-23/NATIVE_DEVICE_REALITY_REPORT_2026-06-23.md` | Make this a first owner-dogfood script item and capture clean current evidence.                                   | Yes                |
| UI-TRUST-005 | Native evidence set                            |     7 | Old redbox/dev-menu/black-screen screenshots still sit beside newer patched evidence.                              | P1       | Stale failure screenshots can be mistaken for current state and obscure what is actually ready.                                                                          | `review-contact-sheets/native-device-01.png`, `review-contact-sheets/native-device-02.png`              | Keep them as historical evidence but label them stale; only use latest patched screenshots for dogfood readiness. | Yes                |
| UI-TRUST-006 | Minimal Manual Path                            |     7 | One manual-entry evidence sequence suggests text may append during automated input.                                | P2       | If reproduced manually, first-run entry can feel fragile. The evidence may be an ADB-input artifact, so this should be retested rather than redesigned.                  | `review-contact-sheets/native-device-02.png`                                                            | Retest on physical Android during owner dogfood; fix only if reproduced by touch input.                           | No                 |
| UI-TRUST-007 | Timeline, Calendar, Recovery, Data Control     |     7 | Dense information stacks can make lower content feel heavy on small screens.                                       | P2       | The product is calm, but some surfaces require careful scanning. This is acceptable for internal dogfood but not final polish.                                           | `review-contact-sheets/recovery-replay-01.png`, `after-screenshots-contact-sheet.png`                   | Use dogfood notes to find the exact rows that cause confusion; avoid broad redesign in this pass.                 | No                 |
| UI-TRUST-008 | Melo Surface                                   |     8 | Melo is correctly bounded but some explanations sit low on the screen.                                             | P2       | Melo's value is interpretation; if source and answer context are below the fold, users may not see why Melo is safe.                                                     | `after-screenshots/melo-surface.png`                                                                    | Retest on device and adjust vertical priority only if users miss the source/proposal boundary.                    | No                 |
| UI-TRUST-009 | Accessibility                                  |     6 | Large text, TalkBack and contrast were not audited in this pass.                                                   | P2       | Dogfood can proceed, but accessibility trust is unproven.                                                                                                                | `native-device-reality-pass-2026-06-23/NATIVE_DEVICE_REALITY_REPORT_2026-06-23.md`                      | Run an accessibility pass after dogfood-blocking evidence is clean.                                               | No                 |
| UI-TRUST-010 | Brand Mark Usage                               |     8 | Temporary mark now reads as a local folded record, but final brand authority is not proven.                        | P3       | This is not a dogfood blocker; it affects polish, not the core trust loop.                                                                                               | `review-contact-sheets/brand-mark-correction-01.png`                                                    | Keep current mark for dogfood; revisit in brand pass.                                                             | No                 |

## Fixes Applied In This Pass

The following changes were made because they were high-confidence P1 trust/copy issues:

- First-minute copy now says nothing affects the user's money view until review.
- Import Review now uses "money view" and "save after review" language instead of "financial reality" language.
- Import Review hides technical parser wording behind "statement reader", "source looked readable", "read wrong" and "source and review details".
- Data Control now says "Accepted money rows" and "source history" instead of "Accepted reality" and "provenance".
- Dogfood status labels now describe local records on this device instead of canonical repository internals.
- Source-level tests now guard against the retired visible copy.
- Static evidence pages were regenerated and after-fix screenshots were captured.

## Current Decision

No active P0 UI trust blocker was found in the newest usable evidence.

Owner dogfood is reasonable only if the dogfood pack uses the current screenshots/evidence and explicitly calls out the still-unproven native import accept/reject path. The corrupted screenshot folders should not be used as the primary visual proof until recaptured.

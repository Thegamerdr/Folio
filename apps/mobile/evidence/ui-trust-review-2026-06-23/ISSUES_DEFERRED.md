# Issues Deferred

These were not fixed in this pass because they are not clear P0/high-confidence P1 code changes, or because they require physical device confirmation.

| ID           | Issue                                                                                                 | Severity | Reason deferred                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| UI-TRUST-003 | Corrupted screenshot files in the Android dogfood pack and recovery/Melo completion evidence folders. | P1       | Needs recapture/replacement of evidence artifacts, not product code.                       |
| UI-TRUST-004 | Native import accept/reject not fully proven through native UI in the latest native-device report.    | P1       | Needs focused physical/native dogfood evidence capture.                                    |
| UI-TRUST-005 | Stale redbox/dev-menu/black-screen screenshots remain in historical evidence folders.                 | P1       | Needs evidence labeling/curation; latest patched screenshots should be used for readiness. |
| UI-TRUST-006 | Manual path automated-input evidence may show text appending.                                         | P2       | Could be an ADB-input artifact; retest by touch before changing UX.                        |
| UI-TRUST-007 | Dense lower-screen content on Timeline, Calendar, Recovery and Data Control.                          | P2       | Dogfood should reveal whether density is confusing before any layout change.               |
| UI-TRUST-008 | Melo source/explanation detail may sit below the fold.                                                | P2       | Needs dogfood observation rather than speculative rearrangement.                           |
| UI-TRUST-009 | Large text, TalkBack and contrast were not audited in this pass.                                      | P2       | Separate accessibility proof pass needed.                                                  |
| UI-TRUST-010 | Final brand authority not proven.                                                                     | P3       | Current mark is adequate for dogfood; final brand polish is outside scope.                 |

# Accessibility Audit Foundation

Date: 2026-06-23

This is a foundation audit, not a claim of full accessibility compliance.

## Current Mobile Surface Audit

| Area                         | Current observation                                                      | Risk                                                              | Evidence needed                                       |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Touch target size            | Shared tokens define minimum hit target and buttons use stable controls. | Dense screens may still create small targets.                     | Physical Android tap audit and screenshot review.     |
| Text scaling                 | Mobile shell uses fixed font sizes and scroll surfaces.                  | Large text may overflow dense rows.                               | Android large-text screenshots and remediation list.  |
| Contrast                     | Design tokens centralize colors.                                         | Some soft panels and disabled states need device contrast review. | Contrast sampling on final screens.                   |
| Screen reader labels         | Many controls use `accessibilityLabel`, `accessibilityHint` and roles.   | Complex route charts and rows need TalkBack pass.                 | TalkBack transcript for Today, Import, Data, Dogfood. |
| Heading structure            | Screen headers use `accessibilityRole="header"` in key surfaces.         | Long screens may need clearer section navigation.                 | Screen reader navigation audit.                       |
| Button clarity               | Primary/secondary buttons include labels and intent text.                | Some compact controls may be terse.                               | Button-label inventory.                               |
| Disabled state clarity       | Disabled buttons set accessibility disabled state.                       | Disabled reason may not always be clear.                          | Disabled action review on Data Control and Dogfood.   |
| Error state clarity          | Import and manual entry errors announce messages.                        | Native failure cases need device proof.                           | Error injection pass.                                 |
| Reduced motion readiness     | Reduced-motion preference is read for sheets.                            | Animated/visual surfaces need manual review.                      | Reduced-motion Android pass.                          |
| Keyboard/input accessibility | Text inputs have labels.                                                 | Keyboard return/focus order needs device proof.                   | Manual input audit.                                   |
| Scroll traps                 | Main content uses a single primary scroll plus modals/sheets.            | Long screens may bury critical actions.                           | TalkBack scroll audit.                                |
| Bottom nav safe area         | SafeAreaView and bottom nav are used.                                    | Small Android devices need visual proof.                          | Screenshot on physical Android.                       |

## Source-Level Checks Added Or Existing

- Brand mark accessibility behavior: `brandMarkCorrection.test.ts`.
- Dogfood destructive/reset wording and disabled-state checks: `dogfoodMode.test.ts`.
- Data Control clear action requires arming in the live surface.
- App lock overlay uses modal accessibility boundaries.
- Release foundation gate requires this audit file.

## Practical Test Targets

- Important buttons have accessible labels or direct text labels.
- Decorative indicators should not be announced as separate meaningful content.
- Disabled destructive actions communicate why they are unavailable.
- Clear/reset/export actions use clear wording.
- Empty baseline is not described as confirmed zero balance.

## Manual Audit Needed

- Android TalkBack on First Minute, Today, Import Review, Plans, Recovery, Data Control and Dogfood Mode.
- Android large text at system maximum.
- Android reduced motion.
- Android keyboard/focus order for import and quick estimate.
- iOS VoiceOver once macOS/Xcode or EAS path exists.
- Independent accessibility audit before public release.

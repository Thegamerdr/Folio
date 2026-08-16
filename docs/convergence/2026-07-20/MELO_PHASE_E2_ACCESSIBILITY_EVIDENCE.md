# Phase E.2 accessibility evidence

Evidence label: Android emulator evidence.

This is not a complete accessibility audit. It is native runtime evidence plus source/test checks where emulator tooling allowed.

## Emulator tooling

| Check | Result |
| --- | --- |
| TalkBack package | Installed: `com.google.android.marvin.talkback` |
| TalkBack enabled | Not enabled; secure setting returned `null` |
| UIAutomator XML | Captured for most screens; failed on some animated surfaces with `could not get idle state` |
| Screen-reader claim | Source/XML-assisted only, not a full TalkBack pass |

## Captured runtime states

| State | Evidence | Result |
| --- | --- | --- |
| Dark mode | `dark-mode-today.png`, `window-dark-mode-today.xml` | Passed visual smoke |
| Large text | `large-text-dark-today.png`, `window-large-text-dark-today.xml` | Passed visual smoke at `font_scale=1.3` |
| Reduced motion | `offline-reduced-motion-large-dark-today.png` | App launched with global animation scales set to `0` |
| Offline launch | `offline-reduced-motion-large-dark-today.png` | Local-first Today rendered offline |
| Relaunch persistence | `b8bb846-recovery-persistence-after-relaunch.png` | Passed |
| Bottom navigation | Most screenshots | Tabs remain reachable |
| Back handling | Timeline, Recovery, Payday, Decision History journeys | Passed manual ADB back/tap smoke |
| Sheets/modals | `recovery-talk-link-attempt.png`, `workspace-sheet-personal-isolation-2.png` | Passed smoke |
| Keyboard/date/money inputs | `first-answer-clean-minimum.png`, `add-bill-clean-filled-shortfall.png` | Passed smoke |

## Tap targets

Observed tappable controls in XML generally expose bounds at or above the 44px target minimum:

- bottom nav tabs
- First Answer primary actions
- Add bill fields/actions
- Recovery move cards and primary CTA
- Decision History controls
- More rows

This is an emulator inspection, not a full automated tap-target audit.

## Known accessibility caveats

| Caveat | Severity | Phase |
| --- | --- | --- |
| TalkBack was installed but not enabled for a spoken pass | Accessibility evidence gap | Phase F / release hardening |
| UIAutomator can fail on animated screens with `could not get idle state` | Tooling limitation | Phase F test harness |
| Public Expo config still lists `RECORD_AUDIO` while generated manifest removes it | Config clarity issue | Phase F native config cleanup |
| Contrast was visually smoke-tested, not programmatically audited in native runtime | Evidence gap | Phase F release hardening |

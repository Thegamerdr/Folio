# Accessibility And Security Local Candidate - 2026-06-21

## Claim

Folio V2 has a 10/10 local accessibility/security candidate for the source-controlled Expo shell,
release-readiness contracts and release-blocker governance.

This is not an independent accessibility audit, penetration test, MASVS certification, DPIA approval,
store clearance or public-release security signoff.

## Local Accessibility Work Completed

- Added explicit screen announcements for route changes.
- Added reduced-motion preference handling and disabled sheet slide animation when reduced motion is
  enabled.
- Added modal accessibility containment for What-if and Sources sheets.
- Added grouped labels and hints for core choices, primary/secondary buttons, More menu rows, bottom
  tabs, timeline rows, source rows, discovery rows and review rows.
- Added progress semantics for first-minute and import review progress.
- Added text equivalents for breathing-room route charts.
- Added live review-action feedback for confirm/edit/dismiss actions.
- Kept 48dp hit-target policy in `@folio/ui` tokens.

## Local Security Work Completed

- Added `evaluateSecurityEvidenceGate` coverage for local security evidence rows.
- Added rejection of local-only evidence that pretends to satisfy external security signoff.
- Added blocker-id preservation for open independent security review blockers.
- Integrated optional security evidence state into the private-beta readiness gate.
- Hardened `@folio/release-gate` so a closed external blocker requires independent reviewer evidence.
- Mirrored that rule in `tooling/scripts/check-release-blockers.mjs`.
- Preserved the public-release blocker register in its honest blocked state.

## Huashu Review

Local accessibility UX score: 9.4/10.

- Philosophy: strong. Accessibility semantics reinforce Folio's calm-control thesis instead of
  adding explanatory UI chrome.
- Hierarchy: strong. The first read remains visual, while TalkBack/UIAutomator receives grouped
  route, money and provenance summaries.
- Craft: strong. Modal containment, tab labels and action feedback reduce cognitive load.
- Function: strong locally. Critical flows have labels, hints, state and source wording.
- Originality: unchanged. The route horizon remains Folio-specific and now has a non-visual
  equivalent.

Critical public-release issue still open: independent VoiceOver/TalkBack, large-text,
reduced-motion and cognitive accessibility audit.

## Emulator Evidence

Captured on Android `emulator-5554` against Expo development client
`com.folio.v2.greenfield` with Metro on port `8084`:

- `android-a11y-security-first-minute.png` and `.xml`
- `android-a11y-security-today.png` and `.xml`
- `android-a11y-security-sources.png` and `.xml`
- `android-a11y-security-more.png` and `.xml`
- `android-a11y-security-import-review.png` and `.xml`
- `android-a11y-security-import-review-action.png` and `.xml`

Notable XML checks:

- First-minute choices expose grouped labels such as "Show me in 20 seconds. Play with a private
  example".
- Today exposes "Route chart. Today is covered, Tuesday gets tight, and payday restores breathing
  room."
- Timeline rows expose day, title, detail, amount and status as one readable item.
- Sources sheet exposes only sheet content while open and groups original wording, interpretation,
  confidence and status.
- Import Review exposes original wording, confidence, action labels and the live "Review action"
  notice after Confirm.
- Bottom tab glyphs remain visual children but tab controls expose stable labels such as "Today tab"
  and "More tab".

The visible Expo Tools floating button is development-client tooling. It is not part of Folio
runtime UI and does not exist in a production build.

## Standards Used

- WCAG 2.2 was used as the accessibility reference, especially non-text contrast, focus visibility,
  motion/reduced-motion and text alternatives: `https://www.w3.org/TR/WCAG22/`
- W3C Focus Appearance understanding was used for focus visibility expectations:
  `https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html`
- OWASP MASVS was used as the mobile security verification reference:
  `https://mas.owasp.org/MASVS/`

## Validation Snapshot

Focused checks passed before the full CI run:

- `pnpm --filter @folio/mobile typecheck`
- `pnpm --filter @folio/release-readiness typecheck`
- `pnpm --filter @folio/release-gate typecheck`
- `pnpm exec vitest run packages/release-readiness/test/release-readiness.test.ts`
- `pnpm exec vitest run packages/release-gate/test/release-gate.test.ts`
- `pnpm check:release-blockers`

Current release-blocker register remains:

- ready for public release: no;
- public release flag: disabled;
- open blockers: 23 of 23;
- release-blocking: 14;
- beta-blocking: 6;
- roadmap-blocking: 3;
- external open: 17;
- missing current-evidence files: 0.

## Remaining External Blockers

- Independent accessibility audit across iOS VoiceOver, Android TalkBack, large text, reduced
  motion and cognitive accessibility.
- Independent threat model review, MASVS review and penetration test with no high or critical
  findings open.
- Native Keychain/Keystore/app-lock/recovery wrapping proof on supported devices.
- DPIA, processor inventory, legal and privacy signoff.
- iOS build/install evidence through macOS/Xcode or EAS signing.
- Public-release regression, store declarations, billing and operations evidence.

## Product Label

Use:

> 10/10 local accessibility/security candidate for source-controlled implementation and emulator
> evidence; public accessibility/security release remains blocked until independent audits and
> signoffs exist.

Do not use:

> Accessibility/security certified, pen-tested or public-release ready.

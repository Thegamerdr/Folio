# Melo independent accessibility review handoff

Engineering package revalidated 31 August 2026. This remains a handoff to an independent reviewer,
not a self-approved accessibility clearance.

Status: internal Android accessibility readiness evidence prepared; independent accessibility review
is not self-approved.

Android review target: `melo-0.0.1-1-production.aab`, SHA-256
`6023B1A455907739B5EB6D7ABEA26B19212ADABF308170510ED2A50EB3E2A999`.

## Review scope

Representative high-risk native surfaces are: first launch/onboarding, Today and Today Mode, import
and review, Add/Log sheets, account/data controls, app lock, persistence/recovery notices, paywall,
Open Banking consent, and calendar/share/file-picker flows. The app uses React Native semantics and
does not require a web accessibility bridge for these surfaces.

## Current implementation evidence

- Shared `Sheet` marks the panel modal, hides the underlying portal tree while open, exposes a labeled
  close scrim, keeps content in a bounded scroll view, and uses safe-area/keyboard avoidance.
- Shared `ScreenHeader`, navigation actions and primary controls expose native button/header/link
  roles and labels; icon-only back/close controls have spoken labels and adequate hit targets.
- Text inputs have explicit labels/hints on import, money, date, bank, debt and plan forms. Disabled,
  selected and busy states are represented with `accessibilityState`.
- Recovery and persistence failures use alert/live-region semantics and plain-language actions.
- Reduced motion is read from the system preference and disables sheet, toast and companion motion;
  large text remains scrollable in sheets and the main surfaces use wrapping layouts.
- Decorative handles/glyphs are hidden from the accessibility tree where appropriate; charts expose
  summarized labels rather than requiring visual interpretation.

## Test/evidence commands

The focused release review suite was re-run on 31 August 2026: 12 files and 117 tests passed.
The candidate identity and current evidence index are recorded in
`RELEASE_REVIEW_HANDOFF_2026-08-31.md`.

```text
pnpm exec vitest run packages/ui/test/tokens.test.ts apps/mobile/src/folio/ui/Toast.test.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/shell/registryCoverage.test.ts apps/mobile/src/folio/sheets/appearanceSheet.test.ts
```

Existing Android evidence is retained under `docs/release-evidence/android-a11y-security-*.xml/png`
and `apps/mobile/evidence/android-today-batch1/`, including TalkBack-oriented hierarchy captures,
font-scale captures, dark/system appearance captures, recovery/import controls, and modal/sheet
flows. Exact-candidate emulator captures are under `docs/release-evidence/android-runtime/`; the
matching signed x86_64 tester completed onboarding, restart/background/Back, 2.0x font scale,
Remove animations and a real TalkBack focus pass. Reviewers should repeat the representative paths
with TalkBack, 1.3x/2.0x font scale, Remove animations, hardware keyboard, dark/light appearance and
back navigation.

## Reviewer reproduction checklist

1. Launch a disposable Android profile and enable TalkBack.
2. Traverse onboarding, Today, import/review, app lock, recovery notice and account/data controls
   using swipe navigation only; confirm order, names, roles and state announcements.
3. Open each representative sheet and confirm focus remains within the modal until dismissal; verify
   the scrim/close control is reachable and the underlying screen is not announced.
4. Set system font scale to 1.3x and 2.0x; confirm no clipped amounts, hidden destructive actions or
   unreachable inputs. Enable Remove animations and repeat sheet/toast/companion flows.
5. Exercise keyboard focus, validation/error states, destructive confirmation copy and file/share
   launchers without relying on color, gesture or animation.

## Known review gaps

This package does not claim independent TalkBack, VoiceOver, contrast or cognitive signoff. A physical
device pass is still needed for OEM-specific focus announcements, keyboard behavior, font metrics and
screen-reader speech. The reviewer should inspect the final signed binary, generated Android manifest,
and any newly added native module surfaces before issuing an independent decision. Internal emulator
evidence does not replace that independent decision.

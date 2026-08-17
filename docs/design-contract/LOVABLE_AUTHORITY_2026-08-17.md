# Lovable design authority — 17 August 2026

## One-product lineage

Melo has one shipping implementation: this repository's React Native application under
`apps/mobile`. The Lovable repository is the faithful UI/UX reference, not a second app and not an
engine/backend authority.

## Pinned reference

- Repository: `Thegamerdr/private-money-pilot`
- Branch: `main`
- Visual/source commit: `2f59c2f4`
- Authority-document commit: `6b76e027`
- Authority document: `docs/rn/DESIGN_AUTHORITY_2026-08-17.md` in the Lovable repository
- Native implementation branch: `codex/melo-one-app-convergence-2026-08-15`
- Native baseline before this pin: `ea91d98`

Every faithful-port commit after this record must name the Lovable visual/source commit it
implements. A later Lovable commit becomes authoritative only when this file is deliberately
updated; agents must not silently follow whichever preview happens to be newest.

## Navigation contract

- Personal: Today · Plan · Review · More
- Business: Today · Money · Review · More
- Melo is one persistent contextual companion, not a tab.
- Every retained destination has one tab owner; full-screen flows retain back/scroll ownership even
  when the tab bar is hidden.

## Translation boundary

Port the visible hierarchy, copy, spacing rhythm, states, typography intent, colours, icons and
motion intent faithfully. Translate web mechanics to native navigation, safe areas, Dynamic Type,
keyboard avoidance, accessibility APIs, platform billing/auth, haptics and file/share controls.

Do not port the Lovable chapter rail, phone mock-up, browser design tools or web-only preview
chrome. Do not replace tested native domain, persistence, security or account boundaries merely
because the design reference uses prototype state.

## Status discipline

- **Designed:** present in Lovable.
- **Implemented:** present in this native codebase.
- **Connected:** backed by the real native engine/service boundary.
- **Validated:** exercised on an appropriate runtime/device with recorded evidence.

Never collapse these into one completion claim.

## Current implementation order

1. Personal shell and reference primitives.
2. Personal Today, Plan, Review and More hubs.
3. Consolidated Adjust Path, intake/evidence, account, Money Sources and Data & Security journeys.
4. Narrowed Business Today, Money, Review and More.
5. Authored Melo asset replacement and event integration without cloning the companion.
6. Android/iPhone release validation. Lack of current macOS/iPhone or Galaxy S9 access is recorded,
   not treated as permission to stop other work.

Arbitrary visual redesign during the port is prohibited. Record a discrepancy and obtain an owner
decision before changing the pinned design direction.

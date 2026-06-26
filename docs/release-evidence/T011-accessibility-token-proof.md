# T011 Accessibility Token Proof

## Phase / task IDs

Phase 0. Primary task slice: T011, "Establish V2 design-token sandbox".

## What was built

- Expanded `@folio/ui` from a minimal token object into a typed token sandbox for mobile UI primitives.
- Preserved `folioTokens.size.touchTarget` for current consumers while raising it from 44 to the native 48dp policy.
- Added typed exports for color roles, typography roles, spacing, interaction states, motion preferences, semantic statuses, hit-target policy and money text rules.
- Added helpers for Agent B/mobile consumers: `meetsNativeHitTarget`, `getInteractionStateTokens`, `getMotionPreferenceTokens` and `getSemanticStatusTokens`.
- Added focused Vitest coverage for the accessibility-critical token invariants.
- Published editable Figma evidence from the repo token decisions:
  - main board: `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=1-3`
  - mobile proof frame node: `1:54`
  - Huashu gate node: `1:111`

## Files changed

- `packages/ui/src/index.ts`
- `packages/ui/src/tokens.ts`
- `packages/ui/test/tokens.test.ts`
- `packages/ui/dist/src/index.js`
- `packages/ui/dist/src/index.d.ts`
- `packages/ui/dist/src/tokens.js`
- `packages/ui/dist/src/tokens.d.ts`
- `packages/ui/dist/test/tokens.test.js`
- `packages/ui/dist/test/tokens.test.d.ts`
- `packages/ui/dist/tsconfig.tsbuildinfo`
- `docs/release-evidence/T011-accessibility-token-proof.md`

## Contracts implemented

- Color roles separate app backgrounds, surfaces, text, borders and accents instead of forcing consumers to reuse raw brand colors.
- Typography roles include Dynamic Type policy, zero letter spacing, line-height guardrails and a dedicated money role with tabular numeric rendering.
- Spacing uses a 4dp base unit with named layout gaps and a 48dp scale value.
- Native hit-target policy requires at least 48dp by 48dp visual or invisible hit area for controls.
- Focus, pressed and disabled states have explicit visual tokens and behavior policy.
- Reduced motion has a zero-duration `reduce` preference that disables transforms and decorative loops.
- Semantic statuses define color plus required icon, label, shape/pattern and screen-reader prefix.
- Money text rules require integer minor-unit alignment, ISO currency awareness, locale-derived fraction digits, no binary floats, no digit clipping and tabular no-wrap rendering.

## Huashu critique gate

Design context: 8/10. The tokens are grounded in the existing Folio source package: local-first financial clarity, vulnerable-user support, reduced motion, color-independent status meaning and unclipped money values.

No AI slop: 8/10. Avoided purple gradients, decorative icon spam, neon dark-mode defaults and filler stats. The palette is restrained and role-based. Native/system typography is intentional for app readability, not a marketing-page default.

Hierarchy: 8/10. Text roles create clear caption/body/title/display/money levels, and status roles distinguish information urgency without relying on red-only signaling.

Craft: 8/10. The 4dp spacing grid, 8dp radius, 48dp targets and state tokens are consistent. Critical issue found: the inherited 44px touch target missed the requested native 48dp floor. Fixed in `folioTokens.size.touchTarget` and `folioTokens.hitTarget.minimumDp`.

Functionality: 9/10. Tokens are directly consumable by Agent B/mobile without editing `apps/mobile`; the old `folioTokens.size.touchTarget` path remains stable.

Originality: 7/10. This is deliberately conservative infrastructure, but the money rendering and non-color status affordances give Folio-specific character instead of generic app theming.

Critical issues identified and fixed within owned files:

- Minimum target was 44 instead of 48. Fixed and covered by tests.
- Status colors previously had no non-color affordance contract. Fixed with icon, label, shape/pattern and screen-reader prefix tokens.
- Money rendering had no token-level guardrails for Dynamic Type or clipping. Fixed with tabular numeric, no-wrap and integer-minor-unit rendering rules.

## Tests run and results

Commands:

```text
pnpm --filter @folio/ui typecheck
pnpm vitest run packages/ui/test/tokens.test.ts
pnpm typecheck
pnpm test
C:\dev\folio-v2-greenfield\node_modules\.bin\tsc.cmd -b tsconfig.packages.json --pretty false
C:\dev\folio-v2-greenfield\node_modules\.bin\vitest.cmd run --passWithNoTests
C:\dev\folio-v2-greenfield\node_modules\.bin\prettier.cmd --write packages/ui/src/index.ts packages/ui/src/tokens.ts packages/ui/test/tokens.test.ts
C:\dev\folio-v2-greenfield\node_modules\.bin\prettier.cmd --write docs/release-evidence/T011-accessibility-token-proof.md
C:\dev\folio-v2-greenfield\node_modules\.bin\prettier.cmd --check packages/ui/src/index.ts packages/ui/src/tokens.ts packages/ui/test/tokens.test.ts docs/release-evidence/T011-accessibility-token-proof.md
C:\dev\folio-v2-greenfield\node_modules\.bin\tsc.cmd -b packages/ui/tsconfig.json --pretty false
C:\dev\folio-v2-greenfield\node_modules\.bin\vitest.cmd run packages/ui/test/tokens.test.ts
```

Results:

- Initial `pnpm --filter @folio/ui typecheck`: passed.
- Initial `pnpm vitest run packages/ui/test/tokens.test.ts`: passed, 4 tests.
- Later root integration after pnpm build-approval fix: `pnpm run ci` passed.
- Direct UI TypeScript: passed.
- Direct UI Vitest: passed, 1 file and 4 tests.
- Direct repo Vitest: passed, 2 files and 8 tests.
- Prettier write/check on owned source, test and evidence files: passed.

## Offline evidence

The token package has no runtime network requirement. The root `pnpm` verification attempts performed dependency resolution; targeted UI typecheck and direct Vitest verification ran against local workspace code.

## Accessibility evidence

- 48dp native hit target is asserted in tokens and tests.
- Reduced motion is asserted in tokens and tests.
- Status meaning is color-independent by contract and test-covered for every semantic status.
- Money text rendering is test-covered for tabular no-wrap rendering, integer minor units, no binary floats and locale-derived fraction digits.
- Real VoiceOver/TalkBack and rendered iOS/Android evidence remain future T012/T023 work.

## Security/privacy impact

- No real financial data, telemetry, network calls or account state were added.
- Money rules reinforce integer minor-unit display and privacy masking, but do not perform financial calculations.
- No V1 donor code, assets, screenshots or layout material were imported.

## V1 donor items used and approval reference

None.

## Screenshots/recording where visible

Editable Figma evidence exists at `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=1-3`. It mirrors the token proof screen, semantic statuses, typography roles, 48dp target and Huashu critique. The repo remains the source of truth.

## Known limitations/risks

- Manual native accessibility proof still requires mobile shell rendering on iOS and Android.
- Contrast ratios should be mechanically audited once concrete components apply these roles over real surfaces.

## Next exact step

Agent B can consume `@folio/ui` tokens in mobile primitives while preserving the 48dp target, reduced-motion preference, non-color status affordances and money text rules.

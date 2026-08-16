# Melo living companion — mobile implementation evidence

Date: 2026-08-15
Authority before this change: `d5c1ae761f2f234575fc28d638522cc9ffb266ca`

## Product and design authority

- `apps/mobile` is the single authoritative Melo application runtime.
- Android and iPhone are first. Desktop is later.
- The connected Lovable product is the faithful UI/UX reference. This change does not introduce a
  new navigation model, restyle screens, reorder product content, or create a competing web app.
- Screen edits are limited to registering existing visual regions as semantic perches/exclusions,
  yielding duplicate inline mascot instances while the persistent companion occupies that same
  reserved space, and emitting truthful product events.
- Melo is both the product name and the companion name.

## What is implemented

### One portable behaviour engine

`packages/melo-companion-engine` now owns:

- one persistent instance identity across route changes;
- collision-safe placement using real shell bounds, semantic perches, protected exclusions, and a
  hide-if-unsafe fallback;
- bounded wait, enter, peek, move, settle, leave, sleep, wake, concern, reassurance, result, and
  positive-reaction choreography;
- salience and dwell-based attention so incidental scrolling cannot steal meaningful gaze;
- bounded, deterministic, silent idle behaviour with refractory periods and no immediate repeats;
- event priority, interruptibility, coalescing, expiry, and persistent cooldown memory;
- quiet mode, tuck, deliberate tap, drag-to-nearest-safe-perch, reduced motion, modal/keyboard/app
  lifecycle suppression, and calm recovery;
- non-gamified familiarity: familiarity makes Melo quieter and less performative, never stronger;
- dismissal-aware contextual offer cadence without XP, streaks, prizes, or fabricated intimacy;
- durable behavioural memory that excludes financial values and personally identifying data;
- truthful one-cosmetic wardrobe capability metadata and deterministic static fallbacks;
- a variable-duration frame-sequence player ready for approved authored motion later.

The engine suite includes a 320-step mixed Personal/Business simulation and the regression where a
perch enters the viewport after an initially unsafe route placement.

### One persistent React Native host

`MeloCompanionHost` is mounted once around the existing `FolioShell`. It:

- retains one engine instance through Personal and Business navigation;
- uses the device/application viewport rather than browser or preview-canvas coordinates;
- measures screen-owned React Native views and refreshes those measurements after scroll/layout;
- protects the status bar, bottom navigation, monetary hero regions, charts, and registered content;
- hides during blocking sheets, keyboard use, backgrounding, unsafe geometry, tuck, and quiet mode;
- animates route-space movement without remounting the companion;
- supports tap for contextual Melo help, drag to a safe semantic perch, and long-press to tuck;
- persists behaviour and user preference through the mobile persistence adapter;
- suppresses duplicate inline mascot artwork only while the root companion genuinely owns a safe
  visible perch;
- restores inline artwork when no root perch is safe, preventing blank holes in the Lovable-derived
  layouts.

### Context and truthful event integration

The mobile app now supplies companion context from existing, Lovable-derived mascot/empty-space
slots on Today, Personal More, Business Today, Business Review, and Business More. It deliberately
does not enlarge or rearrange generic headers merely to force Melo onto every screen. Existing
product actions emit explicit Melo reaction events rather than relying on DOM/text inspection or
arbitrary page-load celebrations. Wired areas include Today, Calendar, Plans, Pots, Subscriptions,
Timeline, Insights, Personal More, Business Today, Business Review, Business More,
runway/money/invoice/VAT/filing operations, wardrobe, and app-store mutations that produce real
financial outcomes.

Tap opens the existing Melo chat. The screen-specific prompt is prefilled; no second chatbot is
created. A runtime defect found during verification—rendering the internal action key
`today.explain` as visible assistant copy—was removed.

### Wardrobe truth

The shipped artwork can truthfully display only one full-body cosmetic at a time. The app does not
claim layered or animated attachment support. Unsupported animated combinations retain the user
preference but render through an honest base/static fallback.

## Runtime defects caught and fixed during device verification

1. If a semantic perch began off-screen, Melo hid safely but did not return when that perch later
   scrolled into view. `reconcilePerch()` now restarts the bounded entrance when a safe late perch
   appears.
2. Inline Melo artwork could remain suppressed after the root companion hid because the visibility
   context did not react to presence changes.
3. Making the registration context depend on presence caused anchors to unregister and re-register
   continuously. Visibility ownership is now a separate context, leaving measurement registration
   stable.
4. The root layer could become visible during the waiting period. Waiting now remains visually
   silent until the bounded entrance begins.
5. Contextual tap exposed an internal action identifier as assistant text. Only the user-facing
   contextual prompt is now sent to Melo chat.

## Verification completed

- `pnpm --filter @folio/melo-companion-engine test`: 45/45 passed.
- `pnpm test`: 235 files, 2,719 tests passed.
- `pnpm typecheck`: passed for packages, mobile, services, and public site.
- `pnpm lint:boundaries`: passed.
- `pnpm check:v1-boundary`: passed.
- `pnpm check:samples`: passed.
- `pnpm check:constitution`: passed.
- Android release build: passed with Expo/React Native production bundle and x86_64 emulator ABI.
- Android runtime on `emulator-5554`: populated Today screen, scroll-to-late-perch entrance,
  shell-safe placement, faithful 28px reference-slot sizing, inline/root ownership handoff, and
  contextual tap were visually exercised.
- Android runtime log inspection found no app `FATAL EXCEPTION` or React Native JavaScript error.
- Reduced-motion, suppression, route, priority, persistence, dismissal, drag, wardrobe, and fallback
  invariants are covered by the portable engine tests.

`pnpm check:product-gates` still fails on pre-existing terminology in untouched
`packages/domain/src/trustedCore.ts`: the canonical gate rejects its `confidence` type/property name.
This companion change does not conceal or opportunistically rename that product-domain contract.

## Exact remaining art-only work

The runtime is intentionally using the approved canonical static Melo renderer. It does not pretend
that local transform prototypes are authored animation. A top-quality living performance still needs
founder-approved, identity-locked A+ assets for:

1. complete peek/entry;
2. result acknowledgement;
3. short directional move/hop;
4. thinking loop;
5. small concern;
6. reassurance;
7. major positive milestone;
8. calm idle with irregular blink and feather follow-through;
9. tap acknowledgement;
10. waiting for user;
11. separate left/right guiding gesture;
12. major concern;
13. blocked/system error;
14. sleep loop and wake one-shot;
15. directional gaze left/right/up/down;
16. long take-off, flight, and landing set in both directions;
17. offline/unavailable;
18. animated wardrobe attachment landmarks for head, face, neck, body, wing, and tail.

Local experimental frames are not bundled into the authoritative app because only three clips were
even classed as guarded candidates, none had founder visual approval, and the remainder were
reference-only whole-character transform work. Integrating them would make the character move, but
would not honestly make the production companion top quality.

## Remaining platform evidence

- Screens without an existing approved mascot/empty-space slot intentionally hide the persistent
  instance. Adding visible perches there requires a Lovable design decision; the runtime will not
  invent a header layout or overlay coordinates on its own.
- iOS shares the TypeScript engine and host code, but an iOS simulator/device build cannot be run on
  this Windows machine. A signed macOS/iPhone pass is still required.
- Physical low-end Android, VoiceOver/TalkBack, large-text/200% zoom, forced-colour, and long-session
  battery/performance acceptance remain release evidence tasks.
- Dedicated authored animated cosmetics do not exist.

## Honest completion estimate

- Behaviour engine and state policy: **about 95%**.
- React Native host integration and truthful interaction wiring: **about 80–85%**.
- Approved production character motion and animated wardrobe: **about 20–30%**.
- Overall top-quality living-companion outcome: **about 65–70%**.

The remaining gap is predominantly professional character animation and final iOS/accessibility
evidence, not another state-label or wrapper pass.

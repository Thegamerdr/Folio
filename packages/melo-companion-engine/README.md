# Melo Companion Engine

Portable runtime logic for the Melo companion. The package deliberately contains no
browser, React, React Native, Rive, or Lovable dependencies. A host app supplies
measurable anchors/exclusions, persistence, clock, and a renderer adapter.

The engine owns the behavior that makes Melo a companion rather than a
floating overlay:

- one persistent instance ID across navigation;
- leave → wait → enter → peek → settle route choreography;
- priority-aware, cooldown-limited application events;
- collision-safe placement with a legitimate hide fallback;
- semantic attention targets and gaze direction;
- typing/modal/background suppression;
- tucked, quiet, reduced-motion, resting/wake, drag-to-nearest-safe-perch, wardrobe,
  relationship memory, and persistence behavior;
- persisted reaction cooldown history so a remount does not immediately replay
  the same ambient or financial reaction;
- visual-state fallback without blank frames;
- explicit alias resolution for every host art-contract state, carrying the
  contract status and provenance so prototype fallbacks cannot be mistaken for
  authored production animation;
- contextual bubbles carrying the current screen action;
- event-driven financial reactions with a thinking watchdog;
- a portable Personal/Business event vocabulary of 79 constants, including
  aliases and lifecycle events, with every declared reaction event resolving
  to a visual state. This is an engine contract, not proof that all 79 events
  have live product producers in the host application;
- data-only screen profiles for attention, financial context and useful tap
  actions.

The living-behaviour layer is deterministic and inspectable. `snapshot()` now
also exposes:

- `personality`: the invariant calm/observant/supportive character principles;
- `behaviorPolicy`: relationship-aware cadence and silence limits;
- `behaviorMemory`: recent reactions/screens and offer outcomes;
- `attention`: a salience-scored target with a finite dwell time;
- `activeReaction`: priority, interruptibility and expiry of the current beat;
- `routeMotion`: explicit `fromRect`, `toRect`, direction and choreography phase;
- `idle`: the next scheduled ambient beat and previous idle choice;
- `lifecycle`: suppression reasons and whether animation should be paused;
- renderer wardrobe truth (`wardrobeRequested`, `wardrobeApplied`,
  `wardrobeSupported`) rather than silently claiming a cosmetic is present.

Familiarity is not XP. It unlocks nothing, has no streak and is never a reward
surface. It only makes Melo less performative: repeat routes settle quietly,
ambient beats become less frequent, and proactive help is offered less often.

## Behaviour rules

- Meaningful attention has dwell. Incidental pointer/scroll activity cannot
  steal gaze from a higher-salience result or warning.
- Ambient actions are deterministic, limited per time window, never speak, and
  are disabled by quiet mode and reduced motion.
- Similar burst events coalesce by semantic family. Cooldowns persist across a
  remount, and stale queued reactions expire.
- A low-priority success cannot interrupt a major concern. Completion,
  lifecycle and critical events can always interrupt when required.
- Proactive bubbles have per-session, per-screen and dismissal-aware silence
  limits. A deliberate tap still opens contextual help in quiet mode.
- Route changes expose leave/move/settle geometry without changing the
  persistent instance ID. Reduced motion places the stable pose directly.
- Typing, blocking modals, tucked state and background lifecycle pause or hide
  the companion without losing durable preferences or active analysis state.

## Integration contract

The host remains responsible for producing truthful geometry and product
events. The engine does not inspect DOM text, invent financial facts, or infer
success from route loads.

Required host inputs:

1. Keep one `CompanionEngine` instance at the application shell/root.
2. Call `setShell(rect)` with the actual in-app viewport, not the browser or
   preview canvas.
3. Register screen-owned anchors and every protected monetary/control/chart
   rectangle. Update registrations on layout/scroll changes.
   Dragging is a preference over those safe semantic perches; the engine never
   persists arbitrary viewport coordinates that can later cover changing content.
4. Call `navigate(screenId, { attentionTarget })` after destination layout is
   measurable. Animate `routeMotion.fromRect -> routeMotion.toRect` while the
   engine reports `moving`.
5. Emit explicit, truthful events. Use `priority`, `intensity`, `source`,
   `attentionTarget`, `contextAction`, and optional `salience` where known.
6. Reflect focus, keyboard/modal and app visibility with `setOptions()` or the
   corresponding lifecycle events.
7. Pause the frame player whenever `renderer.animationPaused` is true.
8. If `renderer.wardrobeSupported` is false, retain the declared single active
   cosmetic in UI state and use an honest static wardrobe fallback or show the
   base performance without claiming the cosmetic is visible.
9. Map `bubble.prompt` and `screen` into the existing Melo assistant; do not
   create a second chatbot.
10. Honour `accessibility`, `reducedMotion`, `tucked` and `quiet` as user
    settings.

Host acceptance must still check real rendered rectangles, focus management,
keyboard size changes, screen-reader interaction, and representative Personal
and Business event producers. Those cannot be proven by this portable package.

## Host integration

1. Register screen-owned anchors with a `screen`, `rect`, `placement`, and
   `priority`.
2. Register monetary/control/chart exclusions with a `screen`, `id`, and `rect`.
3. Call `navigate(screen, { attentionTarget })` on route changes without creating
   a new engine.
4. Feed product events through `emit({ type, priority, intensity, source })`.
5. Subscribe to snapshots and render `presence`, `placement`, `visualState`,
   `attentionTarget`, `bubble`, and `renderer`.
6. Keep the renderer manifest optional. The engine accepts labelled static
   fallbacks today and can adopt approved A+ clips later without changing its
   state, event, placement, or persistence contracts.

## Production-art boundary

This package intentionally ships no character artwork, motion atlas, Rive file,
or Lottie file. The React Native host currently maps engine performances to the
canonical static Melo component, so every state remains visible and truthful
without claiming that approximate prototype motion is production animation.

Local motion experiments exist outside this authoritative worktree. They are
review material only: they are not dependencies of this package, are not bundled
into the app, and are not founder-approved production assets. Distinct authored
A+ performances and animated wardrobe attachment landmarks remain an art task.

Run `npm test` from this directory. The suite covers deterministic engine and
frame-player behaviour, including placement, attention, priorities, silence,
memory, route choreography, lifecycle suppression, reduced motion, wardrobe
truth, persistence, and long mixed Personal/Business simulation. It does not
claim visual approval or replace host-application end-to-end testing.

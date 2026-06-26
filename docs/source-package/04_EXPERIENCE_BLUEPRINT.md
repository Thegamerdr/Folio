# Mobile Experience Blueprint

## Interaction model

Folio is a hybrid of:

- Melo and today's briefing;
- a human-readable timeline/feed;
- a money-aware calendar/planner;
- clear visual position and progress;
- normal browseable screens for detail;
- search and quick simulation.

Melo is mandatory as a product personality and interpretation layer, not as a compulsory chat box. A user can navigate, import, inspect and edit everything without holding a conversation.

## Primary mobile navigation

Recommended personal workspace navigation:

1. **Today** — Melo briefing, current position, next important event, progress and timeline.
2. **Calendar** — today/week/month, planner tasks, financial and life events.
3. **Money** — accounts, transactions, bills, budgets, debt and documents.
4. **Plans** — optional goals, milestones, rules and scenarios.
5. **Melo entry point** — persistent, accessible action from every tab rather than a fifth data silo.

Global search and workspace switch remain available from the top-level shell.

## Today screen

The Today screen is a flowing briefing, not a grid of dashboard widgets.

Suggested order:

1. Melo greeting and one-sentence state.
2. The most important current number, such as available money before the next anchor date.
3. Next important event and date.
4. “What changed” since the last meaningful review.
5. Budget or plan progress, only when configured.
6. Today’s tasks and calendar strip.
7. Timeline items.
8. One bounded suggested action or question.

When the user is stable, the screen is calm and short. When the month is difficult, it expands into a recovery explanation without overwhelming the user.

## Detail screens

Detailed financial views can contain tables, charts and filters, but each view begins with a plain-language conclusion and exposes the underlying evidence. Charts never become the only way to understand a state.

## Visual language

The dominant metaphor is **journey + timeline + companion**.

- Time flows visibly from past facts to upcoming events and future milestones.
- Melo changes state according to context: welcoming, observing, focused, celebrating, checking, calm, concerned and recovering.
- Progress animation is tied to actual changes.
- Personal and business spaces use explicit labels, icons and structural differences; never color alone.
- Red is not used as punishment. Risk states include text and explanation.

## Bad-month experience

A bad month screen follows this sequence:

1. **What changed** — factual event.
2. **Immediate impact** — amounts and dates.
3. **What remains covered or unchanged** — prevents catastrophising.
4. **Which plans or budgets move** — transparent cascade.
5. **Updated path** — new dates or shortfall.
6. **Review choices** — user decides what to change.

Melo says, in effect: “Okay. Something changed. Let’s work from where things are now.”

## Fun without trivialisation

- real milestones;
- small mascot reactions;
- optional micro-challenges that teach or reveal something useful;
- satisfying plan movement;
- historical “look how far you came” moments;
- optional reflective mini-games using fictional money, never the user's real funds as a gambling mechanic.

Disable playful pressure during severe shortfall, arrears, vulnerability or explicit user preference.

## Accessibility baseline

Common tasks must work with VoiceOver and TalkBack, large text, voice control/switch access where applicable, reduced motion and without color. Touch targets, focus order, custom controls and mascot interactions require explicit accessibility semantics. Target WCAG 2.2 AA principles for the mobile product and validate Apple's Accessibility Nutrition Labels honestly.

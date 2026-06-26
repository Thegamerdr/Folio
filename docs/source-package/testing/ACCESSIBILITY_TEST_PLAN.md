# Accessibility Test Plan

## Target

Meet current Apple/Android accessibility expectations and WCAG 2.2 AA principles for applicable mobile content. Accessibility is a release property, not a final audit.

## Critical journeys

Test with VoiceOver and TalkBack:

- first launch and labelled preview;
- create/unlock/recover local vault;
- import/review/commit statement;
- read Today briefing and explanation;
- add/edit transaction/event;
- inspect forecast assumptions;
- create/rebase plan;
- use calendar/planner;
- review/accept/reject Melo proposal;
- export/delete data;
- switch personal/business workspace.

## Visual and text

- dynamic type/large font without clipping or hidden actions;
- text reflow and landscape where supported;
- sufficient contrast;
- status never communicated by colour alone;
- charts include textual summaries and data tables;
- currency/date signs read unambiguously;
- content remains usable with bold text and increased contrast.

## Interaction

- minimum touch target sizes;
- logical focus order and focus restoration;
- labelled controls, headings and landmarks;
- no gesture-only action;
- destructive/financial actions require accessible confirmation;
- time limits avoidable/extendable;
- keyboard/switch-control path where platform supports it.

## Motion/audio/haptics

- reduced-motion mode replaces non-essential movement;
- no flashing content;
- haptics never sole signal;
- audio/voice has text alternative;
- Melo animations do not block content or focus;
- mini-games have non-game alternative and no required dexterity.

## Cognitive/numeracy safety

- plain language;
- one primary action per step;
- explain abbreviations and financial terms;
- chunk complex calculations with provenance;
- known/expected/uncertain labels are consistent;
- errors explain recovery, not blame;
- no forced rapid decisions;
- user can review before commit.

## Automation and manual coverage

Use static linting/component tests for labels/roles/contrast where possible, but require real-device assistive technology testing. Include disabled and financially stressed users in usability studies with appropriate safeguarding and compensation.

## Acceptance

No critical journey may depend on sight, colour, precise gesture, hearing, animation or cloud AI. Accessibility regressions block release.

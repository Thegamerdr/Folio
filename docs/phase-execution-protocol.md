# Phase Execution Protocol

Folio V2 is executed phase by phase. A phase is complete only when every task in that phase is complete or explicitly blocked with evidence, owner and next condition.

## Rules

- Do not advance to the next phase on a partial task slice.
- Use multi-agent work only with disjoint ownership and one integrating agent.
- Keep V1 donor material outside V2 runtime source until a donor row is approved.
- Treat repo contracts and source-package policies as higher authority than every skill.
- UI/UX work requires Huashu review evidence before completion.
- Figma is an editable evidence surface, not the source of truth. Repo tokens and contracts lead; Figma mirrors them.

## Phase closeout

Each phase closeout must include:

- task IDs completed or blocked;
- changed files;
- evidence docs;
- tests and command results;
- offline behavior notes;
- accessibility notes;
- security/privacy notes;
- V1 donor records used or confirmation that none were used;
- blockers with exact unblock condition.

## Multi-agent ownership

Parallel agents must be assigned non-overlapping file or subsystem ownership. The integrator resolves conflicts, runs final checks and writes the checkpoint record.

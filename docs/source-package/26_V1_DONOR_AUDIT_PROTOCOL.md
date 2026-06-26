# Folio V1 Donor Audit Protocol

## Non-negotiable framing

Folio V1 is a donor/reference product. Folio V2 is not a refactor, migration branch, redesign layer or feature expansion of V1.

The V2 agent must first create and pass the greenfield architecture. Only then may it inspect V1 to identify reusable assets.

## What may be donated

Potential donor categories:

- mascot illustrations, poses and animation concepts;
- validated visual tokens;
- polished accessible components;
- icons and brand assets;
- useful copy/personality fragments;
- test fixtures;
- calendar/planner interaction ideas;
- existing finance domain logic that independently passes V2 contracts;
- export/import format samples.

## What cannot be inherited without re-derivation

- database schema;
- navigation/information architecture;
- dashboard assumptions;
- onboarding flow;
- AI prompts/agent logic;
- auth/cloud coupling;
- personal/business mixing;
- unverified calculations;
- state-management shortcuts;
- insecure storage;
- V1 naming that contradicts V2 concepts.

## Audit workflow

1. Freeze V1 and record commit/deployment.
2. Build inventory without copying.
3. Classify each item:
   - reuse unchanged;
   - adapt behind V2 contract;
   - reference only;
   - reject.
4. Record dependencies, licence/provenance, accessibility, tests and security concerns.
5. Recreate or copy only after its target V2 module exists.
6. Require visual/behavioral regression review.
7. Delete any donor code that forces V1 architecture into V2.

## Donor acceptance questions

- Does it fit the V2 constitution?
- Is it less expensive/safer to reuse than recreate?
- Can it operate offline?
- Does it respect workspace isolation?
- Is it accessible?
- Is its dependency tree maintained?
- Does it have tests or can tests be added first?
- Does it introduce dashboard/advice/setup-heavy behavior?
- Can it be removed later without domain damage?

## Agent language

Forbidden implementation language:

- “upgrade the existing dashboard”;
- “add the new engine to the current schema”;
- “keep the existing flow for speed”;
- “reuse most of V1 and patch gaps.”

Required language:

- “implement V2 contract in the greenfield repository”;
- “evaluate V1 artifact as a donor after the contract passes”;
- “replace donor code if it conflicts with V2 invariants.”

## Migration of existing users

If V1 has real users/data, migration is a separate import adapter:

```text
export V1
→ stage as an external source
→ validate/map/reconcile
→ user review
→ import to V2
```

Never point V2 at the V1 database and mutate it in place.

# ADR-016: Material-change causality owns What Changed

## Status

Accepted.

## Decision

`MaterialFinancialChange` is the canonical deterministic contract for consequential answer changes. `WhatChangedRow` reads material changes first and keeps timeline/import summaries as compatibility fallback.

## Consequences

- “What changed?” can explain causality after relaunch.
- Generic wording is avoided when a material cause is known.
- Non-material changes are excluded unless review or receipt invalidation is required.
- Rich grouping UI is deferred.

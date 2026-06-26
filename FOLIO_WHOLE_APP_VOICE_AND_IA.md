# Folio Whole-App Voice And IA

Date: 2026-06-24

This note records the V2 whole-app simplification pass. It is a product guard for the current app, not a roadmap.

## User Mental Model

The app should ask the user to understand five plain steps:

1. Start with what you have.
2. Review what Folio found.
3. See your picture.
4. Understand what changed.
5. Try a safer plan if needed.

Users should not need to understand internal object names, storage history, parser internals, or evidence architecture before they can use the app.

## Primary IA

Primary navigation is:

- Start
- Review
- Today
- More

Start is where the user adds information.

Review is where uncertain or imported rows wait before they affect the money view.

Today is the current picture from reviewed records.

More contains Timeline, Calendar, Plans, Data Control, Dogfood Mode and Settings-style controls.

## Copy Rules

Preferred words:

- picture
- review
- source
- added
- ignored
- saved
- changed
- check
- plan
- possible
- needs review

Avoid in visible product copy:

- canonical
- provenance
- parser
- indexed
- financial reality
- make real
- recovery scenario
- event graph
- confidence score
- AI detected
- judgement or judgment language

## Melo Voice

Melo helps with the next action. Melo does not explain the system.

Good:

```text
I found rows that look like bills and income. Review them before they change your picture.
```

Bad:

```text
I analysed your canonical financial reality.
```

Melo may answer:

- what happened
- what needs review
- what changed
- what the user can check next

Melo must not directly write plan, transaction or recovery changes.

## Review-First Import Rule

A bank input contains source rows and transaction claims. It does not contain final events.

Correct chain:

```text
source file/text/screenshot
-> staged rows
-> reviewed transactions
-> accepted money movements
-> grouped meanings/events where justified
-> Today/Timeline/Plans updated
```

Today must be honest while review is pending:

```text
You have 42 rows waiting for review.
Your picture may change after review.
```

Unreviewed rows may appear as review items only. They must not affect balance, breathing room, plan pressure, recovery, or timeline facts.

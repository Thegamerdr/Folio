# Bad-Month Case Study

## Starting position

A user is paid weekly, has £620 available, a protected £500 buffer, rent already reserved, and an accepted debt plan estimated to complete on 18 October.

## Unexpected event

The car requires a £420 repair today.

## Incorrect product response

```text
Budget exceeded.
You failed this month.
Cut spending immediately.
```

This is unhelpful, potentially advice-like and emotionally unsafe.

## Correct Folio flow

### 1. Capture naturally

The user can type or say: “My car has cost £420 unexpectedly.”

Melo extracts a proposed event:

```text
Unexpected car repair
£420 outflow
Today
Personal workspace
Possible category: vehicle repair
```

The user confirms/edits it.

### 2. Recalculate deterministically

Folio commits the transaction/event, rebuilds the forecast, budget availability, plan versions, calendar reminders and briefing candidates.

### 3. Present truth in layers

```text
What changed
Your available cash is £420 lower.

What it affects
The protected buffer falls from £500 to £80.
The current debt-plan range moves from 18 October to 8–22 November.

What is still okay
Rent and all confirmed minimum payments before the next payday remain covered.

What happens next
Your next confirmed payday is Friday.
The updated plan can recover the buffer before resuming the old contribution level.
```

The final line describes the current plan logic or user-selected rule, not an unsolicited recommendation.

### 4. Offer scenario controls

- Keep the target date and compare required contributions.
- Keep current contributions and accept the later range.
- Pause the plan for one cycle.
- Edit the event if details are wrong.
- Leave the plan unchanged for now.

Each option shows consequences. The user chooses.

### 5. Melo accountability

In balanced mode:

> “This is a setback, not a verdict. The important payments are still covered, and the new timeline is visible. Review the plan when you’re ready.”

In accountability mode:

> “The repair changed the plan by roughly three weeks. Review the contribution/date trade-off before Friday so the plan reflects reality.”

## Recovery over time

When the user rebuilds the buffer, Folio marks real milestones:

- unexpected event recorded rather than avoided;
- essential obligations remained covered;
- buffer restored;
- plan resumed;
- final goal achieved.

The annual timeline then becomes proof of resilience rather than a list of red numbers.

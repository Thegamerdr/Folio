# Calendar and Planner

## Product role

The calendar is a core experience and daily return surface. It connects time, money, plans and life. It is not merely a view of transactions and it is not intended to replace a full project-management platform.

## Internal calendar first

Folio maintains its own calendar so it remains fully functional offline and without device-calendar permission.

Views:

- Today;
- Week;
- Month;
- Timeline;
- Plan-specific schedule;
- Business-specific calendar when in a business workspace.

## Calendar item types

- financial event;
- life event;
- business event;
- task;
- reminder;
- time block;
- milestone;
- recurring routine.

A non-financial event can exist without an amount. If it later affects money, the user or Melo can link an estimated/actual cost, plan or transaction.

## Example connections

```text
Holiday event
↔ holiday funding plan
↔ flight/hotel transactions
↔ tasks and reminders
↔ forecast impact
```

```text
Work shift
↔ expected income occurrence
↔ payday event
```

## Planner scope

The first complete planner supports:

- title, notes, dates/times and duration;
- recurrence;
- checklist;
- priority and status;
- reminders;
- linked financial entities/documents;
- lightweight day planning and drag/reschedule;
- search and archive.

It does not initially support Gantt charts, complex dependencies, team boards or arbitrary database views.

## Recurrence

Use RFC 5545-style `RRULE`, `RDATE` and `EXDATE` semantics. Store the original time zone for local-time events. Generate occurrences on demand plus a bounded materialised window. Handle daylight-saving transitions explicitly.

## External calendar integration

Progressive permission model:

1. Internal calendar requires no permission.
2. “Add to Apple/Google calendar” uses the system handoff or write-only capability where available.
3. Full calendar read/sync is requested only when the user explicitly chooses import or two-way integration.

Imported external events carry source identifiers and are not treated as financial facts. Folio asks before attaching financial meaning.

## Dynamic cascading

When a linked event date or amount changes:

- future recurrence instances regenerate;
- affected reminders reschedule;
- forecasts recompute;
- budgets and plans update;
- Melo creates one concise change explanation;
- accepted historical occurrences remain unchanged.

## Reminder reliability

Important reminders are scheduled locally in advance when the underlying data changes. The app never assumes iOS or Android will execute background work at an exact time. On app open, Folio reconciles missed/background changes and refreshes the briefing.

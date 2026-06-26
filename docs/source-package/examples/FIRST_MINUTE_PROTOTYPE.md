# First-Minute Prototype

## Objective

Within 60 seconds, a new user should understand what Folio feels like and either receive a truthful small answer or see a clearly labelled interactive preview. No account, permission, bank connection or full setup is required.

## 0–8 seconds: emotional safety

Screen:

```text
Melo
Money can feel like a lot.
We’ll start with only what helps right now.
```

Primary action: **Show me how Folio works**  
Secondary: **I already have something to add**  
Tertiary: **Explore privately**

Persistent trust note: “Your core records stay on this device unless you choose cloud features.”

## 8–25 seconds: choose value path, not user type

### Path A — Interactive preview

A labelled sample Today screen animates through:

- payday arrives;
- rent is reserved;
- one debt payment completes;
- a small unexpected cost changes the plan;
- Melo explains what changed and what remains covered.

The preview uses fictional data, carries a visible “Example” badge and cannot be mistaken for the user’s position.

### Path B — One real question

Prompt: “What do you want clarity on right now?”

Quick choices:

- Until my next payday
- A payment or purchase
- A debt balance
- What is due next
- Something changed

The chosen task asks no more than the minimum required information and produces a partial result with assumptions.

### Path C — Bring data

Choices:

- Bank statement/file
- Photo or PDF
- Add one payment manually
- Open Banking later

Only after selecting a source does Folio explain and request the necessary permission.

## 25–50 seconds: visible progress while importing

Importing should feel alive without fabricating completion:

```text
Reading 326 rows
Found 4 likely income payments
Found 9 repeating payments
3 items need your review
Building your first timeline
```

Melo can reveal one safe insight as soon as confidence is sufficient. The user can continue exploring while the import job runs and resumes after interruption.

## 50–60 seconds: first value

Real-data example:

```text
Here’s what Folio can confirm so far
£585 arrived on Friday
Rent usually appears near the 10th
Two payments repeat monthly

Before I treat those as future commitments, review these 3 items.
```

Minimal-data example:

```text
Based on the £220 you entered and the £95 payment before Friday,
you have £125 before other unlisted spending.
This is a partial view—not your full financial position.
```

## Entertainment principles

- Melo reacts visually to meaningful progress.
- Import steps reveal understandable discoveries.
- One optional tap-through scenario shows the product’s power.
- No fake loading, fake personalised insight, guilt or forced game.
- The user can skip animations and reduced-motion settings are respected.

## First-minute acceptance tests

- no sign-up wall;
- no permissions on launch;
- no compulsory goal/personality/business questionnaire;
- a path to value in two taps;
- example data unmistakably labelled;
- at least one route works fully offline;
- screen-reader and large-text path complete;
- every partial answer states missing scope;
- user can leave and return without losing imported staging progress.

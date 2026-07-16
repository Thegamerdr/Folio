# Melo — Phase 1 Prototype · Lovable requirement brief

Status: **not yet sent.** The Lovable MCP `create_project` call fails on this machine (error: `Cannot use 'in' operator to search for 'content' in false`; workspace `My Lovable` reports `billing_period_credits_limit: 0` after the 2026-06-17 unified-billing migration — reads work, message-sends fail). When the connector is healthy, send the brief below as the `initial_message` of a **new** Lovable project (do NOT build this inside `private-money-pilot` — that project stays the Folio design SoT). A working local reference implementation exists at `C:\dev\folio-v2-greenfield\prototypes\melo-phase1\index.html`; screenshots of it can be attached to guide Lovable.

Source of truth for the product: `C:\dev\folio-v2-greenfield\MELO_BLUEPRINT.md` (§3 mascot, §4 states, §5–6 UX, §9 onboarding, §11 visual).

---

Build "Melo — Phase 1 Prototype": a clickable validation prototype for a personal-finance companion app. Mobile-first — present everything inside a centered phone frame (~390px wide) on desktop. This is a PROTOTYPE: no backend, no auth, no database, no Supabase — all state is local/mocked in the client. Craft and feel matter more than feature count.

WHAT MELO IS (context): Melo computes the one number that matters — the Safe Zone: what's truly safe to spend after rent, bills, essentials, savings and a buffer, until payday — and carries it emotionally through a small mascot and a "money weather" system. Tone: calm, warm, honest, zero shame. This prototype must validate three things: (1) do people instantly understand the Safe Zone reveal, (2) does the mascot read ADULT (not childish), (3) does the home screen answer "am I okay?" in under 3 seconds.

BUILD THREE FLOWS:

1. ONBOARDING — six beats, one question per screen, under 90 seconds total:

- Cold open: just one line and one button. "I'm Melo. Two questions and I'll tell you what's _actually_ safe to spend." Button: "Let's do it". No carousel, no feature tour.
- Pick your Melo: three colorways of the same small creature — Ember (warm terracotta), Moss (sage green), Tide (dusty blue). Copy: "Pick your Melo. They all worry about you equally."
- Payday: date/pattern picker. "When does money arrive? Everything counts back from that day."
- Income: amount input. "Roughly what lands? Rough is fine — I round _down_ on your behalf."
- Big bills: UK preset chips (rent, council tax, energy, water, phone, broadband, subscriptions, car, debt) — tap a chip, enter a rough amount. The mascot visibly stacks each confirmed bill into a small chest as you add them. Copy: "Which of these are yours? These get protected first."
- THE REVEAL — spend the most craft here, it is the product's money moment: the Safe Zone number counts up from £0 (e.g. to £184), a soft weather sky forms behind it, a runway strip draws itself (today → payday with bill dots), and the mascot reacts with calm satisfaction. Copy: "£184 until the 12th. That's your real number — balance minus everything that's spoken for." Then a button into Home.

2. HOME — "the Glance Stack", top to bottom in one glance:

- Ambient weather sky header (soft gradient, subtle, changes with state)
- Mascot with exactly ONE speech line
- Huge Safe Zone number in tabular numerals ("£184" + "safe until Fri 12th"). Tapping it opens "show the math": a waterfall — balance − shielded bills − essentials − savings − buffer = Safe Zone
- Runway strip: today → payday as dots, bill markers on their days, payday flag at the end, a storm cell marker when in danger states
- ONE action card only (contents change with state)
- "Can I afford…?" input: typing an amount (e.g. 60) returns a verdict card — Safe / Tight / Not now / Safe on [date] — with "£71 left after" and the danger-date effect, plus a secondary button "Put it on the Shelf (24h)". Example verdict copy: "Safe — £71 left after, and Thursday stays sunny."
- A tiny-wins ticker line at the bottom, e.g. "✦ 3 checks-before-buying this week"

Add a small floating dev toggle (discreet, corner) that switches the whole app state between: Calm / Tight / Warning / Storm / Recovery / Fog. Everything reacts: sky, mascot emotion, speech line, action card, copy. State rules:

- Calm: sunny warmth. "Nothing needs you today." (the number carries the amount — don't duplicate it in the speech line)
- Tight: cloudy. Per-day number promoted: "£41 to Friday — £6/day. Doable, needs a little steering."
- Warning: rain approaching. "Heads up — around Thursday, money runs out before Friday's payday. £9/day keeps it dry." Action card = the per-day plan.
- Storm: CRITICAL DESIGN RULE — the UI gets darker, stiller, CALMER. Less motion, not more. No red, no alarms, no flashing. Deep slate sky. "Honest numbers: £12 to Wednesday. Bills are safe — this is about getting to Friday. Plan's ready." The mascot sits with a tiny umbrella and breathes slowly.
- Recovery: soft dimmed warm palette, single-task feel. Entry from Storm's action card.
- Fog: muted violet-grey haze, every number gets an "as of Tue" staleness badge, the mascot squints into fog. "I can't see clearly right now — last good numbers are from Tuesday." An afford-check asked in Fog answers honestly: "Can't call it — my numbers are from Tuesday."

3. RECOVERY WALKTHROUGH — three soft single-task screens entered from Storm:

- Step 1 "See it plainly": "It went over — £23 past the line. No lecture. Here's the way back: three steps, the first one takes a minute."
- Step 2 "Adjust the plan": rebuilt per-day number for remaining days, bills shown as still protected.
- Step 3 "One move today": a single small action (e.g. "Shift £8 to bills"). Then a daily check-in card showing "Day 2 on the path" — progress is ALWAYS counted forward ("days on the path"), never "days since failure".

THE MASCOT: a small, round, mellow ember-spirit creature (think: soft rounded salamander-spirit silhouette, NOT a blob with a face). Design it as clean inline SVG with six emotion variants swapped per state: calm, joy (reveal/payday), concern (warning), stress-composed (storm, with tiny umbrella), hope (recovery), squint (fog). It has a soft belly-glow whose brightness reflects Safe Zone health. ADULT BY RESTRAINT — this is the hard requirement: medium-sized eyes (never huge sparkly pupils), calm posture, muted warm palette, no perpetual grin, no bouncing idle. In negative states it is positioned looking at the problem BESIDE the user — never looking at the user disapprovingly. If it reads like a children's app character, it has failed.

VISUAL DIRECTION — "Warm Paper": warm cream/paper base (#F7F2EA), soft ink text (#22201B), one terracotta accent (~#C4623A), weather tints layered over the base: gold-amber (sun), grey-blue wash (rain), deep slate (storm), muted violet (fog). Humanist grotesk type; money numbers in tabular numerals and NEVER red. Corners 12–16px, hairline dividers, generous breathing room, depth via layering not heavy shadows. Motion 200–300ms ease-out, subtle; motion REDUCES in bad states. Absolutely avoid: fintech navy, neon/AI gradients, dashboard grids, glassmorphism, Duolingo-style cartoon energy, red alert styling anywhere.

COPY RULES (hard constraints): no shame, no panic, no baby talk, ever. Banned: "oops", "yikes", "uh oh", "you failed", "treat yourself", "guilt-free", ALL-CAPS warnings, alarm emojis, and the word "again" in any negative context. Every warning must include the way out ("£9/day keeps it dry"). One exclamation mark is the ceiling anywhere; most celebration copy uses none. Use the exact copy strings provided above wherever given — they are part of the spec.

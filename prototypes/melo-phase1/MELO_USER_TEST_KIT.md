# Melo Phase-1 User Test Kit

Purpose: pass or fail the Phase-1 gate from `C:\dev\folio-v2-greenfield\MELO_BLUEPRINT.md` §15 before any product code is written. Ten minutes per person, no design knowledge needed from them, no explaining allowed from you.

**The three questions this test answers (blueprint §14/§15):**
1. Do people instantly understand the Safe Zone reveal?
2. Does the mascot read ADULT (not childish)?
3. Does the home screen answer "am I okay?" in under 3 seconds?

**Pass gates (from §15 Phase 1):** 8/10 unprompted comprehension of the Safe Zone · ≥7/10 "I'd try this" · **zero** "it's for kids / childish" reads from the target cohort · (added) ≥8/10 describe the Storm screen as calm/helpful rather than alarming or judgy.

---

## 1. Who to recruit

- 10 people (5 = minimum viable signal). Payday-cycle adults 22–40: retail/NHS/hospitality/shift workers, renters, "money is tight-ish but functioning."
- Explicitly NOT: designers, product people, developers, or anyone who's watched you build this.
- Mix: at least 3 who say they've been overdrawn in the last year; at least 2 with variable income.

## 2. Setup (pick one)

- **A — Lovable preview (recommended):** the project is private; click **Publish** in the Lovable editor (`https://lovable.dev/projects/f9c64101-c1ba-44ec-9bdf-e12134cb7aa3`) when you're ready to test, and send testers the published URL. Unpublish after the round. Version A at `/` is canonical — B is parked at `/b`; don't mention it.
- **B — Local file:** `C:\dev\folio-v2-greenfield\prototypes\melo-phase1\index.html` — send the file or open it on your phone/theirs. Works offline, double-click.

Test on the TESTER'S phone where possible. Portrait. No coaching.

## 3. Moderator rules (read before every session)

- Never explain what anything means before asking what they think it means. **Silence is data.**
- If they ask "what should I do?", say: "whatever you'd naturally do."
- Never say "Safe Zone," "weather," "mascot," or any product term before they do.
- Write down their words verbatim — especially the wrong ones.
- One warm-up line only: *"This is an early money app idea. Nothing you do is wrong; I'm testing the app, not you."*

## 4. The script

**T1 — The Reveal (comprehension).**
Say: *"Set it up as if you're this person: paid monthly on a set date, £1,450 lands, rent £850, energy, phone."* Let them tap through onboarding themselves. When the big number appears (call it £N), ask:
- *"In your own words — what is that £N?"*
- ✅ PASS: any version of "what I can actually/safely spend (after bills) until payday."
- ❌ FAIL: "my balance," "my budget" (vague), "no idea," or reads it as income.
- Then: *"Where did the app get that number?"* (bonus pass: mentions bills/things taken out first)

**T2 — The Glance (3-second test).**
From Home, tell them to look away. Say: *"I'll show you the screen for 3 seconds."* Show, hide. Ask:
- *"Is this person okay this week? How do you know?"*
- ✅ PASS: correct read + cites the number, the sky/mood, or the creature. Record WHICH signal they cite first (this tells us what's carrying the glance).

**T3 — The Storm (emotional register).**
Use the ⚙ state chip to switch to **Storm** (do it casually: "imagine a worse week"). Ask:
- *"How does this screen make you feel?"*
- *"What would you do next?"*
- ✅ PASS: concerned-but-calm, knows the next move (the plan/action card). Uses words like honest, calm, clear.
- ❌ FAIL: panicked, "it's telling me off," "I'd close the app," confused.

**T4 — The Creature (adult read).**
Point at the mascot (any state). Ask:
- *"Who is this app for? What age?"* then *"What's this character's deal — what's it doing here?"*
- ✅ PASS: "adults / people like me"; gets that it reflects the money state ("it's worried because the money's tight").
- ❌ HARD FAIL: "kids," "like a children's game." One of these = the art direction needs work regardless of other scores.

**T5 — The Habit (afford-check).**
Say: *"You're about to buy £60 trainers. Show me what you'd do in this app."*
- ✅ PASS: finds the "Can I afford…?" input unprompted, reads the verdict correctly ("£X left after").
- Note whether they notice/use the Shelf. Then ask: *"Would you actually check this before buying something? Honestly."*

**Wrap (attitude + pricing).**
- *"Would you put this on your phone's home screen?"* (the widget/glance proxy)
- *"Score 1–10: how likely would you be to try this if it existed?"* (≥7 counts toward the gate)
- *"It's free; a paid version with extras is £4.99/month — gut reaction?"*
- *"What's missing? What would make you delete it?"*

## 5. Scorecard (one row per tester)

| # | T1 reveal (P/F) | T1 words used | T2 glance (P/F) | T2 first signal cited | T3 storm feel (calm/panic/judged) | T4 who-for | T4 "kids"? (Y=fail) | T5 found check (P/F) | Would home-screen it? | Try score /10 | £4.99 reaction | Verbatim gold |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | | | |
| … | | | | | | | | | | | | |

**Gate math after 10:** T1 pass ≥8 · try-score ≥7 for ≥7 people · T4 "kids" count = 0 · T3 calm ≥8. All four → Phase 2 green. Any miss → fix the failing surface in the prototype and re-run 5 fresh testers before writing product code (per §15: the prototype exists so this costs ~£0).

## 6. What to bring back

The filled scorecard + the verbatim quotes. The quotes matter more than the numbers — especially every wrong guess at T1 (each one is a copy fix) and every word used to describe the creature (that's the brand read).

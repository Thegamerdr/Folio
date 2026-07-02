# MELO — Product Blueprint

**The emotional interface for personal finance.**
Version 1.0 · 2026-07-02 · Full product concept, UX system, retention system, brand system, monetization system, and execution blueprint.

How to use this document: §0 is the executive layer (read it and you know every decision). §1–§15 follow the brief's structure. §16 contains the net-new deliverables (the top-20 lists + final direction) plus an index mapping all 23 requested deliverables to sections. Sections 3, 5, 6, 9 and 11 are written to be usable directly as Lovable requirement briefs (what to build, not how to style it beyond the chosen direction).

---

## §0 — Decision Log (the ruthless calls, up front)

**KILLED — and why:**

| Killed | Reason |
|---|---|
| Gecko mascot | GEICO owns "gecko + money category" in the anglophone mind. Instant read: insurance ad. Legally survivable, brand-wise fatal. |
| Weasel mascot | "Weasel" means *untrustworthy with money* in English. You cannot name a finance companion after the metaphor for embezzlement. |
| Owl (if anyone suggests it) | Duolingo. Done. |
| Money Weather as its own screen | Weather is an *ambient layer* (home background + forecast strip + notification vocabulary), not a destination. A weather "screen" would be visited twice and abandoned. |
| Money Time Machine as a separate pillar | 90% overlaps Before You Spend. Merged into one simulator with two horizons: **Now** ("can I afford this?") and **Later** (scenarios). Separate branding = feature bloat. |
| Mascot feeding / care / neglect-sickness mechanics | Care burden is Finch's model and it's wrong for money. **Melo cares for you, not you for it.** A pet that gets sick when you're broke is a shame machine. |
| Streak guilt | Streaks are counted and celebrated, never weaponized. No "don't break your streak!" notifications, ever. Broken streaks restart silently. |
| Chat as primary UI | Cleo's model. Chat is high-friction for a 10-second glance product. Melo speaks in one line on the home screen; chat exists only inside "Ask Melo." |
| Red-alert danger UX | Sirens, red screens, and shaking icons *amplify* the anxiety we're selling relief from. Danger states get *calmer*, darker, slower — not louder. |
| Loot boxes, gacha, consumable currency | Gambling mechanics in a finance app for financially stressed people. Never. All cosmetics are direct-purchase or earned. |
| 3D mascot | 3× production cost, uncanny risk, AI-slop adjacency. 2D rigged vector (Rive) — live-animatable, tiny file size, premium when drawn well. |
| Ads, data resale, lending referrals (v1) | Trust is the compounding asset. One "personalised loan offer" and Melo becomes every other app. |
| Per-seat household pricing | One Plus subscription covers the household. Couples splitting a £4.99 sub is a churn conversation, not a revenue line. |

**PROMOTED — non-obvious ideas made central:**

1. **Quiet Mode** — one toggle that de-mascots the entire app into a minimalist adult utility (same engine, no character). Kills the "childish" objection at zero risk, and it's an honest feature, not a concession.
2. **The 24-Hour Shelf** — put a tempting purchase "on the shelf"; Melo re-runs the numbers tomorrow and tells you if it's still safe. The impulse-spending killer, and nobody has it.
3. **Co-breathing storm mode** — in Danger/Storm states the mascot visibly breathes at a slow pace. Anxiety co-regulation, borrowed from mental-health apps, applied to the moment of financial panic.
4. **"Can you afford Melo?" paywall honesty** — the paywall runs your own Safe Zone against the subscription price. If you can't afford Plus, Melo tells you *not to buy it* and offers to ask again after payday. This single behavior is the brand's integrity made visible, and it will be screenshotted.
5. **Fog state** — stale/disconnected data gets its own weather ("fog") and mascot expression (squinting). The app never fakes certainty it doesn't have.
6. **Danger-date delta as the flagship notification** — "your danger date moved" is *news*; "you have £142" is a status. Notify on change, not on state.
7. **Recovery Mode free forever** — the ethical anchor and the commercial masterstroke: the moment of crisis is the moment of maximum retention-or-deletion.
8. **Show the math** — every number in Melo is tappable and decomposes into its calculation. Trust is built at the moment of doubt.
9. **Ban the word "again"** — the cruelest word in fintech copy ("you overspent *again*"). Banned in all negative contexts, enforced in the copy linter.
10. **Statement-import-first go-to-market** — manual + statement import before open banking. Cheaper (no per-user API cost at acquisition), more private, and it front-loads trust before asking for bank credentials.

**Build-on-Folio note (implementation grounding, optional):** Melo can be built greenfield, but the existing Folio V2 assets map almost 1:1 onto the MVP: the statement reader (= Melo's import path), the recurrence engine (= bills/danger-date math), the E2EE local-first store (= the privacy stance), the deployed ai-gateway (= Ask Melo), the theme system (= visual directions), and 700+ engine tests. The blueprint below is written product-first and stack-agnostic; where reuse is obvious it is noted, nothing more.

---

## §1 — Core Product Thesis

**One sentence:**
> Melo tells you what's actually safe to spend — and worries about the rest, so you don't have to.

**One paragraph:**
Melo is a daily money companion for people who live in the payday cycle. It computes one honest number — the **Safe Zone**, what you can really spend after rent, bills, debt, subscriptions, savings and the essentials you still need before payday — and one honest forecast: your **money weather**, including the **danger date** when trouble arrives if nothing changes. It carries that information through a small companion character whose mood mirrors your financial state, so a half-second glance tells you how you're doing the way a glance at the sky tells you whether to take a coat. When you get paid, Melo runs a two-minute ritual that protects your bills before the money evaporates. When you overspend, it doesn't lecture — it opens a no-shame recovery path. Melo is not a bank, not a spreadsheet, and not a pet you have to keep alive. It's the first finance app whose job is to care about you.

**Investor-style product thesis:**
Consumer fintech has solved transactions (challenger banks), aggregation (Emma, Snoop), and methodology (YNAB) — but not the actual mass-market problem: **money anxiety**, and the question people ask ~30 times a month: *"can I spend this?"* Banks show the past; the anxiety lives in the future. The available breakthrough is an *interface* breakthrough: financial state rendered as emotional state. Duolingo proved a character can carry a daily habit in a "boring" category to a $10B+ business. Finch proved people pay subscriptions for emotionally supportive software. Cleo proved personality monetizes *in money specifically* — but built it on sass and cash advances. Melo combines a genuinely novel financial primitive (Safe Zone + danger forecasting — the number no bank shows) with the most legible interface humans have (a face), wrapped in a no-shame emotional system that makes it the app people *don't delete when things go wrong* — the exact moment every other finance app gets deleted. Wedge market: UK renters aged 22–40 living payday-to-payday (~25M UK adults hold under £1k of buffer), under-served by banks and over-asked by YNAB. Business model: freemium subscription — functional depth plus cosmetic identity — no ads, no data resale, no lending. The mascot is not decoration; it is simultaneously the retention engine (daily glance loop), a second monetization surface (identity cosmetics with ~90% margin), and a compounding brand moat (owned IP that can walk out of the app onto widgets, watch faces, merch, and marketing). Expansion: household mode, EU/US localization, teen/family, and the character franchise itself.

**Positioning against the field (one line each):**

- **vs. banking apps (Monzo/Revolut/high-street):** they show what *happened*; Melo shows what's *safe* and what's *coming*. Melo sits above any bank — bank-agnostic emotional layer, not a competitor for deposits.
- **vs. budgeting spreadsheets:** the spreadsheet is honest but silent — it never taps you on the shoulder on the day it matters. Melo is the spreadsheet that comes to you.
- **vs. expense trackers (Emma, Snoop):** tracking is autopsy; Melo is triage. Categorizing last month's takeaways doesn't answer "can I go out on Friday?"
- **vs. YNAB:** YNAB gives you the outcome if you do the homework. Melo gives you 80% of the outcome for 2% of the homework. YNAB is a methodology; Melo is a companion.
- **vs. Monzo pots / salary sorter:** pots are the mechanism; Melo is the *meaning*. Melo works whether the money sits in Monzo, Barclays, or under the bed — and tells you *why* and *when*, not just *where*.
- **vs. Cleo:** Cleo made money conversational; Melo makes it *glanceable*. And Cleo's roast-mode monetizes shame — Melo's entire system is engineered to be the thing you open *because* you feel bad, not despite it.
- **vs. Duolingo-style habit apps:** Duolingo's character pressures you on the app's behalf. Melo's character worries on *your* behalf. Direction of care is the whole difference.
- **vs. Finch/self-care pets:** in Finch you keep the pet alive; in Melo the companion keeps *you* safe. No care burden, no dead pet guilt.

**The unique angle, stated once:** *Melo is the emotional interface for personal finance.* The Safe Zone number is the product. The mascot is how the number reaches a human at 8am in a queue at Tesco.

---

## §2 — Product Pillars

Ten pillars. Two of the briefed ten were restructured: Money Weather became an ambient system (still a pillar, not a screen), and Money Time Machine merged into Before You Spend. Tiny Wins is a system-wide layer, not a destination.

### Pillar 1 — Safe Zone *(the product)*

- **What:** The single number Melo exists to compute: `Safe Zone = current balance − bills due before payday − essentials allocation for remaining days − committed savings − BNPL installments − safety buffer`. Expressed as a total ("£184 safe until Friday") and per-day ("that's £13/day").
- **Why it matters:** Bank balance is a lie — it includes money that's already spoken for. Every bad week starts with someone reading £600 as "I have £600." Safe Zone is the number banks structurally cannot show because they only see one account and have no incentive to say "actually, £41."
- **UI:** The hero number on home, in large tabular numerals. Tappable → full decomposition ("show the math"): balance − each reserved chunk, each line tappable further. Rounded *down* to the nearest pound, always (under-promise is a design principle).
- **Data needed:** balance (manual, statement-import, or bank-connected), payday date + income, recurring bills, essentials estimate (learned or asked), savings commitments, BNPL schedules, buffer preference.
- **User action driven:** the pre-spend glance. The habit is: *think of spending → glance at Melo → decide.*
- **Emotional state created:** relief-through-honesty. Even a low number feels better than a mystery number.
- **Retention:** it decays and refreshes — spending changes it daily, which makes the glance daily.
- **Free/premium:** Core Safe Zone **free forever** (this is the safety feature; paywalling it is disqualifying). Premium: multi-account aggregation, custom buffer rules, per-category zones, daily recompute with cleared/pending reconciliation.

### Pillar 2 — Money Weather *(the emotional layer)*

- **What:** A weather vocabulary for financial state: **Sunny** (comfortable), **Clear night** (calm, quiet period), **Cloudy** (tightening), **Rain** (overspending happening now), **Storm** (danger date within 3 days / negative trajectory), **Fog** (data stale — Melo can't see), **Rainbow** (recovery completing), **Snow** (seasonal/festive mode). Rendered as the home screen's ambient sky, a 7-day forecast strip, and the shared vocabulary of every notification.
- **Why:** Weather externalizes without excusing. "Storm Thursday" carries urgency with zero accusation — nobody is blamed for rain, everybody prepares for it. Weather passes (hope is built into the metaphor). And it gives the household a no-blame shared language (§8, §13).
- **UI:** Ambient gradient + minimal particles behind the home header; a forecast strip (today → payday) with bill icons and the danger date marked as the storm cell; weather word in notifications. **Danger states reduce motion** — a storm is a still, dark sky, not a violent animation. Calm-down design.
- **Data:** derived entirely from the Safe Zone engine + trajectory. No new inputs.
- **Action driven:** preparation ("storm Thursday → move £20 today").
- **Emotion:** legibility, weather-report calm.
- **Retention:** forecast *changes* are the best notification content in the app (§7, §16.5).
- **Free/premium:** Free. Premium: visual weather themes (how the sky is drawn), extended 30-day forecast.

### Pillar 3 — Payday Ritual *(the signature moment)*

- **What:** A guided 2-minute flow when income lands: **1)** Melo celebrates (payday is the one day people feel good about money — own it) → **2)** Protect bills: sweep the month's bills into the Bills Shield (visually: Melo locks them in a chest) → **3)** Set aside savings (pre-committed amount, one tap, skippable without guilt) → **4)** Reveal the cycle's Safe Zone → **5)** One smart move ("your energy bill rose £14 — want the 3-minute fix?").
- **Why:** The payday-to-broke curve is steepest in the first 72 hours. Protecting money *at the moment it arrives* — before it psychologically converts to "spendable" — is the highest-leverage intervention in consumer finance. Monzo's salary sorter is the mechanism; Melo's ritual is the mechanism plus meaning plus emotion.
- **UI:** Full-screen guided sequence, big taps, mascot as master of ceremonies. Ends on a "cycle card" (shareable, amounts hidden by default).
- **Data:** payday date/detection, bill list, savings commitment.
- **Action:** the sweep. With bank connection + pots API this is real money movement; in manual mode it's ledger allocation (still works — the *decision* is the value).
- **Emotion:** control, ceremony, a clean start. The monthly "new game+."
- **Retention:** the anchor loop of the whole product — 12–26 guaranteed high-value sessions a year, each re-setting the daily loop.
- **Free/premium:** Ritual free. Premium: automation (auto-sweep rules, auto-savings escalation), multiple income streams, irregular-income "money landed" mini-rituals.

### Pillar 4 — Recovery Mode *(the differentiator)*

- **What:** A no-shame rescue flow that activates on overspend/negative Safe Zone/overdraft: the app visually softens, upsells vanish, and Melo presents three steps — **See it plainly** (the damage, in one honest sentence, no italicized judgment) → **Adjust the plan** (rebuild the remaining days: what's protected, what's the new per-day number) → **One action today** (smallest meaningful move). Then daily 20-second check-ins until three green days, ending in a quiet "graduation" moment.
- **Why:** Every finance app is designed for its best-case user; all of them get deleted at the worst-case moment because opening them means facing an accusation. The user who overspent doesn't need analytics — they need a path and a companion who doesn't flinch. **This is the retention event no competitor survives.**
- **UI:** Distinct mode: dimmed warm palette, slower motion, mascot sits *beside* the problem looking at it *with* you (never at you). Progress shown as "days back on path," never "days since failure."
- **Data:** the Safe Zone engine + overdraft detection.
- **Action:** one small move per day (move £5, pause a sub, shift a bill date).
- **Emotion:** relief, dignity, being accompanied.
- **Retention:** converts the churn moment into the loyalty moment. Users who complete a recovery are the highest-LTV cohort this product will have — instrument this from day one.
- **Free/premium:** **Free forever, in its entirety.** Ethical anchor (§8). Premium may add *proactive* recovery planning (pre-storm rehearsal), never the rescue itself.

### Pillar 5 — Mascot / Character System *(the interface)*

- **What:** A living character whose emotional state is a pure function of your financial state (full system: §3). It is the status display, the notification voice, the ritual host, the widget face, and the identity/monetization surface.
- **Why:** A face is the highest-bandwidth, lowest-effort display humans can read. The mascot converts "check my finances" (a chore, ~40s of reading) into "glance at Melo" (~0.5s). And an owned character is the only moat in this category that compounds: features get copied in a quarter; a beloved character can't be.
- **UI:** Home (primary presence), widgets, notifications (expression in the icon where OS allows), ritual/recovery host, customization studio, store. Never blocks data; always accompanies it. **Quiet Mode removes it entirely** — same engine, minimalist skin.
- **Data:** the state machine (§4).
- **Action:** the glance; customization sessions; milestone unlock claims.
- **Emotion:** companionship without care burden. *It worries about you.*
- **Retention:** mood-shift = information scent on the widget; wardrobe/milestone progression = investment loop.
- **Free/premium:** Base character + 3 colorways + starter wardrobe free. Premium: species roster, outfit packs, scenes, pets, personality voices (§8).

### Pillar 6 — Money Leaks *(the treasure hunt)*

- **What:** Detection of recurring waste: subscriptions (incl. price *rises* — flag the delta, not just the existence), duplicate services (two music apps), zombie trials, bank fees, delivery-app premium fees, and "drip leaks" (the same £4.20 charge 22×/month). Each leak card shows annualized cost ("this is £96/year") and a **cancel guide** — actual steps, deep links where possible — not just a label.
- **Why:** Leaks are the only place a finance app can *find money* rather than restrict it. Finding £23/month of leaks pays for Plus 4× over — which is exactly how it should be framed.
- **UI:** Leaks screen with found/total counter; Melo as detective (magnifier animation on scan); "leak fixed" celebration folds into Tiny Wins.
- **Data:** transaction history (statement import or bank connection). *This pillar is data-gated — in pure-manual mode it runs on the subscription list the user enters.*
- **Action:** cancel/negotiate/downgrade, with guided steps.
- **Emotion:** the win of found money; mild detective delight.
- **Retention:** monthly scan cadence; price-rise alerts are recurring high-value notifications.
- **Free/premium:** Manual subscription tracking + top-3 detected leaks free. Full detection engine, price-rise monitoring, cancel concierge guides: **Plus**. (Finding the leak free / deep automation paid = the fair line.)

### Pillar 7 — Danger Date *(the early warning)*

- **What:** The projected date you hit £0 Safe Zone (or overdraft) before payday, computed from trajectory (current run-rate vs. remaining days, bill schedule aware). Always shown with confidence honesty: "around Thursday" not "Thursday 14:32."
- **Why:** Anxiety is *unbounded* dread; a date is *bounded* problem. Naming the danger shrinks it. And a date that *moves* is the product's proof-of-agency: "Danger date moved Thu → Sun. Whatever you did — it worked" is the most motivating sentence in the app.
- **UI:** Storm cell on the forecast strip; countdown chip on home only when ≤7 days out (don't ambient-doom people who are fine).
- **Data:** Safe Zone engine + spend run-rate.
- **Action:** the specific per-day number that dissolves it ("£9/day until Friday keeps it dry").
- **Emotion:** contained concern → agency.
- **Retention:** delta notifications (§16.5).
- **Free/premium:** **Free** (never paywall the smoke alarm). Premium: what-if on the date (via simulator), multi-cycle projection.

### Pillar 8 — Before You Spend *(the habit)*

- **What:** The "can I afford this?" simulator — the app's most-used feature by count. Type/say an amount (optionally what it is) → verdict in one card: **Safe / Tight / Not now / Safe on [date]**, with the post-purchase Safe Zone, danger-date impact, and one alternative ("safe on the 28th," "safe if the shelf holds it 6 days"). Two horizons: **Now** (one-off purchase) and **Later** (the merged Time Machine: scenarios — extra shift, cancel sub, Klarna plan, delay purchase, debt payment — each rendered as a forecast comparison, this sky vs. that sky).
- **Why:** This is the actual moment of personal finance — the point of sale. Everything else in the category is before or after the moment; this is *in* it. A BNPL query is the killer demo: enter "£800 sofa, Klarna, 3 payments" → Melo overlays the installments on your next three cycles and shows you which future month cries.
- **UI:** Persistent input affordance on home ("Can I afford…?"); result card with verdict word, numbers, forecast delta; **"Put it on the Shelf"** secondary action (§16.2 — 24-hour cool-down with a next-day re-verdict).
- **Data:** Safe Zone engine; scenario parameters.
- **Action:** informed decision; deferred decision (Shelf); scenario saved.
- **Emotion:** confidence at the moment of temptation; the pride of *having checked* (celebrate the check, never judge the outcome — user buys anyway? Melo recalculates and moves on, zero commentary).
- **Retention:** highest-frequency loop in the app (target 3+ uses/week).
- **Free/premium:** One-off "Now" checks **unlimited and free** (never throttle the core habit). "Later" scenarios: 1 active free; saved/compared/stacked scenarios: **Plus**.

### Pillar 9 — Bills Shield *(the protector)*

- **What:** The reserved-money system behind the ritual: every known bill between now and payday is "shielded" — subtracted from Safe Zone and marked protected. Includes BNPL installments, annual-bill smoothing (car insurance in month 7 accrues £/month from month 1), and bill-rise detection.
- **Why:** The #1 mass-market money failure isn't overspending on wants — it's spending the electricity money because it *looked* spendable. The Shield is why Melo's £0 is survivable: essentials and bills are already safe.
- **UI:** Shield screen: list of protected bills with status (upcoming/landed/covered), the chest visual from the ritual, coverage bar ("this cycle: £912 protected").
- **Data:** recurring-bill detection (recurrence engine) or manual entry; BNPL schedules.
- **Action:** confirm/adjust detected bills; smooth an annual bill; shift a due date.
- **Emotion:** "the important things are safe" — the sentence under the whole brand.
- **Retention:** "bill landed, it's covered, nothing to do" notifications — trust-building pings that ask nothing (§16.5).
- **Free/premium:** Core shield free. Premium: annual smoothing automation, bill negotiation guides, rise-alerts across all providers.

### Pillar 10 — Tiny Wins *(the compounder)*

- **What:** A system-wide layer (not a screen) that detects and celebrates small real progress: cancelled a sub, pushed the danger date back, first £10 saved, a whole cycle without overdraft, *checked before buying*, survived bill week. Surfaced as a home ticker line, a weekly digest, and occasional mascot celebrations. Some wins unlock cosmetics (achievement wardrobe).
- **Why:** Finance progress is glacial and invisible; motivation dies in the gap. Tiny Wins manufactures the visible progress gradient that keeps people in the game — Duolingo's real lesson (progress *feeling*, not streak *pressure*).
- **UI:** Ticker on home; wins log inside Weekly Review; celebration moments (2s, skippable, never modal-blocking).
- **Data:** event stream from all other pillars.
- **Action:** none required — wins are *noticed*, not claimed. (Zero-effort reward is the point.)
- **Emotion:** momentum, being seen.
- **Retention:** variable-interval positive reinforcement — the healthy version of what slot machines abuse.
- **Free/premium:** System free. Premium: cosmetic rewards tied to milestone wins, win-history archive.

---

## §3 — The Mascot System

### 3.1 Design law (non-negotiables)

1. **Mood is a pure function of the user's finances.** Never purchasable, never random, never influenced by app usage (a mascot sad because you didn't open the app = Duolingo guilt; banned).
2. **Direction of care points at the user.** The mascot needs nothing — no food, no cleaning, no health bar. It can't die, sicken, or be neglected into misery. It worries about *your* money, not about you abandoning it.
3. **It never looks at you disapprovingly.** In every negative state, the mascot is positioned *beside* the user's problem, looking at *the problem* — worried with you, never at you. This one art-direction rule is the difference between companion and judge.
4. **Adult by restraint.** Medium-sized eyes (huge pupils = infantile), slow blinks, calm resting posture, muted warm palette, no perpetual grin. It should sit comfortably on a phone next to a banking app, not next to a toddler game.
5. **It accompanies data, never replaces it.** The number is always readable without the character. Quiet Mode removes the character entirely and the product still works — that's the test.
6. **Expression bandwidth over asset count.** Six emotion families with intensity levels beat sixty stickers. Rigged 2D (Rive or equivalent): one rig, parametric emotions, tiny file size, live-reactive.

### 3.2 Emotional range (the acting system)

Six families × three intensities, driven by the §4 state machine:

| Family | I (subtle) | II (clear) | III (full) |
|---|---|---|---|
| **Calm** | soft blink, slow breathing | content half-smile, settled posture | deep-rest "clear night" doze |
| **Joy** | brightened eyes | bounce, small clap | celebration (confetti, payday dance) |
| **Concern** | ear/antenna dip, glance at forecast | holds the forecast strip, brow knit | storm vigil: sits with umbrella, breathing slowly (co-breathing) |
| **Stress** | fidget, checks tiny ledger | clutches ledger, rain-glance | huddled but *composed* — never panicking (it models the regulation we want the user to feel) |
| **Sadness** | downcast beat, one slow blink | sits, shoulders down — then *looks up at you*: "we're okay" | rare: the quiet loss moment (big setback), always followed by a recovery gesture. Damage metaphors (cracks) heal visibly in Recovery — damage is never permanent |
| **Hope** | looks toward horizon | small determined nod, rolls sleeves | rainbow moment: recovery graduation |

Micro-idle library (randomized, 8–12s cadence): breathing, blinks, looking at the weather, adjusting outfit, tiny ledger check. The character must feel *alive at rest* — that's where attachment forms.

### 3.3 The candidate roster (10) and the verdict

| # | Name | Type | Personality | Visual style | Why it fits | Risks | Best target | Premium potential |
|---|---|---|---|---|---|---|---|---|
| 1 | **Melo** | custom creature — a small, round "mellow spirit," salamander-soft silhouette with an ember-like warm glow that dims/brightens with financial weather; regrows what it loses (axolotl DNA, abstracted to ownable) | steady, warm, quietly droll | rounded flat-vector with soft depth; muted terracotta/cream | Name = brand = character (the Duo play). 100% ownable IP, zero animal baggage. The glow *is* a status display. Regeneration = the Recovery story embodied | Custom creatures need great design or read generic; carries the whole brand alone at first | everyone; the default | Colorways free; glow effects, outfits, scenes — the whole catalog hangs off it |
| 2 | **Pebble** | otter | affectionate, practical | sleek, warm brown, always has its pebble | Otters keep a treasured pebble (a *built-in savings metaphor*) and hold hands so they don't drift (safety/household). Real-animal warmth, adult-safe | Less distinctive silhouette at 24px; otters are having a mascot moment elsewhere | savers, couples | Pebble collection = savings milestones; beach/river scenes |
| 3 | **Nugget** | small round dragon | proud, protective, secretly soft | ember palette, stubby wings, sits on the Bills Shield chest | Dragons guard hoards — *literally the app's job*. Fantasy customization depth is unmatched (hoard themes, armor, flame colors) | Reads gamer/child if drawn wrong; fantasy can undercut "real money" gravity | gamers, collectors, younger premium | The monetization champion: hoards, armors, flames, lairs |
| 4 | **Juno** | fox | clever, alert | angular-soft, russet | "Clever with money" is the exact aspiration; foxes read smart, not smug (if art stays warm) | Firefox adjacency; fox = cunning can tip into "tricky" | optimizers, deal-hunters | Detective sets (leaks), tail accessories |
| 5 | **Bruno** | bear | steady, seasonal | big, soft, unhurried | Hibernation = saving for winter (annual smoothing story); protective bulk = safety | "Bear market" connotation in a finance app; large body = less nimble in small UI | anxious users wanting protection | Seasonal (winter den scenes), scarves/coats |
| 6 | **Miso** | cat | independent, dry | minimal lines, expressive tail | Massive general appeal; dry humor fits the copy voice | Cats read *indifferent* — wrong emotion for a companion whose job is to care | design-forward users | Boxes (obviously), knitwear, window scenes |
| 7 | **Tally** | robot | precise, earnest | soft-edged retro-tech, warm screen face | "Does the math for you" embodied; screen face = infinite expressions cheaply | Cold; robots don't have money problems — empathy gap; Cleo-adjacent | tech workers, Quiet-Mode-curious | Faceplates, firmware "personalities" |
| 8 | **Echo** | ghost | gentle, wise | translucent, soft glow | "Ghost of money past/future" = Time Machine narrative; float = charming motion for free | Death adjacency in a product touching debt/anxiety; Snapchat silhouette risk | narrative-lovers | Seasonal (obviously October), transparency effects |
| 9 | **Suki** | capybara | unbothered, serene | round, heavy-lidded, spa energy | The internet's chosen icon of *calm* — the exact emotion Melo sells | Meme-trend could date it; low emotional *range* (its whole bit is not reacting) | anxious users, meme-fluent | Onsen scenes, towel/robe sets, chill packs |
| 10 | **Axo** | axolotl | soft, resilient | pink-pastel, frilled | Regeneration = recovery; distinctive and beloved | Very cute-coded — hardest to age up; pastel fights the adult palette | Gen-Z, recovery-journey users | Regrowth effects, aquarium scenes |

**Rejected outright (from the original list):** gecko (GEICO owns the slot), weasel (the English language already decided what a weasel does with your money).

### 3.4 The verdict — best 3 and the portfolio logic

1. **Melo (custom creature) — the brand, the default, the free hero.** The name unification is worth more than any animal's charm: the app is Melo, the character is Melo, "check Melo" enters the user's vocabulary as one act. Owned IP end-to-end (trademark, merch, animation, no species baggage). The ember-glow gives it a *functional* body: glow = Safe Zone health, readable at widget size where facial expression isn't. Free tier ships Melo in three colorways (Ember/Moss/Tide — warm/green/blue) chosen at onboarding: users get ownership ("*my* Melo is the green one") while the brand keeps one face.
2. **Pebble (otter) — first premium alternate: the warm-real pole.** For users who want an *animal*, not a spirit. The pebble-as-savings ritual object is a mechanic, not just a skin: Pebble's pebble grows/polishes with savings milestones. Covers the Finch-audience quadrant (soft, nurturing-adjacent, but care still flows toward the user).
3. **Nugget (dragon) — second premium alternate: the fantasy-collector pole.** The deepest cosmetic well (hoards, armor, flame effects) and the strongest "guarding your treasure" narrative. Covers the gamer/collector quadrant and will over-index on cosmetic ARPU.

Portfolio logic: **brand-owned / warm-real / fantasy-collector** spans ~90% of taste space with three rigs. Juno, Miso, Suki, Axo, Tally, Echo, Bruno follow as premium roster drops (one per quarter — each is a re-engagement event and a press beat). Every character runs the same state machine and animation contract, so the roster scales art, not engineering.

### 3.5 Customization architecture

- **Free:** 3 Melo colorways; starter wardrobe (~8 items: beanie, scarf, round glasses, rain boots…); achievement items (earned only, never sold — the flex layer: "survived Christmas '26" ornament, recovery-graduation pin, 6-month streak…). Earned items are visibly *unbuyable* — that's what makes them status.
- **Premium (Plus catalog):** outfit packs — **job packs** (barista, medic, builder, chef, office, trades — people dress the mascot as *themselves*; this will be the best-selling category), **style packs** (streetwear, cottage, formal, sport), **seasonal drops** (returning yearly — limited-time but not artificially scarce), **scenes/rooms** (the mascot's backdrop: city flat, coastal, cabin, night garden), **companion pets** (a tiny sidekick — the mascot gets a mascot; irresistible and dumb in the best way), **personality voices** (copy skins: Chattier / Quieter / Dry — changes flavor lines only, never data or warnings), **effects** (celebration styles, glow palettes, Nugget's flame colors).
- **Seasonal system:** 4 drops/year + micro-events (payday anniversary hat on the user's first-payday date; birthday if shared). Christmas is its own product moment (§16.1 #11).
- **Where the mascot appears:** home (hero, reactive), widgets (expression + glow at glance size), notifications (expression icon where OS allows), onboarding (first meeting — it *arrives*, ~10s, skippable), Payday Ritual (host), Recovery (companion — its most important scene), reports (weekly/monthly cameo poses), paywall (honest salesman: presents the catalog, *never* begs), store (fitting room with live try-on), empty states (the only place it's allowed to be purely decorative).

---

## §4 — The Emotional Money State System

### 4.1 Architecture

Four layers, strictly ordered; higher layers override lower for *display*, all can log events:

1. **Data layer:** `Unknown/Fog` — data stale (>72h manual / sync broken). Overrides everything: Melo never fakes certainty.
2. **Journey layer (sticky):** `Recovery`, `Rebuilding` — entered by event, exited by criteria, immune to daily flapping.
3. **Health ladder (exactly one active):** `Winning → Protected → Calm → Tight → Warning → Danger → Overspent/Storm`.
4. **Overlays (transient):** cycle moments (`Payday`, `Bill Week`, `Payday Eve`) and events (`Milestone`, `Tiny Win`, `Neglected-return`).

**Anti-flap rules:** hysteresis bands on every ladder boundary (enter Warning at ≤4 days runway, exit at ≥6); min dwell 24h per ladder state; max one state-driven notification per transition, none for re-entries within 48h. **Notify on transitions, never on states.**

### 4.2 The states

Format — **Trigger · User-facing wording · Mascot · UI · Notification tone · Suggested action · Never say**

**CALM** — *the default good state*
- Trigger: Safe Zone positive, run-rate sustainable to payday, no bill risk.
- Wording: "£184 safe until Friday. Nothing needs you today."
- Mascot: Calm I–II; idle library; occasional content glance at the sky.
- UI: sunny/clear ambient; full home; store visible.
- Notification: none (calm earns silence — the absence of pings *is* the product working).
- Action: none required; optional tiny win surfacing.
- Never say: anything manufacturing engagement ("come see your dashboard!").

**PROTECTED** — *calm + shields verified*
- Trigger: Calm, and 100% of cycle bills shielded + buffer intact.
- Wording: "Bills covered, buffer intact. This is a good place."
- Mascot: Calm II with a proud touch — pats the shield chest once.
- UI: subtle shield tick on the bills chip.
- Notification: weekly digest mention only.
- Action: "want to raise the buffer £5?"
- Never say: "you're rich!" / anything that jinxes modest stability.

**WINNING** — *sustained upward trajectory*
- Trigger: 2+ cycles ending positive, savings growing, no recovery in 60d.
- Wording: "Third green month. The buffer's real now — £340."
- Mascot: Joy II resting state; wears an earned item unprompted.
- UI: warmer light; growth sparkline unlocked on home.
- Notification: monthly milestone tone, quiet pride.
- Action: graduate goals ("emergency fund → £500?").
- Never say: "imagine if you'd started earlier"; comparisons to other users.

**TIGHT** — *sustainable but thin*
- Trigger: Safe Zone positive but per-day < comfortable threshold (learned).
- Wording: "£41 to Friday — £6/day. Doable, needs a little steering."
- Mascot: Concern I; checks its little ledger.
- UI: cloudy ambient; per-day number promoted above total.
- Notification: none at entry (Tight is life, not news); daily plan available on open.
- Action: per-day guide; one skippable suggestion ("Thursday's cinema — shelf it?").
- Never say: "cut back" (vague), "be careful" (parental), "only £41" (the word *only* is a judgment).

**WARNING** — *trouble visible, not arrived*
- Trigger: danger date lands ≥1 day before payday at current run-rate; hysteresis per 4.1.
- Wording: "Heads up — around Thursday, money runs out before Friday's payday. £9/day keeps it dry."
- Mascot: Concern II — *stands beside the forecast strip*, pointing at the storm cell (at the problem, with you).
- UI: rain-approaching ambient; danger chip appears; store banners hidden.
- Notification: one, at entry, daytime only: "Storm Thursday: £38 short if spending stays usual. £10/day til then keeps it dry." (Complete information — no "open app to find out.")
- Action: the per-day number; one-tap "replan my week."
- Never say: "you're overspending" (accusation), "at this rate you'll fail," anything with "again."

**DANGER** — *trouble imminent*
- Trigger: danger date ≤3 days out, or Safe Zone ≤ £10 with bills pending.
- Wording: "Honest numbers: £12 to Wednesday. Bills are safe — this is about food and getting to Friday. Plan's ready."
- Mascot: Concern III — storm vigil: sits with umbrella, slow co-breathing loop (~6 breaths/min; the UI quietly invites matching it).
- UI: storm ambient — *dark, still, quiet* (motion reduced ~50%); all upsells suppressed; type size up slightly (stress narrows reading).
- Notification: one, actionable, never after 21:00: danger date + the smallest move that changes it.
- Action: 3-item micro-plan (move £X, pause sub Y, shift bill Z); "talk it through" (Ask Melo).
- Never say: "URGENT," ALL CAPS, 😬💀🚨, "insufficient funds," anything raising heart rate — the design goal is *lowering* it.

**OVERSPENT / STORM** — *it happened*
- Trigger: Safe Zone negative, or overdraft entered.
- Wording: "It went over — £23 past the line. No lecture. Here's the way back: three steps, the first takes a minute."
- Mascot: Sadness II beat (one honest moment — grief skipped is grief stored) → immediately Hope I: sits *next to* you facing the numbers.
- UI: auto-offer Recovery Mode (never force it); storm ambient; everything sellable hidden.
- Notification: single, gentle, only if the user hasn't opened the app: "Rough patch showed up in the numbers. When you're ready, there's a plan — no lecture."
- Action: enter Recovery (one tap).
- Never say: "you failed," "what happened?!," any question that demands self-justification.

**RECOVERY** — *the way back (sticky mode)*
- Trigger: user accepts Recovery from Overspent/Danger.
- Wording: "Day 2 of the way back. Today's move: shift £8. That's the whole ask."
- Mascot: Hope I–II; sleeves rolled; sits with you each check-in; co-breathing available.
- UI: Recovery skin — soft dim palette, single-task screens, "days on the path: 2" (never "days since failure"); zero upsells (hard rule).
- Notification: one daily check-in at a user-chosen hour, ≤20 words, always includes today's single move.
- Action: exactly one small move per day.
- Never say: "don't let it happen again," "back to normal" (implies abnormal = shameful), any mention of what caused it unless the user raises it.

**REBUILDING** — *post-recovery consolidation*
- Trigger: 3 consecutive green days after Recovery.
- Wording: "Back on solid ground. Rebuilding the buffer — £2/day gets it back by the 20th."
- Mascot: Rainbow moment on entry (Hope III, ~4s, once) → Calm with a determination idle.
- UI: rainbow-after-rain ambient for 24h; buffer-rebuild tracker.
- Notification: entry celebration (this one's allowed to feel good: "Three green days. Storm's over.").
- Action: micro-rebuild commitment.
- Never say: "let's make sure this never happens again" (it will happen again; Melo will be there).

**PAYDAY** — *the day (overlay)*
- Trigger: income detected / scheduled payday.
- Wording: "Payday. Before it starts disappearing — two minutes to make it safe?"
- Mascot: Joy III — the payday celebration (confetti, one proud dance loop, then straight to business as ritual host).
- UI: ritual takeover card on home; sunny ambient regardless of ladder state (payday earns its sun).
- Notification: the day's flagship: "You got paid 🎉 Two minutes with Melo makes it safe." (One of two sanctioned emoji moments/month.)
- Action: the Payday Ritual.
- Never say: "don't waste it," "let's see how long it lasts this time."

**PAYDAY EVE** — *the finish line (overlay)*
- Trigger: payday tomorrow.
- Wording: "Tomorrow's payday. You made it — 31 days, bills paid, no overdraft."
- Mascot: quiet Joy I; sits watching the horizon (sunrise imagery).
- UI: forecast strip highlights the finish line.
- Notification: only if the cycle was hard: "Tomorrow's payday. You made it." (This notification asks for nothing. Users will screenshot it.)
- Action: none. Let the moment be the moment.
- Never say: anything that turns the moment into a lesson.

**BILL WEEK** — *the gauntlet (overlay)*
- Trigger: ≥3 bills or ≥40% of cycle bills land within 7 days.
- Wording: "Big week: rent, energy, phone — £892 total, all shielded. Spending money this week: £31."
- Mascot: Concern I with competence energy — checking items off a list.
- UI: bills-week banner on forecast strip; per-day number recalculated around the landings.
- Notification: one preview at week start; per-bill "landed, covered, nothing to do" confirmations (trust pings).
- Action: confirm shields; adjust the week's per-day.
- Never say: "brace yourself" — the shield means there's nothing to brace for; say *that*.

**LOW BALANCE** — *thin but planned* — folded into **TIGHT/DANGER** by trajectory: low balance with bills covered and days sustainable = Tight; low with shortfall projected = Danger. (Balance alone is never a state — *trajectory* is the state. This is the engine's core opinion.)

**SAFE UNTIL PAYDAY** — *the all-clear (computed banner, not a ladder state)*
- Trigger: even at P80 spend, user reaches payday positive.
- Wording: "You're safe to Friday — even a heavy week doesn't break it."
- Mascot: Calm II, visibly off-duty (reading, dozing).
- UI: green-tick variant of the forecast strip.
- Notification: weekly digest only.
- Action: optional: sweep surplus to savings early.
- Never say: "treat yourself" (Melo never *prompts* spending — it answers).

**UNSAFE UNTIL PAYDAY** — *the honest shortfall (banner over Danger/Storm)*
- Trigger: bills + essentials exceed available funds to payday even at minimum spend.
- Wording: "Real talk: this cycle doesn't fit — £61 short even at minimum. Options: shift the phone bill (moves £38), pause 2 subs (£17), or a £61 plan we build together."
- Mascot: Concern III with resolve — brings the options like a colleague, not a verdict.
- UI: options-first layout; Recovery offered; **all monetization suppressed**.
- Notification: one, daytime, includes at least one concrete option.
- Action: pick an option; guided bill-shift instructions.
- Never say: "you can't afford your life" in any phrasing; the shortfall belongs to the *cycle*, not to the user's worth.

**NEGLECTED → RETURN** — *the welcome back (event, not a nag chain)*
- Trigger: 7+ days no open. (Absence itself triggers *nothing* for 7 days — silence is respected.)
- Wording (on return): "Hey. No guilt — money kept moving, I kept notes. 60-second catch-up?"
- Mascot: waves, *glad* — never wounded, never guilt-tripping, never "I missed you :(".
- UI: catch-up card (what changed: bills landed, weather now, danger date if any); then normal home.
- Notification: at most one re-engagement ping at day 10, information-first: "Quiet 10 days. Your weather's been: ☀️☀️☁️ — payday Friday. I'm here if you want the details." Then permanent silence until an actual money event.
- Action: the 60-second catch-up.
- Never say: "where have you been," streak-loss framing, sad-mascot emotional blackmail (this is where Duolingo is the anti-pattern).

**CONFUSED / UNKNOWN (FOG)** — *epistemic honesty (data layer)*
- Trigger: manual data >72h stale; sync broken; balances contradictory.
- Wording: "I can't see clearly right now — last good numbers are from Tuesday. Reconnect (30s) or tell me today's balance?"
- Mascot: squints into fog, hand-shading eyes; slightly comic, never alarmed.
- UI: fog ambient; all numbers show staleness badges ("as of Tue"); forecasting suspended (never forecast on fog — wrong-number risk, §13).
- Notification: one after 72h stale, framed as service not scold: "My picture's gone foggy — 30 seconds fixes it."
- Action: reconnect / quick balance update.
- Never say: certainty. Fog's whole job is admitting we don't know.

**MILESTONE** — *the marker (event overlay)*
- Trigger: buffer thresholds (£100/£500/£1k), debt-free date, N green cycles, 1-year anniversary.
- Wording: "£500 buffer. Six months ago this was £0. This is the boring miracle."
- Mascot: Joy III ceremony (~5s); commemorative item appears in wardrobe (earned, unbuyable).
- UI: milestone card (shareable; amounts hidden by default on shares).
- Notification: yes — this is what notifications are *for*.
- Action: share / set the next marker.
- Never say: "onwards and upwards!!" — corporate confetti. Understate it; the number does the talking.

### 4.3 Wiring notes

- Every state exposes the same contract to UI: `{ladder, overlays[], weather, mascot_emotion(family, intensity), copy_key, actions[], monetization_allowed: bool}`. One source of truth; screens and widgets subscribe.
- `monetization_allowed = false` for Warning, Danger, Overspent, Recovery, Unsafe, Fog. Enforced at the component level so no future feature can accidentally upsell a drowning user.
- All copy keys route through the tone linter (§10) in CI: banned-phrase list is a *test*, not a guideline.

---

## §5 — Main App Experience (UX architecture + screen specs)

### 5.1 Architecture

**Navigation: 4 tabs + a floating ask.**

```
┌─ HOME (glance stack: weather · mascot · Safe Zone · runway · one action)
├─ PLAN (Bills Shield · Savings Goals · Leaks · Scenarios)
├─ MELO (mascot studio · wardrobe · store · milestones)
└─ YOU (reviews · settings · data · household · help)
      [ Ask ➜ "Can I afford…?" — floating, reachable from anywhere ]
```

Modes that take over chrome when active: **Payday Ritual** (full-screen ceremony), **Recovery** (soft skin, single-task), **Onboarding**. Widgets and notifications are first-class surfaces — for many users the widget *is* the app most days, and that's success, not failure (a finance app that respects attention is a feature; sessions are not the KPI, decisions are).

**Information altitude rule:** Home answers *am I okay?* (0–10s). Plan answers *what's coming and what do I do?* (30–120s). Everything deeper is on-demand. No screen may require scrolling to answer its own headline question.

### 5.2 Screen-by-screen spec

Format: **Purpose · Components · Actions · Primary CTA · Secondary CTA · Empty state · Danger state · Premium hooks · Copy example · Mascot**

**1. Onboarding (full flow in §9)**
- Purpose: provisional Safe Zone in <90s; meet the character; zero paywalls.
- Components: 6 conversational steps, progress dots, skip-to-manual everywhere.
- Actions: answer 4 money questions; pick a Melo colorway.
- Primary CTA: "Show me my Safe Zone."
- Secondary: "I'll explore first" (demo mode with sample data — never trap someone into giving data to see the product).
- Empty: n/a (onboarding *is* the empty state done right).
- Danger: user's answers already imply shortfall → onboarding acknowledges honestly: "Tight month already — good timing, that's exactly what I'm for." Straight into gentle setup, never confetti.
- Premium hooks: none. One glimpse of locked wardrobe in the picker ("more friends later"), unclickable.
- Copy: "Two questions and I'll tell you what's actually safe to spend."
- Mascot: arrives (walks/floats in, ~5s), introduces itself in one line, reacts live to each answer — the reveal moment is its first real emotion.

**2. Connect Bank / Manual Setup (the fork)**
- Purpose: choose data path *after* value is shown (trust sequencing).
- Components: three cards — Connect bank (best accuracy) / Import statement (private, no credentials) / Keep manual (30s/week); privacy one-liner under each; "read-only, we can never move or take money" plainly stated.
- Actions: pick path; OAuth flow or file picker or nothing.
- Primary CTA: "Connect (read-only)."  Secondary: "Import a statement" / "Stay manual."
- Empty: n/a. Danger: connection fails → fog-lite copy, instant fallback to manual with balance quick-entry — never a dead end.
- Premium hooks: 2nd+ account connect = Plus (first is free).
- Copy: "I only *read*. Moving money stays 100% you."
- Mascot: holds a little periscope for connect; shrugs amiably at manual choice ("manual works — I'll just ask you tiny questions sometimes").

**3. Payday Setup**
- Purpose: anchor the cycle — the engine's heartbeat.
- Components: date picker with patterns (last working day, specific date, every 2 weeks, irregular); weekend-shift rule (UK paydays drift — ask once, handle forever); multiple incomes add.
- Actions: set pattern; add second income.
- Primary CTA: "That's my payday." Secondary: "It's irregular" → switches engine to percentile mode (§13) with honest explanation.
- Empty: n/a. Danger: n/a.
- Premium: multiple income streams beyond 2 = Plus.
- Copy: "When does money arrive? Everything counts back from this day."
- Mascot: marks the date on a tiny calendar, circles it with visible satisfaction.

**4. Income Setup**
- Purpose: size the cycle.
- Components: amount entry (net, with "after tax?" nudge); variable-income toggle → "what's a *low* month?" (plan on P25, upside becomes wins); non-salary income chips (UC, benefits, side work — no judgment ordering, benefits listed as plainly as salary).
- Actions: enter amount(s).
- Primary CTA: "Next." Secondary: "It varies" flow.
- Empty/Danger: n/a.
- Premium: none (never gate inputs — data completeness is *our* asset too).
- Copy: "Roughly what lands? Rough is fine — I round *down* on your behalf."
- Mascot: writes it in the ledger, nods.

**5. Bills Setup**
- Purpose: build the Shield in under 60s.
- Components: UK preset chips (rent/mortgage, council tax, energy, water, phone, broadband, car, insurance, subscriptions, debt payments, BNPL) — tap chip → amount + rough date; "detect from statement" if imported/connected; annual-bill prompt ("anything big that hits once a year?").
- Actions: tap-build the bill list; confirm detections.
- Primary CTA: "Shield these." Secondary: "Add the rest later" (progressive setup is fine; the Shield improves weekly).
- Empty: chips make empty impossible in practice.
- Danger: bills > income → the Unsafe flow, handled with §4 dignity: "These don't fit the income yet. Let's see which one moves."
- Premium: none at setup.
- Copy: "Which of these are yours? I'll protect them before anything else gets spent."
- Mascot: physically stacks each confirmed bill into the chest — the Shield is *built in front of you*.

**6. Safe Zone Setup (buffer + essentials)**
- Purpose: the last two inputs the formula needs.
- Components: essentials estimate (food/transport — pre-filled from statement if available, slider if not); buffer choice (£0/£25/£50/£100 with plain meaning: "£50 buffer = I'll warn you £50 early").
- Actions: set both.
- Primary CTA: "Calculate my Safe Zone" → the reveal moment (big number counts up, weather forms, mascot reacts — *the* onboarding payoff).
- Secondary: "Explain the math" (always available, forever).
- Empty/Danger: shortfall → honest reveal variant per §4 Unsafe.
- Premium: custom rules (per-category zones, %-based buffer) = Plus, later.
- Copy: "Buffer is your early-warning margin. I'd rather worry £50 too soon than £1 too late."
- Mascot: does the calculation visibly (scribbles, carries the one) — labor makes the number feel *worked for*, not conjured.

**7. Mascot Selection**
- Purpose: ownership in 15 seconds (endowment effect on day zero).
- Components: three Melo colorways on a rotating plinth; name-your-Melo (optional, default "Melo"); one-line personality preview per colorway (same personality, different accent line — colorway is aesthetic, not mechanics).
- Actions: pick; optionally name.
- Primary CTA: "This one." Secondary: "Surprise me."
- Empty/Danger: n/a. Premium: blurred roster glimpse ("Pebble, Nugget & friends arrive with Plus — later, no rush").
- Copy: "Pick your Melo. They all worry about you equally."
- Mascot: all three wave; the chosen one steps forward, the others wave goodbye without tragedy.

**8. Home (full concepts in §6)**
- Purpose: *am I okay?* answered in ≤10 seconds, ideally glance-only.
- Components: weather sky (ambient header) · mascot + one speech line · **Safe Zone number** (hero, tabular numerals) · runway strip (today→payday: bill dots, danger cell, payday flag) · next-bill chip · ONE action card (never a feed) · Ask input ("Can I afford…?") · tiny-wins ticker line.
- Actions: glance; tap number → math; tap strip → Plan; tap action; ask.
- Primary CTA: contextual action card (state-driven, exactly one).
- Secondary: Ask.
- Empty: never truly empty post-onboarding; missing pieces appear as one gentle setup card max ("2 bills look un-shielded — 20 seconds?").
- Danger: per §4 — storm sky, calm-down design, action card becomes the plan, store affordances vanish.
- Premium: none visible in Calm by default; leak-found card may carry a Plus tag (Warning+ states: nothing).
- Copy: "£184 safe until Friday. Nothing needs you today."
- Mascot: the emotional headline — state-driven per §4; tap it → one flavor line, tap again → it points at the most relevant fact (mascot as *cursor*, not just decoration).

**9. Safe Zone screen (the math)**
- Purpose: trust through decomposition.
- Components: waterfall: balance → −shielded bills → −essentials → −savings → −BNPL → −buffer → **Safe Zone**; each row expands (which bills, what estimate, edit-in-place); accuracy feedback ("does this feel right?" 👍/👎 — the trust flywheel and the tuning signal).
- Actions: audit; correct; adjust buffer.
- Primary CTA: "Looks right." Secondary: "Something's off" → guided correction, thanked, engine visibly updates ("fixed — Safe Zone is now £171").
- Empty: n/a. Danger: negative waterfall rendered matter-of-factly — arithmetic, not verdict.
- Premium: per-category zones; multi-account merge view.
- Copy: "Every pound accounted for. Tap anything that looks wrong — I'd rather be corrected than confidently wrong."
- Mascot: minimal here — sits at the top with an accountant's visor. Numbers do the talking.

**10. Money Weather (forecast sheet — not a tab)**
- Purpose: the week ahead as weather; entered by tapping the sky or strip.
- Components: 7-day (Plus: 30-day) forecast row; each day expandable (expected spend, bills landing, weather + why); weather legend ("what makes it rain?" — teaches the model in plain words).
- Actions: browse; tap a storm day → prevention plan.
- Primary CTA: "Fix Thursday" (when a storm exists). Secondary: legend.
- Empty: pre-data → "I can forecast once I've seen a week of weather."
- Danger: storm day expanded = the full §4 Warning treatment inline.
- Premium: 30-day horizon; weather themes.
- Copy: "Thursday's the one to watch — energy bill lands and it's 6 days from payday."
- Mascot: weather-reporter bit at the top: stands beside the strip gesturing (its most theatrical permitted moment; keeps even bad news broadcast-calm).

**11. Payday Ritual (mode)**
- Purpose: the 2-minute ceremony (§2 P3).
- Components: 5 full-screen beats: celebrate → shield sweep → savings tap → Safe Zone reveal → one smart move; cycle card at the end.
- Actions: confirm sweeps; adjust amounts inline; skip any beat (skips are frictionless and unremarked).
- Primary CTA per beat: "Protect £912" / "Set aside £40" / "Show my month" / "Do the smart move."
- Secondary: "Skip today" (whole ritual skippable — it must stay a gift, not a chore; skipped ritual = one quiet line on home, "ritual's ready when you are," nothing more).
- Empty: no bills configured → mini-setup woven into the ritual itself.
- Danger: income lower than expected → ritual acknowledges first ("lighter than usual — let's make it work"), re-plans, *then* proceeds. Never celebrates a number the user is grieving.
- Premium: auto-ritual (pre-swept, presented for one-tap confirm); savings auto-escalation (+£1/cycle).
- Copy: "31 days of money, 2 minutes of order. Let's go."
- Mascot: master of ceremonies — its biggest scene: conducts the sweep, salutes the shield, unveils the number like a curtain.

**12. Recovery Mode (mode)**
- Purpose: §2 P4. The app's most important screen sequence.
- Components: 3 steps (see plainly / adjust plan / one move) then daily check-in card; days-on-path counter; co-breathing toggle; "talk it through" (Ask Melo in support register).
- Actions: one decision per screen, ever.
- Primary CTA: "Start the way back." Secondary: "Not today" (respected instantly, re-offered tomorrow, never twice a day).
- Empty: n/a (entered only by event). Danger: it *is* the danger handler.
- Premium: **none. Nothing in Recovery is sold, upsold, or badged.**
- Copy: "Three steps. First one takes a minute. No lecture in any of them."
- Mascot: its defining role — sits beside you at the numbers, breathes slowly, small nod at each completed step. The art direction bar: a user in overdraft should *want* to open this screen.

**13. Before You Spend / Ask ("Can I afford this?")**
- Purpose: §2 P8, horizon **Now**.
- Components: amount input (+ optional what/when); verdict card: **Safe / Tight / Not now / Safe on [date]** + post-spend Safe Zone + danger-date delta; alternatives row; **Shelf** button.
- Actions: ask; decide; shelf it; (Plus) save as scenario.
- Primary CTA: none — *the verdict is the product; Melo never says "buy."* Secondary: "Put it on the Shelf."
- Empty: pre-first-use → three example chips ("£4 coffee," "£60 trainers," "£300 flight") teaching range in one glance.
- Danger: asked during Danger state → verdict honest, softer frame: "Not this side of payday — but Tuesday-you can, if the week holds."
- Premium: saved scenarios, stacked what-ifs, BNPL multi-cycle overlay.
- Copy: "£60 trainers? Safe — £71 left after, Thursday stays sunny."
- Mascot: thinking beat (~1s, builds trust in the answer) → verdict expression: relaxed for Safe, weighing-hands for Tight, apologetic-but-firm for Not now.

**14. Money Time Machine (the "Later" tab of Ask)**
- Purpose: scenario planning — §2 P8 horizon **Later**.
- Components: scenario builder from chips (extra shift +£80 / cancel sub / Klarna 3× / delay 2 weeks / pay £50 debt / custom); output = two forecast strips, this-sky vs. that-sky; scenario shelf (Plus).
- Actions: build; compare; adopt ("make this the plan" → writes to Shield/Goals).
- Primary CTA: "Compare skies." Secondary: "Save scenario" (Plus).
- Empty: "Ask me a *what if*. What if you cancelled one thing? Worked one extra shift?"
- Danger: scenario worsens things → shown plainly with the *why*, no drama.
- Premium: >1 active scenario; multi-cycle horizon; scenario stacking.
- Copy: "Klarna splits it £267×3. March you: fine. April you: £31 tight. May you: sunny. Your call — here's each month's sky."
- Mascot: holds two small umbrellas — one per future. (Time-travel goggles unlock as a cosmetic; the feature stays sober.)

**15. Money Leaks**
- Purpose: §2 P6 — found money.
- Components: leak cards (name, £/mo, **£/yr**, last charge, confidence); price-rise flags with delta; total-found banner ("£312/year found so far"); cancel guides (steps, links, scripts for phone-only cancellations).
- Actions: mark "keep" (respected forever — Spotify is not a leak if it's loved; *chosen* subscriptions are never nagged); cancel with guide; snooze.
- Primary CTA: "Show me the steps." Secondary: "I use this — keep it."
- Empty: manual mode → subscription checklist entry; connected → "scanning… first pass found 3."
- Danger: leak card never appears in Danger state *as upsell*; leak *finding* still runs (finding money is exactly what Danger needs).
- Premium: full engine, rise-monitoring, concierge guides (top-3 leaks free).
- Copy: "Netflix went £10.99 → £12.99 in April. Fine if it's loved. If not — 30-second cancel, £156/year back."
- Mascot: detective — magnifier, small "aha!" on finds; sweeps a puddle dry when a leak is cancelled (the leak *visual* is puddles; killing one is weirdly satisfying and that's the point).

**16. Bills Shield**
- Purpose: §2 P9 — see protection working.
- Components: cycle bill list (shielded/landed/covered states); coverage bar; annual-smoothing section ("car insurance £480 in Nov → £40/month set aside, 7/12 filled"); bill-rise flags; the chest.
- Actions: add/edit/confirm bills; smooth an annual; shift a date (guide to calling providers — UK reality).
- Primary CTA: "Shield it." Secondary: "Smooth this annual bill."
- Empty: chips from screen 5 reappear.
- Danger: unshieldable bill (short cycle) → triaged into the Unsafe options flow with dignity.
- Premium: smoothing automation, negotiation guides, cross-provider rise-alerts.
- Copy: "£912 protected this cycle. The important things are safe."
- Mascot: guards the chest; pats it when a bill lands covered ("that's what we saved it for").

**17. Savings Goals**
- Purpose: buffer-first saving that survives real life.
- Components: goal cards (emergency buffer always first, then custom: holiday, deposit, Christmas); per-goal weather (a goal can be sunny while spending is cloudy — separated feelings); pause-without-shame ("goals bend so the Shield doesn't").
- Actions: create; fund (ritual-linked); pause; celebrate.
- Primary CTA: "Start the buffer — £2/day." Secondary: "Pause this goal" (one tap, no interrogation).
- Empty: "One goal beats five. Buffer first — it makes every other goal safer."
- Danger: in Danger/Recovery, goal contributions auto-offer to pause with the *math shown* (what it costs the goal date). User chooses; Melo never raids goals silently.
- Premium: >2 goals; auto-rules (roundups, payday %); goal sharing (household).
- Copy: "£240 of £500. The boring miracle, 48% done."
- Mascot: Pebble-logic even for Melo-creature: a visible token per goal that grows/polishes — savings needs an *object*.
- (Secondary CTA everywhere in Savings avoids "lock" language — money stays reachable; UK users fear lock-ins for good reasons.)

**18. Tiny Wins (layer + log)**
- Purpose: §2 P10 — visible momentum.
- Components: home ticker (one line, latest win); wins log (chronological, filterable) inside Weekly Review; celebration moments (≤2s, non-blocking).
- Actions: none required (wins are noticed, not claimed); tap → context ("this pushed your danger date 2 days").
- Primary CTA: occasionally "share this one" (milestone-grade only). Secondary: mute celebrations (respected; wins still logged).
- Empty: week one seeds guaranteed wins: onboarding itself ("you built your first Safe Zone") — never an empty wins screen in week one, by design.
- Danger: wins keep flowing in bad states — *especially* then ("kept the shield intact through a storm week" is a win precisely when it's hard).
- Premium: none (wins are sacred). Milestone cosmetics come *from* wins.
- Copy: "You checked before buying, 4× this week. That's the habit that changes everything — most people never build it."
- Mascot: the celebration performer — but scaled: tiny win = small nod/spark; milestone = the full number.

**19. Mascot Customization (studio)**
- Purpose: identity investment; the emotional-premium showroom.
- Components: live mascot (current mood — customization never masks state); wardrobe grid (owned/earned/locked); scenes; pets; personality voice picker; outfit slots + saved looks; "reacts in outfit" preview (see your look *in each emotion* — sells the rig, not a JPEG).
- Actions: dress; save looks; equip pet/scene/voice.
- Primary CTA: "Wear it." Secondary: "Save this look."
- Empty: starter wardrobe guarantees a first session; earned-item slots visible as silhouettes ("survive a bill week to earn this") — aspiration without price tags.
- Danger: studio accessible but **store shelf hidden** in suppressed states (dressing your Melo while broke: fine, therapeutic even; being *sold to* while broke: banned).
- Premium: the catalog (§8) — packs, seasons, roster characters, voices.
- Copy: "The medic set. Melo, dressed as your actual Tuesday."
- Mascot: fitting-room delight — tries things on with opinions (small wince at clashing combos; approval is earned, which makes it fun).

**20. Premium Store / Unlocks**
- Purpose: fair catalog; conversion without pressure.
- Components: Plus pitch (functional features first, honestly listed with what stays free); cosmetic catalog by category; seasonal shelf; **the honesty check** — the paywall runs *your* Safe Zone: "Plus is £4.99/mo. Right now that's inside your Safe Zone ✓" or "Honestly? Not this week. I'll mention it after payday — if you want."
- Actions: subscribe; buy pack; wishlist (wishlisted items can be *earned* on milestone weeks occasionally — generosity beats discounting).
- Primary CTA: "Try Plus free for 14 days." Secondary: "Remind me after payday" (a *feature*, not a retention trick — it fires exactly once).
- Empty: n/a.
- Danger: **store unreachable from suppressed states** — nav badge hides, deep links redirect to home with no error.
- Premium hooks: it is one. Anti-hooks per §8 ethics.
- Copy: "What's free stays free: your Safe Zone, warnings, recovery — the safety stuff. Plus buys depth and style, never rescue."
- Mascot: honest shopkeeper — presents, never pleads. In "not this week" verdicts it *agrees with you*, visibly. (That animation is the brand.)

**21. Weekly Review (the Sunday Reset)**
- Purpose: 3-minute week close + week-ahead setup; the reflection loop.
- Components: week weather recap strip; in/out vs. usual (vs. *your* normal, never other people); wins log; next week's forecast + bills; one adjustment suggestion.
- Actions: read; accept/adjust the one suggestion; done.
- Primary CTA: "Set up my week." Secondary: "Just the numbers" (skips narrative — respects moods).
- Empty: first week → shorter version, expectations set ("reviews get smarter as I learn your normal").
- Danger: bad week → recap leads with what *held* ("bills stayed covered — the floor held") before what slipped; §10 tone throughout.
- Premium: deep version (category trends, merchant analysis, exportable PDF).
- Copy: "Week 3: mostly sunny, one rainy Thursday. Spending £12 under your usual. Next week: bill week — plan's ready."
- Mascot: sits beside you reading the same report (not presenting it — *with* you, the recurring posture).
- Delivered as a Sunday-evening notification (user-tunable) — the calmest money moment of the week, on purpose.

**22. Monthly Review**
- Purpose: the cycle story; progress at narrative altitude.
- Components: cycle weather map (calendar of days as weather); the three numbers (in / out / kept); buffer trajectory; leaks found; milestone shelf; next-cycle preview with one structural suggestion ("your phone bill is 22% above typical — worth a switch look?").
- Actions: read; act on the structural suggestion; share the (amount-hidden) cycle card.
- Primary CTA: the structural suggestion. Secondary: share.
- Empty: month one → foundations version.
- Danger: overdraft month → the honest chapter: what happened (weather framing, no autopsy), what held, what changes; Recovery stats if applicable, framed as *distance walked*, not damage report.
- Premium: full history archive (free keeps 3 months), PDF export, year-in-weather.
- Copy: "March: 24 sunny, 5 cloudy, 2 storm. You kept £61 — first positive month since November."
- Mascot: one commemorative pose on the cycle card (collectible energy — subtle).
- (Year-end "Your Year in Weather" = the shareable annual artifact; Spotify-Wrapped for money, amounts optional. Plan it from day one; it's the growth loop.)

**23. Notifications (system + settings surface)**
- Purpose: the app's voice when closed — governed by the §7 budget and §16.5 catalog.
- Components (settings): budget slider (default ≤1/day); quiet hours (default 21:00–08:00, danger included — nothing useful happens to money at 2am except panic); per-category toggles (payday/bills/danger/wins/weekly); preview of each type *with its actual copy* (informed consent as UX).
- Actions: tune; preview; mute categories.
- Primary CTA: "Keep it useful." Secondary: "Essentials only" preset (danger + payday + bills landed, nothing else — offered proactively, because an app confident enough to offer near-silence is an app you trust).
- Empty/Danger: n/a / danger notifications capped at 1/day regardless of budget.
- Premium: none. Notification volume is never monetized in either direction.
- Copy (settings header): "Every ping carries its information *in the ping*. No 'open to find out.' That's a promise."
- Mascot: expression thumbnails in rich notifications where OS allows; never a red-badge farm (badge count = actionable items only, usually 0).

**24. Widgets**
- Purpose: the true daily surface — the glance without the open.
- Components: **Small**: mascot expression + Safe Zone number + weather tint (the whole product in 1cm²). **Medium**: + runway strip with danger cell. **Large**: + next bill, one action line. **Lock screen**: number + weather glyph. **Watch complication**: glyph + number.
- Actions: tap-through targets (number→home, strip→Plan, mascot→its line).
- Empty: pre-setup → mascot holding a "2 mins to set up" sign.
- Danger: widget goes storm-tinted, mascot to Concern — *the pocket weathervane working*; no red, no pulsing.
- Premium: widget skins/themes; extra layouts. Data itself never gated.
- Copy: none needed — that's the point. (Large: "£184 · sunny to Friday.")
- Mascot: this is where mood-as-information earns its keep — a worried Melo on the home screen at 8am *is* the notification.

**25. Settings**
- Purpose: control, trust infrastructure, exits that don't punish.
- Components: data & privacy (export everything, free, always — one tap; delete account with real deletion honestly described); connections; household; notification tuning (→23); **Quiet Mode toggle** (de-mascot the app; per-surface options: "quiet widgets, playful app" etc.); accessibility (reduced motion honors OS + in-app override — mascot becomes static portraits with text labels; VoiceOver labels carry the *state*, not just numbers: "Safe Zone £184, weather sunny, Melo is calm"); subscription management (cancel in two taps, no guilt screen — canceling shows what you keep, not what you lose).
- Actions: everything above.
- Primary CTA: n/a. Secondary: n/a.
- Empty/Danger: n/a.
- Premium: manage/cancel lives here, friction-free by principle.
- Copy: "Your data leaves with you whenever you want. That's yours; that was always the deal."
- Mascot: minimal presence; waves once at the bottom ("nothing to sell here").

---

## §6 — The Home Screen

### 6.1 The recommended home: "The Glance Stack" (safe-zone-first, mascot-carried)

Not a spreadsheet, not a dashboard — a *weather report for your money*, read top to bottom in one saccade path:

```
╭──────────────────────────────────────╮
│  ~ ambient weather sky (gradient,    │   ← state, felt before read
│    minimal particles, parallax) ~    │
│                                      │
│        [Melo, reacting]              │   ← emotional headline
│   "Nothing needs you today."         │   ← one line, its voice
│                                      │
│          £184                        │   ← SAFE ZONE (hero, tabular,
│      safe until Fri 12th             │      tap → the math)
│                                      │
│  ●──●──○──▲──○──○──⚑                │   ← runway: today→payday
│  bills landed · energy Thu · payday  │      (▲ = storm cell if any)
│                                      │
│  ┌ One thing, if you want ─────────┐ │
│  │ Energy rose £14 — 3-min fix     │ │   ← ONE action card (state-driven)
│  └─────────────────────────────────┘ │
│                                      │
│  Can I afford… [___________] →       │   ← the habit, always reachable
│  ✦ 3 checks-before-buying this week  │   ← tiny-wins ticker
╰──────────────────────────────────────╯
```

Reading depths: **0s** (widget/sky/mascot = state), **3s** (+ number + runway), **10s** (+ action + win). Nothing below the fold is required to answer "am I okay?"

### 6.2 Five alternatives, honestly compared

**A. Mascot-first** (mascot huge and central; number secondary below)
- Pros: maximum attachment and brand; strongest emotional read; screenshots itself.
- Cons: fails the glance test for the *number*; risks "toy" perception with exactly the users who most need convincing; utility feels subordinated.
- Best for: Gen-Z, Finch migrators, cosmetic-heavy users.
- Verdict: not default; ship later as a **layout option** ("Companion layout") — cheap, loved by a minority, harmless.

**B. Safe-Zone-first / Glance Stack** (the recommendation, above)
- Pros: utility leads, emotion carries; survives the "is this serious?" test *and* the "do I love it?" test; every element earns its pixel.
- Cons: needs discipline to keep the one-action rule (product will constantly want to add cards); mascot fans may want more character.
- Best for: the core wedge — payday-cycle adults who want help, not a pet.
- Verdict: **default.**

**C. Weather-first** (full-bleed sky, number floating in it, mascot small)
- Pros: most beautiful; most emotionally atmospheric; unbeatable in App Store screenshots.
- Cons: weather is a *layer*, not the *information* — forcing it to lead buries the number and the actions; gorgeous-but-vague is the Calm-app trap.
- Best for: design-forward users; marketing assets.
- Verdict: donate its ideas to the ambient layer (already done); a "Big Sky" premium *theme* can deliver the aesthetic without the hierarchy cost.

**D. Calendar/timeline-first** (the runway strip becomes the whole screen: money as a river of days)
- Pros: uniquely honest about the payday-cycle mental model ("getting to Friday"); bills/danger/payday in one spatial story; great for planners.
- Cons: cognitively heavier at a glance; state ("am I okay?") must be *inferred* from the timeline rather than *told*; weaker mascot integration.
- Best for: irregular-income users (their whole life is the timeline), heavy planners.
- Verdict: this is the **Plan tab's** hero view, promoted to home as a layout option for irregular-income mode.

**E. Adult premium minimalist ("Quiet Mode home")**
- Pros: number + runway + one line, system font, no character, no sky — the app your CFO could use; kills the childish objection outright; near-zero maintenance.
- Cons: sheds the differentiation and most retention mechanics; emotion carried only by copy.
- Best for: mascot-averse adults, professionals, Quiet Mode users (and there will be many — respect them).
- Verdict: ships at launch as **Quiet Mode** (one toggle), not a separate product. Same engine, same copy discipline, no character. Quiet Mode users still get weather *words* — the vocabulary survives even when the sky doesn't.

---

## §7 — Retention Loops

Format: **Trigger → Action → Reward → Investment → Return reason → How it compounds.**

1. **Daily glance loop** *(the heartbeat)* — Trigger: widget/home-screen mascot mood shift (information scent) → Action: 3–10s glance, maybe tap the math → Reward: certainty ("I know where I stand") → Investment: none — *zero-cost loops are the ones that survive bad weeks* → Return: the number decays daily; tomorrow's glance is tomorrow's certainty → Compounds: glance→check-before-buying→fewer storms→more sunny glances (the loop makes its own weather improve).
2. **Payday Ritual loop** *(the anchor)* — Trigger: income lands (detected or scheduled) → Action: the 2-minute ceremony → Reward: a protected month + the reveal + ceremony feeling → Investment: bill confirmations, savings commitment (each ritual enriches the engine) → Return: next payday is structurally guaranteed → Compounds: each ritual's data makes every other feature smarter; ritual streaks unlock earned cosmetics.
3. **Sunday Reset loop** — Trigger: Sunday-evening review notification → Action: 3-minute week close + one adjustment → Reward: closure + a set-up week → Investment: the accepted adjustment (a plan you made is a plan you return to check on) → Return: next Sunday → Compounds: weeks of reviews become the monthly story; the app's "memory of you" deepens visibly.
4. **Danger warning loop** — Trigger: danger date appears/moves closer → Action: apply the per-day plan or a micro-move → Reward: *watching the danger date retreat* (the single most motivating feedback in the product; instrument it) → Investment: the plan itself → Return: verify the retreat tomorrow → Compounds: survived storms build self-trust and app-trust simultaneously; "Melo caught it early" becomes the retention story users tell.
5. **Recovery loop** — Trigger: overspend event → Action: 3 steps + daily 20-second check-ins → Reward: "days on the path" + graduation rainbow → Investment: emotional — Melo showed up at the worst moment (unforgettable, uncopyable) → Return: daily check-in cadence, then loyalty → Compounds: recovery graduates are the highest-LTV, highest-word-of-mouth cohort; each recovery also teaches the engine that user's storm patterns.
6. **Tiny wins loop** — Trigger: win detected (variable interval — healthy slot-machine cadence) → Action: none required (that's the design) → Reward: being *noticed* → Investment: none → Return: ambient positive expectation ("what did it notice today?") → Compounds: wins accumulate into milestones into earned cosmetics into identity.
7. **Mascot progression loop** — Trigger: milestone/seasonal drop/earned unlock → Action: studio session (dress, save look) → Reward: identity expression + the mascot's approval bit → Investment: the look *is* sunk identity; earned items are trophies → Return: next unlock, next season → Compounds: wardrobe = visible history of the user's money journey (the "survived Christmas '26" pin means something *because* it can't be bought).
8. **Premium unlock loop** — Trigger: value moment (leak found > sub price; 2nd account; scenario save) → Action: trial/subscribe → Reward: depth features + catalog access → Investment: configuration of premium features (auto-rules, household) = switching costs of the honest kind → Return: the features run continuously → Compounds: each premium feature adopted adds a daily-value surface; §8 ethics keep the loop *non-resented*, which is why it lasts.
9. **Widget loop** — Trigger: unlocking the phone (≈100×/day, free distribution) → Action: passive glance → Reward: state certainty without opening anything → Investment: widget placement itself (home-screen real estate = the most valuable shelf in consumer software) → Return: automatic → Compounds: widget mood-shifts drive precisely-timed opens (the widget is the top of every other loop's funnel).
10. **Social/share loop** — Trigger: milestone card / year-in-weather / a "Melo said no to selling me Plus" screenshot → Action: share (amounts hidden by default, always) → Reward: earned pride + identity signal → Investment: public commitment ("I'm the person getting my money right") → Return: audience acknowledgment → Compounds: every share is an ad with built-in social proof; the honesty moments are engineered to be screenshot-shaped.
11. **Household loop** — Trigger: partner joins; shared weather forms → Action: shared bills board + no-blame weather check-ins → Reward: money conversations with a referee-less shared language ("we're cloudy this week" beats "you spent what?") → Investment: the shared board — leaving Melo now means renegotiating the household system → Return: both partners' events feed one weather → Compounds: two users' retention curves reinforce; household accounts churn at a fraction of solo rates (structural, not behavioral).

---

## §8 — Premium & Monetization

### 8.1 The ethical frame (the rules that make the money durable)

1. **Safety is free forever:** Safe Zone core, danger warnings, Recovery Mode (all of it), bill shields (core), unlimited "can I afford this?" checks, data export. If it prevents harm, it has no price.
2. **Mood is never for sale.** The mascot's emotional state is a pure function of finances. No purchase can cheer it; no lack of purchase can sadden it.
3. **Suppressed-state rule:** no paywall, store badge, upsell card, or sale notification renders while the user is in Warning / Danger / Overspent / Recovery / Unsafe / Fog. Enforced in the component layer (§4.3), verified in CI.
4. **The honesty check:** the paywall evaluates *your* Safe Zone against the price and will tell you not to subscribe this week. (Costs a few conversions; buys the brand. Screenshot-shaped by design.)
5. **No dark patterns:** no countdown timers on money features, no loss-framed cancel flows ("Melo will miss you 😢" — banned), no consumable currency, no loot boxes. Seasonal items return every year.
6. **Cancel in two taps.** The cancel screen shows what you *keep* (everything safety-critical), not what you lose.
7. **No ads, no data resale, no lending referrals** in v1. Revisit *never* for the first two; lending only if it can ever be genuinely user-side (doubtful — default no).
8. **One subscription covers the household.** Charging couples twice for shared money safety is self-defeating arithmetic.

### 8.2 The plans

**Free — "Melo"** *(a complete safety product, not a demo)*
Safe Zone (1 account: manual, statement-import, or 1 bank connection) · money weather + 7-day forecast · danger date · payday ritual (manual) · Recovery Mode (full) · Bills Shield (core) · unlimited afford-checks + the Shelf · 1 savings goal + buffer · top-3 leaks + manual sub tracking · tiny wins · weekly review (standard) · monthly review (3-month history) · widgets (standard) · Melo in 3 colorways + starter & earned wardrobe · Quiet Mode.

**Plus — £4.99/month or £34.99/year** *(depth + identity)*
- *Functional:* multi-account aggregation · full leaks engine + price-rise monitoring + cancel concierge · scenario planning (saved/stacked/multi-cycle, BNPL overlays) · payday automation (auto-sweep, auto-escalating savings) · irregular-income engine (percentile planning, money-landed rituals) · annual-bill smoothing automation · household mode (shared weather, bills board, partner invite) · advanced forecasts (30-day weather) · deep weekly/monthly reports + PDF export + full history · custom rules & per-category zones · premium widget layouts · priority daily recompute.
- *Emotional:* character roster (Pebble, Nugget, then quarterly drops) · outfit/job/style packs · seasonal drops · scenes & rooms · companion pets · personality voices · celebration effects · app-icon packs · "Night Ledger" + "Big Sky" themes.

**Pro — not at launch.** Add only when household + forecasting depth proves demand (target: Phase 6, £8.99/mo) — multi-household, shared goals with permissions, forecast API/export, priority support. Launching three tiers on day one splits a young value story.

**À la carte cosmetics (non-subscribers):** packs £1.99–£4.99, seasonal £2.99, roster characters £4.99 each. Everything à la carte is *included* in Plus (the Duolingo-gem mistake inverted: subscription is always the better deal, visibly).

**Pricing logic:** Cleo £5.99–£14.99, Emma £4.99–£14.99, YNAB ~£8+/mo equivalent. £4.99 undercuts the category's utility tier while cosmetics lift ARPU past it; £34.99 annual (~42% off) front-loads commitment where retention economics live. UK-first pricing; US at parity numbers ($4.99) later.

### 8.3 Paywall moments (offer when value is *felt*)

1. End of first completed payday ritual ("that, automated, every payday — plus the deep engine").
2. Leak found worth > subscription ("this one leak pays for Plus 3× over").
3. Second bank account added.
4. Scenario save attempted.
5. Wardrobe browse → locked pack tapped (cosmetic desire converts on its own schedule; never interrupt).
6. Day-30 "first month in weather" recap ends with the deep version, one screen, once.

### 8.4 Anti-paywall moments (help is free *especially here*)

Danger and Storm states · all of Recovery · the Unsafe-cycle options flow · fog/reconnection · the first payday ritual (never gate the aha) · post-overdraft week (no upsell for 7 days after an overdraft event, even in Calm — the user remembers who asked for money while they drowned) · bereavement/income-loss signals if detectable (income stops → Melo goes pure-service mode).

---

## §9 — Onboarding (60 seconds to the number)

**Design law:** value before data-ask; provisional beats precise; one question per screen; the mascot reacts to every answer (the form is *alive*); no paywall anywhere in the flow.

| # | Beat | Screen does | Copy (verbatim draft) | Time |
|---|---|---|---|---|
| 0 | Cold open | One line + one button. No carousel, no feature tour, no "welcome to the future of finance." | "I'm Melo. Two questions and I'll tell you what's *actually* safe to spend." → **[Let's do it]** / tiny: *look around first* (demo data) | 5s |
| 1 | Meet | Mascot arrives (2s animation), picker: 3 colorways | "Pick your Melo. They all worry about you equally." | 10s |
| 2 | Payday | Date pattern picker | "When does money arrive? Everything counts back from that day." *(mascot circles it on a tiny calendar)* | 10s |
| 3 | Income | Amount, rough is fine + "it varies" path | "Roughly what lands? I round *down* on your behalf." | 10s |
| 4 | Big bills | UK preset chips, tap-tap-tap | "Which of these are yours? These get protected first." *(mascot stacks each into the chest — the Shield builds live)* | 20s |
| 5 | **The Reveal** | Safe Zone counts up · weather sky forms · runway strip draws · mascot reacts to *the user's actual state* (calm/tight/concern — honest from second zero) | "£184 until the 12th. That's your real number — balance minus everything that's spoken for." / tight variant: "£31 until Friday. Tight — good timing, this is exactly what I'm for." | at ~55–60s |
| 6 | Accuracy fork | Three cards: connect (read-only) / import statement / stay manual | "Want me more accurate? I can only *read* — moving money stays 100% you." | 15s |
| 7 | Notifications | Honest pitch, preview of actual pings | "About one a day, each one useful on its own. No 'open the app to find out.' Fair?" → **[Fair]** / [Essentials only] | 10s |
| 8 | First win | Tiny-win moment fires | "✦ First win: you know your real number. Most people never do." → lands on Home | 5s |

Total: ~90s to a live home screen; the *number* lands at ~60s. Bank connection is step 6, **after** competence is proven — trust sequencing. Every step past 2 is skippable ("later" always works; the engine degrades gracefully to wider confidence bands and says so in fog-vocabulary).

**Onboarding failure states:** abandons at 2–4 → next open resumes in place, zero repeated questions. Answers imply Unsafe cycle → the reveal is the honest variant and the first action is the options flow, not confetti (first impressions must never lie — an app that celebrates while you're drowning is an app you delete).

---

## §10 — Copy & Tone of Voice

### 10.1 The voice

Calm, direct, warm, a little dry. Melo talks like the friend who's good with money and *kind about it* — short sentences, concrete numbers, one idea per line. It admits uncertainty ("around Thursday"), rounds in the user's favor, and always pairs a warning with a move. It never performs enthusiasm it hasn't earned and never fakes certainty it doesn't have. First person ("I") is used sparingly — mostly when taking responsibility ("I'd rather be corrected than confidently wrong") or offering presence ("I'll stay close"). It is never the user's parent, coach, conscience, or comedian. **Rule of thumb: every sentence must survive being read by someone crying at a bus stop.** If it can't, rewrite it.

Mechanics: numbers always concrete (£38, not "a bit short") · verbs over adjectives · warnings always carry the exit ("£9/day keeps it dry") · celebration understated (the number does the talking) · questions rare and never rhetorical · emoji ≈2 sanctioned moments/month (payday, milestone), none in warnings, ever.

### 10.2 Copy by situation (verbatim drafts)

| Situation | Copy |
|---|---|
| Safe | "£184 safe until Friday. Nothing needs you today." |
| Overspending (early) | "Spending's running warm — about £12/day faster than usual. Skip one thing tomorrow and Thursday stays calm." |
| Broke until payday | "The honest number: £0 spare until Friday. Bills are covered and food money's set aside — we just get to Friday. I'll stay close." |
| Paid rent | "Rent's done. Biggest one of the month, behind you." |
| Got paid | "Payday. Before it starts disappearing — two minutes to make it safe?" |
| Saved money | "£15 tucked away. That's one storm smaller." |
| Cancelled a subscription | "That's £7.99/month back — £96 a year you just un-spent." |
| Missed a savings target | "Savings didn't happen this month. Plans bend — £5 this week keeps it alive." |
| Entering recovery | "Okay. It went over. No lecture — here's the way back: three steps, the first one takes a minute." |
| "Can I afford this?" (yes) | "Safe. £71 left after, and Thursday stays sunny." |
| "Can I afford this?" (tight) | "Tight. It'd leave £9 until Friday — doable, not comfy. The 28th-version-of-you buys this easily." |
| "Can I afford this?" (no) | "Not this side of payday. On the 12th it's a yes. Want it on the Shelf till then?" |
| Returns after ignoring the app | "Hey. No guilt — money kept moving and I kept notes. 60-second catch-up?" |
| Considering premium | "Plus is £4.99 a month. Real talk: that's inside your Safe Zone right now. If it ever isn't, I'll say so." |
| Considering premium (can't afford) | "Honestly? Not this week — it'd cut into food money. I'll mention it after payday, if you want." |
| Hits a milestone | "£500 buffer. Six months ago this was £0. The boring miracle, on schedule." |

### 10.3 The banned list (enforced as a CI copy-lint, not a vibe)

**Shame & judgment:** "you failed" · "you blew it" · "naughty" / "bad" (about the person or the purchase) · "what happened?!" · "you should have…" · "why did you…" · **the word "again" in any negative context** (the cruelest word in fintech) · "we noticed you overspent" (surveillance voice) · any comparison to other users in a negative frame ("most people save more").

**Panic & pressure:** ALL-CAPS warnings · "URGENT" · 😬 💀 🚨 🔥 in any money context · "last chance" · "hurry" · "act now" · countdown language on anything financial.

**Infantilizing:** "oops!" · "uh oh!" · "yikes!" · "whoopsie" · "piggy bank" (unless the user says it first) · baby-talk of any species.

**Fake certainty & fake cheer:** "you WILL run out" (forecasts are "around/likely") · "congratulations!!!" (one exclamation mark is the ceiling, most celebrations use none) · "amazing!!" for trivial acts · "great job checking your balance!" (patronizing).

**Corporate & cold:** "insufficient funds" · "utilization" · "discretionary spend" (say "spending money") · "financial wellness journey" · "empower" · "unlock your potential."

**Spending-pushy & guilt-tricky:** "treat yourself" (Melo answers, never prompts spending) · "guilt-free" (imports the guilt it denies) · "you deserve it" · "don't break your streak!" · "Melo will miss you" (emotional blackmail) · "are you sure you want to cancel?" repeated more than zero times.

**Identity labels:** Melo never calls the user "broke," "poor," "bad with money," or "a spender." States belong to *cycles and weather*, never to the person.

---

## §11 — Visual Direction

Five directions, one winner, two survivors-as-themes.

**1. "Warm Paper" — the recommendation.**
- Mood: a well-designed notebook that likes you; daylight, calm, tactile.
- Color: warm cream/paper base (≈ #F7F2EA), soft ink text (≈ #22201B), weather does the tinting — gold-amber (sun), grey-blue washes (rain), deep slate (storm), muted violet fog; one warm accent (terracotta — Melo's ember).
- Type: one humanist grotesk with real warmth for UI + **tabular numerals treated as the second typeface** — money numbers get their own weight/rhythm and are never red.
- Mascot style: flat vector with soft-depth shading, muted palette, thick-ish confident lineless shapes.
- UI style: paper surfaces, hairline dividers, generous breathing room, corners rounded-but-not-bubbly (12–16px), depth from layering not drop-shadow soup.
- Animation: 200–300ms ease-out; physical, small; **motion *decreases* in bad states** (§4).
- Adult/cute balance: 70/30 adult — the character brings all the cute; the frame stays grown.
- Strengths: differentiated from the entire navy-fintech shelf; ages well; the weather layer gets a neutral canvas; matches the proven paper/near-flat/breathing-room system already validated in this product family.
- Weaknesses: cream is unfashionable in dark-mode-default culture (mitigated: Night Ledger below); restraint is hard to art-direct cheaply.

**2. "Night Ledger" — premium dark theme (survivor).**
- Mood: candlelit study, not crypto-terminal. Warm dark (charcoal-brown, not blue-black), amber accents, mascot glow does real work.
- Strengths: the glow-as-status mechanic is *better* in the dark; night-time check-ins feel intimate.  Weaknesses: as a default it reads trading-app and attracts the wrong self-image.  Verdict: **ships as the flagship Plus theme.**

**3. "Swiss Money" — ultra-minimal (survivor).**
- Mood: Braun calculator; grid, mono-ish numerals, zero ornament, no character.
- Strengths: unimpeachably adult.  Weaknesses: sheds the entire differentiation; retention burden falls on copy alone.  Verdict: **becomes Quiet Mode's skin** — it exists so the mascot can be optional without the product falling apart.

**4. "Storybook Watercolor" — rejected as system.**
- Mood: illustrated picture-book warmth.  Strengths: emotional depth, gorgeous seasonal potential.  Weaknesses: reads children's app at UI scale; expensive to produce consistently; ages the audience *down* exactly where we can't afford it.  Verdict: rejected for product UI; **mined for seasonal marketing art and year-in-weather illustrations.**

**5. "Tactile Toy" — rejected.**
- Mood: 3D clay/vinyl renders, big soft shapes (the post-Airbnb-redesign look).  Strengths: trendy, tangible.  Weaknesses: 3D pipeline cost, uncanny risk, AI-slop adjacency (the look every generated app has), dates fast.  Verdict: rejected entirely.

**The final feel** (Warm Paper + weather + the character): *personal finance × emotional companion × premium daily utility* — a calm paper room whose light changes with your money, inhabited by something small that's on your side. Explicitly avoided: fintech navy, AI gradients, dashboard grids, Duolingo lime, cartoon-casino gamification, fake-bank marble seriousness.

---

## §12 — Competitive Positioning

| Competitor | What they do well | Learn | Don't copy | Melo's difference |
|---|---|---|---|---|
| **Monzo** | Instant notifications, pots, salary sorter, trust at scale, UK cultural fluency | The salary-sorter *mechanic* (our ritual's plumbing); notification excellence; plain-English money UI | Being a bank (capital, compliance, support burden); feature sprawl into investments/insurance | Melo is bank-agnostic — the emotional layer *above* whatever bank; Monzo shows your money, Melo tells you what it means for Friday |
| **Revolut** | Feature velocity, powerful FX/multi-currency, slick execution | Execution speed; internationalization discipline | The everything-app strategy; trading-floor energy (opposite brand) | Revolut optimizes for power users' breadth; Melo optimizes for anxious normals' depth-of-one-number |
| **Cleo** | Personality-led finance *proven* (Gen-Z pays for it); chat fluency; US cash-advance engine | Personality drives engagement and willingness-to-pay in money apps — validated; humor as retention | Roast mode (monetized shame); chat as the primary UI (high friction for glances); cash-advance dependence (misaligned incentives — profits when users stay broke) | Cleo talks *at* you brilliantly; Melo *stands with* you. Glance > chat. And Melo's business model improves when the user's money improves |
| **Emma** | Aggregation breadth, subscription detection, solid analytics | The leaks engine ambition; multi-account UX | Dashboard-of-everything IA (analytics ≠ answers); premium tiers that feel like feature ransom | Emma answers "where did it go?"; Melo answers "am I okay and what now?" |
| **YNAB** | The methodology works; cult retention; education excellence; genuinely changes lives of completers | Give-every-pound-a-job (the Shield is its automated cousin); teaching users a *model*, not just numbers | The homework (95% bounce off it); pro-tool pricing; spreadsheet soul | YNAB outcomes for people who will never do YNAB: the Safe Zone *is* zero-based budgeting, computed silently |
| **Plum / Chip** | Set-and-forget saving automation; roundups; painless-saving psychology | Automation as the path past willpower; "money moved before you saw it" | Fee-heavy tiering; investment upsell creep | Plum automates saving; Melo automates *knowing*. (Later: Melo can drive Plum-style rules from inside the ritual) |
| **Snoop** | Bill-switching value; merchant-level insights; "Snoops" as digestible nudges | Bill-rise detection and switch prompts (our leaks engine learns from this) | Deal-feed identity (becomes a coupon app); monetization via referrals shaping advice | Snoop saves you money on bills; Melo saves you from *not knowing* — and its advice carries no referral thumb on the scale (v1) |
| **Traditional bank apps** | Trust, ubiquity, the actual rails, improving slowly | Nothing UX-wise; everything trust-wise (their seriousness is why people believe their numbers) | Their conservatism, their balance-first worldview | Banks are structurally unable to say "you can't afford this" (they profit from overdrafts). Melo's only product *is* that sentence, said kindly |
| **Spreadsheet budgeting** | Total flexibility; total transparency; free; the power user's truth | Transparency-of-math (our show-the-math is the spreadsheet's soul, kept); user's sense of *ownership* | The manual grind; the blank-page problem; zero proactivity | The spreadsheet never texts you at 8am saying "storm Thursday." Melo is the spreadsheet that walks beside you |
| **Duolingo** | Character-carried habit at world scale; streak design; widget mood mastery; brand-as-character | The character *is* the interface; widget expressions; seasonal character events; sound design discipline | Guilt mechanics (passive-aggressive owl is a *joke publicly tolerated*, not loved — in money it would be hated); notification aggression; gamification-over-substance drift | Duo pressures you on the app's behalf; Melo worries on yours. In finance, guilt doesn't create sessions — it creates deletions |
| **Finch (self-care pet)** | Emotional attachment → paid conversion (proven); gentleness of tone; daily-care ritual adherence | Tone gentleness calibration; how cosmetics monetize care; permission-to-be-soft in a "serious" category | The care *burden* (you keep the pet alive — inverted for money: nobody broke should also owe emotional labor to a bird); task-density | Finch: you care for it. Melo: it cares for you. That inversion **is** the product |

---

## §13 — Product Risks & Mitigations

| # | Risk | Why it's real | Mitigation |
|---|---|---|---|
| 1 | **Mascot reads childish** → adults bounce at the App Store screenshot | The single biggest brand risk; one bad art call and the wedge audience self-deselects | Adult-by-restraint art law (§3.1.4); Warm Paper frame; **Quiet Mode at launch** (the escape valve *is* the counter-argument); marketing leads with the number, character second |
| 2 | **Shame/guilt leakage** — one bad string undoes the whole positioning | Tone drifts as teams grow; A/B tests quietly select for guilt because guilt spikes short-term metrics | Banned-list as CI lint (§10.3); **A/B guardrail: shame-adjacent variants are unshippable by policy regardless of metrics**; §4 never-say fields are part of the state contract; quarterly tone audit on real transcripts |
| 3 | **Wrong Safe Zone number** → trust death; one "you're safe" before an overdraft ends the relationship | Forecasting is genuinely hard: pending transactions, weekend paydays, variable bills | Conservative bias everywhere (round down safe, round up danger); buffer defaults on; show-the-math (an inspectable number is a forgivable number); confidence language ("around Thursday"); **fog state instead of guessing**; "something's off" feedback loop tunes per-user; never forecast on stale data |
| 4 | **Users won't connect banks** (UK open-banking consent fatigue is real) | Especially the anxious segment — the exact wedge | The whole GTM assumes it: manual + statement-import are *first-class*, not fallbacks; value lands in 60s pre-connection; connect is pitched *after* the reveal, framed read-only; the product is fully useful manual-forever |
| 5 | **Over-notification** → mute → churn | Every PM will want one more ping; muted apps die silently | Hard budget (≤1/day default) enforced at the dispatcher, not by convention; every ping information-complete; "essentials only" preset offered proactively; notification *settings preview* shows actual copy; quiet hours default 21:00–08:00 including danger |
| 6 | **Premium feels exploitative** ("pay to stop your pet being sad" headlines) | The mascot+money combination is one bad decision from a press disaster | §8.1 rules 2–5 (mood never for sale; suppressed states); Recovery unpaywalled; the honesty check as public proof; no consumables/gacha ever |
| 7 | **Privacy breach or perceived surveillance** | Financial + emotional data in one place is maximally sensitive | Local-first storage where feasible, E2EE for sync (the Folio heritage); read-only bank scopes; no data resale (charter, not policy); no third-party ad SDKs; export + true delete; publish a plain-English data page |
| 8 | **Inaccurate predictions on irregular income** | Gig/zero-hours users break naive payday math — and they're a huge slice of the wedge | Dedicated mode: plan on P25 income ("low month"), upside lands as wins; "money landed" mini-rituals replace payday rituals; wider confidence bands shown honestly; danger dates become ranges |
| 9 | **Shared households** — one wallet, two behaviors | Money fights are the #1 relationship stressor; a naive shared view assigns blame automatically | No-blame architecture: shared *weather*, private *line items* (each partner's transactions private by default); shared bills board only; weather never attributes ("we're cloudy," never "who made it rain"); joint Recovery framed as team-vs-problem |
| 10 | **Debt & overdrafts** — Safe Zone math inverts when the floor is −£1,500 of arranged overdraft | Real UK life; ignoring it excludes the users who need this most | Overdraft-aware model: user sets "my true floor"; Safe Zone measures to the floor, danger date = floor breach; debt payments are Shield citizens; **overdraft fees surfaced as a leak** ("this overdraft cost £27 last quarter") |
| 11 | **BNPL/Klarna invisibility** | BNPL is designed to not feel like debt; it's the #1 source of "where did my money go" for under-35s | Installments are bills (Shield line-items with schedules); the afford-check's BNPL overlay shows the *next three cycles*; a "BNPL load" gauge (total outstanding across providers) — being the app that makes Klarna visible is a positioning gift |
| 12 | **Low-income users** — for whom "spend less" is arithmetic violence | £0 Safe Zone with nothing cuttable isn't a behavior problem; pretending otherwise is insulting | The Unsafe-cycle flow (options, not lectures); essentials protected in the model *by definition* (Safe £0 ≠ starving — food money is carved out first); UK benefits income treated as plainly as salary; signpost real help (StepChange, Citizens Advice, Trussell) natively, unmonetized, when shortfall is structural for 2+ cycles |
| 13 | **Anxiety amplification** — the app *about* money anxiety becoming a source of it | Checking-compulsion is real in this cohort | Calm-down design (§4: danger = darker, stiller, slower); co-breathing; no red anywhere in the money palette; predictable notification budget (unpredictability is the anxiety engine); glance-sufficiency (the widget answers without opening); "you're safe, go live" as an explicit design goal — sessions are not the KPI |
| 14 | **Too game-like** — cosmetics eat the product; Melo becomes a dress-up app with a calculator | Cosmetic revenue will *pull* the roadmap if allowed | Cosmetics never touch mechanics (no "outfit gives +5% forecast"); studio is a tab, not the home; utility metrics (afford-checks, ritual completion) are the north stars cosmetic teams are also accountable to |
| 15 | **Too boring** — the opposite failure: calm becomes forgettable; nothing to come back for in a good month | Calm months are churn months for every finance app | Tiny wins keep sunny weeks alive; seasonal drops land in calm periods deliberately; the Sunday reset gives even good weeks a rhythm; leaks scans find news in quiet months; "boring miracle" milestones make stability *itself* the content |
| 16 | **Payday detection edge cases** (weekend shifts, BACS timing, split salaries) | Ritual fires on the wrong day = the flagship moment misfires | Weekend-shift rule asked once at setup; detection window (±2 days) with confirm-tap the first three cycles; manual "I got paid" always available and never buried |
| 17 | **The mascot ages badly / trend-dates** | Character design is fashion-exposed | Restraint again (fads live in the *wardrobe*, where they're purchasable and removable, not in the base rig); the base Melo is deliberately timeless-simple; seasonal content carries trendiness so the core doesn't have to |

---

## §14 — MVP Definition

**The bet being tested:** *people will check a mascot-carried Safe Zone before spending, and return daily because of how it feels.* Everything in the MVP serves that sentence; everything else waits.

**MVP feature list (proves the loop):**
1. Onboarding → provisional Safe Zone in <90s (manual inputs only).
2. Safe Zone engine v1 — rule-based: balance (manual), bills (manual list w/ UK chips), essentials slider, buffer, payday date; recompute on any edit.
3. Home: Glance Stack (sky, mascot, number, runway strip, one action card, ask input, ticker).
4. Money weather: 5 states (sunny, cloudy, rain, storm, fog) as ambient + strip + copy vocabulary.
5. Danger date v1 (linear run-rate projection, hysteresis per §4.1).
6. Mascot: **one character (Melo), 3 colorways, 6 emotion families × 2 intensities**, idle library, ~10 wardrobe items (free), rigged 2D.
7. Payday ritual v1 (manual trigger + scheduled prompt; ledger-allocation sweep, no real money movement).
8. Before You Spend v1 (Now horizon only) + the 24-Hour Shelf.
9. Recovery Mode v1 (3 steps + daily check-in + graduation).
10. Bills Shield v1 (list, shielded/landed states, coverage bar).
11. Tiny wins v1 (8 win types, ticker + weekly digest).
12. Notifications v1 (payday, danger-entry, danger-date-delta, bill-landed-covered, weekly review; budget enforced).
13. Weekly review v1 (lightweight).
14. One widget (small: mascot + number + weather tint).
15. Statement import (CSV/PDF → balance + recurring-bill detection) — *the accuracy path without open banking*.
16. Quiet Mode toggle.

**Explicitly NOT in MVP:** bank connections (Phase 3) · leaks engine (needs transaction depth) · scenarios/Later horizon · household · store/monetization (nothing sold until the loop is proven — cosmetics tease as "earned" only) · additional characters · savings goals beyond a single buffer tracker · monthly review · seasonal system · voice/personality packs · Watch/lock-screen widgets.

**First 30-day build scope (assuming the existing Folio V2 foundation):** weeks 1–2: Safe Zone engine + state machine + home stack (engine tests first — the number must be *right*); week 3: mascot rig integration + weather layer + onboarding; week 4: ritual, afford-check, recovery, notifications, widget, statement import wiring (recurrence + reader already exist), polish pass on the reveal moment. Greenfield instead: add ~3 weeks for store/sync/import plumbing.

**Prototype first (before any of that):** the **reveal moment** (onboarding beats 2–5) and the **home glance** as a clickable Figma/Lovable prototype with the mascot's six emotions faked as swapped stills. Test with 10 payday-cycle users: do they *get* the number? Does the mascot read adult? Would they put the widget on their home screen? That prototype kills or confirms the art direction for ~£0.

**Fake manually at first:** payday detection (user taps "I got paid") · bill detection (chips + statement import) · "smart move" suggestions (a curated rule table, not ML) · leak detection (n/a in MVP) · all copy personalization (state-keyed static strings — they're written above).

**Rule-based before AI:** the entire MVP is deterministic. The Safe Zone is arithmetic; the danger date is a projection; the smart moves are a lookup table. AI enters later only as: statement-parsing assist, Ask-Melo conversational layer (the existing gateway), and copy-variant selection — never as the *number*. The number stays auditable forever (show-the-math is incompatible with hallucination).

**Needs bank integration later (Phase 3):** auto payday detection, real-time balance, transaction-level leaks, automatic bill landing confirmation, spend run-rate precision.

**Success metrics (MVP, 60 days):**
- Activation: ≥70% of installs reach the Safe Zone reveal; median time <3 min.
- The habit: ≥3 afford-checks/user/week among D7 retained (the single most predictive metric — instrument it obsessively).
- Retention: D1 ≥45%, D7 ≥30%, D30 ≥15% (finance-utility benchmarks; the mascot should beat them or it isn't earning its rig).
- Ritual: ≥40% of users active on a payday complete the ritual.
- Trust: ≥80% 👍 on the Safe-Zone accuracy prompt; <5% of feedback = "number felt wrong."
- Widget adoption ≥25% of D7 users (the glance loop's leading indicator).
- Qualitative gate: in exit interviews, users describe Melo as "calm/honest/mine" not "cute/fun/game" — the brand either landed or it didn't.

---

## §15 — Roadmap

**Phase 1 — Clickable prototype** *(2–3 weeks)*
- Goal: validate the reveal, the glance, and the art direction before writing product code.
- Features: Figma/Lovable prototype — onboarding beats, home stack, 6 mascot emotion stills, one storm sequence, Recovery walkthrough.
- Risks: testing with design-lovers instead of payday-cycle normals (recruit deliberately: retail/NHS/hospitality shift workers, not designers).
- Validation questions: Is the number understood unprompted? Does the character read adult? Does Recovery feel safe or patronizing? Would they widget it?
- Metrics: 8/10 comprehension of Safe Zone; ≥7/10 "I'd try this"; zero "it's for kids" reads from the target cohort.

**Phase 2 — Manual-input MVP** *(the §14 scope; 4–6 weeks build, 8 weeks live)*
- Goal: prove the loop — glance daily, check before spending, survive a payday cycle.
- Features: §14 list.
- Risks: manual-entry decay (mitigate: statement import + 30-second weekly refresh ritual + fog state making staleness *visible* instead of silently wrong).
- Validation: do people return *without* notifications? does the afford-check become reflexive? does anyone enter Recovery and come back?
- Metrics: §14 targets.

**Phase 3 — Bank-connected MVP** *(+6–8 weeks)*
- Goal: kill manual friction for those willing; unlock the data-gated pillars.
- Features: open-banking connect (1 account free), auto payday/bill detection, leaks engine v1, run-rate precision, bill-landed confirmations.
- Risks: connection reliability (fog state carries it); per-user API cost discipline (connect only after D3 — let the hooked connect).
- Validation: does connection lift retention enough to justify cost? (target: connected D30 ≥ 1.5× manual D30); do leaks generate the "found money" moment?
- Metrics: ≥35% of D7 users connect; leak-found → action rate ≥25%; cost/connected-user within £0.35/mo.

**Phase 4 — Premium & customization** *(+6 weeks)*
- Goal: revenue without breaking §8.1.
- Features: Plus (subscription infra, paywall moments, honesty check), cosmetic catalog v1 (wardrobe packs, first seasonal), Pebble + Nugget roster, Night Ledger theme, scenario saves, full leaks.
- Risks: monetization pulling tone (the CI linter and suppressed-state rules are load-bearing now); cosmetic pipeline cost discipline.
- Validation: trial→paid ≥35%; refunds/complaints near zero; *no measurable retention drop among non-payers* (if free users churn when the store opens, the store is wrong).
- Metrics: 3–5% payer rate by day 30 post-launch; cosmetic attach ≥15% of subscribers; ARPPU ≥ £5.20.

**Phase 5 — Forecasting & automation** *(+8 weeks)*
- Goal: from mirror to autopilot.
- Features: 30-day weather, auto-ritual (pre-swept confirmations), savings auto-escalation, annual-bill smoothing automation, irregular-income engine v2, Watch/lock-screen widgets.
- Risks: automation errors are trust-fatal (every automated move previewed, reversible, and logged in plain English).
- Validation: does automation lift ritual completion without lifting "wrong number" reports?
- Metrics: auto-ritual adoption ≥50% of Plus; forecast accuracy ±15% at 14 days.

**Phase 6 — Household** *(+8 weeks)*
- Goal: the churn moat; two-player finance without blame.
- Features: shared weather, shared bills board, partner invites, joint goals, split-view privacy model, (evaluate) Pro tier.
- Risks: privacy model mistakes are relationship-damaging (default-private line items; explicit consent per shared surface); support complexity.
- Validation: do households have the predicted retention multiple? does shared weather reduce or create money conflict (interview for it)?
- Metrics: household churn ≤ 0.5× solo; invite acceptance ≥40%.

**Phase 7 — Mascot/IP expansion** *(ongoing from here)*
- Goal: the character becomes the brand's compounding asset.
- Features: quarterly roster drops (Juno, Miso, Suki…), seasonal events matured, year-in-weather, sticker packs/keyboard, collab skins (one tasteful partner/year max), merch test (the earned-pin program physical).
- Risks: IP sprawl diluting Melo-the-character; collab tackiness (say no a lot).
- Validation: does the roster lift cosmetic ARPU without fragmenting brand recall (aided recall should stay "the Melo app," not "that app with the animals")?
- Metrics: roster attach; social share volume; CAC via character content vs. paid.

**Phase 8 — Platform/ecosystem** *(12+ months out)*
- Goal: Melo as the emotional layer other money touches.
- Features: US/EU localization (weather and shame-free translate perfectly; payday mechanics need local work), savings/pots partner integrations (Melo drives, partner holds — never custody), employer/EAP channel (financial-wellbeing budgets exist and are desperate for something people actually open), API for "safe to spend" as a service (long shot, optionality only).
- Risks: partner incentives corrupting advice (the §8 charter travels or the deal dies); regulatory surface growth.
- Validation: does any partnership add user value measurably before it adds revenue?
- Metrics: localized-market D30 within 80% of UK; partner-channel CAC < 0.5× paid.

---

## §16 — Final Deliverables (net-new lists + direction + index)

### 16.1 Top 20 overlooked ideas (things competitors won't think of)

1. **The Fog state** — staleness as weather. The app that admits it can't see is the app whose "you're safe" means something.
2. **Quiet Mode** — the de-mascoted skin. The escape valve that *is* the rebuttal to "it's childish."
3. **Show the math** — every number decomposes on tap. Trust is built at the exact moment of doubt.
4. **"Can you afford Melo?"** — the paywall that runs your Safe Zone and sometimes says no. Integrity as a screenshot.
5. **Danger-date *delta* notifications** — "Thu → Sun. Whatever you did, it worked." Change is news; state is noise.
6. **Co-breathing storm mode** — the mascot as anxiety co-regulator at the moment of panic.
7. **The 24-Hour Shelf** — deferred wants with a next-day re-verdict. The impulse killer nobody ships.
8. **Ban "again"** — one word, enforced in CI, half the category's cruelty deleted.
9. **"Nothing to do" notifications** — "council tax landed, it's covered." Pings that ask nothing build the trust that pings that ask something spend.
10. **No-blame household weather** — shared sky, private line items. The first couples' money surface designed by someone who's had the argument.
11. **Christmas mode** — the UK's annual financial trauma, forecast from October ("Santa storm — £22/month set aside now beats £340 of January"). Seasonal *finance*, not just seasonal *hats*.
12. **Annual-bill smoothing** — car insurance month should never be a surprise. Amortization as a consumer feature.
13. **Celebrate the check, not the outcome** — the afford-check habit is praised even when the user buys anyway. Judge the behavior you want repeated, never the purchase.
14. **Payday drift handling** — weekend/bank-holiday payday shifts asked once, handled forever. Tiny; every UK competitor gets it wrong.
15. **"Days on the path"** — recovery progress counted forward, never "days since failure." Direction of counting is direction of dignity.
16. **Earned items are unbuyable** — the flex layer money can't touch. That's what makes both the earned and the bought valuable.
17. **Post-overdraft upsell embargo** — 7 days of zero monetization after an overdraft, even in Calm. Users remember who asked for money while they drowned.
18. **Signpost real help natively** — StepChange/Citizens Advice/Trussell wired in, unmonetized, when shortfall is structural. Know what the app is not.
19. **The reveal counts up** — the Safe Zone's first appearance is *performed* (mascot calculates, number builds). Worked-for numbers are believed numbers.
20. **Sessions are not the KPI** — decisions are. An app that answers from the widget and lets you go is the one that's still installed in year three.

### 16.2 Top 20 feature ideas (beyond the pillars)

1. The 24-Hour Shelf (promoted to MVP).
2. BNPL load gauge — total Klarna/Clearpay outstanding, overlaid on future cycles.
3. Bill-rise radar — detects any recurring charge increasing, shows the delta and the annualized cost.
4. Cancel concierge — real cancellation steps per merchant, incl. phone scripts for the hostile ones.
5. Christmas mode / seasonal cost events (back-to-school, MOT season, energy winter).
6. Income smoothing for gig workers — P25 planning with upside-as-wins.
7. Rent reporting (UK: rent → credit file via existing rails) — credit progress from money you already spend.
8. "Money mail" — the weekly review as a letter from Melo, written in voice, no charts.
9. Voice ask — "hey, can I afford £40 tonight?" → verdict spoken back (drive-through moment).
10. Merchant-free judgment — insights by pattern ("late-night deliveries") never by shame-brand ("McDonald's, 9 times").
11. Payday-eve "you made it" moment — the cycle's finish line acknowledged.
12. Safe-Zone API for the household's other apps (partner's widget shows shared weather).
13. Overdraft-fee leak surfacing — the bank's revenue line as your leak card.
14. Split-bill awareness — flatmate transfers recognized so reimbursements don't read as income.
15. "Explain like I'm stressed" — every screen has a one-tap plainer version (shorter sentences, bigger type, one number).
16. Weather time-lapse — your last 90 days as a 5-second sky animation (the emotional progress report).
17. Sub-account mirroring — pots/spaces at the bank mirrored as Shield compartments (no custody, just meaning).
18. The buffer thermostat — buffer auto-suggests growth after N calm cycles ("weather's been good — thicken the walls £10?").
19. Shift-work income calendar — enter shifts, income forecast builds itself (the gig-economy killer feature).
20. Panic button — "I'm freaking out about money" → one screen: what's protected, what's true, one breath, one move. (The feature you hope nobody needs and everybody remembers.)

### 16.3 Top 20 premium unlocks

Functional: 1. Multi-account aggregation · 2. Full leaks engine + rise monitoring · 3. Scenario saves/stacking + BNPL overlays · 4. Auto-ritual (pre-swept paydays) · 5. Savings auto-escalation · 6. Annual-bill smoothing automation · 7. Household mode · 8. 30-day weather · 9. Deep reviews + PDF export + full history · 10. Custom rules & per-category zones · 11. Irregular-income engine · 12. Premium widget layouts + Watch.
Emotional: 13. Character roster (Pebble, Nugget, quarterly drops) · 14. Job packs (dress Melo as your actual Tuesday) · 15. Seasonal drops (returning yearly, never FOMO-scarce) · 16. Scenes & rooms · 17. Companion pets (the mascot's mascot) · 18. Personality voices (Chattier/Quieter/Dry) · 19. Celebration effect sets + glow palettes · 20. Night Ledger + Big Sky themes + icon packs.

### 16.4 Top 20 mascot reactions

1. Payday: one proud dance loop, confetti, then straight to work (joy with a job).
2. Bill lands covered: pats the chest — "that's what we saved it for."
3. Storm vigil: sits with umbrella, slow breathing, stays.
4. Fog: squints, hand shading eyes, slightly comic.
5. Leak found: detective magnifier, small "aha!"
6. Leak cancelled: sweeps the puddle dry, dusts hands.
7. Danger date retreats: watches the storm cell slide away, quiet fist-pump.
8. Afford-check thinking: ~1s of visible arithmetic before the verdict (labor = trust).
9. Verdict "not now": apologetic-but-firm headshake, then points at the date it *becomes* yes.
10. Recovery check-in done: sits beside you, small nod — no applause, just witness.
11. Recovery graduation: the rainbow moment; one deep breath; rolls sleeves *down*.
12. Milestone: retrieves the earned pin, puts it on, adjusts it. Doesn't mention it.
13. Return after absence: waves, glad, zero wound — "no guilt" as body language.
14. Savings deposit: places the token on the pile, steps back to admire (Pebble: polishes the pebble).
15. Sunday reset: reading the same report beside you, occasionally pointing.
16. Bill week start: checklist energy — clipboard, determined nod.
17. Night (all quiet): dozes by the number; the app at rest.
18. User corrects a number: takes notes, grateful — being corrected is *modeled as good*.
19. New outfit: tries it, checks itself, small approval or a comic wince at clashing combos.
20. Payday eve after a hard cycle: sits watching the horizon; sunrise starts. Says nothing. (The one that gets screenshotted.)

### 16.5 Top 20 notifications (each carries its information — no bait)

1. "You got paid 🎉 Two minutes with Melo makes it safe."
2. "Storm Thursday: £38 short if spending stays usual. £10/day til then keeps it dry."
3. "Danger date moved: Thu → Sun. Whatever you did this week — it worked."
4. "Storm's passed. You got to payday. 31 days, no overdraft."
5. "Council tax lands tomorrow (£142). Covered — nothing to do."
6. "Energy bill came in £14 above usual. Worth a look — 3-min fix inside."
7. "Netflix went £10.99 → £12.99. Fine if it's loved. 30-second cancel if not — £156/yr."
8. "Quiet week — £23 under your usual. That's the buffer growing on its own."
9. "New cycle's Safe Zone: £412 til the 28th. £14/day."
10. "Tiny win: 4 checks-before-buying this week. That's the habit."
11. "£500 buffer reached. Six months ago: £0. The boring miracle."
12. "Recovery day 3: today's move is shifting £8. That's the whole ask."
13. "My picture's gone foggy — 30 seconds fixes it."
14. "Weekend forecast: sunny. £31 clear of the plan through Sunday."
15. "Sunday reset's ready: 3 minutes, one adjustment, week's sorted."
16. "The shelf says: still safe. The trainers survive a day of thinking (£71 after)."
17. "October heads-up: Christmas costs ~£340 last year. £22/month from now = January without the flinch."
18. "Car insurance renews in 6 weeks (£480 last year). Smoothing's got £360 of it — and renewal prices drop if you quote 3 weeks early."
19. "Payday tomorrow. You made it."
20. "Melo update: nothing needs you. Enjoy the day." *(sent at most monthly; the notification that builds more trust than any feature)*

### 16.6 Top 20 tiny wins

1. Built your first Safe Zone (onboarding — guaranteed day-one win).
2. First check-before-buying.
3. Checked 5× in a week.
4. First payday ritual completed.
5. Survived a bill week with the shield intact.
6. Danger date pushed back 2+ days.
7. A whole cycle without touching the overdraft.
8. First £10 saved.
9. Buffer at £100 / £250 / £500 (milestone ladder).
10. Cancelled a leak (£/yr recovered shown).
11. Shelved an impulse — and the shelf verdict honored either way.
12. Quiet day (no spend) — *user-opt-in framing only*.
13. Spent under your usual on takeout this month (vs. your normal, never anyone else's).
14. Recovery completed — days-on-path count.
15. Corrected Melo's number (trust win — celebrated as such).
16. Paid more than the minimum on a debt.
17. Smoothed an annual bill (future-you protected).
18. Renegotiated/switched a bill (delta/yr shown).
19. Survived Christmas / the seasonal event (earned ornament).
20. One year with Melo — the year-in-weather unlocks.

### 16.7 Top 20 "Can I afford this?" examples (the range the feature must handle)

1. £4 coffee → "Safe. Doesn't move the week."
2. £12 lunch out → "Safe — £6/day still holds to Friday."
3. £30 night out Friday → "Tight: leaves £9/day for 4 days. The 28th version is comfortable."
4. £60 trainers → "Safe — £71 after, Thursday stays sunny."
5. £45 weekly shop (recurring) → "That's £180/cycle — fits, it's already in your essentials line."
6. £15/mo new subscription → "It's not £15 — it's £180/year. Fits now; flagged if it ever stops earning its slot."
7. £80 concert ticket → "Shelf-grade: safe *if* next week stays usual. 24 hours?"
8. £120 winter coat → "Not this side of payday. On the 12th, easily. Shelf it?"
9. £200 flight deal → "Tight — takes the buffer to £40. Doable if the next two weeks behave. Your call; here's each week's sky."
10. £300 emergency: boiler repair → "This is what the buffer's for. £300 from buffer, £180 remains, rebuilt by March at £2/day. Storm handled."
11. £800 sofa on Klarna 3× → "£267 hits March (fine), April (£31 tight), May (sunny). The April payment is the one to plan around."
12. £9.99 game → "Safe. Enjoy it."
13. £50 birthday gift → "Safe — and it's flagged as a *known event*, so next year I'll see it coming in the forecast."
14. £25 takeaway tonight → "Tight — third this week; £11/day becomes £8/day. Just the math, your night."
15. £1,200 holiday deposit → "Not from this cycle. As a goal: £100/month lands it by June. Start it?"
16. £70 car service → "Safe from buffer, tight from spending money. Recommend buffer — that's its job."
17. £5/day habit (daily coffee) → "£150/month, £1,825/year. Not a verdict — just the number nobody ever shows you."
18. £150 dentist → "Health beats weather. It fits — £4/day tighter til payday. Book it."
19. £20 sports bet → answered like any purchase (no morality; frequency pattern only ever surfaced gently, once, if it becomes a leak-scale pattern).
20. "Can I afford Melo Plus?" → the honesty check, live (§8.1.4).

### 16.8 Final recommended product direction

Build the **Glance Stack** product on the **Warm Paper** direction with **Melo the custom creature** (three colorways free; Pebble and Nugget as the first premium roster). Ship the MVP **manual-first with statement import** — no open banking until the loop is proven. Make the **Safe Zone number** the hero of every surface and the mascot its carrier, never its replacement; ship **Quiet Mode day one** so the character is a choice, not a tax. Protect the four sacred free things — the number, the warnings, the ritual, and Recovery — and monetize **depth and identity** (£4.99 Plus + cosmetics) under the suppressed-state rules. Enforce tone in CI. Measure **afford-checks per user per week** as the north star, retention second, sessions never.

The one-sentence brief for every hire, forever: **Melo is the app that worries about your money so you don't have to — and it never, ever makes you feel worse.**

### 16.9 Deliverables index (the brief's 23 → this document)

| # | Deliverable | Where |
|---|---|---|
| 1 | Product thesis | §1 |
| 2 | Product pillars | §2 |
| 3 | Mascot system | §3 |
| 4 | Emotional state system | §4 |
| 5 | Core UX map | §5.1 |
| 6 | Screen-by-screen spec | §5.2 |
| 7 | Home screen concepts | §6 |
| 8 | Onboarding flow | §9 |
| 9 | Retention loops | §7 |
| 10 | Premium strategy | §8 |
| 11 | Copy system | §10 |
| 12 | Visual direction options | §11 |
| 13 | MVP scope | §14 |
| 14 | Roadmap | §15 |
| 15 | Risks & mitigations | §13 |
| 16 | Top 20 overlooked ideas | §16.1 |
| 17 | Top 20 feature ideas | §16.2 |
| 18 | Top 20 premium unlocks | §16.3 |
| 19 | Top 20 mascot reactions | §16.4 |
| 20 | Top 20 notifications | §16.5 |
| 21 | Top 20 tiny wins | §16.6 |
| 22 | Top 20 afford-this examples | §16.7 |
| 23 | Final recommended direction | §16.8 (decisions: §0) |

*— end of blueprint —*







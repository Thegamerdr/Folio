# Folio V2 - Deep UI Research Synthesis

## Purpose

This research pass was not a search for fashionable layouts. It focused on the moments that decide whether a financial product becomes trusted or avoided after several weeks of use:

- what makes people face or avoid their finances;
- what breaks trust in automated financial data;
- what makes a mascot feel safe rather than childish or manipulative;
- what users do during bad months;
- what makes onboarding feel like work;
- what types of gamification create self-knowledge rather than guilt;
- what must remain native on Android and iOS;
- what “clean” actually means when the information is consequential.

The evidence base combines direct user discussions from YNAB, Monarch Money, poverty/debt communities, Finch and Duolingo with primary Android guidance and HCI research on trust, anthropomorphism, notification fatigue, motivation, waiting and tactile feedback.

---

## 1. The central finding: calm is not a visual style

Beige backgrounds, rounded cards and friendly copy can still produce an anxious product. The deeper form of calm comes from four conditions:

1. **The user can understand what is true.**
2. **The user can see where the conclusion came from.**
3. **The user can reverse or correct automation.**
4. **The user can see what happens next.**

This is why the new direction uses whitespace and restraint, but does not hide important information. A financial interface becomes calm when it reduces uncertainty and decision load without removing control.

### Design consequence

The home screen should not say only “£142 available.” It should say:

- what the £142 means;
- the time horizon it covers;
- whether the underlying data is confirmed or estimated;
- where the tightest point occurs;
- how to inspect the calculation in one action.

This creates confidence without pretending to offer certainty.

---

## 2. Users do not reject structure; they reject restriction and failure language

Long-term YNAB users repeatedly describe the breakthrough as **permission to spend without guilt**, not simply spending less. Users also describe budgeting as resource allocation and say the budget must work for the person rather than the person serving the budget. Concrete progress, consistency and being prepared for surprises create peace.

At the opposite end, people in financial distress often describe shame, loss of control and the feeling that conventional advice assumes a stable life. During instability, long-term planning becomes cognitively and emotionally difficult.

### Design consequence

Folio should avoid presenting money as a series of prohibitions. It should show the consequence and preserve the user’s autonomy:

- “This purchase leaves £22 before Tuesday.”
- “Rent and minimums remain covered.”
- “Your buffer stays unchanged.”

Not:

- “You cannot afford this.”
- “You overspent.”
- “You failed your budget.”

The interface should give the user permission to decide with context.

---

## 3. Automation is wanted, but invisible automation destroys trust

Forum discussions around Monarch Money and YNAB expose a critical contradiction. Users ask for automatic categorisation and cleaner merchant names, yet trust collapses when the system silently changes reviewed data or makes AI-derived values look confirmed.

Reported failures include:

- manually corrected categories changing back;
- no activity log explaining what altered the data;
- auto-assigned categories appearing indistinguishable from manual ones;
- AI-renamed merchants causing users to fear fraud;
- original bank wording being buried;
- users exporting data regularly because they do not trust the product to preserve it.

### Design consequence

Every imported or inferred record needs a visible provenance model:

- **Original source** - immutable statement/bank wording;
- **Folio interpretation** - suggested merchant, category or event;
- **Confidence** - high, medium or needs review;
- **Status** - suggested, user-confirmed or externally confirmed;
- **History** - who or what changed it and when;
- **Undo** - immediately available;
- **Automation control** - per feature and globally.

The import mock therefore shows the original bank line directly beneath the interpretation. “Folio thinks…” must never be styled like “Folio knows.”

---

## 4. “Clean” cannot mean burying high-frequency actions

Real mobile users complain when transaction fields are hidden behind expandable menus or require more taps after redesigns. A clean screen that moves routine work into repeated menus is visually tidy but operationally dirty.

### Design consequence

Folio should use **progressive disclosure by frequency and consequence**, not by designer preference:

- frequent actions remain one tap away;
- rare configuration can be deeper;
- sensitive or irreversible actions receive deliberate friction;
- provenance and undo remain adjacent to automated changes;
- the main screen exposes only one focal answer, while the supporting facts sit directly below it.

The interface should be low-clutter, not low-capability.

---

## 5. The first minute must deliver value before teaching a method

New budgeting users report spending hours reviewing statements and still not understanding what the interface expects. Products often assume users are willing to learn the product’s financial philosophy before receiving a useful answer.

Folio cannot repeat this. Its first minute must demonstrate the emotional product before asking for substantial trust or effort.

### Proposed first-minute sequence

1. **Curiosity:** “Let’s make one thing less unknown.”
2. **Playable proof:** a private sample where moving an unexpected expense visibly changes the route.
3. **Import as discovery:** statement processing reveals useful patterns as they are found.
4. **First answer before perfect data:** Folio speaks as soon as it knows enough, labels uncertainty and asks only the questions that materially improve the answer.

This turns import from a waiting screen into a sequence of discoveries.

---

## 6. Waiting feels shorter when progress has meaning

HCI research on perceived waiting shows that progress behaviour affects how long a wait feels. In financial import, a percentage alone is weak because it does not explain whether anything useful is happening.

### Design consequence

Do not show only:

> Importing - 72%

Show narrative progress:

- 124 transactions read;
- weekly pay pattern found;
- recurring rent pattern found;
- one possible debt payment needs review;
- first briefing is now being built.

The user should feel the app becoming more useful while it works.

---

## 7. A bad month is not an error state; it is the product’s most important state

People under financial pressure describe fragility, shame and the fear that one event will make life collapse. Traditional finance products often respond with red categories, failed targets and negative scores.

The product must instead provide:

1. the truth;
2. what changed;
3. what remains protected;
4. what moves;
5. when breathing room returns;
6. a revised route from the current position.

### Constitutional rule

**A bad month changes the route, not the user’s identity.**

The recovery screen uses limited warning colour, preserves the original route as a ghost line and shows the revised route as the new truth. It does not reset progress or label the plan as failed.

---

## 8. Melo needs warm competence, not simulated intimacy

Research on conversational agents shows that warmth and competence can increase trust, but excessive anthropomorphism, over-agreement and fake empathy can reduce perceived competence or manipulate decisions. Real-world criticism of financial chatbots also shows the danger of feigned empathy followed by monetisation or credit-product promotion.

### Melo’s behavioural model

Melo should be:

- observant;
- calm;
- specific;
- occasionally playful;
- transparent about uncertainty;
- willing to say “I need one detail”;
- willing to stop once the answer is clear.

Melo should not:

- claim human emotion;
- flatter the user;
- agree automatically;
- dramatise ordinary spending;
- use vulnerability to sell products;
- continue asking questions without a defined objective;
- give regulated financial advice.

### Interface consequence

Melo appears in three scales:

1. a small presence beside today’s briefing;
2. a contextual note attached to an event or change;
3. a full conversation surface only when the user chooses it or a complex clarification is needed.

He is integrated, not bolted on, but he does not monopolise the interface.

---

## 9. Questions must have a visible end goal

The user explicitly rejected an interrogation. The distinction is not the number of questions; it is whether each question visibly advances a useful outcome.

### Question contract

Before Melo asks, the system should know:

- what uncertainty it is resolving;
- which answer or forecast will improve;
- how many questions remain in this clarification sequence;
- whether the question can be deferred;
- what happens if the user declines.

Example:

> “A rent payment is £3 higher than usual. Was that a fee, a new amount or a one-off?”

This is acceptable because it improves future rent forecasting. A vague “Tell me more about your finances” is not.

---

## 10. Fun works when it reveals the user to themselves

The strongest finance-specific game idea observed in user discussion was not a fictional reward. It asked people to estimate their own spending and revealed how well they knew themselves. Some users enjoyed it; others disliked contextless household comparisons or felt a finance app should provide answers rather than make them guess.

Finch users also show that optional quests can still create pressure when they sit in a completion checklist, and social quests can feel like forced promotion. Duolingo demonstrates the power of visible progress but also the harm caused by brittle streaks and insensitive notifications during real-life crises.

### Design consequence

Folio’s fun layer should be:

- optional;
- dismissible;
- based on the user’s own history;
- free from peer comparison by default;
- free from mandatory social actions;
- based on real milestones and self-knowledge;
- recoverable after interruptions.

Good examples:

- “What do you think takeaways cost this week?” followed by the real answer;
- a visual celebration when a real debt clears;
- a short reflection after surviving a difficult month;
- a personalised “you spotted this earlier than last time” moment;
- a plan journey that bends rather than breaks.

Avoid leaderboards, wealth comparison, guilt streaks and artificial points disconnected from real outcomes.

---

## 11. Retention should adapt to the user’s state

One retention loop cannot serve every financial state. A debt-focused user, an anxious saver, a stable but avoidant user and a business owner return for different reasons.

### Proposed adaptive retention model

Folio observes which value the user actually uses:

- debt progress;
- remaining budget;
- next-payday safety;
- calendar/planner activity;
- invoice and cashflow status;
- plan momentum;
- self-knowledge reflections;
- Melo conversation.

It then adjusts:

- briefing emphasis;
- notification cadence;
- celebration type;
- prompt style;
- Melo accountability level;
- depth of visible information.

This is bespoke retention without creating a hidden psychological trap. The user controls memory depth, notification intensity and Melo’s tone.

---

## 12. Notifications must behave like a trusted person’s interruption

Notification fatigue research and user reports show that repeated, poorly timed or contextless alerts create stress and erode trust. A finance app has additional risk because lock-screen information can be sensitive.

### Notification contract

Interrupt only when one of these is true:

- a material risk changed;
- a deadline is approaching within the user’s chosen window;
- a payment expected by now is missing;
- the user asked to be reminded;
- a plan changed materially;
- a concise briefing contains genuinely new information.

Defaults:

- no sensitive amount on the lock screen;
- quiet hours;
- grouped notifications;
- one-tap snooze or dismiss;
- “why am I seeing this?” available;
- grace mode for illness, crisis, holiday or deliberate time away;
- the app becomes quieter when finances are stable.

---

## 13. Cross-platform should mean behavioural parity, not pixel identity

Android users routinely notice when an iOS interaction model is pasted onto Android. The reverse is also true. Platform trust is partly built from expected back behaviour, system sheets, navigation, keyboard behaviour, widgets and haptics.

### Shared across platforms

- content hierarchy;
- Folio colour and typography principles;
- Melo’s character;
- breathing-room horizon;
- terminology;
- data provenance;
- feature capability;
- emotional states.

### Native per platform

- predictive back and system back on Android;
- Android navigation bars, menus and edge-to-edge behaviour;
- iOS tab, sheet and gesture conventions;
- haptic patterns;
- system picker, share and file-import flows;
- typography metrics;
- accessibility settings;
- widget and notification presentation.

The mock shows the same Today experience in an iOS and Android shell without forcing pixel-for-pixel duplication.

---

## 14. Haptics and motion should confirm meaning, not decorate the interface

Motion can make a financial consequence understandable when it shows causality: an event moves, the route changes and the affected date shifts. Haptics can reinforce confirmation, but should never be the only feedback because perception varies under cognitive and physical load.

### Motion rules

Use motion for:

- an imported discovery settling into the timeline;
- a proposed purchase changing the route;
- a plan date moving after a confirmed event;
- a milestone resolving;
- a bottom sheet transitioning between question and answer.

Do not animate:

- every number;
- routine scrolling;
- warning states for drama;
- the mascot constantly;
- decorative backgrounds.

Provide reduced-motion equivalents and preserve the same information without animation.

---

## 15. The clean interface direction

The resulting visual system is intentionally restrained:

- warm off-white canvas rather than clinical white;
- deep ink for authority without corporate blue;
- green for stable/confirmed states;
- amber for attention and uncertainty;
- coral only for material change, not general “bad” behaviour;
- no gradients in the product surfaces;
- no glass effects;
- no card grid as the dominant structure;
- one focal answer per viewport;
- details expressed as rows, chronology and direct manipulation;
- large numbers only when they answer a human question;
- system fonts and native sizing on each platform;
- strong tap signifiers rather than invisible gesture-only interactions.

### Signature object: the breathing-room horizon

The line from today to the next meaningful point is not a generic chart. It is a direct representation of the user’s near future:

- nodes are events;
- the low point is visible;
- confirmed and estimated portions can be distinguished;
- proposed actions can be moved on the route;
- old and revised routes can be compared;
- Melo can reference specific points rather than produce vague commentary.

This gives Folio a recognisable visual language without turning the interface into a decorative “life map.”

---

## 16. Why this direction is different from the previous mock

The previous direction still relied on stacked cards, expressive editorial styling and journey graphics that competed for attention. The researched direction removes that excess.

Changes:

- six core surfaces use one restrained information grammar;
- the main answer is placed directly on the canvas;
- events are rows on a chronology, not individual cards;
- Melo is smaller and more contextual;
- import is a provenance trail, not a metric grid;
- recovery uses factual rows and route comparison;
- the calendar is a genuine planner rather than an attached feature;
- iOS and Android are shown as related but native products;
- direct manipulation creates interactivity without visual noise.

---

## 17. Research-backed acceptance criteria

A future production UI should fail review if any of the following are false.

### Clarity

- A new user can state the main Today answer after five seconds.
- The time horizon of any “available” amount is visible.
- Known, estimated and unreviewed information are visually distinct.
- The lowest projected point can be reached in one action.
- No high-frequency transaction action requires an unnecessary expansion menu.

### Trust

- Original imported wording is always retrievable.
- User-confirmed data cannot be silently overwritten.
- Every automatic change has an activity record.
- Every inference has a confidence/status label.
- Undo is available at the moment of change.
- Automation can be disabled globally and by feature.

### Emotional safety

- No screen labels the user as failed, irresponsible or behind.
- A bad month shows what remains protected.
- Recovery begins from the current position rather than forcing a reset.
- Melo never claims human feelings or certainty he does not possess.
- Paid promotions never appear inside a distress or recovery flow.

### Interaction

- The user can test a financial event without saving it.
- Moving a dated event previews downstream effects before confirmation.
- Motion has a reduced-motion equivalent.
- Haptics are supplementary.
- All tap targets have visible affordance.

### First minute

- A user can feel Folio’s value before importing data.
- A statement import produces visible discoveries during processing.
- The first briefing appears before every ambiguity is resolved.
- Each follow-up question states or implies why it matters.
- Import and permission copy appears at the point of choice.

### Cross-platform

- Feature capability is equivalent on Android and iOS.
- Android predictive back is supported.
- Native system sheets, pickers and sharing are used.
- Navigation is adapted rather than copied.
- Accessibility is tested during implementation, not after visual completion.

---

## 18. Recommended user tests before implementation lock

Recruit users by financial state rather than demographics alone:

1. actively paying down debt;
2. financially avoidant;
3. irregular income;
4. stable finances but anxiety about spending;
5. recently hit by an unexpected expense;
6. neurodivergent or easily overwhelmed by forms;
7. privacy-first/offline preference;
8. self-employed/business user for later workspace tests.

Test these tasks:

- understand the Today answer without explanation;
- inspect where the number came from;
- correct a wrong imported interpretation;
- test a purchase and exit without saving;
- recover from a £320 unexpected expense;
- move an event in the calendar and preview impact;
- mute or change Melo’s proactive level;
- complete first import while understanding privacy;
- distinguish Personal from Business when Business exists;
- export or recover original data.

Measure:

- comprehension, not only completion;
- emotional state before and after;
- confidence calibration;
- number of unnecessary taps;
- whether the user noticed uncertainty labels;
- whether they understood that Melo was not giving advice;
- whether they could recover from an error without support.

---

## Final design thesis

**Folio should feel clean because it removes interpretation work, not because it removes information.**

**It should feel interactive because the user can touch consequences, not because every surface moves.**

**It should feel safe because the truth is visible, automation is reversible and a changed month always has a route forward.**

**Melo should feel alive because he notices the right thing and knows when to stop.**

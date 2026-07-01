# SheetOnboarding (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetOnboarding.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetOnboarding.tsx

## rnComponentName

SheetOnboarding

## purpose

Multi-step first-run onboarding bottom-sheet. Collects the anchors that flip Folio off sample data (name, payday day-of-month, rough monthly income, current account balance) plus a 2-col pot picker, then writes real values to the store with an honest "user-entered / rough" balance label (ENGINES.md sec 6) and seeds pots from templates. Primary button advances steps ("Next") then finishes ("Begin quietly"); "Skip for now" closes WITHOUT marking onboarding done, so sample numbers + the nudge stay. FIDELITY NOTE: the doc block + COPY_DECK describe FOUR steps, but the live source renders FIVE (name, payday, income, balance, pots) with different inline copy than the COPY_DECK onb.\* keys — port the code's five steps and exact strings.

## docBlock

@rn-sheet OnboardingSheet
@purpose Four-step onboarding — name, payday, income, pot picker.
@writes setOnboarding, setPots
@copy FROZEN
@tokens --paper --accent --surface --hairline
@motion slide between steps · stamp on completion

## reads

- onboarding (useAppStore s.onboarding) — seeds step state: name=ob.name, payday=ob.payday, income=ob.monthlyIncome
- currentBalance (useAppStore s.currentBalance) — seeds balance step: if currentBalance.source === 'sample' start at 0 (so user feels they're entering fresh), else seed currentBalance.amount
- pots (useAppStore s.pots) — existingPots: pre-selects (picked Set) every template whose id the user already has; savedById map preserves each kept pot's saved amount on finish

## writes

- setOnboarding({ name, payday, monthlyIncome: income, done: true }) — in done() on last step
- setCurrentBalance({ amount: balance, source: 'user-entered', confidence: 'rough' }) — only when balance > 0
- setPots(nextPots) — only when picked.size > 0; nextPots maps picked templates, saved = savedById[t.id] ?? 0, drops unchecked, new pots saved=0
- onClose() — always at end of done(); also the ONLY action of 'Skip for now' (which deliberately leaves onboarding.done=false)

## opensSheets

## copyKeys

- EYEBROWS (verbatim, per step): 'Hello', 'Rhythm', 'Rough only', 'Today', 'Pots'
- HEADLINES with accent <em> word (verbatim): 'What should Melo call you?' (accent: 'call you?'), 'When does payday land?' (accent: 'land?'), 'What lands, roughly?' (accent: 'roughly?'), "What's in your account right now?" (accent: 'in your account'), 'What are you saving for?' (accent: 'saving for?')
- Step 1 input placeholder: 'A name, a nickname'
- Step 2 unit label: 'of the month'
- Step 3 unit label: '/ month'; help: "Doesn't need to be exact. Folio adjusts as you go."
- Step 4 unit label: 'roughly'; help: 'Your guess is fine. Folio uses this as the starting point — every number you'll see is anchored here, not a sample.'
- Step 5 intro: "Pick any. Skip with none if you'd rather start blank — you can add later."
- Pot template names + meta: 'Holiday · September' (£1200 · £35/wk, accent), 'Buffer' (£500 · £20/wk), 'Christmas' (£300 · £15/wk), 'Vet fund' (£400 · £10/wk), 'Home things' (£600 · £15/wk)
- Money format: £{value.toLocaleString()} (tabular) for income/balance; '£{goal} · £{perWeek}/wk' on pot tiles
- Primary button: 'Next' (steps 1-4) / 'Begin quietly' (last step)
- Secondary button: 'Skip for now'
- Footer microcopy: 'Skipping keeps sample numbers on Today. Folio works honestly once these are yours.'
- RELATED COPY_DECK keys (NOTE divergence): onb.1.head, onb.1.placeholder, onb.2.head, onb.3.head, onb.3.help, onb.4.head, onb.4.help, onb.done.head, onb.done.body

## tokens

- --paper (sheet body, via Sheet)
- --accent (accent word, active progress pip, range thumb, selected pot ring, primary button bg)
- --accent-soft (selected pot tile bg)
- --inset (input bg, unselected pot tile bg)
- --surface (declared in doc block)
- --hairline (input border, grip, inactive progress pip)
- --ink (headline/value text, progress pip for completed step at 60% opacity)
- --muted-ink (eyebrow, unit labels, help text, skip button, footer)
- font-display = Fraunces (eyebrow italic, headline, big value numbers)
- tabular (tabular-nums) on payday/income/balance values and pot meta
- white (#FFFFFF) primary-button text

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — sheet body entrance, via Sheet primitive
- scrim-in (320ms ease-out) — 45% ink scrim, via Sheet
- press (120ms, scale 0.97 on :active) — pot tiles, primary button, skip button
- progress-pip transition: transition-all duration-400 on the step indicator bars (width + color tween between steps)
- INTENT-ONLY from doc block (not implemented in this source, port should add): 'slide between steps' → slide-in-r/slide-in-l 360ms when changing step; 'stamp on completion' → verdict-stamp/stamp 600ms back-out on finish
- Reduced motion: collapse all to final state (per MOTION.md)

## componentTree

<Sheet onClose={onClose}> {/_ gorhom BottomSheetModal, paper bg, 28px top radius, grip, 40-45% ink scrim _/}
<View px2 pb2>
<View row gap1.5 mb4> {/_ progress pips _/}
{steps.map(i => <View pip active={i===step} done={i<step} />)} {/_ active: w7 accent; done: w5 ink/60; future: w5 hairline _/}
</View>
<Text eyebrow font-display italic 12.5 muted>{s.eyebrow}</Text>
<Text head font-display 26 leading-tight mt1>{s.head /_ with accent <em> word _/}</Text>

    {/* s.body — one of five branches */}
    {/* step 0 name */}   <TextInput autoFocus value={name} placeholder="A name, a nickname" mt5 h12 inset hairline rounded-xl px4 15 focusRing accent/30 />
    {/* step 1 payday */} <View mt5><Row baseline gap2><Text font-display 40 tabular>{payday}</Text><Text 13 muted>of the month</Text></Row><Slider min1 max31 value={payday} accent mt3 /></View>
    {/* step 2 income */} <View mt5><Row baseline gap2><Text font-display 40 tabular>£{income.toLocaleString()}</Text><Text 13 muted>/ month</Text></Row><Slider min500 max8000 step20 value={income} accent mt3 /><Text 11.5 muted mt3>Doesn't need to be exact. Folio adjusts as you go.</Text></View>
    {/* step 3 balance */}<View mt5><Row baseline gap2><Text font-display 40 tabular>£{balance.toLocaleString()}</Text><Text 13 muted>roughly</Text></Row><Slider min0 max5000 step10 value={balance} accent mt3 /><Text 11.5 muted mt3>Your guess is fine. Folio uses this as the starting point — every number you'll see is anchored here, not a sample.</Text></View>
    {/* step 4 pots */}   <View mt5><Text 12.5 muted mb3>Pick any. Skip with none if you'd rather start blank — you can add later.</Text>
                            <Grid cols2 gap2>{POT_TEMPLATES.map(t => (
                              <Pressable press onPress={()=>togglePot(t.id)} rounded-2xl px3.5 py3 style={on ? accent-soft+ring(accent/40) : inset+hairline}>
                                <Text 13 medium ink>{t.name}</Text>
                                <Text 11 muted tabular mt0.5>£{t.goal} · £{t.perWeek}/wk</Text>
                              </Pressable>))}</Grid></View>

    <Pressable press primaryBtn mt6 h12 rounded-2xl accent onPress={()=> isLast ? done() : setStep(x=>x+1)}>
      <Text white 14 medium>{isLast ? "Begin quietly" : "Next"}</Text>
    </Pressable>
    <Pressable press mt2 h10 onPress={onClose}><Text 12.5 muted center>Skip for now</Text></Pressable>
    <Text mt1 px2 10.5 muted center leading-relaxed opacity-80>Skipping keeps sample numbers on Today. Folio works honestly once these are yours.</Text>

  </View>
</Sheet>

## enginesNeeded

- Local store + setters (useAppStore, setOnboarding, setPots, setCurrentBalance) — Zustand-style in web; RN = SQLite/persisted store with versioned migration (RN_PORT.md). No backend, no async.
- Pot engine (downstream) — consumes the pots this sheet seeds (id, name, saved, goal, perWeek, accent)
- Money path / starting-balance engine (downstream) — consumes currentBalance written here as the anchor for every Today/Ritual figure (source label drives the 'sample vs yours' nudge)
- No reader engines, no network, no AI — this is a pure-input sheet

## fidelityRisks

- STEP COUNT MISMATCH: doc block + COPY_DECK say 4 steps; source renders 5 (adds the balance/'Today' step). Port the 5 from code.
- COPY DIVERGENCE: inline strings differ from COPY_DECK onb.\* keys (e.g. code 'What lands, roughly?' vs deck onb.3.head 'Roughly, what comes in?'; code help text differs from onb.3.help/onb.4.help). Decide which is canonical before shipping; code is the rendered truth today.
- NO MELO: MELO_MOODS.md says onboarding steps 1-3 = calm, step 4 (pots) = curious, complete = cheer, but this source renders NO Melo at all. Port matches code (no Melo) unless design wants the mood added — flag to design.
- NO completion screen: COPY_DECK onb.done.head/body ('Ready.' / 'Folio will get quieter as it learns you.') and the doc-block 'stamp on completion' are NOT in this source — done() closes the sheet immediately. Either add the seal moment or accept the silent close.
- SLIDER FIDELITY: web uses native <input type=range> with accent-color; RN needs @react-native-community/slider styled to --accent thumb/track, min/max/step exact (payday 1-31 step1; income 500-8000 step20; balance 0-5000 step10).
- RANGE THUMB has no live value bubble — the big tabular number above is the only readout; keep that, don't add a tooltip.
- BALANCE SEED LOGIC: must replicate currentBalance.source==='sample' ? 0 : amount, and only write balance when >0. Getting this wrong re-anchors Today to a wrong figure.
- POT PRESELECT + SAVED PRESERVATION: picked Set seeds from existingPots ∩ templates; on finish, kept pots keep savedById[t.id] ?? 0, unchecked are dropped. A naive rebuild would zero a returning user's saved pots.
- SKIP ≠ DONE: 'Skip for now' must NOT call setOnboarding done:true. Leaving done=false is load-bearing (keeps the sample-numbers nudge, stops Today reading empty name as real). Easy to 'tidy' into one close handler and break.
- ACCENT WORD: each headline has exactly one terracotta <em> word (rendered via not-italic + accent color, NOT real italics). In RN, split the headline into <Text> runs with one accent-colored run; do not italicize.
- TYPOGRAPHY: headline + eyebrow + big values are Fraunces (font-display) with -0.02em tracking; values are tabular-nums. Body/help/buttons are the sans stack. Two-font discipline.
- autoFocus on the name input on step 0 — replicate so the keyboard opens; keyboard avoidance must not fight the bottom-sheet.
- Sheet body is on --paper (NOT --surface) per Sheet doc block — paper lifting from paper.
- MONEY FORMAT: toLocaleString() gives '£1,200' grouping; ensure RN i18n produces the same separators and that money is never abbreviated ('12.3K' is banned).
- BANNED VOCAB (COPY_DECK): if any copy is reworded, avoid import/parse/extract/sync/smart/AI-powered/100% etc.; never assert privacy properties not literally true.
- PROGRESS PIPS: three states (active=w7 accent, completed=w5 ink/60, future=w5 hairline) with a 400ms width+color tween; reproduce all three, not just active/inactive.

## rnPrimitiveMap

- <Sheet> → @gorhom/bottom-sheet BottomSheetModal (40-45% ink scrim, 28px top radius, hairline grip, sheet-rise spring, body on --paper)
- <input type=text> → RN <TextInput> (autoFocus, placeholder, value/onChangeText, focus ring approximated via borderColor on focus)
- <input type=range> → @react-native-community/slider (minimumValue/maximumValue/step, minimumTrackTintColor & thumbTintColor = --accent)
- <button> pot tiles / CTAs → <Pressable> + expo-haptics Haptics.selectionAsync() for the 'press' feel
- grid grid-cols-2 → RN View with flexDirection row + flexWrap, two columns gap 8 (or FlatList numColumns=2)
- <em class='not-italic text-accent'> → a <Text> run with color=accent inside the headline <Text> (no italic)
- CSS vars (--paper etc.) → theme object + useTheme() hook
- hairline border → StyleSheet.hairlineWidth with --hairline color
- Fraunces / system grotesque → embedded Fraunces for display, SF Pro/Roboto for body
- tabular figures → <Text style={{fontVariant:['tabular-nums']}}>
- press utility → Pressable pressed-state scale 0.97 via reanimated or style callback
- Set<string> picked-state + toggle → useState(new Set()) immutable toggle (clone, add/delete) — same as web
- step transition (doc-block intent) → reanimated slide-in-r/l 360ms on step change; verdict-stamp on finish

## moods

- NONE rendered in this source (no <Melo>).
- Per MELO_MOODS.md the intended moods for these surfaces are: Onboarding step 1-3 = calm, Onboarding step 4 (pots) = curious, Onboarding complete = cheer — flag as a gap vs the code.

## stateBranches

- populated/default — the only real state; renders steps[step] (0..4). This is a pure local-input sheet with no async, so no loading/error/offline branches exist or are needed.
- per-step body branch — five mutually exclusive bodies (name / payday / income / balance / pots) selected by `step`; isLast = step===4 swaps button label and routes the primary button to done().
- pots sub-states — each tile is on/off via picked.has(t.id) (selected = accent-soft + accent/40 ring; unselected = inset + hairline). 'Skip with none' is valid: picked.size===0 → setPots NOT called.
- balance seed branch — currentBalance.source==='sample' → start 0; else → start currentBalance.amount.
- STATES.md: Onboarding has no row of its own; Today's 'empty' = onboarding gate, and this sheet is that gate's fill flow. No empty/loading/error/offline visuals required here.

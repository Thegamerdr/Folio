# AddEntryScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenAddEntry.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenAddEntry.tsx

## rnComponentName

AddEntryScreen

## purpose

Single-form entry for ONE recurring bill or debt payment. The same screen is reused for both kinds via the kind ("bill" | "debt") prop, which swaps the eyebrow label, the headline + accent word, the name placeholder, and the frequency options. The user types a name, taps an in-screen numeric keypad to set an amount, picks a day-of-month ("When") and a cadence ("How often"), then commits with "Add it to plans" (navigates to the plans screen) or backs out with "Not yet". Per the doc block, bills write to subs (setSubs) and debts mirror to RN's own engine.

## docBlock

@rn-screen    AddEntryScreen
@rn-stack     Intake > Add a bill | Add a debt
@purpose      Single-form entry for one recurring bill or debt payment. Reused for both kinds.
@reads        —
@writes       setSubs (for bills) — debts mirror to RN's own engine.
@opens-sheet  —
@copy         FROZEN
@tokens       --surface --hairline --accent
@motion       slide-in-r · stamp on save

## reads

- store reads: NONE — doc block @reads is em-dash. No useAppStore selectors are read in the rendered body.
- local state (useState) only: amount:string (""), name:string (""), when:string ("1st"), freq:string (kind===bill ? "Monthly" : "Monthly · 6 left")
- props: nav:Nav, kind:"bill"|"debt"
- derived: keys (numeric keypad array), freqOptions (depends on kind)
- assets imported but UNUSED in this screen: meloHero (melo-hero.png), waxSeal (wax-seal.png) — drop in RN port unless 'stamp on save' motion needs the seal

## writes

- intended (per @writes): setSubs for bills; debts mirror to RN's own debt engine
- FIDELITY BUG to fix in RN: the web 'Add it to plans' button onClick ONLY calls nav.go("plans") and persists NOTHING. setSubs / debt-engine write is unimplemented in the prototype. RN port MUST build a record from {name, amount, when, freq} and call setSubs (bill) or the debt engine (debt) BEFORE navigating.
- imported-but-unused store actions (do NOT wire these for this screen): setPots(storeSetPots), togglePaused, pauseMany, addCycle, setOnboarding, resetAll, fastForwardMonth, removeSub, addToPot, markSubUsed, addTransaction, removeTransaction

## opensSheets



## copyKeys

- FROZEN — copy is INLINE in this component, NOT keyed in COPY_DECK.md. COPY_DECK 'Add a thing' section covers the method-picker/Review flow, not this manual form. Preserve these exact strings verbatim:
- "Add a bill" (eyebrow, kind===bill)
- "Add a debt" (eyebrow, kind===debt)
- "One thing at a time" (Fraunces italic kicker)
- What goes [out], and when? — bill headline, accent word = "out"
- What's the [payment], and how often? — debt headline, accent word = "payment"
- "Name · e.g. Rent" (bill name placeholder)
- "Name · e.g. Klarna sofa" (debt name placeholder)
- "Amount" (field label)
- "£—" (empty amount display when amount is "")
- "£{amount}" (filled amount display)
- "When" (field label)
- "How often" (field label)
- When options: "1st","3rd","7th","12th","15th","20th","25th","Last day"
- bill freq options: "Weekly","Monthly","Yearly"
- debt freq options: "Weekly · 6 left","Monthly · 6 left","Monthly · 12 left"
- keypad keys: "1".."9",".","0","←"
- "An estimate is fine. You can adjust it later." (MeloLine text, mood=soft)
- "Add it to plans" (primary CTA)
- "Not yet" (secondary/dismiss CTA)
- back affordance: "←" glyph (top-left)

## tokens

- --surface
- --hairline
- --accent
- --muted-ink
- --ink (implicit default text)
- white (#FFFFFF, primary CTA label text — should map to --color-primary-foreground)
- radius: rounded-xl (12px), rounded-2xl (32px)
- font-display (Fraunces) for headline, kicker, keypad glyphs, Money
- tabular figures via Money component (font-variant tabular-nums)

## motions

- slide-in-r — whole screen entrance (translateX 28→0, 360ms, cubic-bezier(.16,1,.3,1))
- stamp / verdict-stamp on save — declared in @motion ('stamp on save') but NOT implemented in the web body (no .stamp class rendered). RN port should add the stamp moment when the save commits.
- press — 120ms scale-to-0.97 on every tappable: back button, all 12 keypad buttons, primary CTA, secondary CTA
- count-up is NOT used here (amount updates instantly from keypad, not animated)

## moods

- soft — the single MeloLine ('An estimate is fine. You can adjust it later.') uses mood="soft" (a MeloLine/kit-level mood input)
- MELO_MOODS.md surface mapping for this screen flow: 'Add entry — reading' = curious, 'Add entry — success' = cheer, 'Add entry — fallback' = calm. This manual-entry form itself shows only the inline soft MeloLine; the curious/cheer/calm moods belong to the reader/Review surfaces, not this form.

## componentTree

<View style={screen /* flex column, px 28, pt 16, slide-in-r entrance */}>
  {/* Top bar */}
  <View style={row spaceBetween center}>
    <Pressable onPress={nav.back}><Text style={backGlyph /* muted-ink, 20px, press */}>←</Text></Pressable>
    <Text style={eyebrow /* 12px, muted-ink, uppercase, tracking 0.14em */}>{kind === "bill" ? "Add a bill" : "Add a debt"}</Text>
    <View style={{ width: 20 }} /* spacer to balance back glyph */ />
  </View>

  {/* Heading block */}
  <View style={{ marginTop: 20 }}>
    <Text style={kicker /* Fraunces italic, 13px, muted-ink */}>One thing at a time</Text>
    <Text style={headline /* Fraunces, 26px, leading-tight */}>
      {kind === "bill"
        ? <>What goes <Text style={accentWord /* not-italic, --accent */}>out</Text>, and when?</>
        : <>What's the <Text style={accentWord}>payment</Text>, and how often?</>}
    </Text>
  </View>

  {/* Name input */}
  <TextInput
    value={name} onChangeText={setName}
    placeholder={kind === "bill" ? "Name · e.g. Rent" : "Name · e.g. Klarna sofa"}
    style={input /* mt16, surface bg, hairline, rounded-xl, px16 py12, 14px, focus ring --accent */} />

  {/* Amount display card */}
  <View style={amountCard /* mt12, surface, hairline, rounded-2xl, px20 py16, row, items-baseline, spaceBetween */}>
    <Text style={fieldLabel /* 11px uppercase tracking-0.12em muted-ink */}>Amount</Text>
    <Money value={amount ? `£${amount}` : "£—"} size="xl" tone="accent" /* 44px Fraunces tabular --accent */ />
  </View>

  {/* When / How often selects (2-col grid) */}
  <View style={row2col /* mt12, gap 10 */}>
    <View style={selectCell /* surface, hairline, rounded-xl, px16 py12 */}>
      <Text style={fieldLabelSm /* 10px uppercase tracking-0.12em muted-ink */}>When</Text>
      <Picker selectedValue={when} onValueChange={setWhen} /* options: 1st..Last day; 13.5px medium */ />
    </View>
    <View style={selectCell}>
      <Text style={fieldLabelSm}>How often</Text>
      <Picker selectedValue={freq} onValueChange={setFreq} /* options = freqOptions (kind-dependent) */ />
    </View>
  </View>

  {/* Numeric keypad (3-col grid, 12 keys) */}
  <View style={keypadGrid /* mt16, 3 cols, gap 8 */}>
    {keys.map(k => (
      <Pressable key={k} onPress={() => onKey(k)} style={keyButton /* press, h44, rounded-xl, surface, hairline, Fraunces 18px */}>
        <Text>{k}</Text>
      </Pressable>
    ))}
  </View>

  {/* Melo reassurance line */}
  <View style={{ marginTop: 16, marginBottom: 8 }}>
    <MeloLine text="An estimate is fine. You can adjust it later." mood="soft" />
  </View>

  {/* Primary + secondary CTAs */}
  <Pressable onPress={() => { /* RN: persist via setSubs/debt engine */ nav.go("plans"); }}
    style={primaryCta /* press, full width, h52, rounded-2xl, --accent bg, white text, 15px medium */}>
    <Text>Add it to plans</Text>
  </Pressable>
  <Pressable onPress={nav.back} style={secondaryCta /* press, full width, h42, 13px, muted-ink */}>
    <Text>Not yet</Text>
  </Pressable>
</View>

## enginesNeeded

- Subscription store (setSubs) — bill writes. The Sub/StoreSub type is imported from @/lib/store; RN must build {name, amount(parsed number), dueDay(from when), cadence(from freq)} and persist.
- RN debt engine (NEW) — debt writes 'mirror to RN's own engine' per doc block. Not present in web prototype; RN must implement a debt record + amortization (the 'N left' count in debt freq options implies remaining-payments tracking).
- Plans screen — destination of the primary CTA (nav.go("plans")).
- NO reader/PDF/photo/paste engine here — this is the manual-entry surface; it is downstream of the method picker, not a reader.
- Currency formatting: amount is captured as a raw keypad string and shown with a literal £ prefix; RN should parse to number on save and reuse formatGBP/Money for display.

## fidelityRisks

- Save persists NOTHING in the web prototype — the primary CTA only navigates. Easy to port the no-op. RN MUST add the setSubs (bill) / debt-engine (debt) write before nav.go('plans').
- Amount keypad logic must be ported exactly: '←' deletes last char; '.' is ignored if one already exists else appends (prefixing '0' when string empty -> '0.'); max 2 decimal places; total string capped at 7 chars via .slice(0,7). Do NOT swap in a free-form TextInput numeric keyboard — the in-screen keypad IS the design.
- Amount is a STRING in state and displayed as pound+amount; empty shows the em-dash '£—' (U+2014), not a hyphen. Keep the em-dash.
- HTML <select> -> RN Picker/ActionSheet: native iOS/Android pickers look different; match the inline cell styling (label on top, value 13.5px medium, transparent bg). Consider a bottom-sheet wheel to stay on-brand rather than a stock dropdown.
- kind-dependent strings come in pairs (eyebrow, headline+accent, placeholder, freq options, default freq). Don't collapse to one variant — both bill and debt must render.
- Accent word is not-italic text-[var(--accent)] inside a Fraunces (display) headline — the headline is upright display type and the accent word is also upright but terracotta. Don't italicize the accent word (the kicker above IS italic — different element).
- 'stamp on save' motion is declared but unimplemented in web; if you add it, it's verdict-stamp (back-out easing) and must fire exactly once on commit, not loop.
- Money size 'xl' = 44px, tone 'accent' = --accent; use tabular-nums (fontVariant) so digits don't jitter as the keypad updates.
- press utility = scale 0.97 on active; pair with expo-haptics selectionAsync per RN_PORT mapping for the keypad and CTAs.
- slide-in-r entrance must collapse to final state under reduce-motion (AccessibilityInfo.isReduceMotionEnabled), not slow down.
- focus ring on inputs is keyboard-only on web (focus-visible) and uses --accent; on RN map to a focus border on the name TextInput, not a permanent ring.
- STATES.md: AddEntry has no empty/loading/error branches for this manual form (loading/error live on the reader Success/Fallback screens). Offline = 'saved, will read later' applies to readers, not this typed form — so this screen is effectively single-state (populated/interactive). Don't invent a spinner.
- Keypad is a fixed 12-key 3-col grid; the screen is content-tall and may need a ScrollView/KeyboardAvoidingView on small devices, but the name TextInput should NOT raise the OS keyboard in a way that hides the in-screen keypad — consider blurring the TextInput when a keypad key is pressed.

## rnPrimitiveMap

- <div> -> <View>
- <button> (back, keypad, CTAs) -> <Pressable> + press scale 0.97 + Haptics.selectionAsync (expo-haptics)
- <input> (name) -> <TextInput> with placeholder + onChangeText
- <select> (When / How often) -> @react-native-picker/picker or a gorhom bottom-sheet wheel (prefer on-brand sheet over stock dropdown)
- <Money> -> <Text> with fontVariant: ['tabular-nums'], Fraunces, color --accent, 44px
- <MeloLine> -> Melo (react-native-svg) + Fraunces-italic Text, mood='soft'
- CSS tokens (--surface/--hairline/--accent/--muted-ink) -> theme object + useTheme()
- hairline border -> StyleSheet.hairlineWidth with --hairline color
- Tailwind grid grid-cols-2 / grid-cols-3 -> flexDirection row + flexWrap or gap-based grid
- rounded-xl(12)/rounded-2xl(32) -> borderRadius radius tokens
- tracking-[0.14em]/[0.12em] -> letterSpacing (px-converted)
- uppercase -> textTransform: 'uppercase'
- nav.go/nav.back (local Nav) -> @react-navigation/native stack navigate/goBack
- slide-in-r -> reanimated withTiming(translateX 28->0, 360ms, Easing.bezier(.16,1,.3,1))
- focus:ring -> onFocus/onBlur border color swap on TextInput

## stateBranches

- interactive/populated (the only real branch): the form itself, always rendered the same; fields fill as the user types/taps.
- kind=bill variant: eyebrow 'Add a bill', headline 'What goes [out], and when?', placeholder 'Name · e.g. Rent', freq options Weekly/Monthly/Yearly, default freq 'Monthly'.
- kind=debt variant: eyebrow 'Add a debt', headline 'What's the [payment], and how often?', placeholder 'Name · e.g. Klarna sofa', freq options 'Weekly · 6 left'/'Monthly · 6 left'/'Monthly · 12 left', default freq 'Monthly · 6 left'.
- amount empty -> Money shows '£—'; amount filled -> Money shows pound+amount.
- No empty/loading/error/offline branches for THIS screen per STATES.md (those belong to the reader Success/Fallback/Review surfaces). Do not add a spinner or error view here.


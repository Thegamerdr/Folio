# PasteSuccessScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPasteSuccess.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPasteSuccess.tsx

## rnComponentName

PasteSuccessScreen

## purpose

Confirmation / Review-staging screen shown after the user pastes text in the Add flow. Doc block @purpose: "Show what Folio found in pasted text, ready to check before adding." @rn-stack: "Intake > Things to check". It lists the candidate money-in / money-out items Folio found in the pasted text, makes explicit that nothing has been added yet, and routes the user to check them (visualizer/Review) or leave for later. Its job is to STAGE data for Review, never to commit it. This is the populated "success" branch of the paste/text reader.

## reads

- STORE: none. Doc block @reads is "—" (empty). The screen reads nothing from useAppStore.
- Candidate items are a HARDCODED local literal array `items` (NOT store-derived): [{merchant:'Tesco',flow:'out',amount:'£42',date:'26 Jun'},{merchant:'Salary',flow:'in',amount:'£1,200',date:'25 Jun'},{merchant:'Rent',flow:'out',amount:'£750',date:'1 Jul'}].
- nav.pressure is available on the Nav prop but is NOT consumed by this screen.
- RN PORT INTENT: in the shipped app these rows must come from the Text/file reader engine's candidate money items (route params or a review-staging store slice), not a literal.

## writes

- STORE: none. Doc block @writes is "—" (empty). No store action is invoked in the component body.
- DEAD IMPORTS — do NOT port as wired behavior: useAppStore + storeSetPots, setSubs, togglePaused, pauseMany, addCycle, setOnboarding, resetAll, fastForwardMonth, removeSub, addToPot, markSubUsed, addTransaction, removeTransaction (and types Sub, Transaction) are imported but never called.
- Only navigation side-effects: primary CTA calls nav.go('visualizer'); secondary CTA and header back-arrow call nav.back(). The data write happens later in Review, never here.

## opensSheets

- edit-item (per doc block @opens-sheet: edit-item — INTENDED per-item edit sheet, reached by tapping a row to fix an item). NOTE: the prototype does NOT actually wire row taps or call nav.openSheet('edit-item'); rows are non-interactive. RN port should add the row->edit-item tap that the doc block declares.

## copyKeys

- add.success.paste = "Things to check." (canonical COPY_DECK key for this success screen)
- Headline rendered as: "Things to " + accent word "check." (em styled non-italic in accent color)
- Eyebrow (literal, NOT in COPY_DECK, Fraunces italic): "3 things to check"
- Header label (literal, NOT in COPY_DECK, uppercase tracked): "Pasted"
- Body line (literal, NOT in COPY_DECK): "Folio found possible money in and money out. Nothing has been added yet."
- MeloLine quote (literal, NOT in COPY_DECK): "Use what you have. You choose what counts."
- Primary CTA label (literal, NOT in COPY_DECK): "Check these"
- Secondary CTA label (literal, NOT in COPY_DECK): "Leave for later"
- Per-row meta string: "{date} · money {flow}" e.g. "26 Jun · money out", "25 Jun · money in"
- Per-row amount via <Money>: money-in shows "+£1,200"; money-out shows "−£42" / "−£750" (uses U+2212 minus, not hyphen)
- Back-arrow glyph: "←"
- FIDELITY/VOICE WARNING: several visible strings here are inline literals not yet in COPY_DECK. COPY_DECK rule says "if a string isn't here, it doesn't ship" — RN port must add eyebrow/header/body/Melo/CTA strings to COPY_DECK first. Check banned words (none currently violate; 'check' is fine).

## tokens

- --surface (item card background)
- --hairline (card border via `hairline` utility + divide-y row dividers)
- --accent (accent word color, money-out dot, primary CTA bg, CTA shadow tint rgba(224,99,58,...))
- --muted-ink (eyebrow, header label, body copy, row meta, secondary CTA text, back arrow)
- --positive (money-in flow dot)
- --ink (default body text + Money tone="ink")
- white (#FFFFFF, --color-primary-foreground) for primary CTA text
- radius: rounded-2xl = --radius-2xl 32px (card + both CTAs)
- font: --font-display (Fraunces) on eyebrow, headline, Money; --font-sans (Inter Tight) on body/meta/labels
- Doc block @tokens declares only: --surface --hairline --accent (but the rendered screen also uses --muted-ink, --positive, --ink, white — port all that actually appear).

## motions

- slide-in-r (360ms cubic-bezier(.16,1,.3,1)) — whole screen entrance (forward navigation into intake step). Doc block @motion: "slide-in-r · stamp on accept".
- press (120ms, scale 0.97 on active) — back arrow, primary CTA, secondary CTA. RN: Pressable + Haptics.selectionAsync() per RN_PORT.
- stamp / verdict-stamp (600ms back-out) — declared in doc block as "stamp on accept" but NOT present in this screen's JSX; it belongs to the accept moment downstream (Review/visualizer). Do not invent it here unless the accept animation is added.
- Melo breathe (via MeloLine, mood soft→nearest: pebble-breathe idle) — the only continuous animation on the screen.
- Reduced-motion: slide-in-r collapses to final state; per MOTION.md collapse to resolved layout, no slow variant.

## componentTree

<PasteSuccessScreen nav>
  // ScrollView, full height, flex column, px-7 pt-4, hidden scrollbar, entrance = slide-in-r
  <HeaderRow>                          // flex row, space-between, center
    <BackButton onPress={nav.back}>←  // muted-ink, 20px, press
    <Label>Pasted</Label>             // 12px muted-ink, uppercase, tracking 0.14em
    <Spacer w={20} />                  // balances the back arrow
  </HeaderRow>

  <Intro mt-6>
    <Eyebrow>3 things to check</Eyebrow>      // Fraunces italic, 13px, muted-ink
    <Headline>Things to <Accent>check.</Accent></Headline> // Fraunces 30px; accent em non-italic accent color
    <Body>Folio found possible money in and money out. Nothing has been added yet.</Body> // 13.5px muted-ink, relaxed
  </Intro>

<ItemCard mt-6> // bg --surface, hairline border, rounded-2xl, divide-y --hairline
{items.map(it =>
<ItemRow key={it.merchant}> // px-4 py-3.5, flex row, gap-3, center
<FlowDot color={it.flow==='in' ? --positive : --accent} /> // 6x6 (w-1.5 h-1.5) rounded-full
<Col flex-1 min-w-0>
<Merchant numberOfLines={1}>{it.merchant}</Merchant> // 14px, font-medium, truncate
<Meta>{it.date} · money {it.flow}</Meta> // 11.5px muted-ink
</Col>
<Money value={(it.flow==='in'?'+':'−')+it.amount}
size="sm" tone={it.flow==='in'?'positive':'ink'} /> // Fraunces tabular
</ItemRow>
)}
</ItemCard>

  <MeloLineWrap mt-5>
    <MeloLine text="Use what you have. You choose what counts." mood="soft" />
  </MeloLineWrap>

<Spacer flex-1 /> // pushes CTAs to bottom

<PrimaryCTA onPress={() => nav.go('visualizer')}> // h-58, rounded-2xl, bg --accent, white, 15.5px medium
Check these // boxShadow 0 12px 24px -10px rgba(224,99,58,0.55)
</PrimaryCTA>
<SecondaryCTA onPress={nav.back} mt-2> // h-46, rounded-2xl, 13px muted-ink, transparent
Leave for later
</SecondaryCTA>
<Spacer h={16} /> // bottom breathing room
</PasteSuccessScreen>

## enginesNeeded

- Text/file reader engine (paste / CSV / TXT -> candidate money items). RN_PORT: heuristic reader, NEVER route to blank manual entry. This screen renders that reader's OUTPUT (the candidate list). In the prototype the output is faked by the literal `items` array.
- Review step (downstream): candidate items must be checked before they change the money path; this screen's CTAs feed into it (visualizer -> Review).
- Money path / visualizer engine (nav target 'visualizer') — consumes the accepted candidates to redraw the path-to-payday.
- No live engine runs ON this screen; it is a pure presentation of staged candidates. STATES.md marks PasteSuccess: empty n/a, loading n/a, populated ✅, error "couldn't make sense", offline n/a.

## fidelityRisks

- Hardcoded items: easy to ship the Tesco/Salary/Rent literal. RN must source rows from real reader output via route params / staging slice.
- Dead store imports: 13 store actions + useAppStore are imported but unused — do NOT recreate them as wiring; this screen has no @reads/@writes.
- Minus sign: amounts use U+2212 (−), not ASCII hyphen-minus. Money(value) is a pre-formatted string with the sign baked in; <Money> does NOT compute sign/format — preserve '+£1,200' / '−£42'. RN <Text> needs fontVariant ['tabular-nums'] for tabular figures.
- edit-item sheet declared but unwired: doc block says @opens-sheet edit-item, but rows are non-interactive in the prototype. Port the intended row->edit-item tap; otherwise the doc block lies.
- stamp motion declared but absent: @motion lists 'stamp on accept' yet no stamp in JSX — it lives downstream on accept; don't add a phantom stamp here.
- Inline copy not in COPY_DECK: eyebrow/header/body/Melo/CTA strings are literals. COPY_DECK is source of truth ('if a string isn't here, it doesn't ship') — add keys before RN port; do not let literals drift.
- Melo mood 'soft' is NOT one of the 5 canonical moods (calm/curious/cheer/concern/celebrate). MELO_MOODS says Add-entry success = cheer. MeloLine maps via MeloMoodInput (a separate input alias incl. 'soft'); RN must map 'soft' correctly (likely -> calm) and reconcile vs the mood map's 'cheer' for success — flag this discrepancy, don't guess silently.
- Layout: flex-1 spacer pushes CTAs to the bottom inside a ScrollView — in RN use flexGrow:1 content container (contentContainerStyle minHeight 100%) so the bottom CTAs pin correctly and still scroll on small screens.
- Header back glyph '←' is a text arrow; RN should use lucide-react-native ArrowLeft / ChevronLeft for crispness, matching the curated icon set, rather than a literal character.
- CTA shadow is a hardcoded rgba(224,99,58,0.55) (the accent at fixed alpha) — in RN this is a colored elevation/shadow; derive from --accent and won't auto-flip for dark mode. Verify against theme.
- Safe-area: px-7 + bottom h-4 only; RN must add useSafeAreaInsets for the home indicator / notch (the web phone frame faked this).

## docBlock

/\*\*

- @rn-screen PasteSuccessScreen
- @rn-stack Intake > Things to check
- @purpose Show what Folio found in pasted text, ready to check before adding.
- @reads —
- @writes —
- @opens-sheet edit-item
- @copy FROZEN
- @tokens --surface --hairline --accent
- @motion slide-in-r · stamp on accept
  \*/

## moods

- soft (as passed to MeloLine: mood="soft" — a MeloMoodInput alias, not one of the 5 canonical pebble moods; maps to ~calm)
- DISCREPANCY: MELO_MOODS.md prescribes Add entry — success = cheer. The screen instead uses 'soft'. RN port must reconcile: either follow the mood map (cheer) or the prototype (soft/calm). Flag, don't silently pick.

## stateBranches

- populated (✅ the only designed branch): renders the 3-row candidate card + Melo line + CTAs. Per STATES.md PasteSuccess row.
- empty: n/a per STATES.md (PasteSuccess is only reached when the reader produced candidates).
- loading: n/a per STATES.md (the reading/loading state lives on the Visualizer/Add 'reading…' step, not here).
- error: "couldn't make sense" — STATES.md error copy for PasteSuccess (reader produced nothing usable). NOT implemented in the prototype; RN must add this branch (honest line + one recovery, e.g. back to paste).
- offline: n/a per STATES.md (paste is local; no network).
- RULE: no spinners; loading elsewhere = Melo curious + one line. One CTA-pair max (Check these / Leave for later) — refusal ('Leave for later') is always offered, matching STATES.md 'refusal is always an option'.

## rnPrimitiveMap

- root div.h-full.flex.flex-col.overflow-y-auto.no-scrollbar -> ScrollView (showsVerticalScrollIndicator=false, contentContainerStyle {flexGrow:1, paddingHorizontal:28, paddingTop:16}) wrapped in SafeAreaView
- div (header/intro/card/rows) -> View
- button -> Pressable (+ expo-haptics Haptics.selectionAsync() on the press utility per RN_PORT)
- span/p/h2/em/div text -> Text (em accent word = nested <Text> with accent color)
- className utilities -> StyleSheet via theme object + useTheme() (no Tailwind; tokens become theme.surface/hairline/accent/...)
- CSS var colors var(--x) -> theme.x from useTheme()
- hairline border (1px) -> StyleSheet.hairlineWidth + theme.hairline; divide-y -> per-row borderTopWidth hairline (skip first)
- <Money> (web kit) -> RN <Money> kit equivalent: <Text> fontFamily Fraunces, fontVariant ['tabular-nums'], size/tone maps (sm=15px; tone ink/positive)
- <MeloLine> (web kit) -> RN MeloLine: react-native-svg Melo (reanimated breathe) + Fraunces italic Text in quotes
- boxShadow inline -> iOS shadowColor/shadowOffset/shadowOpacity/shadowRadius + Android elevation (accent-tinted)
- slide-in-r class -> reanimated withTiming(translateX 28->0, opacity 0->1, 360ms, Easing cubic-bezier(.16,1,.3,1)); respect AccessibilityInfo.isReduceMotionEnabled -> final state
- press class -> Pressable pressed style scale 0.97 (reanimated or style fn)
- ← text glyph -> lucide-react-native ArrowLeft/ChevronLeft
- nav.go/nav.back (local Nav prop) -> @react-navigation/native stack (navigation.navigate('Visualizer') / navigation.goBack()); Nav.pressure/openSheet/openMelo from a context, not props, in RN

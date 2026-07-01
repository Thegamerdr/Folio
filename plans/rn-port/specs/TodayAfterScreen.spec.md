# TodayAfterScreen (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenTodayAfter.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenTodayAfter.tsx

## rnComponentName

TodayAfterScreen

## purpose

Transient "after a change" celebration screen: shows the path-to-payday re-drawing once a meaningful change lands (review accepted / sub paused / a thing added). Confirms the user still makes it to payday, shows what changed (−£42 from adding Tesco lowered the low point), draws the new route, gives a cheerful Melo reassurance line, and offers two exits (Back to today / open the low-point route detail).

## reads

- nav.pressure (declared in @reads; NOT actually consumed in the body — the screen hardcodes its demo numbers)
- transactions (declared in @reads; NOT actually consumed in the body)
- nav (the Nav object: nav.go, nav.openMelo, nav.openSheet)

## writes

- none — @writes is — (em dash). The screen performs no store mutations. It only calls navigation methods (nav.go, nav.openMelo, nav.openSheet).

## opensSheets

- melo-chat (via nav.openMelo() — top-right Melo button; this is the @opens-sheet declared in the doc block)
- route-detail (via nav.openSheet('route-detail') — the 'Your low point / open' tile; opened but NOT listed in the doc block's @opens-sheet, a fidelity note)

## copyKeys

- One less thing waiting (eyebrow label, top center, uppercase tracked — VERBATIM string, not a COPY_DECK key)
- You make it to payday. (positive Fraunces italic line — note: web prototype shows this as plain text 'You make it to payday.', which mirrors pressureLine.calm and is the de-emphasised form of COPY_DECK today.verdict.safe 'You **make it** to payday.')
- £283 (count-up balance, hardcoded target 283)
- spare (Fraunces italic suffix after the amount)
- after adding Tesco (italic sub-line under the amount)
- What changed (card eyebrow, uppercase tracked)
- −£42 (accent tabular delta, top-right of card)
- Tesco lowered your low point by £42. (card body sentence; the '£42' is an inline accent tabular span)
- lowest (SVG label at the low-point dot)
- payday (SVG label at the payday dot)
- "One less thing waiting. You're still on track." (Melo inset quote, Fraunces italic, includes the literal curly quotes)
- Back to today (tile 1 eyebrow, uppercase tracked)
- Today (tile 1 Fraunces title)
- Your low point (tile 2 eyebrow, uppercase tracked)
- open (tile 2 Fraunces title, accent colored)
- Back to Today (aria-label on the ← back button)
- Open Melo (aria-label on the Melo button)
- ← (literal back-arrow glyph in the back button)

## tokens

- --paper (doc block; screen scroll ground / app background)
- --accent (route stroke, fill gradient, delta −£42, '£42' span, 'open' title, low/payday dots)
- --positive (the 'You make it to payday.' line color)
- --hairline (card border via .hairline util, the divider h-px, dashed prior-route stroke, fill gradient base)
- --surface (Melo button bg, What-changed card bg, both bottom tiles bg)
- --muted-ink (back arrow, eyebrow labels, 'spare', 'after adding Tesco', SVG text labels, tile eyebrows)
- --inset (Melo reassurance strip bg)
- --shadow-card (What-changed card box-shadow, applied via inline style)
- (font) --font-display = Fraunces (all italic/display copy)
- (font) --font-sans = Inter Tight (SVG text fontFamily='Inter Tight', body sans)

## motions

- slide-in-r (360ms cubic-bezier(.16,1,.3,1)) — whole screen enters from the right; this is the screen's primary entrance
- route-draw (2200ms ease-out) — the new accent route path strokes on (strokeDasharray 1200 → strokeDashoffset 0); applied to the solid accent path only
- count-up (700ms, cubic-out 1−(1−t)³) — the £283 balance ticks up via useCountUp(283, 700)
- press (120ms ease, scale 0.97 on :active) — back button, Melo button, both bottom tiles
- pebble-breathe / breathe family — implicit inside the two <Melo mood="cheer"> instances (always-on idle breathing + blink); cheer uses the default 4.4s breathe, not breathe-fast

## moods

- cheer (BOTH Melo instances: the size-22 top-right Melo button and the size-28 Melo in the reassurance strip; per MELO_MOODS 'TodayAfter (route re-drawn) → cheer'; cheer adds the soft up-curved mouth + terracotta cheek blush; pose stays default 'none')

## componentTree

<ScreenContainer slideInR scroll vertical noScrollbar> // Animated translateX 28→0, ScrollView
<HeaderRow paddingX=28 pt=4 pb=2 spaceBetween>
<BackButton onPress={nav.go('today')} a11y="Back to Today">←</BackButton>
<Eyebrow>One less thing waiting</Eyebrow> // uppercase, tracking .14em, muted-ink
<MeloButton round 40 surface hairline onPress={nav.openMelo} a11y="Open Melo">
<Melo size={22} mood="cheer" />
</MeloButton>
</HeaderRow>

  <VerdictBlock paddingX=28 pt=3 a11y-live="polite">
    <PositiveLine fraunces italic 15 color=positive>You make it to payday.</PositiveLine>
    <AmountRow baselineAlign gap=2>
      <Amount fraunces tabular 64 leadingNone>£{round(countUp)}</Amount>  // en-GB grouped
      <Suffix fraunces italic 18 muted>spare</Suffix>
    </AmountRow>
    <SubLine 12.5 muted italic>after adding Tesco</SubLine>
  </VerdictBlock>

  <WhatChangedCard mt=5 mx=4 surface hairline rounded=2xl p=5 shadow=card>
    <Row spaceBetween mb=2>
      <Eyebrow>What changed</Eyebrow>
      <Delta 11 accent tabular>−£42</Delta>
    </Row>
    <Body 13.5 relaxed>Tesco lowered your low point by <Inline accent medium tabular>£42</Inline>.</Body>
    <Divider mt=4 h=1 bg=hairline />
    <RouteSvg viewBox="0 0 400 120" w=full h=110 mt=3>
      <defs><linearGradient id="afterFill" vertical>stop accent .16 → 0</linearGradient></defs>
      <Path d=PRIOR_DASHED stroke=hairline w=1 dash="2 3" />            // ghost of old route
      <Path d=NEW_FILL fill="url(#afterFill)" />                        // area under new route
      <Path d=NEW_LINE stroke=accent w=2.2 round class=route-draw />    // animated new route
      <Circle cx=305 cy=92 r=5 fill=accent /><Text x=305 y=80 mid 9 muted ff="Inter Tight">lowest</Text>
      <Circle cx=380 cy=62 r=5 fill=accent /><Text x=378 y=50 end 9 muted ff="Inter Tight">payday</Text>
    </RouteSvg>
  </WhatChangedCard>

  <MeloStrip mx=4 mt=3 inset rounded=xl p=4 row gap=3 alignStart>
    <Melo size={28} mood="cheer" />
    <Quote fraunces italic 13 flex1>"One less thing waiting. You're still on track."</Quote>
  </MeloStrip>

  <ExitGrid mx=4 mt=3 mb=6 cols=2 gap=2.5>
    <Tile press surface hairline rounded=xl p=3.5 onPress={nav.go('today')}>
      <Eyebrow 11>Back to today</Eyebrow><Title fraunces 16>Today</Title>
    </Tile>
    <Tile press surface hairline rounded=xl p=3.5 onPress={nav.openSheet('route-detail')}>
      <Eyebrow 11>Your low point</Eyebrow><Title fraunces 16 accent>open</Title>
    </Tile>
  </ExitGrid>
</ScreenContainer>

## enginesNeeded

- NONE for this screen as a literal port — every number is hardcoded demo data (balance 283, delta −£42, 'after adding Tesco', the two SVG paths). The screen is a presentational 'after' moment, not a live computation.
- Money path engine — to make this real, the route shape, the £283 spare-at-payday verdict, and the 'lowest'/'payday' anchor points must come from the money-path engine (RN_PORT 'Money path engine': computes will-I-make-it verdict + route shape). The prior-vs-new route is a before/after of that engine.
- Cycle/change provenance — 'what changed' (Tesco, −£42, lowered low point) implies the app knows which just-accepted change produced this delta (from Review acceptance / sub pause). Needs the diff between pre- and post-change money paths.
- Nav/navigation — @react-navigation stack for nav.go('today') and the back button; sheet host (gorhom BottomSheetModal) for openMelo (melo-chat) and openSheet('route-detail').

## rnPrimitiveMap

- root <div class='h-full flex flex-col overflow-y-auto no-scrollbar slide-in-r'> → <Animated.ScrollView> (or ScrollView wrapped in Animated.View) with showsVerticalScrollIndicator={false}, contentContainerStyle flexGrow, and the slide-in-r entrance via reanimated translateX 28→0 over 360ms
- <button> (back / Melo / tiles) → Pressable with accessibilityLabel/accessibilityRole='button' + the press utility = onPressIn scale 0.97 (reanimated) + Haptics.selectionAsync()
- ← glyph button → Pressable with a <Text>←</Text> or a lucide-react-native ArrowLeft icon (prefer the icon set per RN_PORT)
- <Melo size mood> → react-native-svg rebuild of the Melo document + reanimated breathe/blink loops (NOT Lottie per MOTION.md)
- <svg>/<path>/<circle>/<text>/<linearGradient> → react-native-svg <Svg><Path><Circle><Text><Defs><LinearGradient><Stop> (preserve viewBox '0 0 400 120'); route-draw via animated strokeDashoffset on the accent <Path>
- CSS var() colors → theme object + useTheme() (paper/surface/inset/ink/muted-ink/hairline/accent/positive); no hardcoded hex
- .hairline util (1px border) → borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline
- tabular figures (font-variant-numeric: tabular-nums) → <Text style={{ fontVariant: ['tabular-nums'] }}> (matches kit <Money>)
- useCountUp(283,700) → reanimated useSharedValue + withTiming(cubic-out) driving an Animated <Text> (round + toLocaleString('en-GB'))
- font-display (Fraunces) / font-sans (Inter Tight) → embedded Fraunces + Inter Tight fonts; SVG <Text fontFamily='Inter Tight'> needs the font registered for react-native-svg
- boxShadow: var(--shadow-card) inline → RN shadow props (shadowColor/Opacity/Radius/Offset on iOS, elevation on Android) approximating the two-layer card shadow
- px-7 / mx-4 / pt-\* spacing (Tailwind) → StyleSheet numeric padding/margin (px-7≈28, mx-4≈16, gap-2.5≈10)
- aria-live='polite' on the verdict block → accessibilityLiveRegion='polite' (Android) / AccessibilityInfo.announceForAccessibility on mount (iOS)
- grid grid-cols-2 gap-2.5 → flexDirection row with two flex:1 tiles + gap (or marginRight on first)

## stateBranches

- populated — the ONLY designed branch and the only one this screen renders. Per STATES.md TodayAfter row: empty=n/a, error='falls back to Today', offline=✅(same as populated). The web component has no conditional rendering: it always shows the full populated layout.
- loading — STATES.md lists 'route-draw 2.2s' as TodayAfter's loading treatment. There is no separate spinner branch; the route-draw entrance IS the loading-into-populated transition (no Melo-curious gate here because the data is already resolved when this transient screen mounts).
- error — no in-component error UI; the contract is 'falls back to Today' (i.e. the navigator/parent routes back to TodayScreen rather than this screen showing an error state). RN port should not invent an error view; on failure to compute the change, route to Today.
- empty — n/a. This screen is only reached after a real change exists; it should never render with no change.
- offline — render identical to populated (Folio is local-first; no network dependency on this surface).

## fidelityRisks

- Hardcoded demo data: balance 283, '−£42', 'after adding Tesco', and BOTH SVG path 'd' strings are literals. A real RN port must source these from the money-path engine (before/after) — do NOT bake in 283/42/Tesco. Treat the strings as templated.
- Two distinct verdict copies exist: COPY_DECK today.verdict.safe is 'You **make it** to payday.' (bold accent word) but THIS screen renders 'You make it to payday.' in plain positive italic (matching pressureLine.calm). Don't 'correct' it to the bolded form — the de-emphasised line is the intended TodayAfter treatment. Keep both faithfully where each is used.
- Doc-block @opens-sheet only lists melo-chat, but the body ALSO opens 'route-detail' via the second tile. Wire BOTH; flag the doc block as under-stating.
- route-draw must animate ONLY the solid accent line path (the 3rd path). The dashed ghost route and the fill-area path are static. Animating the fill or the ghost breaks the 'old → new' read.
- MOTION rule 'one motion per element' + 'money values never slide': the £283 must count-up (700ms), never slide-in with the screen. The screen-level slide-in-r should not also translate the number independently.
- Both Melo instances are mood='cheer' (not curious/celebrate). cheer = soft mouth + cheek blush, default breathe (4.4s), NOT breathe-fast. Don't escalate to 'celebrate' — MELO_MOODS reserves celebrate for cycle-close, max once/cycle.
- SVG <Text fontFamily='Inter Tight'> for 'lowest'/'payday' silently falls back to a system font in react-native-svg unless Inter Tight is registered for SVG text — easy to miss, breaks type fidelity at small sizes.
- The literal curly quotes in the Melo line ("One less thing waiting…") and the en-dash minus in '−£42' / formatGBP's '−' (U+2212, not ASCII '-') must be preserved exactly; copy is FROZEN.
- Reduced motion: route-draw, count-up, and slide-in-r must collapse to final state instantly (path fully drawn, number at 283, screen in place) per MOTION + MELO_MOODS accessibility — not a slower animation.
- Tabular alignment: the £283, '−£42', and inline '£42' all use tabular figures; using proportional figures makes the numbers jitter and breaks the 'money reads as money' rule.
- Card shadow: --shadow-card is a layered soft shadow; a single flat RN elevation looks wrong against the warm-paper ground. Approximate the soft long shadow, not a hard drop.
- @reads declares nav.pressure + transactions but the component reads neither — if the RN port wires real data, decide whether TodayAfter should derive its before/after from pressure/transactions (likely yes) rather than leaving them unused as in the prototype.

## docBlock

/\*\*

- @rn-screen TodayAfterScreen
- @rn-stack Today > After (transient)
- @purpose Show the path re-drawing after a meaningful change (review accepted, sub paused).
- @reads nav.pressure, transactions
- @writes —
- @opens-sheet melo-chat
- @copy FROZEN
- @tokens --paper --accent --positive --hairline
- @motion route-draw 2.2s · count-up · slide-in-r
  \*/

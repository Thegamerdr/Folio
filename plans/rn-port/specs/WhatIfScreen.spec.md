# WhatIfScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenWhatIf.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenWhatIf.tsx

## rnComponentName

WhatIfScreen

## purpose

Spend-preview slider. The user dials a hypothetical "spend £X today" amount with −/+ steppers (default £40, step £5, clamp 0..500); the screen recomputes in real time — with a count-up — what their new lowest point to payday would be, how many days that lowest figure would cover, and whether it breaches their Melo-set floor or would eat into pots. A mini money-path SVG redraws its dip as the amount changes. Strictly read-only "quiet experiment": nothing is ever committed (closing copy "Close — nothing was added"). @rn-stack: More > What if.</purpose>
<parameter name="docBlock">/\*\*

- @rn-screen WhatIfScreen
- @rn-stack More > What if
- @purpose Spend-preview slider — see the tight point shift as you "spend" hypothetically.
- @reads tightPointGoal, pots
- @writes —
- @opens-sheet melo-chat
- @copy FROZEN
- @tokens --paper --accent --positive --negative
- @motion count-up on tight-point figure · slide-in-r
  \*/

## reads

- useAppStore: tightPointGoal (number | null, default null) — the Melo-set floor; gates the floor caption and breach signal
- useAppStore: pots (Pot[]) — reduced to potsTotal = sum of p.saved (default seed sums to 620: holiday 420 + buffer 140 + christmas 60)
- nav.pressure (Pressure) — indexes pressureLow to get baseLow
- pressureLow[pressure] const (safe 612 | calm 325 | soft 184 | pressured 42 | overspent -86)
- local useState amount (number, default 40, clamp 0..500, step 5)

## writes

- NONE — screen is strictly read-only. @writes is empty. No store mutations (no setPressure, no bumpReview, no fundPot). Local component state `amount` only. The whole point of the screen is that nothing is committed.

## opensSheets

- melo-chat (declared in @opens-sheet as intent). NOTE: the current body never calls nav.openMelo/openSheet — Melo is rendered inline and non-interactive. In RN, only wire melo-chat if the inline Melo is made tappable via onTap → nav.openMelo (per MELO_MOODS onTap pattern). As written, NO sheet is actually opened from this screen.

## copyKeys

- Header eyebrow: "Preview" (uppercase, tracking 0.14em)
- Eyebrow line: "A quiet experiment" (font-display italic)
- Title (dynamic): "What if I spend £{amount} today?" — accent word is £{amount} (em, not-italic, --accent)
- Stepper button glyphs: "−" and "+"
- Money display center: "£{amount}" (Money, size xl, tone accent)
- Stepper caption: "today's spend" (uppercase 0.14em)
- SVG label: "payday" (display italic, fill --ink)
- SVG label: "lowest point" (display italic, fill --muted-ink)
- Stat tile 1 label: "New lowest"
- Stat tile 1 value: formatGBP(Math.round(lowDisplay)) (Money md)
- Stat tile 1 floor caption (only when tightPointGoal !== null): "floor £{tightPointGoal}"
- Stat tile 2 label: "Days this would last"
- Stat tile 2 value: "{coverDisplay.toFixed(1)}d" (Money md)
- Stat tile 2 caption: "£{potsTotal} in pots"
- Melo line — breach: "That drops you below your £{tightPointGoal} floor."
- Melo line — newLow<0 & wouldEatPots: "You'd have to dip into pots — about £{Math.abs(newLow)} from somewhere."
- Melo line — newLow<0 & !wouldEatPots: "This one wouldn't fit. Try a smaller hold."
- Melo line — newLow<50: "This one would press you. Try a smaller hold."
- Melo line — newLow<150: "You'd feel it, but you'd make it."
- Melo line — else: "Plenty of room. Spend if it serves you."
- Primary CTA: "See it on your money path" → nav.go("today")
- Close CTA: "Close — nothing was added" → nav.back
- Back chevron: "←"
- NOTE: none of these are COPY_DECK keys — WhatIf strings are inline + @copy FROZEN, not yet keyed in COPY_DECK.md; RN must add keys.

## tokens

- --paper (screen ground)
- --surface (spend card + 2 stat tiles)
- --inset (stepper button fill)
- --ink (default text, lowest-point dot, payday SVG label)
- --muted-ink (eyebrows, captions, back chevron, calm Melo copy)
- --hairline (card borders + SVG dashed guide path; `hairline` utility)
- --accent (title accent word, Money xl tone, route-draw stroke, payday dot, primary CTA bg)
- --positive (listed in @tokens; not directly applied in body)
- --negative (negative tone on New lowest + Days tiles, breach floor caption)
- --font-display (Fraunces — eyebrow italic, title, SVG labels, Melo italic line)
- radius rounded-2xl (24px) cards/CTA, rounded-full steppers
- literal white #FFFFFF on primary CTA text → --color-primary-foreground

## motions

- count-up — useCountUp(newLow,380) and useCountUp(daysCover,380) drive the two stat-tile figures; duration is 380ms here, NOT the canonical 700ms
- route-draw — accent money path; duration 900ms via inline animationDuration, NOT the canonical 2200ms; replays on every amount change (svg keyed by amount)
- slide-in-r (360ms) — whole-screen forward entrance
- press (120ms scale 0.97) — steppers, both CTAs, back chevron

## moods

- MELO_MOODS: WhatIf exploring = curious. BUT code computes mood dynamically from newLow: breachesGoal||newLow<50 → 'alert'; newLow<150 → 'soft'; else 'calm'. Web kit moods (calm|soft|alert) must be mapped to the 5 canonical moods. RN fidelity choice: keep dynamic severity (copy carries meaning) and/or reconcile with curious baseline — confirm with design. Melo size=28 (default companion), grounded default, not tappable.

## componentTree

<ScrollView contentContainerStyle={px28 pt16} showsVerticalScrollIndicator={false} entering={SlideInRight}>
{/_ Header _/}
<View row spaceBetween alignCenter>
<Pressable onPress={nav.back} hitSlop><Text muted size20>←</Text></Pressable>
<Text eyebrow muted upper tracking>Preview</Text>
<View width20 /> {/_ balance spacer _/}
</View>

{/_ Title _/}
<View mt20>
<Text fontDisplay italic size13 muted>A quiet experiment</Text>
<Text fontDisplay size30 lh1.05 mt4>What if I spend <Text accent>£{amount}</Text> today?</Text>
</View>

{/_ Spend card _/}
<View card surface hairline rounded2xl p20 mt20>
<View row spaceBetween alignCenter>
<Pressable onPress={()=>setAmount(v=>max(0,v-5))} inset hairline round44><Text size20>−</Text></Pressable>
<View center>
<Money value={`£${amount}`} size="xl" tone="accent" />
<Text caption upper tracking mt4>today's spend</Text>
</View>
<Pressable onPress={()=>setAmount(v=>min(500,v+5))} inset hairline round44><Text size20>+</Text></Pressable>
</View>
{/_ mini path — react-native-svg, replay route-draw on amount change _/}
<Svg viewBox="0 0 390 200" width=100% height140 mt16>
<Path d={d} stroke=hairline sw1 dash={[2,4]} />
<Path d={d} stroke=accent sw2.4 round animatedDashoffset />
<Circle cx372 cy50 r5 fill=accent />
<SvgText x350 y40 displayItalic size10 fill=ink>payday</SvgText>
<Circle cx300 cy={dipY} r3.5 fill=ink />
<SvgText x245 y={dipY+18} displayItalic size10 fill=mutedInk>lowest point</SvgText>
</Svg>
</View>

{/_ Stat tiles _/}
<View row gap10 mt16>
<View tile surface hairline rounded2xl px16 py16 flex1>
<Text caption upper tracking>New lowest</Text>
<Money value={formatGBP(round(lowDisplay))} size="md" tone={breachesGoal||newLow<50?"negative":"ink"} />
{tightPointGoal!==null && <Text caption tabular mt4 color={breachesGoal?negative:mutedInk}>floor £{tightPointGoal}</Text>}
</View>
<View tile surface hairline rounded2xl px16 py16 flex1>
<Text caption upper tracking>Days this would last</Text>
<Money value={`${coverDisplay.toFixed(1)}d`} size="md" tone={daysCover<5?"negative":"ink"} />
<Text caption tabular mt4 muted>£{potsTotal} in pots</Text>
</View>
</View>

{/_ Melo line _/}
<View row alignStart gap12 mt20>
<Melo size={28} mood={dynamicMood} />
<Text fontDisplay italic size13 flex1 muted>{meloLine}</Text>
</View>

{/_ CTAs _/}
<Pressable onPress={()=>nav.go("today")} accent rounded2xl h54 mt20 mb12 center><Text white medium size15>See it on your money path</Text></Pressable>
<Pressable onPress={nav.back} h44 mb32 center><Text muted size13>Close — nothing was added</Text></Pressable>
</ScrollView>

## enginesNeeded

- Money path engine (RN, NEW) — supplies the real lowest-to-payday baseline (faked here via pressureLow[pressure]); newLow = baseLow − amount, and the dip shape derives from it. Replace the pressure constant with the engine's current low figure.
- Pot engine / store — potsTotal = sum of pots[].saved (read-only).
- tightPointGoal — set elsewhere (store setTightPointGoal ~line 479); read-only here for breachesGoal.
- daysCover heuristic: max(0, round((newLow/28)\*10)/10) — burn-rate stand-in (28 = days/cycle magic number); RN should source real daily burn from the money-path engine.
- No network, no async, no statement/photo readers — fully synchronous local compute.

## fidelityRisks

- Mood mapping: web kit takes calm|soft|alert; MELO_MOODS canon is calm|curious|cheer|concern|celebrate and says WhatIf=curious. Map the dynamic severity (alert/soft/calm) to canonical moods AND reconcile with the curious baseline; document. Decorative (copy carries meaning) but don't ship an unmapped 'alert'.
- count-up here is 380ms (not 700) and route-draw is 900ms (not 2200). Honor the IN-CODE values — they replay on every stepper tap, so the table defaults would feel laggy.
- SVG path must replay on amount change. Web uses key={amount} on <svg>. In RN, re-trigger animated strokeDashoffset via useEffect keyed on amount (or animate pathLength). dipY = min(190,130+amount\*0.55) shifts the lowest-point dot AND label y — keep both bound to amount.
- Money values never slide — count-up only. Tiles use useCountUp; the center £{amount} uses Money directly (instant, correct — it's the input). Don't animate the stepper value.
- Negative-tone thresholds are load-bearing: New lowest negative when breachesGoal||newLow<50; Days negative when daysCover<5; floor caption negative only on breach. Preserve exactly.
- Clamp/step exact: −5 floored at 0, +5 capped at 500. tightPointGoal===null hides the floor caption (default seed ships null).
- tabular-nums on 'floor £{x}', '£{potsTotal} in pots', both Money figures (fontVariant:['tabular-nums']). 'today's spend' apostrophe — copy verbatim.
- Header w-5 spacer centers the 'Preview' eyebrow between back-chevron and an empty slot; replicate the 3-column balance or the eyebrow drifts.
- wouldEatPots = newLow<0 && potsTotal>=abs(newLow): 'dip into pots' line only when pots can absorb it, else 'wouldn't fit'. Keep the >= direction — easy to invert.
- Primary CTA text is literal white on --accent (= --color-primary-foreground), not --ink. Dark mode warms --accent but foreground stays white — verify contrast.
- @opens-sheet says melo-chat but the body never opens it — do not invent a sheet trigger; only add onTap→openMelo if design confirms tappable Melo here.
- slide-in-r entrance, count-up, route-draw must all collapse to final state under AccessibilityInfo.isReduceMotionEnabled — render resolved values, not a slower tween.
- Empty-state gap: STATES.md requires WhatIf empty = 'Add some moves first'; the component has no empty guard. RN must add an EmptyState when there's no money data to preview.

## stateBranches

- populated (happy path) — the only branch the component implements; renders with whatever pressure/pots/tightPointGoal exist (STATES.md ✅).
- empty — STATES.md 'Add some moves first'; NOT implemented in current body. RN must add an EmptyState (Melo + Fraunces line + one CTA) when no money data. Flag as gap.
- loading — STATES.md 'recompute 400ms'; no spinner — the ~380ms count-up IS the recompute affordance on each amount change. No async loading.
- error — n/a (no async, nothing to fail).
- offline — same as populated (local-first, STATES.md ✅); no network at all.
- Within populated: Melo line + tones fork into 6 verdict bands by newLow (breach / <0 eats-pots / <0 no-fit / <50 / <150 / else) plus tightPointGoal null-vs-set fork for the floor caption — content branches, all must render.

## rnPrimitiveMap

- div.overflow-y-auto.no-scrollbar → ScrollView (showsVerticalScrollIndicator={false}); h-full → flex:1
- button → Pressable + expo-haptics Haptics.selectionAsync() for the `press` feel
- <Money> → <Text style={{fontVariant:['tabular-nums']}}> via RN Money kit (tone→color, size xl/md→fontSize per kit scale)
- <Melo size mood> → react-native-svg + reanimated (5 SVG mood deltas + breathe); map kit calm|soft|alert to canonical moods
- useCountUp(target,380) → reanimated useDerivedValue + withTiming(380) + interpolate, Animated.Text (use 380, not the 700 default)
- formatGBP / Math.round/min/max/abs → pure TS, port as-is
- inline svg/path/circle/text → react-native-svg Svg/Path/Circle/Text; strokeDasharray '2 4' → [2,4]; route-draw via animated strokeDashoffset replayed on amount
- CSS vars → theme object + useTheme(); hairline border → StyleSheet.hairlineWidth
- rounded-2xl/rounded-full → borderRadius 24 / 9999
- tracking-[0.14em] → letterSpacing (em→px at fontSize)
- font-display italic → Fraunces family + fontStyle:'italic'
- nav.go/back (local) → @react-navigation native stack
- slide-in-r class → reanimated entering={SlideInRight} (translateX 28→0, 360ms)
- text-white on accent → theme.primaryForeground (#FFF)

# TodayScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenToday.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenToday.tsx

## rnComponentName

TodayScreen

## purpose

One-screen answer to "will my money last to payday?" — a pressure verdict line, an animated count-up hero number reading "£X spare at its lowest point" with an honest balance-source caption, a scrubbable money-path SVG (drag thumb maps pointer x to an "if you spend £X today" preview), proactive nudges, a 7-day spend strip, recent spend transactions, a 3-band money-path card with coming-in/going-out/lowest summary, a Melo prompt button, and two week tiles. Folds in 4 child components from ./today/ (TodayNudges, TodaySpendStrip, TodayRecentTxns, TodayWeekTiles). Hero, nudges, and path all read the SAME computed tightest-spare so the number, the nudge, and the path never disagree.

## docBlock

/\*\*

- @rn-screen TodayScreen
- @rn-stack MainTabs > Today
- @purpose One-screen answer to "will my money last to payday?" — tight-point number,
-               money-path SVG with scrub preview, proactive nudges, weekly tiles, recent spend.
- @reads nav.pressure (mood band), pots/subs/transactions/onboarding/cycles (via child components)
- @writes —
- @opens-sheet log-spend, melo-chat, onboarding
- @copy FROZEN — every visible string ships verbatim
- @tokens --paper --surface --inset --ink --accent --positive --negative --hairline · Fraunces headlines · tabular money
- @motion route-draw 2.2s · count-up 700ms · pulse-ring 1.8s · callout-in 600ms · press .97/120ms · respects reduce-motion
- @melo-mood derived from nav.pressure via pressureMood
- @notes Path SVG is the hero — scrub thumb maps pointer x → "if you spend £X today" preview.
-               Sub-components live in ./today/ — port each as its own RN component.
  \*/

--- Child component doc blocks (port each as its own RN component) ---

TodayNudges: @rn-component TodayNudges · @parent TodayScreen · @purpose Up to 2 actionable banners: onboarding nudge, proactive Melo line, closed-cycle prompt. · @reads subs, subPaused, onboarding, cycles, transactions, tightPointGoal, nav.pressure · @writes — · @opens-sheet onboarding, melo-chat (via nav.openMelo) · @copy FROZEN · @tokens --accent --accent-soft --surface --ink --muted-ink --hairline · @notes Proactive — never shows more than 2. Order: onboarding > melo > cycles.

TodaySpendStrip: @rn-component TodaySpendStrip · @parent TodayScreen · @purpose Stacked-bar of last-7-day spend by category. Tap → ask Melo where the money went. · @reads transactions (last 7 days, amount < 0) · @writes — · @opens-sheet melo-chat (via nav.openMelo) · @copy FROZEN · @tokens --accent --ink --caution --negative --positive --muted-ink --inset · @notes Hidden when no spend in window. Palette keyed by category enum.

TodayRecentTxns: @rn-component TodayRecentTxns · @parent TodayScreen · @purpose Last 5 spend transactions with merchant, category, relative date, and a remove button. · @reads transactions (amount < 0, newest 5) · @writes removeTransaction(id) — with confirm() · @opens-sheet log-spend (via nav.openSheet) · @copy FROZEN · @tokens --surface --hairline --muted-ink --accent · @notes Confirm dialog is web-only; RN should use Alert.alert.

TodayWeekTiles: @rn-component TodayWeekTiles · @parent TodayScreen · @purpose Two side-by-side tiles: this-week spend vs last-week, and next subscription charge. · @reads transactions (last 14 days), subs, subPaused, nav.pressure (for tight-point fallback) · @writes — · @opens-sheet melo-chat (via nav.openMelo) · navigates to subs · @copy FROZEN · @tokens --surface --hairline --muted-ink --positive --negative · @notes Right tile falls back to tight-point CTA when there's no upcoming renewal.

## reads

- nav.pressure (Pressure: safe|calm|soft|pressured|overspent) — drives mood, line, lowY, route stroke end colour, hero text colour, and fallback tight value via pressureLow
- store.subs
- store.subPaused
- store.subOverrides
- store.onboarding (reads onboarding.done)
- store.calendarEvents
- store.pots (filters perWeek>0 for Friday-dip caption + weeklyPotTotal)
- store.routeFocusDate (Calendar→Route bridge ISO date, consumed once)
- store.currentBalance ({ amount, source }) — hero anchor + source caption
- store.cycles (via TodayNudges)
- store.transactions (TodaySpendStrip last-7d by category; TodayRecentTxns newest-5 spend; TodayWeekTiles this/last-week sums)
- store.tightPointGoal (TodayNudges gap nudge, TodayWeekTiles fallback)
- derived engine: deriveCalendarEvents({subs,subPaused,subOverrides,onboarding,manualEvents:calendarEvents,pots,windowDays:35,now}) → groupByDay → computeSpareAndTightest(groups, currentBalance.amount) → { tightestSpare, tightestDate }
- local state: now (mount-gated Date|null), scrub (0..1), band ('week'|'next'|'payday', default 'payday'), focusX/focusLabel (route-bridge 6s one-shot)

## writes

- setRouteFocusDate(null) — clears the Calendar→Route focus after consuming it (one-shot in useEffect)
- sweepSubOverrides() — called once on mount to expire stale sub-date overrides
- removeTransaction(id) — via TodayRecentTxns × button, guarded by confirm() (RN: Alert.alert)
- Otherwise read-only; every CTA navigates (nav.go) or opens a sheet (nav.openSheet / nav.openMelo)

## opensSheets

- onboarding (via nav.openSheet('onboarding') — header 'Sample numbers' chip + TodayNudges 'Begin')
- log-spend (via nav.openSheet('log-spend') — TodayRecentTxns '+ log a spend')
- melo-chat (via nav.openMelo — header Melo button, TodaySpendStrip, TodayNudges melo nudges, the 'Ask Melo' prompt card, TodayWeekTiles tiles); several pass { prefill } seed text
- ritual screen (nav.go('ritual')) — header 'N days to payday' button (navigation, not a sheet)
- insights screen (nav.go('insights')) — TodayNudges closed-cycle nudge
- subs screen (nav.go('subs')) — TodayWeekTiles next-charge tile

## copyKeys

- today.verdict / pressureLine[pressure]: 'Plenty of room. Breathe.' (safe) | 'You make it to payday.' (calm) | 'Tight — but the path holds.' (soft) | 'The middle of next week is the squeeze.' (pressured) | 'Something has to move. Let’s look together.' (overspent)
- Header date: 'Saturday, 27 June' (literal in prototype; RN derive from now)
- Header: '11 days to payday →' (literal; RN derive)
- aria 'Open Melo'
- Onboarding chip: 'Sample numbers' + 'make them yours →' + aria 'The numbers on this screen are sample data — tap to make them yours'
- Hero: '£{amount} ' + 'spare' (italic) + 'at its lowest point · {formatDayProse(date)}' OR 'at its lowest point' + 'starting from £{currentBalance.amount} · {balanceSourceLabel}'
- balanceSourceLabel: 'you set this' | 'from your last statement' | 'from a statement you added' | 'from a photo you added' | 'you corrected this' | 'sample data'
- Path card: 'Your money path' + activeBand.range ('27 Jun → 3 Jul' | '4 Jul → 10 Jul' | '27 Jun → 25 Jul')
- SVG point labels: 'today','salary rise','bill drop','debt drop','lowest point','payday' and values '£1,240','+£2,180','−£875','−£220',formatGBP(tightestSpare),'+£2,180'
- SVG breathing-room label: 'breathing room · £100'
- SVG idle callout: '7 Jul · £{pressureLow} spare'
- SVG focus callout: 'from Calendar · {focusLabel}'
- aria 'Money path from today to payday — drag to preview a spend'
- Band buttons: 'This week','Next week','To payday'
- Scrub hint: 'if you spend £{round(scrub\*120)} today' / 'drag the line to preview a spend'
- Friday-dip caption: 'Friday dip · {potFirstWord £perWeek joined with +}' + ' · £{total}/wk to your pots' | '/wk to your pot' + glyph '↘'
- Summary trio labels: 'Coming in' £2,180 (positive), 'Going out' £1,095 (negative), 'Lowest' formatGBP(tightestSpare) (ink)
- Melo prompt card: '\"{line}\"' + '2 things still waiting to be checked.' + 'Ask Melo →' (prefill 'Why is my low point £{x} on {date}?' or 'Why is my low point £{x}?')
- TodayNudges: 'Tell Folio your rhythm — 30 seconds, then numbers feel like yours.' + 'Begin'; '{sub} renews in {n} day(s) · £{cost}. Pause for a month?' + 'Pause →' (prefill 'Yes — pause {sub} for a month.'); 'Low point £{x}, your goal is £{goal}. £{gap} to find.' + 'Talk it through →'; '£{spend} out the door in the last 7 days. Want to look at where?' + 'Open →'; '{n} month(s) done · see how they’ve looked' + 'Open'
- TodaySpendStrip: 'This week · £{total}' + 'tap to ask Melo →' + per-cat '{cat} £{v}'; aria 'This week’s spending by category — tap to ask Melo'; prefill 'Where did my money go this week?'
- TodayRecentTxns: 'Recent' + '+ log a spend' + empty 'Nothing logged yet. Tap + above to add one.' + row '{merchant}','{category} · {when}','£{abs}' (when='today'|'yesterday'|'{n}d ago') + remove '×' aria 'Remove {merchant}' + confirm 'Remove {merchant} £{abs}?'
- TodayWeekTiles: 'This week' £{thisWeek} + 'no prior week yet' | '{±}£{delta} vs last' (prefill 'How does my spending this week compare to last week?'); 'Next charge' {sub} '£{cost} · today|in {n}d'; fallback 'Low point' '7 Jul · £{pressureLow}' (prefill 'Why does my low point land at £{x} on 7 Jul?')
- NOTE: COPY_DECK.md banned words — do not introduce import/parse/extract/OCR/sync/dashboard/analytics/smart/100%/bank-grade etc.

## tokens

- --paper
- --surface
- --inset
- --ink
- --muted-ink
- --hairline
- --accent
- --accent-soft
- --positive
- --caution
- --negative
- --shadow-card (path card boxShadow)
- --font-display (Fraunces, italic headlines + hero number)
- --font-sans (Inter Tight, SVG text fontFamily)
- tabular figures (font-variant-numeric: tabular-nums) for all money
- gradient ids routeFill (accent 0.18→0) and routeStroke (ink→accent→positive/negative)

## motions

- route-draw (2200ms ease-out) — the path line, keyed on path `d` so it redraws when the shape changes
- count-up (useCountUp, 400ms here) — hero 'spare' number ticks to target = tightestSpare − round(scrub\*120)
- pulse-ring (1800ms infinite) — lowest-point node halo (point index 4) and the route-focus halo
- callout-in (600ms ease-out, 1.4s delay) — idle lowest-point callout + Calendar focus callout
- press (120ms, scale .97) — every tappable: header buttons, chips, band buttons, nudges, tiles, recent rows, Melo prompt
- slide-in-r (360ms) — screen container entrance (`slide-in-r` class on root)
- Melo breathe/blink (continuous, mood-driven) inside <Melo> instances
- scrub interaction: pointer drag updates thumb at x=30+scrub\*340 and re-targets count-up (not a named motion; reanimated gesture in RN)
- reduce-motion: all the above collapse to final state instantly (web @media; RN AccessibilityInfo.isReduceMotionEnabled)

## moods

- Melo mood = pressureMood[nav.pressure] → 'calm' (safe/calm) | 'soft' (soft) | 'alert' (pressured/overspent)
- NOTE divergence: MELO_MOODS.md spec names moods calm|curious|cheer|concern|celebrate, but the kit's <Melo> here takes calm|soft|alert (pressureMood output). Per MELO_MOODS mapping intent: Today safe→calm, tight→curious, short→concern. RN must reconcile the prop vocabulary (see fidelity risks).
- Header Melo size 22 (inline glyph tier), Melo prompt card size 28 (default companion), TodayNudges melo nudges size 20 — all use the screen mood except TodayNudges which hardcodes mood='soft'

## componentTree

<TodayScreen> = ScrollView (slide-in-r, no scrollbar, h-full)

  <Header row px-7>
    <View><Text font-display italic>Saturday, 27 June</Text><Pressable onPress=nav.go('ritual')><Text>11 days to payday →</Text></Pressable></View>
    <Pressable onPress=nav.openMelo aria='Open Melo' (round surface+hairline)><Melo size=22 mood={mood}/></Pressable>
  {!onboarding.done && <Pressable onPress=openSheet('onboarding') chip><Dot caution/><Text>Sample numbers</Text><Text accent>make them yours →</Text></Pressable>}
  <HeroBlock px-7>
    <Text font-display italic color={overspent?negative:pressured?accent:positive}>{line}</Text>
    <Row baseline><Text font-display tabular 64px>£{round(lowDisplay)}</Text><Text 18px muted italic>spare</Text></Row>
    <Text 12.5 muted>{tightestDate ? 'at its lowest point · '+formatDayProse : 'at its lowest point'}</Text>
    <Text 10.5 muted opacity-70>starting from £{amount} · {balanceSourceLabel}</Text>
  <TodayNudges nav/>          // up to 2 banners, space-y-2, accent|melo|ink variants
  <TodaySpendStrip nav/>     // header row + stacked-bar (flex widths %) + up-to-4 legend chips; null if no spend
  <TodayRecentTxns nav/>     // 'Recent' + '+ log a spend'; empty card OR divided list of 5 rows with × remove
  <PathCard mx-4 surface hairline rounded-2xl shadow-card>
    <Row>'Your money path' + activeBand.range</Row>
    <Svg viewBox 0 0 400 240 onScrub(pointer)>   // RN react-native-svg + Gesture
      <Defs> linearGradient routeFill, routeStroke(offset varies with scrub)
      3× dashed gridlines y=60,120,180
      <Rect breathing-room band y=200 h=20 inset/> + <SvgText>breathing room · £100</SvgText>
      <Path fill=routeFill d=area/> + <Path stroke=routeStroke route-draw key={d}/>
      points.map(<G><Circle node/> {i===4: pulse-ring + accent dot} <SvgText label/></G>)
      {scrub<0.04: idle callout-in callout '7 Jul · £{pressureLow} spare'}
      <G translate(30+scrub*340,30)> scrub thumb: dashed vline + accent circle + white inner</G>
      {focusX!==null: focus callout-in vline + pulse-ring + chip 'from Calendar · {focusLabel}'}
    <BandRow> 3 Pressable pills (active = ink bg / paper text)
    <Text center hint>{scrub>0.02 ? 'if you spend £X today' : 'drag the line to preview a spend'}</Text>
    {activePots.length>0: <FridayDip inset>↘ 'Friday dip · ...'</FridayDip>}
    <SummaryGrid cols-3><Coming in £2,180 positive/><Going out £1,095 negative/><Lowest formatGBP ink/></SummaryGrid>
  <Pressable MeloPrompt onPress=openMelo({prefill}) inset rounded-xl><Melo size=28 mood/><View><Text italic>"{line}"</Text><Row>'2 things still waiting to be checked.' + 'Ask Melo →'</Row></View></Pressable>
  <TodayWeekTiles nav/>      // grid-cols-2: this-week tile + (next-charge tile OR low-point fallback tile)

## enginesNeeded

- Money path / calendar engine: deriveCalendarEvents + groupByDay + computeSpareAndTightest (lib/calendar-events) — deterministic local; computes tightestSpare + tightestDate over a 35-day window anchored on currentBalance.amount
- useCountUp (kit) — animates hero number; RN = reanimated useDerivedValue + interpolate + Animated.Text
- Zustand store (lib/store): useAppStore selectors + setRouteFocusDate, sweepSubOverrides, removeTransaction; RN keeps store, but needs versioned schema/migration per RN_PORT.md (web uses single key folio.state.v1 with ?? fallbacks — not ship-safe)
- formatGBP + formatDayProse formatters (kit / calendar-events)
- pressure constants (types.ts): pressureMood, pressureLine, pressureLow
- Cycle tracker feeds store.cycles (TodayNudges closed-cycle prompt)
- Subscription detector feeds store.subs / subPaused / subOverrides (renewal nudges, next-charge tile, Friday-dip)
- Pot engine feeds store.pots.perWeek (Friday-dip caption)
- NOTE: the path SVG points (today/salary rise/bill drop/debt drop/payday and their £ values) plus the date strings '27 Jun', '7 Jul', summary '£2,180'/'£1,095' are HARDCODED placeholders in the prototype — only the lowest-point value/date and balance source are live. RN must wire these to the real route shape or keep them honest as sample data.

## fidelityRisks

- Pointer scrub → RN Gesture: web reads e.clientX vs SVG getBoundingClientRect for scrub 0..1; RN needs react-native-gesture-handler Pan + onLayout width, mapping translationX→0..1, thumb at x=30+scrub\*340, and re-targeting the count-up. Touch must not scroll the page (touch-none) — disable parent scroll during the gesture.
- Hardcoded vs live data: most path nodes, the '27 Jun'/'11 days'/'7 Jul' dates and '£2,180'/'£1,095'/'£1,240' figures are placeholders; only tightestSpare/tightestDate, balance source, pots Friday-dip, and child-component sums are live. Don't present placeholders as real numbers in ship.
- Melo mood vocabulary mismatch: <Melo> here takes calm|soft|alert (pressureMood) but MELO_MOODS.md spec is calm|curious|cheer|concern|celebrate. Reconcile to the documented set (safe→calm, tight→curious, short→concern) without breaking the kit prop.
- count-up target can go negative (tightestSpare − scrub\*120) and hero floors at Math.round; ensure RN interpolation doesn't show negative/jitter; tightestSpare itself is Math.max(0,...).
- SVG gradient routeStroke offset is animated by scrub (`${60-scrub*30}%`); react-native-svg LinearGradient offsets are strings too but verify dynamic offset updates re-render the gradient.
- route-draw via strokeDasharray:1200/strokeDashoffset — RN needs react-native-svg animated strokeDashoffset (reanimated) keyed on path `d`; pick a dash length >= actual path length or the draw clips.
- Hydration / mount-gate: web defers `new Date()` to a useEffect (now=null until mount) to avoid SSR drift; RN has no SSR but KEEP the gate so the number doesn't flash a fallback before the engine computes (renders pressureLow fallback until now set).
- Calendar→Route bridge is a 6s one-shot with setTimeout cleanup + setRouteFocusDate(null); preserve the clearTimeout on unmount and the consume-once semantics or the pulse re-fires.
- confirm()/window.confirm in TodayRecentTxns is web-only → must become Alert.alert with destructive Remove; typeof window guard is dead code in RN.
- Conditional rendering: TodaySpendStrip and the Friday-dip block return null/hide when empty — these are real state branches (empty), not errors; don't render an empty bar.
- Hairline borders: use StyleSheet.hairlineWidth, not 1px, for the many `hairline` surfaces (path card, tiles, recent list, divide-y rows).
- Tabular money everywhere: apply fontVariant:['tabular-nums'] so the count-up number doesn't shift width as it ticks.
- SVG <text> fontFamily 'Inter Tight' must be the embedded font name in RN react-native-svg Text, or labels fall back and misalign.
- reduce-motion: route-draw/pulse-ring/callout-in/count-up must collapse to final state (AccessibilityInfo.isReduceMotionEnabled), matching the web @media query — don't ship 'calm but on'.

## stateBranches

- populated (happy path): now set, engine returns tightestSpare/tightestDate, hero + path + summary render fully
- empty / onboarding-gate: onboarding.done === false → header 'Sample numbers' chip shows + TodayNudges shows the 'Tell Folio your rhythm' onboarding nudge; balanceSourceLabel reads 'sample data'; numbers are sample
- loading: pre-mount (now === null) → hero falls back to pressureLow[pressure] and tightestDate null ('at its lowest point' with no date); STATES.md marks Today loading as n/a (no spinner) — the mount-gate is the only transient
- error: STATES.md = a non-blocking "couldn't refresh" banner over otherwise-populated content (not implemented in this prototype screen; add as a dismissible banner, never a blank screen)
- offline: STATES.md = same as populated (Folio is local-first; no sync language)
- child empty branches: TodaySpendStrip hidden when no last-7d spend; TodayRecentTxns shows 'Nothing logged yet. Tap + above to add one.' when no spend txns; TodayWeekTiles shows 'no prior week yet' and a low-point fallback tile when no upcoming renewal; TodayNudges renders nothing when 0 nudges; Friday-dip block hidden when no active pots

## rnPrimitiveMap

- root div (overflow-y-auto, slide-in-r) → ScrollView (showsVerticalScrollIndicator={false}) + reanimated entering translateX 28→0 360ms
- button → Pressable + expo-haptics selectionAsync (the `press` 0.97 scale)
- div/span layout → View / Text
- <Melo mood> → react-native-svg + reanimated breathe (lucide not used for Melo per MOTION.md)
- <Money>, hero number, tabular figures → Text with fontVariant:['tabular-nums']
- money-path <svg> → react-native-svg Svg/Path/Circle/Line/Rect/Text/Defs/LinearGradient/Stop/G
- onPointerDown/Move scrub → react-native-gesture-handler Pan + onLayout width
- useCountUp → reanimated useDerivedValue + interpolate (+ Animated.Text)
- CSS vars (--paper etc.) → theme object + useTheme() hook (makeStyles)
- hairline borders → StyleSheet.hairlineWidth
- route-draw / pulse-ring / callout-in → reanimated animated strokeDashoffset / scale+opacity loops / delayed fade
- sheets (onboarding/log-spend/melo-chat) → @gorhom/bottom-sheet BottomSheetModal via nav.openSheet/openMelo
- nav.go(...) → @react-navigation/native (Today tab + stack screens ritual/insights/subs)
- window.confirm → Alert.alert with destructive 'Remove'
- prefers-reduced-motion → AccessibilityInfo.isReduceMotionEnabled
- Fraunces headline / hero → embedded Fraunces font; Inter Tight body + SVG text

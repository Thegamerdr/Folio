# InsightsScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenInsights.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenInsights.tsx

## rnComponentName

InsightsScreen

## purpose

The shape of your months — a retrospective screen reached at More > Insights. Renders 4 summary stat tiles, a 6-month 'lowest balance' tight-point trend chart (route-draw line + dashed average line + per-point dots + labeled last point + 3-letter month axis), a 'Notes from past you' list of the last 4 closed cycles, an optional paused-subs Melo line, and a 'Share this month' CTA that opens the share sheet. Voice is gentle, retrospective, never predictive. Read-only.

## docBlock

@rn-screen    InsightsScreen
@rn-stack     More > Insights
@purpose      The shape of your months — 6-month tight-point chart, saved-across-cycles delta, past cycle notes.
@reads        cycles
@writes       —
@opens-sheet  —
@copy         FROZEN — gentle, retrospective, never predictive.
@tokens       --surface --hairline --accent --positive --muted-ink
@motion       route-draw on chart · count-up on figures · slide-in-r

## reads

- useAppStore: cycles — array of closed cycles, each { label, spare, tightPoint, setAside, note?, closedAt }; cycles[0] = latest, cycles[1] = prior
- useAppStore: pots — array, each { saved } (only .saved summed)
- useAppStore: subPaused — Record<string, boolean> (counts truthy values)
- nav.back — header back arrow
- nav.go — empty-state CTA target 'ritual'
- nav.openSheet — footer CTA target 'share'
- DOC-BLOCK DRIFT: @reads declares only `cycles`, but the implementation also reads `pots` and `subPaused`; the RN port MUST wire all three store slices.

## writes

- — none. Strictly read-only; no store mutations.
- Side effects only via nav: nav.back(); nav.go('ritual') from empty-state CTA; nav.openSheet('share') from footer CTA

## opensSheets

- share

## copyKeys

- Insights (header eyebrow, uppercase, letter-spacing 0.14em)
- {n} month / {n} months done (Fraunces italic eyebrow; singular when cycles.length === 1)
- Nothing wrapped up yet (empty-state Fraunces italic eyebrow)
- The shape of your months. (headline; accent word = 'shape')
- Finish one month first. (EmptyState headline; accent word = 'month')
- At the end of every pay period, Folio walks you through a quiet four-step review. Insights are built from what you keep — so the first one starts here. (EmptyState body)
- Start the review (EmptyState CTA label)
- Saved across all months (stat tile label)
- In pots right now (stat tile label)
- Average low balance (stat tile label)
- Average set aside (stat tile label)
- +£{n} vs {prior.label} / −£{n} vs {prior.label} (spare-delta sub-line; sign flips on >=0, tabular)
- Lowest balance, last {n} (chart title)
- avg £{n} (chart subtitle, tabular)
- Lowest balance trend over your last {n} months (chart SVG aria-label / RN accessibilityLabel)
- £{tightPoint} (SVG label on last data point)
- {c.label}.slice(0,3) (3-letter month tick under chart)
- Notes from past you (section eyebrow, uppercase, tracking 0.16em)
- {c.label} (note row title)
- left over £{c.spare} (note row right value, tabular)
- "{c.note}" (note body, Fraunces italic, wrapped in literal quotes; rendered only when c.note present)
- {n} sub paused — quietly working in your favour. / {n} subs paused — quietly working in your favour. (MeloLine text; singular/plural on pausedCount; rendered only when pausedCount > 0)
- Share this month (footer CTA label)
- FIDELITY/COPY DRIFT: COPY_DECK.md insights.* keys (insights.empty.head 'Close one cycle first.', insights.empty.body, insights.empty.cta 'Open the ritual') DO NOT match the strings hardcoded in this component. Per RN_PORT 'every visible string lives in COPY_DECK', this is a conflict to resolve before porting — the screen ships strings not in the deck. Treat the in-file strings as the visual source of truth but reconcile keys with the owner.

## tokens

- --surface (tile/card/chart backgrounds; non-last dot fill)
- --hairline (1px borders via `hairline` util; chart average dashed line; note-list dividers)
- --accent (headline + EmptyState accent word; chart line stroke; gradient fill; last-point dot)
- --positive (Money tone='positive' on total saved; positive spare-delta text)
- --negative (negative spare-delta text)
- --muted-ink (eyebrows, labels, subtitles, back arrow, axis ticks, note meta)
- --ink (chart non-last dot stroke; last-point SVG text fill; CTA background)
- --paper (footer CTA text color on ink button)
- --inset (EmptyState card background — via kit EmptyState; NOT in doc block @tokens)
- --shadow-card (chart card boxShadow: var(--shadow-card))
- radius 2xl (32px) for tiles/cards/CTA/note list
- font-display = Fraunces (eyebrows, headline, EmptyState headline, note body italic); font-sans = Inter Tight (chart SVG text fontFamily='Inter Tight', body labels); tabular = font-variant tabular-nums (money/delta/avg/left-over)

## motions

- slide-in-r (360ms cubic-bezier(.16,1,.3,1)) — whole screen enters on both empty and populated branches
- route-draw (2200ms ease-out) — the chart line path (className 'route-draw'; strokeDasharray 1200 → strokeDashoffset 0)
- count-up (700ms cubic-out) — Money figures and avg/delta tick up (kit Money; RN via reanimated useDerivedValue)
- press (120ms, scale 0.97 active) — back arrow and footer CTA (RN Pressable + Haptics.selectionAsync)
- pebble-breathe / pebble-blink — only inside Melo (EmptyState Melo mood='curious'; MeloLine Melo mood='cheer'); continuous, the only idle motion
- REDUCED MOTION: all collapse to final resolved state (route-draw → fully drawn, count-up → final value, slide-in-r → no transform). No spinners anywhere.

## moods

- curious — EmptyState Melo (Insights empty per MELO_MOODS: 'Insights empty | curious')
- cheer — MeloLine for paused subs ('quietly working in your favour' small-win line)
- calm — MELO_MOODS lists 'Insights populated | calm', but the populated branch renders NO standalone Melo except the conditional cheer MeloLine; no calm Melo is instantiated. Port should not add a Melo the source omits ('No mood = no Melo').

## stateBranches

- empty — cycles.length === 0: back-header + 'Nothing wrapped up yet' eyebrow + 'The shape of your months.' headline + EmptyState(mood='curious', headline='Finish one month first.', body=..., cta='Start the review' → nav.go('ritual')). No tiles, no chart, no notes, no footer CTA.
- populated — cycles.length > 0: scrollable; header + '{n} months done' eyebrow + headline + 2x2 stat tiles + chart card + 'Notes from past you' (up to 4 cycles) + optional paused-subs MeloLine + 'Share this month' CTA.
- loading — n/a per STATES.md (no async; aggregates derived synchronously). Do not add a spinner.
- error — n/a per STATES.md.
- offline — same as populated (local-first; all data local). No offline-specific chrome.
- Sub-branches inside populated: (a) prior missing (cycles.length < 2) → omit spare-delta sub-line; (b) single point (trend.length===1 / n<=1) → skip area-fill + route-draw line, render only dashed avg line + one dot + label; (c) note absent (c.note falsy) → omit the italic quote line; (d) pausedCount===0 → omit the MeloLine.

## componentTree

<ScreenContainer style={slide-in-r, flex-1, px-7 pt-4}>  // empty branch returns early
  <Header row spaceBetween>
    <Pressable onPress={nav.back} hitSlop press><Text muted size20>←</Text></Pressable>
    <Text eyebrow upper tracking0.14>Insights</Text>
    <View w20 />  // spacer
  </Header>

  {/* EMPTY (cycles.length===0): */}
  <View mt5>
    <Text fontDisplay italic 13 muted>Nothing wrapped up yet</Text>
    <Text fontDisplay 28 lh1.05>The <Accent>shape</Accent> of your months.</Text>
  </View>
  <EmptyState mt6 mood="curious" headline={<>Finish one <Accent>month</Accent> first.</>} body="At the end of every pay period…" cta={{label:'Start the review', onPress:()=>nav.go('ritual')}} />

  {/* POPULATED (ScrollView, no-scrollbar): */}
  <View mt5>
    <Text fontDisplay italic 13 muted>{cycles.length} {month|months} done</Text>
    <Text fontDisplay 28 lh1.05>The <Accent>shape</Accent> of your months.</Text>
  </View>

  <Grid cols2 gap3 mt5>
    <StatTile label="Saved across all months"><Money value={formatGBP(totalSpare)} size=lg tone=positive/>{prior && <DeltaLine +/− £abs(spareDelta) vs prior.label color={positive|negative}/>}</StatTile>
    <StatTile label="In pots right now"><Money value={formatGBP(potsTotal)} size=lg/></StatTile>
    <StatTile label="Average low balance"><Money value={formatGBP(avgTight)} size=lg tone=accent/></StatTile>
    <StatTile label="Average set aside"><Money value={formatGBP(avgSetAside)} size=lg/></StatTile>
  </Grid>

  <Card mt6 p5 shadowCard>
    <Row baseline spaceBetween mb3>
      <Text 11 upper tracking0.12 muted>Lowest balance, last {trend.length}</Text>
      <Text 10.5 muted tabular>avg £{avgTight}</Text>
    </Row>
    <Svg viewBox="0 0 320 96" w=full h=96 accessibilityLabel="Lowest balance trend over your last {n} months">
      <Defs><LinearGradient id=insFill: accent@0.18 → accent@0/></Defs>
      <Line avgY dashed stroke=hairline strokeDasharray="2 4"/>
      {n>1 && <Path d=areaFill fill=url(#insFill)/>}
      {n>1 && <Path d=line stroke=accent sw1.8 round route-draw/>}
      {pts.map(<Circle r={last?3.5:2.4} fill={last?accent:surface} stroke=ink sw={last?0:1.1}/>)}
      {last && <SvgText 9.5 InterTight 600 fill=ink anchor={start|end}>£{last.tightPoint}</SvgText>}
    </Svg>
    <Row mt1 spaceBetween>{trend.map(c=><Text flex1 center truncate 10 muted>{c.label.slice(0,3)}</Text>)}</Row>
  </Card>

  {cycles.length>0 && <View mt5>
    <Text 11 upper tracking0.16 muted mb2 px1>Notes from past you</Text>
    <Card divideY-hairline>{cycles.slice(0,4).map(c=>
      <View px5 py4>
        <Row baseline spaceBetween><Text 14 medium>{c.label}</Text><Text tabular 12 muted>left over £{c.spare}</Text></Row>
        {c.note && <Text 12.5 muted mt1 italic>"{c.note}"</Text>}
      </View>)}
    </Card>
  </View>}

  {pausedCount>0 && <View mt5><MeloLine mood="cheer" text="{n} sub(s) paused — quietly working in your favour."/></View>}

  <View mt5 mb8>
    <Pressable onPress={()=>nav.openSheet('share')} press w-full h12 radius2xl bg-ink>
      <Text paper 13.5 medium>Share this month</Text>
    </Pressable>
  </View>
</ScreenContainer>

## enginesNeeded

- Cycle tracker / Insights engine — supplies the `cycles` array of closed cycles (label, spare, tightPoint, setAside, note, closedAt). Pure presentation over closed-cycle aggregates; cycles must already be closed via the payday ritual.
- Pot engine — supplies pots[].saved for the 'In pots right now' tile (sum of saved).
- Subscription detector / pause state — supplies subPaused map for the paused-subs count and MeloLine.
- Local store (useAppStore / Zustand-equivalent) — read-only selectors for cycles, pots, subPaused.
- Derived in-component (no engine, keep in RN): totalSpare=Σspare; avgTight=round(ΣtightPoint/n); avgSetAside=round(ΣsetAside/n); potsTotal=Σpots.saved; pausedCount=count(truthy subPaused); spareDelta=latest.spare−prior.spare; trend=cycles.slice(0,6).reverse() (oldest→newest).

## rnPrimitiveMap

- div → View; scrollable populated root (overflow-y-auto no-scrollbar) → ScrollView (showsVerticalScrollIndicator={false})
- button (back arrow, footer CTA, EmptyState CTA) → Pressable + expo-haptics Haptics.selectionAsync() for `press`
- span/p/h2/h3 → Text; accent <em class='not-italic'> → nested <Text style={{color: theme.accent, fontStyle:'normal'}}>
- <Money> → kit Money RN port: Text with fontVariant ['tabular-nums'], size map sm/md/lg/xl/hero, tone map ink/positive/negative/muted/accent; value precomputed by formatGBP
- formatGBP(n) → port verbatim: sign '−' (U+2212) for negatives, '£' + Math.abs(n).toLocaleString('en-GB',{maximumFractionDigits:0}); ensure en-GB grouping in Hermes/Intl (polyfill if absent)
- <EmptyState> → kit EmptyState RN port (Melo size 44 + Fraunces headline + body + optional CTA), bg --inset, centered
- <MeloLine> → kit MeloLine RN port (Melo size 28 mood + Fraunces italic copy in quotes)
- <Melo> → react-native-svg + reanimated (5 SVG moods; breathe/blink); used inside EmptyState & MeloLine only
- inline SVG chart → react-native-svg: Svg/Defs/LinearGradient/Stop/Line/Path/Circle/Text; viewBox '0 0 320 96', width '100%' height 96
- route-draw on <Path> → animated strokeDasharray/strokeDashoffset via reanimated (mirror 2.2s ease-out), AnimatedPath
- CSS gradient stop-opacity → <Stop stopColor={accent} stopOpacity={0.18 / 0}>
- tailwind arbitrary text sizes (text-[10.5px] etc.) → explicit StyleSheet fontSize numbers
- letter-spacing tracking-[0.14em] → letterSpacing computed as em*fontSize (RN letterSpacing is points, not em)
- divide-y divide-[var(--hairline)] → render hairline borderBottom (StyleSheet.hairlineWidth) on each row except the last
- hairline util (1px solid) → borderWidth StyleSheet.hairlineWidth + borderColor theme.hairline
- rounded-2xl (32px) → borderRadius 32 (theme radius scale)
- boxShadow var(--shadow-card) → iOS shadowColor/Offset/Opacity/Radius + Android elevation approximating 0 12px 28px -16px rgba(26,24,21,0.12)
- CSS vars (--surface etc.) → theme object + useTheme() hook; NO hardcoded colors
- nav.go/back/openSheet → @react-navigation stack + gorhom bottom-sheet; openSheet('share') opens BottomSheetModal

## fidelityRisks

- COPY DRIFT: in-file empty-state strings ('Nothing wrapped up yet', 'Finish one month first.', 'Start the review', body) do NOT match COPY_DECK insights.empty.* ('Close one cycle first.', 'Open the ritual', different body). RN_PORT requires every visible string to live in COPY_DECK — reconcile keys before porting; do not silently pick one.
- DOC-BLOCK DRIFT: @reads says only `cycles` but code reads cycles + pots + subPaused; @tokens omits --inset (EmptyState), --negative (delta), --ink/--paper (CTA, dot stroke, SVG text). Wire the real reads/tokens, not the doc block.
- SVG chart math must port exactly: W=320 H=96 padX=12 padY=14; stepX=(W-2*padX)/(n-1) when n>1 else 0; minT=min(...tightPoint,0); maxT=max(...tightPoint,1); range=max(1,maxT-minT); y=padY+(H-2*padY)*(1-(t-minT)/range); avgY likewise with avgTight; last-point label x=min(W-4,last.x+6), y=max(10,last.y-6), textAnchor='end' when last.x>W-40 else 'start'. Rounding drift visibly distorts the line.
- Single-point case (n<=1): area-fill path AND route-draw line path are both omitted; only dashed avg line + one dot + label render. Easy to wrongly draw a degenerate line.
- Negative-sign glyph: formatGBP and the delta use U+2212 MINUS '−', not ASCII '-'. Tabular alignment depends on it; keep the exact glyph.
- tabular-nums must be applied to every money/delta/avg/left-over Text via fontVariant — money 'never reads as 12.3K'; missing it breaks the money-is-money rule.
- Accent word is upright inside a Fraunces italic context (web uses em.not-italic): RN accent Text must force fontStyle:'normal' while the surrounding headline/eyebrow may be italic.
- route-draw is one-shot per visit, NOT a loop; under reduced motion render fully drawn (strokeDashoffset 0) and count-up shows final values — STATES/MOTION forbid spinners and 'calm but on' motion.
- letterSpacing: web tracking is em-relative; RN letterSpacing is points — multiply by fontSize per label or uppercase eyebrows look wrong.
- Three different windows over the same array: notes list max 4 (slice(0,4)); chart max 6 (slice(0,6).reverse()); summary tiles aggregate ALL cycles. Do not unify them.
- Melo presence: populated branch instantiates Melo ONLY via the conditional cheer MeloLine; MELO_MOODS 'Insights populated | calm' refers to room tone, not a rendered calm Melo. Do not add a standalone calm Melo ('No mood = no Melo').
- Chart card is the only element with a shadow (shadow-card); tiles use hairline only. Don't apply elevation uniformly — preserve the depth hierarchy.
- Plural handling is inline ('month'/'months', 'sub'/'subs'); per COPY_DECK localization note RN should use ICU MessageFormat keys rather than string concatenation when these strings move into the deck.


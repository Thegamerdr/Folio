# RecoveryScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenRecovery.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenRecovery.tsx

## rnComponentName

RecoveryScreen

## purpose

"Something has to move." Guided, non-blaming triage when the projection is overspent. Renders the current shortfall, lets the user pick exactly ONE corrective move (move a bill / pause a sub / hold spending), live-previews the after-move balance, offers a Melo talk-through escape hatch, then "Rebuild the plan" (sets pressure=soft and routes to today-after). "Not now" backs out. Note: the screen is currently a static/mocked surface — moves and shortfall are hardcoded, no store data is read, and no store mutations fire.

## docBlock

@rn-screen    RecoveryScreen
@rn-stack     More > Recovery
@purpose      "Something has to move" — guided triage when projection is overspent.
@reads        subs, pots, tightPointGoal
@writes       togglePaused, addToPot (via suggested moves)
@opens-sheet  melo-chat
@copy         FROZEN — empathetic, never blaming.
@tokens       --negative --accent --surface --hairline
@motion       slide-in-r · press

## reads

- DOC-BLOCK DECLARED (not honored): subs, pots, tightPointGoal — none are actually read; the @/lib/store import is entirely dead in this component
- nav.pressure: available on Nav but unused here
- LOCAL STATE: picked (string | null) via useState
- HARDCODED: moves[] — 3 Move objects {id,title,delta,deltaValue,kind,body,cost?,melo}
- HARDCODED: shortfall = 94
- DERIVED: pickedMove = moves.find(m => m.id === picked)
- DERIVED: after = pickedMove ? Math.max(-shortfall + pickedMove.deltaValue, -shortfall) : -shortfall

## writes

- DOC-BLOCK DECLARED (not honored): togglePaused, addToPot via suggested moves — NEITHER is wired in the current implementation
- setPicked(active ? null : m.id): local toggle when a move card is tapped
- nav.setPressure('soft') then nav.go('today-after'): the 'Rebuild the plan' CTA (only enabled when picked)
- nav.openMelo({ prefill: "I'm short to payday. Help me think this through." }): the talk-through link
- nav.back(): back arrow and 'Not now'

## opensSheets

- melo-chat

## copyKeys

- INLINE-HARDCODED — does NOT read COPY_DECK keys (contract violation; see fidelityRisks). Strings below are verbatim from source.
- Recovery
- It happens. Let's repair calmly.
- Something has to move. (accent em on 'move.')
- After this move
- Shortfall
- +£{n} / −£{n} (Money value, e.g. −£94, +£24)
- you reach payday with room
- still £{n} short — try another move
- to reach payday with room
- Pick one thing
- Move a bill
- +£118 this week
- Move Octopus to the 12th
- Pushes Octopus from the 7th to the 12th. Lands two days after payday instead of two before.
- no fee · supplier allows it
- Quietest move. Same money, kinder timing.
- Pause a sub
- +£12 this month
- Pause Disney+ for a month
- Nothing comes out of your account for one month. Resumes automatically unless you cancel.
- 0 plays in 6 weeks · low-cost to pause
- Small experiment. You can resume any time.
- Set a hold
- +£60 estimated
- Hold spending for 3 days
- Bills and recurring still pay. Discretionary spend goes on a soft pause — you'll see a gentle nudge if you try.
- based on your average daily discretionary
- Three calm days. Not punishment, just space.
- Not sure? Talk it through with Melo →
- No shame here. One small move can rebuild the week. (default Melo line when no move picked, shown in quotes)
- {pickedMove.melo} (shown in quotes when a move is picked)
- Rebuild the plan
- Not now
- RELATED COPY_DECK BLOCK (conceptual, not used): short.head 'Short by {amount}.', short.body, short.move.pause/pot/cap, short.refuse 'Leave it for now'

## tokens

- --muted-ink
- --accent
- --accent-soft
- --surface
- --ink
- --positive
- --negative (declared in doc block; used via Money tone='negative')
- --hairline (via 'hairline' utility = 1px solid var(--hairline))
- --font-display (Fraunces, via font-display class)
- tabular (font-variant-numeric: tabular-nums)
- radius rounded-2xl = 32px (--radius-2xl)

## motions

- slide-in-r (screen container entrance, 360ms cubic-bezier(.16,1,.3,1))
- press (all tappable elements scale 0.97 on press, 120ms)
- fade-in (expanded move-card body/cost reveal, 220ms)
- count-up (IMPLIED for the after/shortfall Money figure per MOTION rule 'money values never slide'; current web Money does NOT animate here — RN should add count-up on the after value)

## moods

- concern (canonical mood for the Shortfall/Recovery screen per MELO_MOODS.md — 'Careful, not alarmed')
- NOTE: source passes kit-internal mood aliases, NOT canonical names: header Melo size=56 mood = after>=0 ? 'soft' : 'alert' (intensity 1.1); footer Melo size=28 mood='soft'
- Map for RN: 'alert' -> concern, 'soft' -> calm/soft. When after>=0 (move closes the gap) Melo softens; when still short, Melo shows concern

## componentTree

<RecoveryScreen> (ScrollView, h-full flex col, px-7 pt-4, slide-in-r entrance)
  <HeaderRow>
    <BackButton onPress={nav.back}>←</BackButton>   {/* press, --muted-ink, 20px */}
    <Eyebrow>Recovery</Eyebrow>                      {/* 12px uppercase tracking .14em --muted-ink */}
    <Spacer w=20 />
  </HeaderRow>
  <TitleBlock mt-5>
    <Text font-display italic 13px muted>It happens. Let's repair calmly.</Text>
    <Heading font-display 30px lh1.05>Something has <Accent not-italic --accent>move.</Accent></Heading>
  </TitleBlock>
  <ShortfallCard mt-5 surface hairline rounded-2xl p-5 row gap-4>
    <Melo size={56} mood={after>=0?'soft':'alert'} intensity={1.1} />
    <Col flex-1>
      <Label 11px uppercase muted>{pickedMove ? 'After this move' : 'Shortfall'}</Label>
      <Money value={`${after>=0?'+':'−'}£${Math.abs(after)}`} size="lg" tone={after>=0?'positive':'negative'} />
      <SubLine 11.5px muted font-display italic>{conditional caption}</SubLine>
    </Col>
  </ShortfallCard>
  <SectionLabel mt-5 11px uppercase muted>Pick one thing</SectionLabel>
  <MoveList mt-2 gap-2.5>
    {moves.map(m => (
      <MoveCard key={m.id} onPress={()=>setPicked(active?null:m.id)}
                style={active ? accent-soft + ring-1 ring-accent/40 : surface} hairline rounded-2xl px-5 py-4 press>
        <Row baseline justify-between>
          <Kind 10.5px uppercase muted>{m.kind}</Kind>
          <Delta 12px tabular color={active?--accent:--positive}>{m.delta}</Delta>
        </Row>
        <TitleText 14.5px medium mt-0.5>{m.title}</TitleText>
        {active && (
          <ExpandedBody fade-in mt-2 gap-1.5>
            <Body 12.5px ink/85 leading-relaxed>{m.body}</Body>
            {m.cost && <Cost 11px muted>{m.cost}</Cost>}
          </ExpandedBody>
        )}
      </MoveCard>
    ))}
  </MoveList>
  <MeloTalkLink mt-3 press 12px muted underline onPress={()=>nav.openMelo({prefill:...})}>
    Not sure? Talk it through with Melo →
  </MeloTalkLink>
  <MeloAside mt-4 row items-start gap-3>
    <Melo size={28} mood="soft" />
    <AsideText 13px font-display italic muted flex-1>"{pickedMove?.melo ?? defaultLine}"</AsideText>
  </MeloAside>
  <PrimaryCTA mt-5 mb-3 h-54 rounded-2xl text-white 15px medium press
              disabled={!picked} bg={picked?--accent:--muted-ink/30}
              onPress={()=>{nav.setPressure('soft'); nav.go('today-after');}}>
    Rebuild the plan
  </PrimaryCTA>
  <SecondaryCTA mb-8 h-44 13px muted press onPress={nav.back}>Not now</SecondaryCTA>
</RecoveryScreen>

## enginesNeeded

- Money path engine: the REAL source for shortfall (currently hardcoded 94) and for each move's deltaValue / after-move projection — RecoveryScreen is the consumer of an overspent verdict
- Subscription detector + store (subs): to populate real 'Pause a sub' moves (named sub, real monthly amount, usage like '0 plays in 6 weeks')
- Bill schedule / cycle tracker: to populate real 'Move a bill' moves (supplier, current date vs payday, fee/allowed flag)
- Discretionary-average estimator: to compute the 'Hold spending' move's +£ estimate ('based on your average daily discretionary')
- togglePaused store action: to actually pause the chosen sub on Rebuild
- addToPot / move-execution store action: to actually apply the chosen move on Rebuild
- Pot engine (pots): declared read; for borrow-from-pot style moves (cf. COPY_DECK short.move.pot, not currently surfaced here)
- Melo chat (melo-chat sheet) with prefill seeding

## rnPrimitiveMap

- root <div ScrollView no-scrollbar> -> <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle>
- <button> (back, move cards, links, CTAs) -> <Pressable> + expo-haptics Haptics.selectionAsync() for the 'press' feel
- <Melo mood pose intensity grounded onTap> -> react-native-svg + reanimated breathe; keep the kit's mood-alias mapping (soft/alert -> canonical), DO NOT pass tabular className
- <Money tabular> -> <Text style={{ fontVariant: ['tabular-nums'] }}>
- font-display (Fraunces italic) -> embedded Fraunces font, fontStyle:'italic'
- CSS tokens (--accent, --surface, --muted-ink, --accent-soft, --positive, --negative, --ink) -> theme object + useTheme()
- hairline utility (1px solid --hairline) -> borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline
- ring-1 ring-accent/40 (active card) -> borderColor accent at ~40% alpha (no RN box-shadow ring; use border or a subtle shadow)
- --accent/40 alpha, ink/85, muted-ink/30 -> precomputed rgba in theme (RN has no '/opacity' utility)
- tracking-[0.14em] / uppercase -> letterSpacing (px) + textTransform:'uppercase' (RN letterSpacing is absolute px, not em — convert)
- leading-[1.05] / leading-relaxed -> lineHeight as absolute px
- slide-in-r -> reanimated withTiming(translateX 28->0, 360ms) + opacity
- fade-in (expanded body) -> reanimated/LayoutAnimation fade 220ms
- → arrow & − minus sign (U+2212) -> keep exact glyphs in <Text>
- nav.go / nav.back / nav.openSheet -> @react-navigation stack + a bottom-sheet (gorhom) for melo-chat
- disabled CTA color swap -> conditional style; also set accessibilityState={{disabled:!picked}}

## stateBranches

- populated (only designed state per STATES.md: Recovery = ✅ populated, no empty/loading/error rows): shortfall shown, 3 moves selectable
- sub-state: no move picked -> label 'Shortfall', value −£94 negative tone, caption 'to reach payday with room', Melo alert, default Melo line, CTA disabled
- sub-state: move picked, still short (after<0) -> label 'After this move', negative tone, caption 'still £{n} short — try another move', Melo alert, picked move's Melo line, CTA enabled
- sub-state: move picked, reaches room (after>=0) -> label 'After this move', value '+£{n}' positive tone, caption 'you reach payday with room', Melo soft, CTA enabled
- offline: ✅ same as populated (local-first; no network branch)
- empty/loading/error: n/a for this screen (matrix), BUT in real RN this screen is only reached from an overspent verdict; if shortfall data is missing it should fall back to Today, not render a blank Recovery

## fidelityRisks

- COPY CONTRACT VIOLATION: every string is inline-hardcoded; COPY_DECK.md says 'if a string isn't here, it doesn't ship'. RN port must key these (Shortfall-moment block + new Recovery keys) and not concatenate. Also check banned words — 'discretionary'/'recurring' are fine, but audit before keying.
- STORE DRIFT: doc block @reads subs/pots/tightPointGoal and @writes togglePaused/addToPot, but the implementation reads/writes NONE of them (store import is dead). RN must actually wire the engine; do not copy the mock's disconnected behavior.
- HARDCODED DATA: moves[] (Octopus/Disney+ specifics, £118/£12/£60) and shortfall=94 are demo fixtures. RN must derive from the money-path/subs/bill engines — never ship the fixtures.
- MOOD ALIAS TRAP: source uses kit-internal mood values 'soft'/'alert' + intensity, NOT the five canonical MELO_MOODS names. Recovery's canonical mood is 'concern'. Preserve the after>=0 softening logic but map to canonical moods correctly so it isn't alarming (no red/shake per MELO_MOODS).
- MONEY MOTION: MOTION.md says money values must count-up, never slide. The after/shortfall figure currently swaps instantly on pick; RN should count-up between values on each selection change.
- SINGLE-SELECT SEMANTICS: tapping the active card deselects (picked->null), disabling the CTA. Preserve exact toggle; expose accessibilityRole='radio' + accessibilityState selected for the move group.
- letterSpacing/lineHeight UNIT CONVERSION: web uses em tracking and unitless leading; RN needs absolute px — recompute per font size or hierarchy reads wrong.
- RING/ALPHA FIDELITY: active card uses ring-1 ring-accent/40 + accent-soft bg; RN has no ring utility — emulate with border + bg, not a drop shadow, to keep the flat paper look.
- '−' is U+2212 MINUS SIGN (not hyphen) in the Money value and cost lines — keep the exact glyph for tabular alignment.
- REDUCED MOTION: slide-in-r/fade-in/count-up must collapse to final state instantly under AccessibilityInfo.isReduceMotionEnabled (MOTION rule: reduced motion = final state, not slower).
- CTA disabled affordance: web only changes bg color; ensure RN also blocks the press and sets accessibility disabled state, otherwise it looks tappable.
- 'Rebuild the plan' performs TWO side effects in order (setPressure('soft') THEN go('today-after')); today-after expects the 'soft' pressure to drive its route re-draw — preserve ordering.


# PotsScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPots.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPots.tsx

## rnComponentName

PotsScreen

## purpose

Set-aside pots screen. Shows an "Across pots" aggregate progress card, a list of pot cards (each with a progress bar, pace/ETA line, and +£5/+£10/+£20 quick-add buttons), an "Open a pot" CTA, and a closing MeloLine. Web drag-reorder/drag-onto-another-pot triggers an inline Reallocate transfer sheet that moves money between pots with a live amount slider and a tight-point ("Lowest balance") preview. Empty state invites starting the first pot. Doc block @purpose: "Set-aside pots — drag-reorder, +£5/+£10/+£20 quick-add per pot."

## docBlock

/\*\*

- @rn-screen PotsScreen
- @rn-stack MainTabs > Pots
- @purpose Set-aside pots — drag-reorder, +£5/+£10/+£20 quick-add per pot.
- @reads pots
- @writes setPots, addToPot
- @opens-sheet —
- @copy FROZEN
- @tokens --surface --hairline --accent --positive
- @motion count-up on saved figure · press · slide-in-r
  \*/

## reads

- store: pots (useAppStore((s) => s.pots) as Pot[]; Pot = { id, name, saved, goal, perWeek, accent })
- nav.pressure (Pressure enum) — used to index pressureLow[] for the transfer-sheet 'Lowest balance' base figure
- pressureLow constant (types.ts): safe 612, calm 325, soft 184, pressured 42, overspent -86
- local UI state: dragFrom (string|null), hoverTo (string|null), transfer ({from,to}|null), amount (number, default 20)

## writes

- storeSetPots (store.setPots, alias) — called in commit() to move 'clamped' £ from transfer.from pot to transfer.to pot (immutable map over pots)
- addToPot(p.id, inc) — store action called by each +£5/+£10/+£20 quick-add button; also appends a potLedger deposit entry (source 'manual')
- nav.back — back button (left arrow) in header
- nav.go('ritual') — empty-state CTA 'Start a pot' AND the populated-state '+ Open a pot' button (both route to the ritual screen which hosts pot creation)
- local setters: setDragFrom, setHoverTo, setTransfer, setAmount

## opensSheets

- NONE via nav.openSheet. The Reallocate/transfer 'sheet' is an INLINE absolute-positioned overlay rendered within ScreenPots (scrim + bottom sheet), NOT the shared <Sheet>/SheetId system. @opens-sheet doc field is '—'. In RN this inline overlay should become a @gorhom/bottom-sheet BottomSheetModal (a NEW transfer/reallocate sheet, owned by this screen).

## copyKeys

- COPY_DECK key pots.title = "Pots" (header eyebrow, uppercase tracked)
- COPY_DECK key pots.empty.head = "No pots **yet.**" — NOTE: component currently renders inline JSX 'No <em>pots</em> yet.' (matches key) AND an inline empty body that DOES NOT match pots.empty.body in the deck
- COPY_DECK key pots.empty.body = "A pot is money set aside for one thing. Holiday, buffer, vet bill." — component instead shows: "A pot is a small set-aside for one thing — a holiday, a buffer, Christmas. Add the first one and Folio will quietly set it aside from what's left over." (FIDELITY MISMATCH — RN must reconcile to the deck)
- COPY_DECK key pots.empty.cta = "Start a pot" — component empty-state CTA uses literal "Start a pot" (matches)
- Inline strings NOT yet keyed in COPY_DECK (must be added before ship): "Set aside" (italic eyebrow, empty + populated)
- "Small, calmly, on purpose." (display H2, accent word = 'calmly')
- "Drag one pot onto another to move money between them." (subhead, populated only)
- "Across pots" (aggregate card label)
- "£{total} of £{totalGoal}" (aggregate figure; total = count-up)
- Per pot: pot.name; "£{saved} / £{goal}"; "£{perWeek}/wk at this pace"; "about {weeksLeft} weeks" OR "goal met"
- Quick-add chip labels: "+£5", "+£10", "+£20"
- "+ Open a pot" (primary CTA)
- MeloLine text: "Pots quietly chip away at what's left — that's the idea." (mood='soft')
- Transfer sheet: "Reallocate" (eyebrow); "{fromName} → {toName}" (title, names split on ' · ' taking [0]); "Amount"; "max £{maxMove}"; "£{clamped}" (big accent figure); "Lowest balance"; "£{tightPointBase}" + signed "+£{tightDelta}"/"£{tightDelta}"; "{toName}" + "£{toSaved} +£{clamped}"; "Cancel"; "Move £{clamped}"

## tokens

- --surface (pot cards, aggregate card, transfer summary row bg)
- --hairline (hairline 1px borders → StyleSheet.hairlineWidth; also the sheet grab handle bg)
- --accent (#E0633A: accent-pot bars, drop-target ring, big transfer figure, +Open-a-pot button bg+shadow, Move button bg)
- --accent-soft (#F5E4DB: drop-target card bg highlight)
- --positive (#3E8E5A: '+£' delta on tight point + on destination pot)
- --negative (#C5503E: negative tight delta)
- --inset (#FCFBF7: progress-bar track, quick-add chip bg, transfer amount block bg, Cancel button bg)
- --ink (#1A1815: aggregate progress bar fill; non-accent pot bar uses ink/70; sheet scrim uses ink/40)
- --muted-ink (#6B6760: eyebrows, labels, /goal denominator, pace line, drag-handle glyph; disabled Move button uses muted-ink/30)
- --paper (#F7F6F1: transfer sheet bg)
- --shadow-sheet (transfer sheet shadow)
- font-display = Fraunces (headlines, figures, MeloLine italic)
- font-sans = Inter Tight (body/labels)
- tabular = font-variant-numeric tabular-nums (every money figure)
- radii: rounded-2xl=24px (cards/buttons), rounded-t-[28px] (sheet top), rounded-xl=12px (summary row), rounded-full (bars/chips), custom hardcoded boxShadow on CTA: 0 12px 24px -10px rgba(224,99,58,0.55)

## motions

- count-up
- press
- slide-in-r
- sheet-rise/sheet-in
- scrim-in
- progress-bar width tween (700ms aggregate, 500ms per-pot)

## moods

- soft — MeloLine at bottom uses mood='soft' (normalizes to 'calm' Melo expression via normalizeMood; soft|alert are pressure-derived inputs that map down to calm|concern)
- curious — EmptyState mood='curious' (Melo looking, gently). Matches MELO_MOODS 'Pots empty' = calm in the map, but the component literally passes 'curious' to EmptyState (default). FIDELITY NOTE: MELO_MOODS.md lists Pots empty = calm and Pots populated = calm; the only populated-Melo here is the 'soft'→calm MeloLine, which agrees; the empty-state 'curious' is a deviation from the mood map.
- Pot fund sheet mood per MELO_MOODS = curious — but the inline transfer sheet here renders NO Melo at all (no mood shown). If RN adds Melo to the reallocate sheet, use curious.

## componentTree

<![CDATA[
// EMPTY BRANCH (pots.length === 0)
<Screen entering={SlideInRight}> {/* px-7 pt-4, slide-in-r */}
  <Header row spaceBetween>
    <BackButton onPress={nav.back}>←</BackButton>     {/* press */}
    <Eyebrow>Pots</Eyebrow>                            {/* uppercase tracked, muted */}
    <Spacer w={20}/>
  </Header>
  <View mt={20}>
    <DisplayItalic muted>Set aside</DisplayItalic>
    <DisplayH2>Small, <Accent>calmly</Accent>, on purpose.</DisplayH2>
  </View>
  <EmptyState
    mood="curious"
    headline={<>No <Accent>pots</Accent> yet.</>}
    body="A pot is a small set-aside for one thing — a holiday, a buffer, Christmas. Add the first one and Folio will quietly set it aside from what's left over."
    cta={{ label: "Start a pot", onPress: () => nav.go("ritual") }}
  />
</Screen>

// POPULATED BRANCH
<ScrollScreen entering={SlideInRight}> {/* px-7 pt-4, no-scrollbar */}
  <Header row spaceBetween>
    <BackButton onPress={nav.back}>←</BackButton>
    <Eyebrow>Pots</Eyebrow>
    <Spacer w={20}/>
  </Header>

  <View mt={20}>
    <DisplayItalic muted>Set aside</DisplayItalic>
    <DisplayH2>Small, <Accent>calmly</Accent>, on purpose.</DisplayH2>
    <Caption muted>Drag one pot onto another to move money between them.</Caption>
  </View>

  <Card surface hairline rounded2xl p20>            {/* Across pots aggregate */}
    <Label muted upper>Across pots</Label>
    <Row baseline gap8>
      <DisplayFig40 tabular>£{Math.round(totalDisplay)}</DisplayFig40>   {/* count-up */}
      <DisplayFig14 muted tabular>of £{totalGoal}</DisplayFig14>
    </Row>
    <ProgressTrack inset h6>
      <ProgressFill ink width={(total/totalGoal)*100 + "%"} tween={700}/>
    </ProgressTrack>
  </Card>

  <View mt16 gap12>
    {pots.map(p => (
      <PotCard key={p.id} surface hairline rounded2xl
               draggable /* web */ dropTargetHighlight={isDropTarget}>
        <Row baseline spaceBetween>
          <Row center gap8>
            <DragHandleGlyph muted>⋮⋮</DragHandleGlyph>
            <PotName medium>{p.name}</PotName>
          </Row>
          <Fig tabular>£{p.saved} <Muted>/ £{p.goal}</Muted></Fig>
        </Row>
        <ProgressTrack inset h5>
          <ProgressFill color={p.accent ? accent : ink70}
                        width={(p.saved/p.goal)*100 + "%"} tween={500}/>
        </ProgressTrack>
        <Row spaceBetween muted small>
          <Text>£{p.perWeek}/wk at this pace</Text>
          <Text tabular>{weeksLeft>0 ? `about ${weeksLeft} weeks` : "goal met"}</Text>
        </Row>
        <Row gap6 onStartShouldSetResponderCapture /* stopPropagation equiv */>
          {[5,10,20].map(inc => (
            <Chip key={inc} press inset onPress={() => addToPot(p.id, inc)}>+£{inc}</Chip>
          ))}
        </Row>
      </PotCard>
    ))}
  </View>

  <PrimaryButton press accent h52 rounded2xl shadow
                 onPress={() => nav.go("ritual")}>+ Open a pot</PrimaryButton>

  <MeloLine mt20 mb32 mood="soft"
            text="Pots quietly chip away at what's left — that's the idea." />

  {/* INLINE TRANSFER OVERLAY → RN BottomSheetModal */}
  {transfer && fromPot && toPot && (
    <Overlay>                                          {/* absolute inset-0 z-30 */}
      <Scrim ink40 entering={ScrimIn} onPress={() => setTransfer(null)} />
      <Sheet paper rounded-t28 p24 entering={SheetRise} shadow={shadowSheet}>
        <GrabHandle hairline/>
        <DisplayItalic muted>Reallocate</DisplayItalic>
        <DisplayH3>{fromName0} → {toName0}</DisplayH3>      {/* names split on ' · '[0] */}

        <Block inset rounded2xl p20>
          <Row baseline spaceBetween>
            <Label muted upper>Amount</Label>
            <Text muted tabular>max £{maxMove}</Text>
          </Row>
          <DisplayFig44 accent tabular>£{clamped}</DisplayFig44>
          <Slider min={0} max={maxMove} step={5} value={clamped}
                  onValueChange={v => setAmount(v)} minimumTrackTintColor={accent}/>
        </Block>

        <Row surface hairline roundedXl p mt16 spaceBetween>
          <Col>
            <Label muted upper>Lowest balance</Label>
            <Fig16 tabular>£{tightPointBase}
              {tightDelta!==0 && <DeltaText positive={tightDelta>0}>{signed}£{tightDelta}</DeltaText>}
            </Fig16>
          </Col>
          <Col right>
            <Label muted upper>{toName0}</Label>
            <Fig16 tabular>£{toPot.saved} <Positive>+£{clamped}</Positive></Fig16>
          </Col>
        </Row>

        <Row mt20 grid2 gap10>
          <SecondaryButton press inset h50 onPress={() => setTransfer(null)}>Cancel</SecondaryButton>
          <PrimaryButton press h50 disabled={clamped<=0}
                         bg={clamped>0 ? accent : mutedInk30}
                         onPress={commit}>Move £{clamped}</PrimaryButton>
        </Row>
      </Sheet>
    </Overlay>
  )}
</ScrollScreen>
]]>

## enginesNeeded

- Pot engine (RN_PORT: 'Allocations, weekly transfers, goal tracking — pure local logic'). This screen surfaces it: saved/goal/perWeek per pot, weeksLeft = ceil(max(0, goal-saved)/perWeek), aggregate total/totalGoal, and the reallocate transfer (move clamped £ from→to).
- Store reads/writes only — no network. Pots seeded in store DEFAULTS (holiday/buffer/christmas). addToPot writes a potLedger deposit entry too.
- Tight-point / money-path preview: the transfer sheet's 'Lowest balance' uses pressureLow[nav.pressure] as a STATIC base and a HEURISTIC tightDelta (= round(clamped\*0.6) when moving into 'buffer', negative when moving out of 'buffer', else 0; comment in source: 'Rough preview only'). RN must replace this stub with the real money-path engine's lowest-balance recompute, or keep it explicitly labelled as a rough preview.
- useCountUp (kit) → RN reanimated useDerivedValue + interpolate for the aggregate figure.

## fidelityRisks

- DRAG INTERACTION: web uses native HTML5 drag-and-drop (draggable, onDragStart/Over/Leave/Drop, dataTransfer) for BOTH the implied reorder and the 'drop pot A onto pot B → open transfer sheet' gesture. RN has no HTML5 DnD — must rebuild with react-native-gesture-handler + reanimated (long-press drag, e.g. react-native-draggable-flatlist) OR replace the drag-to-transfer with an explicit affordance (tap pot → 'Move money' action). The drop-target ring/accent-soft highlight and isDragging opacity/scale must be re-derived from gesture state.
- @rn-screen doc says @writes setPots, addToPot and the drag enables reorder, but the CODE never actually persists a reorder — onDrop only opens the transfer sheet; there is no reorder commit. Don't invent reorder persistence that isn't in the source unless intentionally adding it (then it needs setPots(reordered)).
- stopPropagation: the quick-add row uses onPointerDown stopPropagation and each chip uses onClick stopPropagation so taps don't start a drag. RN gesture system needs equivalent (responder capture / simultaneousHandlers / disallowInterruption) so chip taps don't trigger the drag handler.
- COPY MISMATCH: empty-state body in code differs from COPY_DECK pots.empty.body. Reconcile to the deck (deck is source of truth). Also several visible strings (Set aside, Small calmly on purpose, Drag one pot…, Across pots, +Open a pot, the MeloLine, and ALL transfer-sheet strings) are NOT yet keyed in COPY_DECK — add keys before ship (deck rule: 'if a string isn't here, it doesn't ship').
- MOOD MISMATCH: EmptyState renders mood='curious' but MELO_MOODS.md lists Pots empty = calm. Decide which wins; map says calm.
- Transfer sheet shows NO Melo, but MELO_MOODS lists 'Pot fund sheet' = curious — if RN adds Melo to reallocate, use curious.
- Slider: web <input type=range step=5 accent-color>. RN @react-native-community/slider needs step=5 emulation (or quantize onValueChange), accent tint, and the value must be the CLAMPED value (value={clamped}), with onChange writing raw setAmount(parseInt). maxMove can be 0 (empty 'from' pot) — slider max 0 must not crash; Move button already disables when clamped<=0.
- tabular-nums everywhere: every £ figure must use fontVariant:['tabular-nums'] or money jitters during count-up (banned-by-spec to show '12.3K' style; always full money).
- Division-by-zero / NaN width: totalGoal could be 0 → (total/totalGoal)\*100 = Infinity/NaN; per-pot goal 0 → same. Guard widths (clamp 0..100) in RN.
- name.split(' · ')[0] is used to shorten 'Holiday · September' → 'Holiday' in the transfer sheet title and summary — preserve this exact transform.
- scrim is ink/40 (web) but MOTION.md scrim-in spec says 'fades to 45% ink' — minor; match design intent (the gorhom backdrop opacity).
- Reduced motion: per MOTION.md every motion collapses to final state — count-up shows final £ instantly, slide-in/sheet-rise/scrim become immediate. Wire AccessibilityInfo.isReduceMotionEnabled.
- Negative tight point: pressureLow.overspent = -86 and tightDelta can be negative → render '£-86' / red '-£X' correctly; don't strip the minus.
- Custom CTA shadow is a hardcoded coral glow (0 12px 24px -10px rgba(224,99,58,0.55)) — translate to RN elevation/shadow tuned to accent, not a generic card shadow.

## rnPrimitiveMap

- root <div className='h-full flex flex-col px-7 pt-4 ...'> → <SafeAreaView>/<View style={flex:1}> (empty) and <Animated.ScrollView showsVerticalScrollIndicator={false}> (populated)
- slide-in-r class → reanimated entering={SlideInRight.duration(360)} or translateX 28→0
- <button> → <Pressable> + expo-haptics Haptics.selectionAsync() (the `press` utility = scale 0.97 on active)
- <em className='not-italic text-accent'> accent word → <Text style={{color: accent}}> inside Fraunces headline (keep one accent word per headline rule)
- useCountUp(total,700) → reanimated useDerivedValue + withTiming + interpolate, render via Animated.Text / re-derived state
- progress bars (div track + div fill with inline width% + transition) → <View> track + <Animated.View> fill, width animated with withTiming(700/500ms)
- drag-and-drop (draggable/onDrag\*/dataTransfer) → react-native-gesture-handler Pan/LongPress + reanimated (or draggable-flatlist); NO direct equivalent
- quick-add chips → <Pressable> pills; onPointerDown/onClick stopPropagation → gesture responder capture / simultaneousHandlers
- inline overlay (absolute inset-0 z-30 + scrim + bottom sheet) → @gorhom/bottom-sheet BottomSheetModal with custom Backdrop (this becomes a NEW screen-owned sheet; it is NOT in the SheetId union)
- <input type='range' step=5 accent-accent> → @react-native-community/slider (step emulation + minimumTrackTintColor=accent)
- CSS vars (--surface etc.) → theme object + useTheme() hook (kitTheme/makeStyles pattern per memory)
- hairline borders → StyleSheet.hairlineWidth with --hairline color
- lucide/glyph '←' and '⋮⋮' → lucide-react-native (ChevronLeft, GripVertical) or matched Text glyphs
- Fraunces (font-display) embedded; Inter Tight (font-sans) body; tabular → fontVariant:['tabular-nums']
- grid grid-cols-2 gap-2.5 (sheet buttons) → flexDirection row with flex:1 children + gap

## stateBranches

- empty — pots.length === 0: header + 'Set aside / Small, calmly, on purpose.' + <EmptyState mood='curious'> with 'Start a pot' CTA → nav.go('ritual'). (STATES.md Pots empty = ✅ EmptyState.)
- populated — happy path: aggregate card (count-up) + pot list (bar/pace/quick-add) + '+ Open a pot' + MeloLine; plus the conditional inline transfer overlay when a drag-drop sets `transfer`. (STATES.md Pots populated = ✅ done.)
- loading — n/a for Pots (STATES.md). Pot data is local/synchronous; no spinner.
- error — STATES.md Pots = 'inline retry'. NOT implemented in this component (no error UI present). RN should add an inline retry branch if pot load can fail (store read is currently synchronous, so low risk).
- offline — STATES.md Pots = ✅ same as populated. Local-first; renders identically, no network language. No code change needed.

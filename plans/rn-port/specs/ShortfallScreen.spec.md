# ShortfallScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenShortfall.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenShortfall.tsx

## rnComponentName

ShortfallScreen

## purpose

The "you won't make it" moment. Names the payday gap honestly (never alarmist, never blaming) and offers three concrete moves — pause a sub, borrow from a pot, hold a daily spend cap — while always allowing refusal ("Leave it for now"). Mood is concern; copy is frozen.

## reads

- useAppStore: pots
- useAppStore: subs
- useAppStore: subPaused (Record<string,boolean> keyed by sub name)
- doc block also declares onboarding.payday but the prototype code does NOT read it (uses synthetic gap/daysLeft instead)
- nav.back (from Nav prop)
- nav.openSheet (from Nav prop)
- nav.go (from Nav prop)

## writes

- none directly — each move only navigates/opens a sheet; the target sheet/screen does the writing
- doc block: @writes — (none)

## opensSheets

- edit-item (Pause one sub card -> nav.openSheet("edit-item"))
- doc block @opens-sheet also lists route-detail (borrow from pot) but the actual code uses nav.go("pots") screen-nav, NOT a route-detail sheet — divergence

## copyKeys

- A quiet moment (eyebrow label — verbatim string, NOT in COPY_DECK)
- Honest answer (Fraunces italic kicker — verbatim string, NOT in COPY_DECK)
- Short by £{gap}. (headline; COPY_DECK short.head = 'Short by **{amount}.**')
- {daysLeft} days until payday. Here's what would close the gap — pick one, or none. (body; COPY_DECK short.body = '{days} days left. Here's what would close it.' — prototype copy is longer/divergent)
- Pause one sub (card eyebrow — verbatim, not keyed)
- +{formatGBP(pausableSub.cost)} (card value)
- Pause {pausableSub.name} this cycle (COPY_DECK short.move.pause = 'Pause {name} this cycle')
- Borrow from a pot (card eyebrow; COPY_DECK short.move.pot = 'Borrow from {pot}')
- +{formatGBP(gap)} (card value)
- Move {formatGBP(gap)} from {lendingPot.name} (card body — verbatim, not keyed)
- Pay it back next cycle if you can. (card sub-caption — verbatim, not keyed)
- Spend a little less (card eyebrow — verbatim, not keyed)
- {formatGBP(dailyCap)}/day (card value; COPY_DECK short.move.cap = 'Hold spending at {amount}/day')
- Keep daily spend at {formatGBP(dailyCap)} for {daysLeft} days (card body — verbatim, not keyed)
- No move is fine too. Knowing the gap is half the work. (MeloLine text — verbatim, not keyed)
- Leave it for now (refusal button; COPY_DECK short.refuse = 'Leave it for now')
- Back (aria-label on ← button)
- ← (back glyph)
- £ (currency symbol; COPY_DECK currency.symbol)

## tokens

- --paper
- --coral (note: NOT defined in styles.css :root tokens — :root defines --negative #C5503E and --accent #E0633A; --coral is referenced by the component + doc block but appears to be an alias/missing token; RN theme must define a coral/negative-warm color)
- --accent
- --hairline (via .hairline utility = 1px solid var(--hairline))
- --inset (card fill)
- --ink (card primary text)
- --muted-ink (eyebrows, captions, kicker, back glyph, refusal button)
- --font-display (Fraunces — via .font-display on kicker + headline + card values)
- tabular (font-variant-numeric: tabular-nums — on gap, daysLeft, all money values)

## motions

- slide-in-r (360ms cubic-bezier(.16,1,.3,1)) — screen mount entrance
- gap-pulse (1.6s ease-in-out infinite, opacity 1->0.62) — subtle pulse on the coral £{gap} em; reduced-motion = off
- press (120ms ease, scale 0.97 on active) — back button, all three move cards, refusal button
- pebble-breathe-slow / melo-breathe-slow (6s ease-in-out infinite) — implied by Melo mood=concern per MELO_MOODS breathe rhythm
- melo-bead-in (concern worry-bead) + mood-fade — internal to Melo concern mood

## moods

- concern (both the size=36 <Melo> header accent and the <MeloLine> at bottom; MELO_MOODS: Shortfall screen = concern; 'concern is never alarming' — eyes close gently, small worry-bead, slight lean, breathe-slow, no red/no shake)

## docBlock

/\*\*

- @rn-screen ShortfallScreen
- @rn-stack Today > Shortfall (modal-style)
- @purpose The "you won't make it" moment. Names the gap honestly, offers three concrete moves, allows refusal.
- @reads pots, subs, onboarding.payday
- @writes — (each move opens its own sheet/screen)
- @opens-sheet edit-item (pause sub) · route-detail (borrow from pot)
- @copy FROZEN — never alarmist, never blaming.
- @tokens --paper --coral --accent --hairline --inset
- @motion slide-in-r on mount · gap-pulse 1.6s ease-in-out (subtle)
  \*/

## componentTree

<ShortfallScreen> (root: SafeAreaView/View, flex column, paddingH ~28, paddingTop ~16, slide-in-r entrance, paper bg)

  <Header> (Row, space-between, center)
    <Pressable onPress={nav.back} aria-label="Back" press> <Text muted-ink size20>←</Text> </Pressable>
    <Text eyebrow uppercase tracking0.14em size11 muted-ink>A quiet moment</Text>
    <View width16 /> (spacer to balance back btn)
  </Header>
  <View marginTop24> <Melo size={36} mood="concern" /> </View>
  <Text fontDisplay italic size13 muted-ink marginTop16>Honest answer</Text>
  <Text fontDisplay size32 lineHeight1.05 tracking-tight marginTop4>
    Short by <Text style={[notItalic, color coral, tabular, gap-pulse]}>£{gap}.</Text>
  </Text>
  <Text size14 muted-ink marginTop12 lineHeightRelaxed maxWidth28ch>
    <Text tabular>{daysLeft}</Text> days until payday. Here's what would close the gap — pick one, or none.
  </Text>
  <View marginTop28 gap12> (moves stack, space-y-3)
    {pausableSub && (
      <Pressable onPress={() => nav.openSheet("edit-item")} press fullWidth textLeft bg-inset hairline radius16 px20 py16>
        <Row baseline space-between>
          <Text eyebrow uppercase tracking0.14em size11 muted-ink>Pause one sub</Text>
          <Text fontDisplay size18 ink tabular>+{formatGBP(pausableSub.cost)}</Text>
        </Row>
        <Text marginTop4 size14.5 ink>Pause <Text fontMedium>{pausableSub.name}</Text> this cycle</Text>
      </Pressable>
    )}
    {lendingPot && lendingPot.saved >= gap && (
      <Pressable onPress={() => nav.go("pots")} press fullWidth textLeft bg-inset hairline radius16 px20 py16>
        <Row baseline space-between>
          <Text eyebrow ...>Borrow from a pot</Text>
          <Text fontDisplay size18 ink tabular>+{formatGBP(gap)}</Text>
        </Row>
        <Text marginTop4 size14.5 ink>Move {formatGBP(gap)} from <Text fontMedium>{lendingPot.name}</Text></Text>
        <Text marginTop4 size12 muted-ink>Pay it back next cycle if you can.</Text>
      </Pressable>
    )}
    <Pressable onPress={() => nav.go("whatif")} press fullWidth textLeft bg-inset hairline radius16 px20 py16>
      <Row baseline space-between>
        <Text eyebrow ...>Spend a little less</Text>
        <Text fontDisplay size18 ink tabular>{formatGBP(dailyCap)}/day</Text>
      </Row>
      <Text marginTop4 size14.5 ink>Keep daily spend at {formatGBP(dailyCap)} for {daysLeft} days</Text>
    </Pressable>
  </View>
  <View marginTop24> <MeloLine mood="concern" text="No move is fine too. Knowing the gap is half the work." /> </View>
  <View marginTopAuto paddingBottom20 paddingTop16> (pushed to bottom via flex)
    <Pressable onPress={nav.back} press fullWidth height44 radius12 hairline center>
      <Text size13 muted-ink>Leave it for now</Text>
    </Pressable>
  </View>
</ShortfallScreen>

## enginesNeeded

- Money path engine — computes the real gap (£) and daysLeft to payday; the prototype HARDCODES gap=86, daysLeft=9 with a '// Synthetic prototype values. The real engine computes these in the RN app.' comment
- Pot engine — supplies pots[] with {name, saved} so lendingPot = highest-saved pot can be computed; the borrow card only renders when lendingPot.saved >= gap
- Subscription detector / sub store — supplies subs[] with {name, cost} and subPaused map; pausableSub = first non-paused sub (fallback subs[0])
- Cycle / payday tracker — onboarding.payday (per doc block) for the real days-until-payday and to gate when Shortfall is shown at all (STATES: 'only shown when short')
- dailyCap = Math.max(0, Math.floor((280 - gap) / Math.max(1, daysLeft))) — uses a magic constant 280 (assumed remaining-budget anchor); RN must source the real spendable figure from the money-path engine, NOT a literal 280

## fidelityRisks

- Doc block vs code divergence (capture both, port the CODE behavior): doc @reads says onboarding.payday but code reads subPaused and uses synthetic gap/daysLeft; doc @opens-sheet lists route-detail for borrow-from-pot but code does nav.go('pots') (screen nav, no sheet); the WhatIf 'Spend a little less' move (nav.go('whatif')) is in code but absent from the doc block entirely.
- --coral token is referenced by the component and doc block but is NOT in styles.css :root (only --accent #E0633A and --negative #C5503E exist). RN theme must define `coral` deliberately (likely a warm negative, between accent and negative) — do not guess; confirm with design or alias to --negative. Getting this color wrong changes the emotional read of the gap number.
- Synthetic values: gap=86, daysLeft=9, and the 280 budget constant are prototype-only. RN MUST wire the money-path engine; shipping the literals would show a fake gap. The dailyCap formula and the >= gap pot gate must use real engine numbers.
- Conditional rendering = real state branches: card 1 hidden when no pausable sub; card 2 hidden when no pot has saved >= gap; card 3 (WhatIf) ALWAYS shows. RN must replicate all-three / two / one-card layouts (spacing via gap, not fixed positions). If only the WhatIf card shows, the screen must still read intentionally, not broken.
- STATES matrix: Shortfall has only populated + offline (offline == same as populated, local-first); no empty/loading/error branch — do NOT add a spinner or empty state. It is 'only shown when short' (gated by the money-path verdict upstream).
- Money tabular alignment: every figure (gap, daysLeft, +cost, +gap, dailyCap/day) needs fontVariant ['tabular-nums']. formatGBP uses a U+2212 MINUS SIGN (−) for negatives and en-GB grouping, maxFractionDigits 0 — RN must reuse the exact formatGBP, not Intl defaults, or negative/grouped values will drift.
- gap-pulse is the ONLY infinite animation besides Melo's breathe on this quiet screen (MOTION rule: Melo is normally the only continuously-animating thing). Keep it subtle (opacity 1->0.62, 1.6s) and OFF under reduced motion. Don't add extra looping motion.
- Melo concern mood must use breathe-slow (6s) per MELO_MOODS, not the default 4.4s; concern is never alarming — no red, no shake. Mood is decorative; copy carries meaning (accessibility).
- Copy is FROZEN and several visible strings are NOT in COPY_DECK (eyebrows 'A quiet moment'/'Honest answer'/'Pause one sub'/'Spend a little less', the MeloLine text, the longer body/captions). RN_PORT says 'if a string isn't in COPY_DECK it doesn't ship' — these must be added to COPY_DECK as new short.\* keys before/at port time, preserving exact wording; do not paraphrase. Body copy also differs from existing short.body — reconcile.
- Banned-words check passes (no import/parse/sync/etc.) — keep it that way when re-keying.
- Layout: header uses a width-16 spacer to balance the back button so the eyebrow stays centered; mt-auto pushes the refusal button to the bottom (flex-1 spacer behavior). In RN use flexGrow spacer / justifyContent, and SafeArea for the bottom inset.
- press scale-0.97 should map to Pressable + Haptics.selectionAsync() per RN_PORT; back + all cards + refusal are pressable.
- maxWidth 28ch on the body line — RN has no 'ch' unit; approximate with a fixed maxWidth (~260-280) tuned to the body font, don't drop the line-length constraint or the editorial rhythm breaks.

## rnPrimitiveMap

- div -> View (with StyleSheet); root div.h-full flex flex-col -> View flex:1
- button -> Pressable (+ expo-haptics Haptics.selectionAsync on press) — replaces all four buttons (back, 3 cards, refusal)
- span/p/h2/em -> Text (nest <Text> for inline emphasis like <em>£{gap}</em> and <span font-medium>{name}</span>)
- <Melo size mood> -> react-native-svg Melo + reanimated breathe-slow (concern); NOT Lottie (MOTION rule)
- <MeloLine mood text> -> Row(View) of <Melo size=28 mood> + Fraunces-italic <Text> (per kit.tsx MeloLine: text-13.5 leading-snug muted-ink italic font-display, gap-3, items-start, pt-1)
- formatGBP -> port verbatim (U+2212 minus, en-GB toLocaleString maxFractionDigits 0); Hermes Intl may need polyfill — verify grouping on device
- CSS vars (--paper etc.) -> theme object + useTheme() hook; define `coral` explicitly
- tabular class -> Text style fontVariant: ['tabular-nums']
- .hairline (1px solid --hairline) -> borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline (note: visually 1px in web; hairlineWidth may be thinner — confirm card border weight)
- rounded-2xl (radius 16 web token radius-lg=18/ '2xl'=32 — class rounded-2xl in this tailwind config maps to --radius-2xl=32? verify: cards use rounded-2xl, refusal uses rounded-xl=24) -> borderRadius from theme radii; CONFIRM the 2xl=32 / xl=24 mapping against tailwind theme, don't assume 16
- slide-in-r -> reanimated withTiming(translateX 28->0, opacity 0->1, 360ms cubic-bezier(.16,1,.3,1))
- gap-pulse -> reanimated withRepeat(withTiming(opacity 1<->0.62, 1600ms ease-in-out), -1, true); gate on AccessibilityInfo.isReduceMotionEnabled
- press 0.97 -> Pressable style fn or reanimated scale on pressIn/out (120ms)
- nav.go/openSheet/back -> @react-navigation stack + @gorhom/bottom-sheet for edit-item sheet
- uppercase tracking-[0.14em] -> textTransform:'uppercase', letterSpacing ~1.5 (0.14em \* 11px ≈ 1.54)
- px-7 (28) / pt-4 (16) / mt-6 etc. -> StyleSheet numeric spacing on one scale (no second spacing system per RN_PORT)

## stateBranches

- populated (the only real branch): renders gap headline + available move cards + MeloLine + refusal. Card visibility is conditional: card1 (Pause sub) only if a pausableSub exists; card2 (Borrow pot) only if lendingPot.saved >= gap; card3 (WhatIf) always.
- offline: STATES matrix = same as populated (Folio is local-first; no network dependency, no offline chrome).
- empty: n/a — STATES note 'n/a (only shown when short)'; the screen is gated upstream by the money-path verdict, never reached with no data.
- loading: n/a — no async on this screen; gap/daysLeft come from the synchronous local engine. No spinner (MOTION/STATES: no spinners).
- error: n/a per STATES matrix.
- Practical RN sub-branches to handle gracefully (not in matrix but implied by code): (a) all three cards, (b) WhatIf + one of pause/borrow, (c) WhatIf only — must all read intentionally.

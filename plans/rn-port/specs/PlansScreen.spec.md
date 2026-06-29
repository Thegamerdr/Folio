# PlansScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPlans.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPlans.tsx

## rnComponentName

PlansScreen

## purpose

"What's coming before payday" — a read-only forward look at money already spoken for between now and next payday: upcoming bills, a debt installment, and renewals shown as a dated list. Surfaces a "Set aside" total, a next-payday marker, two add CTAs (a bill / a debt), and a closing Melo line. @rn-stack is More > Plans. Reached by nav from the More screen; the back button returns.

## docBlock

@rn-screen    PlansScreen
@rn-stack     More > Plans
@purpose      What's coming before payday — bills, renewals, debt drops.
@reads        subs, subPaused
@writes       —
@opens-sheet  route-detail
@copy         FROZEN
@tokens       --surface --hairline --accent --muted-ink
@motion       slide-in-r

## reads

- DOC-BLOCK INTENT (@reads): subs, subPaused — the subscriptions list plus which are paused.
- ACTUAL PROTOTYPE: reads NOTHING from the store. It imports many store actions/types but uses none of them; the list is a hardcoded local `upcoming` array of 6 fixed items with `total = upcoming.reduce(sum of amount)` derived in-render.
- RN PORT MUST wire: subs + subPaused (and the bill/debt/money-path engine output) to GENERATE the upcoming list and total instead of hardcoding. Hardcoded array (date,name,amount,kind,note): 1 Jul Rent 540 bill 'monthly · standing order'; 1 Jul Council Tax 162 bill 'monthly · DD'; 3 Jul BT Broadband 38 bill 'monthly · DD'; 12 Jul Octopus Energy 118 bill 'moved from 1 Jul'; 15 Jul Klarna · sofa 84 debt '3 of 6 left'; 20 Jul Spotify Family 17 bill 'monthly'. Total = 959. Next payday = 25 Jul (also hardcoded).

## writes

- None. @writes is '—'; no store mutations occur.
- Navigation only: nav.back(); nav.go('add-bill'); nav.go('add-debt').
- Imported store actions (setPots, setSubs, togglePaused, pauseMany, addCycle, setOnboarding, resetAll, fastForwardMonth, removeSub, addToPot, markSubUsed, addTransaction, removeTransaction) are imported but UNUSED — do not port the imports.

## opensSheets

- route-detail (declared in @opens-sheet but NOT wired in the prototype — no row tap handler exists; RN port should make tapping an upcoming row call nav.openSheet('route-detail') to honor the doc-block intent)

## copyKeys

- @copy is FROZEN, but ScreenPlans uses INLINE literal strings — NONE are keyed in COPY_DECK.md yet. RN port must add keys (suggest plans.*) for all of these. STATES.md also references the (unkeyed) empty-state string 'No plans yet'.
- Header eyebrow: 'Plans' (uppercase, tracking 0.14em)
- Back glyph: '←'
- Eyebrow line: 'Before next payday' (Fraunces italic)
- Headline: "What's already spoken for." — accent word is 'already' (rendered <em class='not-italic text-accent'>); 'What's ' and '.' wrap it in plain ink
- Label: 'Set aside' (uppercase eyebrow)
- Label: 'Next payday' (uppercase eyebrow)
- Value: 'Payday · 25 Jul' (Fraunces)
- Per-row month (date.split(' ')[1]): 'Jul' (uppercase) ×6
- Per-row day (date.split(' ')[0]): '1','1','3','12','15','20' (Fraunces tabular)
- Row names: 'Rent','Council Tax','BT Broadband','Octopus Energy','Klarna · sofa','Spotify Family'
- Row notes: 'monthly · standing order','monthly · DD','monthly · DD','moved from 1 Jul','3 of 6 left','monthly'
- Row amounts: '−£540','−£162','−£38','−£118','−£84','−£17' (Money component, size sm, en-dash minus)
- Set-aside total: formatGBP(959) = '−£959' (Money, size lg, tone negative)
- Primary CTA: '+ Add a bill'
- Secondary CTA: 'or add a debt'
- Closing MeloLine text: "Move one if the timing doesn't suit you." (mood soft)

## tokens

- --surface (card/list background)
- --hairline (card border via .hairline util + divide-y divider color)
- --accent (accent word 'already'; primary CTA background #E0633A; CTA boxShadow rgba(224,99,58,0.55))
- --muted-ink (back glyph, eyebrows, notes, secondary CTA, MeloLine copy)
- --caution (debt row vertical bar fill #D9A441)
- --negative (bill row vertical bar fill at 60% opacity; Money negative tone)
- --ink (default text color via Money default; inherited body)
- --paper (screen ground, inherited from shell)
- radius: rounded-2xl = --radius-2xl 32px on cards; rounded-full on bars; CTA rounded-2xl
- font-display = Fraunces (headline, day numbers, payday value, Money); font-sans = Inter Tight (body, names, notes, CTA)
- tabular = font-variant-numeric tabular-nums (day numbers + all Money)

## motions

- slide-in-r — whole-screen entrance, translateX 28px→0 + opacity 0→1, 360ms cubic-bezier(.16,1,.3,1); declared @motion and on root .slide-in-r
- press — 120ms scale→0.97 on active for back button + both CTAs (+ per-row tap in RN)
- Melo breathe (continuous) + blink via MeloLine→Melo (mood 'soft'→calm = melo-breathe 4.4s)
- NO count-up — Money renders static strings here; useCountUp not used by this screen
- Reduced motion: collapse slide-in-r and press to final/instant state

## moods

- soft → normalizes to calm (MeloLine mood='soft'; kit normalizeMood maps 'soft'→'calm'). MELO_MOODS.md does not list Plans explicitly; this is the only Melo on the screen, calm/just-here tone. Do NOT carry the 'soft' alias into RN — use mood='calm'.

## componentTree

<ScreenContainer style={slideInR} scrollable hideScrollbar paddingX=28 paddingTop=16>            // div.h-full.flex.flex-col.px-7.pt-4.overflow-y-auto.no-scrollbar.slide-in-r
  <Row justify=space-between align=center>                                                          // header
    <Pressable onPress={nav.back}><Text color=mutedInk size=20>←</Text></Pressable>
    <Text color=mutedInk size=12 uppercase tracking=0.14em>Plans</Text>
    <View width=20 />                                                                                // spacer
  </Row>

  <View marginTop=20>                                                                               // title block
    <Text fontDisplay italic size=13 color=mutedInk>Before next payday</Text>
    <Text fontDisplay size=28 lineHeight=tight>What's <Text color=accent style={notItalic}>already</Text> spoken for.</Text>
  </View>

  <Card marginTop=20 surface hairline radius=2xl padding=20 row alignItems=baseline justify=space-between>
    <View>
      <Text size=11 uppercase tracking=0.12em color=mutedInk>Set aside</Text>
      <Money value={formatGBP(total)} size="lg" tone="negative" />
    </View>
    <View align=right>
      <Text size=11 uppercase tracking=0.12em color=mutedInk>Next payday</Text>
      <Text fontDisplay size=15 marginTop=2>Payday · 25 Jul</Text>
    </View>
  </Card>

  <Card marginTop=20 surface hairline radius=2xl dividerColor=hairline>                              // list (divide-y)
    {upcoming.map((u) => (
      <Pressable onPress={() => nav.openSheet("route-detail")} row alignItems=center gap=12 paddingX=20 paddingY=14>   // tap = port-added (doc intent)
        <View width=44 align=center>
          <Text size=10 uppercase tracking=0.12em color=mutedInk>{month}</Text>                      // 'Jul'
          <Text fontDisplay size=18 tabular lineHeight=none>{day}</Text>                              // '12'
        </View>
        <View width=6 height=32 radius=full bg={u.kind==='debt' ? caution : negative@60%} />          // kind bar
        <View flex=1 minWidth=0>
          <Text size=14 weight=medium numberOfLines=1>{u.name}</Text>
          <Text size=11.5 color=mutedInk numberOfLines=1>{u.note}</Text>
        </View>
        <Money value={`−£${u.amount}`} size="sm" />
      </Pressable>
    ))}
  </Card>

  <View marginTop=20>                                                                               // CTAs
    <Pressable onPress={() => nav.go("add-bill")} height=52 radius=2xl bg=accent shadow={accent55} center>
      <Text color=#FFFFFF weight=medium size=15>+ Add a bill</Text>
    </Pressable>
    <Pressable onPress={() => nav.go("add-debt")} height=42 marginTop=8 center>
      <Text size=13 color=mutedInk>or add a debt</Text>
    </Pressable>
  </View>

  <View marginTop=20 marginBottom=32>
    <MeloLine text="Move one if the timing doesn't suit you." mood="calm" />                          // 'soft'→calm in RN
  </View>
</ScreenContainer>

## enginesNeeded

- Money path / bills engine — produces the upcoming list (dated bills + debt installments + renewals) and the 'set aside' total between today and next payday. Currently hardcoded; must come from real data.
- Cycle tracker — supplies the next-payday date ('25 Jul' is hardcoded today).
- Subscription detector — feeds renewal rows; @reads declares subs + subPaused (paused subs should presumably be excluded/marked).
- Local store (subs, subPaused state) — the doc-block declared source of truth.
- Kit primitives (no new engine): Money, MeloLine, formatGBP from components/folio/kit; Nav from components/folio/types.

## rnPrimitiveMap

- div → View (root → ScrollView with showsVerticalScrollIndicator={false} for overflow-y-auto.no-scrollbar)
- button → Pressable + expo-haptics Haptics.selectionAsync() (replaces .press); back, both CTAs, and the per-row tap
- span / p / h2 / em → Text (em accent word = nested <Text> with accent color, no italic)
- <Money> → Text with fontVariant:['tabular-nums'] + Fraunces, size/tone mapped from the sm/lg scale (sm=15, lg=28; negative tone = --negative)
- <MeloLine> → RN MeloLine = react-native-svg Melo (mood normalized 'soft'→'calm') + Fraunces-italic Text
- formatGBP → identical pure fn (Intl en-GB, maximumFractionDigits 0, en-dash '−' minus)
- Tailwind classes → StyleSheet + theme via useTheme(); CSS vars → theme object (surface/hairline/accent/muted-ink/caution/negative)
- hairline border (border 1px var(--hairline)) → 1px borderColor=hairline (StyleSheet.hairlineWidth is thinner than 1px; this design uses an explicit 1px, prefer borderWidth:1)
- divide-y divide-[--hairline] → render row separators (borderTopWidth 1 hairline on all rows except first, or a separator View) — gorhom not needed; plain list
- rounded-2xl (32px) → borderRadius 32; rounded-full bar → borderRadius 9999
- bg-[--negative]/60 → negative color at 0.6 alpha (rgba or opacity)
- CTA boxShadow '0 12px 24px -10px rgba(224,99,58,0.55)' → iOS shadowColor #E0633A shadowOpacity~0.45 shadowRadius~14 shadowOffset{0,12}; Android elevation ~6 (color shadows weaker on Android)
- slide-in-r → reanimated entering: translateX 28→0 + opacity 0→1, 360ms cubic-bezier(.16,1,.3,1); collapse to final state under AccessibilityInfo.isReduceMotionEnabled
- nav.go / nav.back / nav.openSheet → @react-navigation stack navigate/goBack + gorhom BottomSheetModal for route-detail
- uppercase + letterSpacing → textTransform:'uppercase' + letterSpacing (RN letterSpacing is in px, not em: 0.14em@12px≈1.68, 0.12em@11px≈1.32, 0.12em@10px≈1.2)
- truncate → numberOfLines={1} (name + note)
- no-scrollbar → showsVerticalScrollIndicator={false}
- imported PNG assets meloHero, waxSeal → imported but UNUSED in this screen; do not port

## stateBranches

- populated — the only state actually built (STATES.md: Plans populated ✅; empty='No plans yet', loading=n/a, error=n/a, offline=✅ same as populated). The prototype ALWAYS renders the 6 hardcoded rows, so it has no real branch logic.
- empty — RN port MUST add: when there is nothing spoken for before payday, show 'No plans yet' (EmptyState primitive: Melo calm + Fraunces accent line + body + optional CTA). Not implemented in the prototype.
- loading — n/a (no async; this is derived local data).
- error — n/a per STATES.md.
- offline — same as populated (local-first; render identically, no network chrome).
- Row variant branch: kind==='debt' → caution-yellow vertical bar; else (bill/renewal) → negative@60% bar. This is the one conditional in the JSX.

## fidelityRisks

- Hardcoded data trap: the upcoming list, total (959), and payday date (25 Jul) are LITERALS. A faithful RN port must replace them with subs/subPaused + bills/money-path engine output, NOT copy the demo numbers. Doc-block @reads (subs, subPaused) is the contract; the implementation ignores it.
- Missing empty state: STATES.md mandates 'No plans yet' but the prototype never renders it. Easy to ship a screen that breaks (shows nothing/empty card) when there are no upcoming items.
- Unwired route-detail sheet: @opens-sheet says route-detail but no tap handler exists. Decide intent — make rows tappable to open route-detail (recommended) and do not silently drop the declared sheet.
- letterSpacing units: web uses em (0.14em/0.12em); RN letterSpacing is absolute px. Must convert per font size or tracking will look wrong.
- 1px hairline vs StyleSheet.hairlineWidth: the design uses an explicit 1px border + 1px dividers; hairlineWidth (~0.5px on @2x) is thinner and will look weaker — use borderWidth:1 with --hairline.
- divide-y dividers: must be reproduced as per-row top borders (skip first) — naive port forgets the inter-row hairlines that define the list.
- en-dash minus '−' (U+2212), not hyphen '-': in both formatGBP and the row '−£{amount}' template. Preserve the exact glyph for tabular alignment.
- Money tone/size mapping: 'lg' negative for the total, 'sm' for rows; don't substitute default ink tone (the total must read --negative).
- Accent word 'already' is non-italic accent inside a Fraunces headline (em.not-italic). RN nested Text must override italic off + set accent color, or it ports as italic accent.
- Drop 'soft' alias: MeloLine mood='soft' must become mood='calm' in RN (kit's @rn-port note: do NOT carry soft/alert aliases into RN).
- Unused imports: the screen imports ~14 store actions + 2 PNGs + useCountUp + many type names it never uses; don't port the dead imports.
- CTA accent shadow: the terracotta drop shadow is part of the look (rgba(224,99,58,0.55)); plain elevation on Android won't tint — accept the platform gap or fake with a colored shadow lib.
- tabular figures on day numbers AND money: both day column and amounts use tabular nums for vertical rhythm; missing fontVariant breaks alignment in the 44px date column.
- Banned vocabulary: keep copy as-is ('a bill','a debt','spoken for','set aside') — do not introduce banned words (import/sync/dashboard/etc.) when adding keys.


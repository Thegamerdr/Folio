# VisualizerScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenVisualizer.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenVisualizer.tsx

## rnComponentName

VisualizerScreen

## purpose

Visual preview of what Folio found before the user reviews item-by-item. A multi-select checklist of candidate money items extracted from a statement, with a live "Add N · ±£X" CTA. Per the doc block: @rn-stack Intake > Check.

## docBlock

/**
 * @rn-screen    VisualizerScreen
 * @rn-stack     Intake > Check
 * @purpose      Visual preview of what Folio found before the user reviews item-by-item.
 * @reads        —
 * @writes       —
 * @opens-sheet  —
 * @copy         FROZEN
 * @tokens       --paper --accent --positive --hairline
 * @motion       route-draw · slide-in-r
 */

## reads

- NONE — doc block @reads is — (em dash). All 14 store symbols imported from @/lib/store (useAppStore, setPots, setSubs, togglePaused, pauseMany, addCycle, setOnboarding, resetAll, fastForwardMonth, removeSub, addToPot, markSubUsed, addTransaction, removeTransaction, Sub, Transaction) are DEAD IMPORTS — none are called in the component body.
- Local React state only: selected: Record<string,boolean> (which items are checked), via useState.
- ITEMS: a hardcoded module-level const array of 8 Item objects {merchant,date,amount,type,status} — the 'found' candidates. Not from any engine/store.

## writes

- NONE — doc block @writes is — (em dash). No store actions are dispatched.
- Local only: toggle(merchant) flips selected[merchant] via setSelected (immutable spread).
- Navigation side-effects only (no data writes): nav.go('review') on per-row Edit; nav.go('today-after') on primary CTA when count>0; nav.back() on header back arrow and on 'Later'.

## opensSheets

- NONE — doc block @opens-sheet is — (em dash). nav.openSheet is never called.

## copyKeys

- INLINE LITERAL (NOT in COPY_DECK): 'June statement' (header eyebrow, uppercase tracked)
- INLINE LITERAL: 'From your statement' (display italic kicker)
- INLINE LITERAL: 'Check what Folio found.' — headline; 'found.' is the terracotta accent word (em, not-italic, var(--accent))
- INLINE LITERAL: 'Nothing is added until you choose.' (subhead)
- INLINE LITERAL (computed): `${ITEMS.length} found` → '8 found' (chip)
- INLINE LITERAL (computed): `${clearCount} clear` → '6 clear' (chip)
- INLINE LITERAL (computed): `${checkCount} to check` → '2 to check' (chip)
- INLINE LITERAL: per-row 'Edit' button
- INLINE LITERAL: 'Later' (secondary footer button)
- INLINE LITERAL (computed CTA): 'Choose what to add' when count===0
- INLINE LITERAL (computed CTA): `Add ${count} · ${sign}£${Math.abs(selectedTotal).toFixed(0)}` e.g. 'Add 3 · −£134' / 'Add 1 · +£2180' when count>0
- INLINE aria-labels: 'Back'; 'Summary' (group); `${isOn?'Remove':'Add'} ${merchant}`
- Item data strings come from the ITEMS const, not COPY_DECK: Tesco / Salary — Whitstone Ltd / Octopus Energy / Transfer to Sarah / Pret a Manger / Klarna / Spotify / Refund — ASOS; types Groceries/Income/Bill/Unknown/Eating out/Debt/Subscription/Unknown
- RELATED COPY_DECK keys for the same flow (prefer these on RN port over inline literals): add.success.pdf 'Folio read your statement.', add.success.image 'Folio read your image.', add.success.paste 'Things to check.', add.review.confirm 'Looks right', add.review.fix 'Fix something'

## tokens

- --paper (footer bg; declared in doc block)
- --accent (headline accent word, checked checkbox fill+border, primary CTA bg; declared)
- --positive (via Money tone='positive' for inflows; declared)
- --hairline (card border via .hairline util, divide-y divider, footer top border; declared)
- --muted-ink (back arrow, eyebrow, kicker, subhead, chip text, row meta, date/dot, Edit, Later, disabled CTA text) — USED but NOT in doc block @tokens
- --ink (chip primary text, row merchant text, checkbox unchecked border at 40% via /40) — USED but NOT declared
- --inset (chip backgrounds, disabled CTA bg) — USED but NOT declared
- --surface (card background) — USED but NOT declared
- --caution ('check'-status item type text) — USED but NOT declared
- Money atom internal token map: --ink / --positive

## motions

- slide-in-r (360ms cubic-bezier(.16,1,.3,1)) — whole-screen forward-nav entrance; root div className includes 'slide-in-r'. Declared + used.
- press (120ms ease, scale 0.97 on active) — every tappable: back arrow, checkbox, row body, Edit, primary CTA, Later. Used (NOT in doc block @motion list).
- route-draw — DECLARED in doc block @motion but NOT present anywhere in this component (no SVG path / .route-draw). Doc block @motion is wrong/aspirational for this prototype.
- CTA opacity transition (transition-opacity) on enable/disable — Tailwind utility, not a named Folio motion.
- Checkbox transition-all duration-150 on toggle — generic; maps to a 150ms withTiming in RN.

## moods

- NONE rendered — no <Melo>/<MeloLine>/<EmptyState> is mounted in the shipped populated branch.
- MELO_MOODS.md mapping for this surface: 'Add entry — reading' → curious; 'Add entry — success' → cheer; 'Add entry — fallback' → calm. Visualizer is the success/preview surface; RN port's loading branch should show Melo curious ('reading…') and the header may carry Melo cheer.
- STATES.md loading rule: Melo curious + one line, NEVER a spinner.

## componentTree

<![CDATA[
<SafeAreaView style={root} /* h-full flex-col overflow-hidden; entrance: slide-in-r 360ms */>

  {/* Header row — px-7 pt-4 pb-2, space-between */}
  <View style={headerRow}>
    <Pressable onPress={nav.back} accessibilityLabel="Back" /* press */>
      <Text style={backArrow /* 20px, --muted-ink */}>←</Text>
    </Pressable>
    <Text style={eyebrow /* 12px, --muted-ink, uppercase, letterSpacing 0.14em */}>June statement</Text>
    <View style={{ width: 20 }} /> {/* spacer balancing back arrow */}
  </View>

  {/* Intro block — px-7 pt-3 */}
  <View style={intro}>
    <Text style={kicker /* Fraunces italic 13px --muted-ink */}>From your statement</Text>
    <Text style={headline /* Fraunces 26px mt-1 leading-tight */}>
      Check what Folio <Text style={accentWord /* not-italic --accent */}>found.</Text>
    </Text>
    <Text style={subhead /* 12.5px --muted-ink mt-2 */}>Nothing is added until you choose.</Text>

    {/* Summary chips — mt-4 row gap-2, accessibilityRole=group label="Summary" */}
    <View style={chipsRow}>
      <Chip strong>{ITEMS.length} found</Chip>     {/* bg --inset, text --ink medium tabular */}
      <Chip>{clearCount} clear</Chip>              {/* bg --inset, text --muted-ink tabular */}
      <Chip>{checkCount} to check</Chip>           {/* bg --inset, text --muted-ink tabular */}
    </View>
  </View>

  {/* Scroll list — mt-3 flex-1, hidden scrollbar, px-4 */}
  <ScrollView style={listScroll} showsVerticalScrollIndicator={false}>
    {/* Card: bg --surface, hairline border, radius 16, internal hairline dividers */}
    <View style={card}>
      {ITEMS.map((it, idx) => {
        const isOn = !!selected[it.merchant];
        return (
          <View key={it.merchant} style={[row /* px-4 py-3.5 flex-row items-center gap-3 */, idx>0 && rowDivider /* top hairline */]}>
            {/* Checkbox */}
            <Pressable onPress={() => toggle(it.merchant)} accessibilityRole="checkbox"
                       accessibilityState={{ checked: isOn }}
                       accessibilityLabel={`${isOn?'Remove':'Add'} ${it.merchant}`} /* press */>
              <View style={[box /* 20x20 radius 6 border, 150ms */, isOn ? boxOn /* fill+border --accent */ : boxOff /* border --ink @40% */]}>
                {isOn && <Text style={tick /* white 12px */}>✓</Text>}
              </View>
            </Pressable>

            {/* Label + amount (also toggles) */}
            <Pressable style={rowBody /* flex-1 row items-center gap-3 */} onPress={() => toggle(it.merchant)}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={merchant /* 14px medium */}>{it.merchant}</Text>
                <View style={meta /* row gap-1.5 mt-0.5 */}>
                  <Text style={metaText /* 11.5px --muted-ink */}>{it.date}</Text>
                  <Text style={metaText}>·</Text>
                  <Text style={[metaText, it.status==='check' && {color: caution}]}>{it.type}</Text>
                </View>
              </View>
              <Money size="sm" tone={it.amount>0 ? 'positive' : 'ink'}
                     value={`${it.amount>0?'+':'−'}£${Math.abs(it.amount).toFixed(2)}`} />
            </Pressable>

            {/* Per-row Edit → review */}
            <Pressable onPress={() => nav.go('review')} /* press */>
              <Text style={edit /* 11.5px --muted-ink */}>Edit</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
    <View style={{ height: 16 }} />
  </ScrollView>

  {/* Footer CTA bar — px-5 py-3, bg --paper, top hairline, row gap-3 */}
  <View style={footer}>
    <Pressable disabled={count===0} onPress={() => count>0 && nav.go('today-after')}
               style={[cta /* flex-1 h-48 radius 12 bg --accent white 14 medium */, count===0 && ctaDisabled /* opacity .4, bg --inset, text --muted-ink */]} /* press */>
      <Text style={ctaText}>{ctaLabel}</Text>
    </Pressable>
    <Pressable onPress={nav.back} style={later /* px-3 h-48 */} /* press */>
      <Text style={laterText /* 12.5px --muted-ink */}>Later</Text>
    </Pressable>
  </View>
</SafeAreaView>
]]>

## enginesNeeded

- Statement reader engine (RN_PORT.md): PDF/image/text → candidate money items. In the prototype this is FAKED by the hardcoded ITEMS const; the RN screen must source items from the reader's output, NOT a literal array. RN_PORT hard rule: reader must run; never a blank manual form.
- Review pipeline: per-row 'Edit' and the populated→Review handoff feed the Review step (STATES.md: reader output must be checked before it changes the money path).
- Money path engine: chosen items, once added, flow into the verdict/route recompute that today-after renders (route-draw). The CTA navigates to today-after where the route is re-drawn.
- Money atom / tabular GBP (kit.tsx). RN: <Text fontVariant ['tabular-nums']>, Fraunces. Note this screen formats inline with toFixed(2) on rows and toFixed(0) on the CTA — NOT via formatGBP.
- Local store (SQLite/Drizzle or WatermelonDB) is the eventual sink for selected items — but this screen performs ZERO store writes; selection is ephemeral until today-after/Review commit it.

## fidelityRisks

- DOC-BLOCK vs CODE token drift: @tokens lists only --paper/--accent/--positive/--hairline, but the code also uses --muted-ink, --ink, --inset, --surface, --caution. Port ALL of them.
- DOC-BLOCK @motion lists 'route-draw' but this component has NO route-draw (no SVG path). Don't add one here — actual entrance is slide-in-r; route-draw lives on today-after.
- COPY NOT KEYED: every visible string is an inline literal ('June statement', 'Check what Folio found.', 'Nothing is added until you choose.', chips, 'Edit', 'Later', CTA) — none in COPY_DECK.md, yet @copy says FROZEN. COPY_DECK rule: 'if a string isn't here it doesn't ship'. RN port must add keys (or reconcile with add.success.* / add.review.*) before shipping. Flag to owner.
- BANNED-WORD CHECK when keying: copy here is clean. Do NOT introduce import/rows/parser/extract/OCR/source record. 'Visualizer' is an internal ScreenId only — never surface it as user copy.
- HARDCODED DATA: ITEMS is a static 8-row demo array; real screen must render the statement-reader's candidate output. Don't port the literal array as product data; wire to the reader. RN_PORT forbids replacing the reader with a manual form.
- DEAD IMPORTS: 14 store symbols imported, zero used. Don't carry them to RN; confirms @reads/@writes are correctly —.
- MISSING STATE BRANCHES (biggest gap): only populated is built. STATES.md requires empty ('Add a statement first'), loading ('reading…' + Melo curious, NO spinner, ≈4s cap → fallback), error (→ pdf-fallback/image-fallback). RN port MUST add these.
- NO MELO: surface earns Melo per MELO_MOODS (reading=curious / success=cheer) but the prototype omits him. Decide header Melo cheer + loading Melo curious; keep 'no mood = no Melo' discipline otherwise.
- NUMBER FORMATTING: rows use toFixed(2) (pence), CTA uses toFixed(0) (whole £). Preserve both deliberately — don't unify to formatGBP (0dp). Keep the − minus glyph (U+2212) and the '·' middot exactly.
- DIVIDERS: Tailwind divide-y has no RN analog — manual per-row top hairline; first row must have none, and avoid doubling with the card's outer hairline border.
- ACCESSIBILITY: checkbox needs accessibilityRole='checkbox' + state; summary group needs a label; the 'check'-status --caution color must not be the only signal (the 'to check' chip + type text carry meaning). Colour alone never carries meaning (STATES/MOODS).
- TAP TARGETS: 3 Pressables per row (checkbox + row body both toggle, Edit → review). Ensure hit areas don't overlap/steal taps; prior Folio device lesson (flex-collapse taps, release-build touch) applies.
- REDUCED MOTION: slide-in-r and the 150ms checkbox transition must collapse to final state under AccessibilityInfo.isReduceMotionEnabled (MOTION.md: reduced motion = final state, not slower).
- letter-spacing 0.14em (em) and text-[--ink]/40 (alpha) have no direct RN form — convert em to absolute px (fontSize*0.14) and apply rgba alpha on the resolved --ink token.


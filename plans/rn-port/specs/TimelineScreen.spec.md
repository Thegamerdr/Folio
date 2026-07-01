# TimelineScreen (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenTimeline.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenTimeline.tsx

## rnComponentName

TimelineScreen

## purpose

Reverse-chronological log of what the user added, edited, paused, ignored, or left for later. A read-with-light-touch surface: newest first, nothing hidden, every row carries a tappable category chip. Reached via More > Timeline.

## docBlock

@rn-screen TimelineScreen
@rn-stack More > Timeline
@purpose Reverse-chronological log of what the user added or left.
@reads transactions, cycles
@writes removeTransaction
@opens-sheet edit-txn
@copy FROZEN
@tokens --surface --hairline --muted-ink --accent
@motion slide-in-r · press

## reads

- nav (Nav prop): nav.back only
- DECLARED-NOT-WIRED: store `transactions` (doc @reads) — current web code does NOT call useAppStore; entries are a hardcoded local array of 8 demo items
- DECLARED-NOT-WIRED: store `cycles` (doc @reads) — never referenced in the implemented body
- local useState `cats`: Record<number, Category|undefined> seeded from each entry.category (per-row category label)

## writes

- local setCats via cycleCat(i): advances row i to the next CATEGORIES value, wrapping (modulo). Purely local UI state, NOT persisted to the store.
- DECLARED-NOT-WIRED: store `removeTransaction` (doc @writes) — imported but never invoked in the implemented body
- nav.back() on the top-left back control

## opensSheets

- DECLARED-NOT-WIRED: edit-txn (doc @opens-sheet) — no row currently calls nav.openSheet('edit-txn'); RN port should wire row tap -> openSheet('edit-txn') to honor the contract

## copyKeys

- Timeline (eyebrow label, uppercase tracking)
- Everything you've added or skipped. (headline; 'added' is the terracotta accent word via <em class=not-italic text-accent>)
- Newest first. Nothing is hidden. (subhead)
- Add a label (chip fallback when row has no category)
- You can undo any of these. Nothing is locked. (MeloLine, mood=soft)
- Verbs (exact): Added, Left for later, Ignored, Edited, Paused
- Categories (exact, CATEGORIES): Groceries, Transport, Bills, Eating out, Subscription, Shopping, Income, Other
- Demo whens (exact): Today · 9:14, Today · 9:12, Yesterday, Yesterday, Mon 23 Jun, Mon 23 Jun, Sat 21 Jun, Fri 20 Jun
- Demo whats (exact): Tesco, Klarna, Octopus Energy, Disney+, Salary, ATM withdrawal, Rent, Council Tax
- Demo notes (exact): £42 · groceries, you can decide tomorrow, moved to the 3rd, for one cycle, rough · £2,180, didn't recognise it, £540 · monthly, £162 · monthly
- aria-label template: `Category: ${cats[i] ?? 'uncategorised'}. Tap to change.`
- NOTE: COPY_DECK.md has NO Timeline section. None of these strings are keyed there despite @copy FROZEN; STATES.md empty copy 'Your story starts here' is also absent from this component. RN must add Timeline keys before shipping.

## tokens

- --surface (chip background)
- --hairline (timeline rail, chip border via .hairline utility, inactive dot fallback)
- --muted-ink (eyebrow, subhead, verb prefix, note, chip text/dot, back arrow)
- --accent (headline accent word; active category-dot color)
- --paper (3px ring/box-shadow halo around each marker dot)
- --positive (verbTone Added)
- --caution (verbTone Paused)
- verbTone also reuses --muted-ink (Left for later, Ignored) and --accent (Edited)
- doc block declares --surface --hairline --muted-ink --accent; --paper/--positive/--caution are additionally used in the body

## motions

- slide-in-r (screen container entrance; 360ms cubic-bezier(.16,1,.3,1), translateX 28->0 + fade)
- press (back button + each category chip; scale 0.97 active, 120ms)
- pebble-breathe + blink (implicit, via the bottom MeloLine's Melo — always-on idle, the only animating thing on this quiet screen)
- no count-up (no animated money values; '£42' etc are static text, not <Money>)

## moods

- soft (bottom MeloLine uses mood="soft"). MELO_MOODS.md's five canonical moods are calm/curious/cheer/concern/celebrate; 'soft' = the soft-eyes expression, a calm-family variant. Timeline is not in the MELO_MOODS surface table, so this is the only mood signal.

## componentTree

<TimelineScreen> (ScrollView, flex-1, px-7 pt-4, no scrollbar, entering=slide-in-r)
<Row justify-between align-center> // header
<Pressable onPress={nav.back} press> // back arrow "←", 20px, muted-ink
<Text eyebrow uppercase tracking-0.14em>Timeline</Text>
<View w-5 /> // spacer to center the label
</Row>

<View mt-6> // title block
<Text font-display 28px leading-tight>
Everything you've <Text accent>added</Text> or skipped.
</Text>
<Text 13px muted-ink mt-2>Newest first. Nothing is hidden.</Text>
</View>

<View mt-6 relative> // timeline list
<View absolute left-7px top-2 bottom-2 w-1px bg-hairline /> // vertical rail
<View gap-5 (space-y-5)>
{entries.map((e,i) =>
<View key=i relative pl-7> // row
<View absolute left-3px top-6px w-9px h-9px rounded-full
style={{ background: verbTone[e.verb], shadow: 0 0 0 3px --paper }} /> // marker dot + paper halo
<Text 10.5px uppercase tracking-0.14em muted-ink>{e.when}</Text>
<Text 14px mt-0.5>
<Text muted-ink>{e.verb} </Text><Text font-medium>{e.what}</Text>
</Text>
{e.note && <Text 12px muted-ink mt-0.5>{e.note}</Text>}
<Pressable onPress={()=>cycleCat(i)} press
accessibilityLabel={`Category: ${cats[i] ?? "uncategorised"}. Tap to change.`}
row align-center gap-1 px-2 py-0.5 rounded-full hairline bg-surface 10.5px muted-ink mt-1.5>
<View w-1.5 h-1.5 rounded-full bg={cats[i] ? accent : hairline} />
<Text>{cats[i] ?? "Add a label"}</Text>
</Pressable>
</View>
)}
</View>
</View>

  <View mt-6 mb-8>
    <MeloLine text="You can undo any of these. Nothing is locked." mood="soft" />
  </View>
</TimelineScreen>

## enginesNeeded

- Local store / transactions feed: the REAL Timeline must read posted `transactions` (and `cycles`) from the local store and render newest-first, replacing the hardcoded 8-item demo array. Verb derives from each transaction's lifecycle (added / edited / paused-a-sub / ignored-a-candidate / left-for-later-from-Review).
- Cycle tracker: doc @reads `cycles` — to group/date-label entries by cycle and resolve relative whens (Today / Yesterday / weekday-date).
- Category model: a PERSISTED per-transaction category (the chip) written through the store (updateTransaction), NOT component-local state as in the web demo.
- Subscription detector / Review provenance: 'Paused', 'Ignored', 'Left for later' verbs come from sub-pause and Review-decision events; the timeline is a projection over those engine outputs.
- No network/AI engine required to RENDER — it is a read projection. Manual entry is failure-only per RN_PORT rules and does not apply to this read-only log.

## fidelityRisks

- Doc-block vs implementation drift: @reads transactions/cycles, @writes removeTransaction, @opens-sheet edit-txn are DECLARED but the body uses a hardcoded array + local-only category cycler and never opens a sheet or removes anything. Port the CONTRACT (read store, row tap -> edit-txn, undo via removeTransaction), not the demo stub. Do not ship the 8 fake rows.
- Category state is component-local and resets on unmount in the web demo — a real bug to NOT replicate. RN must persist category to the store.
- Marker dot 'paper halo' is box-shadow `0 0 0 3px var(--paper)` (a solid ring). RN has no solid spread-shadow — reproduce with two stacked Views (outer paper circle ~15px behind, inner colored dot 9px) so the rail appears to pass behind each node.
- Vertical rail is an absolutely-positioned 1px line behind the list, inset top-2..bottom-2 (NOT full height). Ensure z-order: rail under the dots' paper halos.
- Headline accent uses <em class=not-italic text-accent> — the accent word is terracotta but NOT italic. Don't italicize it. font-display = Fraunces, letterSpacing -0.02em.
- Eyebrow + when labels: uppercase + letterSpacing 0.14em at tiny sizes (12px / 10.5px). RN letterSpacing is px (~1.4–1.7px), not em — convert and verify legibility.
- space-y-5 (20px gaps) -> RN gap or per-row marginTop; avoid a trailing margin after the last row.
- MeloLine wraps copy in literal straight quotes (\"{text}\"), italic Fraunces, muted-ink 13.5px. mood="soft" maps to soft/calm Melo (NOT concern). Keep always-on breathe.
- Header is back / centered eyebrow / equal-width spacer (w-5). Keep the spacer so the eyebrow stays optically centered.
- Chip accessibilityLabel is the a11y contract: announce current category + 'Tap to change.'; set accessibilityRole='button'.
- @copy FROZEN but COPY_DECK.md has no Timeline section — all visible strings are unkeyed inline literals; STATES.md empty copy 'Your story starts here' is missing. Add keys + the empty branch at port time.
- Reduced motion: slide-in-r and press collapse to final / no-op; MeloLine breathe stops. Honor AccessibilityInfo.isReduceMotionEnabled.
- Banned-words check: if RN derives note strings from transactions, avoid generated banned vocab (import/rows/parse/sync/etc.).

## stateBranches

- empty — per STATES.md: 'Your story starts here' empty state (EmptyState primitive: Melo + Fraunces line w/ accent word + body + optional CTA). NOT implemented in current web code (always shows demo rows). RN MUST add this branch for zero transactions.
- loading — n/a per STATES.md (local read projection; no async, no spinner).
- populated — happy path: timeline list newest-first; each row = when / verb+what / optional note / category chip. (Web demo only renders this branch, with fake data.)
- error — n/a per STATES.md.
- offline — same as populated (Folio is local-first; offline invisible here).

## rnPrimitiveMap

- root scroll <div overflow-y-auto no-scrollbar> -> <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle>
- <button onClick> (back, chip) -> <Pressable onPress> + expo-haptics Haptics.selectionAsync(); scale 0.97 active via Pressable/reanimated
- <ul>/<li> + space-y-5 -> <View> with gap (or row Views with marginBottom); FlatList acceptable once store-backed
- <span absolute bg-hairline> rail -> absolutely-positioned <View> backgroundColor theme.hairline, width 1
- box-shadow halo `0 0 0 3px var(--paper)` -> two stacked Views (outer paper circle + inner colored dot); RN can't do solid spread shadows
- CSS vars var(--accent) etc -> theme object + useTheme()/makeStyles (repo kitTheme pattern)
- font-display (Fraunces) -> embedded Fraunces; letterSpacing -0.02em (~ -0.56px at 28px)
- <em class=not-italic text-accent> -> nested <Text style={{color: theme.accent}}> (no fontStyle italic)
- uppercase + tracking -> textTransform:'uppercase' + letterSpacing in px
- <MeloLine> -> existing RN MeloLine kit (Melo SVG via react-native-svg + reanimated breathe + Fraunces italic <Text>)
- aria-label -> accessibilityLabel; chip -> accessibilityRole='button'
- slide-in-r entrance -> reanimated entering (translateX 28->0 + fade, 360ms) or Animated on mount
- rounded-full chip/dots -> borderRadius: 999
- hairline utility (1px border) -> borderWidth:1, borderColor: theme.hairline (design specifies 1px, not StyleSheet.hairlineWidth)

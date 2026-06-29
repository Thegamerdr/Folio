# LogSpendSheet  (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetLogSpend.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetLogSpend.tsx

## rnComponentName

LogSpendSheet

## purpose

Quick manual spend entry — capture merchant, amount, and category, then write a single negative-amount manual transaction to the store and close. Fast-path "what just left?" capture sheet, NOT a reader/extraction flow (manual entry is the failure-only path per RN_PORT.md; never route reader users here).

## enginesNeeded

- @/lib/store.addTransaction (pure local store write; already the canonical RN action; clamps to 200 entries)
- Transaction type (category union food|transport|fun|bills|shopping|income|other — chip set EXCLUDES 'income'; source union includes 'manual')
- NO money-path/cycle/reader engine invoked here — sheet only appends a fact; downstream verdict/insights recompute from the store as a side effect, not called directly

## reads

- (none — local component state only: merchant string, amount string, selected category default "food")

## writes

- addTransaction({ merchant, amount: -v, category, source: "manual" }) from @/lib/store; amount stored NEGATIVE (spend); source hardcoded "manual"; store clamps list to 200 entries

## opensSheets

- (none — does not open any other sheet; only calls onClose to dismiss itself)

## copyKeys

- Log a spend (eyebrow — NOT in COPY_DECK; literal)
- What just left? (headline — NOT in COPY_DECK; literal)
- Where · e.g. Tesco (merchant placeholder — literal)
- Amount (field label uppercase — literal)
- £ (currency.symbol)
- 0 (amount placeholder — literal)
- food / transport / fun / bills / shopping / other (chip labels — Transaction.category union EXCLUDING 'income')
- Log it (primary CTA — literal)
- Not yet (dismiss CTA — literal)

## tokens

- --surface (merchant input bg; amount card bg)
- --hairline (input/card borders via .hairline = 1px solid --hairline)
- --accent (merchant focus ring; £ + amount input text; primary CTA bg)
- --muted-ink (eyebrow; 'Amount' label; 'Not yet'; disabled CTA bg at /30)
- --ink (selected chip bg; default chip text)
- --paper (selected chip text; Sheet body ground)
- --inset (unselected chip bg)
- white #FFFFFF (primary CTA text = --color-primary-foreground)
- font-display Fraunces (italic eyebrow, headline, £, amount input)
- --shadow-sheet (inherited from Sheet shell)

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — inherited from Sheet
- scrim-in (320ms ease-out) — inherited from Sheet scrim
- press (120ms ease, scale 0.97 on :active) — on every category chip, 'Log it', 'Not yet'

## moods

- (none — Melo does NOT appear; no <Melo>/<MeloLine>. MELO_MOODS.md lists no entry for SheetLogSpend. Do not add Melo — 'No mood = no Melo'.)

## componentTree

<Sheet onClose title="Log a spend"> [gorhom BottomSheetModal: 40% --ink scrim, 28px top radius, --paper body, 3px×36px hairline grip, sheet-rise] > <View px-1 pb-2> [ <Text font-display italic 13 muted-ink>Log a spend</Text> ; <Text font-display 24 leading-tight mt-0.5>What just left?</Text> ; <TextInput autoFocus value={merchant} onChangeText={setMerchant} placeholder="Where · e.g. Tesco" mt-4 wFull bg(--surface) hairline radius12 px-4 py-3 text-14 (focus→borderColor --accent)> ; <View mt-3 bg(--surface) hairline radius16 px-5 py-4 row items-baseline justify-between> [ <Text 11 uppercase tracking-0.12em muted-ink>Amount</Text> ; <View row items-baseline> [ <Text font-display 28 accent tabular>£</Text> ; <TextInput value={amount} onChangeText={t=>setAmount(t.replace(/[^0-9.]/g,''))} keyboardType="decimal-pad" placeholder="0" w-24(~96) bgTransparent textRight font-display 34 accent tabular> ] ] ; <View mt-3 row flex-wrap gap-1.5>{cats.map(c => <Pressable key={c} onPress={()=>setCategory(c)} press+haptics h-8 px-3 radiusFull text-12 {category===c ? bg(--ink)+text(--paper) : bg(--inset)+text(--ink)}><Text>{c}</Text></Pressable>)}</View> ; <Pressable onPress={save} disabled={!merchant.trim()||!(parseFloat(amount)>0)} press mt-5 wFull h-12 radius16 bg(--accent) text-14 medium white (disabled→bg --muted-ink @30%)><Text>Log it</Text></Pressable> ; <Pressable onPress={onClose} press mt-2 wFull h-10 text-12.5 muted-ink><Text>Not yet</Text></Pressable> ] </Sheet>

## fidelityRisks

- Eyebrow ('Log a spend'), headline ('What just left?'), placeholders/CTAs ('Where · e.g. Tesco', 'Amount', '0', 'Log it', 'Not yet') are NOT in COPY_DECK.md — its own rule says unkeyed strings don't ship; add keyed entries before RN ship, don't bake literals.
- Doc block says @copy FROZEN but the strings aren't in the deck — flag the contradiction; freeze = port verbatim but they still need keys.
- Amount stored NEGATIVE (amount: -v); dropping the sign on port corrupts the money path (inflow vs spend). v = parseFloat(sanitized amount).
- Category chips EXCLUDE 'income' though the type includes it — spend-only; use the explicit cats array, don't generate from the full union.
- Default category is 'food' (not unset) — preserve the default selection.
- Validation duplicated: disabled prop AND save() early-return share predicate (merchant.trim() && parseFloat(amount) > 0) — keep both so a programmatic save can't bypass the gate.
- '£' is a separate Text beside the input (28px) vs input (34px), baseline-aligned — RN row baseline alignment is fragile; verify £ sits on the digits' baseline.
- Amount sanitizer allows multiple dots ('1.2.3' passes the char filter); match web behavior (no multi-dot block) for parity rather than 'fixing' it.
- No Melo on this sheet — resist adding one (MELO_MOODS.md assigns none).
- Sheet body sits on --paper, inner cards on --surface — inverting kills the 'paper lifting from paper' depth.
- press scale 0.97 on chips + both CTAs; under reduced-motion collapse to final state (MOTION.md).
- autoFocus opens the keyboard immediately — set gorhom keyboardBehavior so amount card + CTAs stay reachable above the keyboard.
- Disabled CTA color is --muted-ink at /30 alpha, NOT a separate token — compute alpha, don't substitute --hairline.
- Spacing/radius mapping: rounded-xl=12 rounded-2xl=16 rounded-full=pill; w-24≈96px w-9 grip=36px; 4px scale (mt-4=16 mt-3=12 mt-5=20 mt-2=8 py-3=12 py-4=16 px-4=16 px-5=20 h-8=32 h-12=48 h-10=40 gap-1.5=6).

## stateBranches

- populated/default: the only branch — form always rendered ready (merchant='', amount='', category='food'). No empty/loading/error/offline branches in source.
- CTA disabled: 'Log it' disabled until merchant.trim() non-empty AND parseFloat(amount) > 0; renders bg(--muted-ink)/30. Only conditional visual.
- category-selected: exactly one chip active (bg --ink / text --paper); rest bg --inset / text --ink; default 'food'.
- save() guard: trims merchant, parses amount; if !m || !(v>0) returns early (silent no-op, no error UI) — matches the disabled gate.
- STATES.md has no row for this sheet — treat as single-state input form; offline irrelevant (local write), no loading (synchronous), no error surface (validation is preventive via disabled CTA).

## rnPrimitiveMap

- <Sheet> → @gorhom/bottom-sheet BottomSheetModal (40% --ink scrim, 28px top radius, --paper body NOT --surface, 3px×36px hairline grip, sheet-rise spring); body = BottomSheetScrollView (no-scrollbar) max-height 82%.
- <input> (merchant) → <TextInput autoFocus>; focus ring → animate borderColor to --accent + borderWidth 1 on focus.
- <input inputMode=decimal> (amount) → <TextInput keyboardType="decimal-pad">; onChangeText sanitize .replace(/[^0-9.]/g,''); textAlign right.
- tabular → <Text style={{fontVariant:['tabular-nums']}}> on £ and amount.
- font-display Fraunces → embedded family; italic eyebrow needs Fraunces-Italic face.
- <button> chips + CTAs → <Pressable> + expo-haptics Haptics.selectionAsync() to emulate .press; scale to 0.97 on pressIn (reanimated).
- hairline → borderWidth StyleSheet.hairlineWidth (or 1) + borderColor --hairline.
- rounded-xl/2xl/full → borderRadius 12 / 16 / 9999.
- disabled:bg-[var(--muted-ink)]/30 → backgroundColor --muted-ink @30% alpha when disabled.
- CSS var tokens → theme object + useTheme() hook (no hardcoded colors).
- w-24 amount → ~96px; w-9 grip → 36px.
- Tailwind spacing → 4px scale (px-1=4 mt-4=16 mt-3=12 mt-5=20 mt-2=8 py-3=12 py-4=16 px-4=16 px-5=20 h-8=32 h-12=48 h-10=40 gap-1.5=6).

## docBlock

/**
 * @rn-sheet     LogSpendSheet
 * @purpose      Quick manual spend entry — merchant, amount, category.
 * @writes       addTransaction
 * @copy         FROZEN
 * @tokens       --surface --hairline --accent
 */


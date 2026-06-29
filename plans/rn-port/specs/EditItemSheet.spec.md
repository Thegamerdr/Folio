# EditItemSheet  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetEditItem.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetEditItem.tsx

## rnComponentName

EditItemSheet

## purpose

Bottom sheet to correct a single found money item (name, amount, date, type, optional note) before it counts toward the money path. Per the @rn-sheet block: "Edit a found item (merchant, amount, category) before it's added." It is the per-row Review/fix surface that reader output (statement/photo/paste) flows into — the user checks one candidate, then Saves, Ignores, or Cancels.

## reads

- Currently NONE from a store — the web prototype hardcodes local component state only. props: onClose: () => void.
- Local useState seeds (placeholders, NOT store reads): name = "Tesco", amount = "42.00", type = "spending".
- Hardcoded display-only date: "26 Jun" (no state, no engine wiring in the prototype).
- Static type option list: ["spending", "income", "bill", "debt payment", "transfer", "refund"].

## writes

- @writes in doc block = — (NONE). The prototype is pure-local: all three buttons (Save changes, Ignore this, Cancel) call onClose only; nothing is persisted.
- RN PORT REQUIREMENT (not in prototype): Save changes -> writes the edited candidate item (name/amount/date/type/note) back through the Review pipeline so the money-path engine recomputes; Ignore this -> drops this candidate from the batch; Cancel -> closes with no change. These store actions must be defined in the RN app (e.g. updateReviewItem / dropReviewItem) — the prototype has none.

## opensSheets



## copyKeys

- Check this item
- Correct anything before it counts.
- Name
- Amount
- Date
- 26 Jun
- Type
- spending
- income
- bill
- debt payment
- transfer
- refund
- Note (optional)
- Weekly shop
- Save changes
- Ignore this
- Cancel
- × (close glyph)
- £ (currency.symbol)
- Tesco (seed value)
- 42.00 (seed value)

## tokens

- --surface
- --hairline
- --accent
- --muted-ink
- --inset
- --negative
- --paper (from Sheet shell)
- --ink (Sheet scrim + grip)
- white / #FFFFFF (primary-foreground on accent buttons)
- font-display (Fraunces — headline + £ symbol + amount input)
- tabular (tabular-nums — £ + amount)
- shadow-sheet (Sheet shell)

## motions

- press (120ms scale 0.97 on every tappable: close ×, type chips, Save, Ignore, Cancel)
- sheet-rise (480ms cubic-bezier(.16,1,.3,1) — sheet body slide-up+fade, from Sheet shell .sheet-in)
- scrim-in (320ms ease-out — ink scrim fade to 45%, from Sheet shell)

## componentTree

<EditItemSheet onClose>            // wraps <Sheet> (gorhom BottomSheetModal: 40% ink scrim, 28px top radius, 4px hairline grip, paper body)
  <Sheet onClose title="Check this item">
    <Row spaceBetween>                // header
      <Eyebrow>Check this item</Eyebrow>   // 11px uppercase tracking .14em muted-ink
      <Pressable press onPress={onClose}><Text muted 18px>×</Text></Pressable>
    </Row>
    <Headline font-display 24px mt-2 leading-tight>Correct anything before it counts.</Headline>
    <Stack mt-5 gap-3>                 // space-y-3
      <Field label="Name">            // surface + hairline + rounded-xl px4 py3 <label>
        <TextInput value={name} onChangeText={setName} 15px font-medium />
      </Field>
      <Grid cols-2 gap-3>
        <Field label="Amount">
          <Row baseline gap-1>
            <Text font-display tabular 18px>£</Text>
            <TextInput value={amount} onChangeText={setAmount} font-display tabular 18px keyboardType="decimal-pad" />
          </Row>
        </Field>
        <Field label="Date"><Text 15px font-medium mt-1>26 Jun</Text></Field>   // static in prototype; RN: open date picker
      </Grid>
      <Field label="Type">            // surface card, chips wrap
        <ChipRow flexWrap gap-1.5 mt-2>
          {types.map(t =>
            <Chip press selected={type===t} onPress={()=>setType(t)}>  // selected: bg accent + white; else: bg inset + muted-ink; rounded-full 12px px3 py1.5
              {t}
            </Chip>)}
        </ChipRow>
      </Field>
      <Field label="Note (optional)">
        <TextInput placeholder="Weekly shop" 14px placeholderColor=muted-ink />
      </Field>
    </Stack>
    <PrimaryButton press onPress={onClose} mt-6 fullWidth h-54 rounded-2xl bg-accent text-white 15px font-medium>Save changes</PrimaryButton>
    <Grid cols-2 gap-2.5 mt-2>
      <SecondaryButton press onPress={onClose} h-12 rounded-xl bg-surface hairline 13px text-negative>Ignore this</SecondaryButton>
      <SecondaryButton press onPress={onClose} h-12 rounded-xl bg-surface hairline 13px>Cancel</SecondaryButton>
    </Grid>
  </Sheet>
</EditItemSheet>

## enginesNeeded

- Statement reader / Photo reader / Text-file reader (upstream): produce the candidate item this sheet edits. RN_PORT.md forbids replacing a reader with a manual form — this sheet is the per-item Review/correct step on reader output, NOT a blank manual-entry form.
- Review pipeline: holds the editable candidate batch; Save must route the corrected item back so it can change the money path; Ignore drops it. (Prototype has none — onClose only.)
- Money path engine (downstream): RN_PORT.md — Review output must be checked before it changes the money path. Save here triggers recompute.
- Subscription detector (adjacent): the "bill"/recurring type interacts with recurring-charge detection in the real app.
- Local store + sync: persists the corrected item (SQLite/Drizzle/WatermelonDB) per RN_PORT.md local-first promise.
- Currency/locale formatting (£, decimal-pad, ICU per COPY_DECK localization note).

## fidelityRisks

- onClose is overloaded for THREE distinct intents (Save / Ignore / Cancel) in the prototype — the RN port must NOT collapse them to one handler; wire separate store actions or the edit silently no-ops.
- Date is hardcoded "26 Jun" with no state — easy to ship a dead label. RN needs a real date value + date picker, while keeping the exact "DD Mon" format.
- Amount input must use tabular-nums + font-display and a decimal keypad; using the body grotesk or default keyboard breaks the money-reads-as-money rule. Don't reformat to "42K"-style.
- The £ symbol is a separate baseline-aligned Fraunces span beside the input, not a prefix inside the TextInput — replicate the baseline gap-1 row or it looks glued on.
- Type chips: selected = --accent bg + white text, unselected = --inset bg + --muted-ink. gorhom/RN must keep the rounded-full pill shape, 12px, px-3 py-1.5, and flex-wrap; collapsing to a horizontal scroller changes the feel.
- Sheet body sits on --paper (NOT --surface) per Sheet @rn-port — the field cards are --surface on --paper. Inverting these flattens the paper-on-paper depth.
- Header eyebrow is 11px uppercase tracking .14em; field labels are 11px uppercase tracking .12em — two different tracking values, easy to unify by mistake.
- @copy FROZEN: every string is locked. "Correct anything before it counts.", "Ignore this", "Note (optional)", placeholder "Weekly shop" must be verbatim and live in COPY_DECK (currently these are NOT in COPY_DECK.md — flag: copy deck is incomplete for this sheet, but strings are frozen as written in source).
- Banned-words check: type option "transfer" and label text are fine, but do NOT relabel toward banned terms (import/parse/extract/sync). Keep verbs/plain nouns.
- No EmptyState here, but state branches still apply: this sheet is only meaningful in the populated/error Review context — RN should not present it as a standalone blank create form (violates RN_PORT 'never replace an engine with a manual form').
- press motion = scale 0.97 via Pressable + Haptics.selectionAsync(); reduced-motion collapses to final state (no scale). Don't add a second infinite animation — no Melo on this sheet.
- Negative action color is --negative (#C5503E) for "Ignore this" text only; do not turn it into a red destructive button — voice is calm, not alarmist.
- × close glyph is a literal multiplication sign at 18px muted-ink, top-right — keep it as text/glyph, not a swapped lucide X, to match weight unless the app standardizes on lucide-react-native X across all sheets.

## docBlock

/**
 * @rn-sheet     EditItemSheet
 * @purpose      Edit a found item (merchant, amount, category) before it's added.
 * @writes       —
 * @copy         FROZEN
 * @tokens       --surface --hairline --accent
 */

## moods

- NONE — this sheet renders no Melo. Per MELO_MOODS.md "No mood = no Melo"; the sheet has no Melo instance. (Contextually the surrounding Add-entry/Review flow uses curious while reading and cheer on success, but the edit sheet itself shows none.)

## rnPrimitiveMap

- <Sheet> (web div + scrim) -> @gorhom/bottom-sheet BottomSheetModal: 40-45% --ink scrim, 28px top radius, 3-4px --hairline grip, sheet-rise spring curve cubic-bezier(.16,1,.3,1) ~480ms, body on --paper.
- <div>/<span> -> <View>/<Text>
- <label> field card -> <View> (style only; RN has no <label>)
- <input> (name/amount/note) -> <TextInput> (bg transparent, no border, placeholderTextColor=--muted-ink; amount uses keyboardType='decimal-pad').
- <button> type chips + actions -> <Pressable> + expo-haptics Haptics.selectionAsync() for the press feel.
- CSS tokens (--surface/--accent/etc.) -> theme object + useTheme() hook; no hardcoded hex.
- hairline border -> StyleSheet.hairlineWidth (or 1px) in --hairline.
- press utility -> Pressable pressed-state transform scale 0.97 via reanimated, honoring AccessibilityInfo.isReduceMotionEnabled.
- font-display Fraunces -> embedded Fraunces font family; body 'Inter Tight'/SF Pro/Roboto.
- tabular (font-variant-numeric) -> <Text style={{ fontVariant: ['tabular-nums'] }}>.
- grid grid-cols-2 -> flexDirection row with two flex:1 children + gap (or columnGap).
- × glyph -> <Text>×</Text> (or lucide-react-native X if standardized).
- Date static text -> RN date value + native date picker (@react-native-community/datetimepicker), formatted 'DD Mon'.
- space-y-3 / gap utilities -> gap / rowGap on the container View.

## stateBranches

- populated (the only designed branch): seeded fields render — Name=Tesco, Amount=42.00, Date=26 Jun, Type=spending selected, empty Note with placeholder. This is the happy path.
- empty: N/A as a standalone — this sheet edits an existing candidate item, so 'empty' means it should not be shown at all (no item to check). RN must not repurpose it as a blank manual-entry create form (RN_PORT ban).
- loading: N/A on the sheet itself — reading happens upstream (Add-entry / PdfSuccess shows Melo curious + 'Folio is reading…'); by the time this sheet opens, the candidate is ready.
- error: not designed in the prototype. RN should handle a bad/unreadable candidate via the upstream Review error copy (err.statement.unreadable 'Folio couldn't read this one. Saved as a note.' / add flow 'skip for now'), not inside this sheet. Honest copy, one recovery, per STATES.md.
- offline: same as populated — Folio is local-first; editing a candidate needs no network. Save persists locally (RN local store).


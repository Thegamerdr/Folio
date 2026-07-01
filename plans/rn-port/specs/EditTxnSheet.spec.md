# EditTxnSheet (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetEditTxn.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetEditTxn.tsx

## rnComponentName

EditTxnSheet

## purpose

Bottom sheet to edit an existing transaction. Shows the transaction's identity (merchant + date) as a header and its editable fields (Amount, Category, Repeat, Note) as tappable rows, with a single primary "Save changes" action. In the RN app the save commits via removeTransaction + addTransaction (delete-then-insert replacement). In this web prototype the fields are hardcoded placeholders and Save is wired only to onClose (no real edit, no field editing, no store read/write) — fidelity work lives in the RN port.

## docBlock

/\*\*

- @rn-sheet EditTxnSheet
- @purpose Edit an existing transaction.
- @writes removeTransaction + addTransaction (replacement)
- @copy FROZEN
- @tokens --surface --hairline --accent --negative
  \*/

## reads

- the transaction being edited (by id) — its merchant/payee, date, amount, category, repeat/recurrence, note. NOTE: not actually read in the web prototype (hardcoded 'Tesco · 26 June' + 4 placeholder field values); the RN port must read the real transaction from the store/money-path data by id

## writes

- removeTransaction(id) — declared in @rn-sheet doc block
- addTransaction(replacement) — declared in @rn-sheet doc block; edit is modeled as delete-then-insert (replacement), not in-place mutation. NEITHER is wired in the web prototype — Save only calls onClose().

## opensSheets

## copyKeys

- Edit transaction (header eyebrow label — literal string, NOT in COPY_DECK.md)
- Tesco · 26 June (title — hardcoded placeholder merchant+date; RN renders {payee} · {date} from the real txn)
- Amount (field row label — literal)
- £42.00 (field row value — hardcoded placeholder; RN renders the real amount as Money/tabular)
- Category (field row label — literal)
- Groceries (field row value — placeholder)
- Repeat (field row label — literal)
- Once (field row value — placeholder)
- Note (field row label — literal)
- Weekly shop (field row value — placeholder)
- Save changes (primary button — literal)
- × (close glyph)
- Close sheet (Sheet scrim aria-label, from Sheet primitive)

## tokens

- --surface
- --hairline
- --accent
- --negative
- --muted-ink
- --paper (via Sheet body)
- --ink (via Sheet scrim + glyph)
- --font-display (Fraunces, on title h3)
- shadow-sheet (via Sheet)
- radius: rounded-xl (12px) field rows
- radius: rounded-2xl (24px / radius-xl) Save button
- radius: rounded-t-[28px] (Sheet top)
- text-white / --color-primary-foreground (#FFFFFF on accent button)

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1) — Sheet body slide-up+fade, via Sheet primitive)
- scrim-in (320ms ease-out — scrim fade to 45% ink, via Sheet primitive)
- press (120ms ease, scale 0.97 on :active — close button + Save button; RN = Pressable + Haptics.selectionAsync())

## componentTree

<Sheet onClose={onClose} title="Edit transaction"> {/_ gorhom BottomSheetModal: 40% ink scrim, 28px top radius, paper body, sheet-rise spring _/}
<View row spaceBetween> {/_ flex items-center justify-between _/}
<Text eyebrow>Edit transaction</Text> {/_ 11px, uppercase, tracking 0.14em, --muted-ink _/}
<Pressable press onPress={onClose}> {/_ × glyph, 18px, --muted-ink _/}
<Text>×</Text>
</Pressable>
</View>
<Text display title>Tesco · 26 June</Text> {/_ font-display 24px, mt-2, leading-tight; RN: {payee} · {date} _/}

<View mt-5 gap-3> {/_ space-y-3 _/}
{fields.map(f => {/_ [{Amount,£42.00},{Category,Groceries},{Repeat,Once},{Note,Weekly shop}] _/}
<View row spaceBetween key={f.k}
style={surface + hairline + rounded-xl + px-4 py-3}>
<Text label>{f.k}</Text> {/_ 12px, uppercase, tracking 0.12em, --muted-ink _/}
<Text value>{f.v}</Text> {/_ 14px, font-medium; amount uses Money/tabular in RN _/}
</View>
)}
</View>

<Pressable press onPress={onClose} {/_ RN: onPress = commit edit (remove+add) then close _/}
style={mt-6 + w-full + h-[54px] + rounded-2xl + bg-accent}>
<Text style={white + font-medium + 15px}>Save changes</Text>
</Pressable>
</Sheet>

## enginesNeeded

- Money path engine (the transaction record being edited belongs to the local money data the route is computed from; editing it re-runs the verdict/route)
- Local store + SQLite (Drizzle/WatermelonDB) — removeTransaction + addTransaction persist here; edit = delete-then-insert replacement
- Subscription detector (the 'Repeat' field = recurrence; changing it from/to a recurring cadence feeds the recurring-charge detector)
- (no Statement/Photo/Text reader needed — this is post-Review editing of an already-committed item)

## fidelityRisks

- Prototype shows HARDCODED placeholder data ('Tesco · 26 June', £42.00, Groceries, Once, Weekly shop) — RN must hydrate every value from the real transaction by id; do not ship the literals.
- Fields are display-only rows in the prototype (no inputs). RN must make Amount/Category/Repeat/Note actually EDITABLE (likely each row opens an editor: number pad for Amount, picker for Category, recurrence picker for Repeat, text input for Note). The doc block's removeTransaction+addTransaction implies real edits exist.
- Save is a no-op stub (onClick={onClose}). RN Save must commit (removeTransaction(oldId) + addTransaction(edited)) THEN close — and only then. Wiring Save to plain close loses the user's edits.
- @tokens declares --accent AND --negative, but --negative is never used in the visible markup. --negative is almost certainly for a missing DELETE/Remove transaction action (delete-then-insert + a destructive 'Remove' affordance). The RN port likely needs a Remove/Delete control styled in --negative that the prototype omits.
- Edit-as-replacement (remove+add) can change the transaction's id/ordering/timestamp. RN must preserve identity/date semantics so the money path and any sub-detection don't treat it as a brand-new charge.
- Header eyebrow 'Edit transaction' and all field labels are literal strings NOT in COPY_DECK.md — COPY_DECK is the source of truth and says 'if a string isn't here, it doesn't ship'. These keys must be added to COPY_DECK before RN ship (this sheet is not in the deck at all).
- No Melo on this sheet and none is mandated (MELO_MOODS has no row for SheetEditTxn — 'No mood = no Melo'). Do not add one. But @copy is FROZEN, so don't restyle copy either.
- 'Repeat: Once' uses non-banned vocabulary; keep recurrence copy plain ('Once' / 'Monthly' / 'Yearly') — avoid banned words like 'sync'. Amount must render via Money/tabular-nums (fontVariant: ['tabular-nums']), never abbreviated ('£42.00', never '42K').
- Sheet body sits on --paper not --surface (paper-lifting-from-paper); the field rows sit on --surface with a hairline — preserve this two-layer contrast or the rows vanish into the sheet.
- State branches: STATES.md has no row for this sheet. Treat as populated-only (it only opens for an existing txn). RN should still guard the missing-txn case (txn deleted/not found → close gracefully) and offline (local-first: edit persists locally with no network).
- Close (×) and scrim-tap both dismiss with NO confirmation — acceptable while fields are display-only, but once edits are real the RN port should consider discard-confirm or autosave to avoid silent data loss.

## rnPrimitiveMap

- <Sheet> -> @gorhom/bottom-sheet BottomSheetModal (40% ink scrim, 28px top radius, 4px hairline grip, sheet-rise spring; body on --paper)
- <div> layout -> <View>
- <span>/<h3> text -> <Text> (h3 uses embedded Fraunces / --font-display)
- <button> (× close, Save) -> <Pressable> + expo-haptics Haptics.selectionAsync() for the 'press' feel
- field value £42.00 -> <Money>/<Text> with fontVariant: ['tabular-nums']
- Tailwind utility classes -> StyleSheet via theme object + useTheme() (no hardcoded colors/fonts)
- hairline class (1px --hairline border) -> StyleSheet.hairlineWidth + theme.hairline
- CSS .press / :active scale 0.97 -> reanimated withTiming scale 0.97 on pressIn (or Pressable style fn)
- CSS var(--accent) bg + text-white -> theme.accent / '#FFFFFF' (primary-foreground)
- .map() over field array -> FlatList not needed; static .map() over a typed fields array is fine (4 fixed rows)
- rounded-xl / rounded-2xl -> borderRadius from radius scale (12 / 24)
- × glyph -> lucide-react-native 'X' icon (preferred over literal ×) sized ~18, color --muted-ink

## stateBranches

- populated — the only designed branch: an existing transaction's header + 4 field rows + Save (prototype always renders this with placeholder data)
- empty — n/a (sheet only opens for an existing txn; RN should guard txn-not-found by closing)
- loading — n/a (no async; edits are local/instant — no spinner per STATES.md 'No spinners' rule)
- error — not designed; RN save failure (store write) should surface honest copy + keep the sheet open (one clear recovery), per STATES error rule
- offline — same as populated (local-first; edit persists with no network, no 'sync' language)

## moods

# CalendarConnectSheet (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetCalendarConnect.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetCalendarConnect.tsx

## rnComponentName

CalendarConnectSheet

## purpose

Design-only bottom sheet that pitches a one-way Google Calendar push (Folio writes money dates out, never reads the user's calendar back). The web prototype's primary button is a placeholder that fires a toast and closes; the real OAuth + push sync is a NEW RN engine that does not exist in the prototype.

## reads

## writes

## opensSheets

## copyKeys

- (NO COPY_DECK KEYS — every string is inline-frozen in the component; doc block says @copy FROZEN but there are no calendar.connect.\* entries in COPY_DECK.md)
- Connect (eyebrow label)
- Close (aria-label on × button)
- Your money dates in Google. (headline; 'Google.' is the accent word, rendered non-italic em in --accent)
- One way — Folio adds the dates that move your money. Folio doesn't read anything back from Google. (subhead)
- What we'd add (section eyebrow)
- Paydays (list item, --positive dot)
- Bills & renewals (list item, --negative dot)
- Deadlines (list item, --caution dot)
- Things you added (list item, --accent dot)
- What stays out (section eyebrow)
- Spend, amounts on each event, and your spare figure. (stays-out item)
- Anything from your Google calendar — Folio never reads it. (stays-out item)
- Connect Google (primary button)
- Not now (secondary button)
- The live Google link ships with the phone app. (footnote, italic, centered)
- TOAST title: Connecting moves to your phone
- TOAST description: Set up the live Google link in the Folio app.
- TOAST duration: 4500ms

## tokens

- --paper
- --accent
- --inset
- --hairline
- --muted-ink
- --surface
- --positive
- --negative
- --caution
- --ink (via Sheet scrim)
- #FFFFFF (button text → map to --color-primary-foreground / theme white)
- --shadow-sheet (via Sheet)
- radius-2xl 32px (rounded-2xl cards/buttons)
- radius 28px top (sheet, via Sheet primitive)

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — via Sheet primitive
- scrim-in (320ms ease-out, scrim to 45% --ink) — via Sheet primitive
- press (120ms ease, scale 0.97 on active) — on the × button + both action buttons + Not-now

## moods

- calm — per MELO_MOODS.md the Privacy/quiet-sheet family is calm. NOTE: this component renders NO <Melo> instance at all (no mood currently shown); if a Melo is added on port, use calm. 'No mood = no Melo' rule applies — current design intentionally omits him.

## stateBranches

- populated — the only branch this sheet renders; it is a static pitch surface with no async, no data, no fetch. No empty/loading/error/offline variants exist (STATES.md has no Calendar-Connect row). handleConnect is a non-functional placeholder (toast + close), so there is no real success/error state to branch on in the prototype. On RN, the real OAuth flow will introduce loading (Melo curious + calm line, no spinner) and error (honest copy, one recovery) branches that must be authored when the push engine lands.

## componentTree

<BottomSheetModal aria-label="Connect Google Calendar"> // @gorhom/bottom-sheet, 28px top radius, --paper body, grip, scrim 45% --ink
<SheetBody> // px-6 pt-2 pb-6, scrollable
<Row justify="space-between" align="center"> // header row
<Eyebrow>Connect</Eyebrow> // 11px, uppercase, tracking 0.14em, --muted-ink
<PressableIcon aria-label="Close" onPress={onClose}>×</PressableIcon> // 18px, --muted-ink, press
</Row>
<Headline> // Fraunces, 26px, leading-tight, mt-2
Your money dates in <Accent>Google.</Accent> // <Accent> = --accent, NON-italic (em not-italic)
</Headline>

<Body>One way — Folio adds the dates that move your money. Folio doesn't read anything back from Google.</Body> // 13px, --muted-ink, leading-relaxed, mt-2
<Card surface="--surface" hairline rounded-2xl p-4 mt-5> // "What we'd add"
<Eyebrow size={10.5}>What we'd add</Eyebrow>
<List mt-2 gap-1.5 text-13>
<Item><Dot color="--positive"/>Paydays</Item>
<Item><Dot color="--negative"/>Bills & renewals</Item>
<Item><Dot color="--caution"/>Deadlines</Item>
<Item><Dot color="--accent"/>Things you added</Item>
</List>
</Card>
<Card surface="--inset" rounded-2xl p-4 mt-4> // "What stays out" (no hairline)
<Eyebrow size={10.5}>What stays out</Eyebrow>
<List mt-2 gap-1.5 text-13 color="--muted-ink"> // plain text items, no dots
<Item>Spend, amounts on each event, and your spare figure.</Item>
<Item>Anything from your Google calendar — Folio never reads it.</Item>
</List>
</Card>
<PrimaryButton onPress={handleConnect} h={54} rounded-2xl bg="--accent" textColor=white weight=medium size={15} press mt-5 fullWidth>Connect Google</PrimaryButton>
<SecondaryButton onPress={onClose} h={44} rounded-2xl size={13.5} color="--muted-ink" press mt-2 fullWidth>Not now</SecondaryButton>
<Footnote italic center size={10.5} color="--muted-ink" mt-3>The live Google link ships with the phone app.</Footnote>
</SheetBody>
</BottomSheetModal>

## enginesNeeded

- NEW RN ENGINE — Google Calendar one-way PUSH (RN OAuth + sync engine). Explicitly flagged in the doc block (@rn-engine) and in handleConnect's CLAIM comment as NOT existing in the prototype. The button must not pretend to work until this ships.
- No store/data/derived-money dependency — this sheet reads and writes nothing (@reads — / @writes —).
- sonner toast (web) → RN toast/snackbar equivalent for the placeholder feedback path (until the real engine replaces it).

## fidelityRisks

- COPY GAP: doc block says @copy FROZEN but NONE of these strings exist in COPY*DECK.md (no calendar.connect.* keys). RN rule 'if a string isn't in COPY*DECK it doesn't ship' — these strings must be added to COPY_DECK before/while porting, keyed (e.g. calendar.connect.*), not hardcoded. Don't silently invent new wording.
- BANNED-WORD ADJACENCY: COPY_DECK bans 'sync'. This is a Calendar SYNC/push feature — keep the user-facing copy clear of 'sync' (the current strings already avoid it; preserve that on port).
- HONEST-CLAIMS rule: 'Folio doesn't read anything back from Google' / 'Folio never reads it' are privacy assertions. Per COPY_DECK these may ship ONLY if literally true of the shipped RN app. The real OAuth scope must be write/one-way before this copy is allowed live — verify scope, or soften copy.
- PLACEHOLDER BEHAVIOR: handleConnect is a fake (toast + close). RN must replace it with the real OAuth flow; do NOT port the toast as the shipped behavior. Per RN_PORT 'do not pretend it works here'.
- ACCENT WORD: 'Google.' uses em with not-italic + --accent (accent-word-but-not-italic). Easy to mis-port as italic; Fraunces headline + ONE accent word per headline is the rule — keep it non-italic colored, include the trailing period inside the accent.
- NO MELO: this sheet has no <Melo>. Don't add one on port unless intentionally chosen (MELO_MOODS 'No mood = no Melo'); if added, mood=calm.
- CARD CONTRAST: two cards use DIFFERENT grounds — 'What we'd add' = --surface WITH hairline border; 'What stays out' = --inset with NO border. Theme both correctly; don't unify them.
- DOT SEMANTICS: the four colored dots are semantic (positive/negative/caution/accent map to paydays/bills/deadlines/added) — keep dot↔label color pairing exact; color carries meaning so pair with the label text (a11y).
- MISSING STATE BRANCHES: prototype only has the static populated view. When the real push engine lands, loading (Melo curious + line, NO spinner, 4s max) and error (honest copy, one recovery) branches must be authored — they are not in this file.
- SHEET PRIMITIVE INHERITANCE: scrim 45% --ink, 28px top radius, paper (NOT surface) body, grip 36x3, top-edge highlight, max-height 82%, sheet-rise+scrim-in. These come from <Sheet>; port via @gorhom/bottom-sheet with matching curve, don't fade the sheet.
- BUTTON TEXT COLOR: primary button uses literal white text on --accent — map to theme primary-foreground (#FFFFFF) so it survives dark mode rather than hardcoding white.
- FIXED PX TYPE SIZES (11/10.5/13/13.5/15/18/26) and letter tracking 0.14em are intentional editorial rhythm — preserve exact sizes; don't round to a coarse scale.
- REDUCED MOTION: press + sheet-rise + scrim-in must collapse to final state under AccessibilityInfo.isReduceMotionEnabled (RN), matching the web prefers-reduced-motion behavior.

## docBlock

/\*\*

- @rn-sheet CalendarConnectSheet
- @purpose Design surface for the one-way Google Calendar push.
-               Explains what gets sent; the actual OAuth + sync ships in RN.
- @reads —
- @writes —
- @copy FROZEN
- @tokens --paper --accent --inset --hairline
-
- @rn-engine Google push requires RN OAuth + sync engine. The web
-               prototype is design-only — the primary button toasts.
  \*/

## rnPrimitiveMap

- <Sheet> → @gorhom/bottom-sheet BottomSheetModal (40-45% --ink scrim, 28px top radius, hairline grip, sheet-rise spring curve, body on --paper not --surface)
- <div> layout → <View>
- <div className='flex items-center justify-between'> → <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
- <span>/<h3>/<p>/<li> → <Text> (Fraunces embedded for the headline via fontFamily display)
- <button> (× close, Connect, Not now) → Pressable + Haptics.selectionAsync() (expo-haptics) for the .press feel; press = animated scale 0.97
- CSS vars (--paper/--accent/--inset/--hairline/--muted-ink/--surface/--positive/--negative/--caution) → theme object + useTheme() hook
- dot <span className='w-1.5 h-1.5 rounded-full'> → <View style={{width:6,height:6,borderRadius:3,backgroundColor}}>
- hairline border (.hairline) → borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline
- rounded-2xl (32px) → borderRadius:32 (from theme radius-2xl)
- sonner toast → RN toast/snackbar (placeholder only; replaced by real OAuth on ship)
- aria-label / role='dialog' → accessibilityLabel + accessibilityRole + accessibilityViewIsModal on the sheet; close button accessibilityLabel='Close'
- em not-italic accent → <Text style={{color: theme.accent}}> inline span (no italic)
- space-y-1.5 list gap → gap:6 on the list View (or rowGap)

# PdfSuccessScreen (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenPdfSuccess.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenPdfSuccess.tsx

## rnComponentName

PdfSuccessScreen

## purpose

Show what Folio found in a PDF statement before the user accepts. A confirmation/preview gate after a statement read: file summary + a short list of detected money items + a calm Melo line, then a primary CTA to go review what was found and a secondary CTA to use a different file. Nothing is committed here; the user only chooses to proceed.

## reads

- NONE — doc block @reads is — (em-dash). Reads no store state. All displayed data is hardcoded mock content in the prototype (filename, page count, 3 found items). The big block of store imports at the top (useAppStore, setPots, setSubs, togglePaused, etc.) is dead/unused in THIS component — none are called in the body; do NOT port them.
- nav.back (function, from Nav prop)
- nav.go (function, from Nav prop)

## writes

- NONE — doc block @writes is — (em-dash). This screen mutates no store state.
- Navigation only: nav.back() (header back arrow), nav.go('visualizer') (primary CTA), nav.go('intake') (secondary CTA)

## opensSheets

- doc block declares @opens-sheet edit-item (SheetId 'edit-item') — but in the current prototype body NO sheet is opened. The primary CTA routes to 'visualizer' and the secondary to 'intake'. edit-item is the intended downstream sheet (item correction) reached from the Review/Visualizer flow, not fired directly here. Port the screen with no sheet trigger; keep edit-item wiring for the Review step it leads to.

## copyKeys

- COPY_DECK key add.success.pdf = "Folio **read** your statement." — rendered here as the H2 'Folio <em>read</em> your statement.' with 'read' as the terracotta accent word (matches the **bold** marker in the deck).
- Eyebrow: "Statement read" (font-display italic, --positive) — NOT in COPY_DECK; treat as screen-local string to add to the deck on port.
- Body under H2: "Check what you want to add. Nothing counts until you choose." — screen-local, not yet keyed.
- Header label: "PDF" (uppercase, tracked).
- File card title: "Statement_June_2025.pdf" — mock filename; RN must show the REAL chosen file name.
- File card meta: "8 pages" — mock; RN must show real page count (n pages).
- Section label: "3 things found" — mock count; RN must be "{n} things found" from real reader output.
- Found item 1 merchant: "Salary — Whitstone Ltd", hint: "looks like income", amount: "+£2,180" (all mock).
- Found item 2 merchant: "Octopus Energy", hint: "looks like a bill", amount: "−£118" (mock; note the minus is U+2212, not a hyphen).
- Found item 3 merchant: "Tesco", hint: "likely spending", amount: "−£42" (mock).
- Melo line: "This is waiting. Add it only if it belongs." — screen-local italic Melo copy, not yet keyed.
- Primary CTA: "Check what Folio found".
- Secondary CTA: "Use a different file".
- Back affordance glyph: "←". File icon glyph: "▤". Bullet: filled dot (no text).
- Banned-word check: copy is clean (no import/parse/extract/OCR/sync/AI-powered/smart). Keep it that way on port; the literal hints ('looks like income/a bill', 'likely spending') are the voice-correct way to express detection confidence — do not relabel as 'classification'.

## tokens

- --surface (file/found card bg)
- --hairline (card border via `hairline` utility + the divider `bg-[var(--hairline)]`)
- --positive (green eyebrow 'Statement read')
- --accent (accent word 'read', file-icon glyph color, found-item bullet dots, primary CTA bg, CTA shadow rgba(224,99,58,0.55) which is --accent at 0.55)
- --accent-soft (file-icon chip bg)
- --muted-ink (back glyph, 'PDF' label, body copy, file meta, section label, item hints, secondary CTA text)
- --ink (default body/title text via inherited foreground)
- white (#FFFFFF) primary CTA label — maps to --color-primary-foreground

## motions

- slide-in-r (360ms, cubic-bezier(.16,1,.3,1)) — whole screen enters on forward nav. Doc block @motion lists 'slide-in-r'.
- press (120ms, scale 0.97 on :active) — back button, primary CTA, secondary CTA all use the `press` utility. RN: Pressable + scale + Haptics.selectionAsync().
- Melo idle breathe — the <MeloLine> renders a <Melo mood='soft'> companion which carries continuous pebble-breathe (always-on, the only continuous motion on this quiet screen).
- Doc block also names 'stamp on accept · slide-in-r' — the verdict-stamp belongs to the DOWNSTREAM accept moment (ritual/visualizer), NOT fired on this screen. Only slide-in-r + press + Melo breathe actually run here.
- Under reduced motion: collapse slide-in-r to final state; stop Melo breathe; press transition off.

## componentTree

<PdfSuccessScreen nav> (ScrollView, flex col, px28 pt16, slide-in-r, hide scrollbar)

  <Header row spaceBetween>
    <Pressable onPress={nav.back} press> ← </Pressable>   // 20px, --muted-ink
    <Text uppercase tracking>PDF</Text>                   // 12px, --muted-ink
    <Spacer width=20 />                                   // balances the back glyph
  </Header>

  <Intro mt24>
    <Text fontDisplay italic 13px color=positive>Statement read</Text>
    <Text fontDisplay 30px mt4>Folio <Em not-italic color=accent>read</Em> your statement.</Text>
    <Text 13.5px mt12 color=mutedInk leadingRelaxed>Check what you want to add. Nothing counts until you choose.</Text>
  </Intro>

<Card mt24 bg=surface hairline rounded2xl p20> // 24px radius, 20px pad
<FileRow row gap12 itemsCenter>
<IconChip 44x44 rounded-lg bg=accentSoft center>▤</IconChip> // glyph --accent 18px
<View flex1 minW0>
<Text 14px medium numberOfLines=1>Statement_June_2025.pdf</Text> // REAL filename
<Text 11.5px mt2 color=mutedInk>8 pages</Text> // REAL count
</View>
</FileRow>
<Divider mt20 height=1 bg=hairline />
<FoundSection mt20>
<Text 11px uppercase tracking color=mutedInk>3 things found</Text> // REAL count
<List mt12 gap12>
{items.map(r => (
<Row key={r.merchant} row gap12 itemsCenter>
<Dot 6x6 rounded-full bg=accent />
<View flex1 minW0>
<Text 13.5px medium numberOfLines=1>{r.merchant}</Text>
<Text 11.5px italic color=mutedInk>{r.hint}</Text>
</View>
<Money value={r.amount} size="sm" /> // tone defaults to ink (NO sign coloring)
</Row>
))}
</List>
</FoundSection>
</Card>

  <MeloBlock mt20>
    <MeloLine text="This is waiting. Add it only if it belongs." mood="soft" />
  </MeloBlock>

<Spacer flex1 /> // pushes CTAs to bottom

<Pressable onPress={() => nav.go('visualizer')} press // primary CTA
h=58 rounded2xl bg=accent shadow={accent55}>
<Text white medium 15.5px>Check what Folio found</Text>
</Pressable>
<Pressable onPress={() => nav.go('intake')} press mt8 h=46 rounded2xl> // secondary
<Text 13px color=mutedInk>Use a different file</Text>
</Pressable>
<Spacer height=16 />
</PdfSuccessScreen>

## enginesNeeded

- Statement reader engine (RN, NEW per RN_PORT.md) — PDF → candidate money items. This screen is its SUCCESS surface: it must render the real chosen file name, real page count, real detected-item count, and the real candidate list (merchant, confidence hint, signed amount). The prototype's 3 hardcoded items are placeholders for this engine's output.
- Confidence/category heuristic — produces the per-item 'hint' text ('looks like income' / 'looks like a bill' / 'likely spending'). Maps a candidate's inferred type to one of the voice-approved hint strings; do not surface raw category codes.
- Money formatting — formatGBP-equivalent: signed, £, tabular figures, no decimals, U+2212 minus for negatives. Amounts arrive as preformatted signed strings into <Money value=...>.
- Navigation/state machine — owns the intake→pdf-success→visualizer/review→edit-item flow and the back/'different file' branches. No money-path/pot/sub/insights engines are touched by THIS screen.
- Reduced-motion + Melo mood system (mood='soft' here maps to the curious/calm family per MELO_MOODS — note this screen uses MeloLine's 'soft' input, not the canonical Add-success 'cheer'; preserve the prototype's mood='soft' rather than 'forcing' the mood-map default unless design re-confirms).

## fidelityRisks

- Money tone is NOT sign-derived. <Money value='+£2,180'/> uses the default tone='ink' — the income amount is INK, not green; the bills are INK, not red. Easy to 'improve' by coloring positives/negatives. Don't — match the prototype: all three amounts render in --ink. Sign is communicated by the +/− glyph only.
- Minus sign is U+2212 (−), not ASCII hyphen (-). The amounts '−£118' / '−£42' and 'Salary — Whitstone Ltd' (em-dash U+2014) must keep their exact Unicode. formatGBP itself emits U+2212.
- Dead store imports: the file imports ~17 store actions/types (setPots, setSubs, togglePaused, pauseMany, addCycle, setOnboarding, resetAll, fastForwardMonth, removeSub, addToPot, markSubUsed, addTransaction, removeTransaction, Sub, Transaction, useAppStore) plus meloHero/waxSeal assets — NONE are used in the body. Do not wire any of them in RN; the screen is read-only/nav-only.
- Hardcoded mock data: filename, '8 pages', '3 things found', and the 3 items are placeholders. The RN screen MUST bind to real statement-reader output, and the section label must pluralize ('{n} things found'). Shipping the mock strings would be a lie about what was read.
- Layout uses flex-1 spacer to pin the two CTAs to the bottom of a scrollable column (h-full flex-col + overflow-y-auto + flex-1 gap). In RN this is a ScrollView whose contentContainer is flexGrow:1 with a spacer View flex:1 — a naive ScrollView will collapse the spacer. Get the scroll+push-to-bottom behavior right, and respect safe-area at the bottom (the trailing h-4 spacer).
- truncate on file title and item merchant = numberOfLines={1} + flexShrink in a min-w-0 (flex1 minW0) row. RN needs flex:1 + minWidth:0 equivalent (flexShrink:1) or long merchant names will push the amount off-screen.
- Primary CTA shadow boxShadow '0 12px 24px -10px rgba(224,99,58,0.55)' is the accent color at 0.55 alpha. RN must reproduce a colored (terracotta) elevation, not a default gray Android elevation — use shadowColor=accent on iOS and a matching elevation+shadow on Android.
- Accent WORD inside the headline: 'read' is <em class='not-italic text-accent'> — the H2 is Fraunces (font-display) and the em strips italic and recolors only that one word. RN needs nested <Text> with the accent color and the SAME font weight/family, exactly one accent word (per voice rule).
- @opens-sheet vs actual nav: doc block says edit-item but the buttons go to visualizer/intake. Don't auto-open edit-item from this screen. Keep it for the Review step.
- Melo here is the MeloLine companion at default size 28 with mood='soft'; it carries the only continuous animation (breathe). Don't add a second infinite animation (e.g. pulsing CTA) — MOTION.md forbids it on a quiet screen.
- Glyph icons '←' and '▤' are literal text in the prototype. Port to real icons (lucide-react-native: ArrowLeft, and a file/lines glyph) rather than shipping the ▤ unicode, which renders inconsistently across fonts/OSes.

## docBlock

/\*\*

- @rn-screen PdfSuccessScreen
- @rn-stack Intake > Statement found
- @purpose Show what Folio found in a PDF statement before the user accepts.
- @reads —
- @writes —
- @opens-sheet edit-item
- @copy FROZEN
- @tokens --surface --hairline --positive --accent
- @motion stamp on accept · slide-in-r
  \*/

## moods

- soft — passed explicitly as <MeloLine mood='soft'> in the prototype (MeloLine's MeloMoodInput accepts calm/soft/alert-style inputs). Per MELO_MOODS the Add-entry success surface nominally maps to 'cheer'; this screen instead uses the quieter 'soft' to keep the 'nothing counts yet' calm. Preserve mood='soft' on port unless design re-decides; do not silently swap to cheer/celebrate.
- celebrate must NOT appear here (reserved for closed-cycle, once per cycle).
- Mood is decorative; copy carries the meaning (accessibility rule).

## stateBranches

- populated — THIS file is the populated/success branch only (per STATES.md PdfSuccess row: populated ✅). Renders file summary + found items + Melo + CTAs.
- loading — handled UPSTREAM, not in this file: Melo 'curious' + line 'Folio is reading…' (no spinner, max 4s). RN should show that during the read, then mount this success screen.
- error — route to PdfFallback screen (add.fallback.pdf = 'File **saved.**'); STATES.md: PdfSuccess error → PdfFallback. This screen does not render an inline error; the reader failure swaps screens.
- offline — 'saved, will read later' degrade (STATES.md offline column). Again handled by the intake flow, not an inline branch here.
- empty — n/a for this screen (you only land here when a statement was read). If reader returns zero candidates, that is a fallback/empty-found case the RN flow must define (likely route to fallback rather than show an empty '0 things found' card).

## rnPrimitiveMap

- root <div h-full flex-col overflow-y-auto no-scrollbar> → <ScrollView> with contentContainerStyle {flexGrow:1} + showsVerticalScrollIndicator={false}; outer flex from a parent <View flex:1>
- <button className='press'> (x3) → <Pressable> + animated scale 0.97 + expo-haptics Haptics.selectionAsync()
- text glyphs '←' / '▤' → lucide-react-native (ArrowLeft / a file glyph) per RN_PORT icon map
- <Money> tabular figures → <Text style={{fontVariant:['tabular-nums'], fontFamily: Fraunces}}> (RN_PORT: Money → tabular-nums Text)
- <MeloLine mood> → Melo via react-native-svg + reanimated breathe + Fraunces-italic <Text>
- CSS var colors (var(--accent) etc.) → theme object + useTheme() hook (no hardcoded hex)
- `hairline` utility (1px border) → StyleSheet.hairlineWidth border with theme --hairline color
- `slide-in-r` CSS class → reanimated: translateX 28→0 over 360ms cubic-bezier(.16,1,.3,1) on mount
- rounded-2xl (24px) / rounded-lg / rounded-full → borderRadius 24 / 8 / 9999
- truncate + min-w-0 → numberOfLines={1} + flexShrink:1 (with flex:1 container)
- px-7 / mt-6 / gap-3 etc. → StyleSheet spacing (28 / 24 / 12 px); trailing h-4 → bottom safe-area inset
- CTA boxShadow rgba(224,99,58,0.55) → shadowColor=theme.accent (iOS shadow + Android elevation), colored not gray
- nav.go/nav.back (local Nav prop) → @react-navigation/native stack (navigation.navigate / goBack); keep the Nav prop shape from types.ts (go, back, openSheet, openMelo, pressure...) so the screen stays drop-in

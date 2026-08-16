# IntakeScreen (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenIntake.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenIntake.tsx

## rnComponentName

IntakeScreen

## purpose

Onboarding "Add what you have" picker — the user chooses HOW to add a statement (PDF, screenshot/photo, paste, CSV/TXT, or type it in). Pure navigation menu: each option routes to a reader-success screen (or to Review for manual). No data is read or written here; it is the dispatch point into the statement-reader flows. Copy is FROZEN — no "import"/"OCR"/"parser" wording.

## reads

- — (doc block @reads is empty: screen reads NO store state)
- nav.pressure is available on the Nav object but NOT consumed by this screen

## writes

- — (doc block @writes is empty: screen writes NO store state)
- Note: many store actions (storeSetPots, setSubs, addTransaction, etc.) are imported at top of file but NONE are used in ScreenIntake — dead imports, do not port

## opensSheets

- — (doc block @opens-sheet is empty: opens NO sheets; navigation only via nav.go)

## copyKeys

- Header eyebrow: "Add" (uppercase, tracking-[0.14em])
- Back affordance glyph: "←"
- Headline: "Add what you have." — accent word "what" in --accent, rendered <em class=not-italic> (COPY_DECK key add.title = "Add **what** you have.")
- Subhead: "Folio shows what it finds before anything is added." (hardcoded — NOT in COPY_DECK)
- Option 1 title: "PDF statement" / hint: "from your bank app" / icon: "▤" / badge: "fastest" / → pdf-success
- Option 2 title: "Screenshot or photo" / hint: "from your phone" / icon: "▢" / → image-success
- Option 3 title: "Paste transactions" / hint: "copy from anywhere" / icon: "❝" / → paste-success
- Option 4 title: "CSV or TXT file" / hint: "if you have one" / icon: "⌗" / → paste-success
- Option 5 title: "Add numbers yourself" / hint: "type it in" / icon: "✎" / → review
- Badge text: "fastest" (uppercase, on option 1 only, bg --accent-soft, text --accent)
- Row forward glyph: "→"
- MeloLine quote: "Use what you have. Nothing is added until you say so." (hardcoded — NOT in COPY_DECK)
- Footer reassurance: "Nothing is shared unless you choose to export it." (hardcoded — NOT in COPY_DECK)

## tokens

- --surface (option row bg)
- --hairline (option row border via .hairline utility = 1px solid --hairline)
- --accent (headline accent word, fastest badge text, forward affordances tint)
- --muted-ink (eyebrow, back glyph, hints, subhead, row arrow, footer)
- --inset (icon tile bg AND MeloLine container bg)
- --accent-soft (fastest badge bg)
- --paper (screen ground, inherited from shell)
- --ink (body text default, inherited)
- --font-display (Fraunces — headline .font-display + MeloLine italic quote)
- --radius tokens: rounded-xl on rows/MeloLine box (12px --radius-md), rounded-lg on icon tile (8px --radius-sm), rounded-full on fastest badge

## motions

- slide-in-r (screen entrance — root container has .slide-in-r; 360ms cubic-bezier(.16,1,.3,1) translateX 28→0 + fade)
- press (every option button + back button — .press: scale .97 on active, 120ms ease)
- pebble-breathe / blink (continuous, inside Melo within MeloLine — calm mood, breathe 4.4s + eyes blink ~5.4s)
- Reduced motion: slide-in-r collapses to final state; press transition disabled; Melo idle loops off

## componentTree

<Screen entering={slideInRight} reduceMotionAware> {/_ SafeArea + vertical scroll, no scrollbar; px-7 pt-4 _/}
<Row justify="space-between" align="center"> {/_ header _/}
<Pressable onPress={nav.back} hitSlop press><Text color=muted size=20>←</Text></Pressable>
<Text color=muted size=12 uppercase tracking=0.14em>Add</Text>
<View width=20 /> {/_ spacer to balance back glyph _/}
</Row>

<View marginTop=24> {/_ title block _/}
<Text fontFamily=display size=28 lineHeight=tight>
Add <Text color=accent>what</Text> you have.
</Text>
<Text size=13.5 color=muted marginTop=12 lineHeight=relaxed>
Folio shows what it finds before anything is added.
</Text>
</View>

<View marginTop=24 gap=10> {/_ options list — map over 5 options _/}
{options.map(o => (
<Pressable key={o.title} onPress={() => nav.go(o.to)} press
style={[surfaceBg, hairlineBorder, radiusMd, px16, py16, rowLayout, gap16]}>
<View size=44 radiusSm bg=inset center><Text size=20>{o.icon}</Text></View>
<View flex=1>
<Row align=center gap=8>
<Text size=14.5 weight=medium>{o.title}</Text>
{o.fastest && (
<View bg=accentSoft radiusFull px=6 py=2>
<Text size=9 uppercase tracking=wide color=accent weight=medium>fastest</Text>
</View>
)}
</Row>
<Text size=12 color=muted marginTop=2>{o.hint}</Text>
</View>
<Text color=muted>→</Text>
</Pressable>
))}
</View>

<View marginTop=24 bg=inset radiusMd p=16> {/_ Melo reassurance _/}
<MeloLine mood="calm" text="Use what you have. Nothing is added until you say so." />
</View>

<Spacer flex=1 /> {/_ pushes footer down _/}
<Text align=center size=11 color=muted marginTop=24 marginBottom=24>
Nothing is shared unless you choose to export it.
</Text>
</Screen>

## enginesNeeded

- NONE for this screen itself — it is a pure navigation/dispatch menu with no logic.
- DOWNSTREAM (must exist for the routes this screen fires into): Statement reader engine (PDF → candidate items → Review) behind pdf-success; Photo reader (image → candidates) behind image-success; Text/file reader (paste + CSV/TXT → candidates) behind paste-success (options 3 AND 4 both route to paste-success).
- RN_PORT hard rule: PDF/photo/paste/CSV/TXT MUST run the matching reader then Review — never route to a blank manual form. Only option 5 (Add numbers yourself → review) is the failure-only manual path.
- Nav stack: @react-navigation/native stack (web nav.go(screenId) → navigation.navigate). nav.back → navigation.goBack().

## fidelityRisks

- Name mismatch: doc block @rn-screen is IntakeScreen but the exported web fn is ScreenIntake — the RN component should be IntakeScreen (per RN_PORT doc-block matching). STATES.md lists both 'Intake' and 'AddEntry'; this file is the Intake picker.
- Copy drift vs COPY_DECK: the five option titles/hints here ('PDF statement','Screenshot or photo','Paste transactions','CSV or TXT file','Add numbers yourself') do NOT match the COPY_DECK 'Add a thing' keys (add.option.statement='A statement (PDF)', add.option.photo='A photo', add.option.paste='Paste text', add.option.manual='Type it in'). COPY_DECK has NO key for the CSV/TXT option, the subhead, the MeloLine quote, or the footer line. Per COPY_DECK rule 'if a string isn't here it doesn't ship' — these strings must be added to COPY_DECK and keyed before RN ship; do not silently port the literals.
- Banned-word check: copy is clean (no import/OCR/parser/extract/sync etc.) — keep it that way; 'read'/'add'/'paste' are allowed.
- Privacy claim risk: footer 'Nothing is shared unless you choose to export it' is a security/privacy assertion — COPY_DECK forbids privacy claims unless literally true of the shipped RN app. Verify the RN build never transmits before porting this line, or omit it.
- Icon glyphs are Unicode characters (▤ ▢ ❝ ⌗ ✎) rendered as text, NOT lucide icons. RN_PORT prescribes lucide-react-native; these specific glyphs have no clean lucide equivalent and may render inconsistently across Android fonts. Decide: map to lucide (FileText, Image, Quote/ClipboardPaste, Hash/FileSpreadsheet, Pencil) or ship as Text — do not assume the glyphs render identically on-device.
- Two options (Paste transactions AND CSV or TXT file) both route to paste-success — intentional per source; preserve, but the downstream text/file reader must handle both paste and uploaded-file inputs.
- Dead imports: the file imports the entire store API + assets (meloHero, waxSeal) + Money/formatGBP/useCountUp + pressure helpers, none of which are used here. Do NOT port these into the RN screen.
- States: STATES.md marks Intake as populated-only (n/a for empty/loading/error/offline) — render a single static branch, no spinner, no empty state. No async on this screen.
- <em class="not-italic"> on the accent word means the accent word is NOT italicised — in RN just apply color=--accent with the same weight as surrounding text; do not italicise.
- Layout: root is a scroll container (overflow-y-auto no-scrollbar) with a flex-1 spacer before the footer, so on tall screens the footer pins to the bottom and on short screens the list scrolls. RN: ScrollView with contentContainerStyle flexGrow:1 + a flex:1 spacer View to reproduce the pin-to-bottom behaviour.
- Header spacer <span class='w-5'/> (20px) balances the 20px back glyph so the 'Add' eyebrow stays optically centered — keep an equal-width spacer in RN.
- MeloLine mood must be 'calm' per MELO_MOODS ('Add entry — fallback' = calm; this reassurance row is the calm resting state, not the curious reading state).

## docBlock

/\*\*

- @rn-screen IntakeScreen
- @rn-stack Onboarding > Add what you have
- @purpose Pick how to add a statement — PDF, photo, paste, or manual.
- @reads —
- @writes —
- @opens-sheet —
- @copy FROZEN — no "import" / "OCR" / "parser" wording allowed.
- @tokens --surface --hairline --accent --muted-ink
- @motion slide-in-r · press .97/120ms
  \*/

## moods

- calm (MeloLine inside the reassurance box — the only Melo on this screen; matches MELO_MOODS 'Add entry — fallback' = calm; size 28 default companion tier)

## stateBranches

- populated — the ONLY branch this screen renders (static 5-option menu). Per STATES.md, Intake is populated-only.
- empty — n/a (not applicable; no data dependency)
- loading — n/a (no async; no spinner, no Melo curious here — reading/loading happens on the downstream \*-success screens)
- error — n/a (no failable operation on this screen)
- offline — n/a / same as populated (local-first; nothing fetched). Offline reading degradation ('saved, will read later') is handled by the downstream AddEntry/PdfSuccess screens, not here.

## rnPrimitiveMap

- <div> root w/ overflow-y-auto no-scrollbar → <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{flexGrow:1}}> inside a SafeAreaView
- <button onClick=nav.back> → <Pressable onPress={navigation.goBack}> + expo-haptics Haptics.selectionAsync() on press
- <button onClick=nav.go(to)> option rows → <Pressable onPress={() => navigation.navigate(to)}> (map ScreenId→route name)
- .press utility → Pressable style={({pressed}) => [{transform:[{scale: pressed?0.97:1}]}]} OR reanimated withTiming; honor AccessibilityInfo.isReduceMotionEnabled
- .slide-in-r entrance → reanimated entering={SlideInRight.duration(360)} or shared value translateX 28→0; collapse to final state under reduce-motion
- .hairline border → borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline
- CSS tokens (var(--surface) etc.) → theme object + useTheme() hook (RN_PORT theme map)
- Fraunces .font-display → embedded Fraunces font family; body uses SF Pro / Roboto
- <MeloLine> → kit MeloLine (Melo react-native-svg + reanimated breathe + Fraunces-italic Text)
- Unicode icon glyphs in <div> tiles → <Text> glyphs OR lucide-react-native icons (see fidelity risk — pick one, test on Android)
- rounded-xl/lg/full → borderRadius 12/8/999 from radius tokens
- space-y-2.5 → gap:10 on the list View (or marginBottom on rows)
- flex-1 spacer <div className='flex-1'/> → <View style={{flex:1}} /> to pin footer
- tracking-[0.14em] → letterSpacing computed from fontSize (RN letterSpacing is absolute px, not em — convert: 12px \* 0.14 ≈ 1.68)
- uppercase class → textTransform:'uppercase' (eyebrow + fastest badge)

# PdfFallbackScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPdfFallback.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPdfFallback.tsx

## rnComponentName

PdfFallbackScreen

## purpose

Failure-state screen shown when the statement (PDF) reader could not produce review candidates. It confirms the file was saved, explains plainly that it could not be read clearly enough to surface things to check, and offers a calm recovery ladder: retry the file first (primary), view the file (secondary), or fall back to adding one item by hand (secondary, routes to Review). Maps to @rn-stack "Intake > Statement not read". This is the AddEntry "fallback" branch per STATES.md (PdfSuccess error -> PdfFallback) and Melo mood "Add entry - fallback" = calm.

## docBlock

@rn-screen PdfFallbackScreen
@rn-stack Intake > Statement not read
@purpose Failure state when the PDF reader cannot produce review candidates.
@reads —
@writes —
@opens-sheet edit-item
@copy FROZEN
@tokens --surface --hairline --muted-ink
@motion slide-in-r · press

## reads

- NONE from store — component reads no store state.
- Imports useAppStore plus ~16 store actions and meloHero/waxSeal assets, but references NONE of them in the body (dead imports — do not carry into RN).
- Only input is the prop `nav: Nav` (the local navigation object: nav.back, nav.go).

## writes

- NONE — no store action is invoked.
- Despite importing storeSetPots/setSubs/togglePaused/pauseMany/addCycle/setOnboarding/resetAll/fastForwardMonth/removeSub/addToPot/markSubUsed/addTransaction/removeTransaction, none are called.
- The only side effects are navigation: nav.back() and nav.go(...).

## opensSheets

- edit-item — DECLARED in the @opens-sheet doc block ONLY; it is NOT wired in the JSX.
- ACTUAL JSX: 'Add one thing myself' calls nav.go("review") (opens NO sheet). RN fidelity decision: follow live code (route to Review), but flag the doc-block intent (open edit-item sheet) for design to confirm which is canonical.

## copyKeys

- add.fallback.pdf = "File **saved.**" (the only COPY_DECK key; rendered as headline "File " + accent "saved.")
- eyebrow (verbatim literal, NOT keyed): "Saved"
- headline accent word (verbatim literal): "saved."
- body (verbatim literal, NOT in COPY_DECK — Melo first-person voice): "I could not read this statement clearly enough to show things to check."
- file-card title (verbatim placeholder literal): "Statement_June_2025.pdf"
- file-card subtitle (verbatim literal): "saved in Folio"
- inline file-card action (verbatim literal): "View"
- explainer card (verbatim literal): "Try another copy of the statement first. If that still does not work, you can add one thing yourself."
- MeloLine text (verbatim literal): "Let's try the file again before we ask you to type."
- primary CTA (verbatim literal): "Try another file"
- secondary CTA left (verbatim literal): "View file"
- secondary CTA right (verbatim literal): "Add one thing myself"
- top-bar label (verbatim literal): "PDF"
- back affordance glyph (verbatim literal): "←"
- file icon glyph (verbatim literal): "▤" — replace with lucide-react-native FileText in RN
- NOTE: several visible strings here are inline literals not present in COPY_DECK.md. COPY_DECK rule says "if a string isn't here, it doesn't ship" — flag for the copy deck to absorb these before RN ship.

## tokens

- --surface (file card + secondary button backgrounds)
- --hairline (via the `hairline` utility = 1px --hairline border on file card + secondary buttons)
- --muted-ink (back arrow, PDF label, eyebrow, body, file-card sub, View link, explainer text, right secondary button text)
- --accent (headline accent word 'saved.' + primary CTA background)
- --inset (file-card icon tile background + explainer card background)
- white (#FFFFFF via --color-primary-foreground — primary CTA text 'Try another file')
- radius tokens: rounded-2xl=32px (file card, primary CTA), rounded-xl=12px... NOTE web uses Tailwind rounded-xl(0.75rem=12px) on explainer + secondary buttons and rounded-lg(8px) on icon tile; map to RN theme radii sm/md
- font-display = Fraunces (eyebrow italic + headline); body/labels = sans (Inter Tight / SF Pro / Roboto)

## motions

- slide-in-r — whole screen entrance: translateX 28px -> 0, opacity 0 -> 1, 360ms cubic-bezier(.16,1,.3,1)
- press — every tappable element scales to 0.97 on active, 120ms ease (back arrow, View link, primary CTA, both secondary buttons)
- NOTE: no Melo breathe/blink motion is implemented on this screen because the screen uses <MeloLine> (mood='soft') which still breathes/blinks per the Melo component; RN must keep Melo's idle breathe/blink (calm rhythm) inside MeloLine.
- NOTE: doc block lists only slide-in-r · press; reduced-motion must collapse slide-in-r to final state.

## moods

- soft — MeloLine is rendered with mood="soft" in the JSX (line 83).
- DISCREPANCY: MELO_MOODS.md defines five moods (calm | curious | cheer | concern | celebrate) and 'soft' is NOT one of them; it lists 'Add entry — fallback' = calm. 'soft' appears to be a rare/eyes-soft expression. RN: map 'soft' to the calm pebble with the soft-eye expression, OR confirm with design; safest is calm per the mood map for the fallback surface.

## componentTree

<![CDATA[
// Full-height scrollable column. Web: div.h-full.flex-col.px-7.pt-4.slide-in-r.overflow-y-auto.no-scrollbar
<ScrollView
  entering={SlideInRight 360ms}                 // slide-in-r
  showsVerticalScrollIndicator={false}          // no-scrollbar
  contentContainerStyle={{ flexGrow:1, paddingHorizontal:28, paddingTop:16 }}
>
  {/* Top bar: back · label · spacer (3-up, space-between) */}
  <View row spaceBetween alignCenter>
    <Pressable onPress={nav.back} pressScale>
      <Text color=mutedInk size20>←</Text>          {/* lucide ArrowLeft preferred over glyph */}
    </Pressable>
    <Text color=mutedInk size12 uppercase letterSpacing=0.14em>PDF</Text>
    <View width={20} />                              {/* balance spacer */}
  </View>

  {/* Heading block (mt-6) */}
  <View marginTop={24}>
    <Text fontDisplay italic size13 color=mutedInk>Saved</Text>
    <Text fontDisplay size30 lineHeightTight marginTop={4}>
      File <Text color=accent>saved.</Text>          {/* accent word, NOT italic */}
    </Text>
    <Text size13.5 color=mutedInk marginTop={12} lineHeight=relaxed maxWidth={300}>
      I could not read this statement clearly enough to show things to check.
    </Text>
  </View>

  {/* File card (mt-5) — surface bg + hairline border + radius 16(2xl-ish→use lg/xl) */}
  <View row alignCenter gap={12} marginTop={20}
        bg=surface borderHairline radius=16 paddingH=16 paddingV=12>
    <View width={40} height={40} radius=8 bg=inset center>
      <Text size16>▤</Text>                           {/* → lucide FileText */}
    </View>
    <View flex={1} minWidth={0}>
      <Text size13.5 weight=medium numberOfLines={1} ellipsizeMode="tail">Statement_June_2025.pdf</Text>
      <Text size11 color=mutedInk>saved in Folio</Text>
    </View>
    <Pressable pressScale onPress={/* TODO open saved file viewer */}>
      <Text size11.5 color=mutedInk underline>View</Text>
    </Pressable>
  </View>

  {/* Explainer card (mt-5) — inset bg, radius 12 */}
  <View marginTop={20} bg=inset radius=12 padding={16}>
    <Text size13.5 lineHeight=relaxed color=mutedInk>
      Try another copy of the statement first. If that still does not work, you can add one thing yourself.
    </Text>
  </View>

  {/* Melo line (mt-5) */}
  <View marginTop={20}>
    <MeloLine text="Let's try the file again before we ask you to type." mood="soft" />
  </View>

  {/* Spacer pushes footer to the bottom */}
  <View flex={1} />

  {/* Primary CTA */}
  <Pressable pressScale onPress={() => nav.go("intake")}
    height={54} radius=16(2xl) bg=accent center marginBottom={8}>
    <Text color=#FFF weight=medium size15>Try another file</Text>
  </Pressable>

  {/* Two secondary CTAs in a 2-col grid (gap 2.5 ≈ 10) */}
  <View row gap={10} marginBottom={24}>
    <Pressable pressScale flex={1} height={48} radius=12 bg=surface borderHairline center
      onPress={/* TODO open saved file viewer */}>
      <Text size13>View file</Text>
    </Pressable>
    <Pressable pressScale flex={1} height={48} radius=12 bg=surface borderHairline center
      onPress={() => nav.go("review")}>
      <Text size13 color=mutedInk>Add one thing myself</Text>
    </Pressable>
  </View>
</ScrollView>
]]>

## enginesNeeded

- Statement reader (PDF → candidate money items) — this screen is its FAILURE surface only; the reader itself is a separate RN engine (RN_PORT.md: 'Manual entry is failure-only, never the main path').
- Saved-file store / document store — the 'View' / 'View file' actions need a real saved-PDF reference + a viewer; in the prototype both are dead (no onClick). RN must wire a real saved-document handle.
- Navigation (React Navigation stack) — nav.back, nav.go('intake'), nav.go('review').
- Review flow / candidate store — 'Add one thing myself' routes to Review (per RN_PORT: reader output / manual add must pass through the Review step before changing the money path).
- No money-path / pots / subs / insights engine is touched by this screen.

## rnPrimitiveMap

- div (scroll root, h-full + overflow-y-auto + no-scrollbar) → ScrollView with showsVerticalScrollIndicator={false}, contentContainerStyle flexGrow:1
- div (flex row/col) → View with flexDirection
- button → Pressable + expo-haptics Haptics.selectionAsync() on press (the `press` util)
- span / p / h2 / em → Text (nest <Text> for the accent word; RN has no <em>)
- CSS `hairline` utility (1px border) → borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline
- CSS var() colors (--surface/--inset/--muted-ink/--accent) → theme object via useTheme()
- Tailwind rounded-2xl/xl/lg → theme radii (2xl=32 used loosely; map card/CTA to lg≈18 or md≈12 per RN scale — keep ONE scale)
- uppercase + tracking-[0.14em] → textTransform:'uppercase' + letterSpacing (RN letterSpacing is in px, convert 0.14em≈1.7px at 12px)
- truncate (text-overflow ellipsis) → numberOfLines={1} ellipsizeMode='tail'
- underline underline-offset-2 → textDecorationLine:'underline' (RN ignores offset)
- max-w-[300px] / min-w-0 → maxWidth:300 / (RN flex children shrink by default; minWidth:0 unneeded but ensure flex:1 child wraps)
- glyphs ← ▤ → lucide-react-native ArrowLeft + FileText (RN_PORT: lucide drop-in)
- grid grid-cols-2 gap-2.5 → View flexDirection:'row' with flex:1 children + gap (or marginRight on first)
- <MeloLine> → ported MeloLine (react-native-svg Melo + Fraunces italic Text)
- slide-in-r class → reanimated SlideInRight / withTiming(translateX 28→0, 360ms, Easing cubic .16,1,.3,1)
- color-primary-foreground #FFFFFF (CTA text) → literal white from theme

## stateBranches

- This screen IS itself the 'error/fallback' branch of the AddEntry/PdfSuccess flow (STATES.md: PdfSuccess error → PdfFallback). It does not internally fork on data — it is a single static surface.
- populated — the only rendered state: static success-failure copy + placeholder filename. No data dependency in the prototype.
- empty — n/a (always shows the same content; the filename is a hardcoded placeholder, RN should bind the real saved filename).
- loading — n/a here; loading lives on the upstream PdfSuccess/reading screen ('Folio is reading…', Melo curious, no spinner, max 4s before falling here).
- error — this screen is the terminal error surface; honest copy + one clear recovery ladder (retry file → view → add one thing).
- offline — STATES.md AddEntry offline = 'saved, will read later'; this fallback screen should still render fine offline (it is purely local). No network branch in code.
- RN must add: real saved-file presence check (if the saved PDF handle is missing, the two 'View' affordances should be disabled rather than dead).

## fidelityRisks

- Doc-block vs code mismatch: @opens-sheet says edit-item but the JSX routes to nav.go('review') and opens no sheet. Pick one and confirm with design before porting — do not blindly trust the doc block.
- Dead 'View' affordances: both the file-card 'View' and the 'View file' button have NO onClick in the prototype. RN must wire a real document viewer or disable them — shipping non-functional buttons is a fidelity/UX regression.
- Hardcoded placeholder filename 'Statement_June_2025.pdf' must be replaced with the actual saved file's name in RN; do not ship the literal.
- Inline literal copy not in COPY_DECK: the body line, explainer, MeloLine, CTA labels, 'Saved' eyebrow, 'View'/'View file' are all inline literals. COPY_DECK is the single source of truth ('if a string isn't here, it doesn't ship'); these must be added to the deck and keyed before RN ship.
- Melo mood 'soft' is not in the five-mood map (calm/curious/cheer/concern/celebrate). MELO_MOODS.md sets 'Add entry — fallback' = calm. Map 'soft' → calm (soft-eye expression) or get design sign-off; don't invent a 6th mood.
- Banned-word check: copy is clean (no import/parse/extract/OCR/sync etc.) — keep it that way; do NOT rename 'read this statement' to anything parser-flavored when porting.
- Glyph characters (← and ▤): replace with lucide-react-native icons; raw unicode glyphs render inconsistently across RN fonts/platforms.
- Spacer pattern: the top-bar right spacer (w-5) and the flex-1 footer spacer must be reproduced so the 3-up header stays centered and the footer pins to the bottom inside a flexGrow:1 ScrollView content container — a common RN bug is the footer floating mid-screen on tall devices.
- Radius scale drift: web mixes rounded-2xl/xl/lg (32/12/8). RN_PORT forbids a second spacing/radius scale — collapse to the one RN theme radius scale; don't hardcode 32/12/8.
- Safe-area: web has no notch handling; RN must wrap top bar in SafeAreaView / useSafeAreaInsets and respect the bottom gesture inset for the footer CTAs (per folio device-iteration gotchas).
- Dead store imports (~16 actions) are noise; do NOT replicate them in the RN component — RN screen needs only `nav`.
- Reduced motion: slide-in-r must collapse to final state (AccessibilityInfo.isReduceMotionEnabled), and Melo idle breathe/blink inside MeloLine must also respect it.

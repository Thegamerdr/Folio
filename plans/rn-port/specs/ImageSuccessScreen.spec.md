# ImageSuccessScreen  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenImageSuccess.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenImageSuccess.tsx

## rnComponentName

ImageSuccessScreen

## purpose

Confirmation step after a photo is added to Folio. Shows "Text found" in the photo, names the saved image, lists the money items the photo reader found, and routes the user forward to check them before anything counts. Maps to ScreenId "image-success"; reached from intake after the user picks a photo. Doc-block @purpose: "Show text Folio read from a photo, ready to check before adding."

## reads

- nav (Nav prop) is the ONLY data the component consumes: nav.back, nav.go.
- @reads doc block = '—' (none). NO store reads.
- Imports many actions/types from @/lib/store (setPots, setSubs, togglePaused, pauseMany, addCycle, setOnboarding, resetAll, fastForwardMonth, removeSub, addToPot, markSubUsed, addTransaction, removeTransaction, type Sub, type Transaction) but uses NONE — dead imports carried from a shared screen template. Strip them in the RN port.
- The '2 things found' list (Sainsbury's −£27.40 'likely spending'; ATM withdrawal −£40 'looks like cash out') and the filename 'IMG_2643.jpg' are HARDCODED literals in the prototype, not store/engine-derived. In RN they must come from the photo-reader engine output.

## writes

- @writes doc block = '—' (none). No store mutations.
- nav.back() pops the stack.
- nav.go('visualizer') advances to the check/Review surface.
- nav.go('intake') returns to the add-method picker.
- All three are navigation only, not store writes.

## opensSheets

- edit-item (declared in @opens-sheet, but NOT wired in current code — see fidelityRisks)

## copyKeys

- add.success.image = 'Folio **read** your image.' (headline; 'read' is the terracotta accent em)
- Image (header eyebrow, uppercase, tracking 0.14em) — not in COPY_DECK, exact literal
- Text found (positive-green Fraunces italic kicker) — not in COPY_DECK, exact literal
- Folio read your image. (headline; 'read' = accent not-italic em)
- Check what you want to add. Nothing counts until you choose. (subtitle, muted-ink) — exact literal
- IMG_2643.jpg (file row title — HARDCODED placeholder; replace with real filename)
- saved in Folio (file row subtitle, muted-ink) — exact literal
- 2 things found (section label, uppercase tracking 0.14em — count should be dynamic in RN)
- Sainsbury's (found-item merchant — hardcoded sample)
- likely spending (found-item hint, italic muted-ink — hardcoded sample)
- −£27.40 (found-item amount via <Money size='sm'> — hardcoded sample)
- ATM withdrawal (found-item merchant — hardcoded sample)
- looks like cash out (found-item hint, italic — hardcoded sample)
- −£40 (found-item amount via <Money size='sm'> — hardcoded sample)
- Add it only if it belongs. (MeloLine text — exact literal, not yet in COPY_DECK)
- Check what Folio found (primary CTA button)
- Use a different image (secondary/ghost CTA button)

## tokens

- --surface (card background; doc-block @tokens)
- --hairline (card border + internal divider; doc-block @tokens)
- --positive (green 'Text found' kicker; doc-block @tokens)
- --accent (headline accent em + bullet dots + primary CTA bg + CTA shadow rgba(224,99,58,0.55))
- --muted-ink (back arrow, eyebrow, subtitle, file subtitle, section label, item hints, secondary CTA)
- --inset (image thumbnail placeholder fill)
- --font-display / Fraunces (kicker italic + headline; .font-display)
- radius-2xl / rounded-2xl=32px (card + CTAs), rounded-lg=8px (thumb), rounded-full (bullet dots)
- white (#FFFFFF) primary CTA text — token --color-primary-foreground

## motions

- slide-in-r
- press
- stamp (doc-block intent 'stamp on accept'; not rendered in current JSX)

## componentTree

<ScrollView contentContainerStyle={paddingH:28, paddingTop:16} showsVerticalScrollIndicator={false} entering={SlideInRight}>  // .slide-in-r + no-scrollbar
  <View row spaceBetween alignCenter>            // header
    <Pressable onPress={nav.back}><Text muted size20>←</Text></Pressable>  // .press
    <Text muted size12 uppercase tracking0.14em>Image</Text>
    <View width20 />                              // spacer to balance arrow
  </View>
  <View marginTop24>                              // title block (mt-6)
    <Text fontDisplay italic size13 color=positive>Text found</Text>
    <Text fontDisplay size30 lineTight marginTop4>Folio <Text accent>read</Text> your image.</Text>
    <Text size13.5 muted marginTop12 lineRelaxed>Check what you want to add. Nothing counts until you choose.</Text>
  </View>
  <View marginTop24 bg=surface hairline radius2xl padding20>   // found card
    <View row gap12 alignCenter>                  // file row
      <View w56 h64 radiusLg bg=inset hairline overflowHidden><PaperGrain opacity0.5 absoluteFill /></View>
      <View flex1 minWidth0>
        <Text size14 medium numberOfLines={1}>IMG_2643.jpg</Text>
        <Text size11.5 muted marginTop2>saved in Folio</Text>
      </View>
    </View>
    <View height={StyleSheet.hairlineWidth} bg=hairline marginV20 />   // divider (h-px)
    <View>
      <Text size11 uppercase tracking0.14em muted>2 things found</Text>
      <View marginTop12 gap12>                    // space-y-3
        {items.map(r => (
          <View key={r.merchant} row gap12 alignCenter>   // optionally Pressable -> openSheet('edit-item')
            <View w6 h6 radiusFull bg=accent />  // bullet dot
            <View flex1 minWidth0>
              <Text size13.5 medium numberOfLines={1}>{r.merchant}</Text>
              <Text size11.5 muted italic>{r.hint}</Text>
            </View>
            <Money value={r.amount} size="sm" />
          </View>
        ))}
      </View>
    </View>
  </View>
  <View marginTop20><MeloLine text="Add it only if it belongs." mood="soft" /></View>
  <View flex1 />                                   // pushes CTAs to bottom (flex spacer)
  <Pressable onPress={() => nav.go('visualizer')} style={{height:58, radius2xl, bg:accent, shadow:'0 12px 24px -10px rgba(224,99,58,0.55)'}}>  // .press
    <Text white medium size15.5>Check what Folio found</Text>
  </Pressable>
  <Pressable onPress={() => nav.go('intake')} style={{marginTop8, height:46, radius2xl}}>  // .press, ghost
    <Text size13 muted>Use a different image</Text>
  </Pressable>
  <View height16 />                                // bottom breathing room
</ScrollView>

## enginesNeeded

- Photo reader (Image → candidate money items) — RN_PORT lists this as NEW engine work, not in prototype. Must run on the picked image and produce the found-item list (merchant, hint, signed amount) + the filename. Manual typing is failure-only, never the main path.
- Review surface — found items must be checked before they change the money path (nav.go('visualizer') leads into the check/Review step). RN_PORT: 'Treat Review as optional' is banned.
- Local store + sync (SQLite) — to actually persist the image and the accepted items downstream (this screen itself writes nothing; the engine/Review does).
- No money-path/cycle/subscription/pot/insights engines are needed FOR THIS SCREEN — it is a pure confirmation surface.

## fidelityRisks

- MeloLine mood mismatch: code hardcodes mood='soft', but MELO_MOODS.md says 'Add entry — success' should be 'cheer'. The screen reads 'Text found / success' yet uses a gentle 'soft' tone. Port decision needed — match code (soft) or match the mood spec (cheer). Flag, do not silently pick.
- edit-item sheet declared in @opens-sheet but NOT wired: found-item rows are static, non-tappable. RN_PORT mandates Review must run; preferred fix is to make each row tappable to open edit-item / route into Review, but that is added behavior beyond the prototype — record as a gap, do not invent without sign-off.
- Hardcoded data: 'IMG_2643.jpg', the '2 things found' count, and both sample items are literals. RN must source filename + items + count from the photo-reader engine and pluralize '{n} thing(s) found' (ICU MessageFormat per COPY_DECK localization note).
- Dead store imports: the entire @/lib/store import block is unused. Do not port these into the RN component or wire any store reads/writes — keeps the screen pure.
- State branches: STATES.md ImageSuccess = empty 'same as PdfSuccess', loading 'Folio is reading…' with Melo curious (NO spinner, max 4s), populated = this layout, error → ImageFallback screen, offline = 'saved, will read later'. The prototype ONLY renders the populated branch — RN must add loading (Melo curious + line), error (route to image-fallback), and offline branches.
- Money amounts are negative (−£27.40, −£40) passed as pre-formatted strings to <Money size='sm'>. In RN use <Text fontVariant:['tabular-nums']>; keep the minus glyph and £ exactly; never abbreviate (banned: '12.3K'). Confirm <Money> applies tone (default ink) — sign color is not auto-negative here.
- Banned-word check: copy is clean (no import/parse/OCR/extract/scan). Keep it — never relabel 'read' as 'scan'/'extract'/'OCR' in the RN port.
- Layout: relies on flex-1 spacer to pin CTAs to the bottom of a scroll view. In RN use a ScrollView with flexGrow:1 contentContainer + a flex:1 spacer View, or the CTAs collapse upward. Plus respect bottom safe-area inset (the h-4 spacer is not a safe-area substitute).
- Header spacer: the right-side <span className='w-5'/> exists only to center the 'Image' eyebrow against the back arrow. Reproduce with a fixed-width View, not space-between alone.
- Reduced motion: slide-in-r and press must collapse to final state under AccessibilityInfo.isReduceMotionEnabled (MOTION.md: reduced motion = final state, not slower).
- Thumbnail paper-grain is a CSS pseudo-element noise SVG; RN needs react-native-svg or a static grain asset on the inset thumbnail (decorative only, opacity 0.5).

## docBlock

/**
 * @rn-screen    ImageSuccessScreen
 * @rn-stack     Intake > Text found
 * @purpose      Show text Folio read from a photo, ready to check before adding.
 * @reads        —
 * @writes       —
 * @opens-sheet  edit-item
 * @copy         FROZEN
 * @tokens       --surface --hairline --positive
 * @motion       slide-in-r · stamp on accept
 */

## moods

- soft (ACTUAL: MeloLine mood='soft' hardcoded on this screen)
- cheer (SPEC: MELO_MOODS.md 'Add entry — success' = cheer — conflicts with code, see fidelityRisks)
- curious (SPEC: required for the loading/'Folio is reading…' branch this prototype does not render)

## rnPrimitiveMap

- root <div> scroll container → <ScrollView> (showsVerticalScrollIndicator={false}) — replaces overflow-y-auto + no-scrollbar
- <button> → <Pressable> + expo-haptics Haptics.selectionAsync() (web .press utility)
- <Money value size='sm'> → kit <Money> RN port using <Text style={{fontVariant:['tabular-nums']}}>
- <MeloLine text mood> → RN MeloLine (react-native-svg Melo + Fraunces italic copy)
- hairline border (web @utility hairline / h-px divider) → StyleSheet.hairlineWidth borders
- CSS tokens var(--surface) etc. → theme object + useTheme() hook (light + dark via kitTheme)
- .slide-in-r → reanimated withTiming(translateX 28→0, 360ms, Easing cubic-bezier(.16,1,.3,1)) / SlideInRight entering
- Fraunces .font-display + letter-spacing -0.02em → embedded Fraunces font with letterSpacing
- paper-grain pseudo-element → react-native-svg noise or static grain image on the thumbnail
- nav.go/back (local Nav) → @react-navigation/native stack navigation
- box-shadow on primary CTA → RN shadow (iOS shadowColor/Offset/Opacity/Radius + Android elevation) approximating rgba(224,99,58,0.55)
- em accent word inside headline → nested <Text> with accent color inside the headline <Text>

## stateBranches

- populated — the ONLY branch the prototype renders: header + 'Text found' title + file card with found-item list + MeloLine + two CTAs (per STATES.md ImageSuccess populated ✅)
- loading — REQUIRED by STATES.md (same as PdfSuccess): Melo 'curious' mood + calm line 'Folio is reading…', NO spinner, max 4s before fallback. Not in prototype — add in RN.
- error — REQUIRED: on read failure route to → ImageFallback screen (image-fallback). Not in prototype — add in RN.
- offline — REQUIRED: degrade to 'saved, will read later' (local-first). Not in prototype — add in RN.
- empty — n/a as its own branch here (a success screen presupposes a read result); STATES marks it 'same' as PdfSuccess handling.


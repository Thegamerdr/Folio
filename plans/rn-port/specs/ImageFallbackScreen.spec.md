# ImageFallbackScreen  (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenImageFallback.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\screens\ScreenImageFallback.tsx

## rnComponentName

ImageFallbackScreen

## purpose

Failure state shown when the photo reader cannot produce review candidates from a saved image. The image is kept ("saved in Folio"), Folio admits it could not read it clearly, and offers exactly two honest recoveries: try another image (primary, re-enters Intake), or add one thing manually (failure-only escape to Review). NOT a manual-entry screen by default — manual typing is the explicit failure path only.

## reads



## writes



## opensSheets

- edit-item

## copyKeys

- @rn-stack: Intake > From a photo
- add.fallback.image (key) = "Image **saved.**" — NOTE: this screen renders the string literally as "Image saved." (accent word "saved."), not the bolded markdown form
- Header eyebrow: "Image" (uppercase, tracking)
- Eyebrow italic: "Saved"
- Headline: "Image saved." (accent word "saved." in --accent, not-italic)
- Body: "I could not read it clearly enough to show things to check."
- File card filename: "IMG_2643.jpg" (placeholder/demo string)
- File card subtitle: "saved in Folio"
- File card action: "View"
- Thumbnail placeholder label: "photo"
- Inset note: "Try a clearer image first. If that still does not work, you can add one thing yourself."
- MeloLine: "Let's try the image again before we ask you to type."
- Primary CTA: "Try another image"
- Secondary CTA (left): "View image"
- Secondary CTA (right): "Add one thing myself"

## tokens

- --surface
- --hairline
- --muted-ink
- --accent
- --inset
- --ink (default text)
- white (#FFFFFF, primary CTA label)
- radius-2xl (24px) — header CTA + file card
- radius-xl (12px) — inset note + secondary CTA buttons
- radius-lg (18px name) / actual rounded-lg ~8px — thumbnail
- font-display (Fraunces) — eyebrow italic + headline
- font-sans (Inter Tight) — body/labels
- paper-grain overlay (opacity 40%) on thumbnail

## motions

- slide-in-r
- press
- pebble-breathe
- pebble-blink

## moods

- calm — MeloLine uses mood="soft" which normalizes to calm in the kit; matches MELO_MOODS.md "Add entry — fallback | calm". Calm = "just here, no demand" (the fallback should not alarm).

## componentTree

<![CDATA[
<Safe/ScrollView style={fill, px:28, pt:16} entering={SlideInRight 360ms} showsScrollbar={false}>  // .slide-in-r + no-scrollbar

  {/* Header row */}
  <View row spaceBetween alignCenter>
    <Pressable onPress={nav.back} hitSlop press>          // "←", color --muted-ink, fontSize 20
      <Text>←</Text>
    </Pressable>
    <Text style={fontSize:12, color:--muted-ink, uppercase, letterSpacing:0.14em}>Image</Text>
    <View width={20} />                                    // spacer to balance back arrow
  </View>

  {/* Title block — mt-6 (24) */}
  <View mt={24}>
    <Text style={fontDisplay, italic, fontSize:13, color:--muted-ink}>Saved</Text>
    <Text style={fontDisplay, fontSize:30, lineHeight:tight, mt:4}>           // headline
      Image <Text style={notItalic, color:--accent}>saved.</Text>
    </Text>
    <Text style={fontSize:13.5, color:--muted-ink, mt:12, lineHeight:relaxed, maxWidth:300}>
      I could not read it clearly enough to show things to check.
    </Text>
  </View>

  {/* Saved-file card — mt-5 (20), surface + hairline, radius 24, p-3, row gap-3 */}
  <View row alignCenter mt={20} bg={--surface} hairline radius={24} p={12} gap={12}>
    <View w={64} h={80} radius={8} bg={--inset} hairline center overflowHidden relative>
      <PaperGrain absoluteFill opacity={0.4} />            // paper-grain overlay
      <Text style={fontSize:11, color:--muted-ink}>photo</Text>   // relative above grain
    </View>
    <View flex={1} minWidth={0}>
      <Text numberOfLines={1} style={fontSize:13.5, fontWeight:medium}>IMG_2643.jpg</Text>
      <Text style={fontSize:11, color:--muted-ink}>saved in Folio</Text>
    </View>
    <Pressable press>                                       // "View" — underline, muted
      <Text style={fontSize:11.5, color:--muted-ink, underline}>View</Text>
    </Pressable>
  </View>

  {/* Inset advisory note — mt-5, --inset bg, radius 12, p-4 */}
  <View mt={20} bg={--inset} radius={12} p={16}>
    <Text style={fontSize:13.5, lineHeight:relaxed, color:--muted-ink}>
      Try a clearer image first. If that still does not work, you can add one thing yourself.
    </Text>
  </View>

  {/* Melo line — mt-5 */}
  <View mt={20}>
    <MeloLine text="Let's try the image again before we ask you to type." mood="soft" />
  </View>

  <Spacer flex={1} />   // pushes CTAs to bottom; in RN ScrollView use contentContainer flexGrow:1 + justify spacing OR a flex spacer View

  {/* Primary CTA — full width, h 54, radius 24, --accent bg, white text */}
  <Pressable onPress={() => nav.go("intake")} press
    style={mb:8, width:'100%', height:54, radius:24, bg:--accent, center}>
    <Text style={color:#FFFFFF, fontWeight:medium, fontSize:15}>Try another image</Text>
  </Pressable>

  {/* Secondary CTA grid — 2 cols, gap 2.5 (10), mb-6 (24) */}
  <View row gap={10} mb={24}>
    <Pressable press style={{flex:1, height:48, radius:12, bg:--surface, hairline, center}}>
      <Text style={fontSize:13}>View image</Text>
    </Pressable>
    <Pressable onPress={() => nav.go("review")} press
      style={{flex:1, height:48, radius:12, bg:--surface, hairline, center}}>
      <Text style={fontSize:13, color:--muted-ink}>Add one thing myself</Text>
    </Pressable>
  </View>

</Safe/ScrollView>
]]>

## enginesNeeded

- Photo reader (image -> candidate money items). This screen is its FAILURE surface — it renders only when the reader has already run and produced zero usable candidates. Per RN_PORT.md the reader MUST run before this screen; manual entry here is failure-only and must route to Review (nav.go('review')), never to a blank manual form.
- Navigation engine (Nav): nav.back, nav.go('intake'), nav.go('review'). No store reads/writes — this is a pure presentational dead-end screen.
- (Demo only) filename/thumbnail are placeholders; RN must pass the real saved image reference + filename as props/route params rather than the hardcoded "IMG_2643.jpg" / "photo" placeholder.

## fidelityRisks

- Headline accent rendering: the screen shows "Image saved." with "saved." in --accent and NOT italic (em with not-italic class). The COPY_DECK markdown form is "Image **saved.**" — don't reproduce literal asterisks; render the second word in --accent. The eyebrow "Saved" above is font-display ITALIC; the accent word is NOT italic. Two different italic treatments in one block — easy to swap.
- Two-column CTA asymmetry: left "View image" uses default ink text; right "Add one thing myself" uses --muted-ink. They look identical except text color — preserve the de-emphasis on the manual escape.
- Bottom-anchored CTAs: web uses flex-1 spacer to push CTAs to the bottom of a flex column inside an overflow-y-auto container. In RN, a ScrollView won't honor flex:1 spacer the same way — use contentContainerStyle={{flexGrow:1}} with the spacer, or split into a non-scrolling footer pinned at bottom. Getting this wrong makes the CTAs float mid-screen on tall devices or get cut off on short ones.
- Thumbnail paper-grain: web overlays a turbulence SVG at opacity 0.4 with mix-blend-multiply, then the word "photo" sits relative above it. RN has no CSS blend modes on Views — replace with a pre-baked grain PNG or react-native-svg feTurbulence is unsupported; approximate with a static noise image at low opacity, keep "photo" on top.
- press utility = scale 0.97 on active; RN should pair Pressable scale with Haptics.selectionAsync() per RN_PORT.md. All five tappables (back, View, primary, View image, manual) need it.
- Mood: MeloLine mood="soft" is a kit alias that normalizes to calm. Don't pass "soft" to the RN Melo if the RN Melo only knows the 5 canonical moods — map soft->calm at the call site to match MELO_MOODS.md (fallback = calm).
- Banned-vocabulary trap: copy deliberately avoids "OCR", "read/extract/parse", "scan". Body says "could not read it clearly" — keep this exact wording; do not 'clarify' it into "couldn't scan/OCR the image".
- @opens-sheet declares edit-item, but the screen body never opens it directly — the manual path is nav.go('review'), and Review (or its row tap) is what opens edit-item. Don't wire an edit-item sheet trigger onto this screen; the doc block reflects the downstream flow, not a button here.
- no-scrollbar: hide the scroll indicator (showsVerticalScrollIndicator={false}) to match the phone-frame aesthetic.
- Spacing scale is fixed (px-7=28 horizontal, mt-5/6 = 20/24, gap 10, button heights 54/48). Do not introduce a second spacing scale (RN_PORT.md: one system).
- Filename "IMG_2643.jpg" and "View"/"View image" actions are non-functional placeholders in the prototype. In RN they must reference the actually-saved image; "View" and "View image" should open the saved asset (or be removed if no viewer exists) rather than ship as dead buttons.

## stateBranches

- populated (the ONLY real branch): this screen IS the error/fallback surface for the Image reader flow (per STATES.md: ImageSuccess error -> ImageFallback). It always renders the same single layout — saved-file card + advisory + Melo line + recoveries.
- loading: n/a here — loading lives upstream on ImageSuccess ("Folio is reading…", Melo curious, max 4s). This screen is reached only AFTER that loading resolves to failure.
- empty: n/a — there is always a saved image to show (that's the premise).
- error: this screen IS the error branch of the photo flow; it does not have its own nested error state.
- offline: per STATES.md ImageSuccess offline = "saved, will read later"; if reached offline this screen still renders identically (local-first, no network dependency, no degraded variant). Folio works without a connection — no offline banner needed.
- reduced-motion: slide-in-r collapses to final state instantly; Melo breathe/blink off; press transition off (per styles.css prefers-reduced-motion block / AccessibilityInfo.isReduceMotionEnabled in RN).

## docBlock

<![CDATA[/**
 * @rn-screen    ImageFallbackScreen
 * @rn-stack     Intake > From a photo
 * @purpose      Failure state when the photo reader cannot produce review candidates.
 * @reads        —
 * @writes       —
 * @opens-sheet  edit-item
 * @copy         FROZEN
 * @tokens       --surface --hairline --muted-ink
 * @motion       slide-in-r · press
 */]]>

## rnPrimitiveMap

- div.slide-in-r.overflow-y-auto.no-scrollbar -> ScrollView (Reanimated entering={SlideInRight.duration(360)}, showsVerticalScrollIndicator={false}, contentContainerStyle={{flexGrow:1, paddingHorizontal:28, paddingTop:16}})
- button.press -> Pressable wrapped with a scale-to-0.97 animation + expo-haptics Haptics.selectionAsync()
- span/p/h2/em + Tailwind text classes -> <Text> with StyleSheet; em.not-italic.text-[var(--accent)] -> nested <Text style={{color: theme.accent, fontStyle:'normal'}}>
- font-display -> fontFamily: 'Fraunces' (embedded); body -> 'Inter Tight' / SF Pro / Roboto
- CSS vars (--surface/--hairline/--muted-ink/--accent/--inset/--ink) -> theme object via useTheme()
- hairline utility (1px var(--hairline)) -> borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline
- rounded-2xl/xl/lg -> borderRadius 24 / 12 / 8 (radius tokens)
- flex-1 spacer <div> -> <View style={{flex:1}}> inside a flexGrow:1 ScrollView content container, OR a pinned footer View
- paper-grain (turbulence SVG + mix-blend-multiply) -> static low-opacity noise PNG/ImageBackground (no RN blend-mode); react-native-svg feTurbulence unsupported
- truncate -> numberOfLines={1} ellipsizeMode='tail'
- underline underline-offset-2 -> textDecorationLine: 'underline'
- uppercase tracking-[0.14em] -> textTransform:'uppercase', letterSpacing ~1.7 (0.14em * ~12px)
- grid grid-cols-2 gap-2.5 -> <View style={{flexDirection:'row', gap:10}}> with two flex:1 children
- nav.go(...) local nav -> @react-navigation/native stack navigation


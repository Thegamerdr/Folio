# Sheet  (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\Sheet.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\Sheet.tsx

## rnComponentName

Sheet

## purpose

Bottom-sheet shell primitive — scrim, grip, paper sheet body, spring-up. The wrapper every other sheet (edit flows, share, Melo chat, pot fund, sub caught) renders its content inside. Owns no product logic, no copy, no data: pure presentation + dismiss behavior. Feels like "paper lifting from paper" — body sits on --paper (NOT --surface).

## reads

- NONE (props only: onClose, children, title)

## writes

- NONE (invokes onClose prop only)

## opensSheets

- NONE — Sheet does not open other sheets; it IS the shell other sheets fill. RN: it maps to the single BottomSheetModal that every concrete sheet content is portaled into.

## copyKeys

- "Close sheet" — hardcoded aria-label on the scrim button (not in COPY_DECK; becomes accessibilityLabel on the RN scrim Pressable)
- title (prop) — optional caller-supplied accessibility label for the dialog (aria-label on web → accessibilityLabel/accessibilityRole="dialog" wrapper in RN). Not a visible string; no COPY_DECK key.
- VISIBLE TEXT: NONE — the Sheet primitive renders no visible copy of its own; all visible strings come from {children}.

## tokens

- --paper (sheet body background — explicitly NOT --surface)
- --ink (scrim color at 45% opacity: bg-[var(--ink)]/45)
- --hairline (grip pill color)
- --shadow-sheet (0 -8px 40px -12px rgba(26,24,21,0.18); applied via inline boxShadow)
- rounded-t-[28px] (28px top corner radius — literal, not a --radius token)
- top edge highlight gradient: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent) — literal rgba, decorative hairline

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — body slides up + fades in. NOTE doc-block says 480ms; web class .sheet-in is 0.45s/450ms — MOTION.md canonical = 480ms, use 480ms in RN.
- scrim-in (320ms ease-out) — scrim fades to 45% ink (web .scrim-in is 0.3s/300ms; MOTION.md canonical = 320ms)
- press (120ms, scale 0.97 on active) — applies to tappable elements generally; scrim is cursor-default so no press scale on it
- Reduced motion: both sheet-rise and scrim-in collapse to final state instantly (opacity 1, transform none) per @media prefers-reduced-motion / AccessibilityInfo.isReduceMotionEnabled

## componentTree

<BottomSheetModal /* @gorhom */ snapPoints={['82%']} maxDynamicContentSize handleComponent={Grip} backdropComponent={Scrim} backgroundStyle={{bg:'--paper', borderTopRadius:28, shadow:'--shadow-sheet'}} accessibilityRole="dialog" accessibilityLabel={title} accessibilityViewIsModal>
  {/* Scrim (backdropComponent) */}
  <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={{flex:1, bg:'--ink'@45%}} /* scrim-in fade */ />
  {/* Sheet body — on --paper, 28px top radius, max 82% height, clip overflow */}
  <View>
    {/* Top edge highlight — 1px white-ish gradient, aria-hidden */}
    <LinearGradient colors={[transparent, rgba(255,255,255,0.7), transparent]} start={left} end={right} style={{height:StyleSheet.hairlineWidth, position:absolute, top:0}} accessibilityElementsHidden importantForAccessibility="no" />
    {/* Grip (handleComponent) — centered pill: w36 h3 radius-full bg --hairline, pt12 pb4 */}
    <View style={{pt:12, pb:4, alignItems:'center'}}><View style={{w:36, h:3, radius:999, bg:'--hairline'}} /></View>
    {/* Scrollable content area — px24 pt8 pb24, hidden scrollbar */}
    <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{px:24, pt:8, pb:24}}>
      {children}
    </BottomSheetScrollView>
  </View>
</BottomSheetModal>

## enginesNeeded

- NONE — Sheet depends on no engine and no data. It is a presentation shell. (Engines/data live in the concrete sheet content passed as children — e.g. Pot engine for the fund sheet, Money path for verdict sheets, Melo/AI for chat sheet.)

## fidelityRisks

- Body MUST sit on --paper, NOT --surface. The whole point is 'paper lifting from paper'. gorhom's default backgroundStyle is white-ish; override backgroundStyle.backgroundColor to theme.paper explicitly.
- Scrim is WARM ink at 45% (bg-[var(--ink)]/45 = rgba(26,24,21,0.45)), never pure black. gorhom BottomSheetBackdrop defaults to #000 — set its backgroundColor to theme.ink and opacity 0.45, or pass a custom backdrop.
- Top radius is literal 28px (rounded-t-[28px]), not --radius-xl(24)/2xl(32). Use 28 exactly on the top-left/top-right corners only; bottom corners square (flush to screen bottom).
- --shadow-sheet is an UPWARD shadow (0 -8px 40px -12px). RN iOS shadowOffset must be negative height ({width:0,height:-8}); Android elevation can't render upward-only — accept the approximation or draw a gradient lip above the sheet.
- The top-edge highlight is a 1px horizontal white gradient that 'sells' the lift — easy to drop. Implement with expo-linear-gradient at StyleSheet.hairlineWidth, transparent→rgba(255,255,255,0.7)→transparent, left-to-right. It is decorative: accessibilityElementsHidden / importantForAccessibility='no'.
- Max height is 82% of the sheet container (max-h-[82%]) with inner scroll capped at calc(82vh-24px). In RN use snapPoint '82%' (or maxDynamicContentSize) and let BottomSheetScrollView handle overflow — do NOT let content push past 82%.
- Grip is exactly w-9 (36px) × 3px, fully rounded, --hairline color, with pt-3 (12) pb-1 (4) wrapper. gorhom's default handle is different — supply a custom handleComponent to match.
- Dismiss-on-scrim-tap: the web scrim is a full-bleed button calling onClose; gorhom dismisses via swipe-down + backdrop press. Wire backdrop pressBehavior='close' AND ensure it calls onClose so host store state stays in sync (don't rely only on the modal's internal dismiss).
- Add swipe-down-to-dismiss (enablePanDownToClose) — native affordance the web grip only implies; also call onClose in onDismiss so state is consistent across both dismiss paths.
- Accessibility: web sets role=dialog, aria-modal=true, aria-label=title. RN needs accessibilityViewIsModal (iOS), accessibilityRole='none'/labeled wrapper, and focus trap — gorhom does most but verify the title prop reaches an accessibilityLabel.
- Duration mismatch trap: copy the doc-block/MOTION.md canonical 480ms (rise) + 320ms (scrim), NOT the slightly-shorter web .sheet-in(450ms)/.scrim-in(300ms) class values.
- Reduced motion must render the RESOLVED sheet instantly (no rise, no fade) per MOTION.md 'reduced motion is final state, not a slower animation' — gate the timing config on AccessibilityInfo.isReduceMotionEnabled.
- no-scrollbar: hide the scroll indicator (showsVerticalScrollIndicator={false}) to match the web .no-scrollbar treatment inside the phone.

## docBlock

/**
 * @rn-component Sheet
 * @purpose      Bottom-sheet shell — scrim, grip, paper sheet body, spring-up.
 * @copy         —
 * @tokens       --paper --hairline --ink · shadow-sheet
 * @motion       sheet-rise 480ms cubic-bezier(.16,1,.3,1)
 *               scrim-in   320ms ease-out
 * @rn-port      Use a native bottom-sheet (e.g. @gorhom/bottom-sheet) with a
 *               40% ink scrim, 28px top radius, 4px hairline grip, and the
 *               same spring curve. Sheet body sits on --paper, NOT --surface,
 *               so it feels like paper lifting from paper.
 */

## moods

- NONE — the Sheet primitive carries no Melo mood. Mood is owned by the concrete sheet content (per MELO_MOODS.md: 'Quiet sheets' = calm; Pot fund sheet = curious; Sub caught sheet = curious; Melo chat sheet = calm). The shell stays neutral.

## rnPrimitiveMap

- <Sheet> web div+scrim+body → @gorhom/bottom-sheet BottomSheetModal (per RN_PORT.md component map)
- scrim <button> → BottomSheetBackdrop (custom) or full-flex Pressable, accessibilityLabel='Close sheet', pressBehavior='close' + onClose
- grip <div> → custom handleComponent: View pill w36×3 radius-full bg theme.hairline
- top-edge highlight gradient <div> → expo-linear-gradient (LinearGradient) at StyleSheet.hairlineWidth height
- scroll container (overflow-y-auto no-scrollbar) → BottomSheetScrollView showsVerticalScrollIndicator={false}
- CSS tokens (--paper/--ink/--hairline/--shadow-sheet) → theme object + useTheme() hook
- .sheet-in / .scrim-in → react-native-reanimated withTiming (gorhom animationConfigs) — 480ms rise / 320ms scrim, easing cubic-bezier(.16,1,.3,1) / ease-out
- rounded-t-[28px] → borderTopLeftRadius/borderTopRightRadius: 28 on backgroundStyle
- boxShadow var(--shadow-sheet) → iOS shadow* (negative height offset) / Android elevation approximation
- role=dialog/aria-modal/aria-label → accessibilityViewIsModal + accessibilityLabel={title}
- press utility → Pressable + Haptics.selectionAsync() (expo-haptics) where tappable

## stateBranches

- populated — the only branch: render scrim + paper body + grip + {children}. The Sheet has no empty/loading/error states of its own; those belong to whatever is rendered as children. STATES.md has no Sheet-specific branches.
- presence/absence — the host controls mount: Sheet is mounted only when a sheet is active (web renders it inside the phone frame with z-30). In RN this is present()/dismiss() on the BottomSheetModal ref, driven by host store sheet state.
- reduced-motion variant — render fully-resolved (no rise/fade) instead of animating.


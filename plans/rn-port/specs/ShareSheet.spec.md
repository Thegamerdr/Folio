# ShareSheet (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetShare.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetShare.tsx

## rnComponentName

ShareSheet

## purpose

Quiet win card for sharing a closed cycle. A bottom sheet that shows a single "share card" summarizing the most recent closed cycle (month label, spare amount left over, count of paused subscriptions) and lets the user share/copy that summary text, or dismiss.

## docBlock

@rn-sheet ShareSheet
@purpose Quiet win card for sharing a closed cycle.
@reads cycles (most recent)
@writes —
@copy FROZEN
@tokens --paper --accent --positive --hairline
@motion stamp on render · sheet-in

## reads

- useAppStore: cycles (CycleRecord[]) — uses cycles[0] as `latest`
- useAppStore: subPaused (Record<string, boolean>) — counts truthy values for pausedCount
- derived: latest?.label ?? "this month" (monthLabel)
- derived: latest?.spare ?? 0 (saved)
- derived: Object.values(subPaused).filter(Boolean).length (pausedCount)
- local useState: copied (boolean) — drives Share button label
- doc-block @reads declares 'cycles (most recent)' only; subPaused read is real in code but omitted from the doc block (fidelity note)

## writes

- No store writes (doc-block @writes is —)
- Local state only: setCopied(true) on clipboard success, then setCopied(false) after 1600ms timeout
- Side effect (not store): navigator.share (Web Share API) OR navigator.clipboard.writeText — RN must substitute the native share sheet / Clipboard

## opensSheets

## copyKeys

- A quiet win (eyebrow label — literal, NOT in COPY_DECK.md)
- Cycle closed, {monthLabel}. (headline; monthLabel is the accent word, e.g. 'this month' fallback)
- Folio (card brand chip label — app.name)
- £{saved} (card hero amount; £ = currency.symbol, tabular figures)
- left over this month (card subline — literal, NOT in COPY_DECK.md)
- {pausedCount} quiet subscription paused. You made it to the end of the month. (card body when pausedCount === 1; singular)
- {pausedCount} quiet subscriptions paused. You made it to the end of the month. (card body when pausedCount > 1; plural)
- You made it to the end of the month. (card body when pausedCount === 0)
- — quiet money, no spreadsheet (card italic footer; matches app tagline tone)
- Share (primary button, default state)
- Copied ✓ (primary button, after clipboard copy success)
- Not now (secondary dismiss button)
- Share-intent text payload: `Closed {monthLabel} with Folio · £{saved} spare, {pausedCount} quiet sub|subs paused. Quiet money, no spreadsheet.` (sub singular when pausedCount===1, else subs)
- Native share dialog title: `Folio · cycle closed`

## tokens

- --paper (sheet body ground, via Sheet)
- --surface (card gradient end stop; also color-card)
- --accent (#E0633A — headline accent <em>, card brand dot, primary button bg)
- --accent-soft (#F5E4DB — card gradient start stop)
- --positive (#3E8E5A — declared in doc block; not visibly applied in this component's JSX)
- --hairline (#ECE9E0 — card border via .hairline util; also Sheet grip)
- --muted-ink (#6B6760 — eyebrow, subline, body, italic footer)
- --ink (#1A1815 — Sheet scrim @45%, default text)
- shadow-card (card boxShadow var(--shadow-card))
- shadow-sheet (Sheet body boxShadow, inherited)
- radius-xl 24px (card rounded-[24px]); button rounded-2xl (16px); Sheet rounded-t-[28px]
- font-display Fraunces (headline, card £ amount, italic footer)
- tabular (font-variant-numeric tabular-nums on the £ amount)
- white #FFFFFF (primary button text — color-primary-foreground)

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — sheet body slides up + fades, via Sheet (.sheet-in is 0.45s in css)
- scrim-in (320ms ease-out) — scrim fades to 45% ink, via Sheet
- stamp / verdict-stamp (600ms cubic-bezier(.34,1.56,.64,1) back-out) — declared in doc block as 'stamp on render'; intent: the win card stamps in on render (NOTE: the .stamp class is not literally applied to any node in current TSX — doc-block intent vs. code gap; RN should implement the card stamp-in)
- press (120ms ease, scale 0.97 on :active) — both buttons carry the .press utility → RN Pressable + Haptics.selectionAsync()
- Reduced motion: all collapse to final state instantly (AccessibilityInfo.isReduceMotionEnabled)

## moods

- No <Melo> instance is rendered in this component (no mood). MELO_MOODS.md lists no row for a Share/win sheet. If Melo is ever added here, 'cheer' (small win) is the only on-brand fit, but the source ships Melo-less — keep it Melo-less for fidelity. The card itself is the 'quiet win' object.

## componentTree

<![CDATA[
<Sheet onClose={onClose} title="Share your cycle">   {/* gorhom BottomSheetModal: --paper body, 28px top radius, 45% ink scrim, grip, sheet-rise */}
  <View style={padX2 padB2}>                          {/* px-2 pb-2 */}
    <Text style={eyebrow}>A quiet win</Text>          {/* 11px, uppercase, tracking 0.14em, muted-ink */}
    <Text style={headline}>                            {/* font-display 24px, leading-tight, mt-1 */}
      Cycle closed, <Text style={headlineAccent}>{monthLabel}</Text>.   {/* accent word in --accent, NOT italic */}
    </Text>

    <View style={shareCard}>                           {/* mt-5; rounded 24px; p-6; linear-gradient accent-soft→surface (135deg br); hairline border; shadow-card; stamp-in on render */}
      <View style={cardBrandRow}>                      {/* row, center, gap-2, 11px uppercase tracking 0.14em muted-ink */}
        <View style={brandDot} />                       {/* 6x6 (w-1.5 h-1.5) circle, bg --accent */}
        <Text style={brandLabel}>Folio</Text>
      </View>
      <Text style={cardAmount}>£{saved}</Text>          {/* mt-3; font-display 40px; leading-none; tabular-nums */}
      <Text style={cardAmountSub}>left over this month</Text>   {/* 12px muted-ink mt-1 */}
      <Text style={cardBody}>                           {/* mt-5; 13.5px; leading-relaxed */}
        {pausedCount > 0
          ? `${pausedCount} quiet ${pausedCount === 1 ? "subscription" : "subscriptions"} paused. You made it to the end of the month.`
          : "You made it to the end of the month."}
      </Text>
      <Text style={cardFooter}>— quiet money, no spreadsheet</Text>   {/* mt-4; font-display italic; 12px muted-ink */}
    </View>

    <Pressable onPress={share} style={primaryBtn}>      {/* press; mt-5; full width; h-12 (48); rounded-2xl(16); bg --accent; 14px medium; white text */}
      <Text style={primaryBtnText}>{copied ? "Copied ✓" : "Share"}</Text>
    </Pressable>
    <Pressable onPress={onClose} style={secondaryBtn}>  {/* press; mt-2; full width; h-10 (40); 12.5px; muted-ink */}
      <Text style={secondaryBtnText}>Not now</Text>
    </Pressable>
  </View>
</Sheet>
]]>

## enginesNeeded

- Cycle tracker / store: provides cycles[] (closed CycleRecord list). This sheet only READS cycles[0]; the closing ritual that produces a CycleRecord lives elsewhere (PaydayRitual).
- Subscription detector / store: provides subPaused map used for pausedCount.
- Native share: react-native Share API (Share.share({ title, message })) replaces navigator.share.
- Clipboard fallback: @react-native-clipboard/clipboard (or expo-clipboard) replaces navigator.clipboard.writeText, with the 1600ms 'Copied ✓' revert.
- No new product engine required — purely a presentation surface over existing cycle + subscription state.
- Empty/missing-cycle handling: with no closed cycle, latest is undefined → monthLabel 'this month', saved 0, so it renders £0 'left over this month' (see fidelity risks — RN should decide whether to gate the sheet when cycles is empty).

## stateBranches

- populated (happy path, pausedCount > 0): card body uses plural/singular branch on pausedCount; £{saved} shows the real spare.
- populated, pausedCount === 1: body says 'subscription' (singular) — distinct from >1 'subscriptions'. Two singular/plural branches in card body AND a separate one in the share text payload ('sub'/'subs').
- populated, pausedCount === 0: card body collapses to just 'You made it to the end of the month.'
- empty (no closed cycle, cycles[]): latest undefined → monthLabel 'this month', saved 0 → card reads '£0 / left over this month'. STATES.md does not define a Share-sheet empty branch; current code renders the £0 card rather than an EmptyState. RN should likely not surface this sheet at all until a cycle is closed (this sheet is the close-payoff).
- copied (button sub-state): primary button label flips 'Share' → 'Copied ✓' for 1600ms after a successful clipboard write (only reached on the clipboard fallback path, not when native share dialog opens).
- share-cancelled: navigator.share rejection is swallowed (catch noop) and falls through to clipboard copy on web; RN Share.share dismissedAction should be a silent no-op (do NOT then copy if the native sheet was shown).
- loading: n/a — no async data load; reading cycles is synchronous.
- error: clipboard failure is swallowed (catch noop) — no error UI. Honest-copy rule means do not add a fake success; just leave label as 'Share'.
- offline: n/a — fully local; share/copy work offline.

## rnPrimitiveMap

- <Sheet> → @gorhom/bottom-sheet BottomSheetModal (40-45% ink scrim, 28px top radius, 4px hairline grip, sheet-rise spring). Body on --paper not --surface.
- <div>/<h3> → <View>/<Text> (RN has no DOM heading; carry accessibilityRole='header' on the headline).
- <em className=not-italic text-[var(--accent)]> → <Text> with accent color and NO italic (it is deliberately not italic).
- bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface)] → react-native-linear-gradient (or expo-linear-gradient) with colors=[accentSoft, surface], start={x:0,y:0} end={x:1,y:1}. No CSS gradient in RN.
- boxShadow var(--shadow-card) → RN shadow props (shadowColor rgba(26,24,21), shadowOffset, shadowOpacity, shadowRadius) on iOS + elevation on Android; approximate the two-layer card shadow.
- hairline border util → borderWidth: StyleSheet.hairlineWidth, borderColor: hairline (or 1px to match web exactly).
- tabular (font-variant-numeric) → <Text style={{ fontVariant: ['tabular-nums'] }}> on the £ amount.
- font-display (Fraunces) → embedded Fraunces font family; italic footer uses Fraunces italic.
- tracking-[0.14em] → letterSpacing in px (~1.54 at 11px); uppercase → textTransform: 'uppercase'.
- <button className=press> → <Pressable> with scale 0.97 active style + Haptics.selectionAsync() on press.
- navigator.share → react-native Share.share({ title: 'Folio · cycle closed', message: text }).
- navigator.clipboard.writeText → Clipboard.setString(text) (@react-native-clipboard/clipboard or expo-clipboard); keep the 1600ms setTimeout revert (clear on unmount).
- setTimeout → keep, but store the id in a ref and clear it on unmount to avoid setState-after-unmount.
- fixed h-12/h-10 (rem) → fixed dp heights 48/40; w-full → width:'100%' or alignSelf:'stretch'.

## fidelityRisks

- Doc-block vs code drift on @writes/@reads: @reads says only 'cycles', but code also reads subPaused; @motion says 'stamp on render' yet the .stamp class is NOT applied to any node in the current TSX (the card just renders via the parent .sheet-in). Decide intent: implement the card stamp-in (verdict-stamp 600ms back-out) to honor the doc block, OR match current code (no stamp). Recommend honoring the doc block — the win card stamping in is the moment.
- Two independent singular/plural decisions: card body uses 'subscription'/'subscriptions'; the SHARE TEXT uses 'sub'/'subs'. Port both; do not unify them. COPY_DECK localization note requires ICU MessageFormat plurals in RN — wire both through it.
- Several visible strings are NOT in COPY_DECK.md ('A quiet win', 'left over this month', 'Cycle closed, …', the card body sentences, '— quiet money, no spreadsheet', 'Share', 'Copied ✓', 'Not now', share text, share title). COPY_DECK is declared the single source of truth ('if a string isn't here, it doesn't ship') — these must be ADDED to COPY_DECK before RN ship, not hardcoded.
- Empty-state gap: with no closed cycle the sheet renders '£0 / left over this month' rather than gating. The sheet is the payoff for closing a cycle, so showing £0 is off-tone. RN should only present this sheet when cycles.length > 0 (or define a real empty branch).
- Web Share fallback logic does not map 1:1 to RN: on web, share() tries navigator.share then falls through to clipboard on absence/cancel. On RN, Share.share is always available; a user-cancel (dismissedAction) must NOT trigger a clipboard copy + 'Copied ✓'. Re-model: native share is primary; clipboard is only a secondary/explicit fallback, and 'Copied ✓' only on an actual copy.
- Gradient direction + stops: 'to-br' (top-left → bottom-right) with accent-soft→surface. RN LinearGradient needs start {0,0} end {1,1}; getting the angle/stops wrong loses the soft warm-paper card feel.
- Card border is a true hairline on web (1px solid --hairline). StyleSheet.hairlineWidth is sub-pixel on high-DPI and can vanish; consider explicit 1px to keep the card edge.
- Accent word is deliberately NOT italic (not-italic override on <em>) — easy to accidentally italicize in RN since it's an emphasis token. Keep upright, accent color only.
- --positive is declared in the doc-block @tokens but not visibly used in JSX — do not invent a green element to 'use' it; treat as a declared-not-applied token.
- tabular-nums must be applied to the £ amount (and ideally anywhere a money figure renders) so the figure doesn't jitter; Fraunces must ship with tnum support or fall back to a tabular face for the amount.
- setTimeout(1600) for the 'Copied ✓' revert can fire after unmount when the sheet is dismissed quickly → guard with a ref + cleanup.
- Dark mode: web has a .dark inverse but RN_PORT says the RN app keeps the warm paper world — do NOT port the dark token set for this sheet unless the RN app already themes it; default to the light paper palette.

# SubCaughtSheet  (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetSubCaught.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetSubCaught.tsx

## rnComponentName

SubCaughtSheet

## purpose

Bottom sheet that appears when the subscription detector flags a likely recurring charge. It shows the candidate (name, amount, how many cycles seen, last-seen date) in deliberately hedged language ("Looks like...", never "is") and lets the user confirm to add it as a subscription or dismiss this one. Surfaces the subs.caught.* copy family and pairs with the nudge.sub.caught local notification.</parameter>
<parameter name="docBlock">/**
 * @rn-sheet     SubCaughtSheet
 * @purpose      Folio spotted a likely recurring charge. Confirm to add as a subscription, or dismiss.
 * @reads        — (synthetic candidate in prototype; RN engine supplies the candidate)
 * @writes       — (RN app: setSubs with a new sub)
 * @copy         FROZEN — never claims certainty. "Looks like" not "is".
 * @tokens       --surface --hairline --accent --inset
 * @motion       sheet-rise · gentle scale-in on the candidate card
 */

## reads

- NO store reads in the prototype — a synthetic CANDIDATE constant is hardcoded: { name: 'Sound+ Studio', amount: 6.99, seen: 3, lastDate: '12 Jun', category: 'music' }
- RN: candidate MUST be supplied by the subscription-detector engine — either a `candidate` prop or a `pendingSubCandidate` store slice with shape { name: string; amount: number; seen: number; lastDate: string; category: string }
- Local UI state only: `busy` (boolean) from useState, gating the confirm button label/disabled

## writes

- NO store writes in the prototype — confirm() only sets local `busy=true` then calls onClose after a 320ms setTimeout
- RN: confirm() MUST call addSub / setSubs to persist the new subscription { name, amount, category, ... } BEFORE dismissing (doc block declares @writes = setSubs)
- 'Not this one' path writes nothing and just dismisses; RN should optionally mark the candidate dismissed so the detector does not re-surface it (subOverrides / dismissedCandidates)
- onClose() — closes the sheet (passed in by parent)

## opensSheets

- none — it is itself a sheet; both actions (confirm + 'Not this one') resolve by calling onClose to dismiss

## copyKeys

- I noticed
- Folio spotted {name}. (name rendered as accent <em>, period inside the accent) — COPY_DECK subs.caught.head = 'Folio spotted **{name}.**'
- {name} (candidate name, shown again as the inset card label)
- {formatGBP(amount)} → £7 (formatGBP rounds: maximumFractionDigits:0, so 6.99 displays as £7) — currency.symbol = £
- Seen {seen} months in a row
- Last: {lastDate}
- Looks like a monthly charge. Add it to subscriptions so Folio can plan around it? (prototype string; COPY_DECK subs.caught.body is the shorter 'Looks like a monthly charge. Add it?')
- Yes, add it
- Adding… (busy state label)
- Not this one
- Related but NOT shown here: nudge.sub.caught = 'Folio spotted a recurring charge.' (the notification that routes the user into this sheet)

## tokens

- --paper (sheet body background via <Sheet>)
- --surface (Melo paper fill)
- --inset (candidate card background)
- --ink (primary text, sheet grip via hairline, scrim at 45%)
- --muted-ink ('I noticed' label, meta row, body sentence, 'Not this one')
- --hairline (card border via .hairline, vertical divider, grip)
- --accent (#E0633A — accent name in headline, amount, confirm button bg)
- --caution (Melo folded corner)
- --shadow-sheet (sheet drop shadow)
- --font-display (Fraunces — 'I noticed' italic, headline, amount)
- --radius: sheet rounded-t-[28px]; card + confirm button rounded-2xl (16px)
- tabular / font-variant-numeric: tabular-nums (the amount)

## motions

- sheet-rise — 480ms cubic-bezier(.16,1,.3,1) (sheet slides up + fades; from <Sheet> .sheet-in)
- scrim-in — 320ms ease-out, scrim fades to 45% ink (from <Sheet>)
- scale-in — 320ms cubic-bezier(.16,1,.3,1), the doc block's 'gentle scale-in on the candidate card' (apply to the --inset card; not literally present in TSX but specified in @motion)
- press — 120ms, scale 0.97 on tap; applied to both buttons (className 'press')
- melo-breathe-fast — 2.4s ease-in-out infinite (curious mood idle breathing)
- Reduced motion: all collapse to final state per MOTION.md / styles.css prefers-reduced-motion

## moods

- curious — Melo size 32, mood='curious' in the header. Matches MELO_MOODS.md ('Sub caught (sheet) → curious'). Paper state: top-right corner peeled, right ear lifts, eyes 'up', breathe-fast. No pose badge used here.

## stateBranches

- populated (happy path) — the only branch the prototype renders: candidate card + hedged sentence + two actions
- busy/loading (confirm in flight) — button label swaps 'Yes, add it' → 'Adding…', button disabled (opacity 50). Local, not async in prototype; RN should keep it during the real addSub write
- empty — N/A: this sheet only opens when a candidate exists. If candidate is null, RN should not present the sheet (or render nothing)
- error — NOT in prototype. RN: if addSub fails, surface honest copy (err.generic = 'Something didn't catch. Try once more?') and re-enable the button rather than silently closing
- offline — local-first; adding a sub is a local write, so offline behaves identically to populated (no network)

## componentTree

<![CDATA[<Sheet onClose={onClose} title="Subscription spotted">   {/* gorhom BottomSheetModal: 40% ink scrim, 28px top radius, paper bg, grip, sheet-rise */}
  <View style={px1 pb2}>
    {/* Header row: Melo + copy */}
    <View style={flexRow alignItemsStart gap12}>
      <Melo size={32} mood="curious" />
      <View style={flex1}>
        <Text style={fontDisplay italic 13 muted}>I noticed</Text>
        <Text style={fontDisplay 24 leadingTight mt0.5}>
          Folio spotted <Text style={accent /* not italic */}>{candidate.name}.</Text>
        </Text>
      </View>
    </View>

    {/* Candidate card — inset bg, hairline, scale-in */}
    <View style={mt20 bgInset hairline radius16 px20 py16}>
      <View style={flexRow alignItemsBaseline justifyBetween}>
        <Text style={15 ink}>{candidate.name}</Text>
        <Text style={fontDisplay 22 accent tabularNums}>{formatGBP(candidate.amount)}</Text>
      </View>
      <View style={mt8 flexRow alignItemsCenter gap12}>
        <Text style={11.5 muted}>Seen {candidate.seen} months in a row</Text>
        <View style={w1 h12 bgHairline} />   {/* vertical divider */}
        <Text style={11.5 muted}>Last: {candidate.lastDate}</Text>
      </View>
    </View>

    {/* Hedged explanation */}
    <Text style={mt16 13.5 muted leadingRelaxed}>
      Looks like a monthly charge. Add it to subscriptions so Folio can plan around it?
    </Text>

    {/* Primary action */}
    <Pressable onPress={confirm} disabled={busy}
      style={press mt20 wFull h48 radius16 bgAccent {busy && opacity50}}>
      <Text style={white 14 medium}>{busy ? "Adding…" : "Yes, add it"}</Text>
    </Pressable>

    {/* Refusal */}
    <Pressable onPress={onClose} style={press mt8 wFull h40}>
      <Text style={12.5 muted center}>Not this one</Text>
    </Pressable>
  </View>
</Sheet>]]>

## enginesNeeded

- Subscription detector (RN_PORT.md) — recurring-charge pattern detection across cycles; runs after each new batch of transactions and produces the candidate this sheet renders
- Local store + sync — setSubs/addSub to persist the confirmed subscription (SQLite via Drizzle/WatermelonDB)
- Nudge scheduler — emits nudge.sub.caught local notification that brings the user into this sheet (max 1/day, mood-aware)
- Cycle/money-path engine (downstream) — once added, the sub feeds the will-I-make-it-to-payday plan ('so Folio can plan around it')

## fidelityRisks

- Copy drift: the prototype hardcodes literal strings that do NOT match COPY_DECK keys verbatim. Headline label is 'I noticed' (no key), the explanation is the long form 'Looks like a monthly charge. Add it to subscriptions so Folio can plan around it?' vs COPY_DECK subs.caught.body = 'Looks like a monthly charge. Add it?'. RN must move all strings into the keyed deck and decide which wording ships — the keyed deck is the source of truth.
- formatGBP rounds to whole pounds (maximumFractionDigits:0), so the £6.99 candidate displays as '£7'. Decide deliberately whether subscriptions should show pennies (£6.99) — if so, do NOT reuse formatGBP unchanged.
- 'Seen {seen} months in a row' assumes monthly; the candidate has a `category` but no cadence field. Real detector must supply cadence (monthly/yearly) and the copy/plural must adapt (ICU MessageFormat per COPY_DECK localization note).
- Candidate name + period live inside the accent <em>: 'Folio spotted [name.]' — the trailing period is accent-colored and the <em> is not-italic. Preserve exactly; do not italicize and do not move the period outside the accent run.
- Voice rule — must never claim certainty: keep 'Looks like', never 'is'. Banned vocab nearby (import/parse/sync/smart) must not creep into RN copy.
- confirm() in the prototype fakes success with setTimeout(onClose, 320). RN must perform the real addSub write first and only then close; handle failure (don't dismiss on error). Keep the 'Adding…' busy label + disabled/opacity-50 state during the write.
- Two-button hierarchy: filled accent primary (h48) + ghost muted refusal (h40). 'Refusal is always an option' (STATES.md) — keep 'Not this one' present and low-emphasis; don't promote it to a second filled button.
- Sheet body sits on --paper, NOT --surface (paper-lifting-from-paper); use a real native bottom sheet (@gorhom/bottom-sheet) with the spring curve, 28px top radius, hairline grip, 45% ink scrim — not a faded modal.
- Card scale-in is specified in the doc block @motion but absent from the TSX; the RN port should add the gentle scale-in to the candidate card to match intent.
- tabular-nums on the amount must be preserved (fontVariant: ['tabular-nums']) so money reads as money.
- Empty/error branches are undesigned here — guard against rendering the sheet with a null candidate, and add an honest error path for a failed add (err.generic).

## rnPrimitiveMap

- <Sheet> → @gorhom/bottom-sheet BottomSheetModal (40% ink scrim, 28px top radius, hairline grip, sheet-rise spring) — body on --paper
- <div>/<p>/<span>/<h3> → <View>/<Text> (RN has no DOM elements; headline uses Fraunces <Text>)
- <button> → <Pressable> + expo-haptics Haptics.selectionAsync() for the 'press' feel (className 'press' → onPressIn scale 0.97 via reanimated)
- <Melo size mood='curious'> → react-native-svg + reanimated breathe (lucide-react → lucide-react-native if any icons)
- formatGBP (kit) → port as-is or via Intl.NumberFormat('en-GB'); '−' minus sign already used for negatives
- CSS vars (--accent etc.) → theme object + useTheme()/kitTheme makeStyles pattern
- Tailwind utility classes (flex/gap/px/rounded-2xl/text-[..]) → StyleSheet objects; hairline border → StyleSheet.hairlineWidth or 1px --hairline; the w-px h-3 divider → <View width:1 height:12 bg:--hairline>
- tabular figures → <Text style={{ fontVariant: ['tabular-nums'] }}>
- setTimeout(onClose, 320) confirm shim → real async addSub then close (await write, handle error)
- italic 'I noticed' → Fraunces italic Text (fontStyle:'italic', fontFamily display)
- disabled:opacity-50 → disabled prop + conditional opacity style on the Pressable


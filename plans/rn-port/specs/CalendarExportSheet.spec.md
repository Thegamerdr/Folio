# CalendarExportSheet (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetCalendarExport.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetCalendarExport.tsx

## rnComponentName

CalendarExportSheet

## purpose

One-way calendar-feed sheet. Pulls the user's derived money dates (paydays, bills, renewals, deadlines, review/check tasks) into their existing calendar app two ways: download a .ics file, or copy a webcal:// subscribe URL. One direction only — Folio writes into the calendar and never reads anything back. The hosted webcal feed is a CLAIM that needs the RN sync engine; the web prototype ships ONLY the .ics download and the copy is deliberately truthful about that ("Live subscribe link ships with the phone app."). Title shown in Sheet chrome is "Subscribe".

## reads

- events: DerivedEvent[] (prop)
- events.length
- ics = eventsToIcs(events) (useMemo)
- copied: boolean (local useState)
- webcal: string (hardcoded const 'webcal://folio.app/feed/personal.ics')
- onClose: () => void (prop)

## writes

- no store writes (@writes —)
- downloadIcs (side effect, web Blob)
- clipboard write (side effect)
- toast (side effect, sonner)
- setCopied / setTimeout(2000)

## opensSheets

## copyKeys

- Subscribe (eyebrow label AND Sheet aria/title)
- × (close glyph, aria-label 'Close')
- Your money dates, in your calendar. (headline; 'calendar.' is accent word — <em> rendered not-italic in --accent)
- One-way — your money moves into your calendar app. Folio doesn't read anything back.
- What's included
- Paydays
- Bills & renewals (literal markup 'Bills &amp; renewals')
- Deadlines
- Things to check
- {events.length} dates in the next 35 days (count interpolated; 35 = windowDays constant)
- Download calendar file
- Or subscribe
- webcal://folio.app/feed/personal.ics (readonly input value)
- Copy
- Copied (button toggles after success, reverts after 2000ms)
- Live subscribe link ships with the phone app.
- Done
- Calendar file saved (toast title, dur 4000)
- Open it to drop your money dates into your calendar app. (toast desc)
- Link copied (toast title, dur 3500)
- Paste into your calendar app's subscribe field. (toast desc)
- Couldn't copy (toast title on clipboard failure; desc = the webcal URL)
- NOTE: none of these strings exist in COPY_DECK.md — they are inlined and marked @copy FROZEN; the inline source IS the source of truth. RN must extract them into COPY_DECK before/at port per the deck's 'if a string isn't here it doesn't ship' rule.

## tokens

- --paper (sheet body, via Sheet)
- --accent (download CTA bg + accent word + focus ring)
- --inset (subscribe input bg)
- --hairline (hairline borders, grip)
- --muted-ink (eyebrow, body, count, close glyph, Done label, input text)
- --surface ('What's included' card bg + Copy button bg)
- --positive (Paydays dot)
- --negative (Bills & renewals dot)
- --caution (Deadlines dot)
- --ink (scrim 45%, via Sheet)
- white/#FFFFFF (download CTA text)
- shadow-sheet (sheet shadow, via Sheet)
- doc-block declares: --paper --accent --inset --hairline (subset; actual usage is broader as listed)

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — sheet slides up + fades, via Sheet .sheet-in
- scrim-in (320ms ease-out) — scrim fades to 45% ink, via Sheet
- press (transform scale(0.97) on :active, 120ms ease) — on close X, download CTA, Copy, Done buttons
- no count-up / route-draw / verdict-stamp / Melo motion in this sheet

## componentTree

<Sheet onClose={onClose} title="Subscribe"> // gorhom BottomSheetModal in RN
<Row spaceBetween>
<Text eyebrow>Subscribe</Text> // 11px uppercase tracking .14em, muted-ink
<Pressable onPress={onClose} aria-label="Close"><Text>×</Text></Pressable> // press, 18px muted-ink
</Row>
<Text display h3>Your money dates, in your <Text accent>calendar.</Text></Text> // Fraunces 26px leading-tight
<Text body muted>One-way — your money moves into your calendar app. Folio doesn't read anything back.</Text> // 13px
<Card surface hairline rounded2xl p4 mt5> // "What's included"
<Text eyebrow>What's included</Text> // 10.5px uppercase
<List mt2 gap1.5 text13>
<Item><Dot positive/>Paydays</Item>
<Item><Dot negative/>Bills & renewals</Item>
<Item><Dot caution/>Deadlines</Item>
<Item><Dot accent/>Things to check</Item>
</List>
<Text mt3 italic tabular 11.5px muted>{events.length} dates in the next 35 days</Text>
</Card>
<Pressable onPress={handleDownload} accentBtn h54 rounded2xl mt5 press> // bg accent, white, 15px medium
<Text>Download calendar file</Text>
</Pressable>
<View mt4> // subscribe block
<Text eyebrow>Or subscribe</Text>
<Row mt2 gap2 alignCenter>
<TextInput readOnly value={webcal} inset hairline rounded-xl h11 tabular 12px muted onFocus={selectAll}/>
<Pressable onPress={handleCopy} surface hairline rounded-xl h11 px4 press><Text>{copied ? "Copied" : "Copy"}</Text></Pressable>
</Row>
<Text mt2 italic 11px muted>Live subscribe link ships with the phone app.</Text>
</View>
<Pressable onPress={onClose} h44 rounded2xl mt5 press><Text 13.5px muted center>Done</Text></Pressable>
</Sheet>

## enginesNeeded

- Calendar event derivation (deriveCalendarEvents in lib/calendar-events.ts) — @web-only; RN replaces static RECURRING_BILLS seed with the real Bills engine and PERSONAL_DEADLINES with the deadlines registry
- Bills engine (RN) — feeds bill events
- Subscription detector (RN) — feeds sub renewal + trial-review events
- Pot engine (RN) — feeds weekly pot top-up events
- Deadlines registry (RN) — feeds personal/UK deadlines
- ICS serializer (lib/ics.ts, eventsToIcs) — pure, ports as-is
- RN sync engine — REQUIRED for the hosted webcal feed (the prototype only ships .ics download; the copy is honest about this gap, doc block @rn-engine)
- events are passed IN as a prop (DerivedEvent[]); the sheet itself depends on the host having already derived them

## fidelityRisks

- The webcal:// URL is ILLUSTRATIVE and hosted-feed is a CLAIM not yet true — must keep the honest disclaimer 'Live subscribe link ships with the phone app.' and never imply the feed works until the RN sync engine exists (COPY_DECK honesty rule + doc-block @rn-engine).
- downloadIcs uses Blob + <a>.download (web-only). RN: use expo-file-system writeAsStringAsync + expo-sharing shareAsync (or Share API) with mime text/calendar; iOS opens the system 'Add to Calendar'.
- navigator.clipboard?.writeText is web. RN: expo-clipboard setStringAsync; it resolves not rejects, so re-architect the success/failure branch (web uses .then(ok, fail)).
- toast via sonner does not exist in RN — wire to the app's chosen toast/Snackbar; keep exact titles+descriptions+durations (4000 / 3500).
- Copied→Copy reset uses setTimeout(2000); ensure cleared on unmount (RN: clear timer in cleanup / useRef) to avoid setState-after-unmount.
- The accent word uses <em className='not-italic'> — in RN render plain Text in --accent (no italic); don't let the serif headline go italic.
- Bullet dot colors are semantic (positive/negative/caution/accent) and must map to derived event kinds (in/out/deadline/review) — keep the exact color→meaning pairing.
- tabular figures required on the count line and the webcal input (fontVariant: ['tabular-nums']).
- Sheet body sits on --paper NOT --surface (paper-lifting-from-paper); the inner card is --surface — don't flatten the two.
- readonly input onFocus select-all is a web nicety; RN TextInput selectTextOnFocus={true} approximates it.
- max-h 82% + internal scroll (no-scrollbar) — gorhom snapPoints must allow the content to scroll on small devices without clipping Done.
- '35 days' is hardcoded copy but tied to windowDays default; if RN changes the window, the string must change with it (don't desync count window vs copy).
- No empty/loading/error/offline branch in the component itself (see stateBranches) — but events:[] is a real runtime case ('0 dates in the next 35 days', empty ICS) and must read sensibly.
- All visible strings are inlined and absent from COPY_DECK.md though deck rule says strings must live there to ship — extract on port; also re-check 'Bills & renewals' against banned-words (it's clean).
- Strings are @copy FROZEN — do not reword during the port.

## docBlock

/\*\*

- @rn-sheet CalendarExportSheet
- @purpose One-way calendar feed — download .ics or copy a webcal URL
-               so paydays, bills, and deadlines land in the user's
-               existing calendar app.
- @reads derived calendar events (passed in)
- @writes —
- @copy FROZEN
- @tokens --paper --accent --inset --hairline
-
- @rn-engine Hosted webcal feed requires the RN sync engine. The web
-               prototype ships only the .ics download — copy text is
-               truthful about that.
  \*/

## moods

- none — this sheet renders no Melo (per MELO_MOODS 'No mood = no Melo' / 'If a surface doesn't earn Melo, leave him out'). Do NOT add a Melo character on port.

## stateBranches

- populated — the only designed branch: always renders the 4-item list, the count line, download CTA, and subscribe block regardless of events length
- empty (events.length === 0) — not a separate visual branch; renders '0 dates in the next 35 days' and produces an empty-but-valid ICS (BEGIN/END VCALENDAR with no VEVENTs). Verify it reads sensibly.
- loading — n/a (events are passed in already derived; no async inside the sheet)
- error — n/a for render; the only error path is clipboard failure → toast 'Couldn't copy' with the URL in the description (recovery = user copies manually)
- offline — n/a; .ics download is fully local; webcal subscribe is explicitly deferred to the phone app so there's no network dependency to degrade

## rnPrimitiveMap

- <Sheet> → @gorhom/bottom-sheet BottomSheetModal (40% --ink scrim, 28px top radius, 4px hairline grip, sheet-rise spring; body on --paper)
- <div>/<span> → <View>/<Text>
- <button> → <Pressable> + expo-haptics Haptics.selectionAsync() for the 'press' utility
- <input readOnly> → <TextInput editable={false} selectTextOnFocus> (or BottomSheetTextInput)
- <ul>/<li> with dot spans → <View> rows; dot = small <View> w/ borderRadius (w 1.5 h 1.5 → 6px circle)
- tabular className → <Text style={{fontVariant:['tabular-nums']}}>
- font-display (Fraunces) → embedded Fraunces font; accent word = plain Text colored --accent (drop italic)
- hairline class → StyleSheet.hairlineWidth borders
- CSS vars (--paper etc.) → theme object + useTheme()/makeStyles (kitTheme pattern)
- sonner toast → RN toast / Snackbar lib
- downloadIcs (Blob+anchor) → expo-file-system + expo-sharing (share text/calendar)
- navigator.clipboard → expo-clipboard setStringAsync (resolves; rework success/fail branch)
- .sheet-in / .scrim-in keyframes → gorhom animation config + reanimated
- press:active scale(0.97) → Pressable style fn / reanimated withTiming on press

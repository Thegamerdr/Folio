# PaydayRitualScreen (C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPaydayRitual.tsx)

## file

C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPaydayRitual.tsx

## rnComponentName

PaydayRitualScreen

## purpose

Multi-step (4-step) "close the cycle" ceremony. Computes retrospective actuals for the trailing 30 days (spent, left-over/spare, lowest tight point, set-aside), walks the user through them one slow step at a time with a Melo line per step, captures one optional 140-char "line for next-you", and on the final step calls addCycle() to record the closed cycle so Insights + Share have real data; then navigates to Today, opens the Share sheet (~350ms later) and the Melo chat (~1500ms later). Copy is FROZEN — ceremonial, slow, never rushed. nav.back / "Save and finish later" both exit WITHOUT recording a cycle.

## reads

- subs
- subPaused
- subOverrides
- onboarding (onboarding.monthlyIncome)
- transactions
- pots
- calendarEvents
- currentBalance (currentBalance.amount)
- potLedger
- nextYouNote (read as persistedNote; seeds the step-4 textarea draft)

## writes

- setNextYouNote(note) — fired on EVERY keystroke in the step-4 textarea so the draft survives leave/return
- addCycle({closedAt, label, spare, tightPoint, setAside, note}) — fired once on the final-step CTA; internally also clears nextYouNote to "" and slices cycles to latest 24

## opensSheets

- share (nav.openSheet('share') ~350ms after finish)
- (also nav.openMelo({seed}) ~1500ms after finish — opens Melo chat, NOT via the SheetId path; doc block @opens-sheet is declared as '—')

## copyKeys

- STRINGS ARE INLINE, NOT COPY_DECK KEYS — must be migrated into COPY_DECK on port (existing ritual.\* keys describe a DIFFERENT/older ritual and do NOT match)
- Header progress: '{step+1} of {steps.length}' e.g. '1 of 4'
- Back glyph: '←' (aria-label 'Back')
- Step 1 eyebrow: 'Step one'
- Step 1 headline: 'Look at the month just gone.' (accent word: month)
- Step 1 body: 'You spent £{spent}. Bills cleared. Lowest balance was £{tightPoint}.'
- Step 1 stat label: 'Left over'; value '£{spare}'; tone positive
- Step 1 melo: 'You made it through. Quietly well done.'
- Step 1 cta: 'Pay yourself first'
- Step 2 eyebrow: 'Step two'
- Step 2 headline: 'Move a little into pots.' (accent: a little)
- Step 2 body (populated, setAside>0): '{potFirstNames} — £{setAside} moved in this cycle so far. You can change any of these.' (potFirstNames = first word of each pot.name where perWeek>0, joined by ', ')
- Step 2 body (empty, setAside==0): 'No pot top-ups this cycle yet. Add one now if it feels right.'
- Step 2 stat label: 'Set aside'; value '£{setAside}'; tone ink
- Step 2 melo: 'Small, steady. Your future self will thank you.'
- Step 2 cta: 'See the squeeze ahead'
- Step 3 eyebrow: 'Step three'
- Step 3 headline: "Where's the squeeze next month?" (accent: squeeze)
- Step 3 body: '12 Jul looks tightest. Two bills land that week. Worth knowing in advance.' (HARDCODED placeholder date/copy — fidelity risk, see notes)
- Step 3 stat label: 'Next low point'; value '£{tightPoint}'; tone accent
- Step 3 melo: 'Knowing in advance is half the work.'
- Step 3 cta: 'Leave a note for next-you'
- Step 4 eyebrow: 'Step four'
- Step 4 headline: 'One line for next-you.' (accent: line)
- Step 4 textarea placeholder: 'One honest line — what to hold, what to watch.' (maxLength 140, rows 3, autoFocus)
- Step 4 counter: '{note.length}/140'
- Step 4 stat label: 'Note'; value '✓' if note.trim() else '—'; tone positive when noted else ink
- Step 4 melo (noted): 'Done. The month is wrapped up.'
- Step 4 melo (empty): 'Even a short line helps. Or skip it.'
- Step 4 cta: 'Finish the review'
- addCycle label: month name via now.toLocaleString('en-GB', {month:'long'}) e.g. 'June'
- addCycle fallback note: 'No note this cycle.' (when textarea empty)
- Melo seed on finish: 'Cycle closed — pots topped up, note saved for next-you. Want to look at next month together?'
- Secondary button: 'Save and finish later'

## tokens

- --paper
- --accent
- --positive
- --hairline (from doc block)
- --muted-ink
- --ink
- --surface
- --inset
- --shadow-card
- --accent (CTA bg + coral shadow rgba(224,99,58,0.55))
- white (#FFFFFF, CTA text)

## motions

- slide-in-r (root container entrance, 360ms)
- press (back button, CTA, secondary button, all tappable)
- progress-dot width/color transition (transition-all duration-500 — bespoke, maps to reanimated withTiming 500ms on dot width 20→28px and color)
- count-up (Money values per MOTION rule 'money never slides' — Money atom should tick to target)
- verdict-stamp (doc block @motion 'stamp on completion' — the seal/stamp moment on finish; STATES says ritual done uses celebrate, the stamp is the ceremonial seal)
- Melo breathe/blink/mood-swap (MeloLine per step, mood changes step-to-step)

## moods

- cheer (Step 1 — small win 'you made it')
- calm (Step 2 — small steady; also Step 4 when note empty)
- curious (Step 3 — looking ahead at the squeeze)
- celebrate (Step 4 when note.trim() is non-empty — 'Done. The month is wrapped up.')
- NOTE: MELO_MOODS.md surface map lists ritual: intro=calm, what-worked=cheer, what-slipped=concern, done=celebrate — this 4-step build diverges (uses cheer/calm/curious/celebrate). The done=celebrate intent is preserved on step 4 when noted. celebrate must fire at most once per cycle (rule).

## componentTree

<PaydayRitualScreen> (full-height flex column, px-7 pt-4, slide-in-r)

  <Header row: space-between>
    <BackButton onPress={nav.back} aria-label="Back"> ← </BackButton>
    <View row gap-3>
      <ProgressLabel> {step+1} of {steps.length} </ProgressLabel>  (uppercase, tracking 0.16em, tabular)
      <ProgressDots aria-hidden>  {steps.map(i => <Dot active={i===step} done={i<step} />)}  </ProgressDots>
        // active: w-28(7) accent · done: w-20(5) ink/70 · future: w-20(5) hairline · all h-1 rounded, 500ms transition
    </View>
    <Spacer w-5 />   // balances the back button
  </Header>

  <CopyBlock mt-7>
    <Eyebrow font-display italic 13px muted> {s.eyebrow} </Eyebrow>
    <Headline font-display 32px leading-1.05> {s.headline with accent <em> word in --accent, NOT italic} </Headline>
    <Body 14px muted mt-4 max-w-320> {s.body — string OR (step 4) the textarea block} </Body>
  </CopyBlock>

  <StatCard mt-6 surface hairline rounded-2xl p-6 shadow-card>
    <StatLabel 11px uppercase tracking-0.12em muted> {s.stat.label} </StatLabel>
    <Money value={s.stat.value} size="xl" tone={s.stat.tone} />   // tabular, count-up
  </StatCard>

  <MeloRow mt-6>
    <MeloLine text={s.melo} mood={s.meloMood} />   // Melo size 28 + Fraunces italic quote
  </MeloRow>

<Spacer flex-1 /> // pushes CTAs to bottom

<PrimaryCTA onPress={advance-or-finish} h-58 rounded-2xl bg-accent white 16px medium, coral drop-shadow>
{s.cta}
</PrimaryCTA>
<SecondaryButton onPress={nav.back} mt-2 mb-5 h-42 13px muted> Save and finish later </SecondaryButton>
</PaydayRitualScreen>

// Step-4 body override = <View mt-3><TextInput multiline autoFocus value={note} onChangeText maxLength=140 numberOfLines=3 placeholder bg-inset hairline rounded-xl px-3 py-2.5 14px, focus ring accent/30, no resize/grow> + <CounterText 10.5px muted tabular>{note.length}/140</CounterText></View>

## enginesNeeded

- @rn-engine ritual-actuals (ENGINES.md §6 'cycle close numbers' + §7 'ritual-actuals' / 'Cycle close note') — the retrospective computation
- Money path / calendar-events engine: deriveCalendarEvents({subs,subPaused,subOverrides,onboarding,manualEvents:calendarEvents,pots,windowDays:35,now}) → groupByDay → computeSpareAndTightest(grouped, currentBalance.amount) → tightestSpare
- Cycle tracker / Insights engine (consumer of addCycle output — closed-cycle aggregates)
- Local store + addCycle / setNextYouNote / nextYouNote persistence (versioned schema; nextYouNote draft survival)
- Computation detail: spent = Σ|negative txn amount| where when ≥ now-30d; spare = max(0, round(monthlyIncome - spent)); tightPoint = max(0, round(tightestSpare)); setAside = round(Σ potLedger deposits where at ≥ now-30d)

## fidelityRisks

- Step 3 body is HARDCODED ('12 Jul looks tightest. Two bills land that week.') and does NOT use the computed tightPoint date — only the stat value is real. Porting as-is ships a fake date; flag for a real engine string OR keep as known placeholder.
- Strings are inline, not in COPY_DECK — porting must add them to COPY_DECK (voice rules: one accent word per headline, money as tabular figures never '12.3K', no banned words). Check 'No note this cycle.' fallback against voice.
- Accent word: web uses <em className='not-italic text-[var(--accent)]'> — in RN this is a nested <Text> with accent color inside the Fraunces headline <Text>, NOT italic. Easy to render italic by mistake.
- Money atom must count-up, never slide (MOTION rule). Values are strings already formatted ('£1,234') so RN Money must accept a preformatted string and still animate.
- Mood divergence from MELO_MOODS.md surface map (intro/worked/slipped/done = calm/cheer/concern/celebrate) vs this build (cheer/calm/curious/celebrate). Decide which is canonical; preserve celebrate-once-per-cycle.
- Finish sequence uses setTimeout(350) then setTimeout(1500) after nav.go('today'). In RN these must be cleared on unmount (AbortController/clearTimeout) or they fire after the screen is gone / cause navigate-after-unmount. The ordering (Today → Share sheet → Melo chat) is intentional choreography — keep the cadence.
- verdict-stamp / 'stamp on completion' motion (doc block) has no explicit JSX here — the stamp is implied as the seal moment on finish; port must add it (likely on the Today/Share landing or a seal frame), don't drop it.
- Progress dots animate width (w-5↔w-7) — that's a layout-bound property the web does via transition-all; per perf rules RN should animate transform/opacity, but width tween on a 4px element is acceptable; mirror the 500ms.
- textarea autoFocus → RN TextInput autoFocus pops the keyboard immediately on step 4; ensure the layout (flex-1 spacer + bottom CTAs) survives keyboard with KeyboardAvoidingView so the CTA stays reachable.
- STATES.md: PaydayRitual empty branch = 'Nothing to close yet' (EmptyState) — this component does NOT render that branch; the gate lives upstream (only mount ritual when there is a cycle to close). Port must keep that gate or add the empty branch.
- No loading/error/offline branches in-component (STATES marks them n/a / offline=same as populated) — fine, but addCycle is local + synchronous so finish must not show a spinner.
- Pot first-name derivation: pots.filter(perWeek>0).map(p=>p.name.split(' ')[0]).join(', ') — if a pot name is a single word it shows whole; if empty filter, step-2 still shows setAside value but body switches to the 'no top-ups' line only when setAside==0 (not when filter empty) — subtle: populated body can list names even if setAside text says a number; keep the exact conditional (setAside>0).

## docBlock

@rn-screen PaydayRitualScreen
@rn-stack MainTabs > Today > Ritual
@purpose Multi-step close-the-cycle ritual. Calls addCycle on completion.
@reads pots, subs, transactions
@writes addCycle
@opens-sheet —
@copy FROZEN — ceremonial, slow, never rushed.
@tokens --paper --accent --positive --hairline
@motion stamp on completion · slide-in-r per step
(plus inline @rn-engine ritual-actuals on the actuals useMemo)

## rnPrimitiveMap

- <div> → <View>
- <button> → <Pressable> + expo-haptics Haptics.selectionAsync() (press utility = scale 0.97 on active, 120ms)
- <h2>/<p>/<span> text → <Text> (font-display headline = embedded Fraunces; eyebrow/melo = Fraunces italic; labels = Inter Tight/system grotesque)
- <em class='not-italic text-accent'> → nested <Text style={{color: theme.accent}}> inside headline Text (NOT italic)
- <textarea> → <TextInput multiline numberOfLines={3} maxLength={140} autoFocus> (onChange e.target.value → onChangeText)
- <Money> tabular figs → <Text style={{fontVariant:['tabular-nums']}}> with count-up via reanimated useDerivedValue/interpolate
- <MeloLine>/<Melo mood> → react-native-svg + reanimated breathe; five SVG mood deltas, NO Lottie
- CSS tokens (--paper etc.) → theme object + useTheme() hook (kitTheme/makeStyles pattern in folio-v2-greenfield)
- hairline class (1px border) → StyleSheet.hairlineWidth border with theme.hairline
- boxShadow var(--shadow-card) → RN shadow props (iOS shadowColor/Offset/Opacity/Radius + Android elevation) mapped from the token; CTA coral shadow 0 12px 24px -10px rgba(224,99,58,.55) approximated
- focus:ring-2 focus:ring-accent/30 → TextInput onFocus border/ring color (no native focus ring; emulate with borderColor)
- nav.back / nav.go('today') / nav.openSheet('share') / nav.openMelo → @react-navigation stack (goBack, navigate('Today')) + gorhom BottomSheetModal for share + Melo chat sheet
- setTimeout choreography → reanimated/runOnJS timeouts cleared on unmount (useEffect cleanup) to avoid navigate-after-unmount
- slide-in-r → reanimated withTiming(translateX 28→0, opacity 0→1, 360ms cubic-bezier(.16,1,.3,1)); collapse to final state under AccessibilityInfo.isReduceMotionEnabled
- prefers-reduced-motion → AccessibilityInfo.isReduceMotionEnabled (motions collapse to final state, not slowed)

## stateBranches

- populated (happy path) — the only branch this component itself renders; all 4 steps are populated views driven by actuals
- step-internal 'empty' for step 2 — setAside==0 swaps body to 'No pot top-ups this cycle yet. Add one now if it feels right.' (data-driven within populated)
- step-internal note state for step 4 — note empty (stat '—', melo 'Even a short line helps. Or skip it.', mood calm) vs noted (stat '✓', melo 'Done. The month is wrapped up.', mood celebrate)
- empty (screen-level, NOT in this file) — STATES.md: 'Nothing to close yet' via EmptyState; gated upstream, must be preserved/added on port
- loading — n/a (addCycle is local + synchronous; no spinner; STATES marks loading n/a for PaydayRitual)
- error — n/a (STATES)
- offline — same as populated (local-first; STATES)

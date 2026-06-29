# MeloChatSheet  (C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetMeloChat.tsx)

## file

C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\sheets\SheetMeloChat.tsx

## rnComponentName

MeloChatSheet

## purpose

Melo conversation surface inside a bottom sheet: builds a last-14-days app-state snapshot + a proactive opener line, then hosts the full Melo chat (transcript, tone/share settings, 4 store-mutating tool calls with 8s undo, composer). The wrapper is logic-only; the visible UI lives in the embedded MeloChat component.

## reads

- useAppStore selectors: pots, subs, subPaused, tightPointGoal, onboarding, transactions
- nav.pressure
- intent.prefill / intent.seed
- persisted chat state from localStorage key folio.melo.chat.v1

## writes

- applyMeloTool side effects into the app store (pause sub / move pots / set tight-point goal / log spend)
- chat persistence to local storage
- streaming chat request to /api/melo-chat (server persona)

## opensSheets



## copyKeys

- melo.name = "Melo" (COPY_DECK; header title hardcoded as "Melo" here)
- header subtitle dynamic: (share ? "Knows your money" : "Just listening") + " · " + toneLabel
- tune toggle: "Tune" / "Done"
- settings section label: "Voice"
- tone buttons: "Calm" | "Honest" | "Dry" | "Coachy" (ids calm|honest|dry|coachy)
- share row title: "Let Melo see my money"
- share row body: "Shares your path, pots, and subs as context. Stays on this device."
- "Start fresh"
- clear confirm: "Clear this conversation?"
- empty-state headline (Fraunces italic): "What's on your mind?"
- starter chips: "Why is my tight point so low?" | "Can I afford £40 on Friday?" | "Talk me out of this Spotify charge" | "How's the month going?"
- loading line (Shimmer): "Melo's thinking…"
- tool pill working state: "working on it…"
- tool pill action: "Undo"
- error line: "Couldn't reach Melo just now. " + error.message
- composer placeholder: "Say anything to Melo…"
- auto-seed openers (templated, name-prefixed): quiet-sub renewal nudge "heads up — {sub} (£{cost}) renews in {n} day(s) and you haven't opened it in {m} days. want to pause this cycle?" | renews-soon "quick one — {sub} £{cost} leaves {today|in Nd}. all good with that?" | spend-summary "here when you need me. last two weeks you've spent £{total} — mostly {category}. anything you want to look at?" | fallback "here when you need me. what's on your mind?"
- copy note: doc block says @copy FROZEN — most assistant lines come from the server persona, not this file

## tokens

- --paper
- --surface
- --inset
- --ink
- --muted-ink
- --hairline
- --accent
- --accent-soft
- --positive
- --caution
- --negative
- --shadow-sheet (0 -8px 40px -12px rgba(26,24,21,0.18))
- --font-display (Fraunces) via font-display/font-display italic
- tabular (font-variant-numeric: tabular-nums)

## motions

- sheet-rise (480ms cubic-bezier(.16,1,.3,1)) — sheet body slide-up
- scrim-in (320ms ease-out) — scrim fades to 45% ink
- press (120ms, scale 0.97 on active) — every tappable: tune button, tone buttons, starter chips, undo, start-fresh
- message fade-in (per doc block @motion 'message fade-in') — assistant/user bubbles enter
- Shimmer (2s linear infinite background-position) — 'Melo's thinking…' loading shimmer
- pebble-breathe family on the Melo avatar (calm=4.4s default) + blink
- undo-pill 8s timer (not an animation — setTimeout window during which the Undo affordance is shown then auto-removed)
- melo-mood-pulse / 600ms tilt + 500ms mouth-eyes on avatar mood change (avatar is calm here)

## moods

- calm — the only mood used here; avatar mood = pressureMood[nav.pressure] which maps safe/calm->calm, soft->'soft'(=calm alias), pressured/overspent->'alert'(=concern alias). MELO_MOODS.md fixes 'Melo chat sheet' = calm. RN must collapse the soft/alert aliases to calm/concern and per the mood map render calm for the chat sheet.

## docBlock

/**
 * @rn-sheet     MeloChatSheet
 * @purpose      Melo conversation surface — snapshot of app state + 4 tool calls.
 * @reads        Full app snapshot (pots, subs, subPaused, tightPointGoal, onboarding, last-14d txns)
 * @writes       applyMeloTool via tool callbacks
 * @copy         FROZEN — most lines come from the server persona, not this file.
 * @tokens       --paper --accent --hairline --muted-ink
 * @motion       sheet-in · message fade-in · undo-pill 8s timer
 */

## componentTree

<Sheet onClose>            {/* gorhom BottomSheetModal: 40% ink scrim, 28px top radius, paper body, grip, sheet-rise */}
  <MeloChat snapshot avatar={<Melo size=36 mood="calm"/>} prefill seed>
    <View flex h≈640 maxH 78vh>
      <Header row borderBottom hairline>
        {avatar /* Melo 36 */}
        <View flex>
          <Text 14 medium>Melo</Text>
          <Text 11.5 mutedInk truncate>{share?'Knows your money':'Just listening'} · {toneLabel}</Text>
        </View>
        <Pressable press>{showSettings?'Done':'Tune'}</Pressable>
      </Header>
      {showSettings && (
        <SettingsPanel borderBottom hairline>
          <Text 11.5 upper tracked mutedInk>Voice</Text>
          <Row grid-4 gap>
            {TONES.map(t => <Pressable press h32 rounded selected?ink/paper:inset/ink>{t.label}</Pressable>)}
          </Row>
          <Pressable row label>
            <View flex><Text 13>Let Melo see my money</Text><Text 11.5 mutedInk>Shares your path, pots, and subs as context. Stays on this device.</Text></View>
            <Switch checked={share} accentThumb/>  {/* web checkbox accent --accent */}
          </Pressable>
          {messages.length>0 && <Pressable press underline mutedInk>Start fresh</Pressable>}
        </SettingsPanel>
      )}
      <Transcript flex>            {/* Conversation = stick-to-bottom scroll + scroll-to-bottom FAB */}
        <ScrollView stickToBottom>
          {EMPTY && messages.length===0 && !isLoading && (
            <View>
              <Text font-display italic 16>What's on your mind?</Text>
              {STARTERS.map(s => <Pressable press inset rounded textLeft 13 onPress={send(s)}>{s}</Pressable>)}
            </View>
          )}
          {messages.map(m =>
            m.role==='user'
              ? <Bubble alignEnd ink/paper rounded2xl br-md maxW80%>{text}</Bubble>
              : <Assistant>
                  {text && <Markdown prose-melo 13.5 ink>{text}</Markdown>}
                  {toolParts.map(tp =>
                    <ToolPill inset border hairline rounded>
                      <Text accent>✓</Text>
                      <View flex><Text 10.5 upper tracked mutedInk>{name}</Text><Text ink>{done?output.message:'working on it…'}</Text></View>
                      {canUndo && <Pressable press underline mutedInk onPress={runUndo}>Undo</Pressable>}
                    </ToolPill>)}
                </Assistant>)}
          {status==='submitted' && <Shimmer 13.5>Melo's thinking…</Shimmer>}
          {error && <Text 12 accent>Couldn't reach Melo just now. {error.message}</Text>}
        </ScrollView>
        <ScrollToBottomButton/>
      </Transcript>
      <Composer pt>
        <PromptInput onSubmit={send(input)}>
          <TextInput ref placeholder="Say anything to Melo…" value={input} onChangeText disabled={isLoading} autoFocus multiline/>
          <Row justifyEnd><SubmitButton status={isLoading?'streaming':undefined} disabled={!input.trim()&&!isLoading}/></Row>
        </PromptInput>
      </Composer>
    </View>
  </MeloChat>
</Sheet>

## enginesNeeded

- Melo chat backend — NOT in this prototype. RN must wire the standalone ai-gateway Cloudflare Worker (OpenRouter/Gemini, key server-side); RN_PORT.md forbids talking to Supabase/any Lovable backend. The web /api/melo-chat route + @ai-sdk/react useChat + DefaultChatTransport must be replaced with an RN streaming client (SSE/fetch-stream) against the gateway.
- Snapshot builder (in-component, pure): last-14-day txn filter, spendByCategory reduce, pots/subs projection, daysToPayday is HARDCODED 11 in this prototype — RN needs the real cycle/payday engine.
- Proactive opener heuristic (autoSeed) — pure local logic over subs/spend; ports as-is.
- applyMeloTool dispatcher (store.ts) — 4 tools + undo; ports as-is into the RN store actions (togglePaused, setPots, setTightPointGoal, addTransaction/removeTransaction).
- Melo persona/tone system (src/lib/melo/persona.ts buildSystemPrompt) — lives server-side; gateway owns it.
- Markdown renderer for assistant text (react-markdown -> react-native-markdown-display or similar).

## stateBranches

- empty — messages.length===0 && !isLoading: Fraunces-italic 'What's on your mind?' + 4 tappable starter chips. NOTE: when there is no prefill/seed an autoSeed opener is injected as a seeded assistant message, so the empty chip view only shows when there is genuinely no seed AND no history.
- seeded/opener — first assistant bubble is the autoSeed (or intent.seed) line; rest of chat empty.
- loading — status==='submitted': Shimmer 'Melo's thinking…' (NO spinner per STATES.md; submit button shows spinner icon, streaming shows square/stop).
- streaming — status==='streaming': assistant text fills incrementally; composer disabled; submit icon = stop square.
- populated — user bubbles (ink-on-paper, right) + assistant bubbles (markdown) + inline tool pills (✓ + tool name + result message, optional Undo for 8s).
- tool-applied — pill shows output.message, an 8s Undo affordance appears then auto-clears.
- error — error truthy: accent-colored 'Couldn't reach Melo just now. {message}'.
- offline — STATES.md marks Melo screen offline = same as populated (local-first); RN should degrade gracefully, surface the same error line if the gateway is unreachable.

## rnPrimitiveMap

- <Sheet> (web absolute scrim+paper div) -> @gorhom/bottom-sheet BottomSheetModal (40% ink scrim, 28px top radius, 4px hairline grip, sheet-rise spring; body on --paper not --surface)
- Conversation/ConversationContent (use-stick-to-bottom) -> BottomSheetScrollView (or RN ScrollView) with manual stick-to-bottom (scrollToEnd on new message) + a scroll-to-bottom FAB
- ConversationScrollButton -> Pressable FAB (only when not at bottom) with ArrowDown (lucide-react-native)
- PromptInput/PromptInputTextarea/PromptInputSubmit (shadcn InputGroup) -> View + multiline TextInput + Pressable submit; reimplement Enter-to-send as a send button (no Enter key on mobile), keep disabled logic
- ReactMarkdown -> react-native-markdown-display (or markdown-to-RN); class prose-melo -> RN markdown style sheet using --ink/--muted-ink
- Shimmer (motion/react bg-clip-text) -> reanimated shimmer over Text (animate translateX of a masked gradient) duration 2s linear infinite
- Melo avatar (react-dom SVG) -> react-native-svg + reanimated breathe
- tone/share checkbox <input type=checkbox accent> -> RN Switch or custom toggle tinted --accent
- press utility -> Pressable + expo-haptics selectionAsync; scale 0.97 via reanimated/Animated
- CSS tokens (var(--paper) etc.) -> theme object + useTheme() (kitTheme/makeStyles pattern already in the RN app)
- font-display Fraunces -> embedded Fraunces font; tabular -> fontVariant:['tabular-nums']
- localStorage folio.melo.chat.v1 -> AsyncStorage/MMKV (encrypted store per Folio local-first promise)
- useChat/@ai-sdk/react + DefaultChatTransport('/api/melo-chat') -> RN fetch/SSE streaming client to the ai-gateway Worker; replicate the parts[] model (text parts + tool-* parts with state 'output-available' and toolCallId)
- window.confirm('Clear this conversation?') -> RN Alert.alert confirm dialog

## fidelityRisks

- The tool-call -> store mutation bridge is the heart of this surface and is easy to drop. RN MUST replicate: dedupe by toolCallId (appliedRef set), only apply when part.state==='output-available', call applyMeloTool(name, input), and on applied=true open an 8s Undo window then auto-expire it. The undo closures (togglePaused/setPots/setTightPointGoal/removeTransaction) must capture pre-change state exactly.
- daysToPayday: 11 and pressureLow/tightPoint are HARDCODED prototype values; do not ship them — wire the real money-path/cycle engine.
- Snapshot is only sent to the model when settings.share is true (default false). Privacy is real: do NOT auto-send the snapshot. The 'Let Melo see my money / Stays on this device' copy must remain truthful — RN must not silently upload state.
- autoSeed only runs when there is no intent.prefill AND no intent.seed; the seeded opener replaces the empty starter-chip view. Getting this precedence wrong shows chips when an opener was expected (or vice-versa).
- Default tone is 'calm', default share is FALSE — match these or the persona/privacy behaviour shifts.
- No spinners (STATES.md): loading is Shimmer text only; the submit-button spinner/stop icons are the only allowed glyph affordances. Don't add a generic ActivityIndicator in the transcript.
- Avatar mood: pressureMood maps to 'soft'/'alert' aliases; MELO_MOODS.md says drop the aliases in RN and the chat sheet is canonically calm — render calm here, don't carry soft/alert.
- Currency formatting: openers use £ with .toFixed(2)/.toFixed(0) and a real minus glyph in formatGBP (− U+2212, not hyphen). Keep tabular-nums and the typographic minus.
- Markdown assistant text can contain lists/headers; prose-melo styling must stay inside the paper aesthetic (system body font, --ink), not a default markdown theme.
- Persisting raw UIMessages including tool parts to storage — RN must serialize the same parts[] shape so reload re-renders tool pills (without re-applying mutations; appliedRef prevents double-apply only within a session, so on reload guard against re-running applied tools — the web relies on tools only firing live, RN should not replay stored tool parts as new mutations).
- localStorage is unavailable in RN; the loadPersisted/savePersisted guards on window must be replaced, not just no-op'd, or history/settings silently never persist.
- Sheet max height (640px / 78vh) + internal scroll: gorhom snap points must leave the composer reachable above the keyboard (KeyboardAvoiding / BottomSheet keyboard handling).


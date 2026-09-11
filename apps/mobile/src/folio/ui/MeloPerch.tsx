import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FinancialPlanResult } from '@folio/finance-engine';
import { selectFinancialPresentation } from '@/folio/lib/financialPresentation';
import { meloAnchorContext } from '@/folio/lib/melo/anchorContext';
import { deriveShellContextAction } from '@/folio/lib/melo/companion';
import type { PerchSide } from '@/folio/lib/melo/perch';
import { resolvePresenceDrop } from '@/folio/lib/melo/presenceMotion';
import { MeloSuppressedContext } from '@/folio/melo/MeloVisibility';
import { useMeloViewport } from '@/folio/melo/MeloScrollView';
import { useMeloPresenceLayer } from '@/folio/melo/MeloPresenceLayer';
import { MeloContextSheet } from '@/folio/sheets/MeloContextSheet';
import { setMelo, useAppStore } from '@/folio/store';
import { useTheme } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';
import { MeloPerchBubble } from './MeloPerchBubble';

/** Context remains normal document content. Only its adjacent whitespace is an
 * anchor for the shell's single character; this component renders no bird/rail. */
export function MeloPerch({
  screen,
  nav,
  plan,
}: {
  screen: ScreenId;
  nav: Nav;
  plan: FinancialPlanResult | null;
}) {
  const t = useTheme();
  const state = useAppStore((current) => current);
  const presentation = selectFinancialPresentation(state, plan);
  const context = meloAnchorContext(plan, presentation);
  const mood = !presentation.complete
    ? 'curious'
    : (plan?.safeToSpendMinor ?? 0) < 0
      ? 'concern'
      : 'calm';
  const quiet = state.melo?.quietMode === true;
  const preferred = state.melo?.preferredPosition ?? 'auto';
  const suppressed = useContext(MeloSuppressedContext);
  const presence = useMeloPresenceLayer();
  const viewport = useMeloViewport();
  const id = useId();
  const body = useRef<View>(null);
  const explanation = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const action = deriveShellContextAction(screen);
  const move = useCallback(
    (side: PerchSide) => setMelo({ preferredPosition: side, companionPosition: undefined }),
    [],
  );
  const activate = useCallback(() => setOpen(true), []);
  const drop = useCallback(
    (dx: number, dy: number) => {
      const side = resolvePresenceDrop(width, preferred, dx, dy);
      if (!side) return false;
      move(side);
      return true;
    },
    [preferred, width, move],
  );
  const publish = useCallback(
    () =>
      presence?.publish({
        id,
        screen,
        node: body.current,
        viewport: viewport?.() ?? null,
        exclusion: explanation.current,
        visible: !quiet && !keyboard && !optionsOpen && !suppressed,
        mood,
        onPress: activate,
        onMove: move,
        onDrop: drop,
      }),
    [
      presence,
      id,
      screen,
      viewport,
      quiet,
      keyboard,
      optionsOpen,
      suppressed,
      mood,
      activate,
      move,
      drop,
    ],
  );
  useLayoutEffect(() => {
    publish();
    return () => presence?.remove(id);
  }, [publish, presence, id]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboard(true);
      setOpen(false);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const followContext = () => {
    if (context.destination === 'onboarding') nav.openSheet('onboarding');
    else if (context.destination === 'melo')
      nav.openMelo(action ? { prefill: action.prompt } : undefined);
    else nav.go(context.destination);
  };
  return (
    <>
      <View
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          publish();
        }}
        style={[
          styles.contextBlock,
          { flexDirection: preferred === 'left' ? 'row-reverse' : 'row' },
        ]}
      >
        <View ref={explanation} collapsable={false} onLayout={publish} style={styles.explanation}>
          <Text style={[styles.contextLine, { color: t.ink }]}>{context.sentence}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={followContext}
            style={styles.contextAction}
          >
            <Text style={[styles.contextLabel, { color: t.calm }]}>{context.label} →</Text>
          </Pressable>
        </View>
        {!quiet ? (
          <View
            ref={body}
            collapsable={false}
            onLayout={publish}
            pointerEvents="none"
            style={styles.anchor}
          />
        ) : null}
      </View>
      {open && !keyboard && !optionsOpen && !suppressed ? (
        <View style={styles.bubbleSlot}>
          <MeloPerchBubble
            statement={
              context.destination === 'onboarding'
                ? 'I can help you add the missing numbers.'
                : 'I can explain what is included in this figure.'
            }
            position={preferred}
            onClose={() => setOpen(false)}
            onMove={move}
            onOptions={() => {
              setOpen(false);
              setOptionsOpen(true);
            }}
            onExpand={() => {
              setOpen(false);
              nav.openMelo(action ? { prefill: action.prompt } : undefined);
            }}
          />
        </View>
      ) : null}
      <MeloContextSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        mood="calm"
        presence="perched"
        {...(action ? { action } : {})}
        quietMode={quiet}
        position={preferred}
        onAction={() => action && nav.openMelo({ prefill: action.prompt })}
        onQuietModeChange={() => {
          setMelo({ quietMode: !quiet });
          setOpen(false);
          setOptionsOpen(false);
        }}
        onPositionChange={move}
        onTalk={() => nav.openMelo()}
      />
    </>
  );
}
const styles = StyleSheet.create({
  contextBlock: { marginVertical: 12, alignItems: 'center', gap: 8 },
  explanation: { flex: 1, minWidth: 0 },
  anchor: { width: 76, height: 76 },
  contextLine: { fontSize: 14, lineHeight: 20 },
  contextAction: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  contextLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  bubbleSlot: { marginBottom: 24 },
});

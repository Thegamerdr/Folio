/**
 * Melo's native context sheet.
 *
 * Hierarchy stays intentionally short: presence/mood, one useful contextual
 * action, then quiet and safe-position controls. Deeper conversation remains
 * owned by MeloChatSheet; this is not a debug panel or a second chat surface.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet, gap, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import type { MeloContextAction, MeloPosition, MeloPresence } from '@/folio/lib/melo/companion';

export type MeloContextSheetProps = {
  visible: boolean;
  onClose: () => void;
  mood: Parameters<typeof Melo>[0]['mood'];
  presence: MeloPresence;
  action?: MeloContextAction;
  quietMode: boolean;
  position: MeloPosition;
  onAction?: () => void;
  onQuietModeChange: () => void;
  onPositionChange: (position: MeloPosition) => void;
  onTalk?: () => void;
};

export function MeloContextSheet({
  visible,
  onClose,
  mood,
  presence,
  action,
  quietMode,
  position,
  onAction,
  onQuietModeChange,
  onPositionChange,
  onTalk,
}: MeloContextSheetProps) {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View accessibilityRole="summary" accessibilityLabel={`Melo is ${presence}, mood ${mood}`}>
        <View style={styles.header}>
          <Melo mood={mood} size={42} />
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>Melo · here with you</Text>
            <Text style={[styles.title, { color: t.ink }]}>A useful moment, not a dashboard.</Text>
            <Text style={[styles.subline, { color: t.muted }]}>Presence: {presence}</Text>
          </View>
        </View>

        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              onAction?.();
              onClose();
            }}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: t.inset, borderColor: t.hairline },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <View style={styles.actionCopy}>
              <Text style={[styles.actionLabel, { color: t.ink }]}>{action.label}</Text>
              <Text style={[styles.actionPrompt, { color: t.muted }]}>{action.prompt}</Text>
            </View>
            <Text style={[styles.arrow, { color: t.calm }]}>→</Text>
          </Pressable>
        ) : (
          <Text style={[styles.empty, { color: t.muted }]}>Nothing needs your attention here.</Text>
        )}

        <View style={[styles.controls, { borderTopColor: t.hairline }]}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={`Quiet presence, ${quietMode ? 'on' : 'off'}`}
            accessibilityState={{ checked: quietMode }}
            onPress={onQuietModeChange}
            style={({ pressed }) => [styles.controlRow, pressed ? styles.pressed : undefined]}
          >
            <View style={styles.controlCopy}>
              <Text style={[styles.controlLabel, { color: t.ink }]}>Quiet presence</Text>
              <Text style={[styles.controlHint, { color: t.muted }]}>
                Keep the numbers; soften Melo's appearances.
              </Text>
            </View>
            <Text style={[styles.controlValue, { color: quietMode ? t.calm : t.muted }]}>
              {quietMode ? 'on' : 'off'}
            </Text>
          </Pressable>

          <View style={styles.positionBlock}>
            <Text style={[styles.controlLabel, { color: t.ink }]}>Safe position</Text>
            <Text style={[styles.controlHint, { color: t.muted }]}>
              Choose a side when the layout has room.
            </Text>
            <View style={styles.positionOptions}>
              {(['auto', 'left', 'right'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: position === option }}
                  accessibilityLabel={`Melo position ${option}`}
                  onPress={() => onPositionChange(option)}
                  style={({ pressed }) => [
                    styles.positionOption,
                    {
                      backgroundColor: position === option ? t.ink : t.surface,
                      borderColor: t.hairline,
                    },
                    pressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.positionLabel,
                      { color: position === option ? t.canvas : t.ink },
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {onTalk ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talk to Melo"
            onPress={() => {
              onTalk();
              onClose();
            }}
            style={({ pressed }) => [
              styles.talk,
              { backgroundColor: t.calm },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.talkLabel, { color: t.inverse }]}>Talk to Melo</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Melo options"
          onPress={onClose}
          hitSlop={8}
          style={styles.close}
        >
          <Text style={[styles.closeLabel, { color: t.muted }]}>Close</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: gap.md },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 12.5 },
  title: { fontFamily: serif.display, fontSize: 21, lineHeight: 25, marginTop: gap.xxs },
  subline: { fontSize: 11.5, marginTop: gap.xs },
  action: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.xl,
    minHeight: 68,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  actionCopy: { flex: 1, gap: gap.xxs },
  actionLabel: { fontSize: 14, fontWeight: '600' },
  actionPrompt: { fontSize: 12.5, lineHeight: 18 },
  arrow: { fontSize: 20, marginLeft: gap.md },
  empty: { fontFamily: serif.displayItalic, fontSize: 14, marginTop: gap.xl },
  controls: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: gap.xl, paddingTop: gap.sm },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingVertical: gap.sm,
  },
  controlCopy: { flex: 1, gap: gap.xxs },
  controlLabel: { fontSize: 13.5, fontWeight: '500' },
  controlHint: { fontSize: 11.5, lineHeight: 16 },
  controlValue: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  positionBlock: { paddingVertical: gap.md },
  positionOptions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.sm },
  positionOption: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  positionLabel: { fontSize: 12, textTransform: 'capitalize' },
  talk: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: gap.lg,
    minHeight: 48,
  },
  talkLabel: { fontSize: 14, fontWeight: '600' },
  close: { alignItems: 'center', minHeight: 40, justifyContent: 'center', marginTop: gap.xs },
  closeLabel: { fontSize: 12.5, textDecorationLine: 'underline' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});

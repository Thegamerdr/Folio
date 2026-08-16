import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Melo } from '@/folio/melo/Melo';
import { useMeloCompanionControls } from '@/folio/companion/MeloCompanionHost';
import { setMelo, useAppStore } from '@/folio/store';
import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';

type Item = {
  id: string;
  name: string;
  hint: string;
  unlock: (args: { cycleCount: number; safeCount: number }) => boolean;
  lockedHint: string;
};

const ITEMS: readonly Item[] = [
  {
    id: 'scarf',
    name: 'Ember scarf',
    hint: 'The default warm-up. Sits at the neck.',
    unlock: ({ cycleCount }) => cycleCount >= 1,
    lockedHint: 'Earned after your first closed cycle.',
  },
  {
    id: 'crown',
    name: 'Little crown',
    hint: 'A quiet flourish. Sits above the crest.',
    unlock: ({ safeCount }) => safeCount >= 3,
    lockedHint: 'Earned after three cycles closed in the safe zone.',
  },
  {
    id: 'headphones',
    name: 'Soft headphones',
    hint: 'For long chats. Sits over the ears.',
    unlock: () => false,
    lockedHint: 'Coming later — earned after five replies to Melo.',
  },
];

export type CompanionTouchesSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** Refrozen Lovable companion-touches sheet, ported without changing its unlock rules or copy. */
export function CompanionTouchesSheet({ visible, onClose }: CompanionTouchesSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const wardrobe = useAppStore((state) => state.melo?.wardrobe ?? []);
  const cycles = useAppStore((state) => state.cycles);
  const companion = useMeloCompanionControls();

  const cycleCount = cycles.length;
  const safeCount = cycles.filter((cycle) => cycle.tightPoint > 0 && cycle.spare > 0).length;
  const equipped = new Set(wardrobe);

  const toggle = (id: string, unlocked: boolean) => {
    if (!unlocked) return;
    if (equipped.has(id)) {
      setMelo({ wardrobe: wardrobe.filter((item) => item !== id) });
      return;
    }
    // Current cosmetics are full-character replacements rather than rig attachments. Replacing
    // the existing item is the only truthful behaviour until layered wardrobe art exists.
    setMelo({ wardrobe: [id] });
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <View style={s.header}>
          <View style={s.headerCopy}>
            <Text style={s.kicker}>Companion touches</Text>
            <Text accessibilityRole="header" style={s.headline}>
              Small things Melo has <Text style={s.headlineAccent}>earned</Text>.
            </Text>
            <Text style={s.intro}>Purely cosmetic. Tap to wear or set aside. One at a time.</Text>
          </View>
          <Melo size={56} mood="calm" pose="none" />
        </View>

        <View style={s.list}>
          {ITEMS.map((item) => {
            const unlocked = item.unlock({ cycleCount, safeCount });
            const isEquipped = equipped.has(item.id);
            const disabled = !unlocked;
            const status = isEquipped ? 'on' : unlocked ? 'off' : 'locked';
            return (
              <Pressable
                accessibilityHint={unlocked ? item.hint : item.lockedHint}
                accessibilityLabel={`${item.name}. ${status}.`}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: isEquipped }}
                disabled={disabled}
                key={item.id}
                onPress={() => toggle(item.id, unlocked)}
                style={({ pressed }) => [
                  s.item,
                  isEquipped ? s.itemEquipped : s.itemIdle,
                  !unlocked ? s.itemLocked : undefined,
                  pressed ? s.pressed : undefined,
                ]}
              >
                <View style={s.itemHeading}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemStatus}>{status}</Text>
                </View>
                <Text style={s.itemHint}>{unlocked ? item.hint : item.lockedHint}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.footer}>
          {wardrobe.length > 0 ? '1/1 worn.' : 'Nothing worn.'} Current touches use complete calm
          poses, so Melo may set one aside briefly for an expression that has no matching artwork.
        </Text>
        <Pressable
          accessibilityHint={
            companion.tucked
              ? 'Restores the companion on screens with a safe perch.'
              : 'Hides the companion without changing any money features.'
          }
          accessibilityLabel={companion.tucked ? 'Restore Melo companion' : 'Tuck Melo away'}
          accessibilityRole="button"
          onPress={() => companion.setTucked(!companion.tucked)}
          style={({ pressed }) => [s.tuckControl, pressed ? s.pressed : undefined]}
        >
          <Text style={s.tuckControlLabel}>
            {companion.tucked ? 'Restore Melo' : 'Tuck Melo away'}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: {
      paddingBottom: gap.lg,
      paddingHorizontal: gap.xs,
      paddingTop: gap.sm,
    },
    header: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: gap.md,
      justifyContent: 'space-between',
    },
    headerCopy: {
      flex: 1,
    },
    kicker: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      letterSpacing: -0.2,
      lineHeight: 29,
      marginTop: 4,
    },
    headlineAccent: {
      color: t.calmStrong,
      fontFamily: serif.displayItalic,
      fontStyle: 'italic',
    },
    intro: {
      color: t.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: gap.sm,
      maxWidth: 280,
    },
    list: {
      gap: 10,
      marginTop: gap.xl,
    },
    item: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    itemEquipped: {
      backgroundColor: t.calmSoft,
      borderColor: t.hairline,
    },
    itemIdle: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
    },
    itemLocked: {
      opacity: 0.55,
    },
    itemHeading: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: gap.md,
      justifyContent: 'space-between',
    },
    itemName: {
      color: t.ink,
      flex: 1,
      fontFamily: serif.display,
      fontSize: 17,
    },
    itemStatus: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    },
    itemHint: {
      color: t.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    },
    footer: {
      color: t.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: gap.xl,
    },
    tuckControl: {
      alignItems: 'center',
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    tuckControlLabel: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },
  });
}
